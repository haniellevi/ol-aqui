-- Etapa P5c (parte 1 de 2): novo estado da loja "montagem" (loja que a equipe monta para
-- transferir ao dono). Fica numa migração separada porque o Postgres só deixa usar um valor
-- novo de enum depois que a transação que o criou termina.
alter type public.status_vitrine add value if not exists 'montagem';
