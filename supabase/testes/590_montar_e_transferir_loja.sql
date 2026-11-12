\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P5c: o super admin monta a loja escondida, deixa produtos prontos e convida o dono.
-- No aceite a loja vira do dono (WhatsApp dele, teste grátis do zero); depois as fotos mudam
-- de pasta (servidor) e os prontos vão ao ar. Quem já vende não recebe loja montada.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
select set_config('teste.reg', :'reg', true), set_config('teste.cat', :'diversos', true);
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin,e_super_admin) values
 ('user_super590',:'reg','Super 590','Corrente','5589999990591',now(),true,true),
 ('user_dono590',:'reg','Dono 590','Corrente','5589999990590',now(),false,false),
 ('user_vende590',:'reg','Vendedor 590','Corrente','5589999990592',now(),false,false),
 ('user_outro590',:'reg','Outro 590','Corrente','5589999990593',now(),false,false),
 ('user_admin590',:'reg','Admin 590','Corrente','5589999990594',now(),true,false);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo) values
 ('59000000-0000-4000-a000-000000000009','user_vende590',:'reg','vende-590','Já Vende 590','Corrente','5589999990592','loja');

set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- [1] Só o super admin monta loja e convida.
set local request.jwt.claim.sub='user_admin590';
do $$ begin
  begin perform super_montar_loja('Loja Proibida 590', 'proibida-590', current_setting('teste.reg')::uuid, 'Corrente');
    assert false, 'Admin comum montou loja';
  exception when sqlstate '42501' then null; end;
end $$;

-- [2] Super admin monta a loja: escondida, dono provisório, sem WhatsApp, e cuida dela como ajudante.
set local request.jwt.claim.sub='user_super590';
select super_montar_loja('Loja Montada 590', 'montada-590', :'reg', 'Corrente') as loja \gset
select set_config('teste.loja', :'loja', true);
reset role;
do $$ begin
  assert (select status = 'montagem' and dono_id like 'user_montagem%' and pasta_montagem = dono_id and whatsapp is null
            from vitrines_lojas where id = current_setting('teste.loja')::uuid), 'Loja nasce em montagem, sem WhatsApp';
end $$;
set local role authenticated;
do $$
declare v record; l uuid := current_setting('teste.loja')::uuid; a uuid; n int;
begin
  select x.dono_id, x.pasta_montagem into v from vitrines_lojas x where x.id = l;
  assert v.pasta_montagem = v.dono_id, 'Super admin lê a loja em montagem';
  assert exists (select 1 from minhas_lojas() m where m.id = l and not m.dono and m.nome like '%(em montagem)'), 'Seletor do super admin';
  assert l = any(lojas_que_ajudo()) and pode_mexer_vitrine(l), 'Super admin cuida da loja em montagem';
  assert pode_enviar_foto(v.dono_id || '/loja/logo-1.webp'), 'Super admin envia a logo';
  update vitrines_lojas set logo_url = 'https://exemplo.supabase.co/storage/v1/object/public/anuncios/' || v.dono_id || '/loja/logo-1.webp',
                            bairro = 'Centro' where id = l;
  get diagnostics n = row_count; assert n = 1, 'Super admin editou a loja em montagem';
  begin update vitrines_lojas set whatsapp = '5589999990590' where id = l; assert false, 'WhatsApp na montagem';
  exception when sqlstate '23514' then null; end;
  begin update vitrines_lojas set status = 'ativa' where id = l; assert false, 'Pôs no ar sem o dono';
  exception when sqlstate '42501' then null; end;

  insert into anuncios(vitrine_id, categoria_id, titulo, cidade, preco_centavos, status, fotos)
  values (l, current_setting('teste.cat')::uuid, 'Panela 590', 'Corrente', 4500, 'rascunho',
          array['https://exemplo.supabase.co/storage/v1/object/public/anuncios/' || v.dono_id || '/59100000-0000-4000-a000-000000000001/a.webp'])
  returning id into a;
  perform set_config('teste.pronto', a::text, true);
  assert pode_enviar_foto(v.dono_id || '/' || a || '/b.webp'), 'Super admin envia foto do produto';
  assert publicar_anuncio(a) = 'pronto', 'Publicar na montagem deixa pronto';
  assert (select status = 'rascunho' and pronto_em is not null from anuncios where id = a), 'Pronto continua rascunho';
  begin update anuncios set status = 'ativo' where id = a; assert false, 'Produto foi ao ar na montagem';
  exception when sqlstate '23514' then null; end;
  insert into anuncios(vitrine_id, categoria_id, titulo, cidade, preco_centavos, status)
  values (l, current_setting('teste.cat')::uuid, 'Rascunho 590', 'Corrente', 1000, 'rascunho') returning id into a;
  perform set_config('teste.rascunho', a::text, true);
end $$;

