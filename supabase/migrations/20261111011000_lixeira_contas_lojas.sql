-- Lixeira de 30 dias para contas e lojas, suspensão em cascata e fila de limpeza.
-- Regras: docs/PLANO-GESTAO-EXCLUSAO.md.
--   conta -> loja -> anúncios: tudo sai do ar junto e volta junto.
--   Conteúdo congelado nunca entra na lixeira nem é apagado: fica guardado até liberação.
--   A remoção definitiva (Clerk, Storage, linhas) é feita por /api/interno/limpeza.

alter table public.vitrines_lojas add column excluida_em timestamptz;
alter table public.vitrines_lojas add constraint loja_excluida_suspensa
  check (excluida_em is null or status = 'suspensa');

-- Marca os anúncios que entraram na lixeira junto com a loja. Só eles voltam com ela.
alter table public.anuncios add column excluido_com_loja boolean not null default false;
alter table public.anuncios add constraint anuncio_excluido_com_loja
  check (not excluido_com_loja or status = 'excluido');

create table public.lixeira_lojas (
  vitrine_id      uuid primary key references public.vitrines_lojas(id) on delete cascade,
  excluida_em     timestamptz not null default now(),
  apagar_apos     timestamptz not null,
  origem          text not null check (origem in ('dono', 'admin', 'conta')),
  motivo          text check (motivo is null or char_length(motivo) <= 300),
  autor           text,
  status_anterior public.status_vitrine not null
);
create table public.lixeira_contas (
  usuario_id  text primary key references public.perfis(id) on delete cascade,
  pedida_em   timestamptz not null default now(),
  apagar_apos timestamptz not null,
  origem      text not null check (origem in ('usuario', 'admin')),
  motivo      text check (motivo is null or char_length(motivo) <= 300),
  autor       text,
  -- A limpeza reserva a conta antes de apagar no Clerk: depois disso não dá mais para cancelar.
  reservada_em timestamptz
);
alter table public.lixeira_lojas enable row level security;
alter table public.lixeira_contas enable row level security;
revoke all on public.lixeira_lojas, public.lixeira_contas from public, anon, authenticated;
-- O servidor do site confere a conta em exclusão e a limpeza remove as linhas.
grant select, delete on public.lixeira_lojas, public.lixeira_contas to service_role;

-- Fila de arquivos do Storage a apagar. Fica gravada no banco junto com a remoção do
-- registro: se o Storage falhar, a próxima limpeza tenta de novo.
create table public.limpeza_arquivos (
  id        bigserial primary key,
  url       text unique,
  pasta     text unique check (pasta is null or pasta ~ '^[A-Za-z0-9_]+$'),
  criado_em timestamptz not null default now(),
  check (num_nonnulls(url, pasta) = 1)
);
alter table public.limpeza_arquivos enable row level security;
revoke all on public.limpeza_arquivos from public, anon, authenticated;
grant select, insert, delete on public.limpeza_arquivos to service_role;
grant usage on sequence public.limpeza_arquivos_id_seq to service_role;

-- Suspensão: guarda o que estava no ar para devolver igual ao reativar.
alter table public.contas_bloqueadas
  add column loja_status_anterior public.status_vitrine,
  add column anuncios_pausados uuid[] not null default '{}';

-- Conta na lixeira perde o acesso como conta bloqueada. Só as funções de
-- exclusão pendente (abaixo) leem o JWT direto para mostrar e cancelar o pedido.
create or replace function public.usuario_id()
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select identidade.uid from (select nullif(auth.jwt()->>'sub','') as uid) identidade
  where identidade.uid is not null
    and not exists(select 1 from public.contas_revogadas r where r.usuario_id=identidade.uid)
    and not exists(select 1 from public.contas_bloqueadas b where b.usuario_id=identidade.uid)
    and not exists(select 1 from public.lixeira_contas l where l.usuario_id=identidade.uid)
$$;

