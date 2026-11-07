-- =====================================================================
-- OLAKI · Migração: Robô Aki (assistente com IA, vários provedores)
-- Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md seção 7, PAINEL-ADMIN.md tela 11
-- e as decisões do Raniel de 07/11/2026 (provedor e modelo escolhidos no
-- painel; um modelo para conversa e outro para foto; custo de cada mensagem
-- gravado; orçamento mensal em R$ e limite diário por pessoa).
-- Regras:
--  * Chaves de API ficam nas variáveis de ambiente (Vercel), nunca aqui.
--  * Uso e custo só são gravados pelo servidor (service_role), por função.
--  * A pessoa lê e apaga as próprias conversas (LGPD). O livro-caixa de uso
--    (robo_uso) não tem texto e ela não apaga: assim apagar o histórico não
--    "zera" o limite do dia nem o orçamento do mês.
--  * Preços, limites, textos e o liga/desliga ficam em tabelas editáveis no
--    painel, com registro em logs_atividade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Configurações do robô (todas editáveis no painel; exceção por região)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('robo.ativo',                    'false', 'robo', true,  'Robô Aki ligado? (crie uma exceção por região para ligar ou desligar só numa região)'),
  ('robo.provedor_conversa',        '"anthropic"', 'robo', false, 'Provedor de IA da conversa: anthropic, openrouter ou openai (a chave fica na Vercel)'),
  ('robo.modelo_conversa',          '"claude-opus-5-5"', 'robo', false, 'Modelo de IA da conversa (precisa estar ativo no catálogo de modelos)'),
  ('robo.provedor_foto',            '"anthropic"', 'robo', false, 'Provedor de IA do cadastro por foto'),
  ('robo.modelo_foto',              '"claude-opus-5-5"', 'robo', false, 'Modelo de IA do cadastro por foto (precisa ler imagem)'),
  ('robo.limite_diario_pessoa',     '20',    'robo', false, 'Mensagens que cada pessoa pode mandar ao Aki por dia'),
  ('robo.orcamento_mensal_centavos','10000', 'robo', false, 'Orçamento do mês para o Aki, em centavos (R$ 100,00 = 10000). Acabou, o Aki descansa até o mês seguinte'),
  ('robo.alerta_percentual',        '80',    'robo', false, 'Avisar no painel quando o gasto do mês passar deste percentual do orçamento'),
  ('robo.cotacao_dolar',            '5.5',   'robo', false, 'Cotação do dólar usada para converter o custo da IA em reais'),
  ('robo.boas_vindas',              '"Oi! Eu sou o Aki, o ajudante do OLAKI. Posso achar coisas à venda aqui na região, ajudar você a anunciar com uma foto e tirar dúvidas."', 'robo', true, 'Mensagem de boas-vindas do Aki'),
  ('robo.sugestoes',                '["Quero uma moto até 10 mil", "Quero vender uma coisa pela foto", "Quanto custa destacar meu anúncio?", "Como funciona o Radar?"]', 'robo', true, 'Sugestões de perguntas (chips) que aparecem quando a conversa começa'),
  ('robo.temas_proibidos',          '["política e eleições", "remédios e diagnósticos de saúde", "conselhos jurídicos", "armas e drogas", "apostas"]', 'robo', false, 'Assuntos sobre os quais o Aki não conversa (ele explica que não pode ajudar)'),
  ('robo.aviso_ia',                 '"Você está conversando com uma IA. Ela pode errar: confira antes de fechar negócio."', 'robo', true, 'Aviso de que a pessoa fala com uma inteligência artificial'),
  ('robo.max_caracteres_mensagem',  '600',   'robo', false, 'Tamanho máximo da mensagem que a pessoa manda ao Aki (letras)'),
  ('robo.max_tokens_resposta',      '1500',  'robo', false, 'Tamanho máximo de cada resposta da IA (tokens)'),
  ('robo.max_caracteres_resposta',  '4000',  'robo', false, 'Tamanho máximo do texto que o Aki mostra numa resposta (letras)'),
  ('robo.max_ferramentas',          '5',     'robo', false, 'Quantas vezes seguidas o Aki pode usar as funções do site (buscar, rascunho...) numa resposta'),
  ('robo.historico_mensagens',      '12',    'robo', false, 'Quantas mensagens anteriores da conversa o Aki relê a cada pergunta'),
  ('robo.anthropic_esforco',        '"low"', 'robo', false, 'Esforço de raciocínio nos modelos da Anthropic (low, medium, high). Vazio = padrão do modelo'),
  ('robo.foto_lado_maximo',         '1024',  'robo', true,  'Tamanho máximo (pixels do lado maior) da foto mandada ao Aki'),
  ('robo.foto_max_kb',              '800',   'robo', false, 'Tamanho máximo da foto mandada ao Aki, depois de reduzida no celular (KB)'),
  ('robo.max_conversa_mensagens',   '80',    'robo', false, 'Quantas mensagens uma conversa pode ter. Passou disso, o Aki começa uma conversa nova')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Catálogo de modelos (preço em US$ por milhão de tokens)
