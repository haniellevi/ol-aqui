-- Créditos do Aki pertencem à conta. Reservas contam enquanto o provedor trabalha.
alter table public.vitrines_lojas
  add column categoria_loja text check (char_length(categoria_loja) between 1 and 80),
  add column banner_aki_posicao integer check (banner_aki_posicao between 0 and 100);

grant select (categoria_loja, banner_aki_posicao) on public.vitrines_lojas to authenticated;

create table public.aki_imagens (
  id uuid primary key,
  usuario_id text not null references public.perfis(id) on delete cascade,
  tipo text not null check (tipo in ('banner', 'produto')),
  anuncio_id uuid,
  foto_original text,
  gratuito boolean not null,
  estado text not null default 'reservada' check (estado in ('reservada', 'pronta', 'falhou')),
  url text,
  bloqueada boolean not null default false,
  criada_em timestamptz not null default now(),
  check ((estado = 'pronta') = (url is not null)),
  check ((tipo = 'produto') = (anuncio_id is not null and foto_original is not null))
);
create index aki_imagens_conta_idx on public.aki_imagens (usuario_id, gratuito, criada_em);
create index aki_imagens_mes_idx on public.aki_imagens (criada_em);
alter table public.aki_imagens enable row level security;
revoke all on public.aki_imagens from public, anon, authenticated;
grant select, update on public.aki_imagens to service_role;

-- O navegador pode usar o endereço público, mas só o servidor cria as artes do Aki.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $p$create policy "aki imagens protegidas" on storage.objects as restrictive for all to anon, authenticated
      using (bucket_id <> 'anuncios' or name !~ '/aki-[a-f0-9-]+\.webp$')
      with check (bucket_id <> 'anuncios' or name !~ '/aki-[a-f0-9-]+\.webp$')$p$;
  end if;
end $$;

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('robo.max_geracoes_imagem_mes', '500', 'robo', false, 'Teto global de pedidos de imagem por mês, incluindo tentativas com erro.')
on conflict do nothing;

insert into public.robo_modelos
  (provedor, modelo, nome, le_imagem, usa_ferramentas, preco_entrada_usd, preco_saida_usd,
   preco_cache_leitura_usd, preco_cache_escrita_usd, ativo)
values ('openai', 'gpt-6-luna', 'GPT-6 Luna', true, true, 0.1, 0.5, 0.01, 0.125, true)
on conflict (provedor, modelo) do nothing;

