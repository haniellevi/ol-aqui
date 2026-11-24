-- O modo inicial preserva o alcance legado. Convite e consentimento são independentes.
create table public.radar_piloto_controle (
  id boolean primary key default true check (id),
  modo text not null check (modo in ('legado','fechado','pausado')),
  rodada_id uuid,
  microrregiao_id uuid references public.microrregioes(id),
  inicio_em timestamptz,
  fim_em timestamptz,
  piso_fila_em timestamptz,
  check (modo <> 'fechado' or (
    rodada_id is not null and microrregiao_id is not null and inicio_em is not null
    and fim_em is not null and piso_fila_em is not null and inicio_em < fim_em
    and piso_fila_em >= inicio_em and piso_fila_em < fim_em))
);
insert into public.radar_piloto_controle (modo) values ('legado');

create table public.radar_piloto_participantes (
  rodada_id uuid not null,
  usuario_id text not null references public.perfis(id) on update cascade on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  revogado_em timestamptz,
  primary key (rodada_id, usuario_id),
  check (inicio_em < fim_em)
);
create index radar_piloto_participantes_usuario_idx on public.radar_piloto_participantes (usuario_id);
alter table public.radar_piloto_controle enable row level security;
alter table public.radar_piloto_participantes enable row level security;
revoke all on public.radar_piloto_controle, public.radar_piloto_participantes from public, anon, authenticated, service_role;

alter table public.preferencias_avisos
  add column consentido_em timestamptz,
  add column retomar_apos_sair boolean not null default false,
  add column radar_autorizacao_id uuid;

create function public.radar_piloto_modo(p_quando timestamptz)
returns text language sql stable set search_path = '' as $$
  select coalesce((select case
    when c.modo = 'legado' then 'legado'
    when c.modo = 'fechado' and p_quando >= c.inicio_em and p_quando < c.fim_em then 'fechado'
    else 'pausado' end
  from public.radar_piloto_controle c where c.id), 'pausado');
$$;

create function public.radar_piloto_participante(p_usuario text, p_regiao uuid, p_quando timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select from public.radar_piloto_controle c
    join public.radar_piloto_participantes i on i.rodada_id = c.rodada_id and i.usuario_id = p_usuario
    join public.perfis p on p.id = i.usuario_id and p.microrregiao_id = i.microrregiao_id
    where c.id and c.modo = 'fechado' and c.microrregiao_id = p_regiao and i.microrregiao_id = p_regiao
      and c.inicio_em <= p_quando and p_quando < c.fim_em
      and i.inicio_em <= p_quando and p_quando < i.fim_em and i.revogado_em is null
  );
$$;

-- Os chamadores autenticados fornecem somente o tipo/estado; identidade e escopo vêm da sessão.
create function public.radar_salvar_preferencia(p_tipos text[], p_ligado boolean, p_por_tipo boolean)
returns boolean language plpgsql set search_path = '' as $$
declare
  uid text := public.usuario_id();
  instante timestamptz;
  modo text;
  regiao uuid;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode = '28000'; end if;
  if p_ligado is null then raise exception 'Escolha ligar ou desligar.' using errcode = '22023'; end if;

  if p_ligado then perform 1 from public.radar_piloto_controle where id for share; end if;
  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || uid));
  instante := clock_timestamp();

  if p_ligado then
    if not coalesce(public.whatsapp_confirmado(uid), false) then
      raise exception 'Confirme seu WhatsApp antes de ligar os avisos por WhatsApp.' using errcode = '42501';
    end if;
    modo := public.radar_piloto_modo(instante);
    select microrregiao_id into regiao from public.perfis where id = uid;
    if public.config('radar.whatsapp_ativo', null, 'false') is distinct from 'true'::jsonb
       or modo = 'pausado'
       or (modo = 'fechado' and (not p_por_tipo or not public.radar_piloto_participante(uid, regiao, instante))) then
      raise exception 'Este aviso ainda não está disponível.' using errcode = '55000';
    end if;

    insert into public.preferencias_avisos as a
      (usuario_id, tipo, canal, ligado, atualizado_em, consentido_em, radar_autorizacao_id)
    select uid, t, 'whatsapp', true, instante, case when p_por_tipo then instante end, gen_random_uuid()
      from unnest(p_tipos) as t
    on conflict (usuario_id, tipo, canal) do update
      set ligado = true, atualizado_em = instante, radar_autorizacao_id = gen_random_uuid(),
          consentido_em = case when p_por_tipo then instante else a.consentido_em end, retomar_apos_sair = false
      where not a.ligado or (p_por_tipo and a.consentido_em is null);
  else
    update public.preferencias_avisos
       set ligado = false, retomar_apos_sair = false, atualizado_em = instante, radar_autorizacao_id = gen_random_uuid()
     where usuario_id = uid and canal = 'whatsapp' and tipo = any(p_tipos) and (ligado or retomar_apos_sair);
  end if;
  return p_ligado;
end $$;

