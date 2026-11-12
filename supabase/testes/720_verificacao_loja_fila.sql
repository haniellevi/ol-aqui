\set ON_ERROR_STOP on
\set QUIET on
-- Fila da IA da verificação da loja: chaves, reserva com orçamento, decisão final, nova tentativa da Receita,
-- 3ª recusa, cadastro que muda no meio, CNPJ duplicado por corrida e permissões.
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes(slug,nome,cidade_sede) values ('outra-720','Outra região 720','Longe') returning id as outra \gset

create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.png(texto text) returns text language sql as $$ select encode(decode('89504e470d0a1a0a','hex')||convert_to(texto,'UTF8'),'base64') $$;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.vid(n integer) returns uuid language sql as $$ select ('72000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
-- Cria dono + loja e envia o pedido (como o servidor faria); devolve o id do pedido.
create function pg_temp.nova(n integer, p_cnpj text) returns uuid language plpgsql security definer as $$
declare r text;
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_720x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589971'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_720x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-720-'||n, 'Loja 720 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589972'||lpad(n::text,6,'0'), 'loja');
  r := enviar_verificacao_loja('user_720x'||n, p_cnpj, pg_temp.pdf('comprovante '||n), pg_temp.png('fachada '||n));
  if r <> 'enviada' then raise exception 'envio da loja %: %', n, r; end if;
  return (select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc limit 1);
end $$;
create function pg_temp.req(n integer) returns uuid language sql security definer as $$
  select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc, id desc limit 1 $$;
create function pg_temp.pegar(n integer) returns uuid language plpgsql as $$
declare x uuid;
begin
  select r.reserva into x from verificacao_loja_reservar() r where r.id = pg_temp.req(n);
  return x;
end $$;

-- [0] Chaves novas (valores de fábrica) e livro-caixa aceita o tipo novo.
select pg_temp.confere((select valor='false'::jsonb from configuracoes where chave='verificacao.ia_ativa' and microrregiao_id is null), 'ia_ativa começa desligada');
select pg_temp.confere((select valor='null'::jsonb from configuracoes where chave='verificacao.ia_ligada_em' and microrregiao_id is null), 'ia_ligada_em começa nula');
select pg_temp.confere((select valor='10'::jsonb from configuracoes where chave='verificacao.amostra'), 'amostra 10');
select pg_temp.confere((select valor='14'::jsonb from configuracoes where chave='verificacao.dias_revisao_total'), '14 dias');
select pg_temp.confere((select valor='24'::jsonb from configuracoes where chave='verificacao.prazo_equipe_horas'), '24 horas');
select pg_temp.confere((select valor='false'::jsonb from configuracoes where chave='verificacao.whatsapp_equipe'), 'whatsapp_equipe desligado');
select pg_temp.confere((select valor='false'::jsonb from configuracoes where chave='verificacao.whatsapp_loja'), 'whatsapp_loja desligado');
select pg_temp.confere(to_regprocedure('verificacao_loja_disparar()') is not null, 'função que o cron chama existe');

insert into cidades(microrregiao_id,nome,uf,codigo_ibge) values (:'reg','Cidade Teste 720','PI',9990001), (:'outra','Cidade Fora 720','PI',9990002);

-- [1] IA desligada: o pedido vai para a equipe e nada é reservado.
select pg_temp.nova(1, '11222333000101') \gset
select pg_temp.nova(2, '11222333000102') \gset
set local role service_role;
do $$ begin
  assert (select count(*) from verificacao_loja_reservar()) = 0, 'IA desligada não devolve pedidos';
end $$;
reset role;
select pg_temp.confere((select count(*)=2 and bool_and(status='equipe' and motivos_equipe='{ia_desligada}' and encaminhada_em is not null
    and prazo_em between encaminhada_em + interval '23 hours 59 minutes' and encaminhada_em + interval '24 hours 1 minute'
    and comprovante is not null)
  from verificacoes_loja where vitrine_id in (pg_temp.vid(1), pg_temp.vid(2))), 'IA desligada manda para a equipe[ia_desligada] com prazo');

