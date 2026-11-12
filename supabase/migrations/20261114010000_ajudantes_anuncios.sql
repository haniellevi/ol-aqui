-- Etapa P5b-1: o ajudante da loja (gerente com convite aceito) cuida dos anúncios
-- como o dono: cria, edita, troca fotos, publica, pausa, marca vendido e manda
-- para a lixeira. Nome e WhatsApp da loja, plano, pagamento e Destacar seguem
-- só do dono. Toda mudança do ajudante entra no histórico (papel 'ajudante').
--
-- Regra do ajudante (igual às RPCs de gerente que já existem): convite aceito
-- e não revogado, WhatsApp do ajudante confirmado e loja ativa.

create or replace function public.lojas_que_ajudo()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(c.vitrine_id), '{}'::uuid[])
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
    join public.perfis p on p.id = c.aceito_por
   where public.usuario_id() is not null
     and c.aceito_por = public.usuario_id() and c.revogado_em is null
     and v.tipo = 'loja' and v.status = 'ativa' and v.dono_id <> c.aceito_por
     and p.whatsapp is not null and p.whatsapp_verificado_em is not null
$$;

-- Dono da loja ou ajudante dela. Usada pelas RPCs de anúncio.
create or replace function public.pode_mexer_vitrine(p_vitrine uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.usuario_id() is not null and p_vitrine is not null and (
    exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id())
    or p_vitrine = any(public.lojas_que_ajudo()))
$$;

revoke all on function public.lojas_que_ajudo(), public.pode_mexer_vitrine(uuid) from public;
grant execute on function public.lojas_que_ajudo(), public.pode_mexer_vitrine(uuid) to anon, authenticated, service_role;

-- Políticas dos anúncios: o "(select ...)" faz a lista de lojas ser lida uma vez por consulta.
drop policy if exists "anuncios leitura publica" on public.anuncios;
create policy "anuncios leitura publica" on public.anuncios
  for select using (
    status in ('ativo', 'vendido')
    or exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id())
    or vitrine_id = any((select public.lojas_que_ajudo())::uuid[])
    or public.e_admin());
drop policy if exists "anuncio proprio criar" on public.anuncios;
create policy "anuncio proprio criar" on public.anuncios
  for insert with check (
    (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id())
     or vitrine_id = any((select public.lojas_que_ajudo())::uuid[]))
    and status <> 'congelado');
drop policy if exists "anuncio proprio editar" on public.anuncios;
create policy "anuncio proprio editar" on public.anuncios
  for update using (
    exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id())
    or vitrine_id = any((select public.lojas_que_ajudo())::uuid[]))
  with check (
    exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id())
    or vitrine_id = any((select public.lojas_que_ajudo())::uuid[]));

-- Plano que vale agora para uma loja que eu cuido (dono ou ajudante). Mesmas colunas de meu_plano().
create or replace function public.plano_da_loja(p_vitrine uuid)
returns table (codigo text, nome text, descricao text, publico text, preco_centavos integer,
               periodo_dias integer, limite_anuncios integer, acesso_radar boolean,
               propostas_radar_mes integer, e_teste boolean, ordem integer)
language sql stable security definer set search_path = public
as $$
  select p.codigo, p.nome, p.descricao, p.publico::text, p.preco_centavos, p.periodo_dias, p.limite_anuncios,
         p.acesso_radar, p.propostas_radar_mes, p.e_teste, p.ordem
    from public.vitrines_lojas v
    cross join lateral public.plano_efetivo(v) p
   where v.id = p_vitrine and public.pode_mexer_vitrine(v.id) and p.codigo is not null
$$;
revoke all on function public.plano_da_loja(uuid) from public, anon;
grant execute on function public.plano_da_loja(uuid) to authenticated, service_role;

