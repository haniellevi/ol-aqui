-- Reconferência mensal do CNPJ na Receita: data da última conferência, reserva das lojas vencidas,
-- registro do resultado (selo sai se o CNPJ não está ativo) e agendamento diário.

alter table public.vitrines_lojas add column cnpj_conferido_em timestamptz;

-- ---------------------------------------------------------------------
-- 1. A aprovação (IA ou equipe) passa a registrar a data da conferência do CNPJ.
--    Mesmas assinaturas e retornos das versões anteriores; só ganham a linha do cnpj_conferido_em.
-- ---------------------------------------------------------------------
create or replace function public.verificacao_loja_concluir(
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
    update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
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

create or replace function public.admin_decidir_verificacao_loja(p_id uuid, p_decisao text, p_motivo text, p_conferido boolean)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  vid uuid;
  l public.vitrines_lojas;
  v public.verificacoes_loja;
  ator text;
  v_motivo text := nullif(btrim(p_motivo), '');
  mudou constant text := 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.';
  ident text;
  estado text;
  acao text;
  atual boolean;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode decidir o pedido.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'correcao', 'recusar', 'confirmar', 'tirar_selo') then
    raise exception 'Escolha uma decisão válida.' using errcode = '22023';
  end if;
  ator := public.usuario_id();

  -- Mesma ordem de trava do envio e da IA: loja primeiro, pedido depois.
  select x.vitrine_id into vid from public.verificacoes_loja x where x.id = p_id;
  if vid is null then raise exception '%', mudou using errcode = 'P0001'; end if;
  select * into l from public.vitrines_lojas x where x.id = vid and x.tipo = 'loja' for update;
  if not found then raise exception 'Loja não encontrada.' using errcode = '22023'; end if;
  select * into v from public.verificacoes_loja x where x.id = p_id for update;

  -- Outro da equipe (ou a rotina) pode ter decidido antes: o pedido precisa estar no status que esta decisão espera.
  if v.status is distinct from (case when p_decisao in ('aprovar', 'correcao', 'recusar') then 'equipe' else 'revisao_amostra' end) then
    raise exception '%', mudou using errcode = 'P0001';
  end if;

  if p_decisao in ('correcao', 'recusar', 'tirar_selo')
     and (v_motivo is null or v_motivo not in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro',
                                           'arquivo_ilegivel', 'comprovante_invalido', 'cnpj_inativo', 'cnpj_nao_encontrado', 'dados_mudaram')) then
    raise exception 'Escolha o motivo da decisão.' using errcode = '23514';
  end if;

  if p_decisao = 'aprovar' then
    if p_conferido is not true then
      raise exception 'Confirme que você conferiu o comprovante antes de aprovar.' using errcode = '23514';
    end if;
    -- O cadastro precisa ser o mesmo que foi enviado (aprovar dados que mudaram seria aprovar outra coisa).
    ident := md5(concat_ws('|', coalesce(l.cidade, ''), coalesce(l.bairro, ''), coalesce(l.endereco, ''),
                           coalesce(l.whatsapp, ''), coalesce(l.microrregiao_id::text, ''), v.cnpj));
    if ident is distinct from v.identidade or l.verificacao_revisao is distinct from v.revisao_loja or l.status <> 'ativa' then
      raise exception '%', mudou using errcode = 'P0001';
    end if;
    if not public.whatsapp_confirmado(l.dono_id) then
      raise exception 'A conta da loja precisa confirmar o WhatsApp antes da aprovação.' using errcode = '23514';
    end if;
    -- Grava o CNPJ ANTES da decisão (gravar reabre a verificação; a decisão abaixo fecha de novo), sem repetir o de outra loja.
    perform pg_advisory_xact_lock(hashtext('verificacao_cnpj:' || v.cnpj));
    if exists (select 1 from public.vitrines_lojas o where o.id <> l.id and o.cnpj = v.cnpj) then
      raise exception 'Este CNPJ já está em outra loja. Peça a correção ou recuse.' using errcode = '23514';
    end if;
    begin
      update public.vitrines_lojas set cnpj = v.cnpj where id = l.id and cnpj is distinct from v.cnpj;
    exception when unique_violation then
      raise exception 'Este CNPJ já está em outra loja. Peça a correção ou recuse.' using errcode = '23514';
    end;
    perform public.verificacao_loja_definir(l.id, 'aprovada', null, 'verificacao_aprovada', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'equipe'));
    update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
    update public.verificacoes_loja
       set status = 'aprovada', motivo = null, decidido_em = now(), decidido_por = ator, reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;

  elsif p_decisao in ('correcao', 'recusar') then
    -- Cadastro que mudou não impede pedir correção nem recusar: senão o pedido ficaria preso na fila.
    estado := case when p_decisao = 'correcao' then 'correcao' else 'recusada' end;
    acao := case when p_decisao = 'correcao' then 'verificacao_correcao' else 'verificacao_recusada' end;
    update public.verificacoes_loja
       set status = estado, motivo = v_motivo, decidido_em = now(), decidido_por = ator, reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;
    perform public.verificacao_loja_definir(l.id, estado, v_motivo, acao, ator, jsonb_build_object('pedido', v.id, 'origem', 'equipe'));

  elsif p_decisao = 'confirmar' then
    -- A aprovação da IA só se confirma enquanto o selo ainda vale.
    atual := l.selo_loja_verificada and l.verificacao_estado = 'aprovada';
    if not atual then raise exception '%', mudou using errcode = 'P0001'; end if;
    perform public.verificacao_loja_definir(l.id, 'aprovada', null, 'verificacao_revisada', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'amostra'));
    update public.verificacoes_loja
       set status = 'aprovada', decidido_em = now(), decidido_por = ator, reserva = null,
           parecer = parecer || jsonb_build_array(jsonb_build_object('item', 'revisao_humana', 'ok', true)),
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;

  else  -- tirar_selo
    atual := l.selo_loja_verificada and l.verificacao_estado = 'aprovada';
    if not atual then raise exception '%', mudou using errcode = 'P0001'; end if;
    -- O pedido muda de status aqui: o gatilho do WhatsApp/sino já avisa a loja ("falta algo"). A equipe ganha só o aviso da lista.
    update public.verificacoes_loja
       set status = 'correcao', motivo = v_motivo, decidido_em = now(), decidido_por = ator, reserva = null,
           parecer = parecer || jsonb_build_array(jsonb_build_object('item', 'revisao_humana', 'ok', false, 'nota', 'selo removido')),
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;
    perform public.verificacao_loja_definir(l.id, 'correcao', v_motivo, 'verificacao_selo_removido', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'amostra'));
    insert into public.verificacao_loja_avisos (vitrine_id, tipo, detalhe)
    values (l.id, 'amostra_erro', jsonb_build_object('pedido', v.id, 'motivo', v_motivo))
    on conflict (vitrine_id, tipo) where resolvido_em is null do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Lojas com selo cujo CNPJ nunca foi conferido ou foi há mais de 30 dias (mais antigas primeiro)