-- [3] Ninguém de fora vê a loja em montagem.
set local request.jwt.claim.sub='user_outro590';
do $$ begin
  assert not exists (select 1 from vitrines_lojas where id = current_setting('teste.loja')::uuid), 'Estranho vê a loja';
  assert not exists (select 1 from anuncios where vitrine_id = current_setting('teste.loja')::uuid), 'Estranho vê os produtos';
  assert not (current_setting('teste.loja')::uuid = any(lojas_que_ajudo())), 'Estranho cuida da loja';
end $$;
reset role;
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
  assert not exists (select 1 from vitrines_lojas where id = current_setting('teste.loja')::uuid), 'Visitante vê a loja';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- [4] Convite: um pendente por loja; quem já vende não recebe a loja.
set local request.jwt.claim.sub='user_super590';
select super_convidar_dono(:'loja', '(89) 99999-0592') as token_vende \gset
select set_config('teste.token_vende', :'token_vende', true);
set local request.jwt.claim.sub='user_vende590';
select aceitar_documentos_legais(array(select id from termos_pendentes()));
do $$ begin
  assert (select ja_vende and not aceito from convite_dono_loja(current_setting('teste.token_vende')::uuid)), 'Quem já vende vê o aviso';
  begin perform convite_dono_loja(current_setting('teste.token_vende')::uuid, true, false); assert false, 'Quem já vende recebeu a loja';
  exception when sqlstate '23514' then null; end;
end $$;
set local request.jwt.claim.sub='user_super590';
select super_convidar_dono(:'loja', '89999990590') as token \gset
select set_config('teste.token', :'token', true);
do $$ begin
  assert (select final_telefone from super_convite_dono_pendente(current_setting('teste.loja')::uuid)) = '0590', 'Convite pendente';
end $$;
set local request.jwt.claim.sub='user_vende590';
do $$ begin
  assert not exists (select 1 from convite_dono_loja(current_setting('teste.token_vende')::uuid)), 'Convite antigo continua valendo';
end $$;
set local request.jwt.claim.sub='user_outro590';
select aceitar_documentos_legais(array(select id from termos_pendentes()));
do $$ begin
  assert not exists (select 1 from convite_dono_loja(current_setting('teste.token')::uuid)), 'Outro WhatsApp abre o convite';
  begin perform super_convidar_dono(current_setting('teste.loja')::uuid, '89999990593'); assert false, 'Estranho convidou';
  exception when sqlstate '42501' then null; end;
end $$;

-- [5] O dono aceita (com a equipe ajudando): a loja é dele, com o WhatsApp dele e o teste do zero.
set local request.jwt.claim.sub='user_dono590';
do $$ begin
  assert not exists (select 1 from convite_dono_loja(current_setting('teste.token')::uuid)), 'Aceite sem os termos em dia';
end $$;
select aceitar_documentos_legais(array(select id from termos_pendentes()));
do $$
declare r record; l uuid := current_setting('teste.loja')::uuid;
begin
  select * into r from convite_dono_loja(current_setting('teste.token')::uuid);
  assert r.loja_id = l and r.prontos = 1 and not r.ja_vende and not r.aceito, 'Dono vê o convite';
  select * into r from convite_dono_loja(current_setting('teste.token')::uuid, true, true);
  assert r.aceito, 'Dono aceitou';
  select * into r from convite_dono_loja(current_setting('teste.token')::uuid, true, true);
  assert r.aceito and r.loja_id = l, 'Aceite repetido é seguro';
  assert (select pasta_montagem is not null from vitrines_lojas where id = l), 'Fotos ainda na pasta provisória';
  assert (select count(*) from publicar_prontos_loja(l)) = 0, 'Publicou antes de mudar as fotos';
  assert (select status from anuncios where id = current_setting('teste.pronto')::uuid) = 'rascunho', 'Pronto foi ao ar cedo';
end $$;
reset role;
do $$
declare l uuid := current_setting('teste.loja')::uuid;
begin
  assert (select dono_id = 'user_dono590' and status = 'ativa' and whatsapp = '5589999990590'
            and teste_expira_em > now() + interval '29 days' from vitrines_lojas where id = l), 'Loja passou para o dono, teste do zero';
  assert not exists (select 1 from perfis where id like 'user_montagem%' and nome like '%Montada 590%'), 'Dono provisório ficou';
  assert exists (select 1 from convites_gerente_loja where vitrine_id = l and aceito_por = 'user_super590' and revogado_em is null),
    'Equipe virou ajudante';
  assert exists (select 1 from notificacoes where usuario_id = 'user_super590' and tipo = 'loja_recebida'), 'Aviso à equipe';
end $$;

-- [6] Servidor: só a chave secreta muda as fotos de pasta.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono590';
do $$ begin
  begin perform trocar_pasta_loja(current_setting('teste.loja')::uuid); assert false, 'Dono trocou a pasta';
  exception when sqlstate '42501' then null; end;
  begin update vitrines_lojas set pasta_montagem = null where id = current_setting('teste.loja')::uuid; assert false, 'Dono mexeu na pasta';
  exception when sqlstate '42501' then null; end;
