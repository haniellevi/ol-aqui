-- Ativar depois de publicar o aplicativo com o novo fluxo e validar o envio.
-- O cadastro digitado não é uma prova de posse, independentemente da antiga configuração.
create or replace function public.whatsapp_confirmado(uid text default public.usuario_id())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from perfis where id=uid and whatsapp is not null and whatsapp_verificado_em is not null) $$;
delete from public.configuracoes where chave='radar.exigir_celular_confirmado';

-- As ações diretas no banco também exigem a confirmação. Ler e editar o perfil continuam possíveis.
create function public.exigir_whatsapp_operacao() returns trigger language plpgsql security definer set search_path = public as $$
declare uid text := public.usuario_id();
begin
  if current_setting('role', true) not in ('authenticated','anon') then return new; end if;
  if tg_table_name = 'anuncios' and new.status::text <> 'ativo' then return new; end if;
  if not public.whatsapp_confirmado(uid) then
    raise exception using errcode='42501', message='Confirme seu WhatsApp para continuar.', detail='campo:celular';
  end if;
  return new;
end $$;
create trigger exigir_whatsapp_anuncio before insert or update on public.anuncios for each row execute function public.exigir_whatsapp_operacao();
create trigger exigir_whatsapp_pedido before insert on public.radar_pedidos for each row execute function public.exigir_whatsapp_operacao();
create trigger exigir_whatsapp_proposta before insert or update on public.radar_propostas for each row execute function public.exigir_whatsapp_operacao();
create trigger exigir_whatsapp_vitrine before insert on public.vitrines_lojas for each row execute function public.exigir_whatsapp_operacao();

create or replace function public.radar_propor(
  p_pedido_id uuid, p_anuncio_id uuid, p_foto_url text, p_preco_centavos bigint, p_mensagem text, p_completo boolean)
returns table (modo text, whatsapp text, mensagem text, proposta_id uuid, editada boolean)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid       text := public.usuario_id();
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_prop    public.radar_propostas;
  v_fone    text;
  v_rest    integer;
  v_max     integer;
  v_msg     text;
  v_texto   text;
  palavra   text;
  v_id      uuid;
  v_editada boolean := false;