create or replace function public.situacao_vitrine(v public.vitrines_lojas)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  if v.excluida_em is not null then return 'excluida'; end if;
  if v.arquivada_em is not null then return 'arquivada'; end if;
  v := public.vitrine_com_proximo(v);
  if v.status = 'suspensa' then return 'suspensa'; end if;
  if v.status = 'inadimplente' then return 'inadimplente'; end if;
  select * into p from public.planos where codigo = v.plano;
  if p.e_teste then return case when v.teste_expira_em > now() then 'teste' else 'teste_vencido' end; end if;
  if p.preco_centavos > 0 then return case when v.plano_expira_em > now() then 'ativa' else 'vencida' end; end if;
  return 'gratis';
end $$;

-- Núcleo interno: move a loja (e seus anúncios) para a lixeira. Sem checagem de permissão.
create function public.lixeira_mover_loja(p_loja uuid, p_origem text, p_motivo text, p_autor text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  loja public.vitrines_lojas;
  sistema text := coalesce(current_setting('olaki.sistema', true), '');
  lixeira text := coalesce(current_setting('olaki.lixeira', true), '');
begin
  select * into loja from public.vitrines_lojas where id = p_loja for update;
  if not found then return false; end if;
  if loja.excluida_em is not null then return false; end if;
  insert into public.lixeira_lojas(vitrine_id, apagar_apos, origem, motivo, autor, status_anterior)
    values (loja.id, now() + interval '30 days', p_origem, nullif(btrim(coalesce(p_motivo, '')), ''), p_autor, loja.status);
  perform set_config('olaki.sistema', '1', true);
  perform set_config('olaki.lixeira', '1', true);
  update public.vitrines_lojas set status = 'suspensa', excluida_em = now() where id = loja.id;
  -- Congelados ficam como estão: são prova e não podem ir para a lixeira.
  update public.anuncios
     set status = 'excluido', excluido_em = now(), status_antes_exclusao = status, excluido_com_loja = true
   where vitrine_id = loja.id and status not in ('excluido', 'congelado') and congelado_motivo is null;
  perform set_config('olaki.lixeira', lixeira, true);
  perform set_config('olaki.sistema', sistema, true);
  -- Gerentes perdem o acesso (as regras de gerente exigem loja ativa) e recebem aviso.
  insert into public.notificacoes(usuario_id, tipo, titulo, texto, chave)
  select c.aceito_por, 'loja_saiu_do_ar', 'Loja fora do ar',
         format('A loja %s saiu do ar e você não tem mais acesso a ela.', left(loja.nome, 80)),
         'loja_lixeira:' || loja.id || ':' || extract(epoch from now())::bigint
    from public.convites_gerente_loja c
   where c.vitrine_id = loja.id and c.aceito_por is not null and c.revogado_em is null
  on conflict do nothing;
  return true;
end $$;

-- Núcleo interno: devolve a loja e os anúncios que saíram com ela.
create function public.lixeira_restaurar_loja(p_loja uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item public.lixeira_lojas;
  sistema text := coalesce(current_setting('olaki.sistema', true), '');
  lixeira text := coalesce(current_setting('olaki.lixeira', true), '');
begin
  perform 1 from public.vitrines_lojas where id = p_loja for update;
  select * into item from public.lixeira_lojas where vitrine_id = p_loja;
  if not found then return false; end if;
  perform set_config('olaki.sistema', '1', true);
  perform set_config('olaki.lixeira', '1', true);
  -- A loja volta antes: anúncio não volta ao ar com loja suspensa.
  update public.vitrines_lojas set status = item.status_anterior, excluida_em = null where id = p_loja;
  -- A rotina diária volta a expirar ou pausar o que tiver vencido ou passado do plano.
  update public.anuncios
     set status = status_antes_exclusao, excluido_em = null, status_antes_exclusao = null, excluido_com_loja = false
   where vitrine_id = p_loja and excluido_com_loja;
  perform set_config('olaki.lixeira', lixeira, true);
  perform set_config('olaki.sistema', sistema, true);
  delete from public.lixeira_lojas where vitrine_id = p_loja;
  return true;
end $$;

-- Dono: excluir a própria loja (vai para a lixeira) e restaurar dentro dos 30 dias.
create function public.excluir_minha_loja(p_confirmacao text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare loja public.vitrines_lojas; eu text := public.usuario_id();
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into loja from public.vitrines_lojas where dono_id = eu;
  if not found then raise exception 'Você não tem loja.' using errcode = '22023'; end if;
  if upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' then
    raise exception 'Para confirmar, escreva EXCLUIR.' using errcode = '23514';
  end if;
  if loja.excluida_em is not null then
    return (select apagar_apos from public.lixeira_lojas where vitrine_id = loja.id);
  end if;
  if loja.arquivada_em is not null or loja.status = 'suspensa' then
    raise exception 'Sua loja está suspensa pela equipe. Fale com o suporte.' using errcode = '23514';
  end if;
  perform public.lixeira_mover_loja(loja.id, 'dono', null, eu);
  return (select apagar_apos from public.lixeira_lojas where vitrine_id = loja.id);
end $$;

create function public.restaurar_minha_loja()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare eu text := public.usuario_id(); alvo uuid;
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select l.vitrine_id into alvo from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id
   where v.dono_id = eu and l.origem = 'dono';
  if alvo is null then raise exception 'Não há loja sua para restaurar.' using errcode = '22023'; end if;
  perform public.lixeira_restaurar_loja(alvo);
end $$;

-- Conta: pedir exclusão. Conta, loja e anúncios saem do ar por 30 dias.
create function public.lixeira_mover_conta(p_id text, p_origem text, p_motivo text, p_autor text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare loja uuid; prazo timestamptz;
begin
  perform 1 from public.perfis where id = p_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode = '22023'; end if;
  select apagar_apos into prazo from public.lixeira_contas where usuario_id = p_id;
  if found then return prazo; end if;
  if public.e_admin(p_id) then
    raise exception 'Administrador não pode ser excluído. Tire o acesso de administrador na Equipe primeiro.' using errcode = '23514';
  end if;
  insert into public.lixeira_contas(usuario_id, apagar_apos, origem, motivo, autor)
    values (p_id, now() + interval '30 days', p_origem, nullif(btrim(coalesce(p_motivo, '')), ''), p_autor)
    returning apagar_apos into prazo;
  select id into loja from public.vitrines_lojas where dono_id = p_id;
  if loja is not null then
    -- Loja que o dono já tinha excluído passa a acompanhar a conta.
    -- Exclusão feita pela equipe continua da equipe: cancelar a conta não a desfaz.
    update public.lixeira_lojas set origem = 'conta', apagar_apos = greatest(apagar_apos, prazo)
     where vitrine_id = loja and origem = 'dono';
    perform public.lixeira_mover_loja(loja, 'conta', p_motivo, p_autor);
  end if;
  return prazo;
end $$;

create function public.lixeira_restaurar_conta(p_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare loja uuid;
begin
  perform 1 from public.perfis where id = p_id for update;
  if exists(select 1 from public.lixeira_contas where usuario_id = p_id and reservada_em is not null) then
    raise exception 'A exclusão desta conta já está em andamento e não pode ser desfeita.' using errcode = '23514';
  end if;
  select l.vitrine_id into loja from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id
   where v.dono_id = p_id and l.origem = 'conta';
  -- Sai da lixeira antes: as regras dos anúncios conferem a conta de quem restaura.
  delete from public.lixeira_contas where usuario_id = p_id;
  if loja is not null then perform public.lixeira_restaurar_loja(loja); end if;
end $$;

create function public.pedir_exclusao_conta(p_confirmacao text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare eu text := public.usuario_id();
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  if upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' then
    raise exception 'Para confirmar, escreva EXCLUIR.' using errcode = '23514';
  end if;
  return public.lixeira_mover_conta(eu, 'usuario', null, eu);
end $$;

-- Lê o JWT direto: usuario_id() já é nulo para quem está na lixeira.
create function public.minha_exclusao_pendente()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('apagar_apos', l.apagar_apos, 'pode_cancelar', l.origem = 'usuario' and l.reservada_em is null)
    from public.lixeira_contas l
   where l.usuario_id = nullif(auth.jwt()->>'sub', '')
     and not exists(select 1 from public.contas_revogadas r where r.usuario_id = l.usuario_id)
$$;

create function public.cancelar_exclusao_conta()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare eu text := nullif(auth.jwt()->>'sub', ''); item public.lixeira_contas;
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into item from public.lixeira_contas where usuario_id = eu for update;
  if not found then return; end if;
  if item.origem <> 'usuario' or exists(select 1 from public.contas_revogadas where usuario_id = eu)
     or exists(select 1 from public.contas_bloqueadas where usuario_id = eu) then
    raise exception 'Esta exclusão foi feita pela equipe. Fale com o suporte.' using errcode = '42501';
  end if;
  perform public.lixeira_restaurar_conta(eu);
end $$;

-- Admin: excluir e restaurar conta ou loja, e antecipar a remoção definitiva.
create function public.admin_lixeira_conta(p_id text, p_excluir boolean, p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare prazo timestamptz;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  if p_id = public.usuario_id() then raise exception 'Você não pode excluir a própria conta por aqui.' using errcode = '23514'; end if;
  if exists(select 1 from public.contas_revogadas r where r.usuario_id = p_id)
     and not exists(select 1 from public.contas_bloqueadas b where b.usuario_id = p_id) then
    raise exception 'Esta conta já foi excluída de vez.' using errcode = '23514';
  end if;
  if p_excluir then
    prazo := public.lixeira_mover_conta(p_id, 'admin', p_motivo, public.usuario_id());
  else
    if not exists(select 1 from public.lixeira_contas where usuario_id = p_id) then
      raise exception 'Esta conta não está na lixeira.' using errcode = '22023';
    end if;
    perform public.lixeira_restaurar_conta(p_id);
  end if;
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values ('usuario', p_id, public.usuario_id(), case when p_excluir then 'lixeira' else 'restaurar' end, btrim(p_motivo));
  return prazo;
end $$;

create function public.admin_lixeira_loja(p_loja uuid, p_excluir boolean, p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare item public.lixeira_lojas; prazo timestamptz;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.vitrines_lojas where id = p_loja) then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;
  if p_excluir then
    perform public.lixeira_mover_loja(p_loja, 'admin', p_motivo, public.usuario_id());
    select apagar_apos into prazo from public.lixeira_lojas where vitrine_id = p_loja;
  else
    select * into item from public.lixeira_lojas where vitrine_id = p_loja;
    if not found then raise exception 'Esta loja não está na lixeira.' using errcode = '22023'; end if;
    if item.origem = 'conta' then
      raise exception 'Esta loja saiu junto com a conta do dono. Restaure a conta.' using errcode = '23514';
    end if;
    perform public.lixeira_restaurar_loja(p_loja);
  end if;
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values ('loja', p_loja::text, public.usuario_id(), case when p_excluir then 'lixeira' else 'restaurar' end, btrim(p_motivo));
  return prazo;
end $$;

-- "Apagar de vez agora": a limpeza seguinte remove o item. Exige digitar o nome.
create function public.admin_antecipar_limpeza(p_tipo text, p_alvo text, p_confirmacao text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare nome text;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  if p_tipo = 'conta' then
    select p.nome into nome from public.lixeira_contas l join public.perfis p on p.id = l.usuario_id where l.usuario_id = p_alvo for update of l;
  elsif p_tipo = 'loja' and p_alvo ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    select v.nome into nome from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id
     where l.vitrine_id = p_alvo::uuid and l.origem <> 'conta' for update of l;
  else
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  if nome is null then raise exception 'Este item não está na lixeira.' using errcode = '22023'; end if;
  if btrim(coalesce(p_confirmacao, '')) is distinct from btrim(nome) then
    raise exception 'Digite o nome exatamente como aparece para confirmar.' using errcode = '23514';
  end if;
  if p_tipo = 'conta' then
    update public.lixeira_contas set apagar_apos = now() where usuario_id = p_alvo;
  else
    update public.lixeira_lojas set apagar_apos = now() where vitrine_id = p_alvo::uuid;
  end if;
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values (case when p_tipo = 'conta' then 'usuario' else 'loja' end, p_alvo, public.usuario_id(), 'apagar_definitivo', btrim(p_motivo));
end $$;

-- Lista da tela Lixeira do painel.
create function public.admin_lixeira()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'contas', coalesce((select jsonb_agg(jsonb_build_object('id', l.usuario_id, 'nome', p.nome, 'origem', l.origem,
        'motivo', l.motivo, 'pedida_em', l.pedida_em, 'apagar_apos', l.apagar_apos) order by l.apagar_apos)
      from public.lixeira_contas l join public.perfis p on p.id = l.usuario_id), '[]'),
    'lojas', coalesce((select jsonb_agg(jsonb_build_object('id', l.vitrine_id, 'nome', v.nome, 'slug', v.slug,
        'origem', l.origem, 'motivo', l.motivo, 'excluida_em', l.excluida_em, 'apagar_apos', l.apagar_apos,
        'anuncios', (select count(*) from public.anuncios a where a.vitrine_id = v.id and a.excluido_com_loja)) order by l.apagar_apos)
      from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id), '[]'),
    'anuncios', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'loja', v.nome,
        'excluido_em', a.excluido_em, 'apagar_apos', a.excluido_em + interval '30 days') order by a.excluido_em)
      from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
      where a.status = 'excluido' and not a.excluido_com_loja), '[]'));
end $$;

-- Suspender usuário: conta, loja e anúncios saem do ar e voltam iguais ao reativar.
-- O celular continua preso ao perfil (único), então não serve para criar outra conta.
create or replace function public.admin_bloquear_usuario(p_id text, p_bloquear boolean, p_motivo text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  loja public.vitrines_lojas;
  bloqueio public.contas_bloqueadas;
  pausados uuid[];
  sistema text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  perform 1 from public.perfis where id=p_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode='22023'; end if;
  if p_id=public.usuario_id() or public.e_admin(p_id) then
    raise exception 'Não é possível bloquear a própria conta ou um administrador. Ajuste as permissões na Equipe primeiro.' using errcode='23514'; end if;
  if p_bloquear is null then raise exception 'Escolha bloquear ou desbloquear.' using errcode='22023'; end if;
  select * into loja from public.vitrines_lojas where dono_id=p_id for update;
  if p_bloquear then
    if exists(select 1 from public.contas_revogadas where usuario_id=p_id)
      and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_id) then
      raise exception 'Esta conta já foi excluída.' using errcode='23514'; end if;
    if exists(select 1 from public.contas_bloqueadas where usuario_id=p_id) then return; end if;
    insert into public.contas_bloqueadas(usuario_id, loja_status_anterior)
      values(p_id, case when loja.id is not null and loja.excluida_em is null then loja.status end);
    insert into public.contas_revogadas(usuario_id,revogada_em)
      select usuario_id,bloqueada_em from public.contas_bloqueadas where usuario_id=p_id on conflict do nothing;
    if loja.id is not null and loja.excluida_em is null then
      perform set_config('olaki.sistema', '1', true);
      with p as (update public.anuncios set status='pausado' where vitrine_id=loja.id and status='ativo' returning id)
        select coalesce(array_agg(id), '{}') into pausados from p;
      update public.vitrines_lojas set status='suspensa' where id=loja.id;
      perform set_config('olaki.sistema', sistema, true);
      update public.contas_bloqueadas set anuncios_pausados=pausados where usuario_id=p_id;
    end if;
  else
    if exists(select 1 from public.contas_revogadas where usuario_id=p_id)
      and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_id) then
      raise exception 'Esta conta foi excluída e não pode ser desbloqueada.' using errcode='23514'; end if;
    select * into bloqueio from public.contas_bloqueadas where usuario_id=p_id for update;
    if found and loja.id is not null and loja.excluida_em is null and loja.arquivada_em is null then
      perform set_config('olaki.sistema', '1', true);
      if bloqueio.loja_status_anterior is not null and loja.status='suspensa' then
        update public.vitrines_lojas set status=bloqueio.loja_status_anterior where id=loja.id;
      end if;
      update public.anuncios set status='ativo'
       where id=any(bloqueio.anuncios_pausados) and vitrine_id=loja.id and status='pausado';
      perform set_config('olaki.sistema', sistema, true);
    end if;
    delete from public.contas_revogadas r using public.contas_bloqueadas b
      where r.usuario_id=p_id and b.usuario_id=r.usuario_id and r.revogada_em=b.bloqueada_em;
    delete from public.contas_bloqueadas where usuario_id=p_id;
  end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo)
    values('usuario',p_id,public.usuario_id(),case when p_bloquear then 'bloquear' else 'desbloquear' end,p_motivo);
end $$;

-- Anúncio que a limpeza não pode apagar: congelado, sob retenção ou ligado a pedido congelado.
create function public.anuncio_retido(a public.anuncios)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select a.status = 'congelado' or a.congelado_motivo is not null
      or coalesce(a.status_antes_exclusao::text, '') = 'congelado'
      or exists(select 1 from public.radar_propostas rp join public.radar_pedidos p on p.id = rp.pedido_id
                 where rp.anuncio_id = a.id and p.status = 'congelado')
$$;

-- Fila da limpeza diária (só o sistema). Congelados e itens ligados a eles ficam de fora.
create function public.limpeza_pendente()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'contas', coalesce((select jsonb_agg(usuario_id) from public.lixeira_contas where apagar_apos <= now()), '[]'),
    'lojas', coalesce((select jsonb_agg(vitrine_id) from public.lixeira_lojas where apagar_apos <= now() and origem <> 'conta'), '[]'),
    'anuncios', coalesce((select jsonb_agg(a.id) from public.anuncios a
       where a.status = 'excluido' and not a.excluido_com_loja and a.excluido_em <= now() - interval '30 days'
         and not public.anuncio_retido(a)), '[]'))
