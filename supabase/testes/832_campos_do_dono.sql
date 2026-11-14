\set ON_ERROR_STOP on
\set QUIET on
-- Campos que o dono não muda (criado_ip, criado_em, tipo_pessoa, origem), nome de loja com
-- filtro de palavras e selo, e recusa da fila que não volta ao ar sem nova análise.
-- Dados fictícios dentro da transação (abaixo); roda no PostgreSQL descartável depois da migração.
begin;
reset role;
select set_config('request.jwt.claim.role', '', false) \g /dev/null
select id as regiao from microrregioes where slug = 'corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
insert into configuracoes (chave, microrregiao_id, valor)
  select 'fotos.origem', null, '"https://abc.supabase.co"'
  where not exists (select 1 from configuracoes where chave = 'fotos.origem' and microrregiao_id is null);
update configuracoes set valor = '"https://abc.supabase.co"' where chave = 'fotos.origem' and microrregiao_id is null;

insert into perfis (id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa, criado_em) values
  ('user_g3dono', :'regiao', 'Dono G3', '5589999930001', now(), 'Corrente', 'pj', now() - interval '400 days'),
  ('user_g3mod',  :'regiao', 'Moderador G3', '5589999930002', now(), 'Corrente', 'pf', now() - interval '300 days'),
  ('user_g3cli',  :'regiao', 'Cliente G3', '5589999930003', now(), 'Corrente', 'pf', now() - interval '200 days');
insert into equipe (usuario_id, papel, ativo) values ('user_g3mod', 'moderador', true);

select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', false) \g /dev/null
insert into vitrines_lojas (id, dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, status)
  values ('90000000-0000-4000-c000-000000000001', 'user_g3dono', :'regiao', 'g3-loja', 'Loja Teste G3', 'Corrente', 'loja',
          'full', now() + interval '30 days', now() - interval '1 day', 'ativa');
update vitrines_lojas set selo_loja_verificada = true, verificacao_estado = 'aprovada', verificacao_revisao = 1,
       cnpj_conferido_em = now()
 where id = '90000000-0000-4000-c000-000000000001';
select set_config('request.headers', '', false) \g /dev/null