-- Equipe da loja: marca quem é da Equipe Mercado da Região.
drop function if exists public.equipe_minha_loja(uuid);
create function public.equipe_minha_loja(p_loja uuid)
returns table(id uuid, final_telefone text, expira_em timestamptz, gerente text, e_equipe boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.final_telefone, c.expira_em, p.nome,
         p.id is not null and (public.e_admin(p.id)
           or exists (select 1 from public.equipe e where e.usuario_id = p.id and e.ativo))
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
    left join public.perfis p on p.id = c.aceito_por
   where v.id = p_loja and v.dono_id = public.usuario_id() and v.tipo = 'loja'
     and c.revogado_em is null and (c.aceito_por is not null or c.expira_em > now())
   order by c.expira_em desc
$$;
revoke all on function public.equipe_minha_loja(uuid) from public, anon;
grant execute on function public.equipe_minha_loja(uuid) to authenticated;

-- Pasta de foto de um anúncio que eu cuido: <dono>/<anuncio>/arquivo.
create or replace function public.pasta_foto_que_cuido(nome text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare partes text[] := string_to_array(coalesce(nome, ''), '/');
begin
  if cardinality(partes) <> 3 or partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
                  where a.id = partes[2]::uuid and v.dono_id = partes[1] and public.pode_mexer_vitrine(v.id));
end $$;
revoke all on function public.pasta_foto_que_cuido(text) from public, anon;
grant execute on function public.pasta_foto_que_cuido(text) to authenticated, service_role;

-- As RPCs abaixo são as versões atuais com "só o dono" trocado por "dono ou ajudante".

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
  -- os gatilhos conferem limite do plano, campos obrigatórios e moderação
  update public.anuncios x set status = 'ativo' where x.id = a.id returning x.status into novo;
  return novo::text;
end $$;

create or replace function public.marcar_vendido(anuncio_id uuid, pelo_olaki boolean default null)
returns text language plpgsql security definer
set search_path = public
as $$
declare
  a    public.anuncios;
  dono text;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  select * into a from public.anuncios x where x.id = marcar_vendido.anuncio_id for update;
  select v.dono_id into dono from public.vitrines_lojas v where v.id = a.vitrine_id;
  if a.id is null or not public.pode_mexer_vitrine(a.vitrine_id) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status not in ('ativo', 'vendido') then
    raise exception 'Só um anúncio que está no ar pode ser marcado como vendido.' using errcode = '42501';
  end if;
  update public.anuncios x
     set status = 'vendido',
         vendido_pelo_olaki = coalesce(marcar_vendido.pelo_olaki, x.vendido_pelo_olaki),
         vendido_em = coalesce(x.vendido_em, now())
   where x.id = a.id;
  return 'vendido';
end $$;

create or replace function public.mover_anuncio_lixeira(p_anuncio_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare a public.anuncios; anterior text := current_setting('olaki.lixeira', true);
begin
  if public.usuario_id() is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into a from public.anuncios where id = p_anuncio_id for update;
  if a.id is null or not public.pode_mexer_vitrine(a.vitrine_id) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status = 'excluido' then return 'excluido'; end if;
  perform set_config('olaki.lixeira', '1', true);
  update public.anuncios set status = 'excluido', excluido_em = now(), status_antes_exclusao = a.status where id = a.id;
  perform set_config('olaki.lixeira', coalesce(anterior, ''), true);
  return 'excluido';
end $$;

create or replace function public.restaurar_anuncio(p_anuncio_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  a public.anuncios;
  destino public.status_anuncio;
  anterior text := current_setting('olaki.lixeira', true);
  sistema_anterior text := current_setting('olaki.sistema', true);
  maximo integer;
begin
  if public.usuario_id() is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into a from public.anuncios where id = p_anuncio_id for update;
  if a.id is null or not public.pode_mexer_vitrine(a.vitrine_id) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status <> 'excluido' then return a.status::text; end if;
  destino := case when a.status_antes_exclusao in ('rascunho', 'vendido', 'em_analise', 'congelado')
    then a.status_antes_exclusao else 'pausado'::public.status_anuncio end;
  if destino = 'rascunho' then
    perform 1 from public.vitrines_lojas where id = a.vitrine_id for update;
    maximo := public.numero_ou_nulo(public.config('anuncio.rascunhos_max', a.microrregiao_id, 'null'))::int;
    if maximo is not null and (select count(*) from public.anuncios where vitrine_id = a.vitrine_id and status = 'rascunho') >= maximo then
      raise exception 'Você atingiu o limite de rascunhos. Conclua um anúncio antes de restaurar este.' using errcode = 'P0001';
    end if;
  end if;
  perform set_config('olaki.lixeira', '1', true);
  -- Preserva venda/moderação anterior mesmo que a categoria tenha sido desativada.
  -- O destino nunca é ativo; voltar à venda exige publicar_anuncio e suas validações.
  perform set_config('olaki.sistema', '1', true);
  update public.anuncios set status = destino, excluido_em = null, status_antes_exclusao = null where id = a.id;
  perform set_config('olaki.sistema', coalesce(sistema_anterior, ''), true);
  perform set_config('olaki.lixeira', coalesce(anterior, ''), true);
  return destino::text;
end $$;

create or replace function public.sugerir_categoria(p_anuncio uuid, p_texto text)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  a public.anuncios;
  eu text := public.usuario_id();
  v_texto text := left(regexp_replace(btrim(coalesce(p_texto, '')), '\s+', ' ', 'g'), 60);
  v_norm text := public.normalizar_sugestao_categoria(p_texto);
  sid uuid;
begin
  if eu is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para sugerir uma categoria.';
  end if;
  select x.* into a from public.anuncios x
    join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and public.pode_mexer_vitrine(v.id) and x.status <> 'excluido'
   for update of x;
  if not found then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if char_length(v_texto) < 2 or char_length(v_norm) < 2 then
    raise exception using errcode = '22023', message = 'Escreva o nome da categoria com pelo menos 2 letras.';
  end if;
  if a.categoria_id is null then
    raise exception using errcode = '22023', message = 'Escolha primeiro a categoria mais parecida.';
  end if;
  -- Já existe uma categoria com esse nome: não precisa sugerir.
  if exists (select 1 from public.categorias c
              where c.ativa and public.normalizar_sugestao_categoria(c.nome) = v_norm) then
    raise exception using errcode = '22023', message = 'Essa categoria já existe. Procure por ela na lista.';
  end if;
  -- Limite contra abuso: 20 sugestões esperando decisão por pessoa.
  if (select count(*) from public.categorias_sugeridas s
       where s.autor_id = eu and s.estado = 'pendente' and s.anuncio_id is distinct from a.id) >= 20 then
    raise exception using errcode = '22023', message = 'Você já tem 20 sugestões esperando resposta. Aguarde a equipe decidir.';
  end if;

  update public.categorias_sugeridas
     set texto = v_texto, texto_norm = v_norm, categoria_proxima_id = a.categoria_id, criado_em = now()
   where anuncio_id = a.id and estado = 'pendente'
  returning id into sid;
  if sid is null then
    insert into public.categorias_sugeridas (texto, texto_norm, categoria_proxima_id, anuncio_id, autor_id)
    values (v_texto, v_norm, a.categoria_id, a.id, eu)
    returning id into sid;
  end if;
  return sid;
end $$;

create or replace function public.minha_sugestao_categoria(p_anuncio uuid)
returns table (id uuid, texto text, categoria_proxima_id uuid, criado_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select s.id, s.texto, s.categoria_proxima_id, s.criado_em
    from public.categorias_sugeridas s
    join public.anuncios a on a.id = s.anuncio_id
    join public.vitrines_lojas v on v.id = a.vitrine_id
   where s.anuncio_id = p_anuncio and s.estado = 'pendente' and public.pode_mexer_vitrine(v.id)
$$;

create or replace function public.cancelar_sugestao_categoria(p_anuncio uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.categorias_sugeridas s
   using public.anuncios a, public.vitrines_lojas v
   where s.anuncio_id = p_anuncio and s.estado = 'pendente'
     and a.id = s.anuncio_id and v.id = a.vitrine_id and public.pode_mexer_vitrine(v.id);
end $$;

create or replace function public.minhas_sugestoes_categoria(p_vitrine uuid)
returns table (anuncio_id uuid, titulo text, foto text, categoria_atual_id uuid, categoria_atual text,
               sugerida_id uuid, sugerida text, sugerida_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.titulo, a.fotos[1], a.categoria_id, ca.nome, a.categoria_sugerida_id, cs.nome, a.categoria_sugerida_em
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    left join public.categorias ca on ca.id = a.categoria_id
    join public.categorias cs on cs.id = a.categoria_sugerida_id
   where a.vitrine_id = p_vitrine and public.pode_mexer_vitrine(v.id)
     and a.categoria_sugestao_estado = 'pendente' and a.status <> 'excluido'
   order by a.categoria_sugerida_em, a.id
$$;

create or replace function public.ultimas_alteracoes_anuncios(p_ids uuid[])
returns table (anuncio_id uuid, quando timestamptz, acao text, de text, para text, papel text, nome text, e_voce boolean)
language sql stable security definer set search_path = public
as $$
  select distinct on (h.anuncio_id) h.anuncio_id, h.atualizado_em, h.acao, h.de, h.para, h.papel,
         case when h.quem is null then null else split_part(btrim(p.nome), ' ', 1) end,
         h.quem is not null and h.quem = public.usuario_id()
    from public.historico_alteracoes h
    join public.vitrines_lojas v on v.id = h.vitrine_id and public.pode_mexer_vitrine(v.id)
    left join public.perfis p on p.id = h.quem
   where public.usuario_id() is not null and cardinality(p_ids) <= 500 and h.anuncio_id = any(p_ids)
   order by h.anuncio_id, h.atualizado_em desc, h.id desc
$$;

create or replace function public.historico_alteracoes_ver(
  p_anuncio uuid default null, p_vitrine uuid default null, p_limite integer default 50)
returns table (quando timestamptz, acao text, de text, para text, motivo text, papel text, nome text, e_voce boolean)
language plpgsql stable security definer set search_path = public
as $$
declare loja uuid;
begin
  if public.usuario_id() is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  if (p_anuncio is null) = (p_vitrine is null) then
    raise exception 'Escolha um anúncio ou uma loja.' using errcode = '22023';
  end if;
  loja := coalesce(p_vitrine, (select vitrine_id from public.anuncios where id = p_anuncio));
  if loja is null or not (public.e_admin()
      or public.pode_mexer_vitrine(loja)) then
    raise exception 'Histórico não encontrado.' using errcode = '42501';
  end if;
  return query
    select h.atualizado_em, h.acao, h.de, h.para, h.motivo, h.papel,
           case when h.quem is null then null else split_part(btrim(p.nome), ' ', 1) end,
           h.quem is not null and h.quem = public.usuario_id()
      from public.historico_alteracoes h left join public.perfis p on p.id = h.quem
     where h.vitrine_id = loja
       and (case when p_anuncio is null then h.anuncio_id is null else h.anuncio_id = p_anuncio end)
     order by h.atualizado_em desc, h.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 50);
end $$;

create or replace function public.anuncio_publico(anuncio_id uuid)
returns setof public.anuncio_detalhe
language sql stable security definer
set search_path = public
as $$
  select a.id, a.titulo, a.descricao, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
         a.fotos, a.atributos, a.status::text, coalesce(a.publicado_em, a.criado_em), a.vendido_em,
         coalesce(a.destaque_ate > now(), false), a.visualizacoes, a.total_favoritos, a.microrregiao_id,
         c.id, c.slug, c.nome, c.icone, cp.slug, cp.nome, coalesce(c.campos, '[]'::jsonb),
         v.id, v.slug, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.tipo, v.logo_url, v.selo_loja_verificada, v.criado_em,
         pf.selo_negociador_certificado,
         case when a.status = 'ativo' then public.contato_publico_vitrine(v, pf) end,
         public.pode_mexer_vitrine(v.id), a.slug
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    join public.perfis pf on pf.id = v.dono_id
    left join public.categorias c on c.id = a.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   where a.id = anuncio_publico.anuncio_id
     and ((a.status in ('ativo', 'vendido') and v.status = 'ativa')
          or public.pode_mexer_vitrine(v.id)
          or public.e_admin())
$$;

create or replace function public.pode_enviar_foto(nome text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid    text := public.usuario_id();
  partes text[] := string_to_array(coalesce(pode_enviar_foto.nome, ''), '/');
  regiao uuid;
  vit    public.vitrines_lojas;
  chave_max text := 'fotos.max_por_pasta';
  maximo integer;
  total  integer := 0;
begin
  if uid is null or cardinality(partes) <> 3
     or partes[3] !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    return false;
  end if;
  -- P5b: só a pasta de anúncio aceita a pasta do dono (ajudante); as outras são da própria pessoa.
  if partes[1] <> uid and partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if partes[2] = 'loja' then
    select v.microrregiao_id into regiao from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if not found then return false; end if;
  elsif partes[2] = 'vitrine' then
    select * into vit from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if vit.id is null then return false; end if;
    if not coalesce((select r.foto_fachada from public.recursos_vitrine(vit) r), false) then return false; end if;
    regiao := vit.microrregiao_id;
  elsif partes[2] ~ '^radar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if not public.tem_plano_pago(uid) then return false; end if;
    select p.microrregiao_id into regiao
      from public.radar_pedidos p
      join public.vitrines_lojas v on v.dono_id = uid and v.microrregiao_id = p.microrregiao_id and v.status = 'ativa'
     where p.id = substr(partes[2], 7)::uuid and p.status = 'aberto' and p.expira_em > now()
       and p.comprador_id <> uid
       and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now());
    if not found then return false; end if;
    chave_max := 'radar.fotos_max_pasta';
  elsif partes[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select a.microrregiao_id into regiao from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = partes[2]::uuid and v.dono_id = partes[1] and public.pode_mexer_vitrine(v.id) and a.status not in ('congelado', 'em_analise');
    if not found then return false; end if;
  else
    return false;
  end if;
  maximo := public.numero_ou_nulo(public.config(chave_max, regiao, 'null'))::int;
  if maximo is not null and to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id = $1 and name like $2'
       into total using 'anuncios', partes[1] || '/' || partes[2] || '/%';
    if total >= maximo then return false; end if;
  end if;
  return true;
end $$;

-- Fotos: o ajudante lê, troca e apaga fotos do anúncio na pasta do dono.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "anuncios fotos leitura" on storage.objects';
    execute 'drop policy if exists "anuncios fotos trocar" on storage.objects';
    execute 'drop policy if exists "anuncios fotos apagar" on storage.objects';
    execute $q$create policy "anuncios fotos leitura" on storage.objects
               for select to authenticated
               using (bucket_id = 'anuncios' and ((storage.foldername(name))[1] = public.usuario_id() or public.pasta_foto_que_cuido(name)))$q$;
    execute $q$create policy "anuncios fotos trocar" on storage.objects
               for update to authenticated
               using (bucket_id = 'anuncios' and ((storage.foldername(name))[1] = public.usuario_id() or public.pasta_foto_que_cuido(name)))
               with check (bucket_id = 'anuncios' and ((storage.foldername(name))[1] = public.usuario_id() or public.pasta_foto_que_cuido(name)))$q$;
    execute $q$create policy "anuncios fotos apagar" on storage.objects
               for delete to authenticated
               using (bucket_id = 'anuncios' and ((storage.foldername(name))[1] = public.usuario_id() or public.pasta_foto_que_cuido(name)))$q$;
  end if;
end $$;
