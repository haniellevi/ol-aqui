-- Radar piloto (25/11/2026): pedido com categoria obrigatória, aviso de pedido novo por WhatsApp
-- (desligado de fábrica, só para loja que ligou de propósito), SAIR/PARAR/STOP/CANCELAR para parar,
-- reenvio da fila dentro da janela de 8h às 20h, e marca no modelo de proposta.
-- Esta migração não manda nenhuma mensagem: só muda funções, textos e chaves.

-- ---------------------------------------------------------------------
-- 1. Fila: estado "cancelada" (SAIR ou preferência desligada)
-- ---------------------------------------------------------------------
alter table public.whatsapp_fila drop constraint whatsapp_fila_estado_check;
alter table public.whatsapp_fila add constraint whatsapp_fila_estado_check
  check (estado in ('pendente', 'enviando', 'enviada', 'falha', 'incerta', 'cancelada'));

-- ---------------------------------------------------------------------
-- 2. Chave geral do aviso do Radar por WhatsApp: desligada de fábrica
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select 'radar.whatsapp_ativo', 'false'::jsonb, 'radar', false,
       'Manda aviso de pedido novo do Radar por WhatsApp (só para lojas que ligaram esse aviso, das 8h às 20h). Fica desligada até o piloto ser aprovado.'
 where not exists (select 1 from public.configuracoes c where c.chave = 'radar.whatsapp_ativo' and c.microrregiao_id is null);

-- ---------------------------------------------------------------------
-- 3. Modelo do pedido novo no WhatsApp (só a região; nada do comprador)
-- ---------------------------------------------------------------------
insert into public.modelos_mensagem (chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo_padrao, texto_padrao)
select 'pedido_novo', 'whatsapp', 920, 'Pedido novo no Radar (WhatsApp)',
       'Quando sai um pedido novo do Radar para uma loja que ligou esse aviso no WhatsApp.',
       array['cidade']::text[], null,
       'Mercado da Região: chegou um pedido novo no Radar para {cidade}. Veja o pedido no link. Responda SAIR para parar estes avisos.',
       null,
       'Mercado da Região: chegou um pedido novo no Radar para {cidade}. Veja o pedido no link. Responda SAIR para parar estes avisos.'
 where not exists (select 1 from public.modelos_mensagem m where m.chave = 'pedido_novo' and m.canal = 'whatsapp');

-- ---------------------------------------------------------------------
-- 4. Marca: "OLAKI" -> "Mercado da Região" no modelo de proposta (WhatsApp)
-- ---------------------------------------------------------------------
-- O protetor congela os textos padrão pelo painel; a pausa dura só esta transação.
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
update public.modelos_mensagem
   set texto        = replace(texto, 'OLAKI', 'Mercado da Região'),
       texto_padrao = replace(texto_padrao, 'OLAKI', 'Mercado da Região')
 where chave = 'proposta_nova' and canal = 'whatsapp'
   and (texto like '%OLAKI%' or texto_padrao like '%OLAKI%');
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;

-- ---------------------------------------------------------------------
-- 5. Preferência do aviso por WhatsApp (padrão DESLIGADO: sem linha = não envia)
-- ---------------------------------------------------------------------
create function public.salvar_preferencia_whatsapp_radar(p_ligado boolean)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_ligado is null then
    raise exception 'Escolha ligar ou desligar.' using errcode = '22023';
  end if;
  if p_ligado and not public.whatsapp_confirmado(uid) then
    raise exception 'Confirme seu WhatsApp antes de ligar os avisos por WhatsApp.' using errcode = '42501';
  end if;
  insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
  values (uid, 'pedido_novo', 'whatsapp', p_ligado, now())
  on conflict (usuario_id, tipo, canal) do update set ligado = excluded.ligado, atualizado_em = now();
  return p_ligado;
end $$;

