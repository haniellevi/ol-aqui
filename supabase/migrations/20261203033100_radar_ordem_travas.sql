-- Integração B/D: evita ciclo loja/convite na saída concorrente do gerente.
create or replace function public.retirar_proposta_radar(p_proposta uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid text := public.usuario_id();
  rp public.radar_propostas;
  pedido public.radar_pedidos;
  loja public.vitrines_lojas;
  era_dono boolean;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode='28000'; end if;
  select * into rp from public.radar_propostas where id=p_proposta;
  if rp.id is null then raise exception 'Proposta não encontrada.' using errcode='42501'; end if;
  -- Loja antes do convite: mesma ordem de sair_da_loja e da purga.
  select * into loja from public.vitrines_lojas where id=rp.vitrine_id for update;
  era_dono := loja.dono_id=uid;
  if not coalesce(era_dono,false) then
    perform 1 from public.convites_gerente_loja c join public.perfis pf on pf.id=c.aceito_por
      where c.vitrine_id=loja.id and c.aceito_por=uid and c.revogado_em is null
        and c.aceito_em is not null and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
      for update of c;
    if not found then raise exception 'Proposta não encontrada.' using errcode='42501'; end if;
  end if;
  if exists(select 1 from public.termos_pendentes()) then
    raise exception 'Aceite os termos atualizados para continuar.' using errcode='42501';
  end if;
  -- Propor trava loja/pedido; escolher trava pedido/proposta. Nunca inverte essas ordens.
  select * into loja from public.vitrines_lojas where id=rp.vitrine_id for update;
  select * into pedido from public.radar_pedidos where id=rp.pedido_id for update;
  select * into rp from public.radar_propostas where id=p_proposta for update;
  if loja.id is null or pedido.id is null or rp.id is null
    or loja.status <> 'ativa' or loja.tipo <> 'loja'
    or (era_dono and loja.dono_id is distinct from uid) then
    raise exception 'Esta loja não está disponível.' using errcode='42501';
  end if;
  if pedido.status <> 'aberto' or pedido.expira_em <= now() or rp.escolhida then
    raise exception 'Só é possível retirar uma proposta não escolhida de pedido aberto.' using errcode='P0002';
  end if;
  if rp.status='retirada' then return pedido.id; end if;
  if rp.status <> 'ativa' then raise exception 'Esta proposta não está disponível.' using errcode='P0002'; end if;
  update public.radar_propostas set status='retirada', atualizado_em=now() where id=rp.id;
  return pedido.id;
end $$;

-- A edição gerenciada disputa a mesma loja e convite com a saída.
create or replace function public.editar_loja_gerenciada(
  p_loja uuid, p_endereco text, p_lat double precision, p_lng double precision,
  p_horarios jsonb, p_sobre text, p_faz_entrega boolean, p_entrega_obs text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  loja public.vitrines_lojas;
  sobre_limpo text := nullif(btrim(p_sobre), '');
  entrega_limpa text := nullif(regexp_replace(btrim(p_entrega_obs), '\s+', ' ', 'g'), '');
begin
  select v.* into loja from public.vitrines_lojas v
   where v.id = p_loja and v.tipo = 'loja' and v.status = 'ativa' for update;
  if not found then raise exception 'Esta loja não está disponível para edição.' using errcode = '42501'; end if;
  -- Revogação e edição do gerente disputam o mesmo bloqueio de linha.
  perform 1 from public.convites_gerente_loja c
    join public.perfis p on p.id = c.aceito_por
   where c.vitrine_id = p_loja and c.aceito_por = public.usuario_id() and c.revogado_em is null
     and p.whatsapp is not null and p.whatsapp_verificado_em is not null
   for update of c;
  if not found then raise exception 'Seu acesso a esta loja não está disponível.' using errcode = '42501'; end if;
  if exists (select 1 from public.termos_pendentes()) then
    raise exception 'Aceite os termos atualizados para salvar.' using errcode = '42501';
  end if;
  -- SECURITY DEFINER usa o papel do sistema. Repete aqui os filtros de texto
  -- que o gatilho aplica ao dono e mantém a descrição curta sincronizada.
  if sobre_limpo is distinct from loja.sobre and public.texto_bloqueado(sobre_limpo, loja.microrregiao_id) is not null then
    raise exception 'O texto Sobre nós tem uma palavra não permitida.' using errcode = '23514', detail = 'campo:sobre';
  end if;
  if entrega_limpa is distinct from loja.entrega_obs and public.texto_bloqueado(entrega_limpa, loja.microrregiao_id) is not null then
    raise exception 'O recado sobre entrega tem uma palavra não permitida.' using errcode = '23514', detail = 'campo:entrega_obs';
  end if;
  update public.vitrines_lojas
     set endereco = p_endereco, lat = p_lat, lng = p_lng, horarios = p_horarios,
         sobre = sobre_limpo,
         descricao = case when sobre_limpo is distinct from loja.sobre then left(sobre_limpo, 600) else loja.descricao end,
         faz_entrega = p_faz_entrega, entrega_obs = entrega_limpa
   where id = p_loja;
end $$;

