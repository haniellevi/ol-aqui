\set ON_ERROR_STOP on
\set QUIET on
-- Vitrine com IA, etapa 1. Fixtures descartáveis; nenhuma conexão com produção.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as raiz_casa from categorias where slug='casa-e-moveis' \gset
select id as raiz_veic from categorias where slug='veiculos' \gset
select id as sub_moveis from categorias where slug='moveis' \gset
select id as sub_carros from categorias where slug='carros' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_vitrine460',:'reg','Loja 460','Corrente','5589999990460',now()),
 ('user_outro460',:'reg','Outro 460','Corrente','5589999990461',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('46000000-0000-4000-a000-000000000001','user_vitrine460',:'reg','loja-460','Loja 460','Corrente','5589999990460','loja','full',now()+interval '30 days'),
 ('46000000-0000-4000-a000-000000000002','user_outro460',:'reg','loja-outra-460','Outra 460','Corrente','5589999990461','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('46100000-0000-4000-a000-000000000001','46000000-0000-4000-a000-000000000001',:'sub_moveis','Sofá 460','Corrente',50000,'ativo',now()),
 ('46100000-0000-4000-a000-000000000002','46000000-0000-4000-a000-000000000001',:'sub_moveis','Mesa 460','Corrente',30000,'ativo',now()),
 ('46100000-0000-4000-a000-000000000003','46000000-0000-4000-a000-000000000002',:'sub_moveis','Cadeira 460','Corrente',9000,'ativo',now());

-- [1] O sistema grava sugestões; o servidor soma buscas.
update vitrines_lojas set nicho_sugerido_id=:'raiz_casa', nicho_sugerido_em=now() where id='46000000-0000-4000-a000-000000000001';
update anuncios set categoria_sugerida_id=:'sub_carros', categoria_sugestao_estado='pendente', categoria_sugerida_em=now()
 where id in ('46100000-0000-4000-a000-000000000001','46100000-0000-4000-a000-000000000002','46100000-0000-4000-a000-000000000003');
select registrar_busca('  Geladeira   FROST free ', :'reg', 'moveis', 0);
select registrar_busca('geladeira frost free', :'reg', 'moveis', 5);
select registrar_busca('Geládeira frost free', :'reg', null, 0);
select registrar_busca('x', :'reg', null, 0);
do $$ begin
  assert (select vezes=2 and vezes_sem_resultado=1 from buscas_termos
           where termo_normalizado='geladeira frost free' and categoria_id is not null), 'Busca somada por termo normalizado';
  assert (select vezes=1 and vezes_sem_resultado=1 from buscas_termos
           where termo_normalizado='geladeira frost free' and categoria_id is null), 'Sem categoria fica separado';
  assert (select count(*)=2 from buscas_termos), 'Termo curto ignorado';
  assert (select count(*)=0 from configuracoes where chave='vitrine_ia.ativa' and valor <> 'false'::jsonb), 'Vitrine nova desligada';
end $$;

-- [2] O lojista: nicho válido, sem mexer na sugestão, fila e decisão só da própria loja.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_vitrine460';
do $$
declare raiz_casa uuid := (select id from categorias where slug='casa-e-moveis');
        sub_carros uuid := (select id from categorias where slug='carros');
begin
  assert (select sugerido_id=raiz_casa from minha_sugestao_nicho('46000000-0000-4000-a000-000000000001')), 'Dono vê a sugestão';
  assert not exists(select 1 from minha_sugestao_nicho('46000000-0000-4000-a000-000000000002')), 'Não vê a de outra loja';
  begin
    update vitrines_lojas set nicho_id=sub_carros where id='46000000-0000-4000-a000-000000000001';
    raise exception 'Subcategoria não pode virar nicho';
  exception when check_violation then null; end;
  update vitrines_lojas set nicho_id=raiz_casa where id='46000000-0000-4000-a000-000000000001';
  begin
    update vitrines_lojas set nicho_sugerido_id=null where id='46000000-0000-4000-a000-000000000001';
    raise exception 'Dono não pode mexer na sugestão de nicho';
  exception when insufficient_privilege then null; end;
  begin
    update anuncios set categoria_sugestao_estado='aceita' where id='46100000-0000-4000-a000-000000000001';
    raise exception 'Dono não pode mexer na sugestão de categoria';
  exception when insufficient_privilege then null; end;
  begin
    perform registrar_busca('sofa', null, null, 1);
    raise exception 'Navegador não pode somar busca';
  exception when insufficient_privilege then null; end;
  assert (select count(*)=0 from buscas_termos), 'Lojista não lê as buscas (a policy deixa só o admin)';
  assert (select count(*)=2 from minhas_sugestoes_categoria('46000000-0000-4000-a000-000000000001')), 'Fila com os 2 anúncios';
  assert (select count(*)=0 from minhas_sugestoes_categoria('46000000-0000-4000-a000-000000000002')), 'Fila de outra loja vazia';
  begin
    perform decidir_categoria_sugerida('46100000-0000-4000-a000-000000000003', true);
    raise exception 'Não decide anúncio de outra loja';
  exception when insufficient_privilege then null; end;
  perform decidir_categoria_sugerida('46100000-0000-4000-a000-000000000001', false);
  begin
    perform decidir_categoria_sugerida('46100000-0000-4000-a000-000000000001', true);
    raise exception 'Não decide duas vezes';
  exception when invalid_parameter_value then null; end;
end $$;
-- Trocar a categoria por conta própria recusa a sugestão pendente.
update anuncios set categoria_id=(select id from categorias where slug='decoracao')
 where id='46100000-0000-4000-a000-000000000002';
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
do $$ begin
  assert (select nicho_id=(select id from categorias where slug='casa-e-moveis') from vitrines_lojas where id='46000000-0000-4000-a000-000000000001'), 'Nicho salvo';
  assert (select categoria_sugestao_estado='recusada' from anuncios where id='46100000-0000-4000-a000-000000000001'), 'Recusa gravada';
  assert (select categoria_sugestao_estado='recusada' from anuncios where id='46100000-0000-4000-a000-000000000002'), 'Troca própria recusa a sugestão';
  assert (select categoria_sugestao_estado='pendente' from anuncios where id='46100000-0000-4000-a000-000000000003'), 'Outra loja intacta';
end $$;

-- [3] Aceitar troca a categoria.
update anuncios set categoria_sugerida_id=(select id from categorias where slug='moveis'), categoria_sugestao_estado='pendente'
 where id='46100000-0000-4000-a000-000000000003';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_outro460';
select decidir_categoria_sugerida('46100000-0000-4000-a000-000000000003', true);
reset role;
do $$ begin
  assert (select categoria_sugestao_estado='aceita' and categoria_id=(select id from categorias where slug='moveis')
           from anuncios where id='46100000-0000-4000-a000-000000000003'), 'Aceite troca a categoria';
end $$;

-- [4] Visitante vê o nicho, não a sugestão.
set local role anon;
set local request.jwt.claim.role='anon';
do $$ begin
  perform nicho_id from vitrines_lojas where id='46000000-0000-4000-a000-000000000001';
  begin
    perform nicho_sugerido_id from vitrines_lojas limit 1;
    raise exception 'Visitante não lê a sugestão';
  exception when insufficient_privilege then null; end;
end $$;

-- [5] Anúncio congelado pelo Compliance não aceita decisão de categoria.
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('46100000-0000-4000-a000-000000000004','46000000-0000-4000-a000-000000000001',:'sub_moveis','Estante 460','Corrente',20000,'ativo',now());
update anuncios set categoria_sugerida_id=:'sub_carros', categoria_sugestao_estado='pendente', categoria_sugerida_em=now(),
                    status='congelado', congelado_motivo='Teste 460'
 where id='46100000-0000-4000-a000-000000000004';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_vitrine460';
do $$ begin
  begin
    perform decidir_categoria_sugerida('46100000-0000-4000-a000-000000000004', true);
    raise exception 'Congelado não pode trocar de categoria';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
do $$ begin
  assert (select categoria_id=(select id from categorias where slug='moveis') and categoria_sugestao_estado='pendente'
           from anuncios where id='46100000-0000-4000-a000-000000000004'), 'Congelado intacto';
end $$;

-- [6] Apagar uma categoria junta as buscas dela no balde sem categoria, sem quebrar a exclusão.
insert into categorias(slug,nome) values ('teste-460','Teste 460');
select registrar_busca('geladeira frost free', :'reg', 'teste-460', 0);
select registrar_busca('geladeira frost free', :'reg', 'teste-460', 3);
delete from categorias where slug='teste-460';
do $$ begin
  assert (select vezes=3 and vezes_sem_resultado=2 from buscas_termos
           where termo_normalizado='geladeira frost free' and categoria_id is null), 'Contadores juntados no balde sem categoria';
  assert (select count(*)=2 from buscas_termos), 'Nenhuma linha duplicada';
end $$;
rollback;
