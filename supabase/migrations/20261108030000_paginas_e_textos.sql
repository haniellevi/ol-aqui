-- =====================================================================
-- OLAKI · Etapa 4 · Páginas e textos: termos de uso e política de
-- privacidade com versão (e aceite de cada pessoa), Central de ajuda,
-- blocos e textos da página inicial (painel, tela 12) e o estado
-- "anúncio saiu do ar".
-- Base: TELAS-E-FLUXOS.md (T13, T39-T44), PAINEL-ADMIN.md (tela 12),
-- USABILIDADE.md e ARQUITETURA.md (LGPD, Marco Civil).
-- Nota de desenho: docs/etapa4/paginas.md.
-- Regra de ouro mantida: textos legais, perguntas da ajuda, contato e
-- textos/ordem da home ficam em tabelas editáveis no painel, com
-- registro em logs_atividade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configurações novas (grupo "geral", lidas pelo site sem login)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('contato.email_suporte', 'null', 'geral', true,
     'E-mail da equipe que aparece na Central de ajuda (deixe vazio para não mostrar)'),
  ('ajuda.texto_contato', '"Não achou o que precisava? Fale com a equipe do OLAKI. Respondemos em horário comercial."', 'geral', true,
     'Frase acima dos botões de contato na Central de ajuda'),
  ('termos.aviso_titulo', '"Atualizamos os termos"', 'geral', true,
     'Título da faixa que aparece para quem ainda não aceitou a versão nova dos termos ou da privacidade'),
  ('termos.aviso_texto', '"Mudamos algumas regras do OLAKI. Leia o resumo e toque em Aceitar para continuar usando tudo."', 'geral', true,
     'Texto da faixa "Atualizamos os termos"')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Termos de uso e política de privacidade, uma linha por versão
-- ---------------------------------------------------------------------
create table public.documentos_legais (
  id                uuid primary key default gen_random_uuid(),
  tipo              text not null check (tipo in ('termos', 'privacidade')),
  versao            integer not null check (versao >= 1),
  titulo            text not null check (char_length(btrim(titulo)) between 3 and 120),
  conteudo          text not null check (char_length(btrim(conteudo)) between 50 and 100000),  -- markdown simples
  resumo_mudancas   text check (char_length(resumo_mudancas) <= 500),  -- o que mudou (aparece na faixa)
  revisado_advogado boolean not null default false,                    -- false = RASCUNHO no painel
  ativo             boolean not null default false,
  publicado_em      timestamptz not null default now(),
  publicado_por     text references public.perfis(id) on delete set null,
  unique (tipo, versao)
);
-- Uma versão ativa por tipo
create unique index documentos_legais_um_ativo on public.documentos_legais (tipo) where ativo;

-- Versão publicada não muda nem some (prova do que a pessoa aceitou). Só liga/desliga
-- "ativo" e o selo "revisado por advogado". Vale até para a chave secreta.
create or replace function public.proteger_documento_legal()
returns trigger language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Versão publicada dos termos não pode ser apagada.' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.tipo is distinct from old.tipo or new.versao is distinct from old.versao
     or new.titulo is distinct from old.titulo or new.conteudo is distinct from old.conteudo
     or new.resumo_mudancas is distinct from old.resumo_mudancas or new.publicado_em is distinct from old.publicado_em
     or new.publicado_por is distinct from old.publicado_por then
    raise exception 'Versão publicada não muda. Publique uma versão nova.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_documento_legal before update or delete on public.documentos_legais
  for each row execute function public.proteger_documento_legal();
create trigger log_documentos_legais after insert or update on public.documentos_legais
  for each row execute function public.registrar_log();

alter table public.documentos_legais enable row level security;
-- Todas as versões são públicas (transparência: dá para ver a versão antiga que a pessoa aceitou).
-- Ninguém grava direto: só as funções publicar_documento_legal() e marcar_documento_revisado().
create policy "documentos legais leitura" on public.documentos_legais for select using (true);
revoke all on public.documentos_legais from anon, authenticated;
grant select on public.documentos_legais to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Aceites: quem aceitou qual versão
--    O IP fica em logs_atividade (Marco Civil, só o servidor lê). Aqui só um resumo
--    (hash) do IP, que também não sai pela API.
-- ---------------------------------------------------------------------
create table public.aceites (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    text not null references public.perfis(id) on delete cascade,
  documento_id  uuid not null references public.documentos_legais(id),
  tipo          text not null check (tipo in ('termos', 'privacidade')),
  versao        integer not null check (versao >= 1),
  aceito_em     timestamptz not null default now(),
  ip_hash       text,
  unique (usuario_id, documento_id)
);
create index aceites_usuario_idx on public.aceites (usuario_id, tipo, versao desc);
create trigger log_aceites after insert on public.aceites for each row execute function public.registrar_log();

