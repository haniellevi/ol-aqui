\set ON_ERROR_STOP on
\set QUIET on
-- Núcleo da verificação da loja: pedido, envio com limite, arquivos privados, estado e decisão única.
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
values ('user_a710',:'reg','Dono A 710','Corrente','5589999991001',now()),
       ('user_b710',:'reg','Dono B 710','Corrente','5589999991002',now()),
       ('user_c710',:'reg','Dono C 710','Corrente','5589999991003',now()),
       ('user_d710',:'reg','Dono D 710','Corrente','5589999991004',now()),
       ('user_rev710',:'reg','Dono Revogado 710','Corrente','5589999991005',now()),
       ('user_f710',:'reg','Dono F 710','Corrente','5589999991006',now()),
       ('user_m710',:'reg','Dono M 710','Corrente','5589999991007',now()),
       ('user_aj710',:'reg','Ajudante 710','Corrente','5589999991008',now()),
       ('user_pf710',:'reg','Vendedor PF 710','Corrente','5589999991009',now()),
       ('user_sup710',:'reg','Suporte 710',null,null,null);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo) values
 ('71000000-0000-4000-a000-00000000000a','user_a710',:'reg','loja-a-710','Loja A 710','Corrente','Centro','Rua A, 1','5589999992001','loja'),
 ('71000000-0000-4000-a000-00000000000b','user_b710',:'reg','loja-b-710','Loja B 710','Corrente','Centro','Rua B, 2','5589999992002','loja'),
 ('71000000-0000-4000-a000-00000000000c','user_c710',:'reg','loja-c-710','Loja C 710','Corrente','Centro','Rua C, 3','5589999992003','loja'),
 ('71000000-0000-4000-a000-00000000000d','user_d710',:'reg','loja-d-710','Loja D 710','Corrente','Centro','Rua D, 4','5589999992004','loja'),
 ('71000000-0000-4000-a000-0000000000e0','user_rev710',:'reg','loja-e-710','Loja E 710','Corrente','Centro','Rua E, 5','5589999992005','loja'),
 ('71000000-0000-4000-a000-0000000000f0','user_f710',:'reg','loja-f-710','Loja F 710','Corrente','Centro','Rua F, 6','5589999992006','loja'),
 ('71000000-0000-4000-a000-000000000a0a','user_m710',:'reg','loja-m-710','Loja M 710','Corrente','Centro','Rua M, 7','5589999992007','loja');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo)
values ('71000000-0000-4000-a000-000000000b0b','user_pf710',:'reg','pf-710','Vendedor PF 710','Corrente','pf');
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em,revogado_em) values
 ('71000000-0000-4000-a000-00000000000a','\x01','\x01','1008','user_aj710',now(),null);
insert into equipe(usuario_id,papel,microrregiao_id) values ('user_sup710','suporte',null);

-- Prepara contas especiais (como dono do banco).
update perfis set whatsapp_verificado_em = null where id = 'user_b710';
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where id='71000000-0000-4000-a000-00000000000c';
update vitrines_lojas set status='suspensa' where id='71000000-0000-4000-a000-00000000000d';
insert into contas_revogadas(usuario_id) values ('user_rev710');

create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.png(texto text) returns text language sql as $$ select encode(decode('89504e470d0a1a0a','hex')||convert_to(texto,'UTF8'),'base64') $$;
create function pg_temp.fecha(p_vitrine uuid, p_status text) returns void language sql as $$
  update verificacoes_loja set status=p_status, comprovante=null, tipo_comprovante=null, fachada=null, tipo_fachada=null
   where vitrine_id=p_vitrine and status in ('enviada','analisando','equipe','revisao_amostra')
$$;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;

