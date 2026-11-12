-- Etapa P5a: super admin, histórico de alterações, lixeira e "apagar de vez" pela equipe.
-- Super admin é um nível acima do administrador (perfis.e_admin). Só ele aprova categorias,
-- manda anúncio dos outros para a lixeira e apaga de vez. Ligar e desligar só pelo banco.

-- ---------------------------------------------------------------------
-- 1. Papel super admin
-- ---------------------------------------------------------------------
alter table public.perfis add column e_super_admin boolean not null default false;
alter table public.perfis add constraint perfis_super_admin_e_admin check (not e_super_admin or e_admin);

create or replace function public.e_super_admin(uid text default public.usuario_id())
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce((select e_super_admin from public.perfis where id = uid), false) $$;
revoke all on function public.e_super_admin(text) from public;
grant execute on function public.e_super_admin(text) to anon, authenticated, service_role;

-- Só o banco (SQL Editor, chave secreta) liga ou desliga. Nem um administrador do site consegue.
create or replace function public.proteger_super_admin()
returns trigger language plpgsql set search_path = public
as $$
declare banco boolean := coalesce(auth.role(), '') = 'service_role'
  or current_user in ('postgres', 'supabase_admin', 'service_role');
begin
  if tg_op = 'INSERT' then
    if new.e_super_admin and not banco then new.e_super_admin := false; end if;
  elsif new.e_super_admin is distinct from old.e_super_admin and not banco then
    new.e_super_admin := old.e_super_admin;
  end if;
  if tg_op = 'UPDATE' and old.e_super_admin and not new.e_admin and not banco then
    raise exception 'Não é possível tirar o administrador de um super admin.' using errcode = '42501';
  end if;
  if not new.e_admin then new.e_super_admin := false; end if;
  return new;
end $$;
create trigger zz_perfis_super_admin before insert or update on public.perfis
  for each row execute function public.proteger_super_admin();

-- Editar o anúncio de outra pessoa: só o super admin (antes, qualquer administrador).
drop policy "admin edita anuncios" on public.anuncios;
create policy "super admin edita anuncios" on public.anuncios for update
  using (public.e_super_admin()) with check (public.e_super_admin());

-- Registro do painel também guarda ações em anúncios.
alter table public.admin_gestao_eventos drop constraint admin_gestao_eventos_tipo_check;
alter table public.admin_gestao_eventos add constraint admin_gestao_eventos_tipo_check
  check (tipo in ('usuario', 'loja', 'anuncio'));


-- ---------------------------------------------------------------------
-- 2. Lixeira e "apagar de vez" pela equipe (só super admin)
-- ---------------------------------------------------------------------
-- Manda o anúncio de outra pessoa para a lixeira, com motivo. O dono é avisado no sino
-- e pode restaurar em Meus anúncios dentro de 30 dias.
create or replace function public.admin_lixeira_anuncio(p_anuncio uuid, p_motivo text)
returns text language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  a public.anuncios;
  dono text;
  v_motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  lixeira_anterior text := coalesce(current_setting('olaki.lixeira', true), '');
  motivo_anterior text := coalesce(current_setting('olaki.motivo', true), '');
begin
  if not public.e_super_admin() then raise exception 'Só o super admin pode fazer isso.' using errcode = '42501'; end if;
  if char_length(v_motivo) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  select * into a from public.anuncios where id = p_anuncio for update;
  if a.id is null then raise exception 'Anúncio não encontrado.' using errcode = '22023'; end if;
  if a.status = 'excluido' then return 'excluido'; end if;
  select dono_id into dono from public.vitrines_lojas where id = a.vitrine_id;
  perform set_config('olaki.lixeira', '1', true);
  perform set_config('olaki.motivo', v_motivo, true);
  update public.anuncios set status = 'excluido', excluido_em = now(), status_antes_exclusao = a.status where id = a.id;
  perform set_config('olaki.lixeira', lixeira_anterior, true);
  perform set_config('olaki.motivo', motivo_anterior, true);
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values ('anuncio', a.id::text, public.usuario_id(), 'lixeira', v_motivo);
  if dono is not null and dono <> public.usuario_id() then
    perform public.notificar(dono, 'anuncio_lixeira_equipe', 'Seu anúncio foi para a lixeira',
      left(format('A Equipe Mercado da Região mandou %s para a lixeira. Motivo: %s. Você pode restaurar em Meus anúncios em até 30 dias.',
        public.nome_anuncio_aviso(a.titulo, false), v_motivo), 500),
      '/minha-conta/anuncios', 'anuncio_lixeira_equipe:' || a.id::text || ':' || extract(epoch from now())::bigint::text,
      jsonb_build_object('anuncio_id', a.id));
  end if;
  return 'excluido';