create function public.aki_creditos_imagem(p_usuario text)
returns table (restantes integer, gratuito boolean, ligado boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v public.vitrines_lojas;
  p public.planos;
  limite integer;
  inicio timestamptz;
begin
  select * into v from public.vitrines_lojas where dono_id = p_usuario and tipo = 'loja';
  if v.id is null or v.status = 'suspensa' then return query select 0, true, false; return; end if;
  p := public.plano_efetivo(v);
  gratuito := coalesce(p.preco_centavos, 0) = 0;
  limite := case when p.codigo = 'slim' and not gratuito then 3
                 when p.codigo = 'full' and not gratuito then 20
                 when p.codigo is not null and gratuito then 1
                 else 0 end;
  ligado := public.config('robo.ativo', v.microrregiao_id, 'false') is not distinct from 'true'::jsonb;

  if not gratuito and limite > 0 then
    v := public.vitrine_com_proximo(v);
    -- Uma assinatura pré-paga por vários meses tem uma janela por período do plano.
    inicio := v.plano_expira_em - make_interval(days => p.periodo_dias *
      greatest(1, ceil(extract(epoch from (v.plano_expira_em - now())) / (86400 * p.periodo_dias))::int));
  end if;

  select greatest(0, limite - count(*)::int) into restantes
    from public.aki_imagens i
    where i.usuario_id = p_usuario and i.gratuito = aki_creditos_imagem.gratuito
      and (inicio is null or i.criada_em >= inicio)
      and (i.estado = 'pronta' or (i.estado = 'reservada' and i.criada_em > now() - interval '5 minutes'));
  return next;
end $$;

create function public.aki_reservar_imagem(p_usuario text, p_id uuid, p_tipo text, p_anuncio uuid, p_foto text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c record;
  i public.aki_imagens;
  teto numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('aki_imagem:' || p_usuario, 0));
  select * into c from public.aki_creditos_imagem(p_usuario);
  if not c.ligado then return jsonb_build_object('estado', 'desligado'); end if;

  select * into i from public.aki_imagens where id = p_id and usuario_id = p_usuario;
  if found then
    if i.tipo is distinct from p_tipo or i.anuncio_id is distinct from p_anuncio or i.foto_original is distinct from p_foto then
      return jsonb_build_object('estado', 'invalida');
    end if;
    return jsonb_build_object('estado',
      case when i.bloqueada then 'invalida'
           when i.estado = 'reservada' and i.criada_em <= now() - interval '5 minutes' then 'falhou' else i.estado end,
      'url', case when not i.bloqueada then i.url end, 'restantes', c.restantes);
  end if;
  if p_tipo = 'produto' and not exists (
    select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
    where a.id = p_anuncio and v.dono_id = p_usuario and v.tipo = 'loja'
      and a.status not in ('congelado', 'excluido') and p_foto = any(a.fotos)
      and public.foto_do_olaki(p_foto, p_usuario)
  ) then return jsonb_build_object('estado', 'invalida'); end if;
  if c.restantes < 1 then return jsonb_build_object('estado', 'sem_credito', 'restantes', 0); end if;

  perform pg_advisory_xact_lock(hashtextextended('aki_imagem:teto', 0));
  teto := public.numero_ou_nulo(public.config('robo.max_geracoes_imagem_mes', null, 'null'));
  if teto is null or (select count(*) from public.aki_imagens where criada_em >= public.robo_inicio('mes')) >= teto then
    return jsonb_build_object('estado', 'limite_global');
  end if;
  insert into public.aki_imagens (id, usuario_id, tipo, anuncio_id, foto_original, gratuito)
    values (p_id, p_usuario, p_tipo, p_anuncio, p_foto, c.gratuito);
  return jsonb_build_object('estado', 'nova', 'restantes', c.restantes - 1);
end $$;

-- Reserva a conversa de cadastro com o Luna usando os limites e o livro-caixa do Aki.
create function public.aki_reservar_cadastro(p_usuario text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  regiao uuid;
  m public.robo_modelos;
  limite numeric;
  teto numeric;
  estimativa numeric;
  reserva bigint;
begin
  perform pg_advisory_xact_lock(hashtext('robo_uso:' || p_usuario));
  perform pg_advisory_xact_lock(hashtext('robo_uso:orcamento'));
  select microrregiao_id into regiao from public.perfis where id = p_usuario;
  if regiao is null or public.config('robo.ativo', regiao, 'false') is distinct from 'true'::jsonb then return null; end if;
  select * into m from public.robo_modelos where provedor = 'openai' and modelo = 'gpt-6-luna' and ativo;
  limite := public.numero_ou_nulo(public.config('robo.limite_diario_pessoa', regiao, 'null'));
  teto := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null'));
  estimativa := (4000 * m.preco_entrada_usd + 600 * m.preco_saida_usd) / 10000
    * public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  if estimativa is null or estimativa <= 0 or limite is null or teto is null
    or (select count(*) from public.robo_uso where usuario_id = p_usuario and tipo in ('conversa', 'foto')
          and criado_em >= public.robo_inicio('dia')) >= limite
    or (select coalesce(sum(custo_centavos), 0) from public.robo_uso where criado_em >= public.robo_inicio('mes')) + estimativa > teto
  then return null; end if;
  insert into public.robo_uso (usuario_id, microrregiao_id, tipo, provedor, modelo, custo_centavos, erro)
    values (p_usuario, regiao, 'conversa', 'openai', 'gpt-6-luna', estimativa, 'em andamento')
    returning id into reserva;
  return reserva;
end $$;

revoke all on function public.aki_creditos_imagem(text), public.aki_reservar_imagem(text, uuid, text, uuid, text),
  public.aki_reservar_cadastro(text) from public, anon, authenticated;
grant execute on function public.aki_creditos_imagem(text), public.aki_reservar_imagem(text, uuid, text, uuid, text),
  public.aki_reservar_cadastro(text) to service_role;

create function public.aki_validar_categoria_loja()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.categoria_loja := nullif(btrim(new.categoria_loja), '');
  if new.categoria_loja is not null
     and (tg_op = 'INSERT' or new.categoria_loja is distinct from old.categoria_loja)
     and public.texto_bloqueado(new.categoria_loja, new.microrregiao_id) is not null then
    raise exception using errcode = '23514', message = 'Confira a categoria da loja.', detail = 'campo:categoria_loja';
  end if;
  return new;
end $$;
create trigger vitrines_aki_validar_categoria before insert or update of categoria_loja on public.vitrines_lojas
  for each row execute function public.aki_validar_categoria_loja();

-- A operação original e os campos aprovados são salvos na mesma transação.
create function public.quero_vender_com_descricao(
  p_nome text, p_slug text, p_whatsapp text, p_cidade text, p_categoria text, p_sobre text
) returns public.vendedor_resumo language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.vendedor_resumo;
  regiao uuid;
begin
  p_categoria := nullif(btrim(p_categoria), '');
  p_sobre := nullif(btrim(p_sobre), '');
  select microrregiao_id into regiao from public.perfis where id = public.usuario_id();
  if char_length(p_categoria) > 80 then
    raise exception using errcode = '23514', message = 'Confira a categoria da loja.', detail = 'campo:categoria_loja';
  end if;
  if char_length(p_sobre) > 1500 or public.texto_bloqueado(p_sobre, regiao) is not null then
    raise exception using errcode = '23514', message = 'Confira a descrição da loja.', detail = 'campo:sobre';
  end if;
  r := public.quero_vender('loja', p_nome, p_slug, p_whatsapp, p_cidade);
  if p_categoria is not null or p_sobre is not null then
    update public.vitrines_lojas set categoria_loja = coalesce(p_categoria, categoria_loja), sobre = coalesce(p_sobre, sobre),
      descricao = coalesce(left(p_sobre, 600), descricao)
      where id = r.vitrine_id and dono_id = public.usuario_id();
  end if;
  return r;
end $$;
revoke all on function public.quero_vender_com_descricao(text, text, text, text, text, text) from public, anon;
grant execute on function public.quero_vender_com_descricao(text, text, text, text, text, text) to authenticated;

-- Só uma geração registrada para o dono pode ativar o banner de IA.
create function public.aki_aplicar_banner(p_id uuid, p_posicao integer, p_logo text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  uid text := public.usuario_id();
  v public.vitrines_lojas;
  arte text;
begin
  if uid is null or p_posicao is null or p_posicao not between 0 and 100 then
    raise exception 'Confira a posição do logo.' using errcode = '22023';
  end if;
  select * into v from public.vitrines_lojas where dono_id = uid and tipo = 'loja' for update;
  select url into arte from public.aki_imagens where id = p_id and usuario_id = uid and tipo = 'banner' and estado = 'pronta' and not bloqueada;
  if v.id is null or v.status = 'suspensa' or arte is null or arte = v.banner_moderado_url then
    raise exception 'Esta arte não pode ser aplicada à loja.' using errcode = '42501';
  end if;
  if p_logo is not null and not coalesce(public.foto_do_olaki(p_logo, uid, 'loja'), false) then
    raise exception 'Envie o logo pelo editor.' using errcode = '22023';
  end if;
  update public.vitrines_lojas set
    banner_tipo = 'foto', banner_url = arte, banner_aki_posicao = p_posicao,
    logo_url = coalesce(p_logo, logo_url),
    capa_url = case when capa_url = banner_url and arte is distinct from banner_url then null else capa_url end,
    banner_moderado_em = null, banner_moderado_motivo = null
    where id = v.id;
end $$;
revoke all on function public.aki_aplicar_banner(uuid, integer, text) from public, anon;
grant execute on function public.aki_aplicar_banner(uuid, integer, text) to authenticated;

create function public.aki_proteger_banner()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.banner_tipo <> 'foto' or new.banner_url is null then
    new.banner_aki_posicao := null;
  elsif not public.acesso_sistema() then
    if tg_op = 'UPDATE' and new.banner_url is not distinct from old.banner_url then
      new.banner_aki_posicao := old.banner_aki_posicao;
    else
      new.banner_aki_posicao := null;
    end if;
  end if;
  return new;
end $$;
create trigger vitrines_3_proteger_banner_aki before insert or update on public.vitrines_lojas
  for each row execute function public.aki_proteger_banner();

-- Moderação mantém o crédito consumido e impede republicar a mesma arte pelo Aki.
create function public.aki_bloquear_arte_moderada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.aki_imagens set bloqueada = true
    where usuario_id = new.dono_id and tipo = 'banner' and url = new.banner_moderado_url;
  return null;
end $$;
create trigger vitrines_bloquear_arte_moderada after update of banner_moderado_url on public.vitrines_lojas
  for each row when (new.banner_moderado_url is not null and new.banner_moderado_url is distinct from old.banner_moderado_url)
  execute function public.aki_bloquear_arte_moderada();
revoke all on function public.aki_bloquear_arte_moderada() from public, anon, authenticated;

create or replace function public.vitrine_publica(p_slug text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v       public.vitrines_lojas;
  pf      public.perfis;
  rec     record;
  dono    boolean;
  foto    boolean;
  secoes  jsonb;
  total   integer;
begin
  select * into v from public.vitrines_lojas x where x.slug = lower(btrim(coalesce(p_slug, ''))) and x.tipo = 'loja';
  if v.id is null then return null; end if;
  dono := v.dono_id = public.usuario_id();
  if v.status <> 'ativa' and not coalesce(dono, false) and not public.e_admin() then
    return null;
  end if;
  select * into rec from public.recursos_vitrine(v);
  select * into pf from public.perfis p where p.id = v.dono_id;
  foto := v.banner_tipo = 'foto' and v.banner_url is not null and (v.banner_aki_posicao is not null or coalesce(rec.foto_fachada, false));

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'anuncios', s.ids) order by s.ordem, s.criado_em), '[]'::jsonb)
    into secoes
    from (select s.id, s.nome, s.ordem, s.criado_em,
                 (select coalesce(jsonb_agg(sa.anuncio_id order by sa.ordem, sa.criado_em), '[]'::jsonb)
                    from public.loja_secao_anuncios sa
                    join public.anuncios a on a.id = sa.anuncio_id and a.status = 'ativo' and a.vitrine_id = v.id
                   where sa.secao_id = s.id) as ids
            from public.loja_secoes s
           where s.vitrine_id = v.id and s.ativa
           order by s.ordem, s.criado_em
           limit rec.secoes_max) s;                                   -- limit null = sem limite

  select count(*)::int into total from public.anuncios a where a.vitrine_id = v.id and a.status = 'ativo';

  return jsonb_build_object(
    'id', v.id, 'slug', v.slug, 'nome', v.nome, 'logo_url', v.logo_url,
    'banner_tipo', case when foto then 'foto' else 'modelo' end,
    'banner_url', case when foto then v.banner_url end,
    'banner_aki_posicao', case when foto then v.banner_aki_posicao end,
    'categoria_loja', v.categoria_loja,
    'banner_modelo', v.banner_modelo, 'banner_cor', v.banner_cor,
    'selo', v.selo_loja_verificada, 'cidade', v.cidade, 'bairro', v.bairro,
    'whatsapp', case when v.status = 'ativa'
                     then public.contato_publico_vitrine(v, pf) end,
    'endereco', v.endereco, 'lat', v.lat, 'lng', v.lng, 'horarios', v.horarios, 'instagram', case when v.verificacao_estado = 'aprovada' or dono then v.instagram end,
    'site_url', case when v.status = 'ativa' and v.verificacao_estado = 'aprovada' then v.site_url end,
    'telefone_publico', case when v.status = 'ativa' and v.verificacao_estado = 'aprovada' then v.telefone_publico end,
    'sobre', v.sobre, 'formas_pagamento', to_jsonb(v.formas_pagamento),
    'faz_entrega', v.faz_entrega, 'entrega_obs', v.entrega_obs,
    'status', v.status, 'criado_em', v.criado_em, 'microrregiao_id', v.microrregiao_id,
    'e_dono', coalesce(dono, false), 'secoes', secoes, 'total_anuncios', total);
end $$;
