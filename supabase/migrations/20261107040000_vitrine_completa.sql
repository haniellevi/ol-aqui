-- =====================================================================
-- OLAKI · Migração: vitrine completa da loja + limites da vitrine por plano
-- Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md, seção 5 "Vitrine da loja"
-- (decidido pelo Raniel em 07/11/2026) e PAINEL-ADMIN.md, tela 2.
-- Nota para o desenvolvedor: docs/etapa3/vitrine.md
--
-- O documento chama a tabela de "lojas"; aqui ela é public.vitrines_lojas
-- (tipo 'loja'). Pessoa física (tipo 'pf') não tem vitrine: os recursos
-- abaixo ficam desligados para ela.
--
-- Regra de ouro mantida: o que cada plano libera (foto da fachada, seções,
-- produtos fixados), as cores do banner, as formas de pagamento e as
-- perguntas da página de planos ficam em tabelas editáveis no painel.
-- Plano menor (downgrade): nada é apagado; a leitura pública esconde o que
-- passa do plano e mostra de novo quando a loja volta para um plano maior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configurações novas (todas editáveis no painel, com histórico)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('vitrine.banner_cores',
   '["#4B1248", "#C2410C", "#0E7A3D", "#1E3A5F", "#7A1F3D", "#3F3A40"]',
   'geral', true, 'Cores que a loja pode escolher para o banner modelo da vitrine (código #RRGGBB, uma por linha)'),
  ('vitrine.formas_pagamento',
   '["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Crediário", "Transferência"]',
   'geral', true, 'Formas de pagamento que a loja pode marcar na vitrine (uma por linha)'),
  ('vitrine.anuncios_por_secao_max', '48',  'geral', true,  'Máximo de produtos em cada seção própria da vitrine'),
  ('vitrine.anuncios_por_pagina',    '120', 'geral', false, 'Máximo de produtos mostrados na página da loja'),
  ('planos.perguntas_frequentes',
   '["Posso começar sem pagar? | Sim. Loja nova ganha um período de teste grátis. Pessoa física anuncia algumas coisas sem pagar.", "Como eu pago? | Por Pix ou cartão, aqui no OLAKI. O plano começa assim que o pagamento é confirmado.", "E se eu passar do limite de anúncios? | Você escolhe: pausa um anúncio, troca de plano ou paga um anúncio avulso.", "O que é o Radar de Negócios? | É onde os compradores dizem o que procuram. Nos planos com Radar, sua loja vê os pedidos e manda proposta.", "E se eu mudar para um plano menor? | Nada é apagado. O que não cabe no plano fica escondido e volta quando você subir de plano."]',
   'planos', true, 'Perguntas da página de planos. Uma por linha, assim: Pergunta | Resposta')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. O que cada plano libera na vitrine (tela 2 do painel)
-- ---------------------------------------------------------------------
alter table public.planos
  add column vitrine_foto_fachada boolean not null default false,
  add column vitrine_secoes_max   integer default 0 check (vitrine_secoes_max >= 0),    -- null = sem limite
  add column vitrine_fixados_max  integer default 0 check (vitrine_fixados_max >= 0),   -- null = sem limite
  add column recomendado          boolean not null default false;                       -- destaque na página /planos
-- Só um plano recomendado por vez: marcar um desmarca o outro (o painel não precisa
-- fazer em dois passos; a troca do outro plano também fica no log pelo gatilho log_planos).
create unique index planos_um_recomendado on public.planos (recomendado) where recomendado;
create or replace function public.planos_um_recomendado()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if new.recomendado and (tg_op = 'INSERT' or not old.recomendado) then
    update public.planos set recomendado = false where recomendado and codigo <> new.codigo;
  end if;
  return new;
end $$;
create trigger planos_0_recomendado before insert or update of recomendado on public.planos
  for each row execute function public.planos_um_recomendado();

-- Valores iniciais (o admin muda no painel). Teste e grátis: vitrine básica.
-- O log do painel fica desligado só aqui: semente da migração não é mudança de ninguém.
alter table public.planos disable trigger log_planos;
update public.planos set vitrine_foto_fachada = false, vitrine_secoes_max = 0,  vitrine_fixados_max = 0 where codigo in ('teste', 'pf_gratis');
update public.planos set vitrine_foto_fachada = true,  vitrine_secoes_max = 3,  vitrine_fixados_max = 3, recomendado = true where codigo = 'slim';
update public.planos set vitrine_foto_fachada = true,  vitrine_secoes_max = 10, vitrine_fixados_max = 6 where codigo = 'full';
alter table public.planos enable trigger log_planos;

-- ---------------------------------------------------------------------
-- 2. Utilitários
-- ---------------------------------------------------------------------

-- Horários de funcionamento: {"seg": [{"abre": "08:00", "fecha": "12:00"}, {"abre": "14:00", "fecha": "18:00"}], "dom": []}
-- Dias: dom seg ter qua qui sex sab. Até 3 faixas por dia, em ordem e sem cruzar.
-- Dia vazio ou ausente = fechado. "fecha" pode ser "24:00".
create or replace function public.horarios_validos(h jsonb)
returns boolean language plpgsql immutable
set search_path = public, extensions
as $$
declare
  dia    text;
  faixas jsonb;
  f      jsonb;
  a      text;
  b      text;
  ultimo text;
