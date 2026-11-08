-- =====================================================================
-- OLAKI · Etapa 5 · Painel: mensagens automáticas (tela 13) e relatórios (tela 15)
-- Base: PAINEL-ADMIN.md (telas 13 e 15), PRODUTO-CONTAS-ANUNCIOS-ROBO.md e as
-- tabelas notificacoes/preferencias_avisos (20261108020000). Nota de desenho:
-- docs/etapa5/relatorios.md.
-- Regra de ouro mantida: os textos das mensagens ficam numa tabela editável no
-- painel (com histórico em logs_atividade); prazos vêm de configuracoes.
-- WhatsApp e e-mail ainda não têm provedor: os modelos ficam guardados ("envio
-- em breve"). Só o aviso dentro do site (notificacoes) é mandado hoje.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configuração nova (painel, grupo "Planos")
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('mensagens.vencido_dias_max', '3', 'planos', false,
   'Até quantos dias depois do vencimento ainda se manda o aviso "plano vencido" (evita avisar quem venceu há muito tempo)')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Modelos das mensagens (uma linha por mensagem + canal)
--    As linhas são fixas: cada uma está ligada a um acontecimento do sistema.
--    O painel só muda título, texto e ligado/desligado.
-- ---------------------------------------------------------------------
create table public.modelos_mensagem (
  id             uuid primary key default gen_random_uuid(),
  chave          text not null check (chave ~ '^[a-z0-9_]{3,40}$'),
  canal          text not null check (canal in ('notificacao', 'whatsapp', 'email')),
  nome           text not null check (char_length(nome) between 2 and 80),     -- nome no painel
  quando         text not null check (char_length(quando) between 2 and 300),  -- quando é mandada
  variaveis      text[] not null default '{}',
  titulo         text,
  texto          text not null,
  titulo_padrao  text,
  texto_padrao   text not null,
  ativo          boolean not null default true,
  ordem          integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text references public.perfis(id) on delete set null,
  unique (chave, canal),
  -- aviso no site e e-mail precisam de título (o do e-mail é o assunto); WhatsApp não tem
  check ((canal = 'whatsapp') = (titulo is null)),
  check (canal <> 'notificacao' or (char_length(titulo) between 2 and 120 and char_length(texto) between 2 and 500)),
  check (canal <> 'whatsapp'    or char_length(texto) between 2 and 1000),
  check (canal <> 'email'       or (char_length(titulo) between 2 and 150 and char_length(texto) between 2 and 4000))
);

-- Variáveis {assim} que não estão na lista da mensagem (e chaves { } sem par)
create or replace function public.mensagem_variaveis_invalidas(p_texto text, p_variaveis text[])
returns text[] language plpgsql immutable
set search_path = public, extensions
as $$
declare
  ruins text[] := '{}';
  m     text[];
  resto text;
begin
  if p_texto is null then return ruins; end if;
  for m in select regexp_matches(p_texto, '\{([^{}]*)\}', 'g') loop
    if not (m[1] = any(coalesce(p_variaveis, '{}'))) and not ('{' || m[1] || '}' = any(ruins)) then
      ruins := ruins || ('{' || m[1] || '}');
    end if;
  end loop;
  resto := regexp_replace(p_texto, '\{[^{}]*\}', '', 'g');
  if position('{' in resto) > 0 or position('}' in resto) > 0 then
    ruins := ruins || '{ }'::text;
  end if;
  return ruins;
end $$;

-- Troca {variável} pelos valores, junta espaços e corta no tamanho do aviso
create or replace function public.mensagem_montar(p_texto text, p_vars jsonb, p_max integer default 500)
returns text language plpgsql immutable
set search_path = public, extensions
as $$
declare
  t text := coalesce(p_texto, '');
  k text;
  v text;
begin
  for k, v in select e.key, e.value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) e loop
    t := replace(t, '{' || k || '}', coalesce(v, ''));
  end loop;
  return left(btrim(regexp_replace(t, '\s+', ' ', 'g')), greatest(coalesce(p_max, 500), 1));
end $$;

