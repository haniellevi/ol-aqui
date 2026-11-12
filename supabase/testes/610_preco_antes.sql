\set ON_ERROR_STOP on
\set QUIET on
-- Card de anúncio: preço antes (riscado) e UF da cidade. Mesmas regras do preço: só quem cuida edita; todos leem o que está no ar.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono610',:'reg','Dono 610','Corrente','5589999990610',now()),
 ('user_outro610',:'reg','Outro 610','Corrente','5589999990611',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('61000000-0000-4000-a000-000000000610','user_dono610',:'reg','loja-610','Loja 610','Corrente','5589999990610','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('61100000-0000-4000-a000-000000000001','61000000-0000-4000-a000-000000000610',:'cat','Sofá retrátil 610','Corrente',120000,'ativo',now()),
 ('61100000-0000-4000-a000-000000000002','61000000-0000-4000-a000-000000000610',:'cat','Sofá baiano 610','Formosa do Rio Preto',90000,'ativo',now()),
 ('61100000-0000-4000-a000-000000000003','61000000-0000-4000-a000-000000000610',:'cat','Rascunho 610','Corrente',50000,'rascunho',null),
 ('61100000-0000-4000-a000-000000000004','61000000-0000-4000-a000-000000000610',:'cat','Cidade sem cadastro 610','Lugar Nenhum',50000,'ativo',now());

-- [1] Valor negativo é recusado, como no preço.
do $$ begin
  begin
    update anuncios set preco_antes_centavos = -1 where id = '61100000-0000-4000-a000-000000000001';
    raise exception 'FALHOU: aceitou preço antes negativo';
  exception when check_violation then null;
  end;
end $$;

-- [2] O dono informa o preço antes; um estranho não consegue mudar.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono610';
update anuncios set preco_antes_centavos = 150000 where id = '61100000-0000-4000-a000-000000000001';
set local request.jwt.claim.sub='user_outro610';
update anuncios set preco_antes_centavos = 1 where id = '61100000-0000-4000-a000-000000000001';
reset role;
set local request.jwt.claim.role='';
do $$ begin
  assert (select preco_antes_centavos from anuncios where id = '61100000-0000-4000-a000-000000000001') = 150000, 'Dono grava; estranho não muda';
end $$;

-- [3] Visitante lê preço antes e UF dos anúncios no ar; rascunho de outro não aparece; cidade fora da lista vem sem UF.
set local role anon;
set local request.jwt.claim.role='anon';
do $$ declare r record; n int := 0; begin
  for r in select * from anuncios_cards_extra(array['61100000-0000-4000-a000-000000000001','61100000-0000-4000-a000-000000000002',
                                                   '61100000-0000-4000-a000-000000000003','61100000-0000-4000-a000-000000000004']::uuid[]) loop
    n := n + 1;
    if r.id = '61100000-0000-4000-a000-000000000001' then assert r.preco_antes_centavos = 150000 and r.uf = 'PI', 'Corrente - PI com preço antes'; end if;
    if r.id = '61100000-0000-4000-a000-000000000002' then assert r.preco_antes_centavos is null and r.uf = 'BA', 'Formosa do Rio Preto - BA'; end if;
    if r.id = '61100000-0000-4000-a000-000000000004' then assert r.uf is null, 'Cidade sem cadastro: sem UF'; end if;
    assert r.id <> '61100000-0000-4000-a000-000000000003', 'Rascunho não aparece para visitante';
  end loop;
  assert n = 3, 'Três anúncios no ar';
  assert (select count(*) from anuncios_cards_extra(null)) = 0, 'Sem ids, nada';
end $$;

-- [4] O dono vê o próprio rascunho (prévia do Revisar).
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono610';
do $$ begin
  assert (select uf from anuncios_cards_extra(array['61100000-0000-4000-a000-000000000003']::uuid[])) = 'PI', 'Dono vê a prévia do rascunho';
end $$;
rollback;