-- [2] IA ligada: reserva, trava e limite de 2 por vez. Orçamento aberto.
update configuracoes set valor='true'::jsonb where chave='verificacao.ia_ativa';
update configuracoes set valor='1000000' where chave='robo.orcamento_mensal_centavos';
update configuracoes set valor='1000000'::jsonb where chave='verificacao.amostra';
update configuracoes set valor=to_jsonb('2020-01-01T00:00:00Z'::text) where chave='verificacao.ia_ligada_em';

select pg_temp.nova(3, '11222333000103') \gset
set local role service_role;
do $$
declare r record;
begin
  select * into r from verificacao_loja_reservar() x where x.id = pg_temp.req(3);
  assert r.id is not null and r.reserva is not null, 'reservou o pedido';
  assert r.cnpj = '11222333000103' and r.tipo_comprovante = 'application/pdf' and r.tipo_fachada = 'image/png', 'dados do pedido';
  assert r.loja_nome = 'Loja 720 3' and r.cidade = 'Corrente' and r.endereco = 'Rua 3', 'dados da loja';
  assert r.comprovante !~ E'[\\n\\r]' and r.fachada !~ E'[\\n\\r]', 'base64 em uma linha só';
  assert convert_from(decode(r.comprovante,'base64'),'UTF8') like '%PDF-1.7 comprovante 3', 'comprovante volta inteiro';
  assert r.cnpj_em_outra_loja is false, 'cnpj livre';
  assert (select count(*) from verificacao_loja_reservar()) = 0, 'analisando não é reservado de novo';
end $$;
reset role;
select pg_temp.confere((select v.status='analisando' and v.reserva is not null and v.iniciado_em is not null and v.uso_id is not null
    and u.tipo='verificacao' and u.erro='em_andamento' and u.custo_centavos>0 and u.usuario_id='user_720x3'
  from verificacoes_loja v join robo_uso u on u.id=v.uso_id where v.vitrine_id=pg_temp.vid(3)), 'pedido analisando com orçamento reservado no livro-caixa');

-- limite de 2 por vez
select pg_temp.nova(4, '11222333000104') \gset
select pg_temp.nova(5, '11222333000105') \gset
select pg_temp.nova(6, '11222333000106') \gset
set local role service_role;
do $$ begin
  assert (select count(*) from verificacao_loja_reservar()) = 2, 'no máximo 2 por vez';
  assert (select count(*) from verificacao_loja_reservar()) = 1, 'o terceiro sai na chamada seguinte';
end $$;
reset role;

-- [3] Aprovar (amostra praticamente desligada, ia_ligada_em antigo): selo e CNPJ gravados, arquivos nulos, ledger fechado.
select pg_temp.nova(7, '11222333000107') \gset
set local role service_role;
select pg_temp.pegar(7) as r7 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(7), gen_random_uuid(), 'aprovar', null, '{}', '[]', 0.004, 300, 60) = 'ignorado', 'reserva errada é ignorada');
select pg_temp.confere(verificacao_loja_concluir(gen_random_uuid(), :'r7', 'aprovar', null, '{}', '[]', 0.004, 300, 60) = 'ignorado', 'pedido desconhecido é ignorado');
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(7), :'r7', 'aprovar', null, '{}', '[{"item":"receita","ok":true}]', 0.004, 300, 60) = 'aprovada', 'aprovar vira aprovada');
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(7), :'r7', 'aprovar', null, '{}', '[]', 0.004, 300, 60) = 'ignorado', 'repetição é ignorada');
reset role;
select pg_temp.confere((select r.status='aprovada' and r.comprovante is null and r.fachada is null and r.tipo_comprovante is null and r.tipo_fachada is null
    and r.amostra is false and r.decidido_em is not null and r.parecer='[{"item":"receita","ok":true}]'::jsonb and r.motivo is null
  from verificacoes_loja r where r.vitrine_id=pg_temp.vid(7)), 'pedido aprovado sem arquivos');
select pg_temp.confere((select v.verificacao_estado='aprovada' and v.selo_loja_verificada and v.cnpj='11222333000107' and v.verificacao_motivo is null
  from vitrines_lojas v where v.id=pg_temp.vid(7)), 'loja aprovada com selo e CNPJ (gravar o CNPJ não deixa a loja pendente)');
