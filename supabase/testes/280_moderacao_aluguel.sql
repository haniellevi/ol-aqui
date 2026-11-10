\set ON_ERROR_STOP on
begin;
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='casas' \gset
update configuracoes set valor='["palavraqateste"]' where chave='moderacao.termos_sensiveis_anuncios' and microrregiao_id is null;
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status)
select ('88000000-0000-4000-a000-00000000000'||n)::uuid,:'loja',:'cat',
 case when n=3 then 'Casa palavraqateste local' else 'Casa teste local '||n end,
 'Corrente',case when n=4 then 2000000001 else 100000 end,
 jsonb_build_object('finalidade',case when n=2 then 'Venda' else 'Aluguel' end),
 array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/88000000-0000-4000-a000-00000000000'||n||'/1.webp'],
 'rascunho'::status_anuncio from generate_series(1,5) n;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
do $$ begin
 assert publicar_anuncio('88000000-0000-4000-a000-000000000001')='ativo', 'Aluguel de mil reais não herda piso de venda';
 assert publicar_anuncio('88000000-0000-4000-a000-000000000002')='ativo', 'Venda abaixo do piso publica sem revisão de preço';
 assert publicar_anuncio('88000000-0000-4000-a000-000000000003')='em_analise', 'Conteúdo bloqueado continua em análise no aluguel';
 assert publicar_anuncio('88000000-0000-4000-a000-000000000004')='ativo', 'Preço alto de aluguel não exige revisão';
end $$;
update anuncios set atributos='{"finalidade":"Venda"}' where id='88000000-0000-4000-a000-000000000001';
do $$ begin
 assert (select status='ativo' from anuncios where id='88000000-0000-4000-a000-000000000001'), 'Trocar finalidade não retém por preço';
end $$;
update anuncios set atributos='{"finalidade":"Aluguel"}' where id='88000000-0000-4000-a000-000000000001';
do $$ begin
 assert publicar_anuncio('88000000-0000-4000-a000-000000000001')='ativo', 'Voltar a aluguel mantém publicação direta';
end $$;
reset role;
update categorias set preco_min_centavos=200000 where id=:'cat';
set local role authenticated;
do $$ begin
 assert publicar_anuncio('88000000-0000-4000-a000-000000000005')='ativo', 'Piso explícito da subcategoria não gera pendência';
end $$;
rollback;
