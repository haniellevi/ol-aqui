\set ON_ERROR_STOP on
\set QUIET on
-- Conversas (fase 2 do Radar v2): abrir pelo anúncio, enviar, ler, limites, telefone escondido
-- e acesso só de quem participa (cliente, dono e gerentes ativos da loja). Fixtures descartáveis.
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
update configuracoes set valor = '["palavrafake790"]' where chave = 'moderacao.palavras_bloqueadas' and microrregiao_id is null;
update configuracoes set valor = 'false' where chave = 'conversas.ativa' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q790cli',  :'regiao', 'Cliente Maria 790', '5589999979001', now(),  'Corrente', 'pf'),
  ('user_q790sem',  :'regiao', 'Sem celular 790',   '5589999979002', null,   'Corrente', 'pf'),
  ('user_q790dono', :'regiao', 'Dono Loja 790',     '5589999979003', now(),  'Corrente', 'pj'),
  ('user_q790ger',  :'regiao', 'Gerente 790',       '5589999979004', now(),  'Corrente', 'pf'),
  ('user_q790fora', :'regiao', 'De fora 790',       '5589999979005', now(),  'Corrente', 'pf'),
  ('user_q790pf',   :'regiao', 'Vendedor PF 790',   '5589999979006', now(),  'Corrente', 'pf');

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em) values
  ('user_q790dono', :'regiao', 'q790-loja', 'Loja Conversa 790', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day'),
  ('user_q790pf',   :'regiao', 'q790-pf',   'Vendedor PF 790',   'Corrente', 'pf',   'slim', now() + interval '10 days', now() - interval '1 day');
select id as vit from vitrines_lojas where slug = 'q790-loja' \gset
select id as vitpf from vitrines_lojas where slug = 'q790-pf' \gset
insert into convites_gerente_loja(vitrine_id, token_hash, telefone_hash, final_telefone, aceito_por, aceito_em)
  values (:'vit', '\x790790'::bytea, '\x790791'::bytea, '9004', 'user_q790ger', now());

insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, fotos) values
  ('79000000-0000-4000-b000-000000000001', :'vit',   :'moveis', 'Sofá azul de teste 790',    'Corrente', 50000, '{"estado":"usado"}', 'ativo', array['https://exemplo.test/790.jpg']),
  ('79000000-0000-4000-b000-000000000002', :'vit',   :'moveis', 'Poltrona de teste 790',     'Corrente', 30000, '{"estado":"usado"}', 'ativo', '{}'),
  ('79000000-0000-4000-b000-000000000003', :'vit',   :'moveis', 'Sofá pausado de teste 790', 'Corrente', 30000, '{"estado":"usado"}', 'ativo', '{}'),
  ('79000000-0000-4000-b000-000000000004', :'vitpf', :'moveis', 'Sofá do PF de teste 790',   'Corrente', 20000, '{"estado":"usado"}', 'ativo', '{}'),
  ('79000000-0000-4000-b000-000000000005', :'vitpf', :'moveis', 'Mesa do PF de teste 790',   'Corrente', 20000, '{"estado":"usado"}', 'ativo', '{}');
update anuncios set status = 'pausado' where id = '79000000-0000-4000-b000-000000000003';

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q790cli';

-- desligadas: nada funciona
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001')$$, 'P0001', 'não estão ligadas');
reset role;
update configuracoes set valor = 'true' where chave = 'conversas.ativa' and microrregiao_id is null;
set local role authenticated;