select pg_temp.confere((select count(*)=1 from vitrines_acoes_admin where vitrine_id=pg_temp.vid(7) and acao='verificacao_ia_aprovada' and admin_id is null), 'histórico da aprovação automática');
select pg_temp.confere((select u.custo_centavos = round(0.004*u.cotacao_dolar*100,4) and u.tokens_entrada=300 and u.tokens_saida=60 and u.erro is null
  from verificacoes_loja r join robo_uso u on u.id=r.uso_id where r.vitrine_id=pg_temp.vid(7)), 'livro-caixa fechado com custo e tokens');

-- [4] Revisão por amostra: dentro dos 14 dias da data de ligar, aprova mas guarda os arquivos para a equipe conferir.
update configuracoes set valor=to_jsonb(now()::text) where chave='verificacao.ia_ligada_em';
select pg_temp.nova(8, '11222333000108') \gset
set local role service_role;
select pg_temp.pegar(8) as r8 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(8), :'r8', 'aprovar', null, '{}', '[]', 0.001, 10, 5) = 'revisao_amostra', 'aprovar dentro dos 14 dias vai para amostra');
reset role;
select pg_temp.confere((select r.status='revisao_amostra' and r.amostra and r.comprovante is not null and r.fachada is not null
    and r.prazo_em between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
  from verificacoes_loja r where r.vitrine_id=pg_temp.vid(8)), 'amostra guarda arquivos e prazo de 7 dias');
select pg_temp.confere((select v.verificacao_estado='aprovada' and v.selo_loja_verificada and v.cnpj='11222333000108' from vitrines_lojas v where v.id=pg_temp.vid(8)), 'loja da amostra já tem o selo');

-- Regra da ligação: IA ativa sem data de ligar = revisa tudo; data antiga + amostra enorme = quase nunca; amostra 1 = sempre.
set local role service_role;
do $$ begin
  assert verificacao_loja_precisa_revisao() is true, 'dentro dos 14 dias revisa';
end $$;
reset role;
update configuracoes set valor=to_jsonb('2020-01-01T00:00:00Z'::text) where chave='verificacao.ia_ligada_em';
set local role service_role;
do $$ begin
  assert (select count(*) from generate_series(1,200) g where verificacao_loja_precisa_revisao()) = 0, 'passados os 14 dias, amostra 1.000.000 não revisa';
end $$;
reset role;
update configuracoes set valor='1' where chave='verificacao.amostra';
set local role service_role;
do $$ begin
  assert (select count(*) from generate_series(1,50) g where verificacao_loja_precisa_revisao()) = 50, 'amostra 1 revisa sempre';
end $$;
reset role;
update configuracoes set valor='null'::jsonb where chave='verificacao.ia_ligada_em';
update configuracoes set valor='1000000' where chave='verificacao.amostra';
set local role service_role;
do $$ begin
  assert verificacao_loja_precisa_revisao() is true, 'IA ativa sem data de ligar revisa tudo';
end $$;
reset role;
update configuracoes set valor=to_jsonb('2020-01-01T00:00:00Z'::text) where chave='verificacao.ia_ligada_em';