-- [1] Códigos de retorno que não gravam nada.
set local role service_role;
do $$
declare cnpj text := '11222333000181';
begin
  assert enviar_verificacao_loja('user_inexistente710',cnpj,pg_temp.pdf('x'),null) = 'conta', 'perfil inexistente';
  assert enviar_verificacao_loja('user_aj710',cnpj,pg_temp.pdf('x'),null) = 'conta', 'ajudante de outra loja não envia pelo dono';
  assert enviar_verificacao_loja('user_pf710',cnpj,pg_temp.pdf('x'),null) = 'conta', 'vendedor PF não tem loja';
  assert enviar_verificacao_loja('user_d710',cnpj,pg_temp.pdf('x'),null) = 'conta', 'loja suspensa';
  assert enviar_verificacao_loja('user_rev710',cnpj,pg_temp.pdf('x'),null) = 'conta', 'conta revogada';
  assert enviar_verificacao_loja('user_b710',cnpj,pg_temp.pdf('x'),null) = 'whatsapp', 'WhatsApp não confirmado';
  assert enviar_verificacao_loja('user_c710',cnpj,pg_temp.pdf('x'),null) = 'verificada', 'selo dado à mão';
end $$;

-- [2] Validações de CNPJ e de arquivos (loja F não grava nada).
do $$
declare
  grande text := encode(convert_to('%PDF-'||repeat('a',2097152),'UTF8'),'base64');
begin
  assert enviar_verificacao_loja('user_f710','11.222.333/0001-81',pg_temp.pdf('x'),null) = 'cnpj', 'CNPJ com pontos';
  assert enviar_verificacao_loja('user_f710','1122233300018',pg_temp.pdf('x'),null) = 'cnpj', 'CNPJ curto';
  assert enviar_verificacao_loja('user_f710',null,pg_temp.pdf('x'),null) = 'cnpj', 'CNPJ nulo';
  assert enviar_verificacao_loja('user_f710','11222333000181',null,null) = 'invalido', 'sem comprovante';
  assert enviar_verificacao_loja('user_f710','11222333000181','###',null) = 'invalido', 'base64 inválido';
  assert enviar_verificacao_loja('user_f710','11222333000181',encode(convert_to('MZ programa.exe','UTF8'),'base64'),null) = 'invalido', 'executável como comprovante';
  assert enviar_verificacao_loja('user_f710','11222333000181',pg_temp.pdf('x'),encode(convert_to('MZ programa.exe','UTF8'),'base64')) = 'invalido', 'executável como fachada';
  assert enviar_verificacao_loja('user_f710','11222333000181',pg_temp.pdf('x'),pg_temp.pdf('x')) = 'invalido', 'comprovante igual à fachada';
  assert enviar_verificacao_loja('user_f710','11222333000181',grande,null) = 'invalido', 'maior que 2 MiB';
  assert enviar_verificacao_loja('user_f710','11222333000181',pg_temp.pdf('x'),'') = 'invalido', 'fachada vazia (use null)';
end $$;
reset role;
select pg_temp.confere((select count(*)=0 from verificacoes_loja where perfil_id in ('user_f710','user_b710','user_c710','user_d710','user_rev710','user_aj710')), 'códigos de recusa não gravam pedido');
select pg_temp.confere((select verificacao_revisao=1 and verificacao_estado='pendente' from vitrines_lojas where id='71000000-0000-4000-a000-0000000000f0'), 'recusa não mexe na loja');

-- [3] Caminho feliz (loja A): PDF + PNG, loja fica pendente, histórico e identidade.
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('comprovante a'),pg_temp.png('fachada a')) = 'enviada', 'envio feliz';
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('comprovante a'),pg_temp.png('fachada a')) = 'pendente', 'duplo envio';
end $$;
reset role;
select pg_temp.confere((select count(*)=1 from verificacoes_loja where vitrine_id='71000000-0000-4000-a000-00000000000a'), 'um pedido só');
select pg_temp.confere((select r.status='enviada' and r.tipo_comprovante='application/pdf' and r.tipo_fachada='image/png'
    and r.comprovante is not null and r.fachada is not null and r.cnpj='11222333000181' and r.perfil_id='user_a710'
    and r.decidido_em is null and r.amostra is false and r.tentativas_receita=0 and r.parecer='[]'::jsonb
    and r.revisao_loja = v.verificacao_revisao
    and r.identidade = md5(concat_ws('|',v.cidade,v.bairro,v.endereco,v.whatsapp,v.microrregiao_id::text,r.cnpj))
   from verificacoes_loja r join vitrines_lojas v on v.id=r.vitrine_id where r.vitrine_id='71000000-0000-4000-a000-00000000000a'), 'linha do pedido e identidade');
