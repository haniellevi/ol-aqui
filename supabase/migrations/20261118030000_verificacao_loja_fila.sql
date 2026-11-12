-- Fila da IA da verificação de lojas: chaves de configuração, reserva com orçamento no livro-caixa do robô,
-- decisão final numa função só e agendamento (mesmo desenho da moderação por IA).

-- O livro-caixa do robô passa a aceitar o tipo 'verificacao' (mantém os tipos já existentes).
alter table public.robo_uso drop constraint robo_uso_tipo_check;
alter table public.robo_uso add constraint robo_uso_tipo_check
  check (tipo in ('conversa', 'foto', 'teste', 'moderacao', 'categorizacao', 'melhoria', 'verificacao'));

-- robo_uso.id é bigint: a coluna do pedido que guarda a linha do livro-caixa precisa ser do mesmo tipo.
alter table public.verificacoes_loja drop column uso_id;
alter table public.verificacoes_loja add column uso_id bigint references public.robo_uso(id) on delete set null;

-- Tudo desligado de fábrica. ia_ligada_em null com ia_ativa true = a equipe revisa tudo.
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('verificacao.ia_ativa', 'false', 'verificacao', false, 'Liga a conferência automática (IA) dos pedidos de verificação de loja. Desligada, tudo vai para a equipe.'),
  ('verificacao.ia_ligada_em', 'null', 'verificacao', false, 'Data em que a conferência automática foi ligada (texto de data). Vazia com a IA ligada: a equipe revisa todas as aprovações.'),
  ('verificacao.amostra', '10', 'verificacao', false, 'Depois do período de revisão total, 1 em cada N aprovações da IA fica para a equipe conferir.'),
  ('verificacao.dias_revisao_total', '14', 'verificacao', false, 'Dias, depois de ligar a IA, em que a equipe confere todas as aprovações.'),
  ('verificacao.prazo_equipe_horas', '24', 'verificacao', false, 'Prazo, em horas, para a equipe decidir um pedido encaminhado.'),
  ('verificacao.whatsapp_equipe', 'false', 'verificacao', false, 'Avisa a equipe por WhatsApp quando um pedido é encaminhado.'),
  ('verificacao.whatsapp_loja', 'false', 'verificacao', false, 'Avisa a loja por WhatsApp quando o pedido é decidido.')
on conflict do nothing;

-- Quanto reservar no orçamento por pedido: US$ 0,10 cobre um comprovante e uma fachada com folga.

-- ---------------------------------------------------------------------
-- 1. Reservar pedidos para a IA (só o servidor)
-- ---------------------------------------------------------------------
create function public.verificacao_loja_reservar()
returns table (id uuid, reserva uuid, cnpj text, comprovante text, tipo_comprovante text, fachada text, tipo_fachada text,
               loja_nome text, cidade text, endereco text, cnpj_em_outra_loja boolean)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  r public.verificacoes_loja;
  loja public.vitrines_lojas;
  horas numeric;
  prazo interval;
  cot numeric; orc numeric; gasto numeric; reserva_custo numeric;
  uid bigint; token uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  -- A mesma trava e o mesmo livro-caixa do Aki e da moderação.
  perform pg_advisory_xact_lock(hashtext('robo_uso:orcamento'));

  horas := coalesce(public.numero_ou_nulo(public.config('verificacao.prazo_equipe_horas', null, '24'::jsonb)), 24);
  if horas < 1 or horas > 720 then horas := 24; end if;
  prazo := make_interval(hours => horas::int);

  -- Uma análise interrompida não é refeita (pode ter sido cobrada): vai para a equipe. A reserva fica no livro-caixa.
  update public.verificacoes_loja v
     set status = 'equipe', motivos_equipe = '{ia_falhou}', encaminhada_em = now(), prazo_em = now() + prazo
   where v.status = 'analisando' and v.iniciado_em < now() - interval '10 minutes';

  -- IA desligada: nada é reservado, tudo que espera vai para a equipe.
  if public.config('verificacao.ia_ativa', null, 'false'::jsonb) <> 'true'::jsonb then
    update public.verificacoes_loja v
       set status = 'equipe', motivos_equipe = '{ia_desligada}', encaminhada_em = now(), prazo_em = now() + prazo
     where v.status = 'enviada';
    return;
  end if;

  cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  orc := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null'));

  for r in
    select x.* from public.verificacoes_loja x
     where x.status = 'enviada' and x.proxima_em <= now()
     order by x.criado_em
     limit 2
     for update skip locked
  loop
    select * into loja from public.vitrines_lojas l where l.id = r.vitrine_id;
    reserva_custo := 0.10 * cot * 100;
    select coalesce(sum(u.custo_centavos), 0) into gasto from public.robo_uso u where u.criado_em >= public.robo_inicio('mes');
    if cot is null or cot <= 0 or orc is null or orc < 0 or gasto + reserva_custo > orc then
      update public.verificacoes_loja v
         set status = 'equipe', motivos_equipe = '{ia_sem_orcamento}', encaminhada_em = now(), prazo_em = now() + prazo
       where v.id = r.id;
      continue;
    end if;
    insert into public.robo_uso (usuario_id, microrregiao_id, tipo, provedor, modelo, custo_centavos, cotacao_dolar, erro)
    values (r.perfil_id, loja.microrregiao_id, 'verificacao', 'openrouter', 'openai/gpt-4.1-mini', reserva_custo, cot, 'em_andamento')
    returning robo_uso.id into uid;
    token := gen_random_uuid();
    update public.verificacoes_loja v
       set status = 'analisando', reserva = token, iniciado_em = now(), uso_id = uid
     where v.id = r.id;
    return query
      select r.id, token, r.cnpj,
             replace(encode(r.comprovante, 'base64'), chr(10), ''), r.tipo_comprovante,
             case when r.fachada is not null then replace(encode(r.fachada, 'base64'), chr(10), '') end, r.tipo_fachada,
             loja.nome, loja.cidade, loja.endereco,
             (exists (select 1 from public.vitrines_lojas o where o.id <> r.vitrine_id and o.cnpj = r.cnpj)
              or exists (select 1 from public.verificacoes_loja o
                          where o.cnpj = r.cnpj and o.vitrine_id <> r.vitrine_id
                            and o.status in ('aprovada', 'equipe', 'revisao_amostra')));
  end loop;
  return;