-- abrir pelo anúncio: reusa a conversa do par e põe cartão só quando muda o anúncio
select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001') as conv \gset
select pg_temp.confere(abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001') = :'conv', 'abrir de novo reusa a conversa');
select pg_temp.confere((select count(*) = 1 from conversa_mensagens_de(:'conv') where tipo = 'anuncio'), 'mesmo anúncio não repete o cartão');
select pg_temp.confere(abrir_conversa_anuncio('79000000-0000-4000-b000-000000000002') = :'conv', 'outro anúncio da mesma loja cai na mesma conversa');
select pg_temp.confere((select count(*) = 2 from conversa_mensagens_de(:'conv') where tipo = 'anuncio'), 'dois cartões de anúncio');
select pg_temp.confere((select anuncio_titulo = 'Sofá azul de teste 790' and anuncio_preco_centavos = 50000
    and anuncio_foto = 'https://exemplo.test/790.jpg' and anuncio_link like '/anuncio/%'
  from conversa_mensagens_de(:'conv') where tipo = 'anuncio' order by criado_em, id limit 1), 'cartão traz título, preço, foto e link');

select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000003')$$, 'P0002', 'não está mais no ar');
set local request.jwt.claim.sub='user_q790sem';
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001')$$, '42501', 'Confirme seu celular');
set local request.jwt.claim.sub='user_q790dono';
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001')$$, 'P0001', 'é seu');
set local request.jwt.claim.sub='user_q790ger';
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000002')$$, 'P0001', 'é seu');
set local request.jwt.claim.sub='';
set local request.jwt.claim.role='anon';
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000001')$$, '28000');
set local request.jwt.claim.role='authenticated';

-- limite de conversas novas por dia (reabrir não conta)
reset role;
update configuracoes set valor = '2' where chave = 'conversas.novas_por_dia' and microrregiao_id is null;
set local role authenticated;
set local request.jwt.claim.sub='user_q790cli';
select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000004') as convpf \gset
reset role;
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em)
  values ('user_q790fora', :'regiao', 'q790-outra', 'Outra loja 790', 'Corrente', 'loja', 'slim', now() + interval '10 days', now() - interval '1 day');
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status)
  select '79000000-0000-4000-b000-000000000006', id, :'moveis', 'Cadeira da outra loja 790', 'Corrente', 1000, '{"estado":"usado"}', 'ativo'
    from vitrines_lojas where slug = 'q790-outra';
set local role authenticated;
select pg_temp.recusa($$select abrir_conversa_anuncio('79000000-0000-4000-b000-000000000006')$$, 'P0001', 'muitas conversas');
select pg_temp.confere(abrir_conversa_anuncio('79000000-0000-4000-b000-000000000005') = :'convpf', 'reabrir conversa existente não conta no limite');
reset role;
update configuracoes set valor = '20' where chave = 'conversas.novas_por_dia' and microrregiao_id is null;
set local role authenticated;

-- envio, alerta de golpe e não lidas por lado
select enviar_mensagem(:'conv', '  oi, ainda tem?  ') as msg1 \gset
select pg_temp.confere((select texto = 'oi, ainda tem?' and lado = 'cliente' and not alerta_golpe from conversa_mensagens_de(:'conv') where id = :'msg1'), 'texto sem espaços nas pontas, lado cliente, sem alerta');
select pg_temp.confere((select nao_lidas = 0 from minhas_conversas() where id = :'conv'), 'quem enviou não tem não lidas');
set local request.jwt.claim.sub='user_q790dono';
select pg_temp.confere((select papel = 'loja' and nao_lidas = 1 from minhas_conversas() where id = :'conv'), 'dono vê 1 não lida');
select pg_temp.confere((select outro_nome = 'Cliente' from minhas_conversas() where id = :'conv'), 'loja vê só o primeiro nome do cliente');
select pg_temp.confere(conversas_nao_lidas() = 1, 'bolinha do dono = 1');
set local request.jwt.claim.sub='user_q790ger';
select pg_temp.confere(conversas_nao_lidas() = 1, 'bolinha do gerente = 1');
select marcar_conversa_lida(:'conv');
set local request.jwt.claim.sub='user_q790dono';
select pg_temp.confere(conversas_nao_lidas() = 0, 'lido pelo gerente vale para o lado da loja');
select enviar_mensagem(:'conv', 'Tem sim! Me chama 89 99999-0000') as msg2 \gset
select pg_temp.confere((select alerta_golpe and lado = 'loja' from conversa_mensagens_de(:'conv') where id = :'msg2'), 'telefone na mensagem liga o alerta');
select pg_temp.confere(conversa_texto_suspeito('veja em www.loja.com.br') and conversa_texto_suspeito('https://x.test')
  and not conversa_texto_suspeito('tem azul? custa 300 reais'), 'detector de link e telefone');
