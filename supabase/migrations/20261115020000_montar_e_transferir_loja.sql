-- Etapa P5c (parte 2 de 2): o super admin monta uma loja para transferir ao dono.
-- * A loja nasce escondida (status 'montagem'), com um dono provisório (perfil técnico
--   user_montagem…) e sem WhatsApp. Só a equipe vê e mexe nela (como ajudante).
-- * Os produtos ficam como rascunho "pronto" (pronto_em); nada vai ao ar na montagem.
-- * O dono recebe um convite (link para o WhatsApp dele, vale 7 dias). Ao aceitar:
--   a loja passa a ser dele, ganha o WhatsApp confirmado dele, o teste grátis começa
--   agora e a equipe só continua como ajudante se ele marcar.
-- * Depois do aceite, o servidor copia as fotos para a pasta do dono (fotos_mudanca_loja
--   e trocar_pasta_loja, só com a chave do servidor) e publica os produtos prontos
--   (publicar_prontos_loja, como o dono).
-- * Quem já vende no site não recebe loja montada (decisão de 12/11/2026).

-- 1) Colunas
alter table public.vitrines_lojas
  add column if not exists pasta_montagem text check (pasta_montagem ~ '^user_montagem[0-9a-f]{32}$');
comment on column public.vitrines_lojas.pasta_montagem is
  'P5c: pasta das fotos do dono provisório. Some quando as fotos já estão na pasta do dono.';
alter table public.anuncios add column if not exists pronto_em timestamptz;
comment on column public.anuncios.pronto_em is
  'P5c: rascunho pronto numa loja em montagem; vai ao ar quando o dono aceita a loja.';
-- As tabelas liberam leitura por coluna: o dono e a equipe precisam ver estas duas.
grant select (pasta_montagem) on public.vitrines_lojas to authenticated;
grant select (pronto_em) on public.anuncios to authenticated;

-- 2) Convite de posse (um pendente por loja; o token só existe no link)
create table if not exists public.convites_dono_loja (
  id             uuid primary key default gen_random_uuid(),
  vitrine_id     uuid not null references public.vitrines_lojas(id) on delete cascade,
  token_hash     bytea not null unique,
  telefone_hash  bytea not null,
  final_telefone text not null,
  criado_por     text references public.perfis(id) on delete set null,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null default (now() + interval '7 days'),
  aceito_por     text references public.perfis(id) on delete set null,
  aceito_em      timestamptz,
  revogado_em    timestamptz
);
alter table public.convites_dono_loja enable row level security;
revoke all on public.convites_dono_loja from public, anon, authenticated;
create index if not exists convites_dono_vitrine_idx on public.convites_dono_loja(vitrine_id);

-- 3) Proteções da montagem
-- 3a) Só as funções do sistema criam loja em montagem ou mexem na pasta provisória.
--     Durante a montagem o dono não muda e a loja fica sem WhatsApp; ela só sai da
--     montagem para 'ativa' com o dono novo (convite aceito) ou para 'suspensa' (encerrar).
create or replace function public.proteger_montagem_loja()
returns trigger language plpgsql
set search_path = public
as $$
declare
  sistema boolean := current_user in ('postgres', 'supabase_admin', 'service_role')
                     or coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not sistema and (new.pasta_montagem is not null or new.status = 'montagem') then
      raise exception 'Só a equipe monta loja para transferir.' using errcode = '42501';
    end if;
    return new;
  end if;
  if not sistema and (new.pasta_montagem is distinct from old.pasta_montagem
                      or (new.status = 'montagem') is distinct from (old.status = 'montagem')) then
    raise exception 'A montagem da loja só muda pelo convite do dono.' using errcode = '42501';
  end if;
  if old.status = 'montagem' then
    if new.status = 'montagem' and new.dono_id is distinct from old.dono_id then
      raise exception 'Loja em montagem: o dono recebe a loja pelo convite.' using errcode = '23514';
    end if;
    if new.status = 'montagem' and new.whatsapp is not null then
      raise exception using errcode = '23514', detail = 'campo:whatsapp',
        message = 'Na montagem a loja fica sem WhatsApp. Ela recebe o WhatsApp do dono quando ele aceitar.';
    end if;
    if new.status = 'ativa' and new.dono_id is not distinct from old.dono_id then
      raise exception 'A loja em montagem só vai ao ar quando o dono aceitar o convite.' using errcode = '23514';
    end if;
    if new.status not in ('montagem', 'ativa', 'suspensa') then
      raise exception 'A loja em montagem só vai ao ar quando o dono aceitar o convite.' using errcode = '23514';
    end if;
  end if;
  -- Loja do dono provisório nunca fica no ar: reativar (painel) devolve para a montagem.
  if new.dono_id like 'user\_montagem%' and new.status not in ('montagem', 'suspensa') then
    if sistema and old.status = 'suspensa' and new.status = 'ativa' then
      new.status := 'montagem';
    else
      raise exception 'A loja em montagem só vai ao ar quando o dono aceitar o convite.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists vitrines_0_proteger_montagem on public.vitrines_lojas;
