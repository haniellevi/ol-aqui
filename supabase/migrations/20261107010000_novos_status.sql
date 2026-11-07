-- OLAKI · novos valores de status (arquivo separado: o Postgres não deixa
-- usar um valor de enum na mesma transação em que ele foi criado).
alter type public.status_anuncio add value if not exists 'em_analise' before 'congelado';
alter type public.status_pedido  add value if not exists 'em_analise' before 'congelado';