create function public.salvar_preferencia_whatsapp_radar_tipo(p_tipo text, p_ligado boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_tipo is null or p_tipo not in ('pedido_novo','proposta_nova','proposta_escolhida') then
    raise exception 'Escolha um aviso do Radar.' using errcode = '22023';
  end if;
  return public.radar_salvar_preferencia(array[p_tipo], p_ligado, true);
end $$;

create or replace function public.salvar_preferencia_whatsapp_radar(p_ligado boolean)
returns boolean language sql security definer set search_path = '' as $$
  select public.radar_salvar_preferencia(case when p_ligado then array['pedido_novo']
    else array['pedido_novo','proposta_nova','proposta_escolhida'] end, p_ligado, false);
$$;

create or replace function public.salvar_preferencia_whatsapp_radar_completa(p_ligado boolean)
returns boolean language sql security definer set search_path = '' as $$
  select public.radar_salvar_preferencia(array['pedido_novo','proposta_nova','proposta_escolhida'], p_ligado, false);
$$;

create or replace function public.minha_preferencia_whatsapp_radar()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid text := public.usuario_id();
  instante timestamptz := statement_timestamp();
  modo text := public.radar_piloto_modo(instante);
  tipos jsonb;
  ativos int;
  confirmado boolean;
  global_ativo boolean;
  acesso boolean;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode = '28000'; end if;
  select jsonb_object_agg(t.tipo, jsonb_build_object('ligado',coalesce(a.ligado,false),
           'confirmado_para_piloto',a.consentido_em is not null)), count(*) filter (where a.ligado)
    into tipos, ativos
    from unnest(array['pedido_novo','proposta_nova','proposta_escolhida']) as t(tipo)
    left join public.preferencias_avisos a on a.usuario_id = uid and a.canal = 'whatsapp' and a.tipo = t.tipo;
  confirmado := coalesce(public.whatsapp_confirmado(uid),false);
  global_ativo := public.config('radar.whatsapp_ativo',null,'false') is not distinct from 'true'::jsonb;
  acesso := global_ativo and (modo = 'legado' or (modo = 'fechado' and public.radar_piloto_participante(
    uid,(select p.microrregiao_id from public.perfis p where p.id=uid),instante)));
  return jsonb_build_object('ligado',ativos>0,'parcial',ativos between 1 and 2,'confirmado',confirmado,
    'ativo',acesso,'pode_ligar',confirmado and acesso,'modo',modo,'tipos',tipos);
end $$;

revoke all on function public.radar_piloto_modo(timestamptz),
  public.radar_piloto_participante(text,uuid,timestamptz), public.radar_salvar_preferencia(text[],boolean,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.salvar_preferencia_whatsapp_radar_tipo(text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.salvar_preferencia_whatsapp_radar_tipo(text,boolean) to authenticated;

alter table public.whatsapp_respostas
  add column radar_ocorreu_em timestamptz,
  add column radar_origem_incompativel boolean not null default false;

create function public.whatsapp_radar_sair(p_numero text, p_comando text, p_ocorreu_em timestamptz)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo record;
  achou boolean := false;
  primeiro text;
  variantes text[];
  numero13 text;
  alvos text[];
  chave_trava integer;
  instante timestamptz;
  origem_incompativel boolean;
  contas_confirmadas integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_comando not in ('SAIR', 'PARAR', 'STOP', 'CANCELAR') then
    raise exception 'Pedido de saída inválido.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  select array_agg(pf.id order by pf.id) into alvos from public.perfis pf where pf.whatsapp = any(variantes);
  for chave_trava in
    select distinct hashtext('whatsapp_voltar:' || a) from unnest(alvos) a order by 1
  loop
    perform pg_advisory_xact_lock(chave_trava);
  end loop;
  instante := clock_timestamp();
  origem_incompativel := p_ocorreu_em is null or p_ocorreu_em > statement_timestamp() + interval '1 minute';
  for alvo in select pf.id from public.perfis pf where pf.id = any(alvos) and pf.whatsapp = any(variantes) order by pf.id loop
    achou := true;
    primeiro := coalesce(primeiro, alvo.id);
    update public.preferencias_avisos pa
       set ligado = false, atualizado_em = instante, retomar_apos_sair = pa.consentido_em is not null,
           radar_autorizacao_id = gen_random_uuid()
     where pa.usuario_id = alvo.id and pa.canal = 'whatsapp' and pa.ligado
       and pa.tipo in ('pedido_novo', 'proposta_nova', 'proposta_escolhida');
    -- A autorização já foi revogada. A coleta que detém uma linha a reavalia no envio.
    with livres as materialized (
      select f.id from public.whatsapp_fila f
       where f.usuario_id = alvo.id and f.estado = 'pendente'
         and (split_part(f.chave,':',1) in ('radar_pedido_novo','radar_proposta_nova','radar_proposta_escolhida')
              or public.radar_eh_pergunta_whatsapp(f.chave))
       for update skip locked
    )
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
      from livres where f.id = livres.id;
    insert into public.whatsapp_respostas (usuario_id, comando, criado_em, radar_ocorreu_em, radar_origem_incompativel)
    values (alvo.id, p_comando, instante, case when not origem_incompativel then p_ocorreu_em end, origem_incompativel);
  end loop;
  delete from public.whatsapp_ultima_mensagem where numero = any(variantes);
  if achou then
    select count(*) into contas_confirmadas from public.perfis
     where whatsapp = any(variantes) and whatsapp_verificado_em is not null;
    insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
    values (primeiro, p_numero,
            case when contas_confirmadas > 1 or origem_incompativel then
              'Pronto. Os avisos do Radar pelo WhatsApp foram desligados. Para voltar, entre na sua conta no Mercado da Região e ligue cada aviso em Minha conta > Notificações.'
            else
              'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações.'
            end,
            null,
            'whatsapp_saida:' || numero13 || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
            now())
    on conflict (chave) where chave is not null do nothing;
  end if;
  return achou;
end $$;


create or replace function public.whatsapp_sair(p_numero text, p_comando text)
returns boolean language sql security definer set search_path = '' as $$
  select public.whatsapp_radar_sair(p_numero,p_comando,null);
$$;
revoke all on function public.whatsapp_radar_sair(text,text,timestamptz) from public, anon, authenticated, service_role;

alter table public.whatsapp_fila
  add column radar_piloto_id uuid,
  add column radar_autorizacao_id uuid,
  add column radar_comprovante_pergunta text;

-- Identidade derivada do ID de entrada. Contexto temporário existe só para SIM anterior à confirmação do provedor.
create table public.whatsapp_radar_eventos (
  evento text primary key check (evento ~ '^[a-f0-9]{64}$'),
  registrado_em timestamptz not null default clock_timestamp(),
  pergunta_id uuid references public.whatsapp_fila(id) on delete cascade,
  citada text check (citada ~ '^[a-f0-9]{64}$')
);
create index whatsapp_radar_eventos_tempo_idx on public.whatsapp_radar_eventos(registrado_em);
create index whatsapp_radar_eventos_pergunta_idx on public.whatsapp_radar_eventos(pergunta_id) where pergunta_id is not null;
alter table public.whatsapp_radar_eventos enable row level security;
revoke all on public.whatsapp_radar_eventos from public, anon, authenticated, service_role;

create function public.radar_enfileirar_whatsapp(
  p_usuario text, p_regiao uuid, p_tipo text, p_evento_em timestamptz,
  p_texto text, p_link text, p_chave text)
returns boolean language plpgsql set search_path = '' as $$
declare
  instante timestamptz;
  rodada uuid;
  autorizacao uuid;
begin
  if p_tipo not in ('pedido_novo','proposta_nova','proposta_escolhida')
     or split_part(p_chave,':',1) <> 'radar_' || p_tipo then return false; end if;
  perform 1 from public.radar_piloto_controle where id for share;
  instante := clock_timestamp();

  select case when c.modo = 'fechado' then c.rodada_id end, a.radar_autorizacao_id
    into rodada, autorizacao
    from public.radar_piloto_controle c
    join public.preferencias_avisos a on a.usuario_id = p_usuario and a.tipo = p_tipo and a.canal = 'whatsapp'
   where c.id and a.ligado and (a.radar_autorizacao_id is null or p_evento_em > a.atualizado_em)
     and (c.modo = 'legado' or (
       a.consentido_em is not null and a.radar_autorizacao_id is not null
       and p_evento_em >= c.piso_fila_em and p_evento_em < c.fim_em
       and public.radar_piloto_participante(p_usuario,p_regiao,p_evento_em)
       and public.radar_piloto_participante(p_usuario,p_regiao,instante)));
  if not found or not public.whatsapp_enfileirar(p_usuario,p_texto,p_link,p_chave) then return false; end if;

  update public.whatsapp_fila set radar_piloto_id = rodada, radar_autorizacao_id = autorizacao where chave = p_chave;
  return true;
end $$;

create function public.radar_piloto_permite_item(
  p_item public.whatsapp_fila, p_regiao uuid, p_tipo text, p_quando timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select from public.radar_piloto_controle c
    join public.preferencias_avisos a on a.usuario_id = p_item.usuario_id and a.tipo = p_tipo and a.canal = 'whatsapp'
    where c.id and a.ligado and a.radar_autorizacao_id is not distinct from p_item.radar_autorizacao_id
      and not exists (select from public.preferencias_avisos s where s.usuario_id = a.usuario_id and s.tipo = a.tipo
                      and s.canal = 'app' and not s.ligado)
      and not exists (select from public.whatsapp_respostas r where r.usuario_id = a.usuario_id
                      and r.comando in ('SAIR','PARAR','STOP','CANCELAR') and r.criado_em >= p_item.criado_em)
      and ((c.modo = 'legado' and p_item.radar_piloto_id is null) or (
        p_item.radar_piloto_id = c.rodada_id and p_item.criado_em >= c.piso_fila_em
        and a.consentido_em is not null and a.radar_autorizacao_id is not null
        and public.radar_piloto_participante(a.usuario_id,p_regiao,p_item.criado_em)
        and public.radar_piloto_participante(a.usuario_id,p_regiao,p_quando)))
  );
$$;

create function public.radar_eh_pergunta_whatsapp(p_chave text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_chave ~ '^whatsapp_resposta:55[1-9][0-9]9[0-9]{8}:pergunta:[0-9]{4}-[0-9]{2}-[0-9]{2}$',false);
$$;

create function public.radar_piloto_permite_pergunta(p_item public.whatsapp_fila, p_quando timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select from public.radar_piloto_controle c
    join public.perfis p on p.id = p_item.usuario_id
    where c.id and public.radar_eh_pergunta_whatsapp(p_item.chave)
      and p_item.criado_em > p_quando - interval '7 days'
      and public.config('radar.whatsapp_ativo',null,'false') = 'true'::jsonb
      and p.whatsapp_verificado_em is not null
      and split_part(p_item.chave,':',2) =
        case when length(p.whatsapp)=12 then substr(p.whatsapp,1,4)||'9'||substr(p.whatsapp,5) else p.whatsapp end
      and not exists (select from public.contas_revogadas r where r.usuario_id=p.id)
      and not exists (select from public.contas_bloqueadas b where b.usuario_id=p.id)
      and not exists (select from public.lixeira_contas l where l.usuario_id=p.id)
      and exists (select from public.whatsapp_respostas r where r.usuario_id=p.id
                  and r.comando in ('SAIR','PARAR','STOP','CANCELAR') and r.criado_em < p_item.criado_em)
      and not exists (select from public.whatsapp_respostas r where r.usuario_id=p.id
                      and r.comando in ('SAIR','PARAR','STOP','CANCELAR','VOLTAR') and r.criado_em >= p_item.criado_em)
      and not exists (select from public.preferencias_avisos a where a.usuario_id=p.id and a.canal='whatsapp'
                      and a.tipo in ('pedido_novo','proposta_nova','proposta_escolhida')
                      and (a.ligado or a.atualizado_em >= p_item.criado_em))
      and exists (
        select from public.preferencias_avisos a where a.usuario_id=p.id and a.canal='whatsapp'
         and a.tipo in ('pedido_novo','proposta_nova','proposta_escolhida') and a.retomar_apos_sair and a.consentido_em is not null
         and not exists (select from public.preferencias_avisos s where s.usuario_id=p.id and s.canal='app' and s.tipo=a.tipo and not s.ligado))
      and ((c.modo='legado' and p_item.radar_piloto_id is null) or (
        p_item.radar_piloto_id=c.rodada_id and p_item.criado_em>=c.piso_fila_em
        and public.radar_piloto_participante(p.id,p.microrregiao_id,p_item.criado_em)
        and public.radar_piloto_participante(p.id,p.microrregiao_id,p_quando)))
  );
$$;

-- Chaves de evento existentes já incluem o ID do pedido. A versão/piloto se aplica só aos avisos e à pergunta exata.
create function public.radar_fila_permite(p_item public.whatsapp_fila, p_quando timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select case
    when public.radar_eh_pergunta_whatsapp(p_item.chave) then public.radar_piloto_permite_pergunta(p_item,p_quando)
    when split_part(p_item.chave,':',1) in ('radar_pedido_novo','radar_proposta_nova','radar_proposta_escolhida') then
      public.radar_piloto_permite_item(p_item,(
        select p.microrregiao_id from public.radar_pedidos p
        where p.id::text = split_part(p_item.chave,':',2)),
        substr(split_part(p_item.chave,':',1),7),p_quando)
    else true end;
$$;

revoke all on function public.radar_enfileirar_whatsapp(text,uuid,text,timestamptz,text,text,text),
  public.radar_piloto_permite_item(public.whatsapp_fila,uuid,text,timestamptz),
  public.radar_eh_pergunta_whatsapp(text), public.radar_piloto_permite_pergunta(public.whatsapp_fila,timestamptz),
  public.radar_fila_permite(public.whatsapp_fila,timestamptz) from public, anon, authenticated, service_role;


create function public.radar_texto_whatsapp_com_saida(modelo text, vars jsonb)
returns text language plpgsql set search_path = '' as $$
declare
  modelo_static text;
  partes_sair text[];
  corpo_wa text;
  rodape_wa text;
  texto_cheio text;
  texto_wa text;
  sufixo_sair constant text := ' Responda SAIR para parar estes avisos.';
begin
  -- Verifica instrução de saída SOMENTE no texto estático do modelo (antes de substituir {pedido}/{loja}),
  -- trocando marcadores por token alfanumérico neutro (XVARX) para impedir falso positivo colado (SAIR{loja}/{pedido}SAIR)
  -- ou atravessando variáveis (Digite {loja} SAIR).
  modelo_static := regexp_replace(modelo, '\{[^{}]*\}', 'XVARX', 'g');
  if modelo_static ~* '(\m(responda|envie|mande|digite|escreva)\s+["''“”]?sair\M|\msair\s+(para\s+(parar|cancelar|desativar|n[aã]o\s+receber)|aqui\s+para\s+parar)\M)' then
    texto_cheio := public.mensagem_montar(modelo, vars, 4000);
    if char_length(texto_cheio) <= 1000 then
      texto_wa := texto_cheio;
    else
      partes_sair := regexp_match(
        modelo,
        '^(.*?)(\s*(?:[^.!?{}]*\m(?:responda|envie|mande|digite|escreva)\s+["''“”]?sair\M|\msair\s+(?:para\s+(?:parar|cancelar|desativar|n[aã]o\s+receber)|aqui\s+para\s+parar)\M)[^{}]*)$',
        'i'
      );
      rodape_wa := case when partes_sair is not null then btrim(regexp_replace(partes_sair[2], '\s+', ' ', 'g')) else null end;
      if rodape_wa is not null and char_length(rodape_wa) between 5 and 200 then
        corpo_wa := public.mensagem_montar(partes_sair[1], vars, 4000);
        texto_wa := rtrim(left(corpo_wa, 1000 - 1 - char_length(rodape_wa))) || ' ' || rodape_wa;
      else
        texto_wa := rtrim(left(texto_cheio, 1000 - char_length(sufixo_sair))) || sufixo_sair;
      end if;
    end if;
  else
    texto_cheio := public.mensagem_montar(modelo, vars, 4000);
    texto_wa := rtrim(left(texto_cheio, 1000 - char_length(sufixo_sair))) || sufixo_sair;
  end if;
  return texto_wa;
end $$;
revoke all on function public.radar_texto_whatsapp_com_saida(text,jsonb) from public, anon, authenticated, service_role;

create or replace function public.radar_avisar_pedido_novo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  evento_em timestamptz := clock_timestamp();
  categoria_pedido uuid;
  por_dia integer;
  por_comprador integer;
  max_vendedores integer;
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  ligados jsonb;
  chave_aviso text := 'pedido_novo:' || new.id::text;
  vars jsonb;
  dono text;
  vitrine_alvo uuid;
  whatsapp_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  modelo_wa public.modelos_mensagem;
  texto_wa text;
begin
  if new.status <> 'aberto' or new.expira_em <= now() or new.total_propostas >= new.max_propostas
     or (new.modo_contato = 'propostas_prazo' and (new.propostas_ate is null or new.propostas_ate <= now())) then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'em_analise' then
    return null; -- publicação após análise; reabrir um pedido já publicado não é um novo pedido
  end if;

  categoria_pedido := public.radar_categoria_pedido(new.categoria_id, new.categoria);
  if categoria_pedido is null then return null; end if;

  ligados := public.config('radar.avisos_ligados', new.microrregiao_id, null);
  if jsonb_typeof(ligados) = 'array' and not (ligados ? 'pedido_novo') then return null; end if;

  por_dia := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_dia', new.microrregiao_id, 'null'))::int;
  por_comprador := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_comprador_dia', new.microrregiao_id, 'null'))::int;
  max_vendedores := coalesce(public.numero_ou_nulo(
    public.config('radar.avisos_lojas_max_por_pedido', new.microrregiao_id, '200')
  )::int, 200);
  if tg_op = 'UPDATE' then
    max_vendedores := max_vendedores - (select count(*)::int from public.notificacoes n where n.chave = chave_aviso);
  end if;
  if max_vendedores <= 0 then return null; end if;

  -- RF2: sem cidades marcadas, o aviso diz o nome da região (não "Toda a região")
  vars := jsonb_build_object('pedido', new.titulo,
    'cidade', case when new.cidades_ids is null
                   then coalesce((select m.nome from public.microrregioes m where m.id = new.microrregiao_id), new.cidade)
                   else new.cidade end,
    'preco', public.radar_faixa_texto(new.preco_min_centavos, new.preco_max_centavos));

  -- WhatsApp: só com a chave geral ligada e o modelo ativo (o aviso por loja é conferido no laço)
  if whatsapp_ligado then
    select * into modelo_wa from public.modelos_mensagem x where x.chave = 'pedido_novo' and x.canal = 'whatsapp';
  end if;

  for dono, vitrine_alvo in
    select v.dono_id, v.id
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
     where v.microrregiao_id = new.microrregiao_id and v.status = 'ativa'
       and v.dono_id <> new.comprador_id
       and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and public.recebe_aviso_radar_na_hora(v.dono_id)
       and public.radar_pedido_na_area(new, v)
       and exists (
         select 1 from public.anuncios a
          where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
            and public.radar_nicho_corresponde(categoria_pedido, a.categoria_id)
       )
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado
       )
       and not exists (
         select 1 from public.notificacoes n where n.usuario_id = v.dono_id and n.chave = chave_aviso
       )
       and (por_dia is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.status = 'aberto'
       ) < por_dia)
       and (por_comprador is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.comprador_id = new.comprador_id
       ) < por_comprador)
     order by v.criado_em, v.id
     limit max_vendedores
  loop
    perform public.radar_aviso(
      dono, 'pedido_novo', new.microrregiao_id, vars, '/radar/' || new.id::text, chave_aviso
    );
    -- A loja precisa ter ligado o aviso no WhatsApp (padrão desligado). O número já foi conferido acima.
    if whatsapp_ligado and modelo_wa.id is not null and modelo_wa.ativo and exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = dono and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) then
      begin
        texto_wa := public.radar_texto_whatsapp_com_saida(modelo_wa.texto, jsonb_build_object('cidade', vars->>'cidade'));
        perform public.radar_enfileirar_whatsapp(dono, new.microrregiao_id, 'pedido_novo', evento_em, texto_wa, '/radar/' || new.id::text,
          'radar_pedido_novo:' || new.id::text || ':' || vitrine_alvo::text);
      exception when others then
        -- aviso nunca derruba a publicação do pedido
        raise warning 'Aviso de WhatsApp do pedido não saiu: %', sqlerrm;
      end;
    end if;
  end loop;
  return null;
