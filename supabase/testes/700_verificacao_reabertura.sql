\set ON_ERROR_STOP on
\set QUIET on
-- Verificação de lojas: o selo só cai quando CNPJ, endereço, cidade, bairro, região, mapa ou WhatsApp mudam.
-- Mudar nome ou Instagram mantém o selo e deixa um aviso aberto para a equipe.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create temp table rev700(r int);
-- Devolve a loja ao estado aprovado, com selo, e anota a revisão.
create function pg_temp.aprovar() returns void language plpgsql as $$
begin
  update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true, verificacao_motivo=null
   where id='70000000-0000-4000-a000-000000000001';
  delete from verificacao_loja_avisos;
  delete from rev700;
  insert into rev700 select verificacao_revisao from vitrines_lojas where id='70000000-0000-4000-a000-000000000001';
end $$;
create function pg_temp.estado() returns text language sql as $$
  select verificacao_estado||'/'||selo_loja_verificada||'/'||(verificacao_revisao - (select r from rev700))
    from vitrines_lojas where id='70000000-0000-4000-a000-000000000001'
$$;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
values ('user_dono700',:'reg','Dono 700','Corrente','5589999990700',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,cnpj,whatsapp,instagram,site_url,telefone_publico,tipo)
values ('70000000-0000-4000-a000-000000000001','user_dono700',:'reg','loja-700','Loja 700','Corrente','Centro','Rua A, 1','11222333000181','5589999990701','loja.700','https://a.example','5589999990702','loja');

-- [1] Instagram: mantém o selo e abre um aviso.
select pg_temp.aprovar();
update vitrines_lojas set instagram='loja.novo700' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='aprovada/true/0', 'instagram mantém aprovação, selo e revisão');
select pg_temp.confere((select count(*)=1 from verificacao_loja_avisos where tipo='mudou_instagram' and resolvido_em is null), 'instagram abre 1 aviso');

-- [2] Nome: idem; repetir o mesmo campo não cria segundo aviso aberto.
select pg_temp.aprovar();
update vitrines_lojas set nome='Loja 700 Nova' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='aprovada/true/0', 'nome mantém aprovação, selo e revisão');
select pg_temp.confere((select count(*)=1 from verificacao_loja_avisos where tipo='mudou_nome' and resolvido_em is null), 'nome abre 1 aviso');
update vitrines_lojas set nome='Loja 700 Outra' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere((select count(*)=1 from verificacao_loja_avisos where tipo='mudou_nome'), 'nome repetido não duplica aviso aberto');
select pg_temp.confere(pg_temp.estado()='aprovada/true/0', 'segunda troca de nome mantém selo');

-- [3] Campos que derrubam o selo.
select pg_temp.aprovar();
update vitrines_lojas set endereco='Rua B, 2' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'endereço derruba');
select pg_temp.aprovar();
update vitrines_lojas set cidade='Gilbués' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'cidade derruba');
select pg_temp.aprovar();
update vitrines_lojas set bairro='Bairro Novo' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'bairro derruba');
select pg_temp.aprovar();
update vitrines_lojas set cnpj='11444777000161' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'cnpj derruba');
select pg_temp.aprovar();
update vitrines_lojas set whatsapp='5589999990799' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'whatsapp derruba');

-- [4] Campos que não derrubam e não avisam.
select pg_temp.aprovar();
update vitrines_lojas set site_url='https://b.example' where id='70000000-0000-4000-a000-000000000001';
update vitrines_lojas set telefone_publico='5589999990798' where id='70000000-0000-4000-a000-000000000001';
update vitrines_lojas set slug='loja-700-nova' where id='70000000-0000-4000-a000-000000000001';
select pg_temp.confere(pg_temp.estado()='aprovada/true/0', 'site, telefone público e slug mantêm o selo');
select pg_temp.confere((select count(*)=0 from verificacao_loja_avisos), 'site, telefone público e slug não geram aviso');

-- [5] Perfil do dono: nome mantém; WhatsApp derruba.
select pg_temp.aprovar();
update perfis set nome='Dono 700 Novo' where id='user_dono700';
select pg_temp.confere(pg_temp.estado()='aprovada/true/0', 'nome do perfil mantém o selo');
update perfis set whatsapp='5589999990797' where id='user_dono700';
select pg_temp.confere(pg_temp.estado()='pendente/false/1', 'whatsapp do perfil derruba');

-- [6] Quem está logado não lê a tabela de avisos.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono700';
do $$ begin
  begin
    perform count(*) from verificacao_loja_avisos;
    raise exception 'Leitura dos avisos foi aceita';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
