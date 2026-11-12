\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as c_corrente from cidades where microrregiao_id=:'regiao' and nome='Corrente' \gset
select id as c_gilbues from cidades where microrregiao_id=:'regiao' and nome='Gilbués' \gset
select id as c_parnagua from cidades where microrregiao_id=:'regiao' and nome='Parnaguá' \gset

-- outra região, com uma cidade
insert into microrregioes(slug,nome,cidade_sede) values ('q610-outra','Região de teste 610','Cidade Outra 610');
select id as regiao2 from microrregioes where slug='q610-outra' \gset
insert into cidades(microrregiao_id,nome,uf) values (:'regiao2','Cidade Outra 610','PI');
select id as c_outra from cidades where microrregiao_id=:'regiao2' \gset

insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,tipo_pessoa) values
  ('user_q610a',:'regiao','Compradora A 610','5589999961001',now(),'pf'),
  ('user_q610b',:'regiao','Comprador B 610','5589999961002',now(),'pf'),
  ('user_q610c',:'regiao','Comprador C 610','5589999961003',now(),'pf'),
  ('user_q610d',:'regiao','Comprador D 610','5589999961004',now(),'pf'),
  ('user_q610e',:'regiao','Comprador E 610','5589999961005',now(),'pf'),
  ('user_q610comum',:'regiao','Usuario comum 610','5589999961006',now(),'pf'),
  ('user_q610corr',:'regiao','Loja Corrente 610','5589999961007',now(),'pj'),
  ('user_q610parn',:'regiao','Loja Parnagua 610','5589999961008',now(),'pj'),
  ('user_q610l1',:'regiao','Loja 1 610','5589999961011',now(),'pj'),
  ('user_q610l2',:'regiao','Loja 2 610','5589999961012',now(),'pj'),
  ('user_q610l3',:'regiao','Loja 3 610','5589999961013',now(),'pj'),
  ('user_q610l4',:'regiao','Loja 4 610','5589999961014',now(),'pj'),
  ('user_q610l5',:'regiao','Loja 5 610','5589999961015',now(),'pj'),
  ('user_q610l6',:'regiao','Loja 6 610','5589999961016',now(),'pj');

-- lojas que atendem (verificadas + Slim pago); a cidade da loja pode estar escrita diferente da tabela
insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em,teste_expira_em)
select d.dono, :'regiao', 'q610-'||d.n, 'Loja '||d.n||' 610', d.cidade, 'loja', 'slim', now()+interval '10 days', now()-interval '1 day'
  from (values ('user_q610corr','corr',' corrente '),('user_q610parn','parn','Parnaguá'),
               ('user_q610l1','l1','Corrente'),('user_q610l2','l2','Corrente'),('user_q610l3','l3','Corrente'),
               ('user_q610l4','l4','Corrente'),('user_q610l5','l5','Corrente'),('user_q610l6','l6','Corrente')) d(dono,n,cidade);
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where slug like 'q610-%';

-- pedido antigo: inserido sem visibilidade nem cidades
insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade)
values ('61000000-0000-4000-a000-0000000000d1','user_q610d',:'regiao','Procuro fogão antigo de quatro bocas','Corrente');
select pg_temp.confere((select visibilidade='lojas' and cidades_ids is null from radar_pedidos where id='61000000-0000-4000-a000-0000000000d1'),'Pedido antigo vira visibilidade lojas e região toda');
select pg_temp.confere((select max_propostas=5 from radar_pedidos where id='61000000-0000-4000-a000-0000000000d1'),'Pedido novo recebe máximo de 5 lojas');

set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- ---------- criar pedidos pelo site ----------
set local request.jwt.claim.sub='user_q610a';
select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000a1','Procuro geladeira duas portas','Qualquer',
  'whatsapp_direto',null,null,null,null,null, array[:'c_corrente', :'c_gilbues', :'c_corrente']::uuid[], 'lojas') \gset a_
select pg_temp.confere((select cidade='Corrente, Gilbués' and visibilidade='lojas' and cidades_ids=array[:'c_corrente',:'c_gilbues']::uuid[]
  from radar_pedidos where id=((:'a_criar_pedido_radar_site'::jsonb)->>'id')::uuid),'Duas cidades: cidade em texto, repetidas removidas');