alter table public.aceites enable row level security;
create policy "aceites leitura" on public.aceites for select
  using (usuario_id = public.usuario_id() or public.e_admin());
revoke all on public.aceites from anon, authenticated;
-- Leitura por coluna: todas menos ip_hash. Coluna nova nesta tabela precisa entrar nesta lista.
grant select (id, usuario_id, documento_id, tipo, versao, aceito_em) on public.aceites to authenticated;

-- O aceite no perfil (aceitou_termos_em, versao_termos) só a função grava: a pessoa não forja
-- editando o próprio perfil (nem ao criar).
create or replace function public.proteger_aceite_perfil()
returns trigger language plpgsql
as $$
begin
  if public.acesso_sistema() then return new; end if;
  if tg_op = 'INSERT' then
    new.aceitou_termos_em := null;
    new.versao_termos := null;
  else
    new.aceitou_termos_em := old.aceitou_termos_em;
    new.versao_termos := old.versao_termos;
  end if;
  return new;
end $$;
create trigger proteger_aceite_perfis before insert or update on public.perfis
  for each row execute function public.proteger_aceite_perfil();

-- ---------------------------------------------------------------------
-- 3. Funções dos termos
-- ---------------------------------------------------------------------

-- Painel: publica a versão seguinte (a anterior sai do ar na mesma hora).
create or replace function public.publicar_documento_legal(
  p_tipo text, p_titulo text, p_conteudo text, p_resumo text default null, p_revisado boolean default false)
returns public.documentos_legais language plpgsql security definer
set search_path = public, extensions
as $$
declare
  atual  public.documentos_legais;
  novo   public.documentos_legais;
  texto  text := btrim(coalesce(p_conteudo, ''));
  nome   text := btrim(coalesce(p_titulo, ''));
  resumo text := nullif(btrim(coalesce(p_resumo, '')), '');
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI publica os termos.' using errcode = '42501';
  end if;
  if coalesce(p_tipo, '') not in ('termos', 'privacidade') then
    raise exception 'Tipo de documento inválido.' using errcode = '22023';
  end if;
  if char_length(nome) not between 3 and 120 then
    raise exception 'O título precisa ter de 3 a 120 letras.' using errcode = '22023';
  end if;
  if char_length(texto) < 50 then
    raise exception 'O texto está curto demais (mínimo 50 letras).' using errcode = '22023';
  end if;
  if char_length(texto) > 100000 then
    raise exception 'O texto está longo demais (máximo 100 mil letras).' using errcode = '22023';
  end if;
  if char_length(coalesce(resumo, '')) > 500 then
    raise exception 'O resumo do que mudou pode ter no máximo 500 letras.' using errcode = '22023';
  end if;

  -- duas publicações ao mesmo tempo não criam o mesmo número de versão
  perform pg_advisory_xact_lock(hashtextextended('olaki:documento_legal:' || p_tipo, 0));
  select * into atual from public.documentos_legais where tipo = p_tipo and ativo;
  if atual.id is not null and atual.conteudo = texto and atual.titulo = nome then
    raise exception 'O texto é igual ao da versão que está no ar. Mude alguma coisa antes de publicar.' using errcode = '22023';
  end if;

  update public.documentos_legais set ativo = false where id = atual.id;
  insert into public.documentos_legais (tipo, versao, titulo, conteudo, resumo_mudancas, revisado_advogado, ativo, publicado_por)
  values (p_tipo,
          coalesce((select max(versao) from public.documentos_legais where tipo = p_tipo), 0) + 1,
          nome, texto, resumo, coalesce(p_revisado, false), true, public.usuario_id())
  returning * into novo;
  return novo;
end $$;

-- Painel: liga/desliga o selo "revisado por advogado" de uma versão (fica no log).
create or replace function public.marcar_documento_revisado(p_documento_id uuid, p_revisado boolean)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI muda isso.' using errcode = '42501';
  end if;
  update public.documentos_legais set revisado_advogado = coalesce(p_revisado, false) where id = p_documento_id;
  if not found then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;
  return coalesce(p_revisado, false);
end $$;