create function public.minha_preferencia_whatsapp_radar()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'ligado', coalesce((select pa.ligado from public.preferencias_avisos pa
                         where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp'), false),
    'confirmado', coalesce(public.whatsapp_confirmado(uid), false),
    'ativo', coalesce(public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb, false));
end $$;

revoke all on function public.salvar_preferencia_whatsapp_radar(boolean), public.minha_preferencia_whatsapp_radar()
  from public, anon;
grant execute on function public.salvar_preferencia_whatsapp_radar(boolean), public.minha_preferencia_whatsapp_radar()
  to authenticated;

-- ---------------------------------------------------------------------
-- 6. Pedido do site: categoria obrigatória (depois da checagem de login e da repetição)
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido_radar_site(
  p_chave uuid, p_titulo text, p_cidade text default null,
  p_modo text default 'whatsapp_direto', p_prazo_horas integer default null,
  p_detalhes text default null, p_categoria_id uuid default null,
  p_preco_min_centavos bigint default null, p_preco_max_centavos bigint default null,
  p_cidades_ids uuid[] default null, p_visibilidade text default 'lojas')
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  resultado jsonb;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode = '28000'; end if;
  if p_chave is null then raise exception 'Identificação do envio ausente.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('radar_pedido:' || uid));
  select jsonb_build_object('id', p.id, 'status', p.status) into resultado
    from public.radar_pedidos p where p.comprador_id = uid and p.chave_envio = p_chave;
  if resultado is not null then return resultado; end if;
  if p_categoria_id is null or not exists (select 1 from public.categorias c where c.id = p_categoria_id and c.ativa) then
    raise exception using errcode = '23514', message = 'Escolha uma categoria para o seu pedido.', detail = 'campo:categoria';
  end if;
  resultado := public.criar_pedido_radar(p_titulo, p_cidade, p_modo, p_prazo_horas,
    p_detalhes, p_categoria_id, p_preco_min_centavos, p_preco_max_centavos,
    'normal', null, 'site', p_cidades_ids, p_visibilidade);
  update public.radar_pedidos set chave_envio = p_chave where id = (resultado->>'id')::uuid;
  return resultado;
end $$;

-- ---------------------------------------------------------------------
-- 7. Aviso de pedido novo: também no WhatsApp (chave ligada + loja ligou + número confirmado)
-- ---------------------------------------------------------------------
create or replace function public.radar_avisar_pedido_novo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  categoria_pedido uuid;
  por_dia integer;
  por_comprador integer;
  max_vendedores integer;
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  ligados jsonb;
  chave_aviso text := 'pedido_novo:' || new.id::text;
  vars jsonb;
  dono text;
  vitrine_alvo uuid;
  whatsapp_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  modelo_wa public.modelos_mensagem;
  texto_wa text;
begin
  if new.status <> 'aberto' or new.expira_em <= now() or new.total_propostas >= new.max_propostas
     or (new.modo_contato = 'propostas_prazo' and (new.propostas_ate is null or new.propostas_ate <= now())) then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'em_analise' then
    return null; -- publicação após análise; reabrir um pedido já publicado não é um novo pedido
  end if;

  categoria_pedido := public.radar_categoria_pedido(new.categoria_id, new.categoria);
  if categoria_pedido is null then return null; end if;

  ligados := public.config('radar.avisos_ligados', new.microrregiao_id, null);
  if jsonb_typeof(ligados) = 'array' and not (ligados ? 'pedido_novo') then return null; end if;

  por_dia := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_dia', new.microrregiao_id, 'null'))::int;
  por_comprador := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_comprador_dia', new.microrregiao_id, 'null'))::int;
  max_vendedores := coalesce(public.numero_ou_nulo(
    public.config('radar.avisos_lojas_max_por_pedido', new.microrregiao_id, '200')
  )::int, 200);
  if tg_op = 'UPDATE' then
    max_vendedores := max_vendedores - (select count(*)::int from public.notificacoes n where n.chave = chave_aviso);
  end if;
  if max_vendedores <= 0 then return null; end if;

  -- RF2: sem cidades marcadas, o aviso diz o nome da região (não "Toda a região")
  vars := jsonb_build_object('pedido', new.titulo,
    'cidade', case when new.cidades_ids is null
                   then coalesce((select m.nome from public.microrregioes m where m.id = new.microrregiao_id), new.cidade)
                   else new.cidade end,
    'preco', public.radar_faixa_texto(new.preco_min_centavos, new.preco_max_centavos));

  -- WhatsApp: só com a chave geral ligada e o modelo ativo (o aviso por loja é conferido no laço)
  if whatsapp_ligado then
    select * into modelo_wa from public.modelos_mensagem x where x.chave = 'pedido_novo' and x.canal = 'whatsapp';
  end if;

  for dono, vitrine_alvo in
    select v.dono_id, v.id
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
     where v.microrregiao_id = new.microrregiao_id and v.status = 'ativa'
       and v.dono_id <> new.comprador_id
       and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and public.recebe_aviso_radar_na_hora(v.dono_id)
       and public.radar_pedido_na_area(new, v)
       and exists (
         select 1 from public.anuncios a
          where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
            and public.radar_nicho_corresponde(categoria_pedido, a.categoria_id)
       )
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado
       )
       and not exists (
         select 1 from public.notificacoes n where n.usuario_id = v.dono_id and n.chave = chave_aviso
       )
       and (por_dia is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.status = 'aberto'
       ) < por_dia)
       and (por_comprador is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.comprador_id = new.comprador_id
       ) < por_comprador)
     order by v.criado_em, v.id
     limit max_vendedores
  loop
    perform public.radar_aviso(
      dono, 'pedido_novo', new.microrregiao_id, vars, '/radar/' || new.id::text, chave_aviso
    );
    -- A loja precisa ter ligado o aviso no WhatsApp (padrão desligado). O número já foi conferido acima.
    if whatsapp_ligado and modelo_wa.id is not null and modelo_wa.ativo and exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = dono and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) then
      begin
        texto_wa := public.mensagem_montar(modelo_wa.texto, jsonb_build_object('cidade', vars->>'cidade'), 1000);
        perform public.whatsapp_enfileirar(dono, texto_wa, '/radar/' || new.id::text,
          'radar_pedido_novo:' || new.id::text || ':' || vitrine_alvo::text);
      exception when others then
        -- aviso nunca derruba a publicação do pedido
        raise warning 'Aviso de WhatsApp do pedido não saiu: %', sqlerrm;
      end;
    end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 8. Fila de envio: reenvio respeita a janela; Radar de quem desligou sai da fila
