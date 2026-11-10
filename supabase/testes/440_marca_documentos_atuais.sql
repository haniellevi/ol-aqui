begin;
create temporary table documentos_antes as select * from public.documentos_legais;
-- REAPLICAR_DOCUMENTOS
do $$ begin
 assert not exists(select 1 from public.documentos_legais where ativo and concat_ws(' ',titulo,conteudo) ~* '\m(OLAKI|OL-AKI|OLAQUI|OL-AQUI)\M'), 'marca antiga ativa';
 assert not exists(select 1 from documentos_antes a left join public.documentos_legais d using(id) where d.id is null or d.titulo is distinct from a.titulo or d.conteudo is distinct from a.conteudo), 'texto histórico alterado';
 assert (select count(*) from documentos_antes)=(select count(*) from public.documentos_legais), 'reaplicação criou versões duplicadas';
end $$;
rollback;