end $$;

create or replace function public.radar_avisar_proposta()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  evento_em timestamptz := clock_timestamp();
  p         public.radar_pedidos;
  v         public.vitrines_lojas;
  vars      jsonb;
  ligados       jsonb;
  modelo_wa     public.modelos_mensagem;
  texto_wa      text;
begin
  select * into p from public.radar_pedidos x where x.id = new.pedido_id;
  select * into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if p.id is null or v.id is null then return null; end if;

  vars := jsonb_build_object(
    'pedido', p.titulo,
    'loja', case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
    'preco', coalesce(public.radar_reais(new.preco_centavos), '')
  );

  perform public.radar_aviso(
    p.comprador_id, 'proposta_nova', p.microrregiao_id,
    vars, '/radar/pedido/' || p.id::text, 'proposta_nova:' || new.id::text
  );

  ligados := public.config('radar.avisos_ligados', p.microrregiao_id, null);
  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb
     and not (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_nova'))
     and p.status = 'aberto' and p.expira_em > now() and new.status = 'ativa'
     and p.comprador_id <> v.dono_id
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.comprador_id)
     and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = p.comprador_id)
     and not exists (select 1 from public.lixeira_contas l where l.usuario_id = p.comprador_id)
     and exists (
       select 1 from public.preferencias_avisos pa
        where pa.usuario_id = p.comprador_id and pa.tipo = 'proposta_nova'
          and pa.canal = 'whatsapp' and pa.ligado
     )
     and not exists (
       select 1 from public.preferencias_avisos pa
        where pa.usuario_id = p.comprador_id and pa.tipo = 'proposta_nova'
          and pa.canal = 'app' and not pa.ligado
     ) then
    select * into modelo_wa from public.modelos_mensagem x
     where x.chave = 'proposta_nova' and x.canal = 'whatsapp';
    if modelo_wa.id is not null and modelo_wa.ativo then
      begin
        texto_wa := public.radar_texto_whatsapp_com_saida(modelo_wa.texto, vars);
        perform public.radar_enfileirar_whatsapp(
          p.comprador_id, p.microrregiao_id, 'proposta_nova', evento_em, texto_wa, '/radar/pedido/' || p.id::text,
          'radar_proposta_nova:' || p.id::text || ':' || new.id::text
        );
      exception when others then
        -- aviso nunca derruba o envio da proposta
        raise warning 'Aviso de WhatsApp da proposta nova não saiu: %', sqlerrm;
      end;
    end if;
  end if;
  return null;