-- Pessoa logada: versões no ar que ela ainda não aceitou.
-- primeira_vez = nunca aceitou nenhuma versão daquele tipo (conta nova).
create or replace function public.termos_pendentes()
returns table (id uuid, tipo text, versao integer, titulo text, resumo_mudancas text, publicado_em timestamptz, primeira_vez boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  select d.id, d.tipo, d.versao, d.titulo, d.resumo_mudancas, d.publicado_em,
         not exists (select 1 from public.aceites x where x.usuario_id = public.usuario_id() and x.tipo = d.tipo)
    from public.documentos_legais d
   where d.ativo
     and public.usuario_id() is not null
     and not exists (select 1 from public.aceites a where a.usuario_id = public.usuario_id() and a.documento_id = d.id)
   order by d.tipo desc   -- termos antes de privacidade
$$;

-- Pessoa logada: aceita as versões que VIU (ids). Se uma delas saiu do ar no meio do caminho,
-- recusa (a pessoa precisa ler a nova). Repetir não duplica. Devolve quantos aceites novos.
create or replace function public.aceitar_documentos_legais(p_documentos uuid[])
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid   text := public.usuario_id();
  d     public.documentos_legais;
  pedidos uuid[];
  novos integer := 0;
  n     integer;
  ip    inet := public.ip_requisicao();
begin
  if uid is null then
    raise exception 'Entre na sua conta para aceitar os termos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis where id = uid) then
    raise exception 'Conta não encontrada. Saia e entre de novo.' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(distinct x), '{}') into pedidos from unnest(coalesce(p_documentos, '{}')) x where x is not null;
  if cardinality(pedidos) = 0 or cardinality(pedidos) > 10 then
    raise exception 'Não há nada para aceitar.' using errcode = '22023';
  end if;
  if (select count(*) from public.documentos_legais where id = any(pedidos)) <> cardinality(pedidos) then
    raise exception 'Documento não encontrado.' using errcode = 'P0002';
  end if;

  for d in select * from public.documentos_legais where id = any(pedidos) loop
    if not d.ativo then
      raise exception 'Os termos mudaram agora. Leia a versão nova e aceite de novo.' using errcode = 'P0001';
    end if;
    insert into public.aceites (usuario_id, documento_id, tipo, versao, ip_hash)
    values (uid, d.id, d.tipo, d.versao,
            case when ip is not null then left(encode(sha256(convert_to('olaki-aceite|' || host(ip), 'UTF8')), 'hex'), 32) end)
    on conflict (usuario_id, documento_id) do nothing;
    get diagnostics n = row_count;
    novos := novos + n;
  end loop;

  -- resumo no perfil (campos protegidos: só por aqui)
  perform set_config('olaki.sistema', '1', true);
  update public.perfis p
     set aceitou_termos_em = now(),
         versao_termos = (select string_agg(x.tipo || ' v' || x.versao, ' · ' order by x.tipo desc)
                            from public.documentos_legais x
                           where x.ativo and exists (select 1 from public.aceites a where a.usuario_id = uid and a.documento_id = x.id))
   where p.id = uid;
  perform set_config('olaki.sistema', '', true);
  return novos;
end $$;

-- ---------------------------------------------------------------------
-- 4. Central de ajuda (categorias e perguntas editáveis no painel)
-- ---------------------------------------------------------------------
create table public.ajuda_categorias (
  slug           text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  id             uuid not null unique default gen_random_uuid(),   -- para o log (registrar_log usa "id")
  nome           text not null check (char_length(btrim(nome)) between 2 and 60),
  descricao      text check (char_length(descricao) <= 160),
  ordem          integer not null default 0,
  ativa          boolean not null default true,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text references public.perfis(id) on delete set null
);

create table public.ajuda_perguntas (
  id             uuid primary key default gen_random_uuid(),
  categoria      text not null references public.ajuda_categorias(slug) on update cascade on delete restrict,
  pergunta       text not null check (char_length(btrim(pergunta)) between 5 and 200),
  resposta       text not null check (char_length(btrim(resposta)) between 5 and 4000),  -- markdown simples
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text references public.perfis(id) on delete set null
);
create index ajuda_perguntas_categoria_idx on public.ajuda_perguntas (categoria, ordem);

create trigger tocar_ajuda_categorias before update on public.ajuda_categorias for each row execute function public.tocar_atualizado_em();
create trigger tocar_ajuda_perguntas  before update on public.ajuda_perguntas  for each row execute function public.tocar_atualizado_em();
create trigger log_ajuda_categorias after insert or update or delete on public.ajuda_categorias for each row execute function public.registrar_log();
create trigger log_ajuda_perguntas  after insert or update or delete on public.ajuda_perguntas  for each row execute function public.registrar_log();

alter table public.ajuda_categorias enable row level security;
alter table public.ajuda_perguntas  enable row level security;
create policy "ajuda categorias leitura" on public.ajuda_categorias for select using (ativa or public.e_admin());
create policy "ajuda categorias admin"   on public.ajuda_categorias for all using (public.e_admin()) with check (public.e_admin());
create policy "ajuda perguntas leitura"  on public.ajuda_perguntas for select using (
  public.e_admin()
  or (ativo and exists (select 1 from public.ajuda_categorias c where c.slug = categoria and c.ativa)));