-- Painel só muda título, texto e ligado. Variável desconhecida é recusada.
create or replace function public.proteger_modelo_mensagem()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  ruins text[];
  lista text;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;  new.chave := old.chave;  new.canal := old.canal;
    new.nome := old.nome;  new.quando := old.quando;  new.variaveis := old.variaveis;
    new.titulo_padrao := old.titulo_padrao;  new.texto_padrao := old.texto_padrao;  new.ordem := old.ordem;
    new.atualizado_por := coalesce(public.usuario_id(), old.atualizado_por);   -- o navegador não escolhe quem foi
  else
    new.atualizado_por := public.usuario_id();
  end if;
  new.titulo := case when new.canal = 'whatsapp' then null else nullif(btrim(coalesce(new.titulo, '')), '') end;
  new.texto  := btrim(coalesce(new.texto, ''));
  lista := coalesce(nullif(array_to_string(array(select '{' || x || '}' from unnest(new.variaveis) x), ', '), ''), 'nenhuma');

  ruins := public.mensagem_variaveis_invalidas(new.titulo, new.variaveis);
  if cardinality(ruins) > 0 then
    raise exception using errcode = '23514', detail = 'campo:titulo',
      message = case when ruins = '{"{ }"}' then 'O título tem uma chave { ou } sem par. Use as variáveis assim: {nome}.'
                     else format('O título usa uma variável que não existe: %s. Pode usar: %s.', array_to_string(ruins, ', '), lista) end;
  end if;
  ruins := public.mensagem_variaveis_invalidas(new.texto, new.variaveis);
  if cardinality(ruins) > 0 then
    raise exception using errcode = '23514', detail = 'campo:texto',
      message = case when ruins = '{"{ }"}' then 'O texto tem uma chave { ou } sem par. Use as variáveis assim: {nome}.'
                     else format('O texto usa uma variável que não existe: %s. Pode usar: %s.', array_to_string(ruins, ', '), lista) end;
  end if;
  if new.canal = 'notificacao' and (char_length(coalesce(new.titulo, '')) not between 2 and 120 or char_length(new.texto) not between 2 and 500) then
    raise exception using errcode = '23514', detail = 'campo:texto',
      message = 'No aviso do site, o título vai de 2 a 120 letras e o texto de 2 a 500.';
  elsif new.canal = 'whatsapp' and char_length(new.texto) not between 2 and 1000 then
    raise exception using errcode = '23514', detail = 'campo:texto', message = 'A mensagem de WhatsApp vai de 2 a 1.000 letras.';
  elsif new.canal = 'email' and (char_length(coalesce(new.titulo, '')) not between 2 and 150 or char_length(new.texto) not between 2 and 4000) then
    raise exception using errcode = '23514', detail = 'campo:texto',
      message = 'No e-mail, o assunto vai de 2 a 150 letras e o texto de 2 a 4.000.';
  end if;
  return new;
end $$;
create trigger modelos_mensagem_proteger before insert or update on public.modelos_mensagem
  for each row execute function public.proteger_modelo_mensagem();
create trigger tocar_modelos_mensagem before update on public.modelos_mensagem
  for each row execute function public.tocar_atualizado_em();
create trigger log_modelos_mensagem after insert or update or delete on public.modelos_mensagem
  for each row execute function public.registrar_log();

alter table public.modelos_mensagem enable row level security;
create policy "modelos mensagem admin leitura" on public.modelos_mensagem for select using (public.e_admin());
create policy "modelos mensagem admin edita"   on public.modelos_mensagem for update using (public.e_admin()) with check (public.e_admin());
revoke all on public.modelos_mensagem from anon, authenticated;
grant select on public.modelos_mensagem to authenticated;
grant update (titulo, texto, ativo) on public.modelos_mensagem to authenticated;   -- RLS: só admin

