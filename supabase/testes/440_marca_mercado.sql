\set ON_ERROR_STOP on
\set QUIET on
begin;
create or replace function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',caso; end if; end $$;
update documentos_legais set ativo=false where tipo='termos';
insert into documentos_legais(tipo,versao,titulo,conteudo,ativo,revisado_advogado)
  select 'termos',coalesce(max(versao),0)+1,'Termos do OLAKI',
    'Documento de teste da plataforma OLAKI. Endereço público: https://ol-aqui.vercel.app. As regras continuam preservadas.',true,true
    from documentos_legais where tipo='termos' returning id as documento \gset
update home_blocos set titulo='Texto personalizado da região' where chave='recentes';
-- REAPLICAR_MARCA
select pg_temp.confere((select titulo='Termos do OLAKI' and not ativo from documentos_legais where id=:'documento'),'versao aceita preservada');
select pg_temp.confere((select titulo='Termos do Mercado da Região' and not revisado_advogado from documentos_legais where tipo='termos' and ativo),'nova versao com marca e revisao pendente');
select pg_temp.confere((select count(*)=1 from documentos_legais where tipo='termos' and ativo),'reaplicacao nao duplica versao ativa');
select pg_temp.confere((select titulo='Texto personalizado da região' from home_blocos where chave='recentes'),'texto personalizado preservado');
select pg_temp.confere(not exists(select 1 from modelos_mensagem where texto ~ '\m(OLAKI|OL-AKI)\M'),'mensagens usam nova marca');
select pg_temp.confere((select tgenabled='O' from pg_trigger where tgrelid='modelos_mensagem'::regclass and tgname='modelos_mensagem_proteger'),'protecao dos modelos restaurada');
rollback;
