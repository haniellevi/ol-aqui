\set ON_ERROR_STOP on
\set QUIET on
-- Categorias etapa 2: guardar o que a IA sugeriu e a categoria escolhida; só admin lê; só quem cuida do anúncio grava.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
select id as racao from categorias where slug='racao' \gset
select id as cachorros from categorias where slug='cachorros' \gset
select id as motos from categorias where slug='motos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono600',:'reg','Dono 600','Corrente','5589999990600',now()),
 ('user_ajud600',:'reg','Ajudante 600','Corrente','5589999990601',now()),
 ('user_outro600',:'reg','Outro 600','Corrente','5589999990602',now());
insert into perfis(id,microrregiao_id,nome,cidade,e_admin) values ('user_admin600',:'reg','Admin 600','Corrente',true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('60000000-0000-4000-a000-000000000600','user_dono600',:'reg','loja-600','Loja 600','Corrente','5589999990600','loja','full',now()+interval '30 days');
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em,revogado_em) values
 ('60000000-0000-4000-a000-000000000600','\x60','\x60','0601','user_ajud600',now(),null);
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('60100000-0000-4000-a000-000000000001','60000000-0000-4000-a000-000000000600',null,null,'Corrente',null,'rascunho',null),
 ('60100000-0000-4000-a000-000000000002','60000000-0000-4000-a000-000000000600',null,null,'Corrente',null,'rascunho',null),
 ('60100000-0000-4000-a000-000000000003','60000000-0000-4000-a000-000000000600',null,null,'Corrente',null,'rascunho',null),
 ('60100000-0000-4000-a000-000000000004','60000000-0000-4000-a000-000000000600',null,null,'Corrente',null,'rascunho',null),
 ('60100000-0000-4000-a000-000000000005','60000000-0000-4000-a000-000000000600',null,null,'Corrente',null,'rascunho',null);
create temp table ids600 as select :'racao'::uuid as racao, :'cachorros'::uuid as cachorros, :'motos'::uuid as motos, :'diversos'::uuid as diversos;
grant select on ids600 to authenticated, anon;

-- [1] O dono guarda a resposta da IA; a escolha só vale depois de salvar a categoria no anúncio.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono600';
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000001', '  Ração   Golden 15kg ',
  jsonb_build_array(jsonb_build_object('id', :'racao'::uuid, 'chance', 0.81234567), jsonb_build_object('id', :'cachorros'::uuid, 'chance', 0.1)));
do $$ begin
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000001', 'Ração Golden 15kg') = false, 'Sem categoria no anúncio: nada a guardar';
  assert (select count(*) from categorias_ia_escolhas) = 0, 'Dono não lê a tabela';
  begin
    insert into categorias_ia_escolhas(anuncio_id, texto) values ('60100000-0000-4000-a000-000000000002', 'x');
    assert false, 'Dono gravou direto na tabela';
  exception when insufficient_privilege then null; end;
  begin
    update categorias_ia_escolhas set texto = 'x';
    assert false, 'Dono mudou direto na tabela';
  exception when insufficient_privilege then null; end;
  begin
    perform admin_acertos_categoria_ia(30);
    assert false, 'Dono viu o painel';
  exception when sqlstate '42501' then null; end;
  -- Entradas ruins
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', '   ', '[]'); assert false, 'Texto vazio';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto', '{}'); assert false, 'Não é lista';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('id', motos, 'chance', 0.4), jsonb_build_object('id', racao, 'chance', 0.3),
       jsonb_build_object('id', cachorros, 'chance', 0.2), jsonb_build_object('id', diversos, 'chance', 0.1)) from ids600));
    assert false, 'Mais de 3';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('id', motos, 'chance', 1.5)) from ids600)); assert false, 'Chance acima de 1';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('id', motos, 'chance', '0.5')) from ids600)); assert false, 'Chance em texto';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    '[{"id": "00000000-0000-4000-a000-000000000999", "chance": 0.5}]'); assert false, 'Categoria que não existe';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('id', motos)) from ids600)); assert false, 'Sem chance';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('chance', 0.5)) from ids600)); assert false, 'Sem id';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto', '[{"id": "x", "chance": 0.5}]');
    assert false, 'Id que não é uuid';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto',
    (select jsonb_build_array(jsonb_build_object('id', motos, 'chance', 0.5), jsonb_build_object('id', motos, 'chance', 0.2)) from ids600));
    assert false, 'Categoria repetida';
  exception when sqlstate '22023' then null; end;
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-0000000009ff', 'moto', '[]'); assert false, 'Anúncio que não existe';
  exception when sqlstate '42501' then null; end;
end $$;

-- [2] Outra pessoa não grava no anúncio da loja; o ajudante grava.
set local request.jwt.claim.sub='user_outro600';
do $$ begin
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto', '[]'); assert false, 'Estranho gravou sugestão';
  exception when sqlstate '42501' then null; end;
  begin perform registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000001', 'Ração Golden 15kg'); assert false, 'Estranho gravou escolha';
  exception when sqlstate '42501' then null; end;
end $$;
set local request.jwt.claim.sub='user_ajud600';
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'Honda Biz 2015',
  jsonb_build_array(jsonb_build_object('id', :'motos'::uuid, 'chance', 0.9)));
set local request.jwt.claim.sub='user_dono600';
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000003', 'asdf qwer', '[]');
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000004', 'filhote de poodle',
  jsonb_build_array(jsonb_build_object('id', :'cachorros'::uuid, 'chance', 0.5), jsonb_build_object('id', :'racao'::uuid, 'chance', 0.3)));
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000005', 'saco de ração antigo',
  jsonb_build_array(jsonb_build_object('id', :'cachorros'::uuid, 'chance', 0.6)));