end $$;

create or replace function public.escolher_proposta(p_proposta_id uuid)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  evento_em timestamptz;
  uid       text := public.usuario_id();
  rp        public.radar_propostas;
  v         public.vitrines_lojas;
  p         public.radar_pedidos;
  fone      text;
  vars      jsonb;
  ligados       jsonb;
  modelo_wa     public.modelos_mensagem;
  texto_wa      text;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into rp from public.radar_propostas x where x.id = p_proposta_id;
  select * into p  from public.radar_pedidos x where x.id = rp.pedido_id for update;
  -- A edição da oferta e o encerramento também travam o pedido. Releia após a trava.
  select * into rp from public.radar_propostas x where x.id = p_proposta_id for update;
  if p.comprador_id is distinct from uid then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  if rp.status <> 'ativa' or p.status in ('em_analise', 'congelado') or p.fechado_motivo in ('cancelado', 'moderacao') then
    raise exception 'Esta proposta não está mais disponível.' using errcode = 'P0002';
  end if;
  select * into v from public.vitrines_lojas x where x.id = rp.vitrine_id;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está atendendo pelo Mercado da Região agora.' using errcode = 'P0002';
  end if;
  select public.contato_publico_vitrine(v, pf) into fone
    from public.perfis pf where pf.id = v.dono_id;
  if fone is null then
    raise exception 'Esta loja ainda não tem WhatsApp confirmado. Tente outra proposta.' using errcode = 'P0001';
  end if;
  if not rp.escolhida then
    evento_em := clock_timestamp();
    update public.radar_propostas x set escolhida = true, escolhida_em = now() where x.id = rp.id;
    vars := jsonb_build_object('pedido', p.titulo, 'loja', v.nome);
    perform public.radar_aviso(
      v.dono_id, 'proposta_escolhida', p.microrregiao_id,
      vars, '/radar/' || p.id::text, 'proposta_escolhida:' || rp.id::text
    );

    ligados := public.config('radar.avisos_ligados', p.microrregiao_id, null);
    if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb
       and not (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_escolhida'))
       and p.status = 'aberto' and p.expira_em > now()
       and v.arquivada_em is null and v.excluida_em is null
       and v.dono_id <> p.comprador_id
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
       and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
       and exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'proposta_escolhida'
            and pa.canal = 'whatsapp' and pa.ligado
       )
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'proposta_escolhida'
            and pa.canal = 'app' and not pa.ligado
       ) then
      select * into modelo_wa from public.modelos_mensagem x
       where x.chave = 'proposta_escolhida' and x.canal = 'whatsapp';
      if modelo_wa.id is not null and modelo_wa.ativo then
        begin
          texto_wa := public.radar_texto_whatsapp_com_saida(modelo_wa.texto, vars);
          perform public.radar_enfileirar_whatsapp(
            v.dono_id, p.microrregiao_id, 'proposta_escolhida', evento_em, texto_wa, '/radar/' || p.id::text,
            'radar_proposta_escolhida:' || p.id::text || ':' || rp.id::text
          );
        exception when others then
          -- aviso nunca derruba a escolha da proposta
          raise warning 'Aviso de WhatsApp da proposta escolhida não saiu: %', sqlerrm;
        end;
      end if;
    end if;
  end if;
  return query select fone, format('Olá, %s! Vi sua proposta no Radar do Mercado da Região para "%s".', v.nome, p.titulo);
end $$;

