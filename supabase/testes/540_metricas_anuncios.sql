\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P4: métricas do produto (números diários, termos, aparições, favoritar, tempo até sair e leituras).
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_dono540',:'reg','Dono 540','Corrente','5589999990540',now(),false),
 ('user_outro540',:'reg','Outro 540','Corrente','5589999990541',now(),false),
 ('user_visitante540',:'reg','Visitante 540','Corrente','5589999990542',now(),false),
 ('user_admin540',:'reg','Admin 540','Corrente','5589999990543',now(),true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('54000000-0000-4000-a000-000000000001','user_dono540',:'reg','loja-540','Loja 540','Corrente','5589999990540','loja','slim',now()+interval '30 days'),
 ('54000000-0000-4000-a000-000000000002','user_outro540',:'reg','outra-540','Outra 540','Corrente','5589999990541','loja','slim',now()+interval '30 days');
insert into anuncios(id,vitrine_id,microrregiao_id,categoria_id,titulo,descricao,cidade,preco_centavos,fotos,status,publicado_em) values
 ('54100000-0000-4000-a000-000000000001','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Sofá 540 A',null,'Corrente',null,'{}','ativo',now()-interval '10 days'),
 ('54100000-0000-4000-a000-000000000002','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Mesa 540 B',null,'Corrente',null,'{}','ativo',now()),
 ('54100000-0000-4000-a000-000000000003','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Cadeira 540 C',null,'Corrente',null,'{}','ativo',now()-interval '20 days'),
 ('54100000-0000-4000-a000-000000000004','54000000-0000-4000-a000-000000000002',:'reg',:'cat','Estante 540 D',null,'Corrente',null,'{}','ativo',now()),
 ('54100000-0000-4000-a000-000000000005','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Rascunho 540 E',null,'Corrente',null,'{}','rascunho',null);

-- [1] Evento vira número do dia; visitante repetido não conta de novo; o dono não conta; cliente não envia 'favoritar'.
do $$ declare ok boolean; begin
  set local request.jwt.claim.role='service_role';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-1',null,null) = true, 'Primeira visualização não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-2',null,null) = true, 'Segunda visualização não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-2',null,null) = false, 'Repetição do mesmo visitante contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','clique_whatsapp','ip-540-1',null,null) = true, 'Clique não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','compartilhar','ip-540-1',null,null) = true, 'Compartilhar não contou';
  ok := registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-dono','user_dono540',null);
  assert ok = false, 'Visualização do próprio dono contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','favoritar','ip-540-1',null,null) = false, 'Cliente conseguiu enviar favoritar';
  set local request.jwt.claim.role='';
  assert (select visualizacoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = 2, 'Visualizações do dia erradas';
  assert (select cliques_whatsapp from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = 1, 'Cliques do dia erradas';
  assert (select compartilhamentos from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = 1, 'Compartilhamentos do dia erradas';
end $$;

-- [2] Favoritar vem do banco (inserção em favoritos), conta uma vez por inserção e não conta o dono.
insert into favoritos(usuario_id,anuncio_id) values ('user_visitante540','54100000-0000-4000-a000-000000000002');
insert into favoritos(usuario_id,anuncio_id) values ('user_dono540','54100000-0000-4000-a000-000000000002');
do $$ begin
  assert (select favoritos from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = 1, 'Favorito do dono contou ou favorito de cliente não contou';
  assert (select count(*) from eventos_anuncio where anuncio_id='54100000-0000-4000-a000-000000000002' and tipo='favoritar') = 1, 'Evento favoritar não foi gravado uma vez';
end $$;

-- [3] Aparições: soma no dia (contagem e soma das posições), por página, sem linha por aparição.
do $$ declare n integer; begin
  set local request.jwt.claim.role='service_role';
  n := registrar_aparicoes('busca','[{"id":"54100000-0000-4000-a000-000000000001","posicao":1},{"id":"54100000-0000-4000-a000-000000000002","posicao":4}]'::jsonb, null);
  assert n = 2, 'Aparições não contaram os dois anúncios: ' || n;
  n := registrar_aparicoes('inicio','[{"id":"54100000-0000-4000-a000-000000000001","posicao":3}]'::jsonb, null);
  assert n = 1, 'Segunda chamada não somou';
  -- o dono não conta as próprias aparições
  n := registrar_aparicoes('busca','[{"id":"54100000-0000-4000-a000-000000000002","posicao":2}]'::jsonb, 'user_dono540');
  assert n = 0, 'Aparição do dono contou';
  -- entradas inválidas: página, id, posição, rascunho e formato são ignorados
  assert registrar_aparicoes('xxx','[{"id":"54100000-0000-4000-a000-000000000001","posicao":1}]'::jsonb, null) = 0, 'Página inválida contou';
  assert registrar_aparicoes('busca','[{"id":"nao-e-uuid","posicao":1},{"id":"54100000-0000-4000-a000-000000000001","posicao":"x"}]'::jsonb, null) = 0, 'Entrada inválida contou';
  assert registrar_aparicoes('busca','[{"id":"54100000-0000-4000-a000-000000000005","posicao":1}]'::jsonb, null) = 0, 'Rascunho apareceu na lista';
  assert registrar_aparicoes('busca','{"id":"x"}'::jsonb, null) = 0, 'Payload que não é lista contou';
  -- no máximo 60 por chamada: 61 itens do mesmo anúncio contam 60
  n := registrar_aparicoes('loja', (select jsonb_agg(jsonb_build_object('id','54100000-0000-4000-a000-000000000003','posicao',1)) from generate_series(1,61)), null);
  assert n = 1, 'Lista com 61 itens não contou um anúncio';
  set local request.jwt.claim.role='';
  assert (select aparicoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000003' and dia=dia_metrica(now())) = 60, 'Limite de 60 por chamada não aplicado';
  assert (select aparicoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000001' and dia=dia_metrica(now())) = 2, 'Aparições somadas erradas';
  assert (select soma_posicao from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000001' and dia=dia_metrica(now())) = 4, 'Soma de posições errada';
  assert (select count(*) from anuncios_aparicoes_dia where anuncio_id='54100000-0000-4000-a000-000000000001') = 2, 'Página não separada';
  assert (select count(*) from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and aparicoes > 0) = 1, 'Dono contou nos números';
  -- só o servidor chama
  set local role authenticated;
  set local request.jwt.claim.sub='user_visitante540';
  begin
    perform registrar_aparicoes('busca','[{"id":"54100000-0000-4000-a000-000000000001","posicao":1}]'::jsonb, null);
    raise exception 'Cliente conseguiu registrar aparições';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local request.jwt.claim.sub='';
end $$;

-- [4] Termo de busca: só com a visualização que contou; normalizado; vazio e sem letras não entram.
do $$ begin
  assert normaliza_termo('  Ação  Ótima! 2 x ') = 'acao otima 2 x', 'Normalização errada';
  assert normaliza_termo('!!!') is null, 'Termo sem letras não virou nulo';
  assert normaliza_termo('   ') is null, 'Termo vazio não virou nulo';
  assert char_length(normaliza_termo(repeat('ab ', 40))) <= 60, 'Termo passou de 60 letras';
  set local request.jwt.claim.role='service_role';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-3',null,' Geladeira  Brastemp! ') = true, 'Visualização com termo não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-4',null,'Geladeira brastemp') = true, 'Segunda visualização com termo não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-5',null,'Refrigerador Ação') = true, 'Visualização com acento não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-6',null,'   ') = true, 'Visualização sem termo não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-7',null,'!!!') = true, 'Visualização com termo sem letras não contou';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','ip-540-3',null,'Geladeira outra') = false, 'Repetição do visitante gravou termo';
  assert registrar_evento('54100000-0000-4000-a000-000000000002','clique_whatsapp','ip-540-8',null,'sofa cama') = true, 'Clique não contou';
  set local request.jwt.claim.role='';
  assert (select vezes from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and termo='geladeira brastemp') = 2, 'Termo não somou o segundo visitante';
  assert (select count(*) from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and termo='refrigerador acao') = 1, 'Termo com acento não foi normalizado';
  assert (select count(*) from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and termo like '%sofa%') = 0, 'Clique gravou termo';
  assert (select count(*) from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002') = 2, 'Termos vazios ou repetidos entraram';
end $$;

-- [5] Quem lê: dono vê só os próprios anúncios; outra loja não vê; administrador vê todos.
do $$ declare n_dono integer; n_outro integer; n_admin integer; begin
  set local request.jwt.claim.role='service_role';
  assert registrar_evento('54100000-0000-4000-a000-000000000004','visualizacao','ip-540-9',null,'estante branca') = true, 'Visualização da outra loja não contou';
  set local request.jwt.claim.role='';
  set local role authenticated;
  set local request.jwt.claim.sub='user_dono540';
  select count(*) into n_dono from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000004';
  assert n_dono = 0, 'Dono viu número de outra loja';
  select count(*) into n_dono from anuncios_numeros_dia;
  assert n_dono >= 1, 'Dono não viu os próprios números';
  select count(*) into n_dono from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000004';
  assert n_dono = 0, 'Dono viu termo de outra loja';
  set local request.jwt.claim.sub='user_outro540';
  select count(*) into n_outro from anuncios_numeros_dia where anuncio_id in ('54100000-0000-4000-a000-000000000001','54100000-0000-4000-a000-000000000002');
  assert n_outro = 0, 'Outra loja viu números de anúncios alheios';
  set local request.jwt.claim.sub='user_admin540';
  select count(*) into n_admin from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000004';
  assert n_admin >= 1, 'Administrador não viu números';
  select count(*) into n_admin from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002';
  assert n_admin >= 1, 'Administrador não viu termos';
  reset role;
  set local request.jwt.claim.sub='';
end $$;

-- [6] Ninguém grava direto nas tabelas diárias (anônimo nem cliente logado).
do $$ begin
  set local role anon;
  begin
    insert into anuncios_numeros_dia(anuncio_id,dia,visualizacoes) values ('54100000-0000-4000-a000-000000000001', current_date, 99);
    raise exception 'Anônimo gravou número diário';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  set local request.jwt.claim.sub='user_dono540';
  begin
    update anuncios_numeros_dia set visualizacoes = 999;
    raise exception 'Cliente alterou número diário';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into anuncios_termos_dia(anuncio_id,dia,termo,vezes) values ('54100000-0000-4000-a000-000000000001', current_date, 'falso', 1);
    raise exception 'Cliente gravou termo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into eventos_anuncio(anuncio_id,tipo) values ('54100000-0000-4000-a000-000000000001','favoritar');
    raise exception 'Cliente gravou evento direto';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local request.jwt.claim.sub='';
end $$;

-- [7] Preenchimento: recalcula a partir dos eventos (idempotente) e volta os números apagados.
do $$ declare antes integer; depois integer; total integer; begin
  antes := (select visualizacoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now()));
  update anuncios_numeros_dia set visualizacoes = 0, favoritos = 0 where anuncio_id='54100000-0000-4000-a000-000000000002';
  total := preencher_numeros_dia();
  assert total > 0, 'Preenchimento não tocou em nenhum dia';
  depois := (select visualizacoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now()));
  assert depois = antes, 'Preenchimento não recalculou as visualizações';
  assert (select favoritos from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = 1, 'Preenchimento não recalculou favoritos';
  perform preencher_numeros_dia();
  assert (select visualizacoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000002' and dia=dia_metrica(now())) = antes, 'Repetir o preenchimento somou de novo';
  assert (select aparicoes from anuncios_numeros_dia where anuncio_id='54100000-0000-4000-a000-000000000001' and dia=dia_metrica(now())) = 2, 'Preenchimento mexeu nas aparições';
end $$;

-- [8] Tempo até sair: data de saída guardada pelo banco, mantida e limpa ao voltar a ficar 'ativo'.
do $$ begin
  update anuncios set status='pausado' where id='54100000-0000-4000-a000-000000000003';
  assert (select saiu_do_ar_em from anuncios where id='54100000-0000-4000-a000-000000000003') is not null, 'Pausar não gravou a saída';
  update anuncios set saiu_do_ar_em = '2000-01-01' where id='54100000-0000-4000-a000-000000000003';
  assert (select saiu_do_ar_em from anuncios where id='54100000-0000-4000-a000-000000000003') > '2020-01-01', 'Data de saída foi alterada direto';
  update anuncios set status='expirado' where id='54100000-0000-4000-a000-000000000003';
  assert (select saiu_do_ar_em from anuncios where id='54100000-0000-4000-a000-000000000003') > '2020-01-01', 'Mudar de pausado para expirado trocou a primeira saída';
  update anuncios set status='ativo' where id='54100000-0000-4000-a000-000000000003';
  assert (select saiu_do_ar_em from anuncios where id='54100000-0000-4000-a000-000000000003') is null, 'Voltar a ficar ativo não limpou a saída';
  update anuncios set status='vendido' where id='54100000-0000-4000-a000-000000000003';
  assert (select saiu_do_ar_em from anuncios where id='54100000-0000-4000-a000-000000000003') is not null, 'Vender não gravou a saída';
  assert (select floor(extract(epoch from (saiu_do_ar_em - publicado_em)) / 86400) from anuncios where id='54100000-0000-4000-a000-000000000003') = 20, 'Tempo até sair errado';
end $$;

-- [9] Dono: números por produto, com o período, a média de posição, o termo e o tempo até sair.
do $$ declare lista jsonb; a2 jsonb; a3 jsonb; vis integer; clq integer; begin
  set local role authenticated;
  set local request.jwt.claim.sub='user_dono540';
  lista := minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 30);
  assert jsonb_array_length(lista) = 3, 'Dono deveria ver 3 produtos (rascunho fica de fora): ' || jsonb_array_length(lista);
  select x into a2 from jsonb_array_elements(lista) x where x->>'anuncio_id' = '54100000-0000-4000-a000-000000000002';
  select x into a3 from jsonb_array_elements(lista) x where x->>'anuncio_id' = '54100000-0000-4000-a000-000000000003';
  vis := (select count(*) from eventos_anuncio where anuncio_id='54100000-0000-4000-a000-000000000002' and tipo='visualizacao');
  assert (a2->>'visualizacoes')::int = vis, 'Visualizações do dono erradas';
  clq := (select count(*) from eventos_anuncio where anuncio_id='54100000-0000-4000-a000-000000000002' and tipo='clique_whatsapp');
  assert (a2->>'cliques_whatsapp')::int = clq and clq = 2, 'Cliques do dono errados';
  assert (a2->>'favoritos')::int = 1, 'Favoritos do dono errados';
  assert (a2->>'posicao_media')::numeric = 4.0, 'Posição média errada: ' || coalesce(a2->>'posicao_media','null');
  assert (a2->>'pct_chamou')::int = least(100, round(100.0 * clq / vis)::int), 'Porcentagem de quem chamou errada';
  assert a2->'termos'->0->>'termo' = 'geladeira brastemp' and (a2->'termos'->0->>'vezes')::int = 2, 'Top termo errado';
  assert jsonb_array_length(a2->'termos') <= 3, 'Mais de 3 termos';
  assert a2->>'tempo_ate_sair_dias' is null, 'Anúncio no ar tem tempo até sair';
  assert (a3->>'tempo_ate_sair_dias')::int = 20 and (a3->>'no_ar')::boolean = false, 'Tempo até sair do produto vendido errado';
  assert a3->>'status' = 'vendido', 'Status do produto vendido errado';
  -- um número de 40 dias atrás fica de fora do período de 30 dias e entra no de 90
  reset role;
  insert into anuncios_numeros_dia(anuncio_id,dia,visualizacoes) values ('54100000-0000-4000-a000-000000000001', dia_metrica(now()) - 40, 99);
  set local role authenticated;
  assert (select (x->>'visualizacoes')::int from jsonb_array_elements(minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 30)) x where x->>'anuncio_id'='54100000-0000-4000-a000-000000000001') < 99, 'Número de 40 dias atrás entrou no período de 30';
  assert (select (x->>'visualizacoes')::int from jsonb_array_elements(minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 90)) x where x->>'anuncio_id'='54100000-0000-4000-a000-000000000001') >= 99, 'Período de 90 dias não trouxe o número antigo';
  assert jsonb_array_length(minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 5)) = 3, 'Período inválido não cai no padrão de 30';
  -- outra loja não lê a loja alheia
  reset role;
  set local role authenticated;
  set local request.jwt.claim.sub='user_outro540';
  begin
    perform minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 30);
    raise exception 'Outra loja leu o desempenho alheio';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local request.jwt.claim.sub='';
end $$;

-- [10] Administrador: produto, categoria e região; quem não é administrador não lê.
do $$ declare produtos jsonb; grupos jsonb; regioes jsonb; begin
  set local role authenticated;
  set local request.jwt.claim.sub='user_admin540';
  produtos := admin_metricas_produtos(30, 'produto');
  assert jsonb_array_length(produtos) >= 4, 'Administrador não viu os produtos de todas as lojas';
  assert exists (select 1 from jsonb_array_elements(produtos) x where x->>'anuncio_id' = '54100000-0000-4000-a000-000000000004'), 'Produto da outra loja ficou de fora';
  grupos := admin_metricas_produtos(30, 'categoria');
  assert jsonb_array_length(grupos) >= 1 and (grupos->0->>'produtos')::int >= 4, 'Visão por categoria sem a soma';
  regioes := admin_metricas_produtos(90, 'regiao');
  assert jsonb_array_length(regioes) >= 1 and regioes->0->>'rotulo' is not null, 'Visão por região vazia';
  assert jsonb_array_length(admin_metricas_produtos(5, 'xpto')) >= 4, 'Visão inválida não cai no produto';
  reset role;
  set local role authenticated;
  set local request.jwt.claim.sub='user_dono540';
  begin
    perform admin_metricas_produtos(30, 'produto');
    raise exception 'Dono leu o painel do administrador';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local request.jwt.claim.sub='';
end $$;

-- [11] Permissões de chamada: anônimo não lê as métricas do dono nem o painel do administrador.
do $$ begin
  set local role anon;
  begin
    perform minha_loja_metricas_produtos('54000000-0000-4000-a000-000000000001', 30);
    raise exception 'Anônimo leu as métricas do dono';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_metricas_produtos(30, 'produto');
    raise exception 'Anônimo leu o painel do administrador';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

select 'PASS 540' as resultado;
rollback;