select pg_temp.confere((select verificacao_estado='pendente' and not selo_loja_verificada and verificacao_revisao=2 and verificacao_motivo is null
   from vitrines_lojas where id='71000000-0000-4000-a000-00000000000a'), 'loja segue pendente com revisão +1');
select pg_temp.confere((select count(*)=1 from vitrines_acoes_admin where vitrine_id='71000000-0000-4000-a000-00000000000a'
   and acao='verificacao_enviada' and admin_id='user_a710' and char_length(motivo) between 3 and 300), 'histórico verificacao_enviada');

-- [4] CHECK dos arquivos.
do $$ begin
  begin
    update verificacoes_loja set status='aprovada' where vitrine_id='71000000-0000-4000-a000-00000000000a';
    raise exception 'Aprovada com arquivos foi aceita';
  exception when check_violation then null;
  end;
  begin
    update verificacoes_loja set tipo_fachada=null where vitrine_id='71000000-0000-4000-a000-00000000000a';
    raise exception 'Fachada sem tipo foi aceita';
  exception when check_violation then null;
  end;
  begin
    update verificacoes_loja set cnpj='11.222.333/0001-81' where vitrine_id='71000000-0000-4000-a000-00000000000a';
    raise exception 'CNPJ com pontos foi aceito';
  exception when check_violation then null;
  end;
  begin
    update verificacoes_loja set status='obsoleta' where vitrine_id='71000000-0000-4000-a000-00000000000a';
    raise exception 'Obsoleta com arquivos foi aceita';
  exception when check_violation then null;
  end;
  begin
    update verificacoes_loja set comprovante=null where vitrine_id='71000000-0000-4000-a000-00000000000a';
    raise exception 'Aberta sem comprovante foi aceita';
  exception when check_violation then null;
  end;
  begin
    insert into verificacoes_loja(vitrine_id,perfil_id,cnpj,identidade,revisao_loja,comprovante,tipo_comprovante)
    values ('71000000-0000-4000-a000-00000000000a','user_a710','11222333000181','x',1,'\x255044462d'::bytea,'application/pdf');
    raise exception 'Segundo pedido aberto da mesma loja foi aceito';
  exception when unique_violation then null;
  end;
end $$;
update verificacoes_loja set status='aprovada', comprovante=null, tipo_comprovante=null, fachada=null, tipo_fachada=null
 where vitrine_id='71000000-0000-4000-a000-00000000000a';
select pg_temp.confere((select status='aprovada' and comprovante is null and fachada is null from verificacoes_loja where vitrine_id='71000000-0000-4000-a000-00000000000a'),
  'aprovada com arquivos nulos passa');

-- [5] Limite: 3 pedidos em 24 h; o 4º volta 'limite'.
-- (O pedido aprovado acima é o 1º; a loja A segue sem selo porque só o teste mexeu no pedido.)
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('a2'),null) = 'enviada', '2º envio (sem fachada)';
end $$;
reset role;
select pg_temp.fecha('71000000-0000-4000-a000-00000000000a','recusada');
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('a3'),null) = 'enviada', '3º envio';
end $$;
reset role;
select pg_temp.fecha('71000000-0000-4000-a000-00000000000a','correcao');
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('a4'),null) = 'limite', '4º envio em 24 h';
end $$;
reset role;
select pg_temp.confere((select count(*)=3 from verificacoes_loja where vitrine_id='71000000-0000-4000-a000-00000000000a'), 'limite não grava o 4º');
update verificacoes_loja set criado_em = now() - interval '25 hours' where vitrine_id='71000000-0000-4000-a000-00000000000a';
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('a5'),null) = 'enviada', 'pedidos antigos saem do limite';
end $$;

-- [6] Permissões.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_a710';
do $$ begin
  begin
    perform enviar_verificacao_loja('user_a710','11222333000181',pg_temp.pdf('x'),null);
    raise exception 'authenticated enviou por fora do servidor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform verificacao_loja_definir('71000000-0000-4000-a000-00000000000a','aprovada',null,'verificacao_revisada','user_a710',null);
    raise exception 'authenticated chamou a decisão interna';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from verificacoes_loja;
    raise exception 'authenticated leu a tabela de pedidos';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$ begin
  assert not has_function_privilege('enviar_verificacao_loja(text,text,text,text)','execute');
  assert not has_function_privilege('minha_verificacao_loja_envio()','execute');
  assert not has_function_privilege('verificacao_loja_definir(uuid,text,text,text,text,jsonb)','execute');
  assert not has_table_privilege('verificacoes_loja','select');
