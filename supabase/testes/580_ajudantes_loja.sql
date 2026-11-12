\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P5b-2b: o ajudante cuida da Minha loja (capa, logo, cidade, informações, seções, topo e desempenho);
-- nome, WhatsApp, plano e o resto seguem só do dono.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono580',:'reg','Dono 580','Corrente','5589999990580',now()),
 ('user_ajud580',:'reg','Ajudante 580','Corrente','5589999990581',now()),
 ('user_estranho580',:'reg','Estranho 580','Corrente','5589999990583',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('58000000-0000-4000-a000-000000000001','user_dono580',:'reg','loja-580','Loja 580','Corrente','5589999990580','loja','full',now()+interval '30 days');
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em,revogado_em) values
 ('58000000-0000-4000-a000-000000000001','\x01','\x01','0581','user_ajud580',now(),null);
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('58100000-0000-4000-a000-000000000001','58000000-0000-4000-a000-000000000001',:'diversos','Mesa 580','Corrente',5000,'ativo',now()),
 ('58100000-0000-4000-a000-000000000002','58000000-0000-4000-a000-000000000001',:'diversos','Cadeira 580','Corrente',5000,'ativo',now());
create temp table _plano580 as select plano from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001';

set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- [1] Ajudante: lê contatos e recursos, edita campos liberados, seções, topo, desempenho e fotos da loja.
set local request.jwt.claim.sub='user_ajud580';
do $$
declare n int; sec uuid;
begin
  assert (select whatsapp from contatos_da_loja('58000000-0000-4000-a000-000000000001')) = '5589999990580', 'Ajudante lê o WhatsApp da loja';
  assert (select count(*) from recursos_da_loja('58000000-0000-4000-a000-000000000001')) = 1, 'Ajudante lê os recursos';
  update vitrines_lojas set bairro = 'Centro', sobre = 'Loja da praça', plano = 'teste', slug = 'loja-roubada'
   where id = '58000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'Ajudante não editou a loja';
  begin
    update vitrines_lojas set nome = 'Outro nome' where id = '58000000-0000-4000-a000-000000000001';
    assert false, 'Ajudante mudou o nome';
  exception when sqlstate '42501' then null; end;
  begin
    update vitrines_lojas set whatsapp = '5589999990599' where id = '58000000-0000-4000-a000-000000000001';
    assert false, 'Ajudante mudou o WhatsApp';
  exception when sqlstate '42501' then null; end;
  insert into loja_secoes(vitrine_id, nome) values ('58000000-0000-4000-a000-000000000001', 'Promoções') returning id into sec;
  assert definir_anuncios_secao(sec, array['58100000-0000-4000-a000-000000000001'::uuid]) = 1, 'Produtos na seção';
  assert ordenar_secoes(array[sec]) = 1, 'Ordem das seções';
  update loja_secoes set nome = 'Ofertas' where id = sec;
  get diagnostics n = row_count; assert n = 1, 'Renomear seção';
  assert fixar_anuncio('58100000-0000-4000-a000-000000000002') is not null, 'Fixar no topo';
  assert ordenar_fixados(array['58100000-0000-4000-a000-000000000002'::uuid]) = 1, 'Ordem do topo';
  perform minha_loja_desempenho('58000000-0000-4000-a000-000000000001', 30);
  perform minha_loja_metricas_produtos('58000000-0000-4000-a000-000000000001', 30);
  perform minhas_sugestoes_loja('58000000-0000-4000-a000-000000000001');
  assert public.pode_enviar_foto('user_dono580/loja/logo-1.webp'), 'Ajudante envia a logo na pasta do dono';
  assert public.pasta_foto_que_cuido('user_dono580/loja/logo-1.webp'), 'Ajudante apaga a logo antiga';
  assert public.pode_enviar_foto('user_dono580/vitrine/capa-1.webp')
         = (select foto_fachada from recursos_da_loja('58000000-0000-4000-a000-000000000001')), 'Capa segue o plano';
  assert not public.pode_enviar_foto('user_dono580/radar-58000000-0000-4000-a000-000000000009/a.webp'), 'Ajudante no Radar do dono';
  assert not public.pasta_foto_que_cuido('user_estranho580/loja/logo.webp'), 'Pasta de outra pessoa';
end $$;
reset role;
do $$ begin
  assert (select bairro from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001') = 'Centro', 'Bairro salvo';
  assert (select sobre from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001') = 'Loja da praça', 'Sobre salvo';
  assert (select slug from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001') = 'loja-580', 'Ajudante mudou o link';
  assert (select nome from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001') = 'Loja 580', 'Nome intacto';
end $$;
do $$ begin
  assert (select plano from vitrines_lojas where id = '58000000-0000-4000-a000-000000000001') = (select plano from _plano580), 'Ajudante mudou o plano';
end $$;

-- [2] Estranho não lê nem mexe em nada da loja.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_estranho580';
do $$
declare n int;
begin
  assert (select count(*) from contatos_da_loja('58000000-0000-4000-a000-000000000001')) = 0, 'Estranho lê contatos';
  assert (select count(*) from recursos_da_loja('58000000-0000-4000-a000-000000000001')) = 0, 'Estranho lê recursos';
  update vitrines_lojas set bairro = 'Invasão' where id = '58000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'Estranho editou a loja';
  begin insert into loja_secoes(vitrine_id, nome) values ('58000000-0000-4000-a000-000000000001', 'Invasores'); assert false, 'Estranho criou seção';
  exception when sqlstate '42501' then null; end;
  update loja_secoes set nome = 'Invadida' where vitrine_id = '58000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'Estranho renomeou seção';
  begin perform fixar_anuncio('58100000-0000-4000-a000-000000000001'); assert false, 'Estranho fixou';
  exception when sqlstate '42501' then null; end;
  assert ordenar_fixados(array['58100000-0000-4000-a000-000000000002'::uuid]) = 0, 'Estranho ordenou o topo';
  begin perform minha_loja_desempenho('58000000-0000-4000-a000-000000000001', 30); assert false, 'Estranho viu desempenho';
  exception when others then null; end;
  assert not public.pode_enviar_foto('user_dono580/loja/logo-2.webp'), 'Estranho envia logo do dono';
  assert not public.pasta_foto_que_cuido('user_dono580/loja/logo-1.webp'), 'Estranho apaga logo do dono';
end $$;

-- [3] Dono segue mudando o nome; o histórico guarda o papel de ajudante.
set local request.jwt.claim.sub='user_dono580';
do $$
declare n int;
begin
  update vitrines_lojas set nome = 'Loja 580 Nova' where id = '58000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'Dono não mudou o nome';
  assert (select count(*) from recursos_da_loja('58000000-0000-4000-a000-000000000001')) = 1, 'Dono lê recursos';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from historico_alteracoes where vitrine_id = '58000000-0000-4000-a000-000000000001'
                  and anuncio_id is null and papel = 'ajudante' and quem = 'user_ajud580'), 'Histórico da loja com o ajudante';
end $$;
rollback;