-- [5] Pedir novo, recusar e equipe.
select pg_temp.nova(9, '11222333000109') \gset
set local role service_role;
select pg_temp.pegar(9) as r9 \gset
reset role;
select pg_temp.nova(10, '11222333000110') \gset
set local role service_role;
select pg_temp.pegar(10) as r10 \gset
reset role;
select pg_temp.nova(11, '11222333000111') \gset
set local role service_role;
select pg_temp.pegar(11) as r11 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(9), :'r9', 'pedir_novo', 'arquivo_ilegivel', '{}', '[{"item":"comprovante","ok":false}]', 0, 0, 0) = 'correcao', 'pedir_novo vira correcao');
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(10), :'r10', 'recusar', 'cnpj_inativo', '{}', '[]', 0, 0, 0) = 'recusada', 'recusar vira recusada');
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(11), :'r11', 'equipe', null, '{nome_diferente}', '[{"item":"titular","ok":false}]', 0.002, 100, 20) = 'equipe', 'equipe vira equipe');
reset role;
select pg_temp.confere((select r.status='correcao' and r.motivo='arquivo_ilegivel' and r.comprovante is null and r.fachada is null
    and v.verificacao_estado='correcao' and v.verificacao_motivo='arquivo_ilegivel' and not v.selo_loja_verificada and v.cnpj is null
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.vitrine_id=pg_temp.vid(9)), 'correcao: motivo na loja, arquivos nulos, sem selo');
select pg_temp.confere((select r.status='recusada' and r.motivo='cnpj_inativo' and r.comprovante is null
    and v.verificacao_estado='recusada' and v.verificacao_motivo='cnpj_inativo' and not v.selo_loja_verificada
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.vitrine_id=pg_temp.vid(10)), 'recusada: motivo na loja, arquivos nulos, sem selo');
select pg_temp.confere((select r.status='equipe' and r.motivos_equipe='{nome_diferente}' and r.encaminhada_em is not null and r.comprovante is not null and r.decidido_em is null
    and r.prazo_em between r.encaminhada_em + interval '23 hours 59 minutes' and r.encaminhada_em + interval '24 hours 1 minute'
    and v.verificacao_estado='pendente' and not v.selo_loja_verificada and v.cnpj is null
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.vitrine_id=pg_temp.vid(11)), 'equipe: prazo de 24 h, arquivos mantidos, loja segue pendente');

-- [6] Cadastro muda entre reservar e concluir: pedido obsoleto, sem selo (RF 4).
select pg_temp.nova(12, '11222333000112') \gset
set local role service_role;
select pg_temp.pegar(12) as r12 \gset
reset role;
update vitrines_lojas set endereco='Rua Nova, 999' where id=pg_temp.vid(12);
set local role service_role;
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(12), :'r12', 'aprovar', null, '{}', '[]', 0.001, 1, 1) = 'obsoleta', 'cadastro mudou: obsoleta');
reset role;
select pg_temp.confere((select r.status='obsoleta' and r.motivo='dados_mudaram' and r.comprovante is null and r.fachada is null
    and v.verificacao_estado='correcao' and v.verificacao_motivo='dados_mudaram' and not v.selo_loja_verificada and v.cnpj is null
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.vitrine_id=pg_temp.vid(12)), 'obsoleta: sem selo, loja volta para correção');

-- [7] 3ª recusa em 24 h vai para a equipe; com só 1 recusa antes, recusa normal.
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_720x13',:'reg','Dono 13','Corrente','5589971000013',now()), ('user_720x14',:'reg','Dono 14','Corrente','5589971000014',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo) values
 (pg_temp.vid(13),'user_720x13',:'reg','loja-720-13','Loja 720 13','Corrente','Centro','Rua 13','5589972000013','loja'),
 (pg_temp.vid(14),'user_720x14',:'reg','loja-720-14','Loja 720 14','Corrente','Centro','Rua 14','5589972000014','loja');
insert into verificacoes_loja(vitrine_id,perfil_id,cnpj,identidade,revisao_loja,status,motivo,criado_em,decidido_em) values
 (pg_temp.vid(13),'user_720x13','11222333000113','x',1,'recusada','cnpj_inativo',now()-interval '3 hours',now()-interval '2 hours'),
 (pg_temp.vid(13),'user_720x13','11222333000113','x',1,'correcao','arquivo_ilegivel',now()-interval '2 hours',now()-interval '1 hour'),
 (pg_temp.vid(14),'user_720x14','11222333000114','x',1,'correcao','arquivo_ilegivel',now()-interval '2 hours',now()-interval '1 hour');
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_720x13','11222333000113',pg_temp.pdf('a'),null) = 'enviada';
end $$;
select pg_temp.pegar(13) as r13 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(13), :'r13', 'recusar', 'cnpj_inativo', '{}', '[]', 0, 0, 0) = 'equipe', '3ª recusa em 24 h vai para a equipe');
do $$ begin
  assert enviar_verificacao_loja('user_720x14','11222333000114',pg_temp.pdf('b'),null) = 'enviada';