create policy "ajuda perguntas admin"    on public.ajuda_perguntas for all using (public.e_admin()) with check (public.e_admin());
revoke all on public.ajuda_categorias, public.ajuda_perguntas from anon, authenticated;
grant select on public.ajuda_categorias, public.ajuda_perguntas to anon, authenticated;
grant insert, update, delete on public.ajuda_categorias, public.ajuda_perguntas to authenticated;  -- RLS: só admin

-- ---------------------------------------------------------------------
-- 5. Blocos da página inicial (ordem, ligado e textos)
--    Busca e categorias ficam sempre no topo. Os blocos são fixos (não se cria nem apaga);
--    os pagos e os "mais recentes" não desligam, só mudam de lugar.
-- ---------------------------------------------------------------------
create table public.home_blocos (
  chave          text primary key check (chave in ('destaques', 'lojas_destaque', 'radar', 'lojas_regiao', 'recentes')),
  id             uuid not null unique default gen_random_uuid(),   -- para o log
  nome           text not null,                                    -- nome no painel
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  pode_desligar  boolean not null default true,
  campos         text[] not null default '{}' check (campos <@ array['titulo', 'texto', 'botao']),  -- textos que o painel edita
  titulo         text check (char_length(btrim(titulo)) between 2 and 80),
  texto          text check (char_length(btrim(texto)) between 2 and 200),
  botao          text check (char_length(btrim(botao)) between 2 and 30),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text references public.perfis(id) on delete set null
);

create or replace function public.proteger_home_bloco()
returns trigger language plpgsql
as $$
begin
  new.chave := old.chave;  new.id := old.id;  new.nome := old.nome;
  new.pode_desligar := old.pode_desligar;  new.campos := old.campos;
  if not new.ativo and not old.pode_desligar then
    raise exception 'Este bloco não pode ser desligado (tem anúncios pagos ou é a lista principal). Mude só a posição.' using errcode = '22023';
  end if;
  new.titulo := nullif(btrim(new.titulo), '');
  new.texto  := nullif(btrim(new.texto), '');
  new.botao  := nullif(btrim(new.botao), '');
  return new;
end $$;
create trigger proteger_home_bloco before update on public.home_blocos for each row execute function public.proteger_home_bloco();
create trigger tocar_home_blocos before update on public.home_blocos for each row execute function public.tocar_atualizado_em();
create trigger log_home_blocos after update on public.home_blocos for each row execute function public.registrar_log();

alter table public.home_blocos enable row level security;
create policy "home blocos leitura" on public.home_blocos for select using (true);
create policy "home blocos admin"   on public.home_blocos for update using (public.e_admin()) with check (public.e_admin());
revoke all on public.home_blocos from anon, authenticated;
grant select on public.home_blocos to anon, authenticated;
grant update (ordem, ativo, titulo, texto, botao, atualizado_por) on public.home_blocos to authenticated;  -- RLS: só admin

insert into public.home_blocos (chave, nome, ordem, ativo, pode_desligar, campos, titulo, texto, botao) values
  ('destaques',      'Destaques perto de você (pago)', 10, true, false, '{titulo}', 'Destaques perto de você', null, null),
  ('lojas_destaque', 'Lojas em destaque (pago)',       20, true, false, '{}',       null, null, null),
  ('radar',          'Faixa do Radar',                 30, true, true,  '{titulo,texto,botao}', 'Não achou o que queria?',
                     'Diga o que procura no Radar e as lojas da região te chamam.', 'Pedir no Radar'),
  ('lojas_regiao',   'Lojas da região',                40, true, true,  '{}',       null, null, null),
  ('recentes',       'Mais recentes',                  50, true, false, '{titulo}', 'Mais recentes em {lugar}', null, null);

-- ---------------------------------------------------------------------
-- 6. Anúncio que saiu do ar (T44): só a categoria, para mostrar parecidos
--    em vez de "página não encontrada". Sem título e sem vendedor.
-- ---------------------------------------------------------------------
create or replace function public.anuncio_fora_do_ar(p_anuncio_id uuid)
returns table (categoria_slug text, categoria_nome text)
language sql stable security definer
set search_path = public, extensions
as $$
  select c.slug, c.nome
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    left join public.categorias c on c.id = a.categoria_id and c.ativa
   where a.id = p_anuncio_id
     and (a.status in ('pausado', 'expirado')
          or (a.status in ('ativo', 'vendido') and v.status <> 'ativa'))
$$;

