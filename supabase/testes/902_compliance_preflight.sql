-- Somente leitura; executar antes de integrar, nunca aplica migração.
begin read only;
do $$ begin
  assert to_regclass('public.admin_gestao_eventos') is not null, 'trilha ausente';
  assert to_regprocedure('public.compliance_consulta_valida(uuid)') is not null, 'consulta ausente';
  assert to_regprocedure('public.anuncio_retido(public.anuncios)') is not null, 'trava ausente';
  assert to_regprocedure('public.urls_sem_uso(text[])') is not null, 'checagem de mídia ausente';
  assert exists(select 1 from pg_trigger where tgname='anuncios_preservar_congelado' and not tgisinternal);
  assert exists(select 1 from pg_trigger where tgname='radar_pedidos_preservar_congelado' and not tgisinternal);
  assert exists(select 1 from pg_trigger where tgname='radar_propostas_preservar_congelado' and not tgisinternal);
end $$;
rollback;