-- ---------------------------------------------------------------------
create table public.robo_modelos (
  id                       uuid primary key default gen_random_uuid(),
  provedor                 text not null check (provedor in ('anthropic', 'openrouter', 'openai')),
  modelo                   text not null check (modelo ~ '^[A-Za-z0-9._:/-]{2,120}$'),
  nome                     text not null check (char_length(btrim(nome)) between 2 and 80),
  le_imagem                boolean not null default false,
  usa_ferramentas          boolean not null default false,
  preco_entrada_usd        numeric(12,6) check (preco_entrada_usd >= 0),
  preco_saida_usd          numeric(12,6) check (preco_saida_usd >= 0),
  preco_cache_leitura_usd  numeric(12,6) check (preco_cache_leitura_usd >= 0),   -- vazio = cobra como entrada
  preco_cache_escrita_usd  numeric(12,6) check (preco_cache_escrita_usd >= 0),   -- vazio = cobra como entrada
  fallback_servidor        boolean not null default false,   -- Anthropic: outro modelo responde se este recusar
  ativo                    boolean not null default false,
  observacao               text check (char_length(observacao) <= 300),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  atualizado_por           text references public.perfis(id) on delete set null,
  unique (provedor, modelo),
  -- modelo ativo precisa ter preço (o custo de cada mensagem é calculado com ele)
  constraint robo_modelos_preco_ativo check (not ativo or (preco_entrada_usd is not null and preco_saida_usd is not null)),
  constraint robo_modelos_fallback check (not fallback_servidor or provedor = 'anthropic')
);
alter table public.robo_modelos enable row level security;
create policy "robo modelos admin" on public.robo_modelos for all using (public.e_admin()) with check (public.e_admin());
create trigger tocar_robo_modelos before update on public.robo_modelos for each row execute function public.tocar_atualizado_em();
create trigger log_robo_modelos after insert or update or delete on public.robo_modelos for each row execute function public.registrar_log();

-- Preços oficiais da Anthropic (US$/milhão de tokens, 07/11/2026). OpenAI e OpenRouter:
-- o Raniel cadastra no painel com o preço da página do provedor (não inventamos preço).
insert into public.robo_modelos (provedor, modelo, nome, le_imagem, usa_ferramentas,
                                 preco_entrada_usd, preco_saida_usd, preco_cache_leitura_usd, preco_cache_escrita_usd,
                                 fallback_servidor, ativo, observacao) values
  ('anthropic', 'claude-opus-5-5',   'Claude Opus 5.5 (mais inteligente)', true, true, 4.00, 20.00, 0.20, 5.00,  true,  true, null),
  ('anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5 (equilibrado)',    true, true, 2.00, 10.00, 0.20, 2.50,  true,  true, null),
  ('anthropic', 'claude-haiku-5-5',  'Claude Haiku 5.5 (mais barato)',     true, true, 0.10,  0.50, 0.01, 0.125, false, true,
   'Preço para conversas de até 100 mil tokens (acima disso a Anthropic cobra US$ 0,50 / 2,50)');

-- ---------------------------------------------------------------------
-- 3. Conversas, mensagens, livro-caixa de uso, avaliações, buscas vazias
-- ---------------------------------------------------------------------
create table public.robo_conversas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       text not null references public.perfis(id) on delete cascade,
  microrregiao_id  uuid references public.microrregioes(id) on delete set null,
  titulo           text check (char_length(titulo) <= 80),
  total_mensagens  integer not null default 0,
  custo_centavos   numeric(14,4) not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index robo_conversas_usuario_idx on public.robo_conversas (usuario_id, atualizado_em desc);