-- ---------------------------------------------------------------------
-- 7. Semente: categorias e perguntas da ajuda (texto inicial; a equipe edita no painel)
-- ---------------------------------------------------------------------
insert into public.ajuda_categorias (slug, nome, descricao, ordem) values
  ('seguranca', 'Dicas de segurança',      'Como não cair em golpe',                        10),
  ('vender',    'Como vender',             'Anunciar, editar e marcar como vendido',        20),
  ('comprar',   'Como comprar',            'Achar, chamar no WhatsApp e negociar',          30),
  ('radar',     'Radar de Negócios',       'Peça o que procura e as lojas te chamam',       40),
  ('destaques', 'Destaques e planos',      'Aparecer mais e vender com a sua loja',         50),
  ('conta',     'Sua conta e privacidade', 'Entrar, mudar dados, baixar e apagar seus dados', 60);

insert into public.ajuda_perguntas (categoria, ordem, pergunta, resposta) values
  ('seguranca', 10, 'Pediram um sinal antes de eu ver o produto. Pago?',
   $t$**Não pague.** O golpe mais comum é pedir um "sinal", "reserva" ou "frete" por Pix antes de você ver o produto. Depois que o dinheiro sai, a pessoa some.

- Veja o produto de perto, ao vivo, antes de pagar qualquer valor.
- Desconfie de pressa: "tem outra pessoa querendo, paga agora".
- Se insistirem, toque em **Denunciar** no anúncio.$t$),
  ('seguranca', 20, 'Recebi um link para pagar ou para "liberar" a venda. É do OLAKI?',
   $t$**Não clique.** O OLAKI não manda link de pagamento para comprador nem para vendedor pelo WhatsApp, e-mail ou SMS.

- Golpistas mandam páginas falsas que imitam bancos, Correios ou o próprio OLAKI.
- Você só paga destaque ou plano **dentro do site**, em Meus anúncios ou Meu plano.
- Nunca digite senha do banco ou dados do cartão em link que chegou por mensagem.$t$),
  ('seguranca', 30, 'Pediram o código que chegou no meu celular. Posso passar?',
   $t$**Nunca passe esse código para ninguém**, nem para quem diz ser do OLAKI, do banco ou do WhatsApp.

Com esse código a pessoa entra na sua conta ou no seu WhatsApp e aplica golpe nos seus contatos. A equipe do OLAKI **nunca pede** código.$t$),
  ('seguranca', 40, 'Como encontrar o vendedor com segurança?',
   $t$- Marque em lugar público e movimentado, de dia (praça, posto, frente de banco).
- Leve alguém junto, principalmente em negócio de valor alto.
- Em carro, moto e trator: confira documento, chassi e débitos antes de pagar.
- Prefira pagar na hora da entrega, com o produto na mão.$t$),
  ('seguranca', 50, 'O preço está baixo demais. Pode ser golpe?',
   $t$Pode. Preço muito abaixo do normal é a isca mais usada. Compare com anúncios parecidos da região e desconfie de quem não deixa ver o produto, não manda mais fotos ou não atende ligação.$t$),
  ('seguranca', 60, 'Como denunciar um anúncio ou uma pessoa?',
   $t$Abra o anúncio, role até o fim e toque em **Denunciar**. Escolha o motivo. A equipe confere. Quando um anúncio recebe várias denúncias, ele sai do ar até a revisão.

Se você perdeu dinheiro, faça também um boletim de ocorrência na delegacia ou pela internet.$t$),

  ('vender', 10, 'Como anunciar?',
   $t$Toque em **+ Anunciar**, entre com seu celular e siga os passos: fotos, categoria, detalhes, preço, local e revisar. No fim, toque em **Publicar**.

Dica: fotos claras, de dia, e um título simples ("Moto Honda Titan 2015") vendem mais rápido.$t$),
  ('vender', 20, 'Quantos anúncios posso ter de graça?',
   $t$Depende do seu tipo de conta e do plano. Os números de hoje ficam na página **Planos e preços** e em **Minha conta > Meu plano**, sempre atualizados.$t$),
  ('vender', 30, 'Meu anúncio está "em análise". O que é isso?',
   $t$Alguns anúncios passam por uma conferência da equipe antes de aparecer (por exemplo, preço muito fora do normal ou palavra proibida). Assim que liberarmos, ele vai ao ar e você é avisado.$t$),
  ('vender', 40, 'Vendi. O que faço com o anúncio?',
   $t$Vá em **Minha conta > Meus anúncios** e toque em **Vendi**. O anúncio sai da busca e quem tinha o link vê que foi vendido. Isso evita mensagens de quem chega depois.$t$),

  ('comprar', 10, 'Preciso de conta para comprar?',
   $t$Não. Você pode ver tudo e chamar o vendedor no WhatsApp sem conta. A conta só é pedida para favoritar, anunciar ou pedir no Radar.$t$),
  ('comprar', 20, 'Como falo com o vendedor?',
   $t$No anúncio, toque em **Chamar no WhatsApp**. A conversa abre com uma mensagem pronta dizendo qual anúncio você viu. A negociação é direto entre vocês: o OLAKI não participa do pagamento nem da entrega.$t$),
  ('comprar', 30, 'O que quer dizer "Patrocinado"?',
   $t$É um anúncio que o vendedor pagou para aparecer mais. A palavra **Patrocinado** sempre aparece nesses casos, para você saber.$t$),

  ('radar', 10, 'Como funciona o Radar?',
   $t$Você diz o que procura (por exemplo, "geladeira até R$ 2 mil") e as lojas da região recebem o pedido. Você escolhe:

- **Podem me chamar no WhatsApp**: as lojas falam direto com você.
- **Quero receber propostas aqui**: as lojas mandam preço até o prazo que você escolheu, e você escolhe com quem falar.$t$),
  ('radar', 20, 'Por que preciso confirmar meu celular para pedir?',
   $t$Para as lojas saberem que o pedido é de uma pessoa de verdade. Isso diminui trote e golpe.$t$),
  ('radar', 30, 'Sou loja. Como respondo aos pedidos?',
   $t$Abra a aba **Radar**, veja os **Pedidos na região** e toque em **Propor**. A quantidade de propostas que você pode mandar depende do seu plano e aparece na própria tela.$t$),

  ('destaques', 10, 'O que é destacar um anúncio?',
   $t$É pagar para o seu anúncio aparecer mais: subir para o topo, ficar no alto da busca ou aparecer na página inicial. Os tipos, preços e dias que valem hoje aparecem logo abaixo e na tela **Destacar**, em Meus anúncios.

O anúncio destacado sempre mostra a palavra **Patrocinado**.$t$),
  ('destaques', 20, 'Como pago?',
   $t$Por Pix (QR code ou copia e cola) dentro do site. O destaque começa sozinho quando o pagamento é confirmado. Depois você vê quantas pessoas viram e quantas chamaram no WhatsApp.$t$),
  ('destaques', 30, 'O que a loja ganha com um plano?',
   $t$Mais anúncios, vitrine própria com o endereço do OLAKI e acesso ao Radar, conforme o plano. Os planos e preços de hoje estão logo abaixo e na página **Planos e preços**.$t$),

  ('conta', 10, 'Como entro no OLAKI?',
   $t$Toque em **Entrar** e digite o número do seu celular. Chega um código: é só digitar. Não tem senha para esquecer.$t$),
  ('conta', 20, 'Como baixo ou apago meus dados?',
   $t$Vá em **Minha conta > Privacidade**. Lá você baixa um arquivo com seus dados ou apaga sua conta. Leia também a nossa **Política de privacidade**.$t$),
  ('conta', 30, 'Quem é o Aki?',
   $t$O Aki é o robô do OLAKI, feito com inteligência artificial. Ele ajuda a achar coisas e a montar anúncios, mas **pode errar** e **nunca publica, paga ou apaga nada sozinho**: você sempre confirma num botão. Você pode apagar a conversa quando quiser.$t$);