create or replace function public.whatsapp_resposta_automatica(p_uid text, p_numero text, p_tipo text, p_texto text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  numero13 text := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  variantes text[] := case when length(p_numero) = 13
                           then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                           else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  inicio timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  inseridas integer;
begin
  if (select count(*) from public.whatsapp_fila f
       where f.numero = any(variantes) and f.criado_em >= inicio
         and (f.chave like 'whatsapp_saida:%' or f.chave like 'whatsapp_resposta:%')) >= 3 then
    return 'limite';
  end if;
  insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos, radar_piloto_id)
  values (p_uid, p_numero, p_texto, null,
          'whatsapp_resposta:' || numero13 || ':' || p_tipo || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
          now(), case when p_tipo = 'pergunta' then (
            select c.rodada_id from public.radar_piloto_controle c where c.id and c.modo='fechado') end)
  on conflict (chave) where chave is not null do nothing;
  get diagnostics inseridas = row_count;
  return case when inseridas > 0 then 'enviada' else 'repetida' end;
end $$;

create function public.radar_fila_exige_worker_atual(p_item public.whatsapp_fila)
returns boolean language sql immutable set search_path = '' as $$
  select p_item.radar_piloto_id is not null or public.radar_eh_pergunta_whatsapp(p_item.chave);
$$;
revoke all on function public.radar_fila_exige_worker_atual(public.whatsapp_fila) from public, anon, authenticated, service_role;