end $$;
select pg_temp.pegar(14) as r14 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(14), :'r14', 'pedir_novo', 'arquivo_ilegivel', '{}', '[]', 0, 0, 0) = 'correcao', '2ª recusa ainda é correção');
reset role;
select pg_temp.confere((select r.status='equipe' and r.motivos_equipe='{terceira_recusa}' and r.comprovante is not null and v.verificacao_estado='pendente'
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.id=pg_temp.req(13)), 'equipe[terceira_recusa], loja segue pendente');

-- [8] Receita fora do ar (RF 2): 1ª e 2ª vez voltam à fila daqui a 10 min; 3ª vai para a equipe.
select pg_temp.nova(15, '11222333000115') \gset
set local role service_role;
select pg_temp.pegar(15) as r15 \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(15), :'r15', 'equipe', null, '{receita_fora_do_ar}', '[{"item":"receita","ok":null}]', 0, 0, 0) = 'repetir', '1ª falha da Receita repete');
do $$ begin
  assert (select count(*) from verificacao_loja_reservar() x where x.id = pg_temp.req(15)) = 0, 'não reserva antes da hora';
end $$;
reset role;
select pg_temp.confere((select status='enviada' and tentativas_receita=1 and reserva is null and uso_id is null and comprovante is not null and fachada is not null
    and proxima_em between now() + interval '9 minutes' and now() + interval '10 minutes 5 seconds'
  from verificacoes_loja where id=pg_temp.req(15)), 'volta a enviada com arquivos e 10 minutos de espera');
update verificacoes_loja set proxima_em = now() where id=pg_temp.req(15);
set local role service_role;
select pg_temp.pegar(15) as r15b \gset
select pg_temp.confere(:'r15b' is not null, 'reservado de novo depois da espera');
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(15), :'r15b', 'equipe', null, '{receita_fora_do_ar}', '[]', 0, 0, 0) = 'repetir', '2ª falha repete');
reset role;
update verificacoes_loja set proxima_em = now() where id=pg_temp.req(15);
set local role service_role;
select pg_temp.pegar(15) as r15c \gset
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(15), :'r15c', 'equipe', null, '{receita_fora_do_ar}', '[]', 0, 0, 0) = 'equipe', '3ª falha vai para a equipe');
reset role;
select pg_temp.confere((select status='equipe' and tentativas_receita=2 and motivos_equipe='{receita_fora_do_ar}' and comprovante is not null
  from verificacoes_loja where id=pg_temp.req(15)), 'equipe[receita_fora_do_ar] depois de 3 falhas');

-- [9] CNPJ que vira duplicado por corrida: outra loja grava o mesmo CNPJ entre reservar e concluir.
select pg_temp.nova(16, '11222333000116') \gset
select pg_temp.nova(17, '11222333000117') \gset
set local role service_role;
select pg_temp.pegar(16) as r16 \gset
reset role;
update vitrines_lojas set cnpj='11222333000116' where id=pg_temp.vid(17);
set local role service_role;
select pg_temp.confere(verificacao_loja_concluir(pg_temp.req(16), :'r16', 'aprovar', null, '{}', '[]', 0.001, 1, 1) = 'equipe', 'CNPJ duplicado por corrida vai para a equipe');
reset role;
select pg_temp.confere((select r.status='equipe' and r.motivos_equipe='{cnpj_duplicado}' and v.cnpj is null and v.verificacao_estado='pendente' and not v.selo_loja_verificada
  from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.id=pg_temp.req(16)), 'equipe[cnpj_duplicado], sem selo e sem CNPJ gravado');

-- [10] cnpj_em_outra_loja: vitrine com o mesmo CNPJ e pedido de outra loja em análise da equipe.
select pg_temp.nova(18, '11222333000116') \gset
select pg_temp.nova(19, '11222333000111') \gset
set local role service_role;
do $$
declare a boolean; b boolean;
begin
  select bool_or(x.cnpj_em_outra_loja) filter (where x.id = pg_temp.req(18)),
         bool_or(x.cnpj_em_outra_loja) filter (where x.id = pg_temp.req(19))
    into a, b from verificacao_loja_reservar() x;
  assert a is true, 'outra vitrine já tem o CNPJ';
  assert b is true, 'outro pedido da equipe tem o CNPJ';
end $$;
reset role;