-- Semente. Textos do Radar: os de hoje (radar.aviso.* em configuracoes) entram logo abaixo.
insert into public.modelos_mensagem (chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo_padrao, texto_padrao)
select chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo, texto from (values
  ('codigo_acesso', 'whatsapp', 10, 'Código de acesso',
   'Quando a pessoa pede o código para entrar. Hoje o código é mandado pelo serviço de login (Clerk); este texto fica guardado para quando o OLAKI mandar pelo WhatsApp.',
   array['codigo'], null::text,
   'Seu código do OLAKI é {codigo}. Não passe este código para ninguém, nem para quem diz ser do OLAKI.'),

  ('plano_vencendo', 'notificacao', 20, 'Plano vencendo',
   'Alguns dias antes do plano ou do teste grátis acabar (quantos dias: Configurações > Planos > assinatura.aviso_vencimento_dias).',
   array['nome', 'plano', 'data', 'dias'], 'Seu plano vence dia {data}',
   'Olá, {nome}! O {plano} vence dia {data}. Escolha ou renove seu plano para seus anúncios continuarem no ar.'),
  ('plano_vencendo', 'whatsapp', 21, 'Plano vencendo',
   'Alguns dias antes do plano ou do teste grátis acabar.',
   array['nome', 'plano', 'data', 'dias'], null,
   'Olá, {nome}! Seu {plano} no OLAKI vence dia {data}. Para seus anúncios continuarem no ar, escolha ou renove seu plano em Minha conta > Meu plano.'),
  ('plano_vencendo', 'email', 22, 'Plano vencendo',
   'Alguns dias antes do plano ou do teste grátis acabar.',
   array['nome', 'plano', 'data', 'dias'], 'Seu plano no OLAKI vence dia {data}',
   'Olá, {nome}! Seu {plano} no OLAKI vence dia {data} (faltam {dias} dias). Para seus anúncios continuarem no ar, entre no OLAKI e toque em Minha conta > Meu plano. Obrigado por anunciar com a gente!'),

  ('plano_vencido', 'notificacao', 30, 'Plano vencido',
   'Logo depois que o plano ou o teste grátis acaba sem renovar.',
   array['nome', 'plano', 'data'], 'Seu plano acabou',
   'Olá, {nome}! O {plano} acabou dia {data}. Escolha um plano para seus anúncios voltarem ao ar.'),
  ('plano_vencido', 'whatsapp', 31, 'Plano vencido',
   'Logo depois que o plano ou o teste grátis acaba sem renovar.',
   array['nome', 'plano', 'data'], null,
   'Olá, {nome}! Seu {plano} no OLAKI acabou dia {data}. Escolha um plano em Minha conta > Meu plano para seus anúncios voltarem ao ar.'),
  ('plano_vencido', 'email', 32, 'Plano vencido',
   'Logo depois que o plano ou o teste grátis acaba sem renovar.',
   array['nome', 'plano', 'data'], 'Seu plano no OLAKI acabou',
   'Olá, {nome}! Seu {plano} no OLAKI acabou dia {data}. Para seus anúncios voltarem ao ar, entre no OLAKI e escolha um plano em Minha conta > Meu plano.'),

  ('destaque_acabou', 'notificacao', 40, 'Destaque acabou',
   'Quando um destaque pago, de crédito ou de cortesia termina.',
   array['nome', 'anuncio', 'tipo', 'visualizacoes', 'cliques'], 'Seu destaque acabou',
   'O {tipo} de “{anuncio}” acabou. Visualizações: {visualizacoes}. Cliques no WhatsApp: {cliques}. Quer destacar de novo?'),
  ('destaque_acabou', 'whatsapp', 41, 'Destaque acabou',
   'Quando um destaque pago, de crédito ou de cortesia termina.',
   array['nome', 'anuncio', 'tipo', 'visualizacoes', 'cliques'], null,
   'Olá, {nome}! O {tipo} de “{anuncio}” no OLAKI acabou. Visualizações: {visualizacoes}. Cliques no WhatsApp: {cliques}. Para destacar de novo, abra Meus anúncios.'),

  ('proposta_nova', 'notificacao', 50, 'Proposta nova no Radar',
   'Quando uma loja manda proposta para o pedido do comprador.',
   array['loja', 'pedido', 'preco'], 'Chegou proposta no Radar',
   '{loja} mandou uma proposta para “{pedido}”. Toque para ver e comparar.'),
  ('proposta_nova', 'whatsapp', 51, 'Proposta nova no Radar',
   'Quando uma loja manda proposta para o pedido do comprador.',
   array['loja', 'pedido', 'preco'], null,
   '{loja} mandou uma proposta no Radar do OLAKI para “{pedido}”. Abra o OLAKI para ver e comparar.'),

  ('prazo_acabou', 'notificacao', 60, 'Pedido do Radar com propostas',
   'Quando acaba o prazo de um pedido com propostas: resumo para o comprador escolher.',
   array['total', 'menor', 'pedido'], 'O prazo do seu pedido acabou',
   'Você recebeu {total} propostas para “{pedido}”. A menor é {menor}. Escolha com quem falar.'),
  ('prazo_acabou', 'whatsapp', 61, 'Pedido do Radar com propostas',
   'Quando acaba o prazo de um pedido com propostas: resumo para o comprador escolher.',
   array['total', 'menor', 'pedido'], null,
   'O prazo do seu pedido “{pedido}” no Radar do OLAKI acabou. Você recebeu {total} propostas, a menor é {menor}. Abra o OLAKI para escolher com quem falar.'),

  ('prazo_sem_propostas', 'notificacao', 65, 'Pedido do Radar sem propostas',
   'Quando acaba o prazo de um pedido e nenhuma loja mandou proposta.',
   array['pedido'], 'O prazo do seu pedido acabou',
   'O prazo de “{pedido}” acabou e nenhuma loja mandou proposta. Você pode pedir de novo.'),

  ('pedido_novo', 'notificacao', 70, 'Pedido novo no Radar (para lojas)',
   'Quando entra um pedido no Radar que combina com o que a loja vende.',
   array['cidade', 'pedido', 'preco'], 'Novo pedido no Radar',
   'Alguém em {cidade} procura “{pedido}”. {preco}'),

  ('proposta_escolhida', 'notificacao', 75, 'Proposta escolhida (para a loja)',
   'Quando o comprador escolhe a proposta da loja.',
   array['pedido', 'loja'], 'Escolheram sua proposta!',
   'O comprador de “{pedido}” escolheu a sua proposta e vai te chamar no WhatsApp.'),

  ('pagamento_confirmado', 'notificacao', 80, 'Pagamento confirmado',
   'Quando o pagamento de plano, anúncio avulso ou destaque é confirmado.',
   array['nome', 'valor', 'item', 'data'], 'Pagamento confirmado',
   'Recebemos {valor} de {item}. Obrigado, {nome}!'),
  ('pagamento_confirmado', 'whatsapp', 81, 'Pagamento confirmado',
   'Quando o pagamento de plano, anúncio avulso ou destaque é confirmado.',
   array['nome', 'valor', 'item', 'data'], null,
   'Olá, {nome}! Recebemos seu pagamento de {valor} ({item}) no OLAKI dia {data}. Obrigado!'),
  ('pagamento_confirmado', 'email', 82, 'Pagamento confirmado',
   'Quando o pagamento de plano, anúncio avulso ou destaque é confirmado.',
   array['nome', 'valor', 'item', 'data'], 'Recebemos seu pagamento no OLAKI',
   'Olá, {nome}! Recebemos seu pagamento de {valor} ({item}) dia {data}. O recibo fica em Minha conta. Obrigado por anunciar com a gente!')
) as s(chave, canal, ordem, nome, quando, variaveis, titulo, texto);