end $$;

-- ---------------------------------------------------------------------
-- 2. A cidade do CNPJ está na microrregião da loja? (p_id = id do pedido)
-- ---------------------------------------------------------------------
create function public.verificacao_loja_cidade_na_regiao(p_id uuid, p_ibge integer)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare regiao uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_ibge is null then return null; end if;
  select l.microrregiao_id into regiao
    from public.verificacoes_loja v join public.vitrines_lojas l on l.id = v.vitrine_id
   where v.id = p_id;
  if regiao is null then return null; end if;
  return exists (select 1 from public.cidades c where c.microrregiao_id = regiao and c.codigo_ibge = p_ibge);
end $$;

-- ---------------------------------------------------------------------
-- 3. Esta aprovação precisa ser conferida pela equipe?
-- ---------------------------------------------------------------------
create function public.verificacao_loja_precisa_revisao()
returns boolean language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  ativa boolean;
  bruto jsonb;
  ligada timestamptz;
  dias numeric; amostra numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  ativa := public.config('verificacao.ia_ativa', null, 'false'::jsonb) = 'true'::jsonb;
  bruto := public.config('verificacao.ia_ligada_em', null, 'null'::jsonb);
  begin
    ligada := case when jsonb_typeof(bruto) = 'string' then (bruto #>> '{}')::timestamptz end;
  exception when others then
    ligada := null;
  end;
  -- IA ligada sem data (ou data ilegível): na dúvida, a equipe revisa tudo.
  if ativa and ligada is null then return true; end if;
  dias := coalesce(public.numero_ou_nulo(public.config('verificacao.dias_revisao_total', null, '14'::jsonb)), 14);
  if ligada is not null and now() < ligada + make_interval(days => greatest(dias, 0)::int) then return true; end if;
  amostra := coalesce(public.numero_ou_nulo(public.config('verificacao.amostra', null, '10'::jsonb)), 10);
  return random() < 1.0 / greatest(amostra, 1);
end $$;

-- ---------------------------------------------------------------------
-- 4. Resultado da conferência (só o servidor). Devolve o status final.
-- ---------------------------------------------------------------------
create function public.verificacao_loja_concluir(
  p_id uuid, p_reserva uuid, p_decisao text, p_motivo text, p_motivos_equipe text[], p_parecer jsonb,
  p_custo_usd numeric, p_tokens_entrada integer, p_tokens_saida integer
)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  vid uuid;
  v public.verificacoes_loja;
  l public.vitrines_lojas;
  ident text;
  decisao text := p_decisao;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_motivos text[];
  v_parecer jsonb;
  horas numeric;
  prazo interval;
  recusas integer;
  fim text;
  duplicado boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  -- Ordem de trava igual à do envio: loja primeiro, pedido depois.
  select x.vitrine_id into vid from public.verificacoes_loja x where x.id = p_id;
  if vid is null then return 'ignorado'; end if;
  select * into l from public.vitrines_lojas x where x.id = vid for update;
  select * into v from public.verificacoes_loja x where x.id = p_id for update;
  if v.id is null or v.status <> 'analisando' or v.reserva is distinct from p_reserva then return 'ignorado'; end if;

  -- Livro-caixa: custo ausente ou fora do limite mantém a reserva (pode ter sido cobrado).
  update public.robo_uso u set
    custo_centavos = case when p_custo_usd >= 0 and p_custo_usd <= 0.10 then round(p_custo_usd * u.cotacao_dolar * 100, 4) else u.custo_centavos end,
    tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0),
    tokens_saida = greatest(coalesce(p_tokens_saida, 0), 0),
    erro = case when p_custo_usd >= 0 and p_custo_usd <= 0.10 then null else 'custo_indeterminado' end
   where u.id = v.uso_id;

  horas := coalesce(public.numero_ou_nulo(public.config('verificacao.prazo_equipe_horas', null, '24'::jsonb)), 24);
  if horas < 1 or horas > 720 then horas := 24; end if;
  prazo := make_interval(hours => horas::int);

  v_parecer := case when jsonb_typeof(p_parecer) = 'array' and jsonb_array_length(p_parecer) <= 20 then p_parecer else '[]'::jsonb end;

  -- O cadastro ou a revisão da loja mudaram depois do envio: o pedido não vale mais.
  ident := md5(concat_ws('|', coalesce(l.cidade, ''), coalesce(l.bairro, ''), coalesce(l.endereco, ''),
                         coalesce(l.whatsapp, ''), coalesce(l.microrregiao_id::text, ''), v.cnpj));
  if ident is distinct from v.identidade or l.verificacao_revisao is distinct from v.revisao_loja or l.status <> 'ativa' then
    update public.verificacoes_loja x
       set status = 'obsoleta', motivo = 'dados_mudaram', parecer = v_parecer, decidido_em = now(),
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where x.id = v.id;
    -- Só pede correção se a loja ainda espera esta análise; decisão da equipe no meio não é desfeita.
    if l.status = 'ativa' and l.verificacao_estado = 'pendente' then
      perform public.verificacao_loja_definir(l.id, 'correcao', 'dados_mudaram', 'verificacao_ia_correcao', null, null);
    end if;
    return 'obsoleta';
  end if;

  -- Entradas fora do combinado nunca aprovam: vão para a equipe.
  if decisao is null or decisao not in ('aprovar', 'pedir_novo', 'recusar', 'equipe') then
    decisao := 'equipe'; v_motivos := '{ia_falhou}';
  end if;
  if decisao in ('pedir_novo', 'recusar')
     and (v_motivo is null or v_motivo not in ('arquivo_ilegivel', 'comprovante_invalido', 'cnpj_inativo', 'cnpj_nao_encontrado', 'dados_mudaram')) then
    decisao := 'equipe'; v_motivos := '{ia_falhou}';
  end if;

  -- 3ª recusa em 24 h da mesma loja: a equipe decide.
  if decisao in ('pedir_novo', 'recusar') then
    select count(*) into recusas from public.verificacoes_loja x
     where x.vitrine_id = v.vitrine_id and x.id <> v.id and x.decidido_por is null
       and x.status in ('correcao', 'recusada') and x.decidido_em >= now() - interval '24 hours';
    if recusas >= 2 then decisao := 'equipe'; v_motivos := '{terceira_recusa}'; end if;
  end if;

  if decisao = 'equipe' and v_motivos is null then
    select coalesce(array_agg(m order by m), '{}') into v_motivos
      from (select distinct m from unnest(coalesce(p_motivos_equipe, '{}')) m
             where m in ('ia_duvida', 'ia_falhou', 'ia_desligada', 'ia_sem_orcamento', 'nome_diferente', 'endereco_diferente',
                         'cnpj_duplicado', 'cidade_fora_da_regiao', 'receita_fora_do_ar', 'fachada_estranha', 'terceira_recusa')) s;
    if cardinality(v_motivos) = 0 then v_motivos := '{ia_falhou}'; end if;
  end if;

  -- Receita fora do ar: tenta de novo daqui a 10 minutos; na 3ª falha segue para a equipe.
  if decisao = 'equipe' and v_motivos = '{receita_fora_do_ar}' and v.tentativas_receita < 2 then
    update public.verificacoes_loja x
       set status = 'enviada', tentativas_receita = x.tentativas_receita + 1, proxima_em = now() + interval '10 minutes',
           reserva = null, uso_id = null, iniciado_em = null
     where x.id = v.id;
    return 'repetir';
  end if;

  if decisao = 'aprovar' then
    -- Grava o CNPJ ANTES da decisão: gravar reabre a verificação, e a decisão abaixo fecha de novo.
    perform pg_advisory_xact_lock(hashtext('verificacao_cnpj:' || v.cnpj));
    if exists (select 1 from public.vitrines_lojas o where o.id <> l.id and o.cnpj = v.cnpj) then
      duplicado := true;
    else
      begin
        update public.vitrines_lojas set cnpj = v.cnpj where id = l.id and cnpj is distinct from v.cnpj;
      exception when unique_violation then
        duplicado := true;
      end;
    end if;
    if duplicado then
      decisao := 'equipe'; v_motivos := '{cnpj_duplicado}';
    end if;
  end if;

  if decisao = 'aprovar' then
    perform public.verificacao_loja_definir(l.id, 'aprovada', null, 'verificacao_ia_aprovada', null, null);
    if public.verificacao_loja_precisa_revisao() then
      update public.verificacoes_loja x
         set status = 'revisao_amostra', amostra = true, prazo_em = now() + interval '7 days', parecer = v_parecer,
             motivo = null, decidido_em = now(), reserva = null
       where x.id = v.id;
      return 'revisao_amostra';
    end if;
    update public.verificacoes_loja x
       set status = 'aprovada', amostra = false, parecer = v_parecer, motivo = null, decidido_em = now(), reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where x.id = v.id;
    return 'aprovada';
  elsif decisao = 'pedir_novo' or decisao = 'recusar' then
    fim := case when decisao = 'pedir_novo' then 'correcao' else 'recusada' end;
    update public.verificacoes_loja x
       set status = fim, motivo = v_motivo, parecer = v_parecer, decidido_em = now(), reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where x.id = v.id;
    perform public.verificacao_loja_definir(l.id, fim, v_motivo,
      case when decisao = 'pedir_novo' then 'verificacao_ia_correcao' else 'verificacao_ia_recusada' end, null, null);
    return fim;
  end if;

  update public.verificacoes_loja x
     set status = 'equipe', motivos_equipe = v_motivos, parecer = v_parecer, encaminhada_em = now(), prazo_em = now() + prazo, reserva = null
   where x.id = v.id;
  return 'equipe';