create function public.whatsapp_radar_fila_pegar_em(p_limite integer, p_quando timestamptz, p_worker_atual boolean)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  dentro_janela boolean := public.proxima_janela_whatsapp(p_quando) = p_quando;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < p_quando - interval '10 minutes';

  -- Aviso de pedido novo de pedido fechado, vencido, fora do prazo de propostas ou lotado não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (
       select 1 from public.radar_pedidos rp
        where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and rp.total_propostas < rp.max_propostas
          and (rp.modo_contato <> 'propostas_prazo' or (rp.propostas_ate is not null and rp.propostas_ate > p_quando)));

  -- Aviso de proposta nova de pedido fechado/vencido ou proposta removida/oculta não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_nova:%'
     and not exists (
       select 1 from public.radar_pedidos rp
         join public.radar_propostas pr on pr.pedido_id = rp.id
        where rp.id::text = substring(f.chave from '^radar_proposta_nova:([0-9a-f-]{36}):')
          and pr.id::text = substring(f.chave from '([^:]+)$')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and pr.status = 'ativa');

  -- Aviso de proposta escolhida de pedido fechado/vencido ou proposta indisponível não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_escolhida:%'
     and not exists (
       select 1 from public.radar_pedidos rp
         join public.radar_propostas pr on pr.pedido_id = rp.id
        where rp.id::text = substring(f.chave from '^radar_proposta_escolhida:([0-9a-f-]{36}):')
          and pr.id::text = substring(f.chave from '([^:]+)$')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and pr.status = 'ativa' and pr.escolhida);

  -- Aviso do Radar de quem desligou (ou pediu SAIR antes da criação do aviso) ou não tem opt-in ativo não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and (not exists (select 1 from public.preferencias_avisos pa
                       where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado)
          or exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado)
          or exists (select 1 from public.whatsapp_respostas r
                      where r.usuario_id = f.usuario_id
                        and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')
                        and r.criado_em >= f.criado_em));

  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_nova:%'
     and (not exists (select 1 from public.preferencias_avisos pa
                       where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova' and pa.canal = 'whatsapp' and pa.ligado)
          or exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova' and pa.canal = 'app' and not pa.ligado)
          or exists (select 1 from public.whatsapp_respostas r
                      where r.usuario_id = f.usuario_id
                        and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')
                        and r.criado_em >= f.criado_em));

  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_escolhida:%'
     and (not exists (select 1 from public.preferencias_avisos pa
                       where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida' and pa.canal = 'whatsapp' and pa.ligado)
          or exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida' and pa.canal = 'app' and not pa.ligado)
          or exists (select 1 from public.whatsapp_respostas r
                      where r.usuario_id = f.usuario_id
                        and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')
                        and r.criado_em >= f.criado_em));

  with invalidas as materialized (
    select f.id, case when public.radar_eh_pergunta_whatsapp(f.chave) then 'radar_pergunta_invalida'
                      else 'radar_piloto_inapto' end as motivo
      from public.whatsapp_fila f
     where f.estado = 'pendente' and f.criado_em <= p_quando
       and (split_part(f.chave,':',1) in ('radar_pedido_novo','radar_proposta_nova','radar_proposta_escolhida')
            or public.radar_eh_pergunta_whatsapp(f.chave))
       and not public.radar_fila_permite(f,p_quando)
     order by f.enviar_apos, f.id limit 50 for update skip locked
  )
  update public.whatsapp_fila f set estado='cancelada', erro=i.motivo from invalidas i where f.id=i.id;

  return query
    with escolhidas as materialized (
      select x.id from public.whatsapp_fila x
       where x.estado = 'pendente' and x.enviar_apos <= p_quando
         and (p_worker_atual or not public.radar_fila_exige_worker_atual(x))
         and public.radar_fila_permite(x,p_quando)
         and (dentro_janela or x.chave like 'whatsapp_saida:%' or x.chave like 'whatsapp_resposta:%')
         and (radar_ligado or x.chave is null or (
               x.chave not like 'radar_pedido_novo:%'
               and x.chave not like 'radar_proposta_nova:%'
               and x.chave not like 'radar_proposta_escolhida:%'))
       order by x.enviar_apos, x.criado_em
       limit greatest(least(coalesce(p_limite, 5), 5), 1)
       for update skip locked
    )
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = p_quando
      from escolhidas e where f.id = e.id
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- Só o Worker atual pode colher perguntas de SIM ou avisos vinculados ao piloto.
create or replace function public.whatsapp_fila_pegar(p_limite integer default 5)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language sql security definer set search_path = '' as $$
  select * from public.whatsapp_radar_fila_pegar_em(p_limite,now(),false);
$$;

create function public.whatsapp_radar_fila_pegar(p_limite integer)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language sql security definer set search_path = '' as $$
  select * from public.whatsapp_radar_fila_pegar_em(p_limite,now(),true);
$$;

create or replace function public.whatsapp_fila_pegar_em(p_limite integer, p_quando timestamptz)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language sql set search_path = '' as $$
  select * from public.whatsapp_radar_fila_pegar_em(p_limite,p_quando,true);
$$;

revoke all on function public.whatsapp_radar_fila_pegar_em(integer,timestamptz,boolean),
  public.whatsapp_radar_fila_pegar(integer) from public, anon, authenticated, service_role;
grant execute on function public.whatsapp_radar_fila_pegar(integer) to service_role;

-- Reusar as operações existentes, incluindo a conferência de outros serviços.
alter function public.whatsapp_fila_confirmar_envio(uuid) rename to whatsapp_fila_confirmar_interna;
alter function public.whatsapp_fila_resultado(uuid,text) rename to whatsapp_fila_resultado_interno;
alter function public.whatsapp_fila_devolver(uuid[]) rename to whatsapp_fila_devolver_interna;
revoke all on function public.whatsapp_fila_confirmar_interna(uuid),
  public.whatsapp_fila_resultado_interno(uuid,text), public.whatsapp_fila_devolver_interna(uuid[])
  from public, anon, authenticated, service_role;

create function public.whatsapp_fila_confirmar_envio(p_id uuid, p_worker_atual boolean)
returns text language sql security definer set search_path = '' as $$
  select case when not coalesce(p_worker_atual,false) and exists (
      select from public.whatsapp_fila f where f.id=p_id and public.radar_fila_exige_worker_atual(f)
    ) then 'ignorada' else public.whatsapp_fila_confirmar_interna(p_id) end;
$$;
create function public.whatsapp_fila_confirmar_envio(p_id uuid)
returns text language sql security definer set search_path = '' as $$
  select public.whatsapp_fila_confirmar_envio(p_id,false);
$$;

create function public.whatsapp_fila_resultado(p_id uuid, p_resultado text, p_worker_atual boolean)
returns text language sql security definer set search_path = '' as $$
  select case when not coalesce(p_worker_atual,false) and exists (
      select from public.whatsapp_fila f where f.id=p_id and public.radar_fila_exige_worker_atual(f)
    ) then 'ignorado' else public.whatsapp_fila_resultado_interno(p_id,p_resultado) end;
$$;
create function public.whatsapp_fila_resultado(p_id uuid, p_resultado text)
returns text language sql security definer set search_path = '' as $$
  select public.whatsapp_fila_resultado(p_id,p_resultado,false);
$$;

create function public.whatsapp_fila_devolver(p_ids uuid[], p_worker_atual boolean)
returns integer language sql security definer set search_path = '' as $$
  select public.whatsapp_fila_devolver_interna(case when p_worker_atual then p_ids else array(
    select f.id from public.whatsapp_fila f where f.id=any(p_ids) and not public.radar_fila_exige_worker_atual(f)
  ) end);
$$;
create function public.whatsapp_fila_devolver(p_ids uuid[])
returns integer language sql security definer set search_path = '' as $$
  select public.whatsapp_fila_devolver(p_ids,false);
$$;

revoke all on function public.whatsapp_fila_confirmar_envio(uuid), public.whatsapp_fila_confirmar_envio(uuid,boolean),
  public.whatsapp_fila_resultado(uuid,text), public.whatsapp_fila_resultado(uuid,text,boolean),
  public.whatsapp_fila_devolver(uuid[]), public.whatsapp_fila_devolver(uuid[],boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.whatsapp_fila_confirmar_envio(uuid), public.whatsapp_fila_confirmar_envio(uuid,boolean),
  public.whatsapp_fila_resultado(uuid,text), public.whatsapp_fila_resultado(uuid,text,boolean),
  public.whatsapp_fila_devolver(uuid[]), public.whatsapp_fila_devolver(uuid[],boolean)
  to service_role;

create or replace function public.whatsapp_fila_confirmar_envio_anterior_ia(p_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  f        public.whatsapp_fila;
  pedido   public.radar_pedidos;
  proposta public.radar_propostas;
  ligados  jsonb;
  motivo   text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorada'; end if;
  if public.radar_eh_pergunta_whatsapp(f.chave) then
    if public.radar_piloto_permite_pergunta(f,clock_timestamp()) then return 'pode'; end if;
    update public.whatsapp_fila set estado='cancelada', erro='radar_pergunta_invalida' where id=f.id;
    return 'cancelada';
  end if;
  if f.chave is null or (
       f.chave not like 'radar_pedido_novo:%'
       and f.chave not like 'radar_proposta_nova:%'
       and f.chave not like 'radar_proposta_escolhida:%') then
    return 'pode';
  end if;

  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) is distinct from 'true'::jsonb then
    motivo := 'radar_desligado';
  elsif f.chave like 'radar_pedido_novo:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):');

    if not exists (select 1 from public.preferencias_avisos pa
                    where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado)
       or exists (select 1 from public.preferencias_avisos pa
                   where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or not (
            pedido.status = 'aberto' and pedido.expira_em > clock_timestamp()
            and pedido.total_propostas < pedido.max_propostas
            and (pedido.modo_contato <> 'propostas_prazo' or (pedido.propostas_ate is not null and pedido.propostas_ate > clock_timestamp()))) then
      motivo := 'pedido_fechado';
    elsif public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria) is null
       or not exists (
         select 1 from public.vitrines_lojas v
           join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
          where v.id::text = substring(f.chave from '([^:]+)$')
            and v.dono_id = f.usuario_id and v.dono_id <> pedido.comprador_id
            and v.status = 'ativa' and v.microrregiao_id = pedido.microrregiao_id
            and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
            and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
            and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
            and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
            and public.recebe_aviso_radar_na_hora(v.dono_id)
            and public.radar_pedido_na_area(pedido, v)
            and exists (select 1 from public.anuncios a
                         where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
                           and public.radar_nicho_corresponde(public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria), a.categoria_id))) then
      motivo := 'sem_direito_aviso';
    end if;
  elsif f.chave like 'radar_proposta_nova:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_proposta_nova:([0-9a-f-]{36}):');
    select * into proposta from public.radar_propostas pr
     where pr.id::text = substring(f.chave from '([^:]+)$') and pr.pedido_id = pedido.id;
    ligados := case when pedido.id is not null then public.config('radar.avisos_ligados', pedido.microrregiao_id, null) else null end;

    if not exists (select 1 from public.preferencias_avisos pa
                    where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova' and pa.canal = 'whatsapp' and pa.ligado)
       or exists (select 1 from public.preferencias_avisos pa
                   where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova' and pa.canal = 'app' and not pa.ligado)
       or (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_nova'))
       or not exists (select 1 from public.modelos_mensagem m where m.chave = 'proposta_nova' and m.canal = 'whatsapp' and m.ativo) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or proposta.id is null
       or not (pedido.status = 'aberto' and pedido.expira_em > clock_timestamp() and proposta.status = 'ativa') then
      motivo := 'pedido_fechado';
    elsif not exists (
      select 1 from public.perfis pf
       where pf.id = pedido.comprador_id and pf.id = f.usuario_id
         and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
         and not exists (select 1 from public.contas_revogadas r where r.usuario_id = pf.id)
         and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = pf.id)
         and not exists (select 1 from public.lixeira_contas l where l.usuario_id = pf.id)
    ) then
      motivo := 'sem_direito_aviso';
    end if;
  elsif f.chave like 'radar_proposta_escolhida:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_proposta_escolhida:([0-9a-f-]{36}):');
    select * into proposta from public.radar_propostas pr
     where pr.id::text = substring(f.chave from '([^:]+)$') and pr.pedido_id = pedido.id;
    ligados := case when pedido.id is not null then public.config('radar.avisos_ligados', pedido.microrregiao_id, null) else null end;

    if not exists (select 1 from public.preferencias_avisos pa
                    where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida' and pa.canal = 'whatsapp' and pa.ligado)
       or exists (select 1 from public.preferencias_avisos pa
                   where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida' and pa.canal = 'app' and not pa.ligado)
       or (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_escolhida'))
       or not exists (select 1 from public.modelos_mensagem m where m.chave = 'proposta_escolhida' and m.canal = 'whatsapp' and m.ativo) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or proposta.id is null
       or not (pedido.status = 'aberto' and pedido.expira_em > clock_timestamp() and proposta.status = 'ativa' and proposta.escolhida) then
      motivo := 'pedido_fechado';
    elsif not exists (
      select 1 from public.vitrines_lojas v
        join public.perfis pf on pf.id = v.dono_id
       where v.id = proposta.vitrine_id
         and v.dono_id = f.usuario_id and v.dono_id <> pedido.comprador_id
         and v.status = 'ativa' and v.arquivada_em is null and v.excluida_em is null
         and v.microrregiao_id = pedido.microrregiao_id
         and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
         and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
         and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
         and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
    ) then
      motivo := 'sem_direito_aviso';
    end if;
  end if;

  -- Mesmo após VOLTAR (ou religar no site), aviso do Radar criado antes de um SAIR nunca é liberado.
  if motivo is null and exists (
    select 1 from public.whatsapp_respostas r
     where r.usuario_id = f.usuario_id
       and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')
       and r.criado_em >= f.criado_em
  ) then
    motivo := 'radar_desligado';
  end if;

  if motivo is null then
    select case
      when not exists (
        select from public.radar_pedidos rp where rp.id = pedido.id and rp.status = 'aberto'
          and rp.expira_em > clock_timestamp()
          and (f.chave not like 'radar_pedido_novo:%' or (
            rp.total_propostas < rp.max_propostas and
            (rp.modo_contato <> 'propostas_prazo' or rp.propostas_ate > clock_timestamp())))
      ) then 'pedido_fechado'
      when public.config('radar.whatsapp_ativo',null,'false') is distinct from 'true'::jsonb then 'radar_desligado'
      when not public.radar_piloto_permite_item(f,pedido.microrregiao_id,substr(split_part(f.chave,':',1),7),clock_timestamp())
        then case when exists (select from public.preferencias_avisos a
             where a.usuario_id=f.usuario_id and a.canal='whatsapp' and a.tipo=substr(split_part(f.chave,':',1),7)
               and a.radar_autorizacao_id is distinct from f.radar_autorizacao_id)
          then 'radar_desligado' else 'radar_piloto_inapto' end
      when f.radar_piloto_id is not null and f.chave like 'radar_pedido_novo:%'
        and ((jsonb_typeof(public.config('radar.avisos_ligados',pedido.microrregiao_id,null)) = 'array'
              and not (public.config('radar.avisos_ligados',pedido.microrregiao_id,null) ? 'pedido_novo'))
             or not exists(select from public.modelos_mensagem m where m.chave='pedido_novo' and m.canal='whatsapp' and m.ativo))
        then 'radar_desligado'
    end into motivo;
  end if;
  if motivo is null then return 'pode'; end if;
  update public.whatsapp_fila set estado = 'cancelada', erro = motivo where id = f.id;
  return 'cancelada';
end $$;

create function public.radar_escopo_whatsapp(tipos text[])
returns text language sql immutable set search_path = '' as $$
  select case when 'pedido_novo'=any(tipos) then
    case when tipos && array['proposta_nova','proposta_escolhida'] then 'pedidos e propostas do Radar'
         else 'pedidos do Radar' end
    else 'avisos de propostas do Radar' end;
$$;
revoke all on function public.radar_escopo_whatsapp(text[]) from public, anon, authenticated, service_role;

create function public.whatsapp_radar_processar(p_numero text, p_intencao text, p_hash text,
  p_evento text, p_ocorreu_em timestamptz, p_citada text, p_pode_perguntar boolean)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text;
  numero13 text;
  variantes text[];
  radar_ligado boolean;
  pref_ligada boolean;
  pode_retomar boolean;
  tem_retomavel boolean;
  instante timestamptz;
  modo text;
  ativos text[];
  retomados text[];
  tipos_afetados text[];
  conta_count integer;
  pergunta public.whatsapp_fila;
  sino_desligado boolean;
  pref_mudou_em timestamptz;
  ultima_saida timestamptz;
  limite_saida timestamptz;
  ordem_comprometida boolean;
  ultimo_voltar timestamptz;
  ultima_pergunta timestamptz;
  saiu boolean;
  hash_anterior text;
  recebido_anterior timestamptz;
  resultado text;
  escopo_texto text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_intencao not in ('voltar', 'sim', 'outra')
     or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Mensagem recebida inválida.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;

  select count(*), min(pf.id) into conta_count, uid from public.perfis pf
   where pf.whatsapp = any(variantes) and pf.whatsapp_verificado_em is not null;
  if conta_count = 0 then return 'sem_conta'; end if;
  if conta_count <> 1 then return 'ambiguo'; end if;

  perform 1 from public.radar_piloto_controle where id for share;
  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || uid));
  instante := clock_timestamp();
  if (select count(*) from public.perfis where whatsapp = any(variantes) and whatsapp_verificado_em is not null) <> 1
     or not exists (select from public.perfis pf where pf.id = uid and pf.whatsapp = any(variantes)
                    and pf.whatsapp_verificado_em is not null)
     or exists (select from public.contas_revogadas r where r.usuario_id = uid) then return 'sem_conta'; end if;
  modo := public.radar_piloto_modo(instante);

  if p_intencao = 'outra' then
    delete from public.whatsapp_ultima_mensagem where recebido_em < now() - interval '1 day';
    select u.hash, u.recebido_em into hash_anterior, recebido_anterior
      from public.whatsapp_ultima_mensagem u where u.numero = numero13;
    insert into public.whatsapp_ultima_mensagem (numero, hash, recebido_em) values (numero13, p_hash, clock_timestamp())
      on conflict (numero) do update set hash = excluded.hash, recebido_em = excluded.recebido_em;
    if hash_anterior = p_hash and recebido_anterior > now() - interval '1 day' then
      return 'mensagem_repetida';
    end if;
  else
    delete from public.whatsapp_ultima_mensagem where numero = numero13;
  end if;

  radar_ligado := public.config('radar.whatsapp_ativo', null, 'false') is not distinct from 'true'::jsonb
    and (modo = 'legado' or (modo = 'fechado' and public.radar_piloto_participante(
      uid,(select p.microrregiao_id from public.perfis p where p.id=uid),instante)));
  select coalesce(bool_or(pa.ligado and (modo='legado' or pa.consentido_em is not null)),false),
         coalesce(bool_or(pa.retomar_apos_sair and pa.consentido_em is not null),false),
         max(pa.atualizado_em),
         array_agg(pa.tipo) filter (where (pa.ligado and modo='legado')
           or (pa.consentido_em is not null and (pa.ligado or pa.retomar_apos_sair)))
    into pref_ligada, tem_retomavel, pref_mudou_em, tipos_afetados
    from public.preferencias_avisos pa
   where pa.usuario_id = uid and pa.canal = 'whatsapp'
     and pa.tipo in ('pedido_novo','proposta_nova','proposta_escolhida');

  select array_agg(pa.tipo) filter (where pa.ligado and (modo='legado' or pa.consentido_em is not null)),
         array_agg(pa.tipo) filter (where pa.retomar_apos_sair and pa.consentido_em is not null)
    into ativos, retomados
    from public.preferencias_avisos pa
   where pa.usuario_id = uid and pa.canal = 'whatsapp'
     and pa.tipo in ('pedido_novo','proposta_nova','proposta_escolhida')
     and not exists (select from public.preferencias_avisos a where a.usuario_id = uid and a.canal = 'app'
                     and a.tipo = pa.tipo and not a.ligado);
  pode_retomar := retomados is not null;
  sino_desligado := not pode_retomar and (tem_retomavel or (pref_ligada and ativos is null));

  select max(r.criado_em) into ultimo_voltar from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'VOLTAR';
  -- Processar SAIR já tarde não estabelece ordem quando sua origem contradiz o relógio local.
  -- Outra saída, inclusive tardia, não resolve essa contradição. Um SIM causal confirmado pode resolvê-la.
  select max(r.criado_em), max(greatest(r.criado_em,r.radar_ocorreu_em)),
         coalesce(bool_or(r.radar_ocorreu_em is null or r.radar_origem_incompativel)
           filter (where ultimo_voltar is null or r.criado_em >= ultimo_voltar),false)
    into ultima_saida, limite_saida, ordem_comprometida from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR');
  select max(r.criado_em) into ultima_pergunta from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'PERGUNTA_VOLTAR';
  saiu := ultima_saida is not null and (ultimo_voltar is null or ultimo_voltar < ultima_saida)
          and (pref_mudou_em is null or pref_mudou_em <= ultima_saida);
  if p_intencao = 'sim' then
    -- O ID citado, quando comprovado, liga causalmente a resposta à pergunta mais recente.
    if p_citada is null or p_evento is null or not radar_ligado then return 'nada'; end if;
    select f.* into pergunta from public.whatsapp_fila f
     where f.usuario_id=uid and public.radar_eh_pergunta_whatsapp(f.chave)
       and split_part(f.chave,':',2)=numero13
     order by f.criado_em desc, f.id desc limit 1;
    if pergunta.id is null or not public.radar_piloto_permite_pergunta(pergunta,instante) then return 'nada'; end if;
    if pergunta.estado = 'enviando' then
      update public.whatsapp_radar_eventos e set pergunta_id=pergunta.id, citada=p_citada
       where e.evento=p_evento;
      return 'aguarda_comprovante';
    end if;
    if pergunta.estado <> 'enviada' or pergunta.radar_comprovante_pergunta is distinct from p_citada then return 'nada'; end if;
  end if;

  if p_intencao in ('voltar','sim') then
    if not radar_ligado then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'pausado', 'No momento os avisos do Radar pelo WhatsApp estão pausados.');
      return 'pausado';
    end if;
    if not tem_retomavel and not pref_ligada then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'orientacao', 'Para receber avisos do Radar no WhatsApp, confirme cada aviso em Minha conta > Notificações no Mercado da Região.');
      return 'orientacao';
    end if;
    if sino_desligado then
      perform public.whatsapp_resposta_automatica(
        uid, p_numero, 'sino',
        case
          when tipos_afetados = array['pedido_novo'] then 'Para voltar a receber pedidos do Radar pelo WhatsApp, ligue antes o aviso de pedido novo no app em Minha conta > Notificações.'
          else format('Para voltar a receber %s pelo WhatsApp, ligue antes os avisos correspondentes no app em Minha conta > Notificações.',
            public.radar_escopo_whatsapp(tipos_afetados))
        end
      );
      return 'sino_desligado';
    end if;
    if pref_ligada and not pode_retomar then
      escopo_texto := public.radar_escopo_whatsapp(ativos);
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'ja_ativo', format('Você já recebe os %s pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.', escopo_texto));
      return 'ja_ativo';
    end if;
    if p_intencao = 'voltar' and (ordem_comprometida or p_evento is null or p_ocorreu_em is null or limite_saida is null
       or p_ocorreu_em <= limite_saida or p_ocorreu_em > instante or p_ocorreu_em <= instante - interval '7 days') then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'orientacao',
        'Para voltar a receber, ligue cada aviso em Minha conta > Notificações no Mercado da Região.');
      return 'orientacao';
    end if;
    escopo_texto := public.radar_escopo_whatsapp(retomados);
    update public.preferencias_avisos pa
       set ligado = true, atualizado_em = instante, retomar_apos_sair = false, radar_autorizacao_id = gen_random_uuid()
     where pa.usuario_id = uid and pa.canal = 'whatsapp'
       and pa.tipo in ('pedido_novo','proposta_nova','proposta_escolhida')
       and pa.retomar_apos_sair and pa.consentido_em is not null
       and not exists (select from public.preferencias_avisos a
          where a.usuario_id = uid and a.canal = 'app' and a.tipo = pa.tipo and not a.ligado);
    insert into public.whatsapp_respostas (usuario_id, comando, criado_em) values (uid, 'VOLTAR', instante);
    perform public.whatsapp_resposta_automatica(uid, p_numero, 'voltar' || to_char(clock_timestamp(), 'HH24MISSUS'), format('Pronto! Você volta a receber %s pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.', escopo_texto));
    return 'voltou';
  end if;

  if p_intencao = 'sim' then return 'nada'; end if;

  if p_pode_perguntar and saiu and not pref_ligada and radar_ligado and pode_retomar then
    escopo_texto := public.radar_escopo_whatsapp(retomados);
    if ultima_pergunta is not null and ultima_pergunta > instante - interval '7 days' then
      return 'ja_perguntou';
    end if;
    resultado := public.whatsapp_resposta_automatica(uid, p_numero, 'pergunta', format('Oi! Você pediu para não receber %s pelo WhatsApp. Quer voltar a receber? Use Responder nesta mensagem e escreva SIM.', escopo_texto));
    if resultado <> 'enviada' then return resultado; end if;
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'PERGUNTA_VOLTAR');
    return 'pergunta';
  end if;
  return 'nada';
