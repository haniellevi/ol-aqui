\set ON_ERROR_STOP on
\set QUIET on
-- Fotos na pasta do ID antigo depois da troca de ID do Clerk (p_mover_arquivos = false):
-- o dono (ID novo) reordena, tira e põe foto nova no anúncio que tem foto antiga;
-- foto antiga que não estava no anúncio, foto antiga em outro anúncio e foto de outra pessoa
-- continuam recusadas.
begin;
update public.configuracoes set valor = '"https://x.supabase.co"' where chave = 'fotos.origem' and microrregiao_id is null;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;

-- Tenta gravar a lista de fotos como o usuário logado; devolve true se o banco recusou com 22023.
create function pg_temp.recusa(p_id uuid, p_fotos text[]) returns boolean language plpgsql as $$
begin
  update public.anuncios set fotos = p_fotos where id = p_id;
  return false;
exception when invalid_parameter_value then
  return true;
end $$;

select id as regiao from microrregioes where slug = 'corrente-pi' \gset
select id as cat from categorias where slug = 'casas' \gset

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, tipo_pessoa) values
  ('user_velho820', :'regiao', 'Dono 820', '5589999820001', now(), 'pj');
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, status, teste_expira_em) values
  ('user_velho820', :'regiao', 'q820-loja', 'Loja 820', 'Corrente', 'loja', 'teste', 'ativa', now() + interval '10 days');
select id as loja from vitrines_lojas where slug = 'q820-loja' \gset

\set velho 'https://x.supabase.co/storage/v1/object/public/anuncios/user_velho820/82000000-0000-4000-a000-000000000001/'
\set novo 'https://x.supabase.co/storage/v1/object/public/anuncios/user_novo820/82000000-0000-4000-a000-000000000001/'
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status) values
  ('82000000-0000-4000-a000-000000000001', :'loja', :'cat', 'Casa 820', 'Corrente', 100000, '{"finalidade":"Venda"}',
   array[:'velho' || '1.webp', :'velho' || '2.webp'], 'rascunho'),
  ('82000000-0000-4000-a000-000000000002', :'loja', :'cat', 'Outra casa 820', 'Corrente', 100000, '{"finalidade":"Venda"}',
   '{}', 'rascunho');

-- Troca de ID sem mover arquivos (como foi feito em produção)
set local role service_role;
select public.admin_trocar_id_usuario('user_velho820', 'user_novo820') is not null as trocou \gset
reset role;
select pg_temp.confere((select dono_id = 'user_novo820' from vitrines_lojas where id = :'loja'), 'loja passou ao ID novo');
select pg_temp.confere((select fotos[1] = :'velho' || '1.webp' from anuncios where id = '82000000-0000-4000-a000-000000000001'), 'fotos continuam na pasta antiga');

-- Agora como o dono, com o ID novo
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_novo820';

-- Reordenar
select pg_temp.confere(not pg_temp.recusa('82000000-0000-4000-a000-000000000001', array[:'velho' || '2.webp', :'velho' || '1.webp']), 'reordenar foto antiga é aceito');
-- Pôr foto nova (pasta do ID novo) junto das antigas
select pg_temp.confere(not pg_temp.recusa('82000000-0000-4000-a000-000000000001', array[:'velho' || '2.webp', :'velho' || '1.webp', :'novo' || '3.webp']), 'pôr foto nova junto das antigas é aceito');
-- Tirar uma foto antiga
select pg_temp.confere(not pg_temp.recusa('82000000-0000-4000-a000-000000000001', array[:'novo' || '3.webp', :'velho' || '1.webp']), 'tirar foto antiga (e mudar a capa) é aceito');
select pg_temp.confere((select fotos = array[:'novo' || '3.webp', :'velho' || '1.webp'] from anuncios where id = '82000000-0000-4000-a000-000000000001'), 'lista gravada na ordem pedida');

-- Continua recusado
select pg_temp.confere(pg_temp.recusa('82000000-0000-4000-a000-000000000001', array[:'novo' || '3.webp', :'velho' || '1.webp', :'velho' || '2.webp']),
  'foto antiga que já tinha saído do anúncio não volta');
select pg_temp.confere(pg_temp.recusa('82000000-0000-4000-a000-000000000001', array[:'novo' || '3.webp', :'velho' || '9.webp']),
  'foto antiga que nunca esteve no anúncio é recusada');
select pg_temp.confere(pg_temp.recusa('82000000-0000-4000-a000-000000000002', array[:'velho' || '1.webp']),
  'foto antiga em outro anúncio é recusada');
select pg_temp.confere(pg_temp.recusa('82000000-0000-4000-a000-000000000001',
  array[:'novo' || '3.webp', 'https://x.supabase.co/storage/v1/object/public/anuncios/user_outro820/a/1.webp']),
  'foto da pasta de outra pessoa é recusada');
select pg_temp.confere((select fotos = array[:'novo' || '3.webp', :'velho' || '1.webp'] from anuncios where id = '82000000-0000-4000-a000-000000000001'), 'recusas não mudaram a lista');

-- Anúncio novo (INSERT) com foto antiga: recusado
do $$ begin
  begin
    insert into public.anuncios(vitrine_id, status, fotos)
      select v.id, 'rascunho', array['https://x.supabase.co/storage/v1/object/public/anuncios/user_velho820/82000000-0000-4000-a000-000000000001/1.webp']
        from public.vitrines_lojas v where v.slug = 'q820-loja';
    raise exception 'FALHOU: anúncio novo aceitou foto antiga';
  exception when invalid_parameter_value then null;
  end;
end $$;

rollback;