end $$;

-- ---------------------------------------------------------------------
-- 5. Agendamento: a cada minuto, chama a rota quando há pedido esperando.
-- ---------------------------------------------------------------------
-- Em Supabase as extensões existem; no Postgres isolado dos testes não.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

-- Usa o mesmo segredo da moderação (MODERACAO_IA_SECRET no servidor, olaki_moderacao_ia_token no Vault).
create function public.verificacao_loja_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; pedido bigint;
begin
  if not exists (select 1 from public.verificacoes_loja v where v.status = 'enviada' and v.proxima_em <= now())
     and not exists (select 1 from public.verificacoes_loja v where v.status = 'analisando' and v.iniciado_em < now() - interval '10 minutes') then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/verificacao-loja',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 120000) into pedido;
  return pedido;
end $$;

revoke all on function public.verificacao_loja_reservar(), public.verificacao_loja_cidade_na_regiao(uuid, integer),
  public.verificacao_loja_precisa_revisao(),
  public.verificacao_loja_concluir(uuid, uuid, text, text, text[], jsonb, numeric, integer, integer),
  public.verificacao_loja_disparar()
  from public, anon, authenticated, service_role;
grant execute on function public.verificacao_loja_reservar(), public.verificacao_loja_cidade_na_regiao(uuid, integer),
  public.verificacao_loja_precisa_revisao(),
  public.verificacao_loja_concluir(uuid, uuid, text, text, text[], jsonb, numeric, integer, integer),
  public.verificacao_loja_disparar()
  to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-verificacao-loja', '* * * * *', 'select public.verificacao_loja_disparar()');
  end if;
end $$;
