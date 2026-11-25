-- Retenção aprovada: idade civil maior que 180 dias em Fortaleza.
-- Instalação só define função/job. Não executa limpeza nem reclassifica histórico.
create function public.medicao_limpar_opcionais()
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'America/Fortaleza'
as $$
declare
  hoje date := (now() at time zone 'America/Fortaleza')::date;
  corte timestamptz := (hoje - 180)::timestamp at time zone 'America/Fortaleza';
  seguro date;
  visitas bigint := 0; buscas bigint := 0; anuncios bigint := 0;
  lojas bigint := 0; aparicoes bigint := 0; celulas bigint := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('olaki:medicao:retencao', 0)) then
    return jsonb_build_object('ocupado', true);
  end if;
  -- Coortes explícitas dispensam inferência pela janela de implantação.
  delete from public.visitas where coorte = 'consentida_v1' and criado_em < corte;
  get diagnostics visitas = row_count;
  delete from public.buscas_faixas_dia where coorte = 'consentida_v1' and dia < hoje - 180;
  get diagnostics buscas = row_count;

  -- Fontes sem coorte: só dias inteiros comprovadamente posteriores à transição.
  -- Sem rollout válido, nenhum desses eventos/agregados é elegível.
  select greatest((m.inicio at time zone 'America/Fortaleza')::date,
                  (m.aplicacao_fim at time zone 'America/Fortaleza')::date) + 1
    into seguro from public.metricas_marcos m
   where m.codigo = 'consentida_v1' and isfinite(m.inicio)
     and isfinite(m.aplicacao_inicio) and isfinite(m.aplicacao_fim)
     and m.aplicacao_inicio <= m.aplicacao_fim and m.aplicacao_fim <= now();
  if seguro is not null then
    delete from public.eventos_anuncio
     where tipo in ('visualizacao', 'clique_whatsapp', 'compartilhar')
       and criado_em >= seguro::timestamp at time zone 'America/Fortaleza' and criado_em < corte;
    get diagnostics anuncios = row_count;
    delete from public.eventos_loja
     where criado_em >= seguro::timestamp at time zone 'America/Fortaleza' and criado_em < corte;
    get diagnostics lojas = row_count;
    delete from public.anuncios_aparicoes_dia where dia >= seguro and dia < hoje - 180;
    get diagnostics aparicoes = row_count;
    -- A linha também guarda favoritos. Preservar o fato e limpar só células opcionais.
    update public.anuncios_numeros_dia n
       set aparicoes = 0, soma_posicao = 0, visualizacoes = 0,
           cliques_whatsapp = 0, compartilhamentos = 0
     where n.dia >= seguro and n.dia < hoje - 180
       and (n.aparicoes <> 0 or n.soma_posicao <> 0 or n.visualizacoes <> 0
            or n.cliques_whatsapp <> 0 or n.compartilhamentos <> 0);
    get diagnostics celulas = row_count;
  end if;
  return jsonb_build_object('ocupado', false, 'dia', hoje, 'dias', 180, 'desde_seguro', seguro,
    'visitas', visitas, 'buscas', buscas, 'eventos_anuncio', anuncios,
    'eventos_loja', lojas, 'aparicoes', aparicoes, 'linhas_com_celulas_limpas', celulas);
end $$;
revoke all on function public.medicao_limpar_opcionais() from public, anon, authenticated;
grant execute on function public.medicao_limpar_opcionais() to service_role;
comment on function public.medicao_limpar_opcionais() is
  'Limpeza diária: idade civil >180 em Fortaleza. Preserva legado, dia misto, favoritos e fatos; fontes sem coorte aguardam rollout confirmado.';

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC', 'Etc/UTC') then
      raise exception 'Conferir fuso do pg_cron antes de instalar a retenção (agenda esperada UTC).';
    end if;
    if exists (select 1 from cron.job where jobname = 'olaki-medicao-retencao') then
      raise exception 'Job de retenção já existe: reconciliar sem sobrescrever.';
    end if;
    perform cron.schedule('olaki-medicao-retencao', '15 6 * * *', 'select public.medicao_limpar_opcionais()');
  else
    raise notice 'pg_cron ausente: limpeza definida, agendamento pendente. Não habilitar coleta sem agendar.';
  end if;
end $$;