-- [11] Pedido analisando há mais de 10 minutos vira equipe[ia_falhou].
select pg_temp.nova(20, '11222333000120') \gset
set local role service_role;
select pg_temp.pegar(20) as r20 \gset
reset role;
update verificacoes_loja set iniciado_em = now() - interval '11 minutes' where id=pg_temp.req(20);
set local role service_role;
do $$ begin perform * from verificacao_loja_reservar(); end $$;
reset role;
select pg_temp.confere((select status='equipe' and motivos_equipe='{ia_falhou}' and encaminhada_em is not null and prazo_em is not null
  from verificacoes_loja where id=pg_temp.req(20)), 'analisando velho vira equipe[ia_falhou]');

-- [12] Sem orçamento: equipe[ia_sem_orcamento] e nada reservado.
update configuracoes set valor='0' where chave='robo.orcamento_mensal_centavos';
select pg_temp.nova(21, '11222333000121') \gset
set local role service_role;
do $$ begin
  assert (select count(*) from verificacao_loja_reservar()) = 0, 'sem orçamento não devolve pedido';
end $$;
reset role;
select pg_temp.confere((select status='equipe' and motivos_equipe='{ia_sem_orcamento}' and uso_id is null from verificacoes_loja where id=pg_temp.req(21)), 'sem orçamento vai para a equipe');
update configuracoes set valor='1000000' where chave='robo.orcamento_mensal_centavos';

-- [13] Cidade na região.
set local role service_role;
do $$ begin
  assert verificacao_loja_cidade_na_regiao(pg_temp.req(21), null) is null, 'IBGE nulo = não sei';
  assert verificacao_loja_cidade_na_regiao(pg_temp.req(21), 9990001) is true, 'cidade da região';
  assert verificacao_loja_cidade_na_regiao(pg_temp.req(21), 9990002) is false, 'cidade de outra região';
  assert verificacao_loja_cidade_na_regiao(pg_temp.req(21), 9999999) is false, 'cidade desconhecida';
end $$;
reset role;

-- [14] Permissões: só o servidor (service_role) executa.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_720x7';
do $$ begin
  begin perform verificacao_loja_reservar(); raise exception 'authenticated reservou'; exception when insufficient_privilege then null; end;
  begin perform verificacao_loja_cidade_na_regiao(gen_random_uuid(), 1); raise exception 'authenticated consultou região'; exception when insufficient_privilege then null; end;
  begin perform verificacao_loja_precisa_revisao(); raise exception 'authenticated sorteou revisão'; exception when insufficient_privilege then null; end;
  begin perform verificacao_loja_concluir(gen_random_uuid(), gen_random_uuid(), 'aprovar', null, '{}', '[]', 0, 0, 0); raise exception 'authenticated concluiu'; exception when insufficient_privilege then null; end;
  begin perform verificacao_loja_disparar(); raise exception 'authenticated disparou'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  assert not has_function_privilege('verificacao_loja_reservar()','execute');
  assert not has_function_privilege('verificacao_loja_cidade_na_regiao(uuid,integer)','execute');
  assert not has_function_privilege('verificacao_loja_precisa_revisao()','execute');
  assert not has_function_privilege('verificacao_loja_concluir(uuid,uuid,text,text,text[],jsonb,numeric,integer,integer)','execute');
end $$;
set local role service_role;
do $$ begin
  assert has_function_privilege('verificacao_loja_reservar()','execute');
  assert has_function_privilege('verificacao_loja_cidade_na_regiao(uuid,integer)','execute');
  assert has_function_privilege('verificacao_loja_precisa_revisao()','execute');
  assert has_function_privilege('verificacao_loja_concluir(uuid,uuid,text,text,text[],jsonb,numeric,integer,integer)','execute');
end $$;
reset role;

-- [15] Regra geral: nenhum pedido final guarda arquivo; o selo só existe em loja aprovada.
select pg_temp.confere((select count(*)=0 from verificacoes_loja where status in ('aprovada','correcao','recusada','obsoleta') and (comprovante is not null or fachada is not null)), 'pedido final nunca guarda arquivo');
select pg_temp.confere((select count(*)=0 from vitrines_lojas where selo_loja_verificada is distinct from (verificacao_estado='aprovada') and slug like 'loja-720-%'), 'selo = aprovada');
rollback;