select pg_temp.recusa(format($q$select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000a2','Procuro geladeira de outra região','x',
  'whatsapp_direto',null,null,null,null,null, array[%L]::uuid[], 'lojas')$q$, :'c_outra'),'23514');
select pg_temp.recusa(format($q$select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000a3','Procuro geladeira cidade fantasma','x',
  'whatsapp_direto',null,null,null,null,null, array[%L]::uuid[], 'lojas')$q$, gen_random_uuid()),'23514');
select pg_temp.recusa($q$select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000a4','Procuro geladeira visibilidade ruim',null,
  'whatsapp_direto',null,null,null,null,null, null, 'amigos')$q$,'23514');

set local request.jwt.claim.sub='user_q610b';
select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000b1','Procuro fogão de seis bocas',null) \gset b_
select pg_temp.confere((select cidade='Toda a região' and cidades_ids is null and visibilidade='lojas' and max_propostas=5
  from radar_pedidos where id=((:'b_criar_pedido_radar_site'::jsonb)->>'id')::uuid),'Sem cidades: Toda a região, só lojas, 5 lojas');

set local request.jwt.claim.sub='user_q610c';
select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000c1','Procuro máquina de lavar roupa',null,
  'whatsapp_direto',null,null,null,null,null, null, 'todos') \gset c_

select (:'a_criar_pedido_radar_site'::jsonb)->>'id' as pa, (:'b_criar_pedido_radar_site'::jsonb)->>'id' as pb, (:'c_criar_pedido_radar_site'::jsonb)->>'id' as pc \gset

-- ---------- comprador não muda visibilidade nem cidades ----------
set local request.jwt.claim.sub='user_q610a';
update radar_pedidos set visibilidade='todos', cidades_ids=null where id=:'pa';
select pg_temp.confere((select visibilidade='lojas' and cidades_ids=array[:'c_corrente',:'c_gilbues']::uuid[] and cidade='Corrente, Gilbués'
  from radar_pedidos where id=:'pa'),'Comprador não muda visibilidade nem cidades');
update radar_pedidos set cidade='Lugar nenhum' where id=:'pa';
select pg_temp.confere((select cidade='Corrente, Gilbués' from radar_pedidos where id=:'pa'),'Comprador não escreve o texto da área');

-- ---------- quem vê ----------
set local request.jwt.claim.sub='user_q610corr';
select pg_temp.confere(exists(select 1 from radar_feed() where id=:'pa'::uuid),'Loja com " corrente " vê pedido de Corrente (feed)');
select pg_temp.confere(exists(select 1 from radar_feed_regional('todas',null,41,0) where id=:'pa'::uuid),'Loja com " corrente " vê pedido de Corrente (regional)');
select pg_temp.confere((select not bloqueado and titulo is not null from radar_pedido(:'pa'::uuid)),'Loja da área abre o pedido');
select pg_temp.confere(exists(select 1 from radar_feed() where id='61000000-0000-4000-a000-0000000000d1'),'Loja vê pedido antigo');
select pg_temp.confere((select area_texto='Toda a região' from radar_feed() where id='61000000-0000-4000-a000-0000000000d1')
  and (select area_texto='Toda a região' from radar_feed_regional('todas',null,41,0) where id='61000000-0000-4000-a000-0000000000d1')
  and (select area_texto='Toda a região' from radar_pedido('61000000-0000-4000-a000-0000000000d1')),'Pedido antigo (sem cidades) mostra Toda a região');
select pg_temp.confere((select area_texto='Corrente, Gilbués' and visibilidade='lojas' from radar_feed() where id=:'pa'::uuid),'Feed traz visibilidade e área em texto');