end $$;
reset role;
set local role service_role;
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='';
do $$
declare r record; l uuid := current_setting('teste.loja')::uuid;
begin
  select * into r from fotos_mudanca_loja(l);
  assert r.para = 'user_dono590' and r.de like 'user_montagem%', 'Pastas da mudança';
  assert cardinality(r.caminhos) = 2 and r.caminhos[1] like r.de || '/%', 'Caminhos das fotos e da logo';
  assert trocar_pasta_loja(l), 'Troca da pasta';
  assert not trocar_pasta_loja(l), 'Troca repetida';
  assert (select fotos[1] like '%/anuncios/user_dono590/59100000-%' from anuncios where id = current_setting('teste.pronto')::uuid), 'Foto na pasta do dono';
  assert (select logo_url like '%/anuncios/user_dono590/loja/%' and pasta_montagem is null from vitrines_lojas where id = l), 'Logo na pasta do dono';
end $$;

-- [7] O dono publica os prontos; o rascunho comum continua rascunho.
reset role;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono590';
do $$
declare r record;
begin
  select * into r from publicar_prontos_loja(current_setting('teste.loja')::uuid);
  assert r.publicados + r.em_analise = 1 and r.rascunhos = 0, 'Prontos no ar';
  assert (select status::text in ('ativo', 'em_analise') and pronto_em is null from anuncios where id = current_setting('teste.pronto')::uuid), 'Pronto publicado';
  assert (select status = 'rascunho' from anuncios where id = current_setting('teste.rascunho')::uuid), 'Rascunho comum ficou';
  -- Dono não monta loja nem volta a loja para a montagem.
  -- (a proteção antiga dos campos do sistema já desfaz a troca de status sem erro)
  begin update vitrines_lojas set status = 'montagem' where id = current_setting('teste.loja')::uuid;
  exception when sqlstate '42501' then null; end;
end $$;
reset role;
do $$ begin
  assert (select status = 'ativa' from vitrines_lojas where id = current_setting('teste.loja')::uuid), 'Dono voltou para montagem';
end $$;
set local role authenticated;

-- [8] Segunda loja: sem a equipe; o dono que já tem loja não recebe outra.
set local request.jwt.claim.sub='user_super590';
select super_montar_loja('Loja Dois 590', 'dois-590', :'reg', 'Corrente') as loja2 \gset
select set_config('teste.loja2', :'loja2', true);
-- Painel mostra "montagem"; suspender e reativar devolve a loja para a montagem (nunca vai ao ar sem dono).
reset role;
do $$
declare l uuid := current_setting('teste.loja2')::uuid;
begin
  assert (select situacao_vitrine(v) = 'montagem' from vitrines_lojas v where v.id = l), 'Painel mostra montagem';
  update vitrines_lojas set status = 'suspensa' where id = l;
  update vitrines_lojas set status = 'ativa' where id = l;
  assert (select status = 'montagem' from vitrines_lojas where id = l), 'Reativar volta para a montagem';
  begin update vitrines_lojas set status = 'inadimplente' where id = l; assert false, 'Loja sem dono ficou inadimplente';
  exception when sqlstate '23514' then null; end;
end $$;
set local role authenticated;
select super_convidar_dono(:'loja2', '89999990590') as token2 \gset
select set_config('teste.token2', :'token2', true);
set local request.jwt.claim.sub='user_dono590';
do $$ begin
  assert (select ja_vende from convite_dono_loja(current_setting('teste.token2')::uuid)), 'Dono com loja vê o aviso';
end $$;
set local request.jwt.claim.sub='user_super590';
select super_convidar_dono(:'loja2', '89999990593') as token3 \gset
select set_config('teste.token3', :'token3', true);
set local request.jwt.claim.sub='user_outro590';
do $$ begin
  assert (select aceito from convite_dono_loja(current_setting('teste.token3')::uuid, true, false)), 'Outro aceitou';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from convites_gerente_loja where vitrine_id = current_setting('teste.loja2')::uuid), 'Equipe ficou sem o dono querer';
  assert (select dono_id = 'user_outro590' and status = 'ativa' from vitrines_lojas where id = current_setting('teste.loja2')::uuid), 'Loja dois aceita';
end $$;

-- [9] Usuário comum não cria loja em montagem.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_admin590';
do $$ begin
  begin
    insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, pasta_montagem)
    values ('user_admin590', current_setting('teste.reg')::uuid, 'falsa-590', 'Falsa 590', 'Corrente', 'loja',
            'user_montagem00000000000000000000000000000000');
    assert false, 'Criou loja com pasta provisória';
  exception when sqlstate '42501' then null; end;
end $$;
rollback;