end $$;
set local role service_role;
do $$ begin
  assert has_function_privilege('enviar_verificacao_loja(text,text,text,text)','execute');
  assert not has_function_privilege('verificacao_loja_definir(uuid,text,text,text,text,jsonb)','execute'), 'definir fechada ao service_role';
  assert not has_table_privilege('verificacoes_loja','select'), 'tabela fechada ao service_role';
  assert not has_function_privilege('minha_verificacao_loja_envio()','execute');
end $$;
set local role authenticated;
do $$ begin
  assert has_function_privilege('minha_verificacao_loja_envio()','execute');
end $$;

-- [7] Ajudante: não é o dono, não vê a loja.
set local request.jwt.claim.sub='user_aj710';
do $$ begin
  assert not exists (select 1 from minha_verificacao_loja_envio()), 'ajudante não recebe a situação da loja';
end $$;

-- [8] minha_verificacao_loja_envio, status a status (loja M).
set local request.jwt.claim.sub='user_m710';
do $$ declare r record; begin
  select * into r from minha_verificacao_loja_envio();
  assert r.status='nao_enviada' and r.motivo is null and r.criado_em is null and r.envios_hoje=0
     and r.verificada is false and r.whatsapp_ok is true, 'nao_enviada';
end $$;
set local role service_role;
do $$ begin
  assert enviar_verificacao_loja('user_m710','11222333000181',pg_temp.pdf('m'),null) = 'enviada';
end $$;
set local role authenticated;
do $$ declare r record; begin
  select * into r from minha_verificacao_loja_envio();
  assert r.status='conferindo' and r.criado_em is not null and r.envios_hoje=1 and r.verificada is false, 'enviada -> conferindo';
end $$;
reset role;
update verificacoes_loja set status='analisando' where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ begin assert (select status from minha_verificacao_loja_envio())='conferindo', 'analisando -> conferindo'; end $$;
reset role;
update verificacoes_loja set status='equipe' where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ begin assert (select status from minha_verificacao_loja_envio())='equipe', 'equipe'; end $$;
-- Aprovada pela IA com amostra para a equipe: o pedido fica em revisao_amostra e a loja mostra aprovada.
reset role;
update verificacoes_loja set status='revisao_amostra', amostra=true where vitrine_id='71000000-0000-4000-a000-000000000a0a';
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','aprovada',null,'verificacao_ia_aprovada',null,'{"origem":"teste"}'::jsonb);
set local role authenticated;
do $$ declare r record; begin
  select * into r from minha_verificacao_loja_envio();
  assert r.status='aprovada' and r.verificada is true, 'revisao_amostra com selo -> aprovada';
end $$;
reset role;
select pg_temp.confere((select verificacao_estado='aprovada' and selo_loja_verificada and verificacao_motivo is null
   from vitrines_lojas where id='71000000-0000-4000-a000-000000000a0a'), 'definir aprovada: estado e selo juntos');
select pg_temp.confere((select count(*)=1 from vitrines_acoes_admin where vitrine_id='71000000-0000-4000-a000-000000000a0a'
   and acao='verificacao_ia_aprovada' and admin_id is null and detalhes->>'origem'='teste' and detalhes ? 'revisao'), 'histórico da IA, sem autor, com detalhes');
select pg_temp.fecha('71000000-0000-4000-a000-000000000a0a','aprovada');
update verificacoes_loja set decidido_em=now() where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ declare r record; begin
  select * into r from minha_verificacao_loja_envio();
  assert r.status='aprovada' and r.decidido_em is not null, 'aprovada';