create trigger vitrines_0_proteger_montagem before insert or update on public.vitrines_lojas
  for each row execute function public.proteger_montagem_loja();

-- 3b) Produto de loja em montagem não vai ao ar (só rascunho ou lixeira), para ninguém.
create or replace function public.anuncio_loja_montagem()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.status::text not in ('rascunho', 'excluido')
     and exists (select 1 from public.vitrines_lojas v where v.id = new.vitrine_id and v.status = 'montagem') then
    raise exception 'A loja ainda está em montagem. O produto vai ao ar quando o dono aceitar a loja.'
      using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists anuncios_0_loja_montagem on public.anuncios;
create trigger anuncios_0_loja_montagem before insert or update of status, vitrine_id on public.anuncios
  for each row execute function public.anuncio_loja_montagem();

-- 3c) No painel, a loja em montagem aparece como "montagem" (e não "em teste").
create or replace function public.situacao_vitrine(v public.vitrines_lojas)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  if v.excluida_em is not null then return 'excluida'; end if;
  if v.arquivada_em is not null then return 'arquivada'; end if;
  if v.status = 'montagem' then return 'montagem'; end if;
  v := public.vitrine_com_proximo(v);
  if v.status = 'suspensa' then return 'suspensa'; end if;
  if v.status = 'inadimplente' then return 'inadimplente'; end if;
  select * into p from public.planos where codigo = v.plano;
  if p.e_teste then return case when v.teste_expira_em > now() then 'teste' else 'teste_vencido' end; end if;
  if p.preco_centavos > 0 then return case when v.plano_expira_em > now() then 'ativa' else 'vencida' end; end if;
  return 'gratis';
end $$;

-- 4) O super admin cuida das lojas em montagem como ajudante (seletor, anúncios, Minha loja).
create or replace function public.lojas_que_ajudo()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct x.id), '{}'::uuid[]) from (
    select c.vitrine_id as id
      from public.convites_gerente_loja c
      join public.vitrines_lojas v on v.id = c.vitrine_id
      join public.perfis p on p.id = c.aceito_por
     where public.usuario_id() is not null
       and c.aceito_por = public.usuario_id() and c.revogado_em is null
       and v.tipo = 'loja' and v.status = 'ativa' and v.dono_id <> c.aceito_por
       and p.whatsapp is not null and p.whatsapp_verificado_em is not null
    union all
    -- P5c: loja em montagem (até o dono aceitar).
    select v.id from public.vitrines_lojas v
     where v.status = 'montagem' and public.e_super_admin()
  ) x
$$;

create or replace function public.minhas_lojas()
returns table(id uuid, nome text, dono boolean)
language sql stable security definer set search_path = '' as $$
  select v.id, v.nome, true as dono
    from public.vitrines_lojas v
   where v.tipo = 'loja' and v.dono_id = public.usuario_id()
   union all
  select v.id, v.nome, false as dono
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
   where c.aceito_por = public.usuario_id() and c.revogado_em is null
     and v.tipo = 'loja' and v.status = 'ativa' and v.dono_id <> public.usuario_id()
   union all
  -- P5c: lojas em montagem aparecem para o super admin com a marca "(em montagem)".
  select v.id, v.nome || ' (em montagem)', false as dono
    from public.vitrines_lojas v
   where v.status = 'montagem' and public.e_super_admin()
   order by dono desc, nome