$$;

-- Reserva uma conta vencida para a limpeza. Depois disso, cancelar ou restaurar é recusado.
create function public.limpeza_reservar_conta(p_id text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.perfis where id = p_id for update;
  update public.lixeira_contas set reservada_em = coalesce(reservada_em, now())
   where usuario_id = p_id and apagar_apos <= now();
  return found;
end $$;

-- Guarda na fila as URLs sem uso e as devolve.
create function public.limpeza_enfileirar(p_urls text[])
returns text[] language plpgsql security definer set search_path = public, pg_temp as $$
declare livres text[] := public.urls_sem_uso(p_urls);
begin
  insert into public.limpeza_arquivos(url) select unnest(livres) on conflict do nothing;
  return livres;
end $$;

-- URLs que nenhum outro registro usa (anúncio, loja ou proposta). Para apagar do Storage.
create function public.urls_sem_uso(p_urls text[])
returns text[] language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct u), '{}') from unnest(p_urls) u
   where u is not null
     and not exists(select 1 from public.anuncios a where u = any(a.fotos))
     and not exists(select 1 from public.vitrines_lojas v where u in (v.logo_url, v.capa_url, v.banner_url))
     and not exists(select 1 from public.radar_propostas rp where rp.foto_url = u)
$$;

-- Apaga um anúncio da lixeira. Devolve as fotos que podem sair do Storage.
create function public.purgar_anuncio(p_id uuid)
returns text[] language plpgsql security definer set search_path = public, pg_temp as $$
declare fotos text[];
begin
  delete from public.anuncios a where a.id = p_id and a.status = 'excluido' and a.excluido_em <= now() - interval '30 days'
    and not public.anuncio_retido(a)
    returning a.fotos into fotos;
  return public.limpeza_enfileirar(coalesce(fotos, '{}'));
