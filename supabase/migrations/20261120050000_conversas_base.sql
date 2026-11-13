-- Radar v2 · fase 2 · Conversas (base).
-- Uma conversa por par cliente ↔ loja. Anúncios e propostas do Radar entram como cartões.
-- Regras no banco: tabelas com RLS ligada e sem policy; só funções SECURITY DEFINER leem e gravam.
-- Decisões do Raniel (13/11/2026): docs/superpowers/plans/2026-11-13-radar-v2-fase2-conversas.md.
-- Tudo começa DESLIGADO (conversas.ativa = false) até o "sim" do Raniel.

-- ---------------------------------------------------------------------
-- 0. Configurações (painel, grupo "Conversas")
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('conversas.ativa',             'false', 'conversas', false, 'Liga as Conversas (botão Conversar nos anúncios, conversa do Radar e ícone no topo)'),
  ('conversas.novas_por_dia',     '20',    'conversas', false, 'Conversas novas que um cliente pode abrir por dia (pelo botão Conversar)'),
  ('conversas.mensagens_por_hora','60',    'conversas', false, 'Mensagens que uma pessoa pode mandar por hora'),
  ('conversas.guarda_dias',       '180',   'conversas', false, 'Dias sem mensagem até a conversa ser apagada (conversa com denúncia aberta fica)')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table public.conversas (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           text not null references public.perfis(id) on update cascade on delete cascade,
  vitrine_id           uuid not null references public.vitrines_lojas(id) on delete cascade,
  origem               text not null check (origem in ('anuncio', 'radar')),
  whatsapp_liberado_em timestamptz,          -- cliente tocou "Mostrar meu WhatsApp" (não volta atrás)
  criado_em            timestamptz not null default now(),
  ultima_msg_em        timestamptz not null default clock_timestamp(),
  cliente_lido_em      timestamptz,
  loja_lido_em         timestamptz,          -- um só para o lado da loja: dono e gerentes compartilham
  unique (cliente_id, vitrine_id)
);
create index conversas_cliente_idx on public.conversas (cliente_id, ultima_msg_em desc);
create index conversas_vitrine_idx on public.conversas (vitrine_id, ultima_msg_em desc);
create index conversas_ultima_idx on public.conversas (ultima_msg_em);

create table public.conversa_mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversas(id) on delete cascade,
  autor_id     text references public.perfis(id) on update cascade on delete set null,
  lado         text not null check (lado in ('cliente', 'loja', 'sistema')),
  tipo         text not null check (tipo in ('texto', 'anuncio', 'proposta', 'sistema')),
  texto        text check (char_length(texto) <= 1000),
  anuncio_id   uuid references public.anuncios(id) on delete set null,
  pedido_id    uuid references public.radar_pedidos(id) on delete set null,
  proposta_id  uuid references public.radar_propostas(id) on delete set null,
  alerta_golpe boolean not null default false,
  ia_lida_em   timestamptz,                  -- gancho da fase 3 (IA do Radar); ninguém lê ainda
  criado_em    timestamptz not null default clock_timestamp()
);
create index conversa_mensagens_conversa_idx on public.conversa_mensagens (conversa_id, criado_em);
create index conversa_mensagens_autor_idx on public.conversa_mensagens (autor_id, criado_em);

create table public.conversa_bloqueios (
  cliente_id text not null references public.perfis(id) on update cascade on delete cascade,
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  por        text not null check (por in ('cliente', 'loja')),
  criado_em  timestamptz not null default now(),
  primary key (cliente_id, vitrine_id, por)
);