-- ---------------------------------------------------------------------
-- 8. Semente: primeira versão dos termos e da privacidade.
--    RASCUNHO (revisado_advogado = false): um advogado precisa revisar antes do lançamento.
-- ---------------------------------------------------------------------
insert into public.documentos_legais (tipo, versao, titulo, conteudo, resumo_mudancas, revisado_advogado, ativo) values
('termos', 1, 'Termos de uso do OLAKI', $md$
Estes termos explicam as regras para usar o OLAKI. Ao criar sua conta e tocar em **Aceitar**, você concorda com elas. Leia com calma. Se tiver dúvida, fale com a equipe pelos contatos da página de Ajuda.

## 1. O que é o OLAKI

O OLAKI é um site de classificados e lojas da sua região. Ele mostra anúncios de pessoas e de lojas e ajuda comprador e vendedor a se encontrarem.

- O OLAKI **não vende** os produtos anunciados e **não participa** da negociação, do pagamento nem da entrega entre comprador e vendedor.
- A conversa acontece direto entre as pessoas, normalmente pelo WhatsApp.
- Quem responde pelo que anuncia é quem publicou o anúncio.

## 2. Quem pode usar

- Qualquer pessoa pode ver os anúncios, sem conta.
- Para anunciar, pedir no Radar, favoritar ou conversar com o Aki, você precisa de uma conta com celular confirmado.
- Para anunciar ou comprar, você precisa ter 18 anos ou mais, ou estar autorizado pelos seus pais ou responsáveis.

## 3. Sua conta

- Use seus dados verdadeiros. Uma conta por pessoa.
- A conta é ligada ao seu número de celular. Não passe o código de acesso para ninguém.
- Você é responsável pelo que for feito na sua conta. Se perceber algo estranho, fale com a equipe.

## 4. Anúncios

Ao anunciar, você garante que:

- o produto ou serviço existe, é seu ou você tem o direito de vender;
- as fotos são do produto de verdade e a descrição e o preço são honestos;
- você vai responder quem te chamar e marcar o anúncio como vendido quando vender.

**É proibido anunciar:** armas e munição, drogas, remédios que precisam de receita, documentos (CNH, RG, diplomas), produtos roubados, piratas ou falsificados, animais silvestres, conteúdo adulto, serviços ilegais, e qualquer coisa que a lei proíba.

A equipe pode conferir anúncios, pedir ajustes, deixar um anúncio "em análise" ou tirá-lo do ar se ele quebrar estas regras ou receber denúncias. Anúncios com várias denúncias saem do ar até a revisão.

## 5. Planos, destaques e pagamentos

- Algumas coisas são pagas: planos para lojas, anúncio avulso e destaques. Os preços, prazos e limites de hoje aparecem no site (página **Planos e preços** e tela **Destacar**) antes de você pagar.
- O pagamento é feito por um parceiro de pagamentos (Asaas), por Pix ou cartão. O OLAKI não guarda os dados do seu cartão.
- Anúncio pago para aparecer mais sempre mostra a palavra **Patrocinado**.
- Você pode desistir de uma compra feita no site em até 7 dias (Código de Defesa do Consumidor, artigo 49). Fale com a equipe pelos contatos da Ajuda. Se o destaque ou o plano já estiver valendo, vamos conversar para resolver de forma justa.
- Mudança de preço vale para compras novas. Quem já pagou mantém o que comprou até o fim do período.

## 6. Radar de Negócios

No Radar, a pessoa diz o que procura e as lojas da região mandam propostas ou chamam no WhatsApp, conforme a escolha de quem pediu. Pedidos e propostas seguem as mesmas regras dos anúncios: nada proibido, nada enganoso.

## 7. O robô Aki

O Aki é um assistente feito com inteligência artificial.

- Ele **pode errar**. Confira as informações antes de decidir.
- Ele **nunca publica, paga ou apaga nada sozinho**: você sempre confirma num botão.
- As conversas ficam guardadas para o Aki funcionar e para melhorarmos o serviço. Você pode apagá-las em Minha conta.
- Existe um limite de mensagens por dia.

## 8. Segurança nas negociações

- Nunca pague nada antes de ver o produto.
- Desconfie de preço muito baixo, de pressa e de links de pagamento recebidos por mensagem.
- A equipe do OLAKI nunca pede o código que chega no seu celular.
- Veja mais dicas na página de Ajuda.

## 9. O que o OLAKI não garante

Fazemos o possível para manter o site seguro e no ar, mas não garantimos que todo anúncio é verdadeiro, que o produto está como descrito ou que a outra pessoa vai cumprir o combinado. Negocie com cuidado. O site pode ficar fora do ar por manutenção ou problemas técnicos.

## 10. Suspensão da conta

Podemos suspender ou encerrar uma conta que quebre estas regras, aplique golpe, use dados falsos ou atrapalhe outras pessoas. Quando a lei pedir, guardamos e entregamos registros às autoridades.

## 11. Mudanças nestes termos

Quando mudarmos estes termos, publicamos uma versão nova com número e data, e avisamos dentro do site. Para continuar usando as partes que exigem conta, você vai precisar aceitar a versão nova.

## 12. Leis e foro

Estes termos seguem as leis do Brasil, como o Código de Defesa do Consumidor, o Marco Civil da Internet e a Lei Geral de Proteção de Dados. Qualquer disputa pode ser resolvida no foro da cidade onde você mora.

## 13. Quem somos e contato

O OLAKI é operado por: **[a preencher pela equipe: razão social, CNPJ e endereço]**.
Contato: veja a página de Ajuda.
$md$, 'Primeira versão.', false, true),