alter table public.robo_conversas enable row level security;
create policy "robo conversas leitura" on public.robo_conversas for select
  using (usuario_id = public.usuario_id() or public.e_admin());
create policy "robo conversas apagar" on public.robo_conversas for delete
  using (usuario_id = public.usuario_id() or public.e_admin());

create table public.robo_mensagens (
  id                    bigint generated always as identity primary key,
  conversa_id           uuid not null references public.robo_conversas(id) on delete cascade,
  usuario_id            text not null,
  papel                 text not null check (papel in ('usuario', 'assistente')),
  -- usuario:    {"texto": "...", "foto": true|false}
  -- assistente: {"texto": "...", "cartoes": [...], "acoes": [...], "ferramentas": [...]}
  conteudo              jsonb not null check (jsonb_typeof(conteudo) = 'object' and octet_length(conteudo::text) <= 60000),
  tipo                  text not null default 'conversa' check (tipo in ('conversa', 'foto')),
  provedor              text,
  modelo                text,
  tokens_entrada        integer not null default 0 check (tokens_entrada >= 0),
  tokens_saida          integer not null default 0 check (tokens_saida >= 0),
  tokens_cache_leitura  integer not null default 0 check (tokens_cache_leitura >= 0),
  tokens_cache_escrita  integer not null default 0 check (tokens_cache_escrita >= 0),
  custo_centavos        numeric(14,4) not null default 0 check (custo_centavos >= 0),
  latencia_ms           integer check (latencia_ms >= 0),
  erro                  text check (char_length(erro) <= 300),
  criado_em             timestamptz not null default now()
);
create index robo_mensagens_conversa_idx on public.robo_mensagens (conversa_id, id);
create index robo_mensagens_usuario_idx  on public.robo_mensagens (usuario_id, criado_em desc);
alter table public.robo_mensagens enable row level security;
create policy "robo mensagens leitura" on public.robo_mensagens for select
  using (usuario_id = public.usuario_id() or public.e_admin());

-- Livro-caixa: uma linha por resposta (e por "Testar" do painel). Sem texto da conversa.
create table public.robo_uso (
  id                    bigint generated always as identity primary key,
  usuario_id            text references public.perfis(id) on delete set null,
  microrregiao_id       uuid references public.microrregioes(id) on delete set null,
  conversa_id           uuid references public.robo_conversas(id) on delete set null,
  mensagem_id           bigint references public.robo_mensagens(id) on delete set null,
  tipo                  text not null check (tipo in ('conversa', 'foto', 'teste')),
  provedor              text not null,
  modelo                text not null,
  tokens_entrada        integer not null default 0 check (tokens_entrada >= 0),
  tokens_saida          integer not null default 0 check (tokens_saida >= 0),
  tokens_cache_leitura  integer not null default 0 check (tokens_cache_leitura >= 0),
  tokens_cache_escrita  integer not null default 0 check (tokens_cache_escrita >= 0),
  custo_centavos        numeric(14,4) not null default 0 check (custo_centavos >= 0),
  cotacao_dolar         numeric(10,4),
  erro                  text check (char_length(erro) <= 300),
  criado_em             timestamptz not null default now()
);
create index robo_uso_usuario_idx on public.robo_uso (usuario_id, criado_em desc);
create index robo_uso_criado_idx  on public.robo_uso (criado_em);
alter table public.robo_uso enable row level security;
create policy "robo uso admin" on public.robo_uso for select using (public.e_admin());

create table public.robo_avaliacoes (
  id             bigint generated always as identity primary key,
  mensagem_id    bigint not null references public.robo_mensagens(id) on delete cascade,
  usuario_id     text not null references public.perfis(id) on delete cascade,
  nota           smallint not null check (nota in (-1, 1)),
  comentario     text check (char_length(comentario) <= 500),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (mensagem_id, usuario_id)
);
create index robo_avaliacoes_nota_idx on public.robo_avaliacoes (nota, atualizado_em desc);
alter table public.robo_avaliacoes enable row level security;
create policy "robo avaliacoes leitura" on public.robo_avaliacoes for select
  using (usuario_id = public.usuario_id() or public.e_admin());

