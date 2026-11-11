begin;
select id as reg from microrregioes where slug = 'corrente-pi' \gset
update configuracoes set valor = 'true' where chave = 'robo.ativo';
update configuracoes set valor = '"https://abc.supabase.co"' where chave = 'fotos.origem';
insert into perfis (id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em)
values ('user_akiloja420', :'reg', 'Loja Aki Teste', 'Corrente', '5589999998420', now()),
       ('user_akioutro420', :'reg', 'Outra Loja Aki', 'Corrente', '5589999998421', now());
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_akiloja420';
select quero_vender_com_descricao('Loja Aki Teste', 'loja-aki-teste', '5589999998420', 'Corrente', 'Eletrodomésticos', 'Liquidificadores e batedeiras.');
do $$
begin
  assert (select categoria_loja = 'Eletrodomésticos' and sobre = 'Liquidificadores e batedeiras.'
    from vitrines_lojas where dono_id = 'user_akiloja420');
  begin
    update vitrines_lojas set banner_tipo = 'foto', banner_aki_posicao = 50,
      banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_akiloja420/vitrine/manual.webp'
      where dono_id = 'user_akiloja420';
    raise exception 'O teste não pode liberar banner manual';
  exception when insufficient_privilege then null; end;
  begin
    perform aki_reservar_imagem('user_akiloja420', gen_random_uuid(), 'banner', null, null);
    raise exception 'O navegador não pode reservar diretamente';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claim.role = '';
set local request.jwt.claim.sub = '';
do $$
declare
  uid text := 'user_akiloja420';
  falha uuid := gen_random_uuid();
  reserva_modelo bigint;
  produto uuid := '42a00000-0000-4000-a000-000000000002';
  original text := 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_akiloja420/42a00000-0000-4000-a000-000000000002/original.webp';
  arte uuid := '42a00000-0000-4000-a000-000000000001';
  url_arte text := 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_akiloja420/aki-banners/aki-42a00000-0000-4000-a000-000000000001.webp';
begin
  assert (select restantes = 1 and gratuito from aki_creditos_imagem(uid));
  assert aki_reservar_imagem(uid, falha, 'banner', null, null)->>'estado' = 'nova';
  assert aki_reservar_imagem(uid, falha, 'banner', null, null)->>'estado' = 'reservada';
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'banner', null, null)->>'estado' = 'sem_credito';
  update aki_imagens set estado = 'falhou' where id = falha;
  assert (select restantes = 1 from aki_creditos_imagem(uid));
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'produto', gen_random_uuid(), 'foto falsa')->>'estado' = 'invalida';
  assert aki_reservar_imagem(uid, arte, 'banner', null, null)->>'estado' = 'nova';
  update aki_imagens set estado = 'pronta', url = url_arte where id = arte;
  assert aki_reservar_imagem(uid, arte, 'banner', null, null)->>'url' = url_arte;
  assert (select restantes = 0 from aki_creditos_imagem(uid));
  update vitrines_lojas set plano = 'pf_gratis' where dono_id = uid;
  assert (select restantes = 0 and gratuito from aki_creditos_imagem(uid));
  update vitrines_lojas set plano = 'slim', plano_expira_em = now() + interval '25 days' where dono_id = uid;
  assert (select restantes = 3 and not gratuito from aki_creditos_imagem(uid));
  -- Na assinatura de vários períodos, o mês anterior não carrega uso.
  insert into aki_imagens(id, usuario_id, tipo, gratuito, estado, url, criada_em)
    values (gen_random_uuid(), uid, 'banner', false, 'pronta', url_arte || '?antiga', now() - interval '12 days');
  assert (select restantes = 3 from aki_creditos_imagem(uid));
  insert into anuncios(id, vitrine_id, status, fotos)
    select produto, id, 'rascunho', array[original] from vitrines_lojas where dono_id = uid;
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'banner', null, null)->>'estado' = 'nova';
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'produto', produto, original)->>'estado' = 'nova';
  assert (select restantes = 1 from aki_creditos_imagem(uid));
  update vitrines_lojas set plano = 'full' where dono_id = uid;
  assert (select restantes = 18 from aki_creditos_imagem(uid));
  update configuracoes set valor = '5' where chave = 'robo.lojista_creditos_full';
  assert (select restantes = 3 from aki_creditos_imagem(uid)), 'Cota editável preserva o uso do período';
  update configuracoes set valor = '1' where chave = 'robo.lojista_tentativas_dia';
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'banner', null, null)->>'estado' = 'limite_diario';
  assert (select restantes = 3 from aki_creditos_imagem(uid)), 'Bloqueio diário não debita crédito';
  update configuracoes set valor = '25' where chave = 'robo.lojista_tentativas_dia';
  delete from aki_imagens where id = falha;
  update configuracoes set valor = '4' where chave = 'robo.max_geracoes_imagem_mes';
  assert (select total = 4 from aki_tentativas_mes where mes = robo_inicio('mes')), 'Remover dados não devolve consumo da API';
  assert aki_reservar_imagem(uid, gen_random_uuid(), 'banner', null, null)->>'estado' = 'limite_global';
  assert (select restantes = 3 from aki_creditos_imagem(uid)), 'Bloqueio global não debita crédito';
  reserva_modelo := aki_reservar_cadastro(uid, 'gpt-6-sol');
  assert (select modelo = 'gpt-6-sol' from robo_uso where id = reserva_modelo), 'A reserva registra o modelo usado';
  update vitrines_lojas set plano = 'pf_gratis' where dono_id = uid;
end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_akioutro420';
do $$
begin
  begin
    perform aki_aplicar_banner('42a00000-0000-4000-a000-000000000001', 30);
    raise exception 'Conta alheia aplicou a arte';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = 'user_akiloja420';
select aki_aplicar_banner('42a00000-0000-4000-a000-000000000001', 30);
set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
do $$
declare v jsonb := vitrine_publica('loja-aki-teste');
begin
  assert v->>'banner_tipo' = 'foto' and v->>'banner_aki_posicao' = '30';
  assert v->>'categoria_loja' = 'Eletrodomésticos';
end $$;
-- A rota do Aki confere bloqueio e exclusão com a chave de serviço.
do $$
begin
  assert has_table_privilege('service_role', 'public.contas_bloqueadas', 'select');
  assert has_table_privilege('service_role', 'public.contas_revogadas', 'select');
  assert not has_table_privilege('authenticated', 'public.contas_bloqueadas', 'select');
end $$;
rollback;