('privacidade', 1, 'Política de privacidade do OLAKI', $md$
Esta política explica quais dados seus o OLAKI usa, para quê, com quem divide e como você controla tudo isso. Ela segue a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) e o Marco Civil da Internet.

## 1. Quem cuida dos seus dados

O responsável pelos dados (controlador) é: **[a preencher pela equipe: razão social, CNPJ e endereço]**.
Encarregado de dados (DPO): **[a preencher: nome e e-mail]**. Você também pode usar os contatos da página de Ajuda.

## 2. Que dados usamos

- **Conta:** número de celular, nome, foto (se você colocar) e cidade.
- **Anúncios e loja:** fotos, textos, preço, cidade e bairro, WhatsApp da loja, CNPJ (só se você informar) e informações da vitrine.
- **Radar:** o que você pediu, propostas enviadas e recebidas.
- **Conversas com o Aki:** o que você escreve e as fotos que manda para ele.
- **Pagamentos:** valor, data e situação. Os dados do cartão ficam com o parceiro de pagamentos, não com o OLAKI.
- **Dados técnicos:** endereço IP, data e hora de acesso e das ações na sua conta.
- **Contagem de visitas:** quantas vezes um anúncio foi visto ou teve clique no WhatsApp, guardada de um jeito que não identifica você.

