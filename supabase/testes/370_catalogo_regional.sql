\set ON_ERROR_STOP on
\set QUIET on
begin;
select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
select set_config('teste.regiao370', :'regiao', true);

insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,e_admin)
values ('user_loja370',:'regiao','Comerciante 370','5589999990370',now(),false),
       ('user_pf370',:'regiao','Pessoa Teste 370','5589999990371',now(),false),
       ('user_admin370',:'regiao','Admin 370',null,null,true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em,site_url,telefone_publico)
values ('37000000-0000-4000-a000-000000000001','user_loja370',:'regiao','loja-regional-370','Loja regional 370','Bom Jesus','loja','full',now()+interval '3 days','https://loja370.example/','558934567890'),
       ('37000000-0000-4000-a000-000000000002','user_pf370',:'regiao','pf-regional-370','Pessoa Teste 370','Corrente','pf','full',now()+interval '3 days',null,null);
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em)
values ('37000000-0000-4000-a000-000000000011','37000000-0000-4000-a000-000000000001',:'cat','Mesa local de teste','Bom Jesus',9800,'ativo',now()-interval '2 days'),
       ('37000000-0000-4000-a000-000000000012','37000000-0000-4000-a000-000000000002',:'cat','Mesa de pessoa física','Corrente',9800,'ativo',now());
insert into destaques(tipo,vitrine_id,anuncio_id,microrregiao_id,origem,status,inicio,fim)
values ('home','37000000-0000-4000-a000-000000000001','37000000-0000-4000-a000-000000000011',:'regiao','cortesia','ativo',now()-interval '1 day',now()+interval '1 day');

set local role anon;
do $$
declare reg uuid := current_setting('teste.regiao370')::uuid;
begin
  assert (select slug='loja-regional-370' from catalogo_lojas(reg,'Bom Jesus','moveis',1,0)),
    'Loja da cidade passa na frente e nicho pai inclui produtos da subcategoria';
  assert (select (item->>'id')::uuid = '37000000-0000-4000-a000-000000000011'
          from catalogo_anuncios(reg,'Bom Jesus',null,'feed',1,0) item),
    'Anúncio local mais antigo passa à frente antes do limite';
  assert exists(select 1 from catalogo_anuncios(reg,'Bom Jesus','moveis','lojas',24,0) item
     where item->>'id'='37000000-0000-4000-a000-000000000011'
       and (item->>'destaque')::boolean and (item->>'vendedor_pago')::boolean),
    'Campanha da home reaparece no catálogo com indicação paga';
  assert exists(select 1 from catalogo_anuncios(reg,'Bom Jesus',null,'patrocinados',24,0) item
     where item->>'id'='37000000-0000-4000-a000-000000000011'), 'Campanha continua na home';
  assert not exists(select 1 from catalogo_anuncios(reg,'Bom Jesus',null,'lojas',24,0) item
     where item->>'vitrine_tipo'='pf'), 'Catálogo de lojas exclui produtos PF';
  assert vitrine_publica('loja-regional-370')->>'site_url' is null and
         vitrine_publica('loja-regional-370')->>'telefone_publico' is null,
    'Contatos pendentes ainda são privados';
  assert not has_column_privilege('vitrines_lojas','site_url','select');
  assert not has_column_privilege('perfis','verificacao_pf_em','select');
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_pf370';
do $$ begin
  begin
    perform admin_verificar_vendedor_pf('37000000-0000-4000-a000-000000000002','Pessoa Teste 370',true,true,true,true);
    raise exception 'PF se aprovou';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select enviar_verificacao_vendedor_pf('user_pf370', encode(convert_to('%PDF-1.7 Documento de teste','UTF8'),'base64'),
  encode(convert_to('%PDF-1.7 Comprovante de teste','UTF8'),'base64'));
select id as revisao from verificacoes_vendedor_pf where perfil_id='user_pf370' \gset
set local role authenticated;
set local request.jwt.claim.sub='user_admin370';
select admin_revisar_loja('37000000-0000-4000-a000-000000000001',1,'aprovar',null,true,true,true);
select admin_decidir_verificacao_pf(:'revisao',true,true,true,true,null);

set local role anon;
set local request.jwt.claim.sub='';
do $$
declare reg uuid := current_setting('teste.regiao370')::uuid;
begin
  assert vitrine_publica('loja-regional-370')->>'site_url'='https://loja370.example/' and
         vitrine_publica('loja-regional-370')->>'telefone_publico'='558934567890',
    'Site e telefone passam a ser públicos depois da revisão';
  assert exists(select 1 from catalogo_anuncios(reg,'Corrente',null,'feed',24,0) item
    where item->>'id'='37000000-0000-4000-a000-000000000012'
      and item->>'vitrine_nome'='Pessoa' and (item->>'vendedor_pago')::boolean
      and (item->>'vendedor_pf_verificado')::boolean and not item ? 'verificacao_pf_por'),
    'Feed mostra só primeiro nome e o sinal de verificação';
end $$;
rollback;