set local request.jwt.claim.sub='user_q790cli';
select pg_temp.confere((select outro_nome = 'Loja Conversa 790' and nao_lidas = 1 from minhas_conversas() where id = :'conv'), 'cliente vê nome da loja e 1 não lida');
select criado_em as t1 from conversa_mensagens_de(:'conv') where id = :'msg1' \gset
select pg_temp.confere((select array_agg(id) = array[:'msg2'::uuid] from conversa_mensagens_de(:'conv', :'t1')), 'p_depois traz só as novas');

-- validação, palavra proibida e ritmo
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', '   '), '23514');
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', repeat('a', 1001)), '23514');
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', 'isso é palavrafake790 mesmo'), 'P0001', 'palavrafake790');
reset role;
update configuracoes set valor = '3' where chave = 'conversas.mensagens_por_hora' and microrregiao_id is null;
set local role authenticated;
select enviar_mensagem(:'conv', 'segunda') \g /dev/null
select enviar_mensagem(:'conv', 'terceira') \g /dev/null
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', 'quarta'), 'P0001', 'Espere um pouco');
reset role;
update configuracoes set valor = '60' where chave = 'conversas.mensagens_por_hora' and microrregiao_id is null;
set local role authenticated;

-- quem não participa não vê nem escreve
set local request.jwt.claim.sub='user_q790fora';
select pg_temp.confere((select count(*) = 0 from conversa_mensagens_de(:'conv')), 'de fora não lê mensagens');
select pg_temp.confere((select count(*) = 0 from conversa_detalhe(:'conv')), 'de fora não vê detalhe');
select pg_temp.confere(not exists (select 1 from minhas_conversas() where id = :'conv'), 'de fora não lista');
select pg_temp.recusa(format('select enviar_mensagem(%L, %L)', :'conv', 'oi'), 'P0002', 'não encontrada');
select pg_temp.recusa('select count(*) from conversas', '42501');
select pg_temp.recusa('select count(*) from conversa_mensagens', '42501');

-- telefone escondido até o cliente mostrar (nenhuma leitura da loja traz o número antes)
set local request.jwt.claim.sub='user_q790dono';
select pg_temp.confere((select whatsapp_cliente is null and not whatsapp_liberado from conversa_detalhe(:'conv')), 'loja não vê o número antes');
select pg_temp.confere(not exists (select 1 from minhas_conversas() m where to_jsonb(m)::text like '%5589999979001%'), 'lista da loja sem o número');
select pg_temp.confere(not exists (select 1 from conversa_mensagens_de(:'conv') m where to_jsonb(m)::text like '%5589999979001%'), 'mensagens sem o número');
select pg_temp.confere(not exists (select 1 from conversa_detalhe(:'conv') m where to_jsonb(m)::text like '%5589999979001%'), 'detalhe sem o número');
select pg_temp.recusa(format('select mostrar_meu_whatsapp(%L)', :'conv'), '42501');
set local request.jwt.claim.sub='user_q790cli';
select mostrar_meu_whatsapp(:'conv');
select mostrar_meu_whatsapp(:'conv');
select pg_temp.confere((select count(*) = 1 from conversa_mensagens_de(:'conv') where tipo = 'sistema' and texto = 'O cliente mostrou o WhatsApp para a loja.'), 'uma mensagem do sistema, mesmo tocando 2 vezes');
select pg_temp.confere((select whatsapp_cliente is null and whatsapp_liberado from conversa_detalhe(:'conv')), 'cliente não recebe o próprio número no detalhe');
set local request.jwt.claim.sub='user_q790ger';
select pg_temp.confere((select whatsapp_cliente = '5589999979001' from conversa_detalhe(:'conv')), 'gerente vê o número depois de mostrado');

-- gerente com a ajuda revogada perde o acesso
reset role;
update convites_gerente_loja set revogado_em = now() where aceito_por = 'user_q790ger';
set local role authenticated;
select pg_temp.confere((select count(*) = 0 from conversa_detalhe(:'conv')), 'gerente revogado não vê detalhe');
select pg_temp.confere(not exists (select 1 from minhas_conversas() where id = :'conv'), 'gerente revogado não lista');
select pg_temp.confere(conversas_nao_lidas() = 0, 'gerente revogado sem bolinha');

rollback;