end $$;
-- Selo retirado sem mexer no pedido: a página não pode continuar dizendo "verificada".
reset role;
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','pendente',null,'verificacao_selo_removido','user_sup710',null);
select pg_temp.confere((select verificacao_estado='pendente' and not selo_loja_verificada from vitrines_lojas where id='71000000-0000-4000-a000-000000000a0a'), 'selo removido por definir');
select pg_temp.confere((select status='aprovada' from verificacoes_loja where vitrine_id='71000000-0000-4000-a000-000000000a0a'), 'pedido segue aprovado');
set local role authenticated;
do $$ declare r record; begin
  select * into r from minha_verificacao_loja_envio();
  assert r.status='nao_enviada' and r.verificada is false, 'selo removido: não diz mais aprovada';
end $$;
reset role;
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','arquivo_ilegivel','verificacao_ia_correcao',null,null);
update verificacoes_loja set status='correcao' where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ begin assert (select status||'/'||motivo from minha_verificacao_loja_envio())='correcao/arquivo_ilegivel', 'correcao'; end $$;
reset role;
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','recusada','cnpj_inativo','verificacao_ia_recusada',null,null);
update verificacoes_loja set status='recusada' where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ begin assert (select status||'/'||motivo from minha_verificacao_loja_envio())='recusada/cnpj_inativo', 'recusada'; end $$;
reset role;
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','pendente',null,'verificacao_revisada','user_sup710',null);
update verificacoes_loja set status='obsoleta' where vitrine_id='71000000-0000-4000-a000-000000000a0a';
set local role authenticated;
do $$ begin assert (select status from minha_verificacao_loja_envio())='obsoleta', 'obsoleta'; end $$;

-- [9] Decisão única: valida estado, motivo e ação; aceita os motivos novos.
reset role;
do $$ begin
  begin
    perform verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','talvez',null,'verificacao_revisada',null,null);
    raise exception 'Estado inválido aceito';
  exception when check_violation or invalid_parameter_value then null;
  end;
  begin
    perform verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','motivo_que_nao_existe','verificacao_revisada',null,null);
    raise exception 'Motivo inválido aceito';
  exception when check_violation then null;
  end;
  begin
    perform verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','dados_mudaram','acao_inventada',null,null);
    raise exception 'Ação inválida aceita';
  exception when check_violation then null;
  end;
end $$;
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','dados_mudaram','verificacao_revisada','user_sup710',null);
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','comprovante_invalido','verificacao_revisada','user_sup710',null);
select verificacao_loja_definir('71000000-0000-4000-a000-000000000a0a','correcao','cnpj_nao_encontrado','verificacao_revisada','user_sup710',null);

-- [10] admin_revisar_loja segue igual (mesma assinatura, guarda e erros) e usa a decisão única.
reset role;
select verificacao_revisao as rev from vitrines_lojas where id='71000000-0000-4000-a000-00000000000b' \gset
select set_config('teste.rev710', :'rev', true);
set local role authenticated;
set local request.jwt.claim.sub='user_sup710';
set local request.jwt.claim.role='authenticated';
do $$ declare rev integer := current_setting('teste.rev710')::integer; begin
  begin
    perform admin_revisar_loja('71000000-0000-4000-a000-00000000000b',rev,'aprovar',null,true,true,true);
    raise exception 'Aprovou sem WhatsApp confirmado';
  exception when check_violation then null;
  end;
  begin
    perform admin_revisar_loja('71000000-0000-4000-a000-00000000000b',rev+5,'recusar','titularidade',true,true,true);
    raise exception 'Revisão antiga aceita';
  exception when sqlstate 'P0001' then null;
  end;
  perform admin_revisar_loja('71000000-0000-4000-a000-00000000000b',rev,'recusar','titularidade',null,null,null);
end $$;
reset role;
select pg_temp.confere((select verificacao_estado='recusada' and verificacao_motivo='titularidade' and not selo_loja_verificada and verificacao_revisao=:rev+1
            from vitrines_lojas where id='71000000-0000-4000-a000-00000000000b'), 'admin_revisar_loja recusou pela decisão única');
select pg_temp.confere((select count(*)=1 from vitrines_acoes_admin where vitrine_id='71000000-0000-4000-a000-00000000000b'
            and acao='verificacao_recusada' and admin_id='user_sup710' and motivo='titularidade'
            and detalhes->>'decisao'='recusada' and detalhes->>'anterior'='pendente'), 'histórico da revisão manual');
rollback;
