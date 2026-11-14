\set ON_ERROR_STOP on
\set QUIET on
-- Telefone no padrão brasileiro de cada região: microrregioes.ddd aceita só DDD que existe no Brasil (67 valores),
-- vazio é permitido, a região-piloto Corrente-PI tem DDD 89, e a migração não mexe em DDD já preenchido.
begin;
reset role;

create function pg_temp.recusa850(comando text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when check_violation then return;
  end;
  raise exception 'DDD aceito indevidamente: %', comando;
end $$;

do $$ begin
  assert (select ddd from microrregioes where slug = 'corrente-pi') = '89', 'Corrente-PI sem DDD 89';
  assert (select count(*) from generate_series(0, 99) g where lpad(g::text, 2, '0') ~ '^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])$') = 67, 'Lista de DDD diferente de 67';
  assert (select count(*) from generate_series(0, 99) g where lpad(g::text, 2, '0') ~ '^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])$' and lpad(g::text, 2, '0') in ('10','20','23','25','26','29','30','36','39','40','50','52','56','57','58','59','60','70','72','76','78','80','90')) = 0, 'DDD inexistente aceito';
end $$;

-- Inexistentes, formato errado e letras: recusados pelo check
select pg_temp.recusa850(format('update microrregioes set ddd = %L where slug = ''corrente-pi''', v))
  from unnest(array['10','20','23','25','26','29','30','36','39','40','50','52','56','60','70','72','76','78','80','90','00','01','1','890','a1','9 ']) v;

-- DDD válidos de borda passam (e voltam ao 89 ao final)
update microrregioes set ddd = '11' where slug = 'corrente-pi';
update microrregioes set ddd = '99' where slug = 'corrente-pi';
update microrregioes set ddd = '77' where slug = 'corrente-pi';
do $$ begin assert (select ddd from microrregioes where slug = 'corrente-pi') = '77', 'DDD válido recusado'; end $$;

-- Vazio é permitido (região sem DDD recusa número sem DDD no site)
update microrregioes set ddd = null where slug = 'corrente-pi';
do $$ begin assert (select ddd is null from microrregioes where slug = 'corrente-pi'), 'DDD vazio não ficou nulo'; end $$;
update microrregioes set ddd = '89' where slug = 'corrente-pi';

do $$ begin assert (select ddd from microrregioes where slug = 'corrente-pi') = '89', 'DDD não voltou a 89'; end $$;

-- Migração repetida não troca DDD já preenchido com outro valor
update microrregioes set ddd = '77' where slug = 'corrente-pi';
update microrregioes set ddd = '89' where slug = 'corrente-pi' and cidade_sede = 'Corrente' and ddd is null;
do $$ begin assert (select ddd from microrregioes where slug = 'corrente-pi') = '77', 'Migração trocou DDD preenchido'; end $$;

rollback;
