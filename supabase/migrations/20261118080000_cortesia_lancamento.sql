-- Cortesia de lançamento do Radar (30 dias) para quem já paga mas ainda não tem o selo.
-- O Radar v2 só deixa atender quem é verificado e paga. Quem pagava antes ficaria de fora de um dia para o outro:
-- esta migração dá, UMA vez, 30 dias de Radar para lojas e vendedores pessoa física PAGOS e SEM selo.
-- Não mexe em quem já tem selo, em plano de teste ou grátis, nem em vitrine que não está ativa.
-- Usa a tabela radar_cortesias (20261117010000_radar_quem_atende.sql); a cortesia vencida deixa de valer na hora.

-- Concede a cortesia. Idempotente: quem já tem uma linha em radar_cortesias (de qualquer tipo) não é tocado
-- e não recebe aviso nem registro de novo. Devolve quantas cortesias foram criadas.
-- Sem permissão para ninguém da API nem do servidor: só o dono do banco (editor SQL) executa, de propósito,
-- para que ninguém conceda cortesia a lojas que ficaram sem selo depois do lançamento.
create function public.cortesia_lancamento_conceder()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    with novas as (
      insert into public.radar_cortesias (vitrine_id, ate, motivo, criado_por)
      select v.id, now() + interval '30 days', 'Cortesia de lançamento: verifique sua loja em 30 dias', 'sistema'
        from public.vitrines_lojas v
       where v.status = 'ativa'
         and (select p.acesso_radar and not p.e_teste and p.preco_centavos > 0
                from public.plano_efetivo(v) p where p.codigo is not null)
         and not public.pode_atender_radar(v.dono_id)
      on conflict (vitrine_id) do nothing
      returning vitrine_id, ate
    )
    select n2.vitrine_id, n2.ate, v.dono_id, v.tipo
      from novas n2 join public.vitrines_lojas v on v.id = n2.vitrine_id
  loop
    n := n + 1;
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, dados_depois)
    values ('radar_cortesias', r.vitrine_id::text, 'INSERT', null,
            jsonb_build_object('ate', r.ate, 'motivo', 'cortesia_lancamento', 'criado_por', 'sistema'));
    perform public.notificar(
      r.dono_id, 'cortesia_lancamento', 'Radar de cortesia por 30 dias',
      'Você tem 30 dias de Radar de cortesia. Verifique sua loja para continuar.',
      case when r.tipo = 'pf' then '/minha-conta/verificacao' else '/minha-conta/loja/verificar' end,
      'cortesia_lancamento:' || r.vitrine_id,
      jsonb_build_object('vitrine_id', r.vitrine_id, 'ate', r.ate));
  end loop;
  return n;
end $$;

-- Avisa UMA vez quem tem a cortesia de lançamento acabando em até 7 dias e ainda está sem selo.
-- Devolve quantos avisos novos foram criados. chave_unica 'cortesia_fim:<vitrine>' impede repetir.
create function public.verificacao_cortesia_avisar_fim()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select c.vitrine_id, c.ate, v.dono_id, v.tipo
      from public.radar_cortesias c
      join public.vitrines_lojas v on v.id = c.vitrine_id
     where c.criado_por = 'sistema'
       and c.motivo = 'Cortesia de lançamento: verifique sua loja em 30 dias'
       and c.ate > now() and c.ate <= now() + interval '7 days'
       and v.status = 'ativa'
       and not coalesce(case when v.tipo = 'loja' then v.selo_loja_verificada
                             else (select pf.selo_negociador_certificado and pf.verificacao_pf_em is not null
                                     from public.perfis pf where pf.id = v.dono_id) end, false)
  loop
    if public.notificar(
         r.dono_id, 'cortesia_fim', 'Seu Radar de cortesia está acabando',
         'Seu Radar de cortesia acaba em poucos dias. Verifique sua loja para continuar.',
         case when r.tipo = 'pf' then '/minha-conta/verificacao' else '/minha-conta/loja/verificar' end,
         'cortesia_fim:' || r.vitrine_id,
         jsonb_build_object('vitrine_id', r.vitrine_id, 'ate', r.ate)) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.cortesia_lancamento_conceder() from public, anon, authenticated, service_role;
revoke all on function public.verificacao_cortesia_avisar_fim() from public, anon, authenticated;
grant execute on function public.verificacao_cortesia_avisar_fim() to service_role;

-- Cron diário (só onde o pg_cron existe)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-cortesia-fim', '0 12 * * *', 'select public.verificacao_cortesia_avisar_fim()');
  end if;
end $$;

-- A concessão única, no momento da migração.
select public.cortesia_lancamento_conceder();