end $$;

-- Apaga uma loja da lixeira. Com pagamento ou conteúdo congelado, a loja fica anonimizada
-- (guarda fiscal e prova) e só o resto sai. Devolve as URLs que podem sair do Storage.
create function public.purgar_loja(p_loja uuid)
returns text[] language plpgsql security definer set search_path = public, pg_temp as $$
declare
  loja public.vitrines_lojas;
  urls text[];
  sistema text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into loja from public.vitrines_lojas where id = p_loja for update;
  if not found or loja.excluida_em is null then return '{}'; end if;
  -- Só apaga se ainda estiver vencida na lixeira (pode ter sido restaurada depois da fila).
  if not exists(select 1 from public.lixeira_lojas where vitrine_id = p_loja and apagar_apos <= now() and origem <> 'conta') then
    return '{}';
  end if;
  select coalesce(array_agg(f), '{}') into urls from public.anuncios a, unnest(a.fotos) f
   where a.vitrine_id = p_loja and not public.anuncio_retido(a);
  urls := urls || array[loja.logo_url, loja.capa_url, loja.banner_url];
  delete from public.anuncios a where a.vitrine_id = p_loja and not public.anuncio_retido(a);
  with d as (
    delete from public.radar_propostas rp where rp.vitrine_id = p_loja
      and not exists(select 1 from public.radar_pedidos p where p.id = rp.pedido_id and p.status = 'congelado')
    returning rp.foto_url)
  select urls || coalesce(array_agg(foto_url) filter (where foto_url is not null), '{}') into urls from d;
  if exists(select 1 from public.pagamentos where vitrine_id = p_loja) or loja.gateway_assinatura_id is not null
     or exists(select 1 from public.anuncios where vitrine_id = p_loja)
     or exists(select 1 from public.radar_propostas where vitrine_id = p_loja) then
    perform set_config('olaki.sistema', '1', true);
    -- Com o dono ainda ativo, o nome reservado "Loja encerrada" é recusado; usa um sufixo único.
    update public.vitrines_lojas set nome = case when exists(select 1 from public.contas_revogadas r where r.usuario_id = dono_id)
        then 'Loja encerrada' else 'Loja encerrada ' || left(id::text, 8) end,
      slug = 'encerrada-' || id, cidade = 'Conta excluída',
      bairro = null, criado_ip = null, selo_loja_verificada = false, descricao = null, whatsapp = null, cnpj = null,
      logo_url = null, capa_url = null, sobre = null, endereco = null, lat = null, lng = null, instagram = null,
      site_url = null, telefone_publico = null, entrega_obs = null, horarios = null, formas_pagamento = '{}',
      faz_entrega = null, banner_tipo = 'modelo', banner_url = null, banner_moderado_url = null,
      banner_moderado_motivo = null, banner_moderado_em = null
     where id = p_loja;
    perform set_config('olaki.sistema', sistema, true);
    delete from public.loja_secoes where vitrine_id = p_loja;
    update public.convites_gerente_loja set revogado_em = coalesce(revogado_em, now()) where vitrine_id = p_loja;
    delete from public.lixeira_lojas where vitrine_id = p_loja;
  else
    delete from public.vitrines_lojas where id = p_loja;
  end if;
  return public.limpeza_enfileirar(urls);
