\set ON_ERROR_STOP on
begin;
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_envioconvite891',id,'Loja convite','Corrente','5589999990896',now() from public.microrregioes where slug='corrente-pi';
insert into public.perfis(id,microrregiao_id,nome,cidade)
select 'user_outroconvite891',id,'Outra conta','Corrente' from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_envioconvite891',true);
select (public.quero_vender('loja','Loja convite','loja-convite-891','89999990896')).vitrine_id as loja \gset
select public.convidar_gerente_loja(:'loja','5589999990897') as token \gset
select set_config('request.jwt.claim.sub','user_outroconvite891',true);
select public.convite_gerente_reservar_envio(:'loja',:'token','5589999990897') as estranho \gset
select set_config('request.jwt.claim.sub','user_envioconvite891',true);
select public.convite_gerente_reservar_envio(:'loja',:'token','5589999990898') as outro \gset
select public.convite_gerente_reservar_envio(:'loja','42000000-0000-4000-a000-000000000099','5589999990897') as token_errado \gset
select public.convite_gerente_reservar_envio(:'loja',:'token','5589999990897') as primeiro \gset
select public.convite_gerente_reservar_envio(:'loja',:'token','5589999990897') as repetido \gset
select 1 / ((:'primeiro'::boolean and not :'repetido'::boolean and not :'outro'::boolean and not :'estranho'::boolean and not :'token_errado'::boolean)::int);
-- O limite permanece mesmo se o convite anterior for excluído por cascata.
reset role;
delete from public.convites_gerente_loja where token_hash=sha256(convert_to(:'token'::text,'UTF8'));
set local role authenticated;
create function pg_temp.verificar_limite(p_loja uuid) returns void language plpgsql as $$
declare token uuid; i integer;
begin
  for i in 1..9 loop
    token := public.convidar_gerente_loja(p_loja,'5589999990897');
    assert public.convite_gerente_reservar_envio(p_loja,token,'5589999990897'), 'tentativa válida rejeitada';
  end loop;
  token := public.convidar_gerente_loja(p_loja,'5589999990897');
  assert not public.convite_gerente_reservar_envio(p_loja,token,'5589999990897'), 'limite diário não foi aplicado';
end $$;
select pg_temp.verificar_limite(:'loja');
rollback;