alter table public.conversas enable row level security;
alter table public.conversa_mensagens enable row level security;
alter table public.conversa_bloqueios enable row level security;
revoke all on public.conversas, public.conversa_mensagens, public.conversa_bloqueios from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Ajudantes
-- ---------------------------------------------------------------------
create or replace function public.conversas_ligadas()
returns boolean language sql stable security definer
set search_path = public, extensions
as $$ select coalesce((public.config('conversas.ativa', null, 'false'::jsonb) #>> '{}')::boolean, false) $$;

create or replace function public.conversas_exigir_ligadas()
returns void language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.conversas_ligadas() then
    raise exception 'As conversas ainda não estão ligadas.' using errcode = 'P0001';
  end if;
end $$;

-- 'cliente', 'loja' (dono ou gerente ativo) ou null (não participa)
create or replace function public.conversa_papel(p_conversa uuid)
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select case when c.cliente_id = public.usuario_id() then 'cliente'
              when public.pode_mexer_vitrine(c.vitrine_id) then 'loja' end
    from public.conversas c
   where c.id = p_conversa and public.usuario_id() is not null
$$;

create or replace function public.conversa_bloqueada(p_cliente text, p_vitrine uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$ select exists (select 1 from public.conversa_bloqueios b where b.cliente_id = p_cliente and b.vitrine_id = p_vitrine) $$;

-- Link ou telefone na mensagem: deixa passar, mas a tela mostra o alerta de golpe.
create or replace function public.conversa_texto_suspeito(p_texto text)
returns boolean language sql immutable
set search_path = public, extensions
as $$
  select coalesce(p_texto, '') ~* '(https?://|www\.|\.com|wa\.me)'
      or regexp_replace(coalesce(p_texto, ''), '[\s.()\-]', '', 'g') ~ '[0-9]{8,}'
$$;

-- Lojas que a pessoa cuida (dona ou gerente com convite aceito e não revogado)
create or replace function public.conversas_minhas_lojas()
returns uuid[] language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(array_agg(v.id), '{}'::uuid[]) || public.lojas_que_ajudo()
    from public.vitrines_lojas v where v.dono_id = public.usuario_id() and public.usuario_id() is not null
$$;

-- ---------------------------------------------------------------------
-- 3. Abrir pelo anúncio (botão "Conversar")
-- ---------------------------------------------------------------------
create or replace function public.abrir_conversa_anuncio(p_anuncio uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid    text := public.usuario_id();
  a      public.anuncios;
  v_conv uuid;
  v_ult  uuid;
begin
  perform public.conversas_exigir_ligadas();
  if uid is null then
    raise exception 'Entre na sua conta para conversar.' using errcode = '28000';
  end if;
  if not public.whatsapp_confirmado(uid) then
    raise exception 'Confirme seu celular para conversar.' using errcode = '42501';
  end if;
  select * into a from public.anuncios x where x.id = p_anuncio;
  if a.id is null or a.status <> 'ativo' then
    raise exception 'Este anúncio não está mais no ar.' using errcode = 'P0002';
  end if;
  if public.pode_mexer_vitrine(a.vitrine_id) then
    raise exception 'Este anúncio é seu.' using errcode = 'P0001';
  end if;
  if public.conversa_bloqueada(uid, a.vitrine_id) then
    raise exception 'Não é possível conversar com esta loja.' using errcode = '42501';
  end if;

  -- conversas abertas ao mesmo tempo pela mesma pessoa entram uma de cada vez (limite do dia)
  perform pg_advisory_xact_lock(hashtext('conversas:' || uid));
  select c.id into v_conv from public.conversas c where c.cliente_id = uid and c.vitrine_id = a.vitrine_id;
  if v_conv is null then
    if (select count(*) from public.conversas c
         where c.cliente_id = uid and c.origem = 'anuncio' and c.criado_em > now() - interval '1 day')
       >= public.config_inteiro('conversas.novas_por_dia', 20, 1, 1000) then
      raise exception 'Você abriu muitas conversas hoje. Tente amanhã.' using errcode = 'P0001';
    end if;
    insert into public.conversas (cliente_id, vitrine_id, origem, cliente_lido_em)
    values (uid, a.vitrine_id, 'anuncio', clock_timestamp())
    returning id into v_conv;
  end if;

  select m.anuncio_id into v_ult from public.conversa_mensagens m
   where m.conversa_id = v_conv and m.tipo = 'anuncio'
   order by m.criado_em desc, m.id desc limit 1;
  if v_ult is distinct from a.id then
    insert into public.conversa_mensagens (conversa_id, autor_id, lado, tipo, anuncio_id)
    values (v_conv, uid, 'cliente', 'anuncio', a.id);
    update public.conversas set ultima_msg_em = clock_timestamp(), cliente_lido_em = clock_timestamp() where id = v_conv;
  end if;
  return v_conv;
end $$;

-- ---------------------------------------------------------------------
-- 4. Enviar mensagem
-- ---------------------------------------------------------------------
create or replace function public.enviar_mensagem(p_conversa uuid, p_texto text)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid     text := public.usuario_id();
  v_papel text;
  c       public.conversas;
  v_reg   uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
  palavra text;
  v_id    uuid;
begin
  perform public.conversas_exigir_ligadas();
  v_papel := public.conversa_papel(p_conversa);
  if v_papel is null then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  select * into c from public.conversas x where x.id = p_conversa for update;
  if public.conversa_bloqueada(c.cliente_id, c.vitrine_id) then
    raise exception 'Esta conversa está bloqueada.' using errcode = '42501';
  end if;
  if char_length(v_texto) not between 1 and 1000 then
    raise exception 'Escreva uma mensagem de até 1.000 letras.' using errcode = '23514', detail = 'campo:texto';
  end if;
  select v.microrregiao_id into v_reg from public.vitrines_lojas v where v.id = c.vitrine_id;
  for palavra in select jsonb_array_elements_text(public.config('moderacao.palavras_bloqueadas', v_reg, '[]')) loop
    if public.sem_acento(lower(v_texto)) ~ ('\m' || public.sem_acento(lower(palavra)) || '\M') then
      raise exception using errcode = 'P0001', detail = 'campo:texto',
        message = format('Sua mensagem tem uma palavra que não pode no Mercado da Região ("%s"). Mude o texto e envie de novo.', palavra);
    end if;
  end loop;
  if (select count(*) from public.conversa_mensagens m
       where m.autor_id = uid and m.tipo = 'texto' and m.criado_em > clock_timestamp() - interval '1 hour')
     >= public.config_inteiro('conversas.mensagens_por_hora', 60, 1, 1000) then
    raise exception 'Muitas mensagens seguidas. Espere um pouco.' using errcode = 'P0001';
  end if;

  insert into public.conversa_mensagens (conversa_id, autor_id, lado, tipo, texto, alerta_golpe)
  values (p_conversa, uid, v_papel, 'texto', v_texto, public.conversa_texto_suspeito(v_texto))
  returning id into v_id;
  if v_papel = 'cliente' then
    update public.conversas set ultima_msg_em = clock_timestamp(), cliente_lido_em = clock_timestamp() where id = p_conversa;
  else
    update public.conversas set ultima_msg_em = clock_timestamp(), loja_lido_em = clock_timestamp() where id = p_conversa;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Leituras
-- ---------------------------------------------------------------------
-- Não lidas = texto ou proposta do OUTRO lado depois do meu "lido".
create or replace function public.minhas_conversas()
returns table (id uuid, papel text, outro_nome text, vitrine_id uuid, ultima_texto text,
               ultima_em timestamptz, nao_lidas integer, bloqueada boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  with eu as (select public.usuario_id() as uid, public.conversas_minhas_lojas() as lojas),
  minhas as (
    select c.*, case when c.cliente_id = eu.uid then 'cliente' else 'loja' end as meu_papel
      from public.conversas c, eu
     where eu.uid is not null and public.conversas_ligadas()
       and (c.cliente_id = eu.uid or c.vitrine_id = any(eu.lojas))
  )
  select c.id, c.meu_papel,
         case when c.meu_papel = 'cliente' then v.nome else public.mensagem_primeiro_nome(c.cliente_id) end,
         c.vitrine_id,
         case u.tipo when 'texto' then u.texto
                     when 'anuncio' then 'Anúncio: ' || coalesce(a.titulo, '')
                     when 'proposta' then 'Proposta: ' || coalesce(p.titulo, '')
                     else u.texto end,
         c.ultima_msg_em,
         (select count(*)::integer from public.conversa_mensagens m
           where m.conversa_id = c.id and m.tipo in ('texto', 'proposta')
             and m.lado = case when c.meu_papel = 'cliente' then 'loja' else 'cliente' end
             and m.criado_em > coalesce(case when c.meu_papel = 'cliente' then c.cliente_lido_em else c.loja_lido_em end, '-infinity')),
         public.conversa_bloqueada(c.cliente_id, c.vitrine_id)
    from minhas c
    join public.vitrines_lojas v on v.id = c.vitrine_id
    left join lateral (select * from public.conversa_mensagens m where m.conversa_id = c.id
                        order by m.criado_em desc, m.id desc limit 1) u on true
    left join public.anuncios a on a.id = u.anuncio_id
    left join public.radar_pedidos p on p.id = u.pedido_id
   order by c.ultima_msg_em desc
   limit 100
$$;

create or replace function public.conversas_nao_lidas()
returns integer language sql stable security definer
set search_path = public, extensions
as $$ select least(count(*), 99)::integer from public.minhas_conversas() m where m.nao_lidas > 0 $$;

create or replace function public.conversa_detalhe(p_conversa uuid)
returns table (id uuid, papel text, outro_nome text, loja_slug text, whatsapp_cliente text,
               whatsapp_liberado boolean, eu_bloqueei boolean, fui_bloqueado boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  with x as (select public.conversa_papel(p_conversa) as papel)
  select c.id, x.papel,
         case when x.papel = 'cliente' then v.nome else public.mensagem_primeiro_nome(c.cliente_id) end,
         v.slug,
         case when x.papel = 'loja' and c.whatsapp_liberado_em is not null then pf.whatsapp end,
         c.whatsapp_liberado_em is not null,
         exists (select 1 from public.conversa_bloqueios b where b.cliente_id = c.cliente_id and b.vitrine_id = c.vitrine_id and b.por = x.papel),
         exists (select 1 from public.conversa_bloqueios b where b.cliente_id = c.cliente_id and b.vitrine_id = c.vitrine_id and b.por <> x.papel)
    from public.conversas c
    cross join x
    join public.vitrines_lojas v on v.id = c.vitrine_id
    join public.perfis pf on pf.id = c.cliente_id
   where c.id = p_conversa and x.papel is not null and public.conversas_ligadas()
$$;

-- Mensagens em ordem (as 200 últimas); p_depois traz só as mais novas que esse instante.
create or replace function public.conversa_mensagens_ler(p_conversa uuid, p_depois timestamptz default null)
returns table (id uuid, lado text, tipo text, texto text, alerta_golpe boolean, criado_em timestamptz,
               anuncio_id uuid, anuncio_titulo text, anuncio_preco_centavos bigint, anuncio_foto text, anuncio_link text,
               pedido_id uuid, pedido_titulo text, proposta_preco_centavos bigint, autor_id text)
language sql stable security definer
set search_path = public, extensions
as $$
  select * from (
    select m.id, m.lado, m.tipo, m.texto, m.alerta_golpe, m.criado_em,
           m.anuncio_id, a.titulo, a.preco_centavos, a.fotos[1],
           case when a.id is null then null when a.slug is not null then '/anuncio/' || a.slug else '/anuncio/' || a.id end,
           m.pedido_id, p.titulo, rp.preco_centavos, m.autor_id
      from public.conversa_mensagens m
      left join public.anuncios a on a.id = m.anuncio_id
      left join public.radar_pedidos p on p.id = m.pedido_id
      left join public.radar_propostas rp on rp.id = m.proposta_id
     where m.conversa_id = p_conversa and (p_depois is null or m.criado_em > p_depois)
     order by m.criado_em desc, m.id desc
     limit 200
  ) t order by t.criado_em, t.id
$$;

create or replace function public.conversa_mensagens_de(p_conversa uuid, p_depois timestamptz default null)
returns table (id uuid, lado text, tipo text, texto text, alerta_golpe boolean, criado_em timestamptz,
               anuncio_id uuid, anuncio_titulo text, anuncio_preco_centavos bigint, anuncio_foto text, anuncio_link text,
               pedido_id uuid, pedido_titulo text, proposta_preco_centavos bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  select l.id, l.lado, l.tipo, l.texto, l.alerta_golpe, l.criado_em, l.anuncio_id, l.anuncio_titulo,
         l.anuncio_preco_centavos, l.anuncio_foto, l.anuncio_link, l.pedido_id, l.pedido_titulo, l.proposta_preco_centavos
    from public.conversa_mensagens_ler(p_conversa, p_depois) l
   where public.conversa_papel(p_conversa) is not null and public.conversas_ligadas()
$$;

-- ---------------------------------------------------------------------
-- 6. Lido e "Mostrar meu WhatsApp"
-- ---------------------------------------------------------------------
create or replace function public.marcar_conversa_lida(p_conversa uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v_papel text := public.conversa_papel(p_conversa);
begin
  perform public.conversas_exigir_ligadas();
  if v_papel is null then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  if v_papel = 'cliente' then
    update public.conversas set cliente_lido_em = clock_timestamp() where id = p_conversa;
  else
    update public.conversas set loja_lido_em = clock_timestamp() where id = p_conversa;
  end if;
end $$;

create or replace function public.mostrar_meu_whatsapp(p_conversa uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v_papel text := public.conversa_papel(p_conversa);
begin
  perform public.conversas_exigir_ligadas();
  if v_papel is null then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  if v_papel <> 'cliente' then
    raise exception 'Só o cliente pode mostrar o próprio WhatsApp.' using errcode = '42501';
  end if;
  update public.conversas set whatsapp_liberado_em = clock_timestamp(), ultima_msg_em = clock_timestamp()
   where id = p_conversa and whatsapp_liberado_em is null;
  if found then
    insert into public.conversa_mensagens (conversa_id, autor_id, lado, tipo, texto)
    values (p_conversa, public.usuario_id(), 'sistema', 'sistema', 'O cliente mostrou o WhatsApp para a loja.');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.conversas_ligadas(), public.conversas_exigir_ligadas(), public.conversa_papel(uuid),
  public.conversa_bloqueada(text, uuid), public.conversa_texto_suspeito(text), public.conversas_minhas_lojas(),
  public.abrir_conversa_anuncio(uuid), public.enviar_mensagem(uuid, text), public.minhas_conversas(),
  public.conversas_nao_lidas(), public.conversa_detalhe(uuid), public.conversa_mensagens_ler(uuid, timestamptz),
  public.conversa_mensagens_de(uuid, timestamptz), public.marcar_conversa_lida(uuid), public.mostrar_meu_whatsapp(uuid)
  from public, anon, authenticated;
grant execute on function public.conversas_ligadas() to anon, authenticated, service_role;
grant execute on function public.conversa_texto_suspeito(text), public.abrir_conversa_anuncio(uuid),
  public.enviar_mensagem(uuid, text), public.minhas_conversas(), public.conversas_nao_lidas(),
  public.conversa_detalhe(uuid), public.conversa_mensagens_de(uuid, timestamptz),
  public.marcar_conversa_lida(uuid), public.mostrar_meu_whatsapp(uuid)
  to authenticated, service_role;
