\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='casas' \gset
insert into perfis(id,microrregiao_id,nome,e_admin,whatsapp,whatsapp_verificado_em)
values ('user_mod400',:'reg','Moderação de migração',true,'5589999990400',now());
-- Reproduz estados produzidos pela regra anterior, inclusive retenções humanas.
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status,motivo_analise)
select ('84000000-0000-4000-a000-00000000000'||n)::uuid,:'loja',:'cat',
 case when n=2 then 'Casa com pix antecipado' when n=3 then 'Casa com conteúdo sexual' else 'Casa de teste migração '||n end,
 'Corrente',100000,'{"finalidade":"Venda"}',
 case when n=7 then '{}'::text[] else array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/84000000-0000-4000-a000-00000000000'||n||'/1.webp'] end,
 'em_analise'::status_anuncio,
 case when n in (2,3) then 'Palavra bloqueada: "termo antigo"' else 'Preço fora do normal para a categoria' end
 from generate_series(1,7) n;
set local request.jwt.claim.sub='user_mod400';
update anuncios set revisao_manual_admin=true where id='84000000-0000-4000-a000-000000000004';
set local request.jwt.claim.sub='';
insert into denuncias(denunciante_id,alvo_tipo,alvo_id,motivo)
values ('user_comprador','anuncio','84000000-0000-4000-a000-000000000005','golpe');
update anuncios set congelado_motivo='Retenção administrativa de teste'
where id='84000000-0000-4000-a000-000000000006';
update ajuda_perguntas set resposta='Resposta personalizada da equipe sobre análise.'
where pergunta='Meu anúncio está "em análise". O que é isso?';

-- REAPLICAR_MIGRACAO_MODERACAO_SENSIVEL

do $$ begin
 assert (select count(*)=2 from anuncios where id in ('84000000-0000-4000-a000-000000000001','84000000-0000-4000-a000-000000000002') and status='ativo' and motivo_analise is null), 'Libera retenções antigas fora do novo escopo';
 assert (select status='em_analise' and revisao_manual_admin and motivo_analise like 'Termo sexual ou violento:%' from anuncios where id='84000000-0000-4000-a000-000000000003'), 'Conteúdo sensível antigo continua pendente para equipe';
 assert (select count(*)=4 from anuncios where id in ('84000000-0000-4000-a000-000000000004','84000000-0000-4000-a000-000000000005','84000000-0000-4000-a000-000000000006','84000000-0000-4000-a000-000000000007') and status='em_analise'), 'Preserva decisão humana, denúncia, congelamento e falta de fotos';
 assert (select revisao_manual_admin from anuncios where id='84000000-0000-4000-a000-000000000004'), 'Preserva exigência humana';
 assert exists(select 1 from denuncias where alvo_id='84000000-0000-4000-a000-000000000005' and status='aberta'), 'Não resolve denúncia';
 assert (select resposta='Resposta personalizada da equipe sobre análise.' from ajuda_perguntas where pergunta='Meu anúncio está "em análise". O que é isso?'), 'Preserva ajuda personalizada';
end $$;
rollback;
