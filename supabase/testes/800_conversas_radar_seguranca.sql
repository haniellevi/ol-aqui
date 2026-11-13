\set ON_ERROR_STOP on
\set QUIET on
-- Conversas: proposta do Radar abre a conversa (cartão), bloquear, denunciar (já bloqueia),
-- leitura do admin só em conversa denunciada (registrada) e limpeza depois de 180 dias.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text, trecho text default null) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo and (trecho is null or sqlerrm like '%' || trecho || '%') then return; end if;
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;
update configuracoes set valor = 'false' where chave = 'conversas.ativa' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q800cli',  :'regiao', 'Cliente 800',  '5589999980001', now(), 'Corrente', 'pf'),
  ('user_q800dono', :'regiao', 'Dono 800',     '5589999980002', now(), 'Corrente', 'pj'),
  ('user_q800adm',  :'regiao', 'Admin 800',    '5589999980003', now(), 'Corrente', 'pf'),
  ('user_q800cli2', :'regiao', 'Cliente2 800', '5589999980004', now(), 'Corrente', 'pf');
update perfis set e_admin = true where id = 'user_q800adm';
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em) values
  ('user_q800dono', :'regiao', 'q800-loja', 'Loja 800', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day');
select id as vit from vitrines_lojas where slug = 'q800-loja' \gset
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('80000000-0000-4000-b000-000000000001', :'vit', :'moveis', 'Sofá cinza de teste 800', 'Corrente', 40000, '{"estado":"usado"}', 'ativo');
insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, visibilidade, categoria_id) values
  ('80000000-0000-4000-a000-000000000001','user_q800cli',:'regiao','Procuro sofá cinza 800','Corrente','whatsapp_direto','lojas',:'moveis'),
  ('80000000-0000-4000-a000-000000000002','user_q800cli',:'regiao','Procuro mesa grande 800','Corrente','whatsapp_direto','lojas',:'moveis'),
  ('80000000-0000-4000-a000-000000000003','user_q800cli',:'regiao','Procuro cadeira boa 800','Corrente','whatsapp_direto','lojas',:'moveis'),
  ('80000000-0000-4000-a000-000000000004','user_q800cli',:'regiao','Procuro estante alta 800','Corrente','whatsapp_direto','lojas',:'moveis');

-- desligadas: proposta não abre conversa
insert into radar_propostas(id, pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos) values
  ('80000000-0000-4000-c000-000000000001','80000000-0000-4000-a000-000000000001',:'vit','80000000-0000-4000-b000-000000000001','Tenho esse', 39000);
select pg_temp.confere(not exists (select 1 from conversas where cliente_id = 'user_q800cli'), 'desligadas: proposta não cria conversa');

update configuracoes set valor = 'true' where chave = 'conversas.ativa' and microrregiao_id is null;
insert into radar_propostas(id, pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos) values
  ('80000000-0000-4000-c000-000000000002','80000000-0000-4000-a000-000000000002',:'vit','80000000-0000-4000-b000-000000000001','Tenho uma mesa', 50000);
select id as conv from conversas where cliente_id = 'user_q800cli' and vitrine_id = :'vit' \gset
select pg_temp.confere((select origem = 'radar' from conversas where id = :'conv'), 'conversa nasce do Radar');
select pg_temp.confere((select count(*) = 1 from conversa_mensagens where conversa_id = :'conv' and tipo = 'proposta' and lado = 'loja'
    and pedido_id = '80000000-0000-4000-a000-000000000002' and proposta_id = '80000000-0000-4000-c000-000000000002'
    and anuncio_id = '80000000-0000-4000-b000-000000000001' and texto = 'Tenho uma mesa'), 'cartão da proposta com pedido, anúncio e mensagem');
update radar_propostas set mensagem = 'Tenho uma mesa, faço por 480' where id = '80000000-0000-4000-c000-000000000002';
select pg_temp.confere((select count(*) = 1 from conversa_mensagens where conversa_id = :'conv'), 'editar a proposta não cria outro cartão');
insert into radar_propostas(id, pedido_id, vitrine_id, mensagem) values
  ('80000000-0000-4000-c000-000000000003','80000000-0000-4000-a000-000000000003',:'vit', null);
select pg_temp.confere((select count(*) = 1 from conversas where cliente_id = 'user_q800cli'), 'outro pedido do mesmo cliente: mesma conversa');
select pg_temp.confere((select count(*) = 2 from conversa_mensagens where conversa_id = :'conv' and tipo = 'proposta'), 'dois cartões de proposta');

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q800cli';
select pg_temp.confere((select nao_lidas = 2 and ultima_texto = 'Proposta: Procuro cadeira boa 800' from minhas_conversas() where id = :'conv'), 'cliente vê 2 propostas não lidas');
select pg_temp.confere((select pedido_titulo = 'Procuro mesa grande 800' and proposta_preco_centavos = 50000
  from conversa_mensagens_de(:'conv') where tipo = 'proposta' order by criado_em limit 1), 'cartão mostra título do pedido e preço');