end $$;

revoke all on function
  public.lixeira_mover_loja(uuid,text,text,text), public.lixeira_restaurar_loja(uuid),
  public.lixeira_mover_conta(text,text,text,text), public.lixeira_restaurar_conta(text),
  public.limpeza_pendente(), public.urls_sem_uso(text[]), public.purgar_anuncio(uuid), public.purgar_loja(uuid),
  public.limpeza_reservar_conta(text), public.anuncio_retido(public.anuncios), public.limpeza_enfileirar(text[]),
  public.excluir_minha_loja(text), public.restaurar_minha_loja(), public.pedir_exclusao_conta(text),
  public.minha_exclusao_pendente(), public.cancelar_exclusao_conta(),
  public.admin_lixeira_conta(text,boolean,text), public.admin_lixeira_loja(uuid,boolean,text),
  public.admin_antecipar_limpeza(text,text,text,text), public.admin_lixeira()
  from public, anon, authenticated;
grant execute on function public.limpeza_pendente(), public.urls_sem_uso(text[]),
  public.purgar_anuncio(uuid), public.purgar_loja(uuid), public.limpeza_reservar_conta(text),
  public.anuncio_retido(public.anuncios), public.limpeza_enfileirar(text[]) to service_role;
grant execute on function public.excluir_minha_loja(text), public.restaurar_minha_loja(),
  public.pedir_exclusao_conta(text), public.minha_exclusao_pendente(), public.cancelar_exclusao_conta(),
  public.admin_lixeira_conta(text,boolean,text), public.admin_lixeira_loja(uuid,boolean,text),
  public.admin_antecipar_limpeza(text,text,text,text), public.admin_lixeira() to authenticated;
grant select (excluida_em) on public.vitrines_lojas to authenticated;
grant select (excluido_com_loja) on public.anuncios to authenticated;

-- Agenda a limpeza diária no Supabase (04:00 UTC). O token fica no Vault.
create function public.limpeza_disparar()
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare segredo text; pedido bigint;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_limpeza_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/limpeza',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;
revoke all on function public.limpeza_disparar() from public, anon, authenticated;
grant execute on function public.limpeza_disparar() to service_role;
do $$ begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') and exists(select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-limpeza-lixeira', '0 4 * * *', 'select public.limpeza_disparar()');
  end if;
end $$;