$$;

-- 5) Publicar na montagem deixa o produto "pronto" (vai ao ar no aceite do dono).
create or replace function public.publicar_anuncio(anuncio_id uuid)
returns text language plpgsql security definer
set search_path = public
as $$
declare
  a      public.anuncios;
  dono   text;
  minimo integer;
  novo   public.status_anuncio;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para publicar.' using errcode = '28000';
  end if;
  select * into a from public.anuncios x where x.id = publicar_anuncio.anuncio_id for update;
  select v.dono_id into dono from public.vitrines_lojas v where v.id = a.vitrine_id;
  if a.id is null or not public.pode_mexer_vitrine(a.vitrine_id) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status in ('ativo', 'em_analise') then
    return a.status::text;                     -- já publicado (chamada repetida)
  end if;
  if a.status not in ('rascunho', 'pausado', 'expirado') then
    raise exception 'Este anúncio não pode ser publicado.' using errcode = '42501';
  end if;
  if a.categoria_id is null then
    raise exception using errcode = '23514', message = 'Escolha a categoria do anúncio.', detail = 'campo:categoria';
  end if;
  minimo := coalesce((public.config('anuncio.fotos_minimo', a.microrregiao_id, '1') #>> '{}')::int, 0);
  if cardinality(a.fotos) < minimo then
    raise exception using errcode = '23514',
      message = case when minimo = 1 then 'Coloque pelo menos 1 foto no anúncio.'
                     else format('Coloque pelo menos %s fotos no anúncio.', minimo) end,
      detail = 'campo:fotos';
  end if;
  -- P5c: loja em montagem: o produto fica pronto e vai ao ar quando o dono aceitar a loja.
  if exists (select 1 from public.vitrines_lojas v where v.id = a.vitrine_id and v.status = 'montagem') then
    update public.anuncios x set pronto_em = coalesce(x.pronto_em, now()) where x.id = a.id;
    return 'pronto';
  end if;
  -- os gatilhos conferem limite do plano, campos obrigatórios e moderação
  update public.anuncios x set status = 'ativo' where x.id = a.id returning x.status into novo;
  return novo::text;
end $$;

-- 6) Super admin: montar a loja, convidar o dono, ver e cancelar o convite.
create or replace function public.super_montar_loja(p_nome text, p_slug text, p_regiao uuid, p_cidade text)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  uid         text := public.usuario_id();
  v_nome      text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_slug      text := lower(btrim(coalesce(p_slug, '')));
  v_cidade    text := btrim(coalesce(p_cidade, ''));
  pasta       text := 'user_montagem' || replace(gen_random_uuid()::text, '-', '');
  dias        integer;
  plano_teste text;
  restricao   text;
  nova        uuid;
begin
  if not public.e_super_admin() then
    raise exception 'Só o super admin monta loja para transferir.' using errcode = '42501';
  end if;
  if char_length(v_nome) not between 2 and 80 or public.normalizar_nome_loja(v_nome) = '' then
    raise exception using errcode = '23514', message = 'Escreva o nome da loja (de 2 a 80 letras).', detail = 'campo:nome';
  end if;
  if v_slug !~ '^[a-z0-9-]{3,60}$' then
    raise exception using errcode = '23514', detail = 'campo:slug',
      message = 'O endereço da loja deve ter de 3 a 60 letras minúsculas, números ou hífen, sem espaço nem acento.';
  end if;
  if p_regiao is null or not exists (select 1 from public.cidades c where c.microrregiao_id = p_regiao and c.nome = v_cidade and c.ativa) then
    raise exception using errcode = '23514', message = 'Escolha uma cidade ativa da região.', detail = 'campo:cidade';
  end if;
  dias := coalesce((public.config('teste.dias', p_regiao, '30') #>> '{}')::int, 30);
  plano_teste := coalesce(public.config('loja.plano_teste', p_regiao, '"teste"') #>> '{}', 'teste');

  -- Dono provisório: perfil técnico, sem WhatsApp e sem login.
  insert into public.perfis (id, microrregiao_id, nome, cidade)
  values (pasta, p_regiao, left('Loja em montagem: ' || v_nome, 120), v_cidade);
  begin
    insert into public.vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, status,
                                       teste_expira_em, pasta_montagem)
    values (pasta, p_regiao, v_slug, v_nome, v_cidade, 'loja', plano_teste, 'montagem',
            now() + make_interval(days => dias), pasta)
    returning id into nova;
  exception when unique_violation then
    get stacked diagnostics restricao = constraint_name;
    if restricao = 'vitrines_nome_loja_unico' then
      raise exception using errcode = '23505', constraint = restricao, detail = 'campo:nome',
        message = 'Já existe uma loja com este nome. Use um nome que identifique a loja.';
    elsif restricao in ('vitrines_slug_unico', 'vitrines_lojas_microrregiao_id_slug_key') then
      raise exception using errcode = '23505', constraint = restricao, detail = 'campo:slug',
        message = 'Este endereço de loja já está em uso. Escolha outro.';
    end if;
    raise;
  end;
  perform public.registrar_historico(nova, null, 'criou');
  insert into public.admin_gestao_eventos (tipo, alvo, autor, acao, motivo, detalhes)
  values ('loja', nova::text, uid, 'montar', 'Loja montada pela equipe para transferir ao dono',
          jsonb_build_object('nome', v_nome, 'slug', v_slug, 'cidade', v_cidade));
  return nova;
end $$;

create or replace function public.super_convidar_dono(p_loja uuid, p_whatsapp text)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  token uuid := gen_random_uuid();
  fone  text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
begin
  if not public.e_super_admin() then
    raise exception 'Só o super admin convida o dono da loja.' using errcode = '42501';
  end if;
  if fone ~ '^[1-9][0-9]9[0-9]{8}$' then fone := '55' || fone; end if;
  if fone !~ '^55[1-9][0-9]9[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'Informe o celular do dono com DDD.', detail = 'campo:whatsapp';
  end if;
  perform 1 from public.vitrines_lojas v where v.id = p_loja and v.status = 'montagem' for update;
  if not found then
    raise exception 'Esta loja não está em montagem.' using errcode = '22023';
  end if;
  -- Um convite pendente por loja: o novo cancela o anterior.
  update public.convites_dono_loja set revogado_em = now()
   where vitrine_id = p_loja and aceito_por is null and revogado_em is null;
  insert into public.convites_dono_loja (vitrine_id, token_hash, telefone_hash, final_telefone, criado_por)
  values (p_loja, sha256(convert_to(token::text, 'UTF8')), sha256(convert_to(token::text || ':' || fone, 'UTF8')),
          right(fone, 4), public.usuario_id());
  return token;
end $$;

create or replace function public.super_convite_dono_pendente(p_loja uuid)
returns table (final_telefone text, criado_em timestamptz, expira_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select c.final_telefone, c.criado_em, c.expira_em
    from public.convites_dono_loja c
   where public.e_super_admin() and c.vitrine_id = p_loja
     and c.aceito_por is null and c.revogado_em is null and c.expira_em > now()
   order by c.criado_em desc limit 1
$$;

create or replace function public.super_cancelar_convite_dono(p_loja uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if not public.e_super_admin() then
    raise exception 'Só o super admin cancela o convite.' using errcode = '42501';
  end if;
  update public.convites_dono_loja set revogado_em = now()
   where vitrine_id = p_loja and aceito_por is null and revogado_em is null;
end $$;

-- 7) O dono abre e aceita o convite.
--    Sem linha = convite inválido, vencido, cancelado ou de outro WhatsApp.
create or replace function public.convite_dono_loja(p_token uuid, p_aceitar boolean default false,
                                                    p_manter_equipe boolean default false)
returns table (loja_id uuid, nome text, cidade text, prontos integer, ja_vende boolean, aceito boolean)
language plpgsql security definer
set search_path = public
as $$
declare
  uid         text := public.usuario_id();
  fone        text;
  convite     public.convites_dono_loja;
  loja        public.vitrines_lojas;
  vende       boolean;
  dias        integer;
  plano_teste text;
  final_eq    text;
begin
  select p.whatsapp into fone from public.perfis p where p.id = uid and p.whatsapp_verificado_em is not null;
  if fone is null or exists (select 1 from public.termos_pendentes()) then return; end if;

  select c.* into convite from public.convites_dono_loja c
   where c.token_hash = sha256(convert_to(p_token::text, 'UTF8')) and c.revogado_em is null
   for update;
  if not found then return; end if;
  if convite.aceito_por is not null then
    -- Aceite repetido (ex.: duplo clique): devolve a loja só para quem aceitou.
    if convite.aceito_por <> uid then return; end if;
    return query select v.id, v.nome, v.cidade, 0, false, true
                   from public.vitrines_lojas v where v.id = convite.vitrine_id and v.dono_id = uid;
    return;
  end if;
  if convite.expira_em <= now()
     or convite.telefone_hash <> sha256(convert_to(p_token::text || ':' || fone, 'UTF8')) then
    return;
  end if;
  select v.* into loja from public.vitrines_lojas v
   where v.id = convite.vitrine_id and v.status = 'montagem' and v.arquivada_em is null
   for update;
  if not found then return; end if;
  vende := exists (select 1 from public.vitrines_lojas x where x.dono_id = uid);

  if not p_aceitar then
    return query select loja.id, loja.nome, loja.cidade,
      (select count(*)::int from public.anuncios a
        where a.vitrine_id = loja.id and a.status = 'rascunho' and a.pronto_em is not null),
      vende, false;
    return;
  end if;

  if vende then
    raise exception 'Você já vende no Mercado da Região. Fale com a equipe para receber esta loja.'
      using errcode = '23514';
  end if;
  dias := coalesce((public.config('teste.dias', loja.microrregiao_id, '30') #>> '{}')::int, 30);
  plano_teste := coalesce(public.config('loja.plano_teste', loja.microrregiao_id, '"teste"') #>> '{}', 'teste');

  -- A loja passa a ser do dono: WhatsApp confirmado dele, teste grátis começa agora.
  update public.vitrines_lojas
     set dono_id = uid, whatsapp = fone, status = 'ativa', plano = plano_teste,
         teste_expira_em = now() + make_interval(days => dias), plano_expira_em = null
   where id = loja.id;
  update public.convites_dono_loja set aceito_por = uid, aceito_em = now() where id = convite.id;
  update public.convites_dono_loja set revogado_em = now()
   where vitrine_id = loja.id and id <> convite.id and aceito_por is null and revogado_em is null;

  -- A equipe continua como ajudante só se o dono marcou.
  if p_manter_equipe and convite.criado_por is not null and convite.criado_por <> uid then
    select coalesce(right(p.whatsapp, 4), '0000') into final_eq from public.perfis p where p.id = convite.criado_por;
    begin
      insert into public.convites_gerente_loja (vitrine_id, token_hash, telefone_hash, final_telefone, aceito_por, aceito_em)
      values (loja.id, sha256(convert_to(gen_random_uuid()::text, 'UTF8')),
              sha256(convert_to(gen_random_uuid()::text, 'UTF8')), coalesce(final_eq, '0000'), convite.criado_por, now());
    exception when unique_violation then null;
    end;
  end if;

  -- O dono provisório não serve mais (a pasta das fotos fica anotada em pasta_montagem).
  begin
    delete from public.perfis where id = loja.dono_id and id like 'user\_montagem%';
  exception when others then null;
  end;

  perform public.notificar(convite.criado_por, 'loja_recebida', 'Loja recebida pelo dono',
    format('O dono aceitou a loja %s.', loja.nome), '/admin/lojas/' || loja.id, 'loja_recebida:' || loja.id);

  return query select loja.id, loja.nome, loja.cidade,
    (select count(*)::int from public.anuncios a
      where a.vitrine_id = loja.id and a.status = 'rascunho' and a.pronto_em is not null),
    false, true;
end $$;

-- 8) Depois do aceite (servidor, com a chave secreta): fotos para a pasta do dono.
create or replace function public.fotos_mudanca_loja(p_vitrine uuid)
returns table (de text, para text, caminhos text[])
language sql stable security definer
set search_path = public
as $$
  select v.pasta_montagem, v.dono_id,
         array(select distinct s.c from (
                 select substring(f.u from '/storage/v1/object/public/anuncios/(' || v.pasta_montagem || '/[A-Za-z0-9._/-]+)$') as c
                   from (select unnest(a.fotos) as u from public.anuncios a where a.vitrine_id = v.id
                         union all select v.logo_url union all select v.capa_url union all select v.banner_url) f) s
                where s.c is not null and s.c not like '%..%' order by s.c)
    from public.vitrines_lojas v
   where v.id = p_vitrine and v.pasta_montagem is not null and v.status <> 'montagem'
     and v.dono_id <> v.pasta_montagem
$$;

create or replace function public.trocar_pasta_loja(p_vitrine uuid)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  v    public.vitrines_lojas;
  de   text;
  para text;
begin
  select * into v from public.vitrines_lojas x
   where x.id = p_vitrine and x.pasta_montagem is not null and x.status <> 'montagem'
     and x.dono_id <> x.pasta_montagem
   for update;
  if not found then return false; end if;
  de := '/storage/v1/object/public/anuncios/' || v.pasta_montagem || '/';
  para := '/storage/v1/object/public/anuncios/' || v.dono_id || '/';
  update public.anuncios a
     set fotos = array(select replace(f, de, para) from unnest(a.fotos) with ordinality as t(f, i) order by i)
   where a.vitrine_id = v.id and exists (select 1 from unnest(a.fotos) f where position(de in f) > 0);
  update public.vitrines_lojas
     set logo_url = replace(logo_url, de, para), capa_url = replace(capa_url, de, para),
         banner_url = replace(banner_url, de, para), pasta_montagem = null
   where id = v.id;
  return true;
end $$;

-- 9) O dono publica os produtos prontos (depois que as fotos mudaram de pasta).
--    O que falhar (foto, categoria, limite do plano) fica como rascunho.
create or replace function public.publicar_prontos_loja(p_vitrine uuid)
returns table (publicados integer, em_analise integer, rascunhos integer)
language plpgsql security definer
set search_path = public
as $$
declare
  a   record;
  r   text;
  pub integer := 0;
  ana integer := 0;
  ras integer := 0;
begin
  if not exists (select 1 from public.vitrines_lojas v
                  where v.id = p_vitrine and v.dono_id = public.usuario_id()
                    and v.status = 'ativa' and v.pasta_montagem is null) then
    return;
  end if;
  for a in select x.id from public.anuncios x
            where x.vitrine_id = p_vitrine and x.status = 'rascunho' and x.pronto_em is not null
            order by x.pronto_em, x.id loop
    begin
      r := public.publicar_anuncio(a.id);
      if r = 'ativo' then pub := pub + 1;
      elsif r = 'em_analise' then ana := ana + 1;
      else ras := ras + 1;
      end if;
    exception when others then
      ras := ras + 1;
    end;
  end loop;
  update public.anuncios set pronto_em = null where vitrine_id = p_vitrine and pronto_em is not null;
  return query select pub, ana, ras;
end $$;

-- 10) Permissões
revoke all on function public.proteger_montagem_loja(), public.anuncio_loja_montagem() from public, anon, authenticated;
revoke all on function public.super_montar_loja(text, text, uuid, text), public.super_convidar_dono(uuid, text),
  public.super_convite_dono_pendente(uuid), public.super_cancelar_convite_dono(uuid),
  public.convite_dono_loja(uuid, boolean, boolean), public.publicar_prontos_loja(uuid),
  public.fotos_mudanca_loja(uuid), public.trocar_pasta_loja(uuid) from public, anon;
revoke all on function public.fotos_mudanca_loja(uuid), public.trocar_pasta_loja(uuid) from authenticated;
grant execute on function public.super_montar_loja(text, text, uuid, text), public.super_convidar_dono(uuid, text),
  public.super_convite_dono_pendente(uuid), public.super_cancelar_convite_dono(uuid),
  public.convite_dono_loja(uuid, boolean, boolean), public.publicar_prontos_loja(uuid) to authenticated;
grant execute on function public.fotos_mudanca_loja(uuid), public.trocar_pasta_loja(uuid) to service_role;