-- O que já foi mudado no painel nos textos do Radar continua valendo (se o texto for válido)
do $$
declare
  r   record;
  cfg text;
begin
  for r in
    select m.id, m.variaveis, x.campo, x.cfg_chave
      from public.modelos_mensagem m
      join (values
        ('proposta_nova',       'titulo', 'radar.aviso.proposta_nova.titulo'),
        ('proposta_nova',       'texto',  'radar.aviso.proposta_nova.texto'),
        ('prazo_acabou',        'titulo', 'radar.aviso.prazo_acabou.titulo'),
        ('prazo_acabou',        'texto',  'radar.aviso.prazo_acabou.texto'),
        ('prazo_sem_propostas', 'titulo', 'radar.aviso.prazo_acabou.titulo'),
        ('prazo_sem_propostas', 'texto',  'radar.aviso.prazo_sem_propostas.texto'),
        ('pedido_novo',         'titulo', 'radar.aviso.pedido_novo.titulo'),
        ('pedido_novo',         'texto',  'radar.aviso.pedido_novo.texto'),
        ('proposta_escolhida',  'titulo', 'radar.aviso.proposta_escolhida.titulo'),
        ('proposta_escolhida',  'texto',  'radar.aviso.proposta_escolhida.texto')
      ) as x(chave, campo, cfg_chave) on x.chave = m.chave
     where m.canal = 'notificacao'
  loop
    select btrim(c.valor #>> '{}') into cfg from public.configuracoes c
     where c.chave = r.cfg_chave and c.microrregiao_id is null and jsonb_typeof(c.valor) = 'string';
    if cfg is null or cardinality(public.mensagem_variaveis_invalidas(cfg, r.variaveis)) > 0
       or char_length(cfg) not between 2 and (case when r.campo = 'titulo' then 120 else 500 end) then
      continue;
    end if;
    if r.campo = 'titulo' then
      update public.modelos_mensagem set titulo = cfg where id = r.id;
    else
      update public.modelos_mensagem set texto = cfg where id = r.id;
    end if;
  end loop;
end $$;

-- As chaves antigas continuam. O texto geral agora se edita na tela 13; aqui só a exceção
-- por região (Configurações > Criar exceção) continua valendo, como antes.
update public.configuracoes
   set descricao = 'Texto geral: edite em Painel > Mensagens automáticas. Aqui só vale a exceção por região. ' || coalesce(descricao, '')
 where chave like 'radar.aviso.%' and coalesce(descricao, '') not like 'Texto geral: edite em Painel%';

-- ---------------------------------------------------------------------
-- 2. Mandar um aviso usando o modelo (uso interno)
-- ---------------------------------------------------------------------
-- Modelo desligado ou inexistente: não grava. notificar() já respeita o que a pessoa
-- desligou em Minha conta > Notificações e não repete a mesma chave.
create or replace function public.mensagem_aviso(
  p_usuario text, p_chave text, p_vars jsonb, p_link text default null, p_chave_unica text default null, p_tipo text default null)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  m public.modelos_mensagem;
begin
  if p_usuario is null then return false; end if;
  select * into m from public.modelos_mensagem x where x.chave = p_chave and x.canal = 'notificacao';
  if m.id is null or not m.ativo then return false; end if;
  return public.notificar(
    p_usuario, coalesce(p_tipo, p_chave),
    public.mensagem_montar(m.titulo, p_vars, 120),
    public.mensagem_montar(m.texto, p_vars, 500),
    p_link, p_chave_unica, coalesce(p_vars, '{}'::jsonb));
end $$;

-- Radar: mesma regra de antes (radar.avisos_ligados), texto geral agora da tela 13.
-- Exceção por região em configuracoes (radar.aviso.*, com microrregiao_id) continua
-- valendo por cima do texto geral, como antes. Sem modelo (não deve acontecer), usa o texto antigo.
create or replace function public.radar_aviso(
  p_usuario text, p_tipo text, p_regiao uuid, p_vars jsonb, p_link text, p_chave text, p_chave_texto text default null)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  ligados jsonb := public.config('radar.avisos_ligados', p_regiao, null);
  modelo  text := case when p_chave_texto = 'radar.aviso.prazo_sem_propostas.texto' then 'prazo_sem_propostas' else p_tipo end;
  m       public.modelos_mensagem;
  reg_titulo text;
  reg_texto  text;
begin
  if p_usuario is null then return false; end if;
  if jsonb_typeof(ligados) = 'array' and not (ligados ? p_tipo) then return false; end if;
  select * into m from public.modelos_mensagem x where x.chave = modelo and x.canal = 'notificacao';
  if m.id is not null then
    if not m.ativo then return false; end if;
    if p_regiao is not null then
      select nullif(btrim(c.valor #>> '{}'), '') into reg_titulo from public.configuracoes c
       where c.chave = 'radar.aviso.' || p_tipo || '.titulo' and c.microrregiao_id = p_regiao
         and jsonb_typeof(c.valor) = 'string';
      select nullif(btrim(c.valor #>> '{}'), '') into reg_texto from public.configuracoes c
       where c.chave = coalesce(p_chave_texto, 'radar.aviso.' || p_tipo || '.texto') and c.microrregiao_id = p_regiao
         and jsonb_typeof(c.valor) = 'string';
    end if;
    return public.notificar(
      p_usuario, p_tipo,
      public.mensagem_montar(coalesce(reg_titulo, m.titulo), p_vars, 120),
      public.mensagem_montar(coalesce(reg_texto, m.texto), p_vars, 500),
      p_link, p_chave, coalesce(p_vars, '{}'::jsonb));
  end if;
  return public.notificar(
    p_usuario, p_tipo,
    public.radar_texto('radar.aviso.' || p_tipo || '.titulo', p_regiao, p_vars, 'Aviso do Radar'),
    public.radar_texto(coalesce(p_chave_texto, 'radar.aviso.' || p_tipo || '.texto'), p_regiao, p_vars, p_vars->>'pedido'),
    p_link, p_chave, coalesce(p_vars, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 3. Avisos novos: destaque acabou, pagamento confirmado, plano vencendo/vencido
-- ---------------------------------------------------------------------
create or replace function public.mensagem_primeiro_nome(p_usuario text)
returns text language sql stable security definer
set search_path = public, extensions
as $$ select coalesce(nullif(split_part(btrim(pf.nome), ' ', 1), ''), 'cliente') from public.perfis pf where pf.id = p_usuario $$;

-- Destaque: ativo → encerrado. Visualizações e cliques do período (mesma conta de resultados_destaques).
create or replace function public.mensagens_destaque_acabou()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  dono  text;
  loja  text;
  nome_tipo text;
  titulo text;
  vis   bigint;
  cli   bigint;
begin
  select v.dono_id, v.nome into dono, loja from public.vitrines_lojas v where v.id = new.vitrine_id;
  select t.nome into nome_tipo from public.destaque_tipos t where t.slug = new.tipo;
  select a.titulo into titulo from public.anuncios a where a.id = new.anuncio_id;
  select count(*) filter (where e.tipo = 'visualizacao'), count(*) filter (where e.tipo = 'clique_whatsapp')
    into vis, cli
    from public.eventos_anuncio e
   where new.inicio is not null
     and e.criado_em >= new.inicio and e.criado_em < least(coalesce(new.fim, now()), now())
     and (e.anuncio_id = new.anuncio_id
          or (new.anuncio_id is null and e.anuncio_id in (select x.id from public.anuncios x where x.vitrine_id = new.vitrine_id)));
  perform public.mensagem_aviso(
    dono, 'destaque_acabou',
    jsonb_build_object('nome', public.mensagem_primeiro_nome(dono), 'anuncio', coalesce(titulo, loja, 'seu anúncio'),
                       'tipo', coalesce(nome_tipo, 'destaque'), 'visualizacoes', coalesce(vis, 0)::text, 'cliques', coalesce(cli, 0)::text),
    case when new.anuncio_id is null then '/destacar/loja' else '/destacar/' || new.anuncio_id::text end,
    'destaque_acabou:' || new.id::text);
  return null;
exception when others then
  return null;   -- aviso nunca derruba a ação principal
end $$;
create trigger mensagens_destaque_acabou after update of status on public.destaques
  for each row when (old.status = 'ativo' and new.status = 'encerrado')
  execute function public.mensagens_destaque_acabou();

-- Pagamento confirmado (status vira 'pago')
create or replace function public.mensagens_pagamento_confirmado()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  dono text;
  item text;
begin
  select v.dono_id into dono from public.vitrines_lojas v where v.id = new.vitrine_id;
  item := case new.tipo
    when 'assinatura' then coalesce((select pl.nome from public.planos pl where pl.codigo = new.plano_codigo), 'plano')
    when 'anuncio_avulso' then 'anúncio avulso' || coalesce(' “' || (select a.titulo from public.anuncios a where a.id = new.anuncio_id) || '”', '')
    else coalesce((select t.nome from public.destaques d join public.destaque_tipos t on t.slug = d.tipo where d.pagamento_id = new.id), 'destaque')
  end;
  perform public.mensagem_aviso(
    dono, 'pagamento_confirmado',
    jsonb_build_object('nome', public.mensagem_primeiro_nome(dono), 'valor', public.radar_reais(new.valor_centavos), 'item', item,
                       'data', to_char(coalesce(new.pago_em, now()) at time zone 'America/Fortaleza', 'DD/MM/YYYY')),
    case when new.tipo = 'assinatura' then '/minha-conta/plano' else '/minha-conta/anuncios' end,
    'pagamento_confirmado:' || new.id::text);
  return null;
exception when others then
  return null;
end $$;
create trigger mensagens_pagamento_confirmado after insert or update of status on public.pagamentos
  for each row when (new.status = 'pago')
  execute function public.mensagens_pagamento_confirmado();

-- Rotina (pg_cron de hora em hora): plano/teste vencendo e vencido. Uma vez por vencimento.
create or replace function public.mensagens_avisar_planos()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r      record;
  feitos integer := 0;
  dias   integer;
begin
  for r in
    select v.id, v.dono_id, v.microrregiao_id, p.nome as plano_nome,
           case when p.e_teste then v.teste_expira_em else v.plano_expira_em end as expira
      from public.vitrines_lojas v
      join public.planos p on p.codigo = v.plano
     where v.status <> 'suspensa' and v.plano_proximo is null
       and (p.e_teste or p.preco_centavos > 0)
       and case when p.e_teste then v.teste_expira_em else v.plano_expira_em end
           between now() - interval '60 days' and now() + interval '60 days'   -- teto: ninguém configura mais que isso
  loop
    if r.expira > now() then
      dias := greatest(coalesce(public.numero_ou_nulo(public.config('assinatura.aviso_vencimento_dias', r.microrregiao_id, '7'))::int, 7), 0);
      if r.expira <= now() + make_interval(days => dias) then
        if public.mensagem_aviso(
             r.dono_id, 'plano_vencendo',
             jsonb_build_object('nome', public.mensagem_primeiro_nome(r.dono_id), 'plano', r.plano_nome,
                                'data', to_char(r.expira at time zone 'America/Fortaleza', 'DD/MM/YYYY'),
                                'dias', greatest(ceil(extract(epoch from (r.expira - now())) / 86400), 1)::int::text),
             '/minha-conta/plano',
             'plano_vencendo:' || r.id::text || ':' || to_char(r.expira at time zone 'America/Fortaleza', 'YYYY-MM-DD')) then
          feitos := feitos + 1;
        end if;
      end if;
    else
      dias := greatest(coalesce(public.numero_ou_nulo(public.config('mensagens.vencido_dias_max', r.microrregiao_id, '3'))::int, 3), 0);
      if r.expira >= now() - make_interval(days => dias) then
        if public.mensagem_aviso(
             r.dono_id, 'plano_vencido',
             jsonb_build_object('nome', public.mensagem_primeiro_nome(r.dono_id), 'plano', r.plano_nome,
                                'data', to_char(r.expira at time zone 'America/Fortaleza', 'DD/MM/YYYY')),
             '/minha-conta/plano',
             'plano_vencido:' || r.id::text || ':' || to_char(r.expira at time zone 'America/Fortaleza', 'YYYY-MM-DD')) then
          feitos := feitos + 1;
        end if;
      end if;
    end if;
  end loop;
  return feitos;
end $$;

-- Onde o pg_cron está ligado (Supabase), a migração já agenda; sem ele, agendar na mão.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.schedule('olaki-mensagens-planos', '20 * * * *', 'select public.mensagens_avisar_planos()')$c$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Relatórios (tela 15): só números somados, só admin, no máximo 12 meses
-- ---------------------------------------------------------------------
create index if not exists anuncios_vendido_em_idx on public.anuncios (vendido_em) where vendido_em is not null;
create index if not exists anuncios_publicado_em_idx on public.anuncios (publicado_em) where publicado_em is not null;
create index if not exists vitrines_criado_idx on public.vitrines_lojas (criado_em);
create index if not exists pagamentos_pago_em_idx on public.pagamentos (pago_em) where status = 'pago';

-- Confere quem pede e devolve o período em horário de Fortaleza: [de, ate)
create or replace function public.relatorio_periodo(p_de date, p_ate date, out de timestamptz, out ate timestamptz)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  d1 date := coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date);
  d0 date := coalesce(p_de, coalesce(p_ate, (now() at time zone 'America/Fortaleza')::date) - 29);
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI vê os relatórios.' using errcode = '42501';
  end if;
  if d0 > d1 then
    raise exception 'A data "de" precisa ser antes da data "até".' using errcode = '22023';
  end if;
  if d1 - d0 > 366 then
    raise exception 'Escolha no máximo 12 meses de cada vez.' using errcode = '22023';
  end if;
  de  := d0::timestamp at time zone 'America/Fortaleza';
  ate := (d1 + 1)::timestamp at time zone 'America/Fortaleza';
end $$;

-- Funil: visualizações → cliques no WhatsApp → vendidos ("vendi pelo OLAKI")
create or replace function public.relatorio_funil(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (visualizacoes bigint, cliques_whatsapp bigint, compartilhamentos bigint,
               vendidos bigint, vendidos_pelo_olaki bigint, vendidos_fora bigint, vendidos_sem_resposta bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select ev.vis, ev.cli, ev.com, vd.total, vd.sim, vd.nao, vd.sem
    from (select count(*) filter (where e.tipo = 'visualizacao')    as vis,
                 count(*) filter (where e.tipo = 'clique_whatsapp') as cli,
                 count(*) filter (where e.tipo = 'compartilhar')    as com
            from public.eventos_anuncio e
            join public.anuncios a on a.id = e.anuncio_id
           where e.criado_em >= per.de and e.criado_em < per.ate
             and (p_regiao is null or a.microrregiao_id = p_regiao)) ev,
         (select count(*) as total,
                 count(*) filter (where a.vendido_pelo_olaki)     as sim,
                 count(*) filter (where not a.vendido_pelo_olaki) as nao,
                 count(*) filter (where a.vendido_pelo_olaki is null) as sem
            from public.anuncios a
           where a.vendido_em >= per.de and a.vendido_em < per.ate
             and (p_regiao is null or a.microrregiao_id = p_regiao)) vd;
end $$;

-- Anúncios por categoria-mãe e cidade: no ar agora e publicados no período
create or replace function public.relatorio_anuncios(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (categoria_id uuid, categoria text, cidade text, no_ar bigint, publicados bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select coalesce(m.id, c.id), coalesce(m.nome, c.nome, 'Sem categoria'), a.cidade,
         count(*) filter (where a.status = 'ativo'),
         count(*) filter (where a.publicado_em >= per.de and a.publicado_em < per.ate)
    from public.anuncios a
    left join public.categorias c on c.id = a.categoria_id
    left join public.categorias m on m.id = c.pai_id
   where (p_regiao is null or a.microrregiao_id = p_regiao)
     and (a.status = 'ativo' or (a.publicado_em >= per.de and a.publicado_em < per.ate))
   group by 1, 2, 3
   order by 4 desc, 5 desc, 2, 3
   limit 1000;
end $$;

-- Teste grátis → plano pago, por mês em que a loja começou
create or replace function public.relatorio_conversao_teste(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (mes date, comecaram bigint, pagaram bigint, em_teste bigint, nao_pagaram bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select x.mes, count(*), count(*) filter (where x.pagou),
         count(*) filter (where not x.pagou and x.testando),
         count(*) filter (where not x.pagou and not x.testando)
    from (select date_trunc('month', v.criado_em at time zone 'America/Fortaleza')::date as mes,
                 exists (select 1 from public.pagamentos p
                          where p.vitrine_id = v.id and p.tipo = 'assinatura' and p.status = 'pago') as pagou,
                 (pl.e_teste and v.teste_expira_em > now()) as testando
            from public.vitrines_lojas v
            left join public.planos pl on pl.codigo = v.plano
           where v.tipo = 'loja' and v.criado_em >= per.de and v.criado_em < per.ate
             and (p_regiao is null or v.microrregiao_id = p_regiao)) x
   group by x.mes
   order by x.mes;
end $$;

-- Receita paga por mês e tipo (assinatura = plano, anuncio_avulso, destaque)
create or replace function public.relatorio_receita(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (mes date, tipo text, quantidade bigint, total_centavos bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select date_trunc('month', p.pago_em at time zone 'America/Fortaleza')::date, p.tipo, count(*), coalesce(sum(p.valor_centavos), 0)::bigint
    from public.pagamentos p
   where p.status = 'pago' and p.pago_em >= per.de and p.pago_em < per.ate
     and (p_regiao is null or p.microrregiao_id = p_regiao)
   group by 1, 2
   order by 1, 2;
end $$;

-- Custo do Aki por mês (inclui os "Testar" do painel, que também custam)
create or replace function public.relatorio_custo_aki(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (mes date, respostas bigint, conversas bigint, erros bigint, custo_centavos numeric)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select date_trunc('month', u.criado_em at time zone 'America/Fortaleza')::date, count(*),
         count(distinct u.conversa_ref), count(*) filter (where u.erro is not null),
         round(coalesce(sum(u.custo_centavos), 0), 4)
    from public.robo_uso u
   where u.criado_em >= per.de and u.criado_em < per.ate
     and (p_regiao is null or u.microrregiao_id = p_regiao)
   group by 1
   order by 1;
end $$;

-- ---------------------------------------------------------------------
-- 5. Endurecimento (mesmo estilo das migrações anteriores)
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f);
  end loop;
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Internas: ninguém chama pela API
revoke all on function public.mensagem_variaveis_invalidas(text, text[]) from public, anon, authenticated;
revoke all on function public.mensagem_montar(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.mensagem_aviso(text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.radar_aviso(text, text, uuid, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.mensagem_primeiro_nome(text) from public, anon, authenticated;
revoke all on function public.relatorio_periodo(date, date) from public, anon, authenticated;
-- Só o servidor (rotina)
revoke all on function public.mensagens_avisar_planos() from public, anon, authenticated;
grant execute on function public.mensagens_avisar_planos() to service_role;
-- Painel (a função confere e_admin() por dentro e devolve só números somados)
revoke all on function public.relatorio_funil(date, date, uuid) from public, anon;
revoke all on function public.relatorio_anuncios(date, date, uuid) from public, anon;
revoke all on function public.relatorio_conversao_teste(date, date, uuid) from public, anon;
revoke all on function public.relatorio_receita(date, date, uuid) from public, anon;
revoke all on function public.relatorio_custo_aki(date, date, uuid) from public, anon;
grant execute on function public.relatorio_funil(date, date, uuid), public.relatorio_anuncios(date, date, uuid),
  public.relatorio_conversao_teste(date, date, uuid), public.relatorio_receita(date, date, uuid),
  public.relatorio_custo_aki(date, date, uuid) to authenticated;