## 3. Para que usamos (e com que base na lei)

- **Fazer o site funcionar** para você: entrar, anunciar, mostrar seus anúncios, Radar, Aki e pagamentos (execução do contrato).
- **Cumprir a lei:** guardar registros de acesso por 6 meses (Marco Civil da Internet, artigo 15) e atender pedidos da Justiça (obrigação legal).
- **Segurança e combate a golpes:** conferir anúncios, analisar denúncias e limitar tentativas suspeitas (legítimo interesse).
- **Avisos que você escolhe receber:** você liga e desliga em Minha conta > Notificações (consentimento).

Não vendemos seus dados. Não usamos seus dados para propaganda de outras empresas.

## 4. O que fica público

Seus anúncios ficam públicos: fotos, texto, preço, cidade e bairro. Para pessoa física, aparece só o primeiro nome. O número de WhatsApp é usado no botão **Chamar no WhatsApp** do seu anúncio. Endereço exato de pessoa física nunca aparece. Lojas mostram as informações que preencheram na vitrine.

## 5. Com quem dividimos

Só com quem precisamos para o site funcionar, e só o necessário:

- **Login:** Clerk (entrar com celular).
- **Banco de dados e fotos:** Supabase.
- **Hospedagem do site:** Vercel.
- **Pagamentos:** Asaas.
- **Inteligência artificial do Aki:** o provedor escolhido pela equipe (por exemplo, Anthropic, OpenAI ou OpenRouter). Ele recebe a conversa para responder.
- **Autoridades:** quando houver ordem judicial ou pedido previsto em lei.

Alguns desses serviços guardam dados fora do Brasil. Nesses casos, escolhemos empresas com regras de proteção de dados compatíveis com a LGPD.

## 6. Por quanto tempo guardamos

- Dados da conta e anúncios: enquanto sua conta existir.
- Registros de acesso (IP, data e hora): pelo menos 6 meses, como manda a lei.
- Pagamentos: pelo prazo exigido pelas leis fiscais.
- Conversas com o Aki: até você apagar ou excluir a conta.

Quando você exclui a conta, apagamos seus dados, menos o que a lei manda guardar.

## 7. Seus direitos

Você pode, a qualquer momento:

- saber quais dados temos e **baixar uma cópia** (Minha conta > Privacidade > Baixar meus dados);
- corrigir seus dados (Minha conta > Meus dados);
- **apagar sua conta** (Minha conta > Privacidade);
- desligar avisos e retirar consentimentos;
- pedir informações sobre com quem dividimos seus dados;
- reclamar na Autoridade Nacional de Proteção de Dados (ANPD).

Para o que não estiver no site, fale com o encarregado de dados.

## 8. Segurança

Usamos conexão protegida (https), acesso restrito aos dados e registro de quem mexe no painel. Nenhum sistema é 100% seguro: se acontecer um incidente que possa te prejudicar, avisamos você e a ANPD.

## 9. Crianças e adolescentes

O OLAKI não é feito para menores de 18 anos negociarem sozinhos. Não coletamos de propósito dados de crianças.

## 10. Cookies

Usamos só os cookies necessários: manter você conectado e lembrar a cidade escolhida. Não usamos cookies de propaganda.

## 11. Mudanças nesta política

Quando mudarmos esta política, publicamos uma versão nova com número e data e avisamos dentro do site.
$md$, 'Primeira versão.', false, true);

-- ---------------------------------------------------------------------
-- 9. Endurecimento (mesma regra do Security Advisor): search_path fixo em toda
--    função do schema public e gatilhos fora da API. Pode rodar de novo sem problema.
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

-- Painel (a função confere e_admin() por dentro)
revoke all on function public.publicar_documento_legal(text, text, text, text, boolean) from public, anon;
revoke all on function public.marcar_documento_revisado(uuid, boolean) from public, anon;
-- Pessoa logada (a função usa o usuario_id() do token)
revoke all on function public.termos_pendentes() from public, anon;
revoke all on function public.aceitar_documentos_legais(uuid[]) from public, anon;
grant execute on function
  public.publicar_documento_legal(text, text, text, text, boolean), public.marcar_documento_revisado(uuid, boolean),
  public.termos_pendentes(), public.aceitar_documentos_legais(uuid[])
  to authenticated;
-- Público por desenho (devolve só a categoria)
revoke all on function public.anuncio_fora_do_ar(uuid) from public;
grant execute on function public.anuncio_fora_do_ar(uuid) to anon, authenticated;