-- O que as pessoas pediram ao Aki e não existe na região (painel: semear o Radar e atrair lojas)
create table public.robo_buscas_vazias (
  id                 bigint generated always as identity primary key,
  microrregiao_id    uuid references public.microrregioes(id) on delete cascade,
  termo              text not null check (char_length(termo) between 2 and 80),
  termo_normalizado  text not null check (char_length(termo_normalizado) between 2 and 80),
  categoria_slug     text check (char_length(categoria_slug) <= 60),
  vezes              integer not null default 1 check (vezes >= 1),
  primeira_em        timestamptz not null default now(),
  ultima_em          timestamptz not null default now()
);
create unique index robo_buscas_vazias_termo on public.robo_buscas_vazias
  (coalesce(microrregiao_id, '00000000-0000-0000-0000-000000000000'), termo_normalizado);
alter table public.robo_buscas_vazias enable row level security;
create policy "robo buscas vazias admin leitura" on public.robo_buscas_vazias for select using (public.e_admin());
create policy "robo buscas vazias admin apagar"  on public.robo_buscas_vazias for delete using (public.e_admin());

-- Permissões de tabela: visitante nada; logado só o que a RLS libera.
revoke all on public.robo_modelos, public.robo_conversas, public.robo_mensagens, public.robo_uso,
              public.robo_avaliacoes, public.robo_buscas_vazias from anon, authenticated;
grant select on public.robo_modelos, public.robo_conversas, public.robo_mensagens, public.robo_uso,
                public.robo_avaliacoes, public.robo_buscas_vazias to authenticated;
grant insert, update, delete on public.robo_modelos to authenticated;   -- a policy deixa só o admin
grant delete on public.robo_conversas to authenticated;                  -- LGPD: apagar meu histórico
grant delete on public.robo_buscas_vazias to authenticated;              -- só admin (policy)
grant all on public.robo_modelos, public.robo_conversas, public.robo_mensagens, public.robo_uso,
             public.robo_avaliacoes, public.robo_buscas_vazias to service_role;

-- ---------------------------------------------------------------------
-- 4. Funções
-- ---------------------------------------------------------------------

-- Início do dia e do mês no horário da região (Piauí/Bahia, sem horário de verão)
create or replace function public.robo_inicio(p_unidade text)
returns timestamptz language sql stable
set search_path = public, extensions
as $$
  select date_trunc(case when p_unidade = 'mes' then 'month' else 'day' end, now() at time zone 'America/Fortaleza')
         at time zone 'America/Fortaleza'
$$;

-- Checagem interna (não exposta): a pessoa uid pode mandar mais uma mensagem?
-- Configuração vazia ou inválida = bloqueado (falha fechada).
create or replace function public.robo_checar(p_uid text, p_tipo text)
returns table (pode boolean, motivo text, usadas_hoje integer, limite_diario integer,
               provedor text, modelo text, microrregiao_id uuid)
language plpgsql stable security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_tipo   text := case when p_tipo = 'foto' then 'foto' else 'conversa' end;
  v_reg    uuid;
  v_prov   text;
  v_mod    text;
  v_lim    numeric;
  v_orc    numeric;
  v_cot    numeric;
  v_gasto  numeric;
  v_usadas integer;
  v_motivo text;