insert into anuncios (id, vitrine_id, categoria_id, titulo, descricao, cidade, bairro, preco_centavos, atributos, status, fotos, aceita_troca)
  values ('90000000-0000-4000-a000-000000000001', '90000000-0000-4000-c000-000000000001', :'moveis',
          'Sofa de teste G3', 'Produto ficticio de teste.', 'Corrente', 'Centro', 10000, '{"estado":"usado"}', 'ativo',
          array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_g3dono/90000000-0000-4000-a000-000000000001/1.webp'], false);
insert into anuncios (id, vitrine_id, categoria_id, titulo, descricao, cidade, bairro, preco_centavos, atributos, status, fotos, aceita_troca)
  values ('90000000-0000-4000-a000-000000000002', '90000000-0000-4000-c000-000000000001', :'moveis',
          'Mesa de teste G3', 'Produto ficticio de teste.', 'Corrente', 'Centro', 20000, '{"estado":"usado"}', 'em_analise',
          array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_g3dono/90000000-0000-4000-a000-000000000002/1.webp'], false);
select 'dados ok' as situacao;
reset role;
set local request.jwt.claim.role = '';
set local request.jwt.claim.sub = '';

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

select id as loja from vitrines_lojas where slug = 'g3-loja' \gset
select id as regiao from microrregioes where slug = 'corrente-pi' \gset
select coalesce(criado_ip::text, 'nulo') as ip_dono, criado_em::text as cem_dono, tipo_pessoa::text as tipo_dono from perfis where id = 'user_g3dono' \gset
select coalesce(criado_ip::text, 'nulo') as ip_loja, criado_em::text as cem_loja from vitrines_lojas where id = :'loja' \gset
select coalesce(criado_ip::text, 'nulo') as ip_anuncio, criado_em::text as cem_anuncio from anuncios where id = '90000000-0000-4000-a000-000000000001' \gset
-- Loja vencida: sem plano pago, pessoa jurídica fica sem plano (plano_efetivo é nulo).
update vitrines_lojas set plano_expira_em = now() - interval '1 day' where id = :'loja';

-- [1] Dono tenta mudar IP, data de criação, tipo de pessoa e origem: nada muda.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
update perfis set criado_ip = '203.0.113.9', criado_em = '2000-01-01', tipo_pessoa = 'pf', origem_cadastro = 'instagram' where id = 'user_g3dono';
update vitrines_lojas set criado_ip = '203.0.113.9', criado_em = '2000-01-01' where id = :'loja';
update anuncios set criado_ip = '203.0.113.9', criado_em = '2000-01-01' where id = '90000000-0000-4000-a000-000000000001';
reset role;
select pg_temp.confere(coalesce((select criado_ip::text from perfis where id = 'user_g3dono'), 'nulo') = :'ip_dono', 'M-04: IP do perfil não muda pelo dono');
select pg_temp.confere((select criado_em::text from perfis where id = 'user_g3dono') = :'cem_dono', 'B-42: data de criação do perfil não muda pelo dono');
select pg_temp.confere((select tipo_pessoa::text from perfis where id = 'user_g3dono') = 'pj', 'B-41: dono não vira pessoa física');
select pg_temp.confere((select origem_cadastro is null from perfis where id = 'user_g3dono'), 'atribuição de origem não muda pelo dono');
select pg_temp.confere(coalesce((select criado_ip::text from vitrines_lojas where id = :'loja'), 'nulo') = :'ip_loja', 'M-04: IP da loja não muda pelo dono');
select pg_temp.confere((select criado_em::text from vitrines_lojas where id = :'loja') = :'cem_loja', 'B-42: data de criação da loja não muda pelo dono');
select pg_temp.confere(coalesce((select criado_ip::text from anuncios where id = '90000000-0000-4000-a000-000000000001'), 'nulo') = :'ip_anuncio', 'M-04: IP do anúncio não muda pelo dono');
select pg_temp.confere((select criado_em::text from anuncios where id = '90000000-0000-4000-a000-000000000001') = :'cem_anuncio', 'B-42: data do anúncio não muda pelo dono');
select pg_temp.confere((select plano_efetivo(v) is null from vitrines_lojas v where id = :'loja'), 'B-41: PJ vencida continua sem plano grátis');
-- Plano da loja volta a valer para os passos de moderação (aprovar exige plano ativo).
update vitrines_lojas set plano_expira_em = now() + interval '30 days' where id = :'loja';

-- [2] Anúncio criado pelo dono: IP e data vêm do servidor, não do cliente.
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', true) \g /dev/null
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
insert into anuncios (id, vitrine_id, status, criado_ip, criado_em)
  values ('90000000-0000-4000-a000-000000000009', :'loja', 'rascunho', '203.0.113.9', '2000-01-01');
reset role;
select pg_temp.confere((select criado_ip::text from anuncios where id = '90000000-0000-4000-a000-000000000009') = '198.51.100.7/32', 'M-04: IP da criação vem do servidor');
select pg_temp.confere((select criado_em > now() - interval '1 day' from anuncios where id = '90000000-0000-4000-a000-000000000009'), 'B-42: data da criação vem do servidor');

-- [3] Nome da loja (M-23).
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
update vitrines_lojas set nome = 'LOJA   TESTE g3' where id = :'loja';           -- só maiúscula e espaço: nada muda
select pg_temp.recusa($q$update vitrines_lojas set nome = 'Loja Pistola G3' where id = '90000000-0000-4000-c000-000000000001'$q$, '23514', 'palavra');
reset role;
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' from vitrines_lojas where id = :'loja'), 'M-23: maiúscula e espaço não tiram o selo');
select pg_temp.confere((select count(*) = 0 from verificacao_loja_avisos where vitrine_id = :'loja' and tipo = 'mudou_nome'), 'M-23: maiúscula e espaço não geram aviso');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
update vitrines_lojas set nome = 'Loja Nova G3' where id = :'loja';              -- troca de nome: volta para conferência
reset role;
select pg_temp.confere((select selo_loja_verificada = false and verificacao_estado = 'pendente' from vitrines_lojas where id = :'loja'), 'M-23: troca de nome em loja aprovada tira o selo e volta para conferência');
select pg_temp.confere((select count(*) = 1 from verificacao_loja_avisos where vitrine_id = :'loja' and tipo = 'mudou_nome' and resolvido_em is null), 'M-23: a equipe recebe o aviso mesmo com o selo já tirado');

-- [3b] Criar loja: nome com palavra bloqueada é recusado; nome limpo passa.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3cli';
select pg_temp.recusa($q$select quero_vender('loja', 'Loja Pistola Show', 'g3-pistola', '5589999930003', 'Corrente')$q$, '23514', 'palavra');
select quero_vender('loja', 'Loja Limpa G3', 'g3-limpa', '5589999930003', 'Corrente') \g /dev/null
reset role;
select pg_temp.confere(exists (select 1 from vitrines_lojas where slug = 'g3-limpa' and dono_id = 'user_g3cli'), 'loja com nome limpo é criada normalmente');

-- [3c] Venda como pessoa física usa o primeiro nome da pessoa: o filtro de nome de loja não vale; virar loja com esse nome é recusado.
insert into perfis (id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa)
  values ('user_g3pf', :'regiao', 'Pistola G3', '5589999930005', now(), 'Corrente', 'pf');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3pf';
select quero_vender('pf', 'Pistola G3', 'g3-pf-pistola', '5589999930005', 'Corrente') \g /dev/null
reset role;
select pg_temp.confere(exists (select 1 from vitrines_lojas where dono_id = 'user_g3pf' and tipo = 'pf'), 'venda como pessoa física abre mesmo com palavra da lista no nome');
select pg_temp.recusa($q$update vitrines_lojas set tipo = 'loja' where dono_id = 'user_g3pf' and tipo = 'pf'$q$, '23514', 'palavra');

-- [4] A-07: recusa da fila de moderação não volta ao ar sozinha.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3mod';
select moderar_anuncio('90000000-0000-4000-a000-000000000002', 'recusar', 'Produto fora das regras') \g /dev/null
reset role;
select pg_temp.confere((select status = 'pausado' and revisao_manual_admin from anuncios where id = '90000000-0000-4000-a000-000000000002'), 'A-07: recusa deixa o anúncio com revisão manual');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
select pg_temp.confere(publicar_anuncio('90000000-0000-4000-a000-000000000002') = 'em_analise', 'A-07: dono reativa anúncio recusado e ele vai para análise');
reset role;
select pg_temp.confere((select status = 'em_analise' from anuncios where id = '90000000-0000-4000-a000-000000000002'), 'A-07: status em análise no banco');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3mod';
select moderar_anuncio('90000000-0000-4000-a000-000000000002', 'aprovar') \g /dev/null
reset role;
select pg_temp.confere((select status = 'ativo' and not revisao_manual_admin from anuncios where id = '90000000-0000-4000-a000-000000000002'), 'A-07: a equipe libera depois da reativação');

-- [5] Quem não é dono continua podendo: serviço (exclusão de conta), admin e funções do sistema.
set local role service_role;
set local request.jwt.claim.role = 'service_role';
update vitrines_lojas set criado_ip = null where id = :'loja';
update perfis set criado_ip = null, criado_em = criado_em where id = 'user_g3cli';
reset role;
select pg_temp.confere((select criado_ip is null from vitrines_lojas where id = :'loja'), 'serviço limpa o IP da loja (apagarConta)');
-- administrador de verdade (e_admin) e a cliente como pessoa jurídica: o administrador muda para pessoa física
reset role;
insert into perfis (id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa, e_admin)
  values ('user_g3adm', (select id from microrregioes where slug = 'corrente-pi'), 'Admin G3', '5589999930004', now(), 'Corrente', 'pf', true);
update perfis set tipo_pessoa = 'pj' where id = 'user_g3cli';
select pg_temp.confere((select e_admin from perfis where id = 'user_g3adm'), 'administrador de teste existe e é admin');
select pg_temp.confere((select tipo_pessoa::text from perfis where id = 'user_g3cli') = 'pj', 'antes: cliente está como pessoa jurídica');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3adm';
update perfis set tipo_pessoa = 'pf' where id = 'user_g3cli';
reset role;
select pg_temp.confere((select tipo_pessoa::text from perfis where id = 'user_g3cli') = 'pf', 'admin muda tipo de pessoa (admin_salvar_usuario)');
reset role;
update perfis set criado_em = now() - interval '5 days' where id = 'user_g3cli';
select pg_temp.confere((select criado_em > now() - interval '6 days' from perfis where id = 'user_g3cli'), 'sem login (SQL do sistema) ainda altera a data');

-- [6] O dono continua salvando o que o site salva.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_g3dono';
update perfis set nome = 'Dono G3 Editado', cidade = 'Corrente', bairro = 'Centro' where id = 'user_g3dono';
update vitrines_lojas set cidade = 'Corrente', bairro = null, sobre = 'Texto de teste', instagram = 'loja.teste.g3', faz_entrega = true where id = :'loja';
update anuncios set status = 'pausado' where id = '90000000-0000-4000-a000-000000000001' and status = 'ativo';
select pg_temp.confere(publicar_anuncio('90000000-0000-4000-a000-000000000001') in ('ativo', 'em_analise'), 'dono volta a publicar o anúncio pausado');
reset role;
select pg_temp.confere((select nome = 'Dono G3 Editado' and bairro = 'Centro' from perfis where id = 'user_g3dono'), 'dados da conta (minha-conta/dados) salvam');
select pg_temp.confere(coalesce((select criado_ip::text from anuncios where id = '90000000-0000-4000-a000-000000000001'), 'nulo') = :'ip_anuncio', 'edição do dono não mexe no IP da criação');

select 'G3: todas as verificações passaram' as resultado;
rollback;