begin
  if h is null then return true; end if;
  if jsonb_typeof(h) <> 'object' then return false; end if;
  for dia, faixas in select key, value from jsonb_each(h) loop
    if dia not in ('dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab') then return false; end if;
    if jsonb_typeof(faixas) <> 'array' or jsonb_array_length(faixas) > 3 then return false; end if;
    ultimo := null;
    for f in select value from jsonb_array_elements(faixas) loop
      if jsonb_typeof(f) <> 'object' or (select count(*) from jsonb_object_keys(f)) <> 2 then return false; end if;
      if jsonb_typeof(f->'abre') is distinct from 'string' or jsonb_typeof(f->'fecha') is distinct from 'string' then return false; end if;
      a := f->>'abre';
      b := f->>'fecha';
      if a !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
      if b !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and b <> '24:00' then return false; end if;
      if a >= b then return false; end if;                       -- HH:MM compara certo como texto
      if ultimo is not null and a < ultimo then return false; end if;
      ultimo := b;
    end loop;
  end loop;
  return true;
end $$;

-- Primeira palavra proibida (moderacao.palavras_bloqueadas) encontrada no texto, ou null.
create or replace function public.texto_bloqueado(p_texto text, p_regiao uuid default null)
returns text language plpgsql stable
set search_path = public, extensions
as $$
declare
  t       text := public.sem_acento(lower(coalesce(p_texto, '')));
  lista   jsonb;
  palavra text;
begin
  if btrim(t) = '' then return null; end if;
  lista := public.config('moderacao.palavras_bloqueadas', p_regiao, '[]');
  if jsonb_typeof(lista) is distinct from 'array' then return null; end if;
  for palavra in select jsonb_array_elements_text(lista) loop
    if btrim(palavra) <> '' and t ~ ('\m' || public.sem_acento(lower(btrim(palavra))) || '\M') then
      return palavra;
    end if;
  end loop;
  return null;
end $$;

-- Nomes dos planos à venda que têm o recurso ("Plano Slim, Plano Full"), para as mensagens.
create or replace function public.planos_com_recurso(p_recurso text)
returns text language sql stable
set search_path = public, extensions
as $$
  select string_agg(p.nome, ', ' order by p.ordem, p.nome)
    from public.planos p
   where p.ativo and not p.e_teste
     and case p_recurso
           when 'foto'     then p.vitrine_foto_fachada
           when 'secoes'   then coalesce(p.vitrine_secoes_max, 1) > 0
           when 'fixados'  then coalesce(p.vitrine_fixados_max, 1) > 0
           else false
         end
$$;

