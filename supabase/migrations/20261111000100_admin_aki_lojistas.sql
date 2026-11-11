-- Configurações globais do Aki para lojistas. Credenciais continuam no servidor.
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('robo.lojista_creditos_gratis', '1', 'aki_lojistas', false, 'Créditos de imagem únicos por conta no teste e no gratuito'),
  ('robo.lojista_creditos_slim', '3', 'aki_lojistas', false, 'Créditos de imagem por período pago no Slim'),
  ('robo.lojista_creditos_full', '20', 'aki_lojistas', false, 'Créditos de imagem por período pago no Full'),
  ('robo.lojista_tentativas_dia', '25', 'aki_lojistas', false, 'Limite diário de tentativas por conta, inclusive as que falham'),
  ('robo.lojista_modelo_texto', '"gpt-6-luna"', 'aki_lojistas', false, 'Modelo OpenAI para cadastro e conferência da foto'),
  ('robo.lojista_modelo_imagem', '"gpt-image-2"', 'aki_lojistas', false, 'Modelo OpenAI para gerar banners e tratar fotos')
on conflict do nothing;

update public.configuracoes set grupo = 'aki_lojistas' where chave = 'robo.max_geracoes_imagem_mes';

insert into public.robo_modelos
  (provedor, modelo, nome, le_imagem, usa_ferramentas, preco_entrada_usd, preco_saida_usd, preco_cache_leitura_usd, ativo)
values ('openai', 'gpt-6-sol', 'GPT-6 Sol', true, true, 2, 10, 0.2, true)
on conflict (provedor, modelo) do nothing;

-- O consumo da chave continua contado mesmo quando uma conta é excluída.
select pg_advisory_xact_lock(hashtextextended('aki_imagem:teto', 0));
create table public.aki_tentativas_mes (
  mes timestamptz primary key,
  total bigint not null check (total >= 0)
);
alter table public.aki_tentativas_mes enable row level security;
revoke all on public.aki_tentativas_mes from public, anon, authenticated;
insert into public.aki_tentativas_mes (mes, total)
  select public.robo_inicio('mes'), count(*) from public.aki_imagens
  where criada_em >= public.robo_inicio('mes');

create function public.aki_limite_configurado(p_chave text, p_maximo integer)
returns integer language sql stable set search_path = public, extensions as $$
  select least(p_maximo, greatest(0, floor(coalesce(public.numero_ou_nulo(public.config(p_chave, null, '0')), 0))))::int
$$;
revoke all on function public.aki_limite_configurado(text, integer) from public, anon, authenticated;

create or replace function public.aki_creditos_imagem(p_usuario text)
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
  limite := case when p.codigo = 'slim' and not gratuito then public.aki_limite_configurado('robo.lojista_creditos_slim', 1000)
                 when p.codigo = 'full' and not gratuito then public.aki_limite_configurado('robo.lojista_creditos_full', 1000)
                 when p.codigo is not null and gratuito then public.aki_limite_configurado('robo.lojista_creditos_gratis', 1000)
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

create or replace function public.aki_reservar_imagem(p_usuario text, p_id uuid, p_tipo text, p_anuncio uuid, p_foto text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c record;
  i public.aki_imagens;
  teto integer;
  mes_atual timestamptz := public.robo_inicio('mes');
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

  if (select count(*) from public.aki_imagens where usuario_id = p_usuario and criada_em >= public.robo_inicio('dia'))
      >= public.aki_limite_configurado('robo.lojista_tentativas_dia', 1000) then
    return jsonb_build_object('estado', 'limite_diario');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('aki_imagem:teto', 0));
  teto := public.aki_limite_configurado('robo.max_geracoes_imagem_mes', 100000);
  if coalesce((select total from public.aki_tentativas_mes where mes = mes_atual), 0) >= teto then
    return jsonb_build_object('estado', 'limite_global');
  end if;
  insert into public.aki_imagens (id, usuario_id, tipo, anuncio_id, foto_original, gratuito)
    values (p_id, p_usuario, p_tipo, p_anuncio, p_foto, c.gratuito);
  insert into public.aki_tentativas_mes (mes, total) values (mes_atual, 1)
    on conflict (mes) do update set total = public.aki_tentativas_mes.total + 1;
  return jsonb_build_object('estado', 'nova', 'restantes', c.restantes - 1);
end $$;

-- Reserva a conversa de cadastro com o modelo ativo usando os limites e o livro-caixa do Aki.
create function public.aki_reservar_cadastro(p_usuario text, p_modelo text)
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
  select * into m from public.robo_modelos where provedor = 'openai' and modelo = p_modelo and ativo and le_imagem;
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
    values (p_usuario, regiao, 'conversa', 'openai', p_modelo, estimativa, 'em andamento')
    returning id into reserva;
  return reserva;
end $$;

revoke all on function public.aki_reservar_cadastro(text, text) from public, anon, authenticated;
grant execute on function public.aki_reservar_cadastro(text, text) to service_role;

-- Mantém o contrato do servidor anterior durante a atualização.
create or replace function public.aki_reservar_cadastro(p_usuario text)
returns bigint language sql security definer set search_path = public, extensions as $$
  select public.aki_reservar_cadastro(p_usuario, 'gpt-6-luna')
$$;