set local request.jwt.claim.sub='user_q610parn';
select pg_temp.confere(not exists(select 1 from radar_feed() where id=:'pa'::uuid),'Loja de Parnaguá não vê pedido de Corrente e Gilbués (feed)');
select pg_temp.confere(not exists(select 1 from radar_feed_regional('todas',null,41,0) where id=:'pa'::uuid),'Loja de Parnaguá não vê pedido de Corrente e Gilbués (regional)');
select pg_temp.confere((select bloqueado and titulo is null and detalhes is null and visibilidade='lojas' from radar_pedido(:'pa'::uuid)),'Loja fora da área recebe pedido bloqueado');
select pg_temp.confere(exists(select 1 from radar_feed() where id=:'pb'::uuid),'Loja de Parnaguá vê pedido da região toda');
select pg_temp.recusa(format($q$select propor_radar(%L,null,null,100,'Oi')$q$, :'pa'),'42501');

set local request.jwt.claim.sub='user_q610comum';
select pg_temp.confere(not exists(select 1 from radar_feed() where id=:'pb'::uuid),'Usuário comum não vê pedido só lojas (feed)');
select pg_temp.confere(not exists(select 1 from radar_feed_regional('todas',null,41,0) where id in (:'pa'::uuid,:'pb'::uuid)),'Usuário comum não vê pedido só lojas (regional)');
select pg_temp.confere((select count(*)=1 and bool_and(bloqueado) and bool_and(titulo is null) and bool_and(detalhes is null) and bool_and(visibilidade='lojas')
  from radar_pedido(:'pb'::uuid)),'Usuário comum recebe uma linha bloqueada, sem título');
select pg_temp.confere(exists(select 1 from radar_feed_regional('todas',null,41,0) where id=:'pc'::uuid),'Usuário comum vê pedido para todos (regional)');
select pg_temp.confere((select not bloqueado and titulo is not null and visibilidade='todos' from radar_pedido(:'pc'::uuid)),'Usuário comum abre pedido para todos');

set local request.jwt.claim.sub='user_q610b';
select pg_temp.confere((select not bloqueado and titulo is not null from radar_pedido(:'pb'::uuid)),'Dono abre o próprio pedido');
select pg_temp.confere(exists(select 1 from radar_feed() where id=:'pb'::uuid),'Dono vê o próprio pedido no feed');

-- ---------- pedido antigo aceita proposta ----------
set local request.jwt.claim.sub='user_q610corr';
select pg_temp.confere((select count(*)=1 from propor_radar('61000000-0000-4000-a000-0000000000d1',null,null,150000,'Tenho um fogão')),'Loja atendente propõe em pedido antigo');

-- ---------- área limita quem atende, em qualquer visibilidade ----------
set local request.jwt.claim.sub='user_q610a';
select criar_pedido_radar_site('61000000-0000-4000-a000-0000000000a5','Procuro freezer horizontal grande',null,
  'whatsapp_direto',null,null,null,null,null, array[:'c_corrente']::uuid[], 'todos') \gset e_
select (:'e_criar_pedido_radar_site'::jsonb)->>'id' as pe \gset
set local request.jwt.claim.sub='user_q610parn';
select pg_temp.confere(exists(select 1 from radar_pedido(:'pe'::uuid) where not bloqueado),'Pedido para todos é visível à loja de fora da área');
select pg_temp.recusa(format($q$select propor_radar(%L,null,null,100,'Oi')$q$, :'pe'),'42501');

-- ---------- até 5 lojas ----------
set local request.jwt.claim.sub='user_q610l1';
select count(*) from propor_radar(:'pb'::uuid,null,null,100,'Oferta 1');
set local request.jwt.claim.sub='user_q610l2';
select count(*) from propor_radar(:'pb'::uuid,null,null,100,'Oferta 2');
set local request.jwt.claim.sub='user_q610l3';
select count(*) from propor_radar(:'pb'::uuid,null,null,100,'Oferta 3');
set local request.jwt.claim.sub='user_q610l4';
select count(*) from propor_radar(:'pb'::uuid,null,null,100,'Oferta 4');
set local request.jwt.claim.sub='user_q610l5';
select count(*) from propor_radar(:'pb'::uuid,null,null,100,'Oferta 5');
set local request.jwt.claim.sub='user_q610l6';
select pg_temp.recusa(format($q$select propor_radar(%L,null,null,100,'Oferta 6')$q$, :'pb'),'P0001');

rollback;