begin
  if p_uid is null then
    return query select false, 'sem_login'::text, 0, 0, null::text, null::text, null::uuid;
    return;
  end if;
  select p.microrregiao_id into v_reg from public.perfis p where p.id = p_uid;
  if v_reg is null then
    return query select false, 'sem_perfil'::text, 0, 0, null::text, null::text, null::uuid;
    return;
  end if;

  select count(*)::int into v_usadas from public.robo_uso u
   where u.usuario_id = p_uid and u.tipo in ('conversa', 'foto') and u.criado_em >= public.robo_inicio('dia');
  v_lim  := public.numero_ou_nulo(public.config('robo.limite_diario_pessoa', v_reg, 'null'));
  v_prov := public.config('robo.provedor_' || v_tipo, v_reg, 'null') #>> '{}';
  v_mod  := public.config('robo.modelo_' || v_tipo, v_reg, 'null') #>> '{}';
  v_cot  := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));

  if public.config('robo.ativo', v_reg, 'false') is distinct from 'true'::jsonb then
    v_motivo := 'desligado';
  elsif not exists (select 1 from public.robo_modelos m
                     where m.provedor = v_prov and m.modelo = v_mod
                       and m.ativo and m.le_imagem and m.usa_ferramentas) then
    v_motivo := 'sem_modelo';
  elsif v_cot is null or v_cot <= 0 then
    v_motivo := 'sem_cotacao';
  elsif v_lim is null or v_usadas >= floor(v_lim) then
    v_motivo := 'limite_diario';
  else
    -- orçamento é do site todo (soma de todas as regiões)
    v_orc := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null'));
    select coalesce(sum(u.custo_centavos), 0) into v_gasto from public.robo_uso u
     where u.criado_em >= public.robo_inicio('mes');
    if v_orc is null or v_gasto >= v_orc then
      v_motivo := 'orcamento';
    end if;
  end if;

  return query select v_motivo is null, v_motivo, v_usadas,
                      greatest(coalesce(floor(v_lim), 0), 0)::int, v_prov, v_mod, v_reg;
end $$;

-- Pode mandar mais uma mensagem? Só olha os dados de quem chamou (nunca de outra pessoa).
create or replace function public.robo_pode_enviar(p_tipo text default 'conversa')
returns table (pode boolean, motivo text, usadas_hoje integer, limite_diario integer,
               provedor text, modelo text, microrregiao_id uuid)
language sql stable security definer
set search_path = public, extensions
as $$ select * from public.robo_checar(public.usuario_id(), p_tipo) $$;

-- Reserva a vez antes de chamar a IA (só o servidor). Confere de novo e já grava uma linha no
-- livro-caixa, com trava por pessoa: várias abas ao mesmo tempo não passam do limite do dia.
-- O custo entra depois, em robo_registrar_resposta(p_uso_id => ...).
create or replace function public.robo_reservar(p_usuario text, p_tipo text default 'conversa')
returns table (pode boolean, motivo text, uso_id bigint, usadas_hoje integer, limite_diario integer,
               provedor text, modelo text)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  c     record;
  v_id  bigint;
  v_tipo text := case when p_tipo = 'foto' then 'foto' else 'conversa' end;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o servidor do OLAKI reserva o uso do robô.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('robo_uso:' || coalesce(p_usuario, '')));
  select * into c from public.robo_checar(p_usuario, v_tipo);
  if not c.pode then
    return query select false, c.motivo, null::bigint, c.usadas_hoje, c.limite_diario, c.provedor, c.modelo;
    return;
  end if;
  insert into public.robo_uso (usuario_id, microrregiao_id, tipo, provedor, modelo, erro)
  values (p_usuario, c.microrregiao_id, v_tipo, left(c.provedor, 40), left(c.modelo, 120), 'em andamento')
  returning id into v_id;
  return query select true, null::text, v_id, c.usadas_hoje + 1, c.limite_diario, c.provedor, c.modelo;
end $$;

-- Textos e limites que a conversa usa, já com a exceção da região de quem chamou.
-- Não devolve orçamento, gasto nem cotação.
create or replace function public.robo_ajustes()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_reg uuid;
  res   jsonb := '{}'::jsonb;
  k     text;
begin
  select p.microrregiao_id into v_reg from public.perfis p where p.id = public.usuario_id();
  foreach k in array array['robo.ativo', 'robo.boas_vindas', 'robo.sugestoes', 'robo.temas_proibidos', 'robo.aviso_ia',
                           'robo.max_caracteres_mensagem', 'robo.max_tokens_resposta', 'robo.max_caracteres_resposta',
                           'robo.max_ferramentas', 'robo.historico_mensagens', 'robo.anthropic_esforco',
                           'robo.foto_lado_maximo', 'robo.foto_max_kb', 'robo.max_conversa_mensagens',
                           'moderacao.palavras_bloqueadas'] loop
    res := res || jsonb_build_object(k, public.config(k, v_reg, 'null'));
  end loop;
  return res || jsonb_build_object('microrregiao_id', v_reg);
end $$;