-- anon não chama nada
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
  begin perform registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000002', 'moto', '[]'); assert false, 'Anon gravou';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from categorias_ia_escolhas; assert false, 'Anon leu';
  exception when insufficient_privilege then null; end;
end $$;

-- [3] As categorias são salvas no anúncio; depois a escolha é guardada (lida do banco).
reset role;
set local request.jwt.claim.role='';
update anuncios set categoria_id = :'racao' where id = '60100000-0000-4000-a000-000000000001';    -- 1ª: acerto
update anuncios set categoria_id = :'diversos' where id = '60100000-0000-4000-a000-000000000002'; -- fora das 3
update anuncios set categoria_id = :'cachorros' where id = '60100000-0000-4000-a000-000000000003'; -- IA sem sugestão
update anuncios set categoria_id = :'racao' where id = '60100000-0000-4000-a000-000000000004';    -- 2ª: entre as 3
update anuncios set categoria_id = :'racao' where id = '60100000-0000-4000-a000-000000000005';    -- escolha antiga
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono600';
do $$ begin
  -- Texto na tela diferente do guardado (apagou o texto, IA atrasada, resposta fora de ordem): fora da conta.
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000001', 'ração de gato') = false, 'Texto diferente não grava';
  assert (select count(*) from categorias_ia_escolhas) = 0, 'Dono continua sem ler';
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000001', '  Ração  Golden 15kg'), 'Guardou escolha 1';
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000003', 'asdf qwer'), 'Guardou escolha 3';
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000004', 'filhote de poodle'), 'Guardou escolha 4';
  assert registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000005', 'saco de ração antigo'), 'Guardou escolha 5';
end $$;
set local request.jwt.claim.sub='user_ajud600';
select registrar_escolha_categoria_ia('60100000-0000-4000-a000-000000000002', 'Honda Biz 2015');

reset role;
set local request.jwt.claim.role='';
update categorias_ia_escolhas set escolhida_em = now() - interval '3 hours' where anuncio_id = '60100000-0000-4000-a000-000000000002';
update categorias_ia_escolhas set escolhida_em = now() - interval '2 hours' where anuncio_id = '60100000-0000-4000-a000-000000000003';
update categorias_ia_escolhas set escolhida_em = now() - interval '1 hour' where anuncio_id = '60100000-0000-4000-a000-000000000004';
update categorias_ia_escolhas set escolhida_em = now() - interval '40 days' where anuncio_id = '60100000-0000-4000-a000-000000000005';
do $$ begin
  assert (select texto from categorias_ia_escolhas where anuncio_id = '60100000-0000-4000-a000-000000000001') = 'Ração Golden 15kg', 'Texto limpo';
  assert (select (sugestoes->0->>'chance')::numeric from categorias_ia_escolhas where anuncio_id = '60100000-0000-4000-a000-000000000001') = 0.8123, 'Chance arredondada';
  assert (select categoria_escolhida_id from categorias_ia_escolhas where anuncio_id = '60100000-0000-4000-a000-000000000002') = (select diversos from ids600), 'Escolha do ajudante';
end $$;

-- [4] Só o admin lê: números do período e casos em que a pessoa escolheu outra.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_admin600';
do $$
declare r jsonb := admin_acertos_categoria_ia(30); r90 jsonb := admin_acertos_categoria_ia(90); r7 jsonb := admin_acertos_categoria_ia(999);
begin
  assert (select count(*) from categorias_ia_escolhas) = 5, 'Admin lê a tabela';
  assert (r->>'total')::int = 4 and (r->>'acertou_1')::int = 1 and (r->>'acertou_3')::int = 2 and (r->>'sem_sugestao')::int = 1, 'Números de 30 dias: ' || r::text;
  assert jsonb_array_length(r->'erros') = 3, 'Três erros';
  assert r->'erros'->0->>'texto' = 'filhote de poodle' and (r->'erros'->0->>'entre_as_3')::boolean, 'Mais recente primeiro, entre as 3';
  assert r->'erros'->1->>'texto' = 'asdf qwer' and jsonb_array_length(r->'erros'->1->'sugestoes') = 0, 'Sem sugestão entra nos erros';
  assert r->'erros'->2->>'texto' = 'Honda Biz 2015' and not (r->'erros'->2->>'entre_as_3')::boolean, 'Fora das 3';
  assert (r90->>'total')::int = 5 and jsonb_array_length(r90->'erros') = 4, 'Escolha de 40 dias entra em 90';
  assert (r7->>'dias')::int = 30, 'Período estranho vira 30';
end $$;

-- [5] Resposta nova da IA apaga a escolha antiga; anúncio apagado leva a linha junto.
set local request.jwt.claim.sub='user_dono600';
select registrar_sugestao_categoria_ia('60100000-0000-4000-a000-000000000001', 'ração de gato', '[]');
reset role;
set local request.jwt.claim.role='';
do $$ begin
  assert (select categoria_escolhida_id is null and escolhida_em is null and texto = 'ração de gato'
            from categorias_ia_escolhas where anuncio_id = '60100000-0000-4000-a000-000000000001'), 'Escolha antiga apagada';
end $$;
delete from anuncios where id = '60100000-0000-4000-a000-000000000002';
do $$ begin
  assert not exists (select 1 from categorias_ia_escolhas where anuncio_id = '60100000-0000-4000-a000-000000000002'), 'Apagou junto com o anúncio';
end $$;
rollback;