end $$;
revoke all on function public.admin_lixeira_anuncio(uuid, text) from public, anon;
grant execute on function public.admin_lixeira_anuncio(uuid, text) to authenticated;

-- "Apagar de vez agora": só super admin, só o que já está na lixeira, com o nome digitado.
-- Anúncio: passa a contar como vencido na lixeira; a limpeza seguinte (rodada na hora pelo painel) apaga.
create or replace function public.admin_antecipar_limpeza(p_tipo text, p_alvo text, p_confirmacao text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  nome text;
  lixeira_anterior text := coalesce(current_setting('olaki.lixeira', true), '');
begin
  if not public.e_super_admin() then raise exception 'Só o super admin pode apagar de vez.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  if p_tipo = 'conta' then
    select p.nome into nome from public.lixeira_contas l join public.perfis p on p.id = l.usuario_id where l.usuario_id = p_alvo for update of l;
  elsif p_tipo = 'loja' and p_alvo ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    select v.nome into nome from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id
     where l.vitrine_id = p_alvo::uuid and l.origem <> 'conta' for update of l;
  elsif p_tipo = 'anuncio' and p_alvo ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    select coalesce(nullif(btrim(a.titulo), ''), 'Anúncio sem título') into nome from public.anuncios a
     where a.id = p_alvo::uuid and a.status = 'excluido' and not a.excluido_com_loja for update;
  else
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  if nome is null then raise exception 'Este item não está na lixeira.' using errcode = '22023'; end if;
  if btrim(coalesce(p_confirmacao, '')) is distinct from btrim(nome) then
    raise exception 'Digite o nome exatamente como aparece para confirmar.' using errcode = '23514';
  end if;
  if p_tipo = 'conta' then
    update public.lixeira_contas set apagar_apos = now() where usuario_id = p_alvo;
  elsif p_tipo = 'loja' then
    update public.lixeira_lojas set apagar_apos = now() where vitrine_id = p_alvo::uuid;
  else
    perform set_config('olaki.lixeira', '1', true);
    update public.anuncios set excluido_em = least(excluido_em, now() - interval '30 days 1 minute') where id = p_alvo::uuid;
    perform set_config('olaki.lixeira', lixeira_anterior, true);
  end if;
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values (case p_tipo when 'conta' then 'usuario' else p_tipo end, p_alvo, public.usuario_id(), 'apagar_definitivo', btrim(p_motivo));
end $$;

-- ---------------------------------------------------------------------
-- 3. Histórico de alterações (o dono vê quem mexeu no anúncio e na loja)
-- ---------------------------------------------------------------------
create table public.historico_alteracoes (
  id           bigint generated always as identity primary key,
  vitrine_id   uuid not null references public.vitrines_lojas(id) on delete cascade,
  anuncio_id   uuid references public.anuncios(id) on delete cascade,   -- nulo = mudança na loja
  quem         text references public.perfis(id) on delete set null,     -- nulo = sistema ou conta apagada
  papel        text not null check (papel in ('dono', 'ajudante', 'equipe', 'sistema')),
  acao         text not null check (acao in ('criou', 'editou', 'status', 'lixeira', 'restaurou')),
  de           text check (char_length(de) <= 20),
  para         text check (char_length(para) <= 20),
  motivo       text check (char_length(motivo) <= 300),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index historico_anuncio_idx on public.historico_alteracoes (anuncio_id, atualizado_em desc) where anuncio_id is not null;
create index historico_loja_idx on public.historico_alteracoes (vitrine_id, atualizado_em desc) where anuncio_id is null;
create index historico_quem_idx on public.historico_alteracoes (quem) where quem is not null;
alter table public.historico_alteracoes enable row level security;
revoke all on public.historico_alteracoes from anon, authenticated;

-- Quem é a pessoa para esta loja.
create or replace function public.papel_historico(p_vitrine uuid, p_quem text)
returns text language sql stable security definer set search_path = public
as $$
  select case
    when p_quem is null then 'sistema'
    when exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = p_quem) then 'dono'
    when public.e_admin(p_quem) or exists (select 1 from public.equipe where usuario_id = p_quem and ativo) then 'equipe'
    when exists (select 1 from public.convites_gerente_loja where vitrine_id = p_vitrine and aceito_por = p_quem and revogado_em is null) then 'ajudante'
    else 'sistema' end
$$;

-- Grava uma linha. Edições seguidas da mesma pessoa em 15 minutos viram uma só.
create or replace function public.registrar_historico(
  p_vitrine uuid, p_anuncio uuid, p_acao text, p_de text default null, p_para text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  eu text := public.usuario_id();
  v_motivo text := nullif(left(btrim(coalesce(current_setting('olaki.motivo', true), '')), 300), '');
  ultimo bigint;
begin
  if eu is not null and not exists (select 1 from public.perfis where id = eu) then eu := null; end if;
  if p_acao = 'editou' then
    select id into ultimo from public.historico_alteracoes
     where vitrine_id = p_vitrine and anuncio_id is not distinct from p_anuncio and acao = 'editou'
       and quem is not distinct from eu and atualizado_em > now() - interval '15 minutes'
     order by id desc limit 1;
    if ultimo is not null then
      update public.historico_alteracoes set atualizado_em = now(), motivo = coalesce(v_motivo, historico_alteracoes.motivo)
       where id = ultimo;
      return;
    end if;
  end if;
  insert into public.historico_alteracoes (vitrine_id, anuncio_id, quem, papel, acao, de, para, motivo)
  values (p_vitrine, p_anuncio, eu, public.papel_historico(p_vitrine, eu), p_acao, p_de, p_para, v_motivo);
end $$;
revoke all on function public.papel_historico(uuid, text), public.registrar_historico(uuid, uuid, text, text, text)
  from public, anon, authenticated;

-- Anúncio: criar (fora do rascunho), mudar de situação, lixeira, restaurar e editar.
-- Rascunho não gera linha. Contadores e campos do sistema não contam como edição.
create or replace function public.historico_anuncio_gatilho()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'rascunho' then perform public.registrar_historico(new.vitrine_id, new.id, 'criou'); end if;
  elsif new.status is distinct from old.status then
    if new.status = 'excluido' then
      perform public.registrar_historico(new.vitrine_id, new.id, 'lixeira');
    elsif old.status = 'excluido' then
      perform public.registrar_historico(new.vitrine_id, new.id, 'restaurou');
    else
      perform public.registrar_historico(new.vitrine_id, new.id, 'status', old.status::text, new.status::text);
    end if;
  elsif old.status not in ('rascunho', 'excluido') and public.usuario_id() is not null then
    perform public.registrar_historico(new.vitrine_id, new.id, 'editou');
  end if;
  return null;
end $$;
revoke all on function public.historico_anuncio_gatilho() from public, anon, authenticated;

create trigger historico_anuncios_criar after insert on public.anuncios
  for each row execute function public.historico_anuncio_gatilho();
create trigger historico_anuncios_alterar after update on public.anuncios
  for each row when (
    old.status is distinct from new.status
    or (to_jsonb(old) - array['visualizacoes', 'cliques_whatsapp', 'total_favoritos', 'busca', 'atualizado_em',
          'criado_ip', 'slug', 'saiu_do_ar_em', 'subido_em', 'destaque_ate', 'pago_ate', 'revisao_manual_admin',
          'categoria_sugerida_em', 'categoria_sugerida_id', 'categoria_sugestao_estado', 'publicado_em', 'vendido_em',
          'vendido_pelo_olaki', 'motivo_analise', 'congelado_motivo', 'fixado_na_loja', 'excluido_com_loja',
          'excluido_em', 'status_antes_exclusao'])
       is distinct from
       (to_jsonb(new) - array['visualizacoes', 'cliques_whatsapp', 'total_favoritos', 'busca', 'atualizado_em',
          'criado_ip', 'slug', 'saiu_do_ar_em', 'subido_em', 'destaque_ate', 'pago_ate', 'revisao_manual_admin',
          'categoria_sugerida_em', 'categoria_sugerida_id', 'categoria_sugestao_estado', 'publicado_em', 'vendido_em',
          'vendido_pelo_olaki', 'motivo_analise', 'congelado_motivo', 'fixado_na_loja', 'excluido_com_loja',
          'excluido_em', 'status_antes_exclusao']))
  execute function public.historico_anuncio_gatilho();

-- Loja: só o que o cliente vê (nome, textos, fotos, contato, endereço) e entrada/saída da lixeira.
create or replace function public.historico_loja_gatilho()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.excluida_em is distinct from old.excluida_em then
    perform public.registrar_historico(new.id, null, case when new.excluida_em is null then 'restaurou' else 'lixeira' end);
  elsif new.status is distinct from old.status then
    perform public.registrar_historico(new.id, null, 'status', old.status::text, new.status::text);
  elsif public.usuario_id() is not null then
    perform public.registrar_historico(new.id, null, 'editou');
  end if;
  return null;
end $$;
revoke all on function public.historico_loja_gatilho() from public, anon, authenticated;

create trigger historico_lojas_alterar after update on public.vitrines_lojas
  for each row when (
    old.excluida_em is distinct from new.excluida_em
    or old.status is distinct from new.status
    or row(old.nome, old.descricao, old.sobre, old.endereco, old.horarios, old.logo_url, old.capa_url, old.banner_url,
           old.banner_tipo, old.whatsapp, old.instagram, old.site_url, old.telefone_publico, old.faz_entrega,
           old.entrega_obs, old.formas_pagamento, old.cidade, old.bairro, old.lat, old.lng)
       is distinct from
       row(new.nome, new.descricao, new.sobre, new.endereco, new.horarios, new.logo_url, new.capa_url, new.banner_url,
           new.banner_tipo, new.whatsapp, new.instagram, new.site_url, new.telefone_publico, new.faz_entrega,
           new.entrega_obs, new.formas_pagamento, new.cidade, new.bairro, new.lat, new.lng))
  execute function public.historico_loja_gatilho();

-- Leitura: o dono da loja e a equipe (administrador). Nome da equipe aparece com o primeiro nome.
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
      or exists (select 1 from public.vitrines_lojas where id = loja and dono_id = public.usuario_id())) then
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

-- Última mudança de cada anúncio da minha loja (linha em Meus anúncios).
create or replace function public.ultimas_alteracoes_anuncios(p_ids uuid[])
returns table (anuncio_id uuid, quando timestamptz, acao text, de text, para text, papel text, nome text, e_voce boolean)
language sql stable security definer set search_path = public
as $$
  select distinct on (h.anuncio_id) h.anuncio_id, h.atualizado_em, h.acao, h.de, h.para, h.papel,
         case when h.quem is null then null else split_part(btrim(p.nome), ' ', 1) end,
         h.quem is not null and h.quem = public.usuario_id()
    from public.historico_alteracoes h
    join public.vitrines_lojas v on v.id = h.vitrine_id and v.dono_id = public.usuario_id()
    left join public.perfis p on p.id = h.quem
   where public.usuario_id() is not null and cardinality(p_ids) <= 500 and h.anuncio_id = any(p_ids)
   order by h.anuncio_id, h.atualizado_em desc, h.id desc
$$;
revoke all on function public.historico_alteracoes_ver(uuid, uuid, integer), public.ultimas_alteracoes_anuncios(uuid[])
  from public, anon;
grant execute on function public.historico_alteracoes_ver(uuid, uuid, integer), public.ultimas_alteracoes_anuncios(uuid[])
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. Aprovar sugestões de categoria: só o super admin (mesma função, outra checagem)
-- ---------------------------------------------------------------------
create or replace function public.decidir_categorias_sugeridas(
  p_grupos text[], p_acao text, p_nome text default null, p_pai uuid default null, p_categoria uuid default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  eu text := public.usuario_id();
  final_id uuid;
  pai public.categorias;
  v_nome text := left(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'), 60);
  base text;
  v_slug text;
  k integer := 2;
  s record;
  movidos integer := 0;
  revisar integer := 0;
  decididas integer := 0;
  caminho text;
  an public.anuncios;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_super_admin() then
    raise exception using errcode = '42501', message = 'Só o super admin pode decidir sugestões de categoria.';
  end if;
  if p_acao not in ('aprovar', 'juntar', 'recusar') then
    raise exception using errcode = '22023', message = 'Escolha aprovar, juntar ou recusar.';
  end if;
  -- Trava o grupo antes de criar qualquer categoria: dois admins não decidem o mesmo grupo.
  perform 1 from public.categorias_sugeridas
    where texto_norm = any(p_grupos) and estado = 'pendente'
    order by id for update;
  if coalesce(array_length(p_grupos, 1), 0) = 0
     or not exists (select 1 from public.categorias_sugeridas
                     where texto_norm = any(p_grupos) and estado = 'pendente') then
    raise exception using errcode = '22023', message = 'Essas sugestões já foram decididas.';
  end if;

  if p_acao = 'aprovar' then
    if char_length(v_nome) < 2 then
      raise exception using errcode = '22023', message = 'Escreva o nome da categoria nova.';
    end if;
    select c.* into pai from public.categorias c where c.id = p_pai;
    if pai.id is null or not coalesce(public.categoria_disponivel(pai.id), false) then
      raise exception using errcode = '22023', message = 'Escolha onde a categoria nova vai ficar.';
    end if;
    if exists (select 1 from public.categorias c where c.pai_id = pai.id
                and public.normalizar_sugestao_categoria(c.nome) = public.normalizar_sugestao_categoria(v_nome)) then
      raise exception using errcode = '22023', message = 'Já existe uma categoria com esse nome nesse lugar. Use "Juntar".';
    end if;
    base := public.slug_texto(v_nome);
    if char_length(base) < 2 then
      raise exception using errcode = '22023', message = 'O nome precisa ter letras ou números.';
    end if;
    v_slug := base;
    if exists (select 1 from public.categorias c where c.slug = base) then
      v_slug := left(public.slug_texto(base || '-' || pai.slug), 60);
    end if;
    while exists (select 1 from public.categorias c where c.slug = v_slug) loop
      v_slug := left(base, 56) || '-' || k;
      k := k + 1;
    end loop;
    -- A trava de categorias confere o limite de 3 níveis.
    insert into public.categorias (slug, nome, pai_id, ordem, ativa, tipo_legado, campos)
    values (v_slug, v_nome, pai.id,
            coalesce((select max(c.ordem) from public.categorias c where c.pai_id = pai.id), 0) + 10,
            true, pai.tipo_legado, '[]'::jsonb)
    returning id into final_id;
  elsif p_acao = 'juntar' then
    if p_categoria is null or not coalesce(public.categoria_disponivel(p_categoria), false)
       or exists (select 1 from public.categorias f where f.pai_id = p_categoria and f.ativa) then
      raise exception using errcode = '22023', message = 'Escolha uma categoria final (sem subcategorias) que esteja no ar.';
    end if;
    final_id := p_categoria;
  end if;

  caminho := public.categoria_nome_caminho(final_id);

  for s in select x.*, v.dono_id
             from public.categorias_sugeridas x
             left join public.anuncios a on a.id = x.anuncio_id
             left join public.vitrines_lojas v on v.id = a.vitrine_id
            where x.texto_norm = any(p_grupos) and x.estado = 'pendente'
            order by x.criado_em
            for update of x loop
    update public.categorias_sugeridas
       set estado = case p_acao when 'aprovar' then 'aprovada' when 'juntar' then 'juntada' else 'recusada' end,
           categoria_final_id = final_id, decidido_por = eu, decidido_em = now()
     where id = s.id;
    decididas := decididas + 1;

    continue when p_acao = 'recusar' or s.anuncio_id is null;
    -- Trava o anúncio e confere de novo: o dono pode ter trocado a categoria nesse meio-tempo.
    select x.* into an from public.anuncios x where x.id = s.anuncio_id for update;
    continue when an.id is null or an.status in ('excluido', 'congelado')
                  or an.categoria_id is distinct from s.categoria_proxima_id;
    begin
      -- Mudança feita pelo sistema, a pedido da equipe: não cobra o WhatsApp de quem decidiu.
      perform set_config('olaki.sistema', '1', true);
      -- Outra sugestão pendente perde o sentido: o anúncio já vai para a categoria pedida pelo dono.
      update public.anuncios
         set categoria_id = final_id,
             categoria_sugerida_id = null, categoria_sugestao_estado = null, categoria_sugerida_em = null
       where id = an.id;
      perform set_config('olaki.sistema', sistema_anterior, true);
      movidos := movidos + 1;
      perform public.notificar(s.dono_id, 'categoria_sugerida',
        case p_acao when 'aprovar' then 'Sua categoria foi aceita' else 'Seu anúncio mudou de categoria' end,
        format('%s agora está em %s.', public.nome_anuncio_aviso(an.titulo, true), caminho),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id));
    exception when sqlstate '23514' or sqlstate '22023' then
      -- A categoria nova pede um campo obrigatório que o anúncio não tem. "Revise suas categorias" só
      -- aceita ou recusa (não pede campos), então o anúncio fica onde está e o dono é avisado.
      revisar := revisar + 1;
      perform public.notificar(s.dono_id, 'categoria_sugerida',
        'Sua sugestão de categoria foi aceita',
        format('%s, mas %s continua onde estava: ela pede informações que ele ainda não tem.',
               case p_acao when 'aprovar' then format('A categoria %s foi criada', caminho)
                           else format('Sua sugestão foi juntada à categoria %s', caminho) end,
               public.nome_anuncio_aviso(an.titulo, false)),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id, 'movido', false));
    end;
  end loop;

  return jsonb_build_object('categoria_id', final_id, 'decididas', decididas, 'movidos', movidos, 'revisar', revisar);
end $$;