-- Grava a pergunta, a resposta e o uso, calculando o custo no banco.
-- Só o servidor (service_role) chama: o navegador nunca informa tokens nem custo.
create or replace function public.robo_registrar_resposta(
  p_usuario               text,
  p_conversa              uuid,
  p_tipo                  text,
  p_provedor              text,
  p_modelo                text,
  p_tokens_entrada        integer,
  p_tokens_saida          integer,
  p_tokens_cache_leitura  integer,
  p_tokens_cache_escrita  integer,
  p_pergunta              jsonb default null,
  p_resposta              jsonb default null,
  p_latencia_ms           integer default null,
  p_erro                  text default null,
  p_uso_id                bigint default null)
returns table (conversa_id uuid, mensagem_id bigint, custo_centavos numeric)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  m        public.robo_modelos;
  v_reg    uuid;
  v_conv   uuid := p_conversa;
  v_msg    bigint;
  v_cot    numeric;
  v_custo  numeric := 0;
  v_erro   text := left(nullif(btrim(coalesce(p_erro, '')), ''), 300);
  e        integer := coalesce(p_tokens_entrada, 0);
  s        integer := coalesce(p_tokens_saida, 0);
  cl       integer := coalesce(p_tokens_cache_leitura, 0);
  ce       integer := coalesce(p_tokens_cache_escrita, 0);
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o servidor do OLAKI grava o uso do robô.' using errcode = '42501';
  end if;
  if p_tipo not in ('conversa', 'foto', 'teste') then
    raise exception 'Tipo de uso inválido.' using errcode = '22023';
  end if;
  if least(e, s, cl, ce) < 0 or greatest(e, s, cl, ce) > 10000000 then
    raise exception 'Contagem de tokens inválida.' using errcode = '22023';
  end if;
  select p.microrregiao_id into v_reg from public.perfis p where p.id = p_usuario;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = '22023';
  end if;

  select * into m from public.robo_modelos x where x.provedor = p_provedor and x.modelo = p_modelo;
  v_cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  if m.id is null or m.preco_entrada_usd is null or m.preco_saida_usd is null then
    v_erro := coalesce(v_erro, 'modelo sem preço no catálogo');
  elsif v_cot is null or v_cot <= 0 then
    v_erro := coalesce(v_erro, 'cotação do dólar inválida');
  else
    v_custo := round((e  * m.preco_entrada_usd
                    + s  * m.preco_saida_usd
                    + cl * coalesce(m.preco_cache_leitura_usd, m.preco_entrada_usd)
                    + ce * coalesce(m.preco_cache_escrita_usd, m.preco_entrada_usd))
                     / 1000000.0 * v_cot * 100, 4);
  end if;

  if p_tipo <> 'teste' then
    if v_conv is not null then
      perform 1 from public.robo_conversas c where c.id = v_conv and c.usuario_id = p_usuario for update;
      if not found then
        raise exception 'Conversa não encontrada.' using errcode = '42501';
      end if;
    else
      insert into public.robo_conversas (usuario_id, microrregiao_id, titulo)
      values (p_usuario, v_reg, nullif(left(btrim(regexp_replace(coalesce(p_pergunta->>'texto', ''), '\s+', ' ', 'g')), 80), ''))
      returning id into v_conv;
    end if;
    insert into public.robo_mensagens (conversa_id, usuario_id, papel, conteudo, tipo)
    values (v_conv, p_usuario, 'usuario', coalesce(p_pergunta, '{}'::jsonb), p_tipo);
    insert into public.robo_mensagens (conversa_id, usuario_id, papel, conteudo, tipo, provedor, modelo,
                                       tokens_entrada, tokens_saida, tokens_cache_leitura, tokens_cache_escrita,
                                       custo_centavos, latencia_ms, erro)
    values (v_conv, p_usuario, 'assistente', coalesce(p_resposta, '{}'::jsonb), p_tipo, p_provedor, p_modelo,
            e, s, cl, ce, v_custo, greatest(p_latencia_ms, 0), v_erro)
    returning id into v_msg;
    update public.robo_conversas c
       set total_mensagens = c.total_mensagens + 2, custo_centavos = c.custo_centavos + v_custo, atualizado_em = now()
     where c.id = v_conv;
  end if;

  if p_uso_id is not null then
    -- fecha a reserva feita por robo_reservar (não conta duas vezes no limite do dia)
    update public.robo_uso u
       set conversa_id = case when p_tipo <> 'teste' then v_conv end, mensagem_id = v_msg,
           provedor = left(coalesce(p_provedor, '?'), 40), modelo = left(coalesce(p_modelo, '?'), 120),
           tokens_entrada = e, tokens_saida = s, tokens_cache_leitura = cl, tokens_cache_escrita = ce,
           custo_centavos = v_custo, cotacao_dolar = v_cot, erro = v_erro
     where u.id = p_uso_id and u.usuario_id = p_usuario and u.erro = 'em andamento';
    if not found then
      raise exception 'Reserva de uso não encontrada.' using errcode = '42501';
    end if;
  else
    insert into public.robo_uso (usuario_id, microrregiao_id, conversa_id, mensagem_id, tipo, provedor, modelo,
                                 tokens_entrada, tokens_saida, tokens_cache_leitura, tokens_cache_escrita,
                                 custo_centavos, cotacao_dolar, erro)
    values (p_usuario, v_reg, case when p_tipo <> 'teste' then v_conv end, v_msg, p_tipo,
            left(coalesce(p_provedor, '?'), 40), left(coalesce(p_modelo, '?'), 120),
            e, s, cl, ce, v_custo, v_cot, v_erro);
  end if;

  return query select case when p_tipo <> 'teste' then v_conv end, v_msg, v_custo;
