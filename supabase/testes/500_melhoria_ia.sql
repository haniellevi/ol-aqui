\set ON_ERROR_STOP on
\set QUIET on
-- Vitrine com IA, etapa 5b: sugestão de texto e dicas de foto com IA, cota por plano e decisão do dono. Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='moveis' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_loja500',:'reg','Loja 500','Corrente','5589999990500',now()),
 ('user_outro500',:'reg','Outro 500','Corrente','5589999990501',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('50000000-0000-4000-a000-000000000001','user_loja500',:'reg','loja-500','Loja 500','Corrente','5589999990500','loja','slim',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,fotos,status,publicado_em) values
 ('50100000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000001',:'cat','Sofá 500','sofa bom','Corrente',90000,
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja500/50100000-0000-4000-a000-000000000001/1.webp',
        'https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja500/50100000-0000-4000-a000-000000000001/2.webp'],'ativo',now()),
 ('50100000-0000-4000-a000-000000000002','50000000-0000-4000-a000-000000000001',:'cat','Mesa 500','mesa','Corrente',50000,'{}','ativo',now()),
 ('50100000-0000-4000-a000-000000000003','50000000-0000-4000-a000-000000000001',:'cat','Rack 500','rack','Corrente',30000,'{}','ativo',now());
update configuracoes set valor='10000' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;

do $$ begin
  -- [1] Desligada e de outra pessoa: nada é reservado.
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500')->>'erro' = 'indisponivel', 'Desligada';
  update configuracoes set valor='true' where chave='vitrine_ia.ativa' and microrregiao_id is null;
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500')->>'erro' = 'indisponivel', 'Só a vitrine nova não basta';
  update configuracoes set valor='true' where chave='vitrine_ia.melhoria_ativa' and microrregiao_id is null;
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_outro500')->>'erro' = 'nao_encontrado', 'Outra pessoa';
  assert not exists(select 1 from melhorias_ia), 'Nada reservado';
end $$;

create temp table pedido500 as select melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500') as r;
do $$
declare r jsonb := (select r from pedido500);
begin
  -- [2] Só o produto vai para a IA.
  assert (select array_agg(k order by k) from jsonb_object_keys(r) k)
       = array['atributos','categoria','descricao','fotos','id','modelo','reserva','titulo'], 'Nada da pessoa vai para a IA';
  assert jsonb_array_length(r->'fotos') = 2 and r->>'categoria' like '%Móveis', 'Fotos e categoria';
  assert (select erro='em_andamento' and usuario_id='user_loja500' and tipo='melhoria' from robo_uso where id=(select uso_id from melhorias_ia where id=(r->>'id')::uuid)), 'Reserva no livro-caixa';
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500')->>'erro' = 'ocupado', 'Um pedido por produto de cada vez';
  -- [3] Conclusão: título com telefone cai; descrição boa fica; dica de foto inexistente ou fora da lista cai.
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, jsonb_build_object(
    'titulo', 'Sofá 3 lugares chama 89 99999-0000',
    'descricao', 'Sofá de 3 lugares em bom estado, tecido sem rasgos. Retirada no centro de Corrente.',
    'fotos', jsonb_build_array(
      jsonb_build_object('indice', 1, 'problema', 'escura', 'dica', 'Tire a foto de dia, perto da janela, sem flash.'),
      jsonb_build_object('indice', 1, 'problema', 'fundo', 'dica', 'Repetida: não entra de novo nesta lista.'),
      jsonb_build_object('indice', 5, 'problema', 'escura', 'dica', 'Foto que não existe no anúncio.'),
      jsonb_build_object('indice', 2, 'problema', 'bonita', 'dica', 'Problema fora da lista de problemas.'))),
    0.001, 1200, 150) = 'pronta', 'Pronta';
  assert (select titulo_novo is null and descricao_nova like 'Sofá de 3 lugares%' and jsonb_array_length(dicas_foto)=1
            and dicas_foto->0->>'problema'='escura' from melhorias_ia where id=(r->>'id')::uuid), 'Só o que é seguro fica';
  assert (select erro is null and custo_centavos > 0 and tokens_entrada=1200 from robo_uso where id=(select uso_id from melhorias_ia where id=(r->>'id')::uuid)), 'Custo real';
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, '{}'::jsonb) is null, 'Não conclui duas vezes';
end $$;

-- [4] Dono vê e decide; outra pessoa não.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_outro500';
do $$ begin
  begin
    perform minha_melhoria_ia('50100000-0000-4000-a000-000000000001');
    raise exception 'Outra pessoa viu a sugestão';
  exception when insufficient_privilege then null; end;
  begin
    perform melhoria_ia_decidir((select r->>'id' from pedido500)::uuid, true);
    raise exception 'Outra pessoa aplicou';
  exception when insufficient_privilege then null; end;
  assert (select count(*)=0 from melhorias_ia), 'Outra pessoa não lê';
  begin
    perform melhoria_ia_reservar('50100000-0000-4000-a000-000000000002','user_outro500');
    raise exception 'Navegador reservou direto';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_loja500';