-- bloquear (pelo cliente): loja não envia, cliente não abre, loja não propõe; desbloquear volta
select bloquear_conversa(:'conv', true);
select pg_temp.confere((select eu_bloqueei and not fui_bloqueado from conversa_detalhe(:'conv')), 'cliente vê que bloqueou');
select pg_temp.recusa($$select abrir_conversa_anuncio('80000000-0000-4000-b000-000000000001')$$, '42501');
set local request.jwt.claim.sub='user_q800dono';
select pg_temp.confere((select fui_bloqueado and not eu_bloqueei from conversa_detalhe(:'conv')), 'loja vê que foi bloqueada');
select pg_temp.confere((select bloqueada from minhas_conversas() where id = :'conv'), 'lista marca bloqueada');
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', 'oi'), '42501', 'bloqueada');
reset role;
select pg_temp.recusa($$insert into radar_propostas(pedido_id, vitrine_id) values ('80000000-0000-4000-a000-000000000004', (select id from vitrines_lojas where slug = 'q800-loja'))$$, '42501', 'não recebe propostas');
set local role authenticated;
set local request.jwt.claim.sub='user_q800cli';
select bloquear_conversa(:'conv', false);
select enviar_mensagem(:'conv', 'pode mandar foto?') \g /dev/null
set local request.jwt.claim.sub='user_q800adm';
select pg_temp.recusa(format('select bloquear_conversa(%L, true)', :'conv'), 'P0002');

-- denunciar já bloqueia; repetida devolve a mesma; não dá para denunciar direto pela API
set local request.jwt.claim.sub='user_q800dono';
select denunciar_conversa(:'conv', 'golpe', 'pediu pix adiantado') as den \gset
select pg_temp.confere(denunciar_conversa(:'conv', 'golpe') = :'den', 'denúncia repetida devolve a mesma');
select pg_temp.recusa(format('select denunciar_conversa(%L, %L)', :'conv', 'spam'), '23514');
select pg_temp.confere((select eu_bloqueei from conversa_detalhe(:'conv')), 'denunciar bloqueou');
set local request.jwt.claim.sub='user_q800cli2';
select pg_temp.recusa(format('select denunciar_conversa(%L, %L)', :'conv', 'golpe'), 'P0002');
select pg_temp.recusa(format($q$insert into denuncias(alvo_tipo, alvo_id, denunciante_id, motivo) values ('conversa', %L, 'user_q800cli2', 'golpe')$q$, :'conv'), '42501');
reset role;
select pg_temp.confere((select alvo_tipo = 'conversa' and alvo_id = :'conv' and denunciante_id = 'user_q800dono' and status = 'aberta'
  from denuncias where id = :'den'), 'denúncia na fila da equipe');

-- leitura do admin: só conversa denunciada, e registrada
insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q800c3', :'regiao', 'Cliente3 800', '5589999980005', now(), 'Corrente', 'pf');
set local role authenticated;
set local request.jwt.claim.sub='user_q800c3';
select abrir_conversa_anuncio('80000000-0000-4000-b000-000000000001') as conv2 \gset
set local request.jwt.claim.sub='user_q800adm';
select pg_temp.recusa(format('select count(*) from admin_ler_conversa(%L)', :'conv2'), '42501', 'denunciada');
select pg_temp.confere((select count(*) >= 3 from admin_ler_conversa(:'conv')), 'admin lê a conversa denunciada');
select pg_temp.confere((select bool_or(autor_nome = 'Cliente 800') from admin_ler_conversa(:'conv')), 'admin vê o nome do autor');
set local request.jwt.claim.sub='user_q800cli';
select pg_temp.recusa(format('select count(*) from admin_ler_conversa(%L)', :'conv'), '42501');
reset role;
select pg_temp.confere((select count(*) = 2 from conversa_leituras_admin where conversa_id = :'conv' and admin_id = 'user_q800adm'), 'cada leitura do admin fica registrada');

-- limpeza: 200 dias sem mensagem apaga, a não ser com denúncia aberta
update conversas set ultima_msg_em = now() - interval '200 days' where id in (:'conv', :'conv2');
set local role authenticated;
select pg_temp.recusa('select conversas_limpar()', '42501');
reset role;
set local role service_role;
select pg_temp.confere(conversas_limpar() >= 1, 'rotina apaga a conversa velha');
reset role;
select pg_temp.confere(not exists (select 1 from conversas where id = :'conv2') and not exists (select 1 from conversa_mensagens where conversa_id = :'conv2'), 'conversa velha sem denúncia some com as mensagens');
select pg_temp.confere(exists (select 1 from conversas where id = :'conv'), 'conversa com denúncia aberta fica');
update denuncias set status = 'improcedente' where id = :'den';
set local role service_role;
select pg_temp.confere(conversas_limpar() = 1, 'depois de decidida, a denúncia não segura mais');
reset role;
select pg_temp.confere(not exists (select 1 from conversas where id = :'conv'), 'apagada');

rollback;