-- O que a vitrine pode usar AGORA (plano efetivo: teste vencido, inadimplência e PF já contam).
-- Pessoa física e vitrine sem plano: nada.
create or replace function public.recursos_vitrine(v public.vitrines_lojas)
returns table (foto_fachada boolean, secoes_max integer, fixados_max integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  if v.id is null or v.tipo is distinct from 'loja' then
    return query select false, 0, 0;
    return;
  end if;
  p := public.plano_efetivo(v);
  if p.codigo is null then
    return query select false, 0, 0;
    return;
  end if;
  return query select p.vitrine_foto_fachada, p.vitrine_secoes_max, p.vitrine_fixados_max;
end $$;

-- Mesma coisa pelo id (para os gatilhos INVOKER de seções e fixados: quem está logado
-- não lê todas as colunas da vitrine, como o CNPJ). Só diz o que o plano libera.
create or replace function public.recursos_vitrine_id(p_vitrine uuid)
returns table (foto_fachada boolean, secoes_max integer, fixados_max integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v public.vitrines_lojas;
begin
  select * into v from public.vitrines_lojas where id = p_vitrine;
  return query select * from public.recursos_vitrine(v);
end $$;

-- ---------------------------------------------------------------------
-- 3. Vitrine: banner, informações da loja
-- ---------------------------------------------------------------------
alter table public.vitrines_lojas
  add column banner_tipo            text not null default 'modelo' check (banner_tipo in ('foto', 'modelo')),
  add column banner_url             text check (char_length(banner_url) <= 500),
  add column banner_modelo          text not null default 'liso' check (banner_modelo in ('liso', 'listras', 'pontos')),
  add column banner_cor             text not null default '#4B1248' check (banner_cor ~ '^#[0-9A-F]{6}$'),
  add column banner_moderado_em     timestamptz,                -- a equipe tirou a foto do banner
  add column banner_moderado_motivo text check (char_length(banner_moderado_motivo) <= 300),
  add column endereco               text check (char_length(endereco) <= 160),
  add column lat                    numeric(9, 6) check (lat between -90 and 90),
  add column lng                    numeric(9, 6) check (lng between -180 and 180),
  add column horarios               jsonb,                      -- null = não informado
  add column instagram              text check (instagram ~ '^[a-z0-9._]{1,30}$' and instagram !~ '\.\.'),
  add column sobre                  text check (char_length(sobre) <= 1500),
  add column formas_pagamento       text[] not null default '{}' check (cardinality(formas_pagamento) <= 15),
  add column faz_entrega            boolean,                    -- null = não informado
  add column entrega_obs            text check (char_length(entrega_obs) <= 200),
  add constraint vitrines_banner_foto_com_url check (banner_tipo <> 'foto' or banner_url is not null),
  add constraint vitrines_lat_lng_juntos      check ((lat is null) = (lng is null)),
  add constraint vitrines_horarios_validos    check (public.horarios_validos(horarios));

-- Campos públicos da loja (o motivo de moderação do banner não: o dono lê por minha_vitrine_recursos())
grant select (banner_tipo, banner_url, banner_modelo, banner_cor, endereco, lat, lng, horarios, instagram,
              sobre, formas_pagamento, faz_entrega, entrega_obs) on public.vitrines_lojas to anon, authenticated;

-- A capa antiga vira o banner com foto; a descrição vira o "Sobre nós" (uma fonte só daqui em diante).
-- Continua valendo a regra do plano: a foto só aparece se o plano tiver foto da fachada.
update public.vitrines_lojas set banner_tipo = 'foto', banner_url = capa_url where capa_url is not null and banner_url is null;
update public.vitrines_lojas set sobre = descricao where descricao is not null and sobre is null;

-- Confere e normaliza o que o dono grava. SECURITY INVOKER de propósito: acesso_sistema()
-- precisa ver quem chamou (dentro de SECURITY DEFINER o usuário vira postgres e liberaria tudo).
create or replace function public.validar_vitrine_completa()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  rec     record;
  nomes   text;
  lista   jsonb;
  f       text;
  achou   text;
  limpo   text[] := '{}';
  palavra text;
begin
  -- Moderação do banner: só a equipe grava
  if not sistema then
    if tg_op = 'INSERT' then
      new.banner_moderado_em := null;
      new.banner_moderado_motivo := null;
    else
      new.banner_moderado_em := old.banner_moderado_em;
      new.banner_moderado_motivo := old.banner_moderado_motivo;
    end if;
  end if;

  -- Pessoa física não tem página de vitrine e nunca mostra endereço exato
  if new.tipo = 'pf' and not sistema then
    new.endereco := null;
    new.lat := null;
    new.lng := null;
  end if;

  -- Textos: tira espaços sobrando; vazio vira "não informado"
  new.sobre       := nullif(btrim(new.sobre), '');
  new.endereco    := nullif(regexp_replace(btrim(coalesce(new.endereco, '')), '\s+', ' ', 'g'), '');
  new.entrega_obs := nullif(regexp_replace(btrim(coalesce(new.entrega_obs, '')), '\s+', ' ', 'g'), '');
  if char_length(new.sobre) > 1500 then
    raise exception using errcode = '23514', message = 'O texto "Sobre nós" pode ter até 1500 letras.', detail = 'campo:sobre';
  end if;
  if char_length(new.endereco) > 160 then
    raise exception using errcode = '23514', message = 'O endereço pode ter até 160 letras.', detail = 'campo:endereco';
  end if;
  if char_length(new.entrega_obs) > 200 then
    raise exception using errcode = '23514', message = 'O recado da entrega pode ter até 200 letras.', detail = 'campo:entrega_obs';
  end if;
  if not sistema then
    if tg_op = 'INSERT' or new.sobre is distinct from old.sobre then
      palavra := public.texto_bloqueado(new.sobre, new.microrregiao_id);
      if palavra is not null then
        raise exception using errcode = '23514', detail = 'campo:sobre',
          message = format('O texto "Sobre nós" tem uma palavra que não é permitida no OLAKI: "%s".', palavra);
      end if;
    end if;
    if tg_op = 'INSERT' or new.entrega_obs is distinct from old.entrega_obs then
      palavra := public.texto_bloqueado(new.entrega_obs, new.microrregiao_id);
      if palavra is not null then
        raise exception using errcode = '23514', detail = 'campo:entrega_obs',
          message = format('O recado da entrega tem uma palavra que não é permitida no OLAKI: "%s".', palavra);
      end if;
    end if;
  end if;

  -- Instagram: guarda só o nome (sem @, sem endereço, minúsculo)
  if new.instagram is not null then
    new.instagram := lower(btrim(new.instagram));
    new.instagram := regexp_replace(new.instagram, '^(https?://)?(www\.)?(instagram\.com|instagr\.am)/', '');
    new.instagram := regexp_replace(new.instagram, '[/?#].*$', '');
    new.instagram := nullif(ltrim(new.instagram, '@'), '');
    if new.instagram is not null and (new.instagram !~ '^[a-z0-9._]{1,30}$' or new.instagram ~ '\.\.') then
      raise exception using errcode = '23514', message = 'Instagram inválido. Escreva só o nome, ex.: @minhaloja.', detail = 'campo:instagram';
    end if;
  end if;

  -- Localização: os dois números juntos
  if (new.lat is null) <> (new.lng is null) then
    raise exception using errcode = '23514', message = 'A localização ficou pela metade. Toque de novo em "Usar minha localização".', detail = 'campo:localizacao';
  end if;
  if new.lat is not null and (new.lat not between -90 and 90 or new.lng not between -180 and 180) then
    raise exception using errcode = '23514', message = 'Localização inválida.', detail = 'campo:localizacao';
  end if;

  -- Horários
  if new.horarios = '{}'::jsonb or jsonb_typeof(new.horarios) = 'null' then
    new.horarios := null;
  end if;
  if not public.horarios_validos(new.horarios) then
    raise exception using errcode = '23514', detail = 'campo:horarios',
      message = 'Confira os horários: a hora de abrir vem antes da hora de fechar, e os horários do mesmo dia não podem se cruzar.';
  end if;

  -- Cor do banner: uma das cores do painel (só quando o dono troca)
  new.banner_cor := upper(btrim(coalesce(new.banner_cor, '')));
  if new.banner_cor !~ '^#[0-9A-F]{6}$' then
    raise exception using errcode = '23514', message = 'Escolha uma das cores da lista.', detail = 'campo:banner_cor';
  end if;
  if not sistema and tg_op = 'UPDATE' and new.banner_cor is distinct from old.banner_cor then
    lista := public.config('vitrine.banner_cores', new.microrregiao_id, '[]');
    if jsonb_typeof(lista) = 'array' and jsonb_array_length(lista) > 0
       and not exists (select 1 from jsonb_array_elements_text(lista) c where upper(btrim(c)) = new.banner_cor) then
      raise exception using errcode = '23514', message = 'Escolha uma das cores da lista.', detail = 'campo:banner_cor';
    end if;
  end if;

  -- Formas de pagamento: só as da lista do painel (guarda com a grafia do painel, sem repetir)
  if tg_op = 'INSERT' or new.formas_pagamento is distinct from old.formas_pagamento then
    lista := public.config('vitrine.formas_pagamento', new.microrregiao_id, '[]');
    foreach f in array coalesce(new.formas_pagamento, '{}') loop
      achou := null;
      if nullif(btrim(f), '') is null then continue; end if;
      if jsonb_typeof(lista) = 'array' then
        select o into achou from jsonb_array_elements_text(lista) o
         where public.sem_acento(lower(btrim(o))) = public.sem_acento(lower(btrim(f))) limit 1;
      end if;
      if achou is null then
        if not sistema then
          raise exception using errcode = '23514', message = 'Escolha as formas de pagamento da lista.', detail = 'campo:formas_pagamento';
        end if;
        achou := btrim(f);
      end if;
      if not achou = any(limpo) then limpo := limpo || achou; end if;
    end loop;
    new.formas_pagamento := limpo;
  end if;

  -- Banner com foto: só em plano com foto da fachada, e só arquivo do OLAKI na pasta <dono>/vitrine/
  if not sistema and (
       (new.banner_url is not null and (tg_op = 'INSERT' or new.banner_url is distinct from old.banner_url))
    or (new.banner_tipo = 'foto' and (tg_op = 'INSERT' or old.banner_tipo is distinct from 'foto'))) then
    select * into rec from public.recursos_vitrine(new);
    if not coalesce(rec.foto_fachada, false) then
      nomes := public.planos_com_recurso('foto');
      raise exception using errcode = '42501', detail = 'campo:banner',
        message = case when nomes is null then 'A foto da fachada não faz parte do seu plano.'
                       else format('A foto da fachada faz parte destes planos: %s.', nomes) end;
    end if;
  end if;
  if new.banner_tipo = 'foto' and new.banner_url is null then
    raise exception using errcode = '23514', message = 'Envie a foto da fachada ou escolha um banner modelo.', detail = 'campo:banner';
  end if;
  if not sistema and new.banner_url is not null and (tg_op = 'INSERT' or new.banner_url is distinct from old.banner_url) then
    if nullif(public.config('fotos.origem', null, 'null') #>> '{}', '') is null then
      raise exception using errcode = 'P0001', detail = 'campo:banner',
        message = 'As imagens ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
    end if;
    if not coalesce(public.foto_do_olaki(new.banner_url, new.dono_id, 'vitrine'), false) then
      raise exception using errcode = '22023', message = 'Envie a foto da fachada pelo botão do OLAKI.', detail = 'campo:banner';
    end if;
    -- foto nova: o aviso de moderação antigo sai
    new.banner_moderado_em := null;
    new.banner_moderado_motivo := null;
  end if;
  return new;
end $$;
-- "2" no nome: roda depois de vitrines_0_proteger e vitrines_1_validar_imagens
create trigger vitrines_2_validar_vitrine before insert or update on public.vitrines_lojas
  for each row execute function public.validar_vitrine_completa();

-- ---------------------------------------------------------------------
-- 4. Produtos fixados no topo da vitrine
-- ---------------------------------------------------------------------
alter table public.anuncios
  add column fixado_na_loja integer check (fixado_na_loja between 1 and 1000);   -- ordem; null = não fixado
create index anuncios_fixados_idx on public.anuncios (vitrine_id, fixado_na_loja) where fixado_na_loja is not null;

-- Limite de fixados do plano ao fixar; vendido/vencido sai do topo sozinho.
-- SECURITY INVOKER de propósito (ver validar_vitrine_completa).
create or replace function public.validar_fixado_loja()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  rec     record;
  total   integer;
  nomes   text;
begin
  if tg_op = 'INSERT' then
    if not sistema then new.fixado_na_loja := null; end if;
    return new;
  end if;
  if new.fixado_na_loja is not null and new.status in ('vendido', 'expirado', 'rascunho', 'congelado') then
    new.fixado_na_loja := null;
    return new;
  end if;
  if new.fixado_na_loja is not null and old.fixado_na_loja is null and not sistema then
    if new.status not in ('ativo', 'pausado') then
      raise exception using errcode = '23514', message = 'Só dá para fixar um anúncio que está no ar.';
    end if;
    perform 1 from public.vitrines_lojas where id = new.vitrine_id for update;   -- duas abas ao mesmo tempo não passam do limite
    select * into rec from public.recursos_vitrine_id(new.vitrine_id);
    select count(*) into total from public.anuncios a
     where a.vitrine_id = new.vitrine_id and a.fixado_na_loja is not null and a.id <> new.id;
    if rec.fixados_max is not null and total >= rec.fixados_max then
      nomes := public.planos_com_recurso('fixados');
      raise exception using errcode = 'P0001',
        message = case
          when rec.fixados_max = 0 and nomes is null then 'Fixar produtos no topo não faz parte do seu plano.'
          when rec.fixados_max = 0 then format('Fixar produtos no topo faz parte destes planos: %s.', nomes)
          else format('Seu plano deixa fixar até %s produtos. Tire um do topo antes de fixar outro.', rec.fixados_max) end;
    end if;
  end if;
  return new;
end $$;
create trigger anuncios_2_fixar before insert or update of fixado_na_loja, status on public.anuncios
  for each row execute function public.validar_fixado_loja();

-- ---------------------------------------------------------------------
-- 5. Seções próprias da loja ("Promoções", "Linha infantil"...)
-- ---------------------------------------------------------------------
create table public.loja_secoes (
  id            uuid primary key default gen_random_uuid(),
  vitrine_id    uuid not null references public.vitrines_lojas(id) on delete cascade,
  nome          text not null check (char_length(nome) between 2 and 40),
  ordem         integer not null default 0 check (ordem between 0 and 10000),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index loja_secoes_nome_unico on public.loja_secoes (vitrine_id, lower(nome));
create index loja_secoes_vitrine_idx on public.loja_secoes (vitrine_id, ordem);

create table public.loja_secao_anuncios (
  secao_id   uuid not null references public.loja_secoes(id) on delete cascade,
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  ordem      integer not null default 0 check (ordem between 0 and 10000),
  criado_em  timestamptz not null default now(),
  primary key (secao_id, anuncio_id)
);
create index loja_secao_anuncios_anuncio_idx on public.loja_secao_anuncios (anuncio_id);

-- Seção: nome, palavra proibida, só loja e limite do plano (no INSERT, contando todas as seções).
-- SECURITY INVOKER de propósito (ver validar_vitrine_completa).
create or replace function public.validar_secao_loja()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  v       record;
  rec     record;
  total   integer;
  nomes   text;
  palavra text;
begin
  if tg_op = 'UPDATE' then
    new.vitrine_id := old.vitrine_id;
    new.criado_em := old.criado_em;
  end if;
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 40 then
    raise exception using errcode = '23514', message = 'Escreva o nome da seção (de 2 a 40 letras).', detail = 'campo:nome';
  end if;
  select x.id, x.tipo, x.microrregiao_id, x.dono_id into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if v.id is null or (not sistema and v.dono_id is distinct from public.usuario_id()) then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  if v.tipo <> 'loja' then
    raise exception using errcode = '42501', message = 'Só lojas têm seções na vitrine.';
  end if;
  if not sistema and (tg_op = 'INSERT' or new.nome is distinct from old.nome) then
    palavra := public.texto_bloqueado(new.nome, v.microrregiao_id);
    if palavra is not null then
      raise exception using errcode = '23514', detail = 'campo:nome',
        message = format('O nome da seção tem uma palavra que não é permitida no OLAKI: "%s".', palavra);
    end if;
  end if;
  if exists (select 1 from public.loja_secoes s
              where s.vitrine_id = new.vitrine_id and lower(s.nome) = lower(new.nome) and s.id <> new.id) then
    raise exception using errcode = '23505', message = 'Você já tem uma seção com esse nome.', detail = 'campo:nome';
  end if;
  if tg_op = 'INSERT' then
    if not sistema then
      perform 1 from public.vitrines_lojas where id = v.id for update;   -- duas abas ao mesmo tempo não passam do limite
      select * into rec from public.recursos_vitrine_id(v.id);
      select count(*) into total from public.loja_secoes s where s.vitrine_id = v.id;
      if rec.secoes_max is not null and total >= rec.secoes_max then
        nomes := public.planos_com_recurso('secoes');
        raise exception using errcode = 'P0001',
          message = case
            when rec.secoes_max = 0 and nomes is null then 'Seções próprias não fazem parte do seu plano.'
            when rec.secoes_max = 0 then format('Seções próprias fazem parte destes planos: %s.', nomes)
            else format('Seu plano permite até %s seções. Apague uma ou troque de plano.', rec.secoes_max) end;
      end if;
    end if;
    new.ordem := least(coalesce((select max(s.ordem) from public.loja_secoes s where s.vitrine_id = v.id), 0) + 1, 10000);
    new.criado_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger secoes_0_validar before insert or update on public.loja_secoes
  for each row execute function public.validar_secao_loja();
create trigger log_loja_secoes after insert or update or delete on public.loja_secoes
  for each row execute function public.registrar_log();

-- Produto da seção: tem que ser da mesma loja; máximo por seção (vitrine.anuncios_por_secao_max).
create or replace function public.validar_secao_anuncio()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  s       public.loja_secoes;
  vit     uuid;
  regiao  uuid;
  maximo  integer;
  total   integer;
begin
  select * into s from public.loja_secoes where id = new.secao_id;
  if s.id is null then
    raise exception using errcode = '42501', message = 'Seção não encontrada.';
  end if;
  select a.vitrine_id into vit from public.anuncios a where a.id = new.anuncio_id;
  if vit is distinct from s.vitrine_id then
    raise exception using errcode = '42501', message = 'Só dá para pôr na seção anúncios da sua loja.', detail = 'campo:anuncios';
  end if;
  if tg_op = 'INSERT' and not public.acesso_sistema() then
    select v.microrregiao_id into regiao from public.vitrines_lojas v where v.id = s.vitrine_id;
    maximo := public.numero_ou_nulo(public.config('vitrine.anuncios_por_secao_max', regiao, 'null'))::int;
    if maximo is not null then
      select count(*) into total from public.loja_secao_anuncios x where x.secao_id = new.secao_id;
      if total >= maximo then
        raise exception using errcode = 'P0001', message = format('Cada seção pode ter até %s produtos.', maximo), detail = 'campo:anuncios';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger secao_anuncios_0_validar before insert or update on public.loja_secao_anuncios
  for each row execute function public.validar_secao_anuncio();

-- RLS: só o dono da loja (e o admin) mexe. O público lê pela função vitrine_publica().
alter table public.loja_secoes enable row level security;
alter table public.loja_secao_anuncios enable row level security;
create policy "secoes do dono" on public.loja_secoes for all
  using (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()))
  with check (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()));
create policy "secoes admin" on public.loja_secoes for all
  using (public.e_admin()) with check (public.e_admin());
create policy "secao anuncios do dono" on public.loja_secao_anuncios for all
  using (exists (select 1 from public.loja_secoes s join public.vitrines_lojas v on v.id = s.vitrine_id
                  where s.id = secao_id and v.dono_id = public.usuario_id()))
  with check (exists (select 1 from public.loja_secoes s join public.vitrines_lojas v on v.id = s.vitrine_id
                       where s.id = secao_id and v.dono_id = public.usuario_id()));
create policy "secao anuncios admin" on public.loja_secao_anuncios for all
  using (public.e_admin()) with check (public.e_admin());
revoke all on public.loja_secoes, public.loja_secao_anuncios from anon;
revoke truncate, references, trigger on public.loja_secoes, public.loja_secao_anuncios from authenticated;
grant select, insert, update, delete on public.loja_secoes, public.loja_secao_anuncios to authenticated;

-- ---------------------------------------------------------------------
-- 6. Ações do dono (SECURITY INVOKER: valem a RLS e os gatilhos de limite)
-- ---------------------------------------------------------------------

-- Nova ordem das seções (lista de ids na ordem da tela)
create or replace function public.ordenar_secoes(p_ids uuid[])
returns integer language plpgsql
set search_path = public, extensions
as $$
declare n integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  update public.loja_secoes s set ordem = least(x.pos, 10000)::int
    from unnest(p_ids) with ordinality as x(id, pos)
   where s.id = x.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Produtos de uma seção, na ordem da lista (troca a lista inteira de uma vez)
create or replace function public.definir_anuncios_secao(p_secao uuid, p_anuncios uuid[])
returns integer language plpgsql
set search_path = public, extensions
as $$
declare
  s public.loja_secoes;
  a uuid;
  i integer := 0;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  select * into s from public.loja_secoes x where x.id = p_secao;     -- a RLS só mostra as do dono
  if s.id is null then
    raise exception using errcode = '42501', message = 'Seção não encontrada.';
  end if;
  delete from public.loja_secao_anuncios x where x.secao_id = s.id;
  for a in
    select t.id from (select u.id, min(u.pos) as p from unnest(coalesce(p_anuncios, '{}')) with ordinality as u(id, pos)
                       where u.id is not null group by u.id) t
     order by t.p
  loop
    i := i + 1;
    insert into public.loja_secao_anuncios (secao_id, anuncio_id, ordem) values (s.id, a, least(i, 10000));
  end loop;
  return i;
end $$;

-- Fixar (vai para o fim da fila dos fixados) ou tirar do topo. Devolve a posição (null = não fixado).
create or replace function public.fixar_anuncio(p_anuncio uuid, p_fixar boolean default true)
returns integer language plpgsql
set search_path = public, extensions
as $$
declare
  a    record;
  nova integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  select x.id, x.vitrine_id, x.fixado_na_loja into a
    from public.anuncios x join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and v.dono_id = public.usuario_id();
  if a.id is null then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if not coalesce(p_fixar, true) then
    update public.anuncios x set fixado_na_loja = null where x.id = a.id and x.fixado_na_loja is not null;
    return null;
  end if;
  if a.fixado_na_loja is not null then
    return a.fixado_na_loja;                                   -- já fixado (toque repetido)
  end if;
  select coalesce(max(x.fixado_na_loja), 0) + 1 into nova from public.anuncios x where x.vitrine_id = a.vitrine_id;
  update public.anuncios x set fixado_na_loja = least(nova, 1000) where x.id = a.id;
  return least(nova, 1000);
end $$;

-- Nova ordem dos fixados (lista de ids na ordem da tela)
create or replace function public.ordenar_fixados(p_ids uuid[])
returns integer language plpgsql
set search_path = public, extensions
as $$
declare n integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  update public.anuncios a set fixado_na_loja = least(x.pos, 1000)::int
    from unnest(p_ids) with ordinality as x(id, pos)
   where a.id = x.id and a.fixado_na_loja is not null
     and exists (select 1 from public.vitrines_lojas v where v.id = a.vitrine_id and v.dono_id = public.usuario_id());
  get diagnostics n = row_count;
  return n;
end $$;

-- O que a minha loja pode usar agora + quanto já usa (tela "Minha loja")
create or replace function public.minha_vitrine_recursos()
returns table (foto_fachada boolean, secoes_max integer, fixados_max integer,
               secoes_total integer, fixados_total integer,
               banner_moderado_em timestamptz, banner_moderado_motivo text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v   public.vitrines_lojas;
  rec record;
begin
  select * into v from public.vitrines_lojas x where x.dono_id = public.usuario_id();
  if v.id is null then return; end if;
  select * into rec from public.recursos_vitrine(v);
  return query select rec.foto_fachada, rec.secoes_max, rec.fixados_max,
    (select count(*)::int from public.loja_secoes s where s.vitrine_id = v.id),
    (select count(*)::int from public.anuncios a where a.vitrine_id = v.id and a.fixado_na_loja is not null),
    v.banner_moderado_em, v.banner_moderado_motivo;
end $$;

-- Equipe OLAKI tira a foto do banner (volta para o modelo) e grava o motivo
create or replace function public.moderar_banner_vitrine(p_vitrine uuid, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Apenas a equipe OLAKI pode moderar.' using errcode = '42501';
  end if;
  update public.vitrines_lojas
     set banner_tipo = 'modelo', banner_url = null, banner_moderado_em = now(),
         banner_moderado_motivo = left(coalesce(nullif(btrim(p_motivo), ''), 'Foto fora das regras do OLAKI'), 300)
   where id = p_vitrine;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Leitura pública da vitrine (só campos públicos)
-- ---------------------------------------------------------------------

-- Loja ativa pelo endereço /loja/<slug> (dono e admin veem a inativa). Pessoa física → null.
-- Banner: foto só se o plano de agora tiver foto da fachada (senão o modelo; nunca vazio).
-- Seções: só as primeiras N ativas do plano, cada uma com os ids dos anúncios no ar, na ordem.
-- WhatsApp: mesma regra de anuncio_publico (loja → WhatsApp da loja; se não houver, o celular confirmado).
-- Nunca CNPJ, plano, cobrança ou motivo de moderação.
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
  foto := v.banner_tipo = 'foto' and v.banner_url is not null and coalesce(rec.foto_fachada, false);

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
    'banner_modelo', v.banner_modelo, 'banner_cor', v.banner_cor,
    'selo', v.selo_loja_verificada, 'cidade', v.cidade, 'bairro', v.bairro,
    'whatsapp', case when v.status = 'ativa'
                     then coalesce(v.whatsapp, case when pf.whatsapp_verificado_em is not null then pf.whatsapp end) end,
    'endereco', v.endereco, 'lat', v.lat, 'lng', v.lng, 'horarios', v.horarios, 'instagram', v.instagram,
    'sobre', coalesce(v.sobre, v.descricao), 'formas_pagamento', to_jsonb(v.formas_pagamento),
    'faz_entrega', v.faz_entrega, 'entrega_obs', v.entrega_obs,
    'status', v.status, 'criado_em', v.criado_em, 'microrregiao_id', v.microrregiao_id,
    'e_dono', coalesce(dono, false), 'secoes', secoes, 'total_anuncios', total);
end $$;

create type public.vitrine_anuncio as (
  id                 uuid,
  titulo             text,
  preco_centavos     bigint,
  aceita_troca       boolean,
  cidade             text,
  bairro             text,
  capa               text,
  criado_em          timestamptz,   -- publicado_em (ou criado_em)
  destaque           boolean,       -- destaque pago: o card mostra "Patrocinado"
  fixado             integer,       -- posição entre os fixados que o plano mostra (null = não fixado)
  categoria_id       uuid,
  categoria_slug     text,
  categoria_nome     text,
  categoria_pai_nome text,
  grupo_ordem        integer        -- ordem do grupo automático (categoria-mãe, depois subcategoria)
);

-- Anúncios no ar da loja. Ordem 'recentes' (padrão): fixados primeiro (só os N do plano),
-- depois os mais novos. 'menor_preco': do mais barato ao mais caro ("a combinar" no fim).
create or replace function public.anuncios_vitrine(p_vitrine_id uuid, p_ordem text default 'recentes')
returns setof public.vitrine_anuncio
language sql stable security definer
set search_path = public, extensions
as $$
  with v as (
    select x.id, x.microrregiao_id, r.fixados_max
      from public.vitrines_lojas x
      cross join lateral public.recursos_vitrine(x) r
     where x.id = p_vitrine_id and x.tipo = 'loja'
       and (x.status = 'ativa' or x.dono_id = public.usuario_id() or public.e_admin())
  ),
  base as (
    select a.*, v.fixados_max,
           case when a.fixado_na_loja is not null
                then row_number() over (partition by a.fixado_na_loja is not null
                                        order by a.fixado_na_loja, coalesce(a.publicado_em, a.criado_em) desc, a.id) end as pos_fixado
      from public.anuncios a join v on v.id = a.vitrine_id
     where a.status = 'ativo'
  ),
  efetivo as (
    select b.*, case when b.pos_fixado <= coalesce(b.fixados_max, 2147483647) then b.pos_fixado end as fixado_ok
      from base b
  )
  select e.id, e.titulo, e.preco_centavos, e.aceita_troca, e.cidade, e.bairro, e.fotos[1],
         coalesce(e.publicado_em, e.criado_em), coalesce(e.destaque_ate > now(), false), e.fixado_ok::int,
         c.id, c.slug, c.nome, cp.nome,
         (coalesce(cp.ordem, c.ordem, 999) * 1000 + case when cp.id is null then 0 else coalesce(c.ordem, 999) end)::int
    from efetivo e
    left join public.categorias c on c.id = e.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   order by case when p_ordem = 'menor_preco' then e.preco_centavos end asc nulls last,
            case when coalesce(p_ordem, 'recentes') <> 'menor_preco' then e.fixado_ok end asc nulls last,
            coalesce(e.publicado_em, e.criado_em) desc,
            e.id
   limit greatest(coalesce(public.numero_ou_nulo(public.config('vitrine.anuncios_por_pagina',
                    (select v.microrregiao_id from v), '120'))::int, 120), 1)
$$;

-- ---------------------------------------------------------------------
-- 8. Envio da foto do banner ao Storage: pasta <usuario>/vitrine/<arquivo>,
--    só loja não suspensa com foto da fachada no plano. Resto igual à versão anterior.
-- ---------------------------------------------------------------------
create or replace function public.pode_enviar_foto(nome text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid    text := public.usuario_id();
  partes text[] := string_to_array(coalesce(pode_enviar_foto.nome, ''), '/');
  regiao uuid;
  vit    public.vitrines_lojas;
  maximo integer;
  total  integer := 0;
begin
  if uid is null or cardinality(partes) <> 3 or partes[1] <> uid
     or partes[3] !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    return false;
  end if;
  if partes[2] = 'loja' then
    select v.microrregiao_id into regiao from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if not found then return false; end if;
  elsif partes[2] = 'vitrine' then
    select * into vit from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if vit.id is null then return false; end if;
    if not coalesce((select r.foto_fachada from public.recursos_vitrine(vit) r), false) then return false; end if;
    regiao := vit.microrregiao_id;
  elsif partes[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select a.microrregiao_id into regiao from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = partes[2]::uuid and v.dono_id = uid and a.status not in ('congelado', 'em_analise');
    if not found then return false; end if;
  else
    return false;
  end if;
  maximo := public.numero_ou_nulo(public.config('fotos.max_por_pasta', regiao, 'null'))::int;
  if maximo is not null and to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id = $1 and name like $2'
       into total using 'anuncios', partes[1] || '/' || partes[2] || '/%';
    if total >= maximo then return false; end if;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 9. Endurecimento (mesma regra das migrações anteriores). Pode rodar de novo.
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

-- Públicas por natureza (página da loja e checagem de formato)
revoke all on function public.vitrine_publica(text), public.anuncios_vitrine(uuid, text), public.horarios_validos(jsonb) from public;
grant execute on function public.vitrine_publica(text), public.anuncios_vitrine(uuid, text), public.horarios_validos(jsonb)
  to anon, authenticated, service_role;

-- Só para quem está logado (usadas pelos gatilhos INVOKER e pelas telas do dono)
revoke all on function public.texto_bloqueado(text, uuid), public.planos_com_recurso(text),
  public.recursos_vitrine(public.vitrines_lojas), public.recursos_vitrine_id(uuid), public.minha_vitrine_recursos(),
  public.ordenar_secoes(uuid[]), public.definir_anuncios_secao(uuid, uuid[]),
  public.fixar_anuncio(uuid, boolean), public.ordenar_fixados(uuid[]),
  public.moderar_banner_vitrine(uuid, text) from public, anon;
grant execute on function public.texto_bloqueado(text, uuid), public.planos_com_recurso(text),
  public.recursos_vitrine(public.vitrines_lojas), public.recursos_vitrine_id(uuid), public.minha_vitrine_recursos(),
  public.ordenar_secoes(uuid[]), public.definir_anuncios_secao(uuid, uuid[]),
  public.fixar_anuncio(uuid, boolean), public.ordenar_fixados(uuid[]),
  public.moderar_banner_vitrine(uuid, text) to authenticated, service_role;

-- pode_enviar_foto foi recriada: mantém as permissões da versão anterior
revoke all on function public.pode_enviar_foto(text) from public, anon;
grant execute on function public.pode_enviar_foto(text) to authenticated, service_role;