end $$;


-- O Worker anterior conserva SAIR e a orientação de VOLTAR. Ele não consegue verificar a resposta citada.
create or replace function public.whatsapp_mensagem_recebida(p_numero text, p_intencao text, p_hash text)
returns text language sql security definer set search_path = '' as $$
  select public.whatsapp_radar_processar(p_numero,p_intencao,p_hash,null,null,null,false);
$$;

create function public.whatsapp_radar_mensagem_com_contexto(p_numero text, p_hash text)
returns text language sql security definer set search_path = '' as $$
  select public.whatsapp_radar_processar(p_numero,'outra',p_hash,null,null,null,true);
$$;

create function public.whatsapp_radar_evento(p_numero text, p_intencao text, p_comando text,
  p_evento text, p_ocorreu_em timestamptz, p_citada text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  resultado text;
begin
  if p_intencao is null or p_intencao not in ('sair','voltar','sim')
     or (p_evento is null and p_intencao <> 'sair') or p_evento !~ '^[a-f0-9]{64}$'
     or (p_citada is not null and (p_intencao <> 'sim' or p_citada !~ '^[a-f0-9]{64}$')) then
    raise exception 'Evento inválido.' using errcode = '22023';
  end if;
  if p_evento is null then
    return case when public.whatsapp_radar_sair(p_numero,p_comando,p_ocorreu_em) then 'saiu' else 'sem_conta' end;
  end if;
  with antigos as materialized (
    select evento from public.whatsapp_radar_eventos
     where registrado_em < statement_timestamp() - interval '14 days'
     order by registrado_em limit 100 for update skip locked
  )
  delete from public.whatsapp_radar_eventos a using antigos where a.evento=antigos.evento;
  insert into public.whatsapp_radar_eventos(evento) values (p_evento) on conflict do nothing;
  if not found then return 'evento_repetido'; end if;

  if p_intencao = 'sair' then
    resultado := case when public.whatsapp_radar_sair(p_numero,p_comando,p_ocorreu_em) then 'saiu' else 'sem_conta' end;
  else
    resultado := public.whatsapp_radar_processar(p_numero,p_intencao,p_evento,p_evento,p_ocorreu_em,p_citada,false);
  end if;
  if resultado = 'sem_conta' then
    delete from public.whatsapp_radar_eventos where evento=p_evento;
  end if;
  return resultado;
end $$;

create function public.whatsapp_radar_resultado_enviado(p_id uuid, p_comprovante text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  f public.whatsapp_fila;
  e record;
  resultado text;
begin
  if p_comprovante is null or p_comprovante !~ '^[a-f0-9]{64}$' then
    raise exception 'Comprovante inválido.' using errcode = '22023';
  end if;
  select * into f from public.whatsapp_fila where id=p_id;
  if f.id is null or not public.radar_eh_pergunta_whatsapp(f.chave) then
    return public.whatsapp_fila_resultado(p_id,'enviado',true);
  end if;

  -- Mesma ordem do webhook: controle, conta, depois a fila. Nunca aguarda conta mantendo trava da fila.
  perform 1 from public.radar_piloto_controle where id for share;
  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || f.usuario_id));
  resultado := public.whatsapp_fila_resultado(p_id,'enviado',true);
  if resultado <> 'enviada' then return resultado; end if;
  update public.whatsapp_fila set radar_comprovante_pergunta=p_comprovante where id=p_id;
  for e in select evento, citada from public.whatsapp_radar_eventos
    where pergunta_id=p_id and citada=p_comprovante order by registrado_em, evento
  loop
    perform public.whatsapp_radar_processar(f.numero,'sim',e.evento,e.evento,null,e.citada,false);
  end loop;
  update public.whatsapp_radar_eventos set pergunta_id=null, citada=null where pergunta_id=p_id;
  return resultado;
end $$;

revoke all on function public.whatsapp_radar_processar(text,text,text,text,timestamptz,text,boolean),
  public.whatsapp_radar_mensagem_com_contexto(text,text),
  public.whatsapp_radar_evento(text,text,text,text,timestamptz,text),
  public.whatsapp_radar_resultado_enviado(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.whatsapp_radar_evento(text,text,text,text,timestamptz,text),
  public.whatsapp_radar_mensagem_com_contexto(text,text),
  public.whatsapp_radar_resultado_enviado(uuid,text) to service_role;