begin
  if uid is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(uid) then
    raise exception 'O Radar de Negócios é exclusivo dos planos com Radar.' using errcode = '42501';
  end if;

  -- trava a loja antes de contar as propostas: duas propostas ao mesmo tempo não passam do plano
  select * into v_vitrine from public.vitrines_lojas x where x.dono_id = uid for update;
  select * into v_pedido  from public.radar_pedidos x where x.id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.modo_contato = 'propostas_prazo' and v_pedido.propostas_ate <= now() then
    raise exception 'O prazo para propostas deste pedido já acabou.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = uid then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  -- o que vai na proposta
  v_max := least(coalesce(public.numero_ou_nulo(public.config('radar.proposta_mensagem_max', v_pedido.microrregiao_id, '300'))::int, 500), 500);
  v_msg := nullif(left(btrim(regexp_replace(replace(coalesce(p_mensagem, ''), E'\r\n', E'\n'), '[ \t]+', ' ', 'g')), greatest(v_max, 1)), '');
  if p_preco_centavos is not null and (p_preco_centavos < 0 or p_preco_centavos > 100000000000) then
    raise exception using errcode = '23514', message = 'Confira o preço da proposta.', detail = 'campo:preco';
  end if;
  if p_anuncio_id is not null and not exists (
       select 1 from public.anuncios a where a.id = p_anuncio_id and a.vitrine_id = v_vitrine.id and a.status = 'ativo') then
    raise exception using errcode = '23514', message = 'Escolha um anúncio seu que está no ar.', detail = 'campo:anuncio';
  end if;
  if p_foto_url is not null and not coalesce(public.foto_do_olaki(p_foto_url, uid, 'radar-' || p_pedido_id::text), false) then
    raise exception using errcode = '22023', message = 'Use uma foto enviada pelo OLAKI.', detail = 'campo:foto';
  end if;
  if p_completo and v_pedido.modo_contato = 'propostas_prazo' then
    if coalesce(p_preco_centavos, 0) <= 0 then
      raise exception using errcode = '23514', message = 'Diga o preço da sua proposta.', detail = 'campo:preco';
    end if;
    if p_anuncio_id is null and p_foto_url is null
       and not exists (select 1 from public.radar_propostas rp
                        where rp.pedido_id = p_pedido_id and rp.vitrine_id = v_vitrine.id
                          and (rp.anuncio_id is not null or rp.foto_url is not null)) then
      raise exception using errcode = '23514', message = 'Escolha um anúncio seu ou mande uma foto.', detail = 'campo:foto';
    end if;
  end if;
  -- mesmo filtro de palavras dos anúncios: a mensagem com palavra proibida não vai
  if v_msg is not null then
    for palavra in select jsonb_array_elements_text(public.config('moderacao.palavras_bloqueadas', v_pedido.microrregiao_id, '[]')) loop
      if public.sem_acento(lower(v_msg)) ~ ('\m' || public.sem_acento(lower(palavra)) || '\M') then
        raise exception using errcode = 'P0001', detail = 'campo:mensagem',
          message = format('Sua mensagem tem uma palavra que não pode no OLAKI ("%s"). Mude o texto e envie de novo.', palavra);
      end if;
    end loop;
  end if;

  select * into v_prop from public.radar_propostas rp where rp.pedido_id = p_pedido_id and rp.vitrine_id = v_vitrine.id;
  if v_prop.id is null then
    v_rest := public.propostas_restantes(uid);
    if v_rest is not null and v_rest <= 0 then
      raise exception 'Você usou todas as propostas do seu plano. Assine um plano maior para continuar.' using errcode = '42501';
    end if;
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url)
    values (p_pedido_id, v_vitrine.id, p_anuncio_id, v_msg, p_preco_centavos, p_foto_url)
    returning id into v_id;
    perform set_config('olaki.sistema', '1', true);   -- libera o contador protegido
    update public.radar_pedidos x set total_propostas = total_propostas + 1 where x.id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  else
    if v_prop.status <> 'ativa' then
      raise exception 'Sua proposta foi tirada pela equipe do OLAKI. Fale com o suporte.' using errcode = '42501';
    end if;
    -- editar é permitido até o prazo (modo prazo) ou enquanto o pedido está aberto (modo WhatsApp),
    -- mas nunca depois que o comprador escolheu: ele escolheu aquele preço
    if v_msg is not null or p_preco_centavos is not null or p_foto_url is not null or p_anuncio_id is not null then
      if v_prop.escolhida then
        raise exception using errcode = 'P0001', detail = 'campo:escolhida',
          message = 'O comprador já escolheu sua proposta. Agora combine pelo WhatsApp.';
      end if;
      update public.radar_propostas rp
         set mensagem = coalesce(v_msg, rp.mensagem),
             preco_centavos = coalesce(p_preco_centavos, rp.preco_centavos),
             foto_url = case when p_foto_url is not null then p_foto_url
                             when p_anuncio_id is not null then null else rp.foto_url end,
             anuncio_id = case when p_anuncio_id is not null then p_anuncio_id
                               when p_foto_url is not null then null else rp.anuncio_id end,
             atualizado_em = now()
       where rp.id = v_prop.id;
      v_editada := true;
    end if;
    v_id := v_prop.id;
  end if;

  if v_pedido.modo_contato = 'propostas_prazo' then
    -- o comprador não quer ser chamado: a oferta fica guardada e ele escolhe com quem falar
    return query select 'propostas_prazo'::text, null::text,
      format('Proposta enviada! O comprador recebe todas as ofertas em %s e escolhe com quem falar.',
             to_char(v_pedido.propostas_ate at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI')),
      v_id, v_editada;
    return;
  end if;

  -- entrega número confirmado por código (quem troca o número perde a confirmação);
  select pf.whatsapp into v_fone from public.perfis pf
   where pf.id = v_pedido.comprador_id and pf.whatsapp is not null
     and pf.whatsapp_verificado_em is not null;
  if v_fone is null then
    raise exception 'O comprador ainda não confirmou o celular. Tente mais tarde.' using errcode = 'P0001';
  end if;
  v_texto := format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.', v_pedido.titulo, v_vitrine.nome);
  return query select 'whatsapp_direto'::text, v_fone, v_texto, v_id, v_editada;
end $$;

create or replace function public.escolher_proposta(p_proposta_id uuid)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid  text := public.usuario_id();
  rp   public.radar_propostas;
  v    public.vitrines_lojas;
  p    public.radar_pedidos;
  fone text;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into rp from public.radar_propostas x where x.id = p_proposta_id;
  select * into p  from public.radar_pedidos x where x.id = rp.pedido_id for update;
  -- A edição da oferta e o encerramento também travam o pedido. Releia após a trava.
  select * into rp from public.radar_propostas x where x.id = p_proposta_id for update;
  if p.comprador_id is distinct from uid then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  if rp.status <> 'ativa' or p.status in ('em_analise', 'congelado') or p.fechado_motivo in ('cancelado', 'moderacao') then
    raise exception 'Esta proposta não está mais disponível.' using errcode = 'P0002';
  end if;
  select * into v from public.vitrines_lojas x where x.id = rp.vitrine_id;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está atendendo pelo OLAKI agora.' using errcode = 'P0002';
  end if;
  -- loja: WhatsApp da loja; pessoa física: o celular confirmado do perfil
  fone := coalesce(case when v.tipo = 'loja' then v.whatsapp end,
                   (select pf.whatsapp from public.perfis pf
                     where pf.id = v.dono_id and pf.whatsapp is not null
                       and pf.whatsapp_verificado_em is not null));
  if fone is null then
    raise exception 'Esta loja ainda não tem WhatsApp confirmado. Tente outra proposta.' using errcode = 'P0001';
  end if;
  if not rp.escolhida then
    update public.radar_propostas x set escolhida = true, escolhida_em = now() where x.id = rp.id;
    perform public.radar_aviso(v.dono_id, 'proposta_escolhida', p.microrregiao_id,
      jsonb_build_object('pedido', p.titulo, 'loja', v.nome), '/radar/' || p.id::text, 'proposta_escolhida:' || rp.id::text);
  end if;
  return query select fone, format('Olá, %s! Vi sua proposta no Radar do OLAKI para "%s".', v.nome, p.titulo);
end $$;
