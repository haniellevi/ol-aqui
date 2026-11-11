-- A rota do Aki para lojistas usa a chave de serviço e confere, antes de gastar
-- crédito, se a conta não foi excluída nem bloqueada no painel.
grant select on public.contas_bloqueadas to service_role;