-- ---------------------------------------------------------------------
create function public.verificacao_loja_reconferir_reservar(p_limite integer default 30)
returns table (vitrine_id uuid, cnpj text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  return query
  select l.id, l.cnpj
    from public.vitrines_lojas l
   where l.tipo = 'loja' and l.selo_loja_verificada and l.cnpj is not null
     and (l.cnpj_conferido_em is null or l.cnpj_conferido_em < now() - interval '30 days')
   order by l.cnpj_conferido_em asc nulls first, l.id
   limit greatest(least(coalesce(p_limite, 30), 100), 1);
end $$;

-- ---------------------------------------------------------------------
-- 3. Resultado da consulta. Receita fora do ar não chega aqui (nada muda).
-- ---------------------------------------------------------------------
create function public.verificacao_loja_reconferir_registrar(p_vitrine uuid, p_cnpj text, p_resultado text, p_situacao text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  l public.vitrines_lojas;
  rev integer;
  situacao text := left(nullif(btrim(p_situacao), ''), 60);
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_resultado is null or p_resultado not in ('ativa', 'inativa', 'nao_encontrada') then
    raise exception 'Resultado inválido.' using errcode = '22023';
  end if;
  select * into l from public.vitrines_lojas x where x.id = p_vitrine and x.tipo = 'loja' for update;
  -- Loja sumiu ou já sem selo (a equipe tirou no meio): nada a fazer.
  if not found or not l.selo_loja_verificada then return; end if;
  -- Resultado de um CNPJ antigo (a loja trocou de CNPJ e foi aprovada de novo no meio da rodada): não vale.
  if l.cnpj is distinct from p_cnpj then return; end if;

  if p_resultado = 'ativa' then
    update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
    return;
  end if;

  perform public.verificacao_loja_definir(l.id, 'recusada', 'cnpj_inativo', 'verificacao_selo_removido', null,
    jsonb_build_object('origem', 'receita', 'resultado', p_resultado, 'situacao', situacao));
  update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
  select x.verificacao_revisao into rev from public.vitrines_lojas x where x.id = l.id;

  insert into public.verificacao_loja_avisos (vitrine_id, tipo, detalhe)
  values (l.id, 'receita_inativa', jsonb_build_object('resultado', p_resultado, 'situacao', situacao))
  on conflict (vitrine_id, tipo) where resolvido_em is null do nothing;

  -- A mudança de estado da loja não passa pelo gatilho dos pedidos: os dois avisos saem daqui, uma vez cada.
  perform public.verificacao_avisar_loja(l.id, 'verificacao_selo_removido', '{}'::jsonb, 'verificacao_selo_removido:' || l.id || ':' || rev);
  perform public.verificacao_avisar_equipe('verificacao_equipe_chamada',
    jsonb_build_object('loja', l.nome, 'cidade', coalesce(l.cidade, ''), 'motivo', 'selo removido, CNPJ não está ativo na Receita'),
    'verificacao_selo_removido_equipe:' || l.id || ':' || rev);
end $$;

-- ---------------------------------------------------------------------
-- 4. Agendamento: todo dia às 09:00 UTC, chama a rota quando há loja vencida.
-- ---------------------------------------------------------------------
create function public.verificacao_loja_reconferir_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; pedido bigint;
begin
  if not exists (select 1 from public.vitrines_lojas l
                  where l.tipo = 'loja' and l.selo_loja_verificada and l.cnpj is not null
                    and (l.cnpj_conferido_em is null or l.cnpj_conferido_em < now() - interval '30 days')) then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/verificacao-loja-reconferir',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 300000) into pedido;
  return pedido;
end $$;

revoke all on function public.verificacao_loja_concluir(uuid, uuid, text, text, text[], jsonb, numeric, integer, integer),
  public.admin_decidir_verificacao_loja(uuid, text, text, boolean),
  public.verificacao_loja_reconferir_reservar(integer), public.verificacao_loja_reconferir_registrar(uuid, text, text, text),
  public.verificacao_loja_reconferir_disparar()
  from public, anon, authenticated, service_role;
grant execute on function public.verificacao_loja_concluir(uuid, uuid, text, text, text[], jsonb, numeric, integer, integer),
  public.verificacao_loja_reconferir_reservar(integer), public.verificacao_loja_reconferir_registrar(uuid, text, text, text),
  public.verificacao_loja_reconferir_disparar() to service_role;
grant execute on function public.admin_decidir_verificacao_loja(uuid, text, text, boolean) to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-verificacao-reconferir', '0 9 * * *', 'select public.verificacao_loja_reconferir_disparar()');
  end if;
end $$;
