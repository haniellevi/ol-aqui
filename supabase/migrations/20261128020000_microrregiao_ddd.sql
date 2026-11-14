-- Números de telefone no padrão brasileiro de cada região: o DDD da microrregião completa o número digitado sem DDD
-- (regra em src/lib/telefone.ts). Só guarda o DDD; nenhum número existente é alterado.
-- Hoje só existe a região-piloto: Corrente-PI (sede Corrente) é DDD 89. Região sem DDD (null) recusa número sem DDD.
-- Cidades de outro DDD dentro da mesma região (Barreiras-BA e Formosa do Rio Preto-BA são DDD 77, conforme a
-- tabela de cidades) não herdam o 89: o número delas tem de vir com DDD. Ver pendências no PR.

alter table public.microrregioes add column if not exists ddd text;

alter table public.microrregioes drop constraint if exists microrregioes_ddd_valido;
alter table public.microrregioes add constraint microrregioes_ddd_valido
  check (ddd is null or ddd ~ '^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])$');

-- Preenche só o que está vazio e só onde a sede bate com a região conhecida.
update public.microrregioes
   set ddd = '89'
 where slug = 'corrente-pi' and cidade_sede = 'Corrente' and ddd is null;