-- ---------------------------------------------------------------------
-- Pega até p_limite mensagens vencidas e as marca "enviando" (conta a tentativa).
-- Avisos do Radar: se a pessoa desligou (SAIR ou em Minha conta), viram "cancelada"; com a chave geral
-- desligada, ficam na fila sem sair (não são pegos).
create or replace function public.whatsapp_fila_pegar(p_limite integer default 5)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < now() - interval '10 minutes';
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado);
  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = now()
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= now()
          and (radar_ligado or x.chave is null or x.chave not like 'radar_pedido_novo:%')
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- Resultado do envio: 'enviado', 'falha' (volta na próxima janela, 5 min depois, até 3 tentativas) ou 'incerto' (nunca repete).
create or replace function public.whatsapp_fila_resultado(p_id uuid, p_resultado text)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare f public.whatsapp_fila;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorado'; end if;
  if p_resultado = 'enviado' then
    update public.whatsapp_fila set estado = 'enviada', enviada_em = now(), erro = null where id = f.id;
    return 'enviada';
  elsif p_resultado = 'falha' then
    if f.tentativas >= 3 then
      update public.whatsapp_fila set estado = 'falha', erro = 'falha' where id = f.id;
      return 'falha';
    end if;
    -- o reenvio também respeita a janela de 8h às 20h (Fortaleza)
    update public.whatsapp_fila
       set estado = 'pendente', enviar_apos = public.proxima_janela_whatsapp(now() + interval '5 minutes'), erro = 'falha'
     where id = f.id;
    return 'pendente';
  end if;
  update public.whatsapp_fila set estado = 'incerta', erro = 'incerto' where id = f.id;
  return 'incerta';
end $$;

-- ---------------------------------------------------------------------
-- 9. SAIR / PARAR / STOP / CANCELAR (webhook de entrada da Evolution; só o servidor)
-- ---------------------------------------------------------------------
create table public.whatsapp_respostas (
  id         uuid primary key default gen_random_uuid(),
  usuario_id text not null references public.perfis(id) on delete cascade on update cascade,
  comando    text not null check (comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')),
  criado_em  timestamptz not null default now()
);
alter table public.whatsapp_respostas enable row level security;
revoke all on public.whatsapp_respostas from public, anon, authenticated, service_role;

-- Desliga o aviso do Radar por WhatsApp de quem tem esse número, cancela os avisos dela na fila e registra.
-- Devolve true se achou alguma conta com o número. Nunca guarda o número nem o texto da mensagem.
create function public.whatsapp_sair(p_numero text, p_comando text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo record;
  achou boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_comando not in ('SAIR', 'PARAR', 'STOP', 'CANCELAR') then
    raise exception 'Pedido de saída inválido.' using errcode = '22023';
  end if;
  for alvo in select pf.id from public.perfis pf where pf.whatsapp = p_numero loop
    achou := true;
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (alvo.id, 'pedido_novo', 'whatsapp', false, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = false, atualizado_em = now();
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
     where f.usuario_id = alvo.id and f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%';
    insert into public.whatsapp_respostas (usuario_id, comando) values (alvo.id, p_comando);
  end loop;
  return achou;
end $$;

-- ---------------------------------------------------------------------
-- 10. Meu plano: plano contratado (mesmo inativo) e cortesia do Radar da própria loja
-- ---------------------------------------------------------------------
create function public.meu_plano_contratado()
returns table (codigo text, nome text, e_teste boolean, ativo boolean)
language sql stable security definer
set search_path = public
as $$
  select p.codigo, p.nome, p.e_teste, p.ativo
    from public.vitrines_lojas v
    join public.planos p on p.codigo = v.plano
   where v.dono_id = public.usuario_id()
$$;

create function public.minha_cortesia_radar()
returns timestamptz language sql stable security definer
set search_path = public
as $$
  select c.ate
    from public.radar_cortesias c
    join public.vitrines_lojas v on v.id = c.vitrine_id
   where v.dono_id = public.usuario_id() and c.ate > now()
$$;

revoke all on function public.meu_plano_contratado(), public.minha_cortesia_radar() from public, anon;
grant execute on function public.meu_plano_contratado(), public.minha_cortesia_radar() to authenticated;

-- ---------------------------------------------------------------------
-- 11. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.whatsapp_sair(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sair(text, text) to service_role;