do $$
declare t jsonb := minha_melhoria_ia('50100000-0000-4000-a000-000000000001');
begin
  assert (t->>'ativa')::boolean and (t->>'limite')::int = 20 and (t->>'usadas')::int = 1, 'Cota do Slim: '||t::text;
  assert t->'melhoria'->>'estado' = 'pronta' and t->'anuncio'->>'titulo' = 'Sofá 500', 'Sugestão aberta';
  assert melhoria_ia_decidir((t->'melhoria'->>'id')::uuid, true) = 'aplicada', 'Aplicada';
  assert (select titulo = 'Sofá 500' and descricao like 'Sofá de 3 lugares%' from anuncios where id='50100000-0000-4000-a000-000000000001'), 'Texto trocado';
  assert melhoria_ia_decidir((t->'melhoria'->>'id')::uuid, true) = 'aplicada', 'Repetir é seguro';
  assert minha_melhoria_ia('50100000-0000-4000-a000-000000000001')->'melhoria' = 'null'::jsonb, 'Nada aberto depois de decidir';
end $$;
reset role;

-- [5] Anúncio mudou depois do pedido: nada é trocado. Recusar não muda nada.
do $$
declare r jsonb := melhoria_ia_reservar('50100000-0000-4000-a000-000000000002','user_loja500');
declare r2 jsonb := melhoria_ia_reservar('50100000-0000-4000-a000-000000000003','user_loja500');
begin
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, jsonb_build_object('titulo','Mesa de jantar de madeira 6 lugares','descricao','','fotos','[]'::jsonb), 0.001) = 'pronta', 'Pronta 2';
  update anuncios set descricao = 'mesa nova descrição' where id = '50100000-0000-4000-a000-000000000002';
  assert melhoria_ia_concluir((r2->>'id')::uuid, (r2->>'reserva')::uuid, jsonb_build_object('titulo','Rack de sala branco com 2 portas','fotos','[]'::jsonb), 0.001) = 'pronta', 'Pronta 3';
  perform set_config('request.jwt.claim.sub', 'user_loja500', true);
  assert melhoria_ia_decidir((r->>'id')::uuid, true) = 'desatualizada', 'Desatualizada';
  assert (select titulo = 'Mesa 500' from anuncios where id='50100000-0000-4000-a000-000000000002'), 'Mesa não mudou';
  assert melhoria_ia_decidir((r2->>'id')::uuid, false) = 'recusada', 'Recusada';
  assert (select titulo = 'Rack 500' from anuncios where id='50100000-0000-4000-a000-000000000003'), 'Rack não mudou';
end $$;

-- [6] Falha não conta; o limite do mês segura; IA sem nada a melhorar fica "pronta" vazia.
do $$
declare r jsonb;
begin
  r := melhoria_ia_reservar('50100000-0000-4000-a000-000000000003','user_loja500');
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, null) = 'falhou', 'Falha';
  assert (select erro='custo_indeterminado' from robo_uso where id=(select uso_id from melhorias_ia where id=(r->>'id')::uuid)), 'Sem custo mantém a reserva';
  r := melhoria_ia_reservar('50100000-0000-4000-a000-000000000003','user_loja500');
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, jsonb_build_object('titulo','Rack 500','descricao','rack','fotos','[]'::jsonb), 0.001) = 'pronta', 'Já está bom';
  assert (select usadas = 4 from (select (melhoria_ia_cota(v)->>'usadas')::int usadas from vitrines_lojas v where v.id='50000000-0000-4000-a000-000000000001') x), 'Já está bom conta';
  -- Tudo recusado (telefone, descrição vazia, dica inválida) é falha, não "já está bom", e não conta.
  r := melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500');
  assert melhoria_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, jsonb_build_object('titulo','Sofá ligue 89 99999-0000','descricao','',
    'fotos', jsonb_build_array(jsonb_build_object('indice', 9, 'problema', 'escura', 'dica', 'Foto que não existe.'))), 0.001) = 'falhou', 'Tudo recusado é falha';
  -- Pedido travado some da tela depois de 3 minutos e o próximo pedido o encerra.
  r := melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500');
  update melhorias_ia set criado_em = now() - interval '5 minutes' where id = (r->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', 'user_loja500', true);
  assert minha_melhoria_ia('50100000-0000-4000-a000-000000000001')->'melhoria' = 'null'::jsonb, 'Travado não prende a tela';
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000001','user_loja500')->>'erro' is null, 'Pode pedir de novo';
  assert (select estado='falhou' from melhorias_ia where id=(r->>'id')::uuid), 'Travado encerrado';
  update configuracoes set valor='{"slim": 5}' where chave='vitrine_ia.melhorias_mes' and microrregiao_id is null;
  r := melhoria_ia_reservar('50100000-0000-4000-a000-000000000002','user_loja500');
  assert r->>'erro' = 'limite' and (r->>'limite')::int = 5 and (r->>'usadas')::int = 5, 'Limite do mês: '||r::text;
  update configuracoes set valor='{"slim": 20}' where chave='vitrine_ia.melhorias_mes' and microrregiao_id is null;
  update configuracoes set valor='0' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
  assert melhoria_ia_reservar('50100000-0000-4000-a000-000000000002','user_loja500')->>'erro' = 'orcamento', 'Sem orçamento';
  -- Texto seguro: sem link, e-mail ou telefone.
  assert melhoria_texto_seguro('Mesa de 1,80 m por R$ 1.200,00') and not melhoria_texto_seguro('veja www.loja.com')
     and not melhoria_texto_seguro('fale em a@b.com') and not melhoria_texto_seguro('ligue (89) 99999-0000'), 'Texto seguro';
end $$;
rollback;