end $$;

-- Conta uma busca do Aki que não achou nada (termo normalizado, sem dados pessoais).
create or replace function public.robo_registrar_busca_vazia(p_termo text, p_microrregiao uuid, p_categoria text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_termo text := left(btrim(regexp_replace(coalesce(p_termo, ''), '\s+', ' ', 'g')), 80);
  v_norm  text := left(lower(public.sem_acento(v_termo)), 80);
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o servidor do OLAKI grava as buscas.' using errcode = '42501';
  end if;
  if char_length(v_norm) < 2 then return; end if;
  insert into public.robo_buscas_vazias (microrregiao_id, termo, termo_normalizado, categoria_slug)
  values (p_microrregiao, v_termo, v_norm, left(nullif(btrim(coalesce(p_categoria, '')), ''), 60))
  on conflict (coalesce(microrregiao_id, '00000000-0000-0000-0000-000000000000'), termo_normalizado)
  do update set vezes = robo_buscas_vazias.vezes + 1, ultima_em = now(), termo = excluded.termo,
                categoria_slug = coalesce(excluded.categoria_slug, robo_buscas_vazias.categoria_slug);
end $$;

-- Joinha / não joinha numa resposta da própria pessoa. Nota 0 tira a avaliação.
create or replace function public.robo_avaliar(p_mensagem_id bigint, p_nota integer, p_comentario text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
begin
  if uid is null then
    raise exception 'Entre na sua conta para avaliar.' using errcode = '28000';
  end if;
  if p_nota is null or p_nota not in (-1, 0, 1) then
    raise exception 'Avaliação inválida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.robo_mensagens m
                  where m.id = p_mensagem_id and m.usuario_id = uid and m.papel = 'assistente') then
    raise exception 'Resposta não encontrada.' using errcode = '42501';
  end if;
  if p_nota = 0 then
    delete from public.robo_avaliacoes a where a.mensagem_id = p_mensagem_id and a.usuario_id = uid;
    return;
  end if;
  insert into public.robo_avaliacoes (mensagem_id, usuario_id, nota, comentario)
  values (p_mensagem_id, uid, p_nota, left(nullif(btrim(coalesce(p_comentario, '')), ''), 500))
  on conflict (mensagem_id, usuario_id) do update
     set nota = excluded.nota, comentario = coalesce(excluded.comentario, robo_avaliacoes.comentario), atualizado_em = now();
end $$;

-- Números da tela 11 do painel (só admin).
create or replace function public.robo_painel(p_dias integer default 14)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  dias   integer := least(greatest(coalesce(p_dias, 14), 1), 90);
  inicio timestamptz := public.robo_inicio('mes');
  hoje   date := (now() at time zone 'America/Fortaleza')::date;
  res    jsonb;
begin
  if not public.e_admin() then
    raise exception 'Só administradores veem os números do robô.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'custo_mes_centavos', (select coalesce(sum(u.custo_centavos), 0) from public.robo_uso u where u.criado_em >= inicio),
    'respostas_mes',      (select count(*) from public.robo_uso u where u.criado_em >= inicio and u.tipo <> 'teste'),
    'orcamento_centavos', public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null')),
    'alerta_percentual',  public.numero_ou_nulo(public.config('robo.alerta_percentual', null, 'null')),
    'por_provedor', coalesce((
      select jsonb_agg(x order by x.custo desc) from (
        select u.provedor, u.modelo, sum(u.custo_centavos) as custo, count(*) as respostas,
               sum(u.tokens_entrada + u.tokens_cache_leitura + u.tokens_cache_escrita) as tokens_entrada,
               sum(u.tokens_saida) as tokens_saida
          from public.robo_uso u where u.criado_em >= inicio
         group by u.provedor, u.modelo) x), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia::date, 'conversas', coalesce(x.conversas, 0), 'mensagens', coalesce(x.mensagens, 0),
                                          'custo', coalesce(x.custo, 0)) order by d.dia)
        from generate_series((hoje - (dias - 1))::timestamp, hoje::timestamp, interval '1 day') as d(dia)
        left join (
          select (u.criado_em at time zone 'America/Fortaleza')::date as dia,
                 count(distinct coalesce(u.conversa_id::text, 'u' || u.id)) as conversas,
                 count(*) as mensagens, sum(u.custo_centavos) as custo
            from public.robo_uso u
           where u.tipo <> 'teste' and u.criado_em >= (hoje - (dias - 1))::timestamp at time zone 'America/Fortaleza'
           group by 1) x on x.dia = d.dia::date), '[]'::jsonb),
    'piores', coalesce((
      select jsonb_agg(x order by x.quando desc) from (
        select a.mensagem_id, a.comentario, a.atualizado_em as quando,
               left(m.conteudo->>'texto', 400) as resposta, m.modelo,
               (select left(q.conteudo->>'texto', 300) from public.robo_mensagens q
                 where q.conversa_id = m.conversa_id and q.id < m.id and q.papel = 'usuario'
                 order by q.id desc limit 1) as pergunta
          from public.robo_avaliacoes a join public.robo_mensagens m on m.id = a.mensagem_id
         where a.nota = -1
         order by a.atualizado_em desc limit 20) x), '[]'::jsonb),
    'avaliacoes', jsonb_build_object(
      'boas', (select count(*) from public.robo_avaliacoes a where a.nota = 1),
      'ruins', (select count(*) from public.robo_avaliacoes a where a.nota = -1)),
    'buscas_vazias', coalesce((
      select jsonb_agg(x order by x.vezes desc, x.ultima_em desc) from (
        select b.id, b.termo, b.categoria_slug, b.vezes, b.ultima_em, r.nome as regiao
          from public.robo_buscas_vazias b left join public.microrregioes r on r.id = b.microrregiao_id
         order by b.vezes desc, b.ultima_em desc limit 30) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------------
-- 5. Endurecimento (mesmo padrão das migrações anteriores)
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

-- Auxiliares internas
revoke all on function public.robo_inicio(text), public.robo_checar(text, text) from public, anon, authenticated;
-- Pessoa logada: só sobre ela mesma
revoke all on function public.robo_pode_enviar(text), public.robo_ajustes(),
                       public.robo_avaliar(bigint, integer, text) from public, anon;
grant execute on function public.robo_pode_enviar(text), public.robo_ajustes(),
                          public.robo_avaliar(bigint, integer, text) to authenticated, service_role;
-- Painel: a função confere e_admin()
revoke all on function public.robo_painel(integer) from public, anon;
grant execute on function public.robo_painel(integer) to authenticated, service_role;
-- Gravação de uso e de buscas: só o servidor
revoke all on function public.robo_registrar_resposta(text, uuid, text, text, text, integer, integer, integer, integer, jsonb, jsonb, integer, text, bigint)
  from public, anon, authenticated;
revoke all on function public.robo_registrar_busca_vazia(text, uuid, text) from public, anon, authenticated;
revoke all on function public.robo_reservar(text, text) from public, anon, authenticated;
grant execute on function public.robo_reservar(text, text) to service_role;
grant execute on function public.robo_registrar_resposta(text, uuid, text, text, text, integer, integer, integer, integer, jsonb, jsonb, integer, text, bigint),
                          public.robo_registrar_busca_vazia(text, uuid, text) to service_role;
