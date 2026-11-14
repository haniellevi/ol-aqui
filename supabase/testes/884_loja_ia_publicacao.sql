begin;
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_ia884a', id, 'Teste IA', 'Corrente', '5589999010884', now()
from public.microrregioes where slug='corrente-pi';
insert into public.loja_ia_convites(usuario_id) values ('user_ia884a');
set local role authenticated;
set local request.jwt.claim.sub='user_ia884a';
select public.loja_ia_abrir_coleta()->>'id' as id \gset
reset role;
update public.loja_ia_rascunhos set estado='pronto' where id=:'id';
insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho,sha256)
values
  ('88400000-0000-4000-8000-000000000001', :'id', 'logo-884.webp','logo','enviada','pronta','image/webp',100,repeat('a',64)),
  ('88400000-0000-4000-8000-000000000002', :'id', 'capa-884.webp','capa','merc','pronta','image/webp',100,repeat('b',64)),
  ('88400000-0000-4000-8000-000000000003', :'id', 'sobra-884.webp','foto','enviada','pronta','image/webp',100,repeat('c',64));
update public.configuracoes set valor='"https://store-fixture.invalid"'::jsonb where chave='fotos.origem' and microrregiao_id is null;
do $$ begin
  assert public.loja_ia_imagem_publica('88400000-0000-4000-8000-000000000001') is null, 'Imagem ainda privada';
end $$;
set local role authenticated;
do $$
declare r jsonb := public.loja_ia_obter(); id_ uuid := (r->>'id')::uuid; res public.vendedor_resumo;
  campos jsonb := '{"nome":"Teste loja IA 884","cidade":"Corrente","slug":"loja-ia-884","sobre":"Descrição revisada","whatsapp":"5589999010884","instagram":"loja884","endereco":"Rua teste","site":"https://example.com"}';
begin
  begin
    perform public.loja_ia_publicar(id_,100,campos,'{}');
    raise exception 'Publicação aceitou revisão vencida';
  exception when serialization_failure then null; end;
  begin
    perform public.loja_ia_publicar(id_,0,campos || '{"site":"javascript:void(0)"}','{}');
    raise exception 'Publicação aceitou site inválido';
  exception when check_violation then null; end;
  begin
    perform public.loja_ia_publicar(id_,0,campos,'{"logo":"10000000-1234-4234-9234-123456789012"}');
    raise exception 'Publicação aceitou imagem estranha';
  exception when insufficient_privilege then null; end;
  assert public.vitrine_publica('loja-ia-884') is null,'Detalhes inválidos devem reverter a criação';
  res := public.loja_ia_publicar(id_,0,campos,'{"logo":"88400000-0000-4000-8000-000000000001","capa":"88400000-0000-4000-8000-000000000002"}');
  assert res.slug='loja-ia-884' and res.teste_expira_em is not null,'Criou uma vitrine com teste';
  assert res = public.loja_ia_publicar(id_,0,'{}','{}'),'Repetir retorna o mesmo resultado';
  assert res = public.loja_cadastro_manual('Nome antigo','slug-antigo','5589999010884','Corrente','antiga','Outra descrição'),
    'Formulário manual antigo não altera a loja do piloto';
end $$;
reset role;
do $$
begin
  assert exists(select 1 from public.vitrines_lojas where slug='loja-ia-884' and site_url='https://example.com'
    and instagram='loja884' and endereco='Rua teste' and sobre='Descrição revisada'),'Dados extras juntos';
  assert public.loja_ia_imagem_publica('88400000-0000-4000-8000-000000000001')='logo-884.webp','Logo fica pública com a vitrine';
  assert public.loja_ia_imagem_publica('88400000-0000-4000-8000-000000000002')='capa-884.webp','Capa selecionada fica pública';
  assert public.loja_ia_imagem_publica('88400000-0000-4000-8000-000000000003') is null,'Imagem não escolhida continua privada';
end $$;
-- O cadastro manual também conclui um rascunho em andamento, sem usar seus dados.
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_ia884b', id, 'Teste manual', 'Corrente', '5589999020884', now()
from public.microrregioes where slug='corrente-pi';
insert into public.loja_ia_convites(usuario_id) values ('user_ia884b');
set local role authenticated;
set local request.jwt.claim.sub='user_ia884b';
select public.loja_ia_abrir_coleta()->>'id' as manual_id \gset
reset role;
update public.loja_ia_rascunhos set estado='processando' where id=:'manual_id';
set local role authenticated;
select (public.loja_cadastro_manual('Loja manual 884', 'loja-manual-884', '5589999020884','Corrente',null,null)).vitrine_id as manual_vitrine \gset
reset role;
select set_config('test.ia_manual_rascunho', :'manual_id', true);
select set_config('test.ia_manual_vitrine', :'manual_vitrine', true);
do $$ begin
  assert exists(select 1 from public.loja_ia_rascunhos where id=current_setting('test.ia_manual_rascunho')::uuid
    and estado='publicado' and vitrine_id=current_setting('test.ia_manual_vitrine')::uuid), 'Cadastro manual aposenta rascunho concorrente';
end $$;

-- A exclusão definitiva já existente continua funcionando após a publicação.
update public.vitrines_lojas set status='suspensa', excluida_em=now()-interval '31 days' where slug='loja-ia-884';
insert into public.lixeira_lojas(vitrine_id, apagar_apos, origem, status_anterior)
select id, now()-interval '1 day', 'dono', 'ativa' from public.vitrines_lojas where slug='loja-ia-884';
select public.purgar_loja(id) from public.vitrines_lojas where slug='loja-ia-884';
do $$ begin
  assert not exists(select 1 from public.vitrines_lojas where slug='loja-ia-884'), 'Vitrine foi excluída';
  assert exists(select 1 from public.loja_ia_rascunhos where dono_id='user_ia884a'
    and estado='publicado' and vitrine_id is null), 'Histórico fica sem vínculo com a vitrine excluída';
end $$;
rollback;
