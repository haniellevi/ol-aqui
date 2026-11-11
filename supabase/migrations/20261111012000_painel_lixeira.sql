-- Situação da loja do dono para a tela Minha loja: lixeira, prazo e se tem pagamento
-- (uma loja com pagamento fica anonimizada e impede abrir outra com a mesma conta).
create function public.minha_loja_exclusao()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'na_lixeira', l.vitrine_id is not null,
    'apagar_apos', l.apagar_apos,
    'pode_restaurar', l.origem = 'dono',
    'tem_pagamentos', exists(select 1 from public.pagamentos p where p.vitrine_id = v.id) or v.gateway_assinatura_id is not null)
    from public.vitrines_lojas v
    left join public.lixeira_lojas l on l.vitrine_id = v.id
   where v.dono_id = public.usuario_id()
$$;
revoke all on function public.minha_loja_exclusao() from public, anon;
grant execute on function public.minha_loja_exclusao() to authenticated;
