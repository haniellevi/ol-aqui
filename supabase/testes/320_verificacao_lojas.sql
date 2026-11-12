\set ON_ERROR_STOP on
\set QUIET on
begin;
select id as regiao from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em)
values ('user_loja320',:'regiao','Titular de teste','5589999990320',now()),
       ('user_outro320',:'regiao','Outra conta','5589999990322',now()),
       ('user_suporte320',:'regiao','Equipe de teste',null,null),
       ('user_franquia320',:'regiao','Franqueado de teste',null,null);
insert into equipe(usuario_id,papel,microrregiao_id)
values ('user_suporte320','suporte',null),('user_franquia320','franqueado',:'regiao');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,whatsapp,instagram)
values ('32000000-0000-4000-a000-000000000001','user_loja320',:'regiao',
        'vitrine-revisao-320','Comércio 320','Corrente','loja','5589999990321','comercio.320');
do $$ declare restricao text; begin
  begin
    insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo)
    select 'user_outro320',microrregiao_id,'loja-duplicada-320','COMERCIO-320','Corrente','loja'
      from perfis where id='user_outro320';
    raise exception 'Nome duplicado foi aceito';
  exception when unique_violation then
    get stacked diagnostics restricao = constraint_name;
    assert restricao = 'vitrines_nome_loja_unico';
  end;
  begin
    update perfis set whatsapp='5589999990321' where id='user_outro320';
    raise exception 'Contato comercial de outra conta foi aceito';
  exception when unique_violation then
    get stacked diagnostics restricao = constraint_name;
    assert restricao = 'whatsapp_vinculos_pkey';
  end;
end $$;
set local role anon;
do $$ begin
  assert not has_column_privilege('vitrines_lojas','whatsapp','select');
  assert not has_column_privilege('vitrines_lojas','instagram','select');
  assert vitrine_publica('vitrine-revisao-320')->>'whatsapp' = '5589999990320';
  assert vitrine_publica('vitrine-revisao-320')->>'instagram' is null;
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_outro320';
do $$ begin
  begin
    perform admin_revisar_loja('32000000-0000-4000-a000-000000000001',1,'aprovar',null,true,true,true);
    raise exception 'Conta comum conseguiu aprovar';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub='user_franquia320';
do $$ begin
  assert (select estado='pendente' and revisao is null and whatsapp_comercial is null and instagram is null
    from admin_verificacoes_lojas(array['32000000-0000-4000-a000-000000000001'::uuid]));
  assert (select whatsapp is null from admin_lojas(p_busca => 'vitrine-revisao-320'));
  assert not exists(select 1 from admin_lojas(p_busca => '999990321'));
end $$;

set local request.jwt.claim.sub='user_suporte320';
do $$ begin
  begin
    perform admin_revisar_loja('32000000-0000-4000-a000-000000000001',1,'aprovar',null,true,false,true);
    raise exception 'Aprovação sem conferir o link';
  exception when check_violation then null;
  end;
  perform admin_revisar_loja('32000000-0000-4000-a000-000000000001',1,'aprovar',null,true,true,true);
  begin
    perform admin_revisar_loja('32000000-0000-4000-a000-000000000001',1,'recusar','titularidade',false,false,false);
    raise exception 'Ação de revisão antiga foi aceita';
  exception when raise_exception then
    if sqlerrm <> 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.' then raise; end if;
  end;
end $$;

set local role anon;
do $$ begin
  assert vitrine_publica('vitrine-revisao-320')->>'whatsapp' = '5589999990321';
  assert vitrine_publica('vitrine-revisao-320')->>'instagram' = 'comercio.320';
  assert (vitrine_publica('vitrine-revisao-320')->>'selo')::boolean;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='user_loja320';
-- Instagram novo não derruba o selo: a loja segue aprovada e a equipe recebe um aviso.
update vitrines_lojas set instagram='comercio.novo' where slug='vitrine-revisao-320';
do $$ begin
  assert (select estado='aprovada' from minha_verificacao_loja());
  assert (select instagram='comercio.novo' from meus_contatos_vitrine());
  assert (select selo_loja_verificada from vitrines_lojas where slug='vitrine-revisao-320');
end $$;
-- Endereço novo derruba o selo e reabre a revisão.
update vitrines_lojas set endereco='Rua Nova, 320' where slug='vitrine-revisao-320';
do $$ begin
  assert (select estado='pendente' from minha_verificacao_loja());
  assert (select instagram='comercio.novo' from meus_contatos_vitrine());
  assert vitrine_publica('vitrine-revisao-320')->>'whatsapp' = '5589999990320';
  assert not (vitrine_publica('vitrine-revisao-320')->>'selo')::boolean;
end $$;

set local request.jwt.claim.sub='user_suporte320';
select admin_revisar_loja('32000000-0000-4000-a000-000000000001',3,'correcao','link_invalido',false,false,false);
set local request.jwt.claim.sub='user_loja320';
do $$ begin
  assert (select estado='correcao' and motivo='link_invalido' from minha_verificacao_loja());
end $$;

reset role;
do $$ begin
  assert (select count(*)=2 from vitrines_acoes_admin where vitrine_id='32000000-0000-4000-a000-000000000001');
end $$;
rollback;
