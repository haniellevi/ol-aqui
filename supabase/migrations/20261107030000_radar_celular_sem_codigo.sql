-- =====================================================================
-- OLAKI · Radar: celular sem código enquanto o SMS não funciona (07/11/2026)
-- O código por SMS do Clerk ainda não chega. Para o Radar funcionar já, o comprador
-- pode pedir com o WhatsApp digitado (sem confirmação), e a loja recebe esse número.
-- Chave no painel: radar.exigir_celular_confirmado (false agora; true volta a exigir o código).
-- =====================================================================

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('radar.exigir_celular_confirmado', 'false', 'radar', true,
   'Exigir celular confirmado por código para pedir no Radar. Deixe false enquanto o SMS do login não funcionar')
on conflict do nothing;

-- Pode pedir no Radar? Celular confirmado, ou só cadastrado quando o painel não exige o código.
create or replace function public.whatsapp_confirmado(uid text default public.usuario_id())
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.perfis p
     where p.id = uid and p.whatsapp is not null
       and (p.whatsapp_verificado_em is not null
            or public.config('radar.exigir_celular_confirmado', p.microrregiao_id, 'true'::jsonb) = 'false'::jsonb))
$$;

-- Igual à versão de 20261107010200, mudando só a entrega do número no fim:
-- sem confirmação, entrega o número digitado quando o painel não exige o código.
create or replace function public.revelar_contato_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_mensagem text default null,
  p_preco_centavos bigint default null, p_foto_url text default null)
returns table (modo text, whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_fone    text;
  v_rest    integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(public.usuario_id()) then
    raise exception 'O Radar de Negócios é exclusivo dos planos com Radar.' using errcode = '42501';
  end if;

  select * into v_vitrine from public.vitrines_lojas where dono_id = public.usuario_id();
  select * into v_pedido  from public.radar_pedidos where id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.modo_contato = 'propostas_prazo' and v_pedido.propostas_ate <= now() then
    raise exception 'O prazo para propostas deste pedido já acabou.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = public.usuario_id() then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.radar_propostas where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id) then
    v_rest := public.propostas_restantes(public.usuario_id());
    if v_rest is not null and v_rest <= 0 then
      raise exception 'Você usou todas as propostas do seu plano. Assine um plano maior para continuar.' using errcode = '42501';
    end if;
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url)
    values (p_pedido_id, v_vitrine.id, p_anuncio_id, left(p_mensagem, 500), p_preco_centavos, p_foto_url);
    perform set_config('olaki.sistema', '1', true);
    update public.radar_pedidos set total_propostas = total_propostas + 1 where id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  elsif v_pedido.modo_contato = 'propostas_prazo' then
    -- no modo prazo, a loja pode atualizar a própria oferta
    update public.radar_propostas
       set mensagem = coalesce(left(p_mensagem, 500), mensagem),
           preco_centavos = coalesce(p_preco_centavos, preco_centavos),
           foto_url = coalesce(p_foto_url, foto_url), anuncio_id = coalesce(p_anuncio_id, anuncio_id)
     where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id;
  end if;

  if v_pedido.modo_contato = 'propostas_prazo' then
    -- comprador não quer ser chamado: a oferta fica guardada e ele recebe o resumo no fim do prazo
    return query select 'propostas_prazo'::text, null::text,
      format('Proposta enviada! O comprador recebe todas as ofertas em %s e escolhe com quem falar.',
             to_char(v_pedido.propostas_ate at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI'));
    return;
  end if;
  -- entrega número confirmado no Clerk; sem confirmação, só se o painel não exige o código
  select pf.whatsapp into v_fone from public.perfis pf
   where pf.id = v_pedido.comprador_id and pf.whatsapp is not null
     and (pf.whatsapp_verificado_em is not null
          or public.config('radar.exigir_celular_confirmado', v_pedido.microrregiao_id, 'true'::jsonb) = 'false'::jsonb);
  if v_fone is null then
    raise exception 'O comprador ainda não confirmou o celular. Tente mais tarde.' using errcode = 'P0001';
  end if;
  return query select 'whatsapp_direto'::text, v_fone,
    format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.', v_pedido.titulo, v_vitrine.nome);
end $$;
revoke all on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) to authenticated;
