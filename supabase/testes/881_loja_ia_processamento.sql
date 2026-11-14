begin;
insert into public.perfis(id,microrregiao_id,nome,cidade)
select 'user_lojaia881', id, 'Loja teste IA', 'Corrente' from public.microrregioes where slug='corrente-pi';
set local role authenticated;
set local request.jwt.claim.sub='user_lojaia881';

do $$
declare r jsonb;
begin
  r := public.loja_ia_abrir_coleta();
  begin
    perform public.loja_ia_iniciar((r->>'id')::uuid, 0);
    raise exception 'Iniciou sem fonte nem descrição';
  exception when invalid_parameter_value then null; end;
  r := public.loja_ia_salvar_coleta((r->>'id')::uuid, 0,
    '{"nome":"Loja teste IA","cidade":"Corrente","materiais":[],"site":"https://example.com","consultarWhatsapp":false,"avisarWhatsapp":false}');
  r := public.loja_ia_iniciar((r->>'id')::uuid, 1);
  assert r->>'estado' = 'processando', 'Início do processamento';
  assert public.loja_ia_iniciar((r->>'id')::uuid,1) = r, 'Clique repetido';
  begin
    perform public.loja_ia_pegar(1);
    raise exception 'Conta comum pegou trabalho';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$
declare t record; antigo uuid; r public.loja_ia_rascunhos;
begin
  select * into t from public.loja_ia_pegar(1);
  assert t.fonte = 'informado','Dados informados têm precedência';
  perform public.loja_ia_concluir_fonte(t.id,t.tentativa,'{"estado":"ok","evidencias":[]}');
  select * into t from public.loja_ia_pegar(1);
  antigo := t.tentativa;
  update public.loja_ia_trabalhos set reserva_ate=now()-interval '1 minute' where id=t.id;
  select * into t from public.loja_ia_pegar(1);
  assert t.tentativa <> antigo, 'Retoma reserva vencida';
  assert not public.loja_ia_concluir_fonte(t.id, antigo, '{"estado":"indisponivel","motivo":"Fonte indisponível."}'), 'Tentativa antiga vedada';
  assert public.loja_ia_concluir_fonte(t.id, t.tentativa, '{"estado":"indisponivel","motivo":"Fonte indisponível."}'), 'Falha isolada';
  select * into t from public.loja_ia_pegar(1);
  assert t.fonte = 'merc', 'Merc executa por último';
  perform public.loja_ia_concluir_fonte(t.id, t.tentativa, '{"estado":"indisponivel","motivo":"Merc indisponível."}');
  select * into r from public.loja_ia_rascunhos where dono_id='user_lojaia881';
  assert r.estado='pronto' and r.campos#>>'{nome,valor}'='Loja teste IA', 'Falha de fontes ainda abre revisão';
end $$;

set local role authenticated;
do $$
declare r jsonb := public.loja_ia_obter();
begin
  r := public.loja_ia_salvar_revisao((r->>'id')::uuid,(r->>'revisao')::int,'{"sobre":null}');
  assert (r#>>'{campos,sobre,editado}')::boolean, 'Remoção vira edição explícita';
  r := public.loja_ia_retentar_fonte((r->>'id')::uuid,'site');
  assert r->>'estado'='pronto', 'Revisão continua disponível';
end $$;
reset role;
do $$
declare t record; r public.loja_ia_rascunhos;
begin
  select * into t from public.loja_ia_pegar(1);
  assert t.fonte='site', 'Só a fonte escolhida foi reaberta';
  perform public.loja_ia_concluir_fonte(t.id,t.tentativa,'{"estado":"ok","evidencias":[{"id":"site:sobre","campo":"sobre","valor":"Nova descrição","origem":{"fonte":"site","rotulo":"Site","url":"https://example.com/"}}]}');
  select * into t from public.loja_ia_pegar(1);
  perform public.loja_ia_concluir_fonte(t.id,t.tentativa,'{"estado":"ok","sugestoes":[{"campo":"sobre","valor":"Uma sugestão","origem":{"fonte":"site","rotulo":"Site","url":"https://example.com/"}}]}');
  select * into r from public.loja_ia_rascunhos where dono_id='user_lojaia881';
  assert r.campos#>'{sobre,valor}'='null'::jsonb and r.campos#>>'{sobre,sugestao,valor}'='Uma sugestão', 'Conclusão não sobrescreve campo limpo';
end $$;
rollback;
