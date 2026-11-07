-- =====================================================================
-- OLAKI · Migração 3: categorias em tabela, rascunhos, vender (PF/loja),
-- busca, página pública do anúncio, eventos e fotos.
-- Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md (seções 1 a 5) e TELAS-E-FLUXOS.md.
-- Regra de ouro mantida: categorias, campos, limites e textos de regra
-- ficam em tabelas (categorias, planos, configuracoes), editáveis no painel.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Utilitários
-- ---------------------------------------------------------------------

-- Quem passa direto pelas proteções: chave secreta (service_role), funções do
-- sistema (usuário postgres, inclusive dentro de SECURITY DEFINER), admins e
-- rotinas internas que ligam a flag olaki.sistema. Mesma regra das migrações anteriores.
create or replace function public.acesso_sistema()
returns boolean language sql stable
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin', 'service_role')
      or public.e_admin()
      or coalesce(current_setting('olaki.sistema', true), '') = '1'
$$;

-- Lê um número vindo do formulário: número JSON ou texto ("45.000", "2,5", "1500").
-- Ponto como separador de milhar (padrão brasileiro) e vírgula como decimal.
create or replace function public.numero_ou_nulo(v jsonb)
returns numeric language plpgsql immutable
set search_path = public
as $$
declare t text;
begin
  if v is null then return null; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::numeric; end if;
  if jsonb_typeof(v) <> 'string' then return null; end if;
  t := btrim(v #>> '{}');
  if t ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' then
    return replace(replace(t, '.', ''), ',', '.')::numeric;
  elsif t ~ '^-?[0-9]+(,[0-9]+)?$' then
    return replace(t, ',', '.')::numeric;
  elsif t ~ '^-?[0-9]+\.[0-9]+$' then
    return t::numeric;
  end if;
  return null;
end $$;

-- Configurações novas (todas editáveis no painel)
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('pf.plano_inicial',                  '"pf_gratis"', 'planos',  false, 'Plano que a pessoa física recebe ao tocar em "Vender minhas coisas"'),
  ('anuncio.fotos_minimo',              '1',       'anuncios', true,  'Fotos mínimas para publicar um anúncio'),
  ('fotos.tamanho_max_bytes',           '5242880', 'anuncios', true,  'Tamanho máximo de cada foto enviada (bytes). Vale para o bucket "anuncios" quando a migração roda'),
  ('busca.similaridade_minima',         '0.45',    'busca',    false, 'Quanto a palavra precisa parecer com o título para a busca tolerar erro de digitação (0 a 1)'),
  ('busca.faixa_preco_minimo_anuncios', '3',       'busca',    true,  'Mínimo de anúncios parecidos para mostrar a faixa de preço da região'),
  ('eventos.repetir_apos_minutos',      '30',      'busca',    false, 'Visualização/clique repetido do mesmo visitante dentro deste prazo não conta de novo'),
  ('fotos.origem',                      'null',    'anuncios', true,  'Endereço do Storage do Supabase, ex.: "https://abcd.supabase.co". Só fotos, logos e capas guardadas nesse endereço são aceitas. Preencha depois do deploy'),
  ('fotos.max_por_pasta',               '24',      'anuncios', false, 'Máximo de arquivos guardados no Storage por anúncio (e na pasta da loja). Conta também fotos trocadas que ainda não foram apagadas'),
  ('anuncio.rascunhos_max',             '20',      'anuncios', true,  'Máximo de rascunhos guardados por vendedor ao mesmo tempo'),
  ('loja.plano_teste',                  '"teste"', 'planos',   true,  'Código do plano de teste grátis que a loja recebe ao tocar em "Tenho uma loja"')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Categorias (árvore de 2 níveis: categoria-mãe → subcategoria)
-- ---------------------------------------------------------------------
create table public.categorias (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  nome                text not null check (char_length(nome) between 2 and 60),
  icone               text check (icone ~ '^[a-z0-9-]{1,40}$'),      -- nome do ícone lucide (ex.: 'car', 'tractor')
  pai_id              uuid references public.categorias(id) on delete restrict,
  ordem               integer not null default 0,
  ativa               boolean not null default true,
  -- Campos que o anúncio pede (só nas subcategorias). Formato validado em validar_campos_categoria().
  campos              jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  -- Limites de preço usados pela moderação (null = usa a configuração geral da categoria antiga)
  preco_min_centavos  bigint check (preco_min_centavos >= 0),
  preco_max_centavos  bigint check (preco_max_centavos >= 0),
  -- Categoria antiga equivalente (compatibilidade com anuncios.categoria e o Radar)
  tipo_legado         public.categoria_anuncio not null default 'geral',
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (pai_id is distinct from id),
  check (preco_min_centavos is null or preco_max_centavos is null or preco_min_centavos <= preco_max_centavos)
);
create index categorias_pai_idx on public.categorias (pai_id, ordem);

-- Confere e normaliza a lista de campos (mensagens para o painel admin)
create or replace function public.validar_campos_categoria(p_campos jsonb)
returns jsonb language plpgsql immutable
set search_path = public
as $$
declare
  c       jsonb;
  res     jsonb := '[]'::jsonb;
  chaves  text[] := '{}';
  ch      text;
  rot     text;
begin
  if jsonb_typeof(p_campos) is distinct from 'array' then
    raise exception 'Os campos da categoria precisam ser uma lista.' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(p_campos) loop
    if jsonb_typeof(c) <> 'object' then
      raise exception 'Cada campo da categoria precisa ter chave, rótulo e tipo.' using errcode = '22023';
    end if;
    ch  := c->>'chave';
    rot := btrim(coalesce(c->>'rotulo', ''));
    if ch is null or ch !~ '^[a-z][a-z0-9_]{0,39}$' then
      raise exception 'Chave de campo inválida: "%". Use letras minúsculas, números e _ (ex.: ano, area_m2).', coalesce(ch, '') using errcode = '22023';
    end if;
    if ch = any(chaves) then
      raise exception 'O campo "%" aparece duas vezes.', ch using errcode = '22023';
    end if;
    chaves := chaves || ch;
    if rot = '' or char_length(rot) > 60 then
      raise exception 'O campo "%" precisa de um nome (rótulo) de até 60 letras.', ch using errcode = '22023';
    end if;
    if coalesce(c->>'tipo', '') not in ('texto', 'numero', 'lista', 'sim_nao') then
      raise exception 'O campo "%" precisa ter tipo texto, numero, lista ou sim_nao.', rot using errcode = '22023';
    end if;
    if c ? 'obrigatorio' and jsonb_typeof(c->'obrigatorio') <> 'boolean' then
      raise exception 'No campo "%", "obrigatório" deve ser sim ou não.', rot using errcode = '22023';
    end if;
    if c ? 'filtro' and jsonb_typeof(c->'filtro') <> 'boolean' then
      raise exception 'No campo "%", "vira filtro" deve ser sim ou não.', rot using errcode = '22023';
    end if;
    if c->>'tipo' = 'lista' then
      if jsonb_typeof(c->'opcoes') is distinct from 'array' or jsonb_array_length(c->'opcoes') = 0
         or exists (select 1 from jsonb_array_elements(c->'opcoes') o
                     where jsonb_typeof(o) <> 'string' or btrim(o #>> '{}') = '') then
        raise exception 'O campo "%" é uma lista: coloque as opções.', rot using errcode = '22023';
      end if;
    elsif c ? 'opcoes' then
      c := c - 'opcoes';
    end if;
    if c ? 'unidade' and jsonb_typeof(c->'unidade') not in ('string', 'null') then
      raise exception 'No campo "%", a unidade deve ser um texto (ex.: km, horas, ha, m²).', rot using errcode = '22023';
    end if;
    if c->>'tipo' = 'numero' then
      if (c ? 'min' and jsonb_typeof(c->'min') not in ('number', 'null'))
         or (c ? 'max' and jsonb_typeof(c->'max') not in ('number', 'null')) then
        raise exception 'No campo "%", mínimo e máximo devem ser números.', rot using errcode = '22023';
      end if;
      if (c->>'min')::numeric > (c->>'max')::numeric then
        raise exception 'No campo "%", o mínimo é maior que o máximo.', rot using errcode = '22023';
      end if;
    else
      c := c - 'min' - 'max';
    end if;
    res := res || jsonb_build_array(
      jsonb_strip_nulls(c || jsonb_build_object(
        'rotulo', rot,
        'obrigatorio', coalesce((c->>'obrigatorio')::boolean, false),
        'filtro', coalesce((c->>'filtro')::boolean, false))));
  end loop;
  return res;
end $$;

create or replace function public.validar_categoria()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.campos := public.validar_campos_categoria(new.campos);
  if new.pai_id is not null then
    if exists (select 1 from public.categorias p where p.id = new.pai_id and p.pai_id is not null) then
      raise exception 'Só existem dois níveis: categoria e subcategoria.' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.categorias f where f.pai_id = new.id) then
      raise exception 'Esta categoria tem subcategorias e não pode virar subcategoria.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger categorias_validar before insert or update on public.categorias
  for each row execute function public.validar_categoria();
create trigger tocar_categorias before update on public.categorias
  for each row execute function public.tocar_atualizado_em();
create trigger log_categorias after insert or update or delete on public.categorias
  for each row execute function public.registrar_log();

alter table public.categorias enable row level security;
create policy "categorias leitura" on public.categorias for select using (ativa or public.e_admin());
create policy "categorias admin"   on public.categorias for all using (public.e_admin()) with check (public.e_admin());
revoke insert, update, delete, truncate on public.categorias from anon;
grant select on public.categorias to anon, authenticated;
grant insert, update, delete on public.categorias to authenticated;   -- a policy deixa só o admin

-- Sugestão inicial (PRODUTO-CONTAS-ANUNCIOS-ROBO.md, seção 3). Tudo editável no painel.
do $$
declare
  -- Campos reaproveitados
  estado      jsonb := '{"chave":"estado","rotulo":"Estado","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Novo","Seminovo","Usado"]}';
  marca       jsonb := '{"chave":"marca","rotulo":"Marca","tipo":"texto","obrigatorio":true,"filtro":true}';
  marca_opc   jsonb := '{"chave":"marca","rotulo":"Marca","tipo":"texto","obrigatorio":false,"filtro":true}';
  modelo      jsonb := '{"chave":"modelo","rotulo":"Modelo","tipo":"texto","obrigatorio":true,"filtro":false}';
  ano         jsonb := '{"chave":"ano","rotulo":"Ano","tipo":"numero","obrigatorio":true,"filtro":true,"min":1950,"max":2100}';
  ano_opc     jsonb := '{"chave":"ano","rotulo":"Ano","tipo":"numero","obrigatorio":false,"filtro":true,"min":1950,"max":2100}';
  km          jsonb := '{"chave":"km","rotulo":"Quilometragem","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"km","min":0}';
  cambio      jsonb := '{"chave":"cambio","rotulo":"Câmbio","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Manual","Automático"]}';
  comb_carro  jsonb := '{"chave":"combustivel","rotulo":"Combustível","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Flex","Gasolina","Etanol","Diesel","Elétrico","Híbrido","GNV"]}';
  comb_moto   jsonb := '{"chave":"combustivel","rotulo":"Combustível","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Gasolina","Flex","Elétrico"]}';
  comb_pesado jsonb := '{"chave":"combustivel","rotulo":"Combustível","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Diesel","Flex","Gasolina","GNV"]}';
  cor         jsonb := '{"chave":"cor","rotulo":"Cor","tipo":"texto","obrigatorio":false,"filtro":false}';
  horas       jsonb := '{"chave":"horas","rotulo":"Horas de uso","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"horas","min":0}';
  potencia    jsonb := '{"chave":"potencia","rotulo":"Potência","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"cv","min":0}';
  raca        jsonb := '{"chave":"raca","rotulo":"Raça","tipo":"texto","obrigatorio":false,"filtro":true}';
  quantidade  jsonb := '{"chave":"quantidade","rotulo":"Quantidade","tipo":"numero","obrigatorio":true,"filtro":false,"unidade":"cabeças","min":1}';
  idade       jsonb := '{"chave":"idade_media","rotulo":"Idade média","tipo":"numero","obrigatorio":false,"filtro":false,"unidade":"meses","min":0}';
  peso        jsonb := '{"chave":"peso_medio","rotulo":"Peso médio","tipo":"numero","obrigatorio":false,"filtro":false,"unidade":"kg","min":0}';
  sexo        jsonb := '{"chave":"sexo","rotulo":"Sexo","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Machos","Fêmeas","Misto"]}';
  sacas       jsonb := '{"chave":"quantidade","rotulo":"Quantidade","tipo":"numero","obrigatorio":false,"filtro":false,"unidade":"sacas","min":0}';
  finalidade  jsonb := '{"chave":"finalidade","rotulo":"Venda ou aluguel","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Venda","Aluguel"]}';
  quartos     jsonb := '{"chave":"quartos","rotulo":"Quartos","tipo":"numero","obrigatorio":false,"filtro":true,"min":0}';
  banheiros   jsonb := '{"chave":"banheiros","rotulo":"Banheiros","tipo":"numero","obrigatorio":false,"filtro":true,"min":0}';
  vagas       jsonb := '{"chave":"vagas","rotulo":"Vagas de garagem","tipo":"numero","obrigatorio":false,"filtro":true,"min":0}';
  area_m2     jsonb := '{"chave":"area","rotulo":"Área","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"m²","min":0}';
  area_ha     jsonb := '{"chave":"area","rotulo":"Área","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"ha","min":0}';
  pai         uuid;
begin
  -- Veículos
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('veiculos', 'Veículos', 'car', 1, 'veiculo') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos) values
    ('carros',                  'Carros',                   'car',    pai, 1, 'veiculo', jsonb_build_array(marca, modelo, ano, km, cambio, comb_carro, cor)),
    ('motos',                   'Motos',                    'bike',   pai, 2, 'veiculo', jsonb_build_array(marca, modelo, ano, km, cambio, comb_moto, cor)),
    ('caminhoes-e-utilitarios', 'Caminhões e utilitários',  'truck',  pai, 3, 'veiculo', jsonb_build_array(marca, modelo, ano, km, comb_pesado, cor)),
    ('pecas-e-acessorios',      'Peças e acessórios',       'wrench', pai, 4, 'geral',   jsonb_build_array(estado));

  -- Agro
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('agro', 'Agro', 'tractor', 2, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos, preco_max_centavos) values
    ('tratores-e-maquinas', 'Tratores e máquinas', 'tractor', pai, 1, 'veiculo', jsonb_build_array(marca, modelo, ano, horas, potencia, estado), null),
    ('implementos',         'Implementos',         'cog',     pai, 2, 'geral',   jsonb_build_array(marca_opc, ano_opc, estado), 500000000),
    ('gado-e-animais',      'Gado e animais',      'beef',    pai, 3, 'geral',   jsonb_build_array(raca, quantidade, idade, peso, sexo), 2000000000),
    ('sementes-e-insumos',  'Sementes e insumos',  'sprout',  pai, 4, 'geral',   '[]'::jsonb, 500000000),
    ('graos',               'Grãos',               'wheat',   pai, 5, 'geral',   jsonb_build_array(sacas), 2000000000);

  -- Imóveis
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('imoveis', 'Imóveis', 'house', 3, 'imovel') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos, preco_max_centavos) values
    ('casas',              'Casas',              'house',      pai, 1, 'imovel', jsonb_build_array(finalidade, quartos, banheiros, vagas, area_m2), null),
    ('apartamentos',       'Apartamentos',       'building-2', pai, 2, 'imovel', jsonb_build_array(finalidade, quartos, banheiros, vagas, area_m2), null),
    ('terrenos-e-lotes',   'Terrenos e lotes',   'map',        pai, 3, 'imovel', jsonb_build_array(finalidade, area_m2), null),
    ('fazendas-e-sitios',  'Fazendas e sítios',  'trees',      pai, 4, 'imovel', jsonb_build_array(finalidade, area_ha), 50000000000),
    ('pontos-comerciais',  'Pontos comerciais',  'store',      pai, 5, 'imovel', jsonb_build_array(finalidade, banheiros, vagas, area_m2), null);

  -- Casa e móveis
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('casa-e-moveis', 'Casa e móveis', 'sofa', 4, 'movel') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos) values
    ('moveis',           'Móveis',           'armchair',     pai, 1, 'movel', jsonb_build_array(estado)),
    ('eletrodomesticos', 'Eletrodomésticos', 'refrigerator', pai, 2, 'geral', jsonb_build_array(estado)),
    ('decoracao',        'Decoração',        'lamp',         pai, 3, 'movel', jsonb_build_array(estado)),
    ('construcao',       'Construção',       'hammer',       pai, 4, 'geral', jsonb_build_array(estado));

  -- Eletrônicos
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('eletronicos', 'Eletrônicos', 'smartphone', 5, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos) values
    ('celulares',   'Celulares',   'smartphone', pai, 1, 'geral', jsonb_build_array(marca_opc, estado)),
    ('informatica', 'Informática', 'laptop',     pai, 2, 'geral', jsonb_build_array(estado)),
    ('tv-e-som',    'TV e som',    'tv',         pai, 3, 'geral', jsonb_build_array(estado)),
    ('games',       'Games',       'gamepad-2',  pai, 4, 'geral', jsonb_build_array(estado));

  -- Moda e beleza
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('moda-e-beleza', 'Moda e beleza', 'shirt', 6, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos) values
    ('roupas',   'Roupas',   'shirt',        pai, 1, 'geral', jsonb_build_array(estado)),
    ('calcados', 'Calçados', 'footprints',   pai, 2, 'geral', jsonb_build_array(estado)),
    ('bolsas',   'Bolsas',   'shopping-bag', pai, 3, 'geral', jsonb_build_array(estado)),
    ('beleza',   'Beleza',   'sparkles',     pai, 4, 'geral', jsonb_build_array(estado));

  -- Serviços (sem campos: o anunciante descreve)
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('servicos', 'Serviços', 'hand-helping', 7, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado) values
    ('pedreiro',        'Pedreiro',    'brick-wall',     pai, 1, 'geral'),
    ('eletricista',     'Eletricista', 'zap',            pai, 2, 'geral'),
    ('fretes',          'Fretes',      'truck',          pai, 3, 'geral'),
    ('diaristas',       'Diaristas',   'spray-can',      pai, 4, 'geral'),
    ('aulas',           'Aulas',       'graduation-cap', pai, 5, 'geral'),
    ('outros-servicos', 'Outros',      'ellipsis',       pai, 6, 'geral');

  -- Empregos
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('empregos', 'Empregos', 'briefcase', 8, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado) values
    ('vagas',            'Vagas',            'briefcase',   pai, 1, 'geral'),
    ('procuro-trabalho', 'Procuro trabalho', 'user-search', pai, 2, 'geral');

  -- Outros
  insert into public.categorias (slug, nome, icone, ordem, tipo_legado) values ('outros', 'Outros', 'package', 9, 'geral') returning id into pai;
  insert into public.categorias (slug, nome, icone, pai_id, ordem, tipo_legado, campos) values
    ('esporte',              'Esporte',              'dumbbell',   pai, 1, 'geral', jsonb_build_array(estado)),
    ('infantil',             'Infantil',             'baby',       pai, 2, 'geral', jsonb_build_array(estado)),
    ('animais-de-estimacao', 'Animais de estimação', 'paw-print',  pai, 3, 'geral', '[]'::jsonb),
    ('diversos',             'Diversos',             'package',    pai, 4, 'geral', jsonb_build_array(estado));
end $$;

-- ---------------------------------------------------------------------
-- 2. Vitrines: pessoa física também tem uma (anuncios.vitrine_id é obrigatório)
--    tipo 'pf'  = "Vender minhas coisas" (sem página de loja; plano pf.plano_inicial)
--    tipo 'loja' = "Tenho uma loja" (vitrine /loja/<slug>, teste grátis)
-- ---------------------------------------------------------------------
alter table public.vitrines_lojas
  add column tipo text not null default 'loja' check (tipo in ('pf', 'loja'));
-- O link olaki.com.br/loja/<slug> não tem região: o endereço é único no site todo.
create unique index vitrines_slug_unico on public.vitrines_lojas (slug);
grant select (tipo) on public.vitrines_lojas to anon, authenticated;
-- Plano de teste vem da configuração (loja.plano_teste), não fixo no código
drop policy "vitrine propria criar" on public.vitrines_lojas;
create policy "vitrine propria criar" on public.vitrines_lojas
  for insert with check (dono_id = public.usuario_id()
                         and plano = coalesce(public.config('loja.plano_teste', microrregiao_id, '"teste"') #>> '{}', 'teste')
                         and selo_loja_verificada = false);

-- ---------------------------------------------------------------------
-- 3. Anúncios: categoria da tabela, rascunhos, vendido, publicado
-- ---------------------------------------------------------------------
alter table public.anuncios
  add column categoria_id        uuid references public.categorias(id) on delete restrict,
  add column vendido_pelo_olaki  boolean,          -- resposta do "Vendeu pelo OLAKI?"
  add column vendido_em          timestamptz,
  add column publicado_em        timestamptz;      -- 1ª vez que ficou 'ativo' (ordem "recentes")
create index anuncios_categoria_id_idx on public.anuncios (categoria_id, status, preco_centavos);

-- Rascunho pode estar incompleto (o passo a passo salva a cada passo).
-- Título, cidade e categoria só são exigidos quando o anúncio aparece ao público.
alter table public.anuncios alter column titulo drop not null;
alter table public.anuncios alter column cidade drop not null;
alter table public.anuncios alter column categoria drop not null;
alter table public.anuncios drop constraint anuncios_titulo_check;
alter table public.anuncios add constraint anuncios_titulo_check check (
  coalesce(char_length(titulo), 0) <= 90
  and (status not in ('ativo', 'em_analise', 'vendido') or coalesce(char_length(btrim(titulo)), 0) >= 5));
alter table public.anuncios add constraint anuncios_cidade_publico check (
  status not in ('ativo', 'em_analise', 'vendido') or nullif(btrim(cidade), '') is not null);
alter table public.anuncios add constraint anuncios_categoria_publico check (
  status not in ('ativo', 'em_analise', 'vendido') or categoria is not null);

-- A regra fixa (imóvel/veículo/móvel) sai: quem valida agora são os campos da categoria.
alter table public.anuncios drop constraint anuncios_atributos_validos;
alter table public.anuncios add constraint anuncios_atributos_objeto check (jsonb_typeof(atributos) = 'object');
-- O índice antigo convertia 'ano' com ::int e quebrava com valor decimal
drop index if exists public.anuncios_veiculo_ano;
create index anuncios_veiculo_ano on public.anuncios ((public.numero_ou_nulo(atributos->'ano'))) where categoria = 'veiculo';

-- Confere os detalhes do anúncio contra os campos da categoria e normaliza:
--  * vazio/null conta como não preenchido (e sai do JSON)
--  * numero: aceita número ou texto numérico, guarda como número, respeita min/max
--  * lista: precisa ser uma das opções (guarda a grafia da opção)
--  * sim_nao: guarda true/false (aceita "sim"/"não")
--  * texto: até 120 letras
--  * p_exigir = true: campos obrigatórios precisam estar preenchidos
create or replace function public.normalizar_atributos(p_campos jsonb, p_atributos jsonb, p_exigir boolean)
returns jsonb language plpgsql stable
set search_path = public
as $$
declare
  c     jsonb;
  ch    text;
  rot   text;
  v     jsonb;
  n     numeric;
  t     text;
  op    text;
  res   jsonb := coalesce(p_atributos, '{}'::jsonb);
begin
  if jsonb_typeof(res) <> 'object' then
    raise exception 'Os detalhes do anúncio estão num formato inválido.' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_campos, '[]'::jsonb)) loop
    ch  := c->>'chave';
    rot := coalesce(c->>'rotulo', ch);
    v   := res->ch;
    if v is not null and (jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')) then
      res := res - ch;
      v := null;
    end if;
    if v is null then
      if p_exigir and coalesce((c->>'obrigatorio')::boolean, false) then
        raise exception using errcode = '23514', message = format('Preencha o campo "%s".', rot), detail = 'campo:' || ch;
      end if;
      continue;
    end if;

    if c->>'tipo' = 'numero' then
      n := public.numero_ou_nulo(v);
      if n is null then
        raise exception using errcode = '23514', message = format('O campo "%s" precisa ser um número.', rot), detail = 'campo:' || ch;
      end if;
      if public.numero_ou_nulo(c->'min') is not null and n < public.numero_ou_nulo(c->'min') then
        raise exception using errcode = '23514', message = format('O campo "%s" deve ser no mínimo %s.', rot, c->>'min'), detail = 'campo:' || ch;
      end if;
      if public.numero_ou_nulo(c->'max') is not null and n > public.numero_ou_nulo(c->'max') then
        raise exception using errcode = '23514', message = format('O campo "%s" deve ser no máximo %s.', rot, c->>'max'), detail = 'campo:' || ch;
      end if;
      res := jsonb_set(res, array[ch], to_jsonb(n));
    elsif c->>'tipo' = 'sim_nao' then
      if jsonb_typeof(v) <> 'boolean' then
        t := public.sem_acento(lower(btrim(v #>> '{}')));
        if t in ('true', 'sim', 's') then res := jsonb_set(res, array[ch], 'true');
        elsif t in ('false', 'nao', 'n') then res := jsonb_set(res, array[ch], 'false');
        else
          raise exception using errcode = '23514', message = format('Responda Sim ou Não no campo "%s".', rot), detail = 'campo:' || ch;
        end if;
      end if;
    elsif c->>'tipo' = 'lista' then
      if jsonb_typeof(v) not in ('string', 'number') then
        raise exception using errcode = '23514', message = format('Escolha uma das opções do campo "%s".', rot), detail = 'campo:' || ch;
      end if;
      select o into op from jsonb_array_elements_text(c->'opcoes') o
       where public.sem_acento(lower(o)) = public.sem_acento(lower(btrim(v #>> '{}'))) limit 1;
      if op is null then
        raise exception using errcode = '23514', message = format('Escolha uma das opções do campo "%s".', rot), detail = 'campo:' || ch;
      end if;
      res := jsonb_set(res, array[ch], to_jsonb(op));
    else
      if jsonb_typeof(v) in ('object', 'array') then
        raise exception using errcode = '23514', message = format('O campo "%s" precisa ser um texto.', rot), detail = 'campo:' || ch;
      end if;
      t := btrim(v #>> '{}');
      if char_length(t) > 120 then
        raise exception using errcode = '23514', message = format('O campo "%s" pode ter até 120 letras.', rot), detail = 'campo:' || ch;
      end if;
      res := jsonb_set(res, array[ch], to_jsonb(t));
    end if;
  end loop;
  return res;
end $$;

-- Gatilho principal do anúncio (roda logo depois de proteger_insercao):
-- categoria → enum antigo, campos exigidos ao publicar, fotos só do bucket do OLAKI.
create or replace function public.validar_anuncio()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  cat       public.categorias;
  rigido    boolean := new.status in ('ativo', 'em_analise', 'vendido');
  entrando  boolean;
  pelo_sist boolean := tg_op = 'UPDATE' and coalesce(current_setting('olaki.sistema', true), '') = '1';
  erro      text;
  campo     text;
begin
  if new.categoria_id is not null then
    select * into cat from public.categorias where id = new.categoria_id;
    if cat.id is null then
      raise exception using errcode = '23503', message = 'Categoria não encontrada.', detail = 'campo:categoria';
    end if;
    if tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id then
      if not cat.ativa then
        raise exception using errcode = '23514', message = 'Esta categoria não está disponível. Escolha outra.', detail = 'campo:categoria';
      end if;
      if exists (select 1 from public.categorias f where f.pai_id = cat.id) then
        raise exception using errcode = '23514', message = format('Escolha uma subcategoria de "%s".', cat.nome), detail = 'campo:categoria';
      end if;
    end if;
    new.categoria := cat.tipo_legado;
    new.subcategoria := cat.nome;
  end if;

  -- Entrando no ar (inserção já pública ou saindo de rascunho/pausado/expirado)
  entrando := rigido and (tg_op = 'INSERT' or old.status not in ('ativo', 'em_analise', 'vendido'));
  if entrando then
    if coalesce(char_length(btrim(new.titulo)), 0) < 5 then
      erro := 'Escreva um título com pelo menos 5 letras.'; campo := 'titulo';
    elsif nullif(btrim(new.cidade), '') is null then
      erro := 'Informe a cidade onde está o produto.'; campo := 'cidade';
    elsif new.categoria is null then
      erro := 'Escolha a categoria do anúncio.'; campo := 'categoria';
    end if;
    if erro is not null then
      if pelo_sist then
        -- Ex.: pagamento de anúncio avulso confirmado para um rascunho incompleto.
        -- Não derruba o webhook: continua rascunho e o dono termina e publica.
        new.status := old.status; rigido := false; entrando := false;
      else
        raise exception using errcode = '23514', message = erro, detail = 'campo:' || campo;
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or entrando or new.atributos is distinct from old.atributos
     or new.categoria_id is distinct from old.categoria_id then
    if jsonb_typeof(new.atributos) is distinct from 'object' then
      raise exception 'Os detalhes do anúncio estão num formato inválido.' using errcode = '22023';
    end if;
    if octet_length(new.atributos::text) > 8000 then
      raise exception 'Os detalhes do anúncio estão grandes demais.' using errcode = '22023';
    end if;
    if cat.id is not null then
      if rigido and entrando and pelo_sist then
        begin
          new.atributos := public.normalizar_atributos(cat.campos, new.atributos, true);
        exception when sqlstate '23514' then
          new.status := old.status;
          new.atributos := public.normalizar_atributos(cat.campos, new.atributos, false);
        end;
      else
        new.atributos := public.normalizar_atributos(cat.campos, new.atributos, rigido);
      end if;
    end if;
  end if;

  return new;
end $$;
-- "1" no nome: roda depois de anuncios_0_proteger e antes do limite e da moderação
create trigger anuncios_1_validar before insert or update on public.anuncios
  for each row execute function public.validar_anuncio();

-- Endereço de arquivo aceito: só o Storage do OLAKI (config fotos.origem), bucket 'anuncios',
-- dentro da pasta do dono (p_pasta = 'loja' para logo/capa). Sem '.' ou '..' no caminho.
create or replace function public.foto_do_olaki(p_url text, p_dono text, p_pasta text default null)
returns boolean language plpgsql stable
set search_path = public
as $$
declare
  origem  text := rtrim(public.config('fotos.origem', null, 'null') #>> '{}', '/');
  prefixo text;
  resto   text;
begin
  if p_url is null or p_dono is null or nullif(origem, '') is null or origem !~ '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' then
    return false;
  end if;
  prefixo := origem || '/storage/v1/object/public/anuncios/' || p_dono || '/' || coalesce(p_pasta || '/', '');
  if left(p_url, char_length(prefixo)) <> prefixo then return false; end if;
  resto := substr(p_url, char_length(prefixo) + 1);
  if p_pasta is not null then
    return resto ~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$';                 -- só o nome do arquivo
  end if;
  return resto ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'
     and resto !~ '(^|/)\.\.?(/|$)';
end $$;

-- Fotos: só arquivos do bucket público 'anuncios', na pasta do dono, e o mínimo de fotos
-- (config anuncio.fotos_minimo) sempre que o anúncio está ou entra no ar.
-- Sem SECURITY DEFINER de propósito: acesso_sistema() precisa ver quem chamou.
create or replace function public.validar_fotos_anuncio()
returns trigger language plpgsql
set search_path = public
as $$
declare
  dono    text;
  regiao  uuid;
  foto    text;
  minimo  integer;
  publico boolean := new.status in ('ativo', 'em_analise', 'vendido');
  mudou   boolean := tg_op = 'INSERT' or new.fotos is distinct from old.fotos;
begin
  if public.acesso_sistema() then
    return new;
  end if;
  select v.dono_id, v.microrregiao_id into dono, regiao from public.vitrines_lojas v where v.id = new.vitrine_id;

  if publico and (mudou or old.status not in ('ativo', 'em_analise', 'vendido')) then
    minimo := coalesce(public.numero_ou_nulo(public.config('anuncio.fotos_minimo', regiao, '1')), 0)::int;
    if coalesce(cardinality(new.fotos), 0) < minimo then
      raise exception using errcode = '23514',
        message = case when minimo = 1 then 'Coloque pelo menos 1 foto no anúncio.'
                       else format('Coloque pelo menos %s fotos no anúncio.', minimo) end,
        detail = 'campo:fotos';
    end if;
  end if;

  if not mudou or coalesce(cardinality(new.fotos), 0) = 0 then
    return new;
  end if;
  if nullif(public.config('fotos.origem', null, 'null') #>> '{}', '') is null then
    raise exception using errcode = 'P0001', detail = 'campo:fotos',
      message = 'As fotos ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
  end if;
  foreach foto in array new.fotos loop
    if not coalesce(public.foto_do_olaki(foto, dono), false) then
      raise exception using errcode = '22023', message = 'Use só fotos enviadas pelo OLAKI.', detail = 'campo:fotos';
    end if;
  end loop;
  return new;
end $$;
create trigger anuncios_1_validar_fotos before insert or update of fotos, status on public.anuncios
  for each row execute function public.validar_fotos_anuncio();

-- Logo e capa da loja: mesma regra, na pasta <dono>/loja/
create or replace function public.validar_imagens_vitrine()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if public.acesso_sistema() or (new.logo_url is null and new.capa_url is null) then
    return new;
  end if;
  if nullif(public.config('fotos.origem', null, 'null') #>> '{}', '') is null then
    raise exception using errcode = 'P0001',
      message = 'As imagens ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
  end if;
  if new.logo_url is not null and (tg_op = 'INSERT' or new.logo_url is distinct from old.logo_url)
     and not coalesce(public.foto_do_olaki(new.logo_url, new.dono_id, 'loja'), false) then
    raise exception using errcode = '22023', message = 'Envie a logo pelo botão do OLAKI.', detail = 'campo:logo_url';
  end if;
  if new.capa_url is not null and (tg_op = 'INSERT' or new.capa_url is distinct from old.capa_url)
     and not coalesce(public.foto_do_olaki(new.capa_url, new.dono_id, 'loja'), false) then
    raise exception using errcode = '22023', message = 'Envie a capa pelo botão do OLAKI.', detail = 'campo:capa_url';
  end if;
  return new;
end $$;
create trigger vitrines_1_validar_imagens before insert or update of logo_url, capa_url on public.vitrines_lojas
  for each row execute function public.validar_imagens_vitrine();

-- Rascunhos: no máximo config('anuncio.rascunhos_max') por vendedor (evita lixo e abuso do Storage)
create or replace function public.limitar_rascunhos()
returns trigger language plpgsql
set search_path = public
as $$
declare
  maximo integer;
  total  integer;
begin
  if public.acesso_sistema() or new.status <> 'rascunho' then
    return new;
  end if;
  maximo := public.numero_ou_nulo(public.config('anuncio.rascunhos_max',
                (select v.microrregiao_id from public.vitrines_lojas v where v.id = new.vitrine_id), 'null'))::int;
  if maximo is null then return new; end if;
  select count(*) into total from public.anuncios a where a.vitrine_id = new.vitrine_id and a.status = 'rascunho';
  if total >= maximo then
    raise exception using errcode = 'P0001',
      message = format('Você já tem %s rascunhos guardados. Termine ou apague um antes de começar outro.', total);
  end if;
  return new;
end $$;
create trigger anuncios_1_limitar_rascunhos before insert on public.anuncios
  for each row execute function public.limitar_rascunhos();

-- Campos que só o sistema grava (vendido, publicado) + tipo da vitrine.
-- Nome "v3": roda depois de proteger_*_v2 (ordem alfabética), já com o status final.
create or replace function public.proteger_campos_v3()
returns trigger language plpgsql
set search_path = public
as $$
declare sistema boolean := public.acesso_sistema();
begin
  if tg_table_name = 'vitrines_lojas' then
    if not sistema then
      new.tipo := old.tipo;
      -- pessoa física: o contato é sempre o celular confirmado do perfil (não um número solto)
      if old.tipo = 'pf' then new.whatsapp := old.whatsapp; end if;
    end if;
    return new;
  end if;

  -- anuncios
  if tg_op = 'UPDATE' and not sistema then
    -- 'vendido' é público: só chega lá quem já estava no ar (passou por limite, fotos e moderação)
    if new.status = 'vendido' and old.status not in ('ativo', 'vendido') then
      raise exception 'Só um anúncio que está no ar pode ser marcado como vendido.' using errcode = '42501';
    end if;
    new.vendido_pelo_olaki := old.vendido_pelo_olaki;
    new.vendido_em := old.vendido_em;
    new.publicado_em := old.publicado_em;
  end if;
  if new.status = 'ativo' and new.publicado_em is null then
    new.publicado_em := now();
  end if;
  if new.status = 'vendido' and (tg_op = 'INSERT' or old.status <> 'vendido') then
    new.vendido_em := coalesce(new.vendido_em, now());
  elsif new.status <> 'vendido' and tg_op = 'UPDATE' and old.status = 'vendido' then
    new.vendido_em := null;
    new.vendido_pelo_olaki := null;
  end if;
  return new;
end $$;
create trigger proteger_anuncios_v3 before insert or update on public.anuncios
  for each row execute function public.proteger_campos_v3();
create trigger proteger_vitrines_v3 before update on public.vitrines_lojas
  for each row execute function public.proteger_campos_v3();

-- Cadastro (INSERT): campos de sistema sempre com o valor padrão (versão com os campos novos)
create or replace function public.proteger_insercao()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.e_admin() then
    return new;
  end if;

  if tg_table_name = 'perfis' then
    new.e_admin := false;
    new.selo_negociador_certificado := false;
    new.whatsapp_verificado_em := null;
    new.criado_em := now();
  elsif tg_table_name = 'vitrines_lojas' then
    new.plano := coalesce(public.config('loja.plano_teste', new.microrregiao_id, '"teste"') #>> '{}', 'teste');
    new.status := 'ativa';
    new.tipo := 'loja';
    new.teste_expira_em := now() + make_interval(days => coalesce((public.config('teste.dias', new.microrregiao_id, '30'))::int, 30));
    new.plano_expira_em := null;
    new.gateway_cliente_id := null;
    new.gateway_assinatura_id := null;
    new.selo_loja_verificada := false;
    new.criado_em := now();
  elsif tg_table_name = 'anuncios' then
    if new.status not in ('rascunho', 'ativo') then new.status := 'ativo'; end if;
    new.pago_ate := null;
    new.destaque_ate := null;
    new.visualizacoes := 0;
    new.cliques_whatsapp := 0;
    new.total_favoritos := 0;
    new.congelado_motivo := null;
    new.motivo_analise := null;
    new.vendido_pelo_olaki := null;
    new.vendido_em := null;
    new.publicado_em := null;
    new.criado_em := now();
  elsif tg_table_name = 'radar_pedidos' then
    new.status := 'aberto';
    new.total_propostas := 0;
    new.resumo_enviado_em := null;
    new.motivo_analise := null;
    new.criado_em := now();
  end if;
  return new;
end $$;

-- Moderação: preço mínimo/máximo da categoria (painel) antes da configuração geral.
-- Publicar (rascunho/pausado → ativo) também passa pelo filtro, inclusive quando
-- quem publica é o sistema (anúncio avulso pago). No Radar o sistema continua passando direto.
create or replace function public.filtro_moderacao()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  texto   text;
  palavra text;
  preco   bigint;
  maxp    bigint;
  minp    bigint;
  cmin    bigint;
  cmax    bigint;
  cat     text := new.categoria::text;
begin
  if public.e_admin() then return new; end if;
  if current_setting('olaki.sistema', true) = '1' and tg_table_name <> 'anuncios' then return new; end if;

  if tg_table_name = 'anuncios' then
    texto := public.sem_acento(lower(coalesce(new.titulo, '') || ' ' || coalesce(new.descricao, '')));
    preco := new.preco_centavos;
    if new.categoria_id is not null then
      select c.preco_min_centavos, c.preco_max_centavos into cmin, cmax from public.categorias c where c.id = new.categoria_id;
    end if;
  else
    texto := public.sem_acento(lower(new.titulo || ' ' || coalesce(new.detalhes, '')));
    preco := null;   -- no Radar o preço é o teto do comprador, não filtramos
  end if;

  for palavra in select jsonb_array_elements_text(public.config('moderacao.palavras_bloqueadas', new.microrregiao_id, '[]')) loop
    if texto ~ ('\m' || public.sem_acento(lower(palavra)) || '\M') then
      new.status := 'em_analise';
      new.motivo_analise := format('Palavra bloqueada: "%s"', palavra);
      return new;
    end if;
  end loop;

  if preco is not null then
    maxp := coalesce(cmax, (public.config('moderacao.preco_max_centavos', new.microrregiao_id, '{}') ->> cat)::bigint);
    minp := coalesce(cmin, (public.config('moderacao.preco_min_centavos', new.microrregiao_id, '{}') ->> cat)::bigint);
    if (maxp is not null and preco > maxp) or (minp is not null and preco > 0 and preco < minp) then
      new.status := 'em_analise';
      new.motivo_analise := 'Preço fora do normal para a categoria';
    end if;
  end if;
  return new;
end $$;

-- Edição de texto/preço também é moderada quando o anúncio está vendido (a página continua pública)
drop trigger anuncios_moderacao on public.anuncios;
create trigger anuncios_moderacao before insert or update of titulo, descricao, preco_centavos on public.anuncios
  for each row when (new.status in ('ativo', 'vendido')) execute function public.filtro_moderacao();

create trigger anuncios_moderacao_publicar before update of status on public.anuncios
  for each row when (old.status in ('rascunho', 'pausado', 'expirado', 'vendido') and new.status = 'ativo')
  execute function public.filtro_moderacao();

-- Log: contadores (visualizações, cliques, favoritos) não geram registro a cada clique
drop trigger log_anuncios on public.anuncios;
create trigger log_anuncios after insert or delete on public.anuncios
  for each row execute function public.registrar_log();
create trigger log_anuncios_alteracao after update on public.anuncios
  for each row when (
    (to_jsonb(old) - array['visualizacoes', 'cliques_whatsapp', 'total_favoritos', 'atualizado_em'])
      is distinct from
    (to_jsonb(new) - array['visualizacoes', 'cliques_whatsapp', 'total_favoritos', 'atualizado_em']))
  execute function public.registrar_log();

-- ---------------------------------------------------------------------
-- 4. Favoritos: só anúncio que a pessoa consegue ver e que está no ar
-- ---------------------------------------------------------------------
drop policy "favoritos proprios" on public.favoritos;
create policy "favoritos leitura" on public.favoritos
  for select using (usuario_id = public.usuario_id());
create policy "favoritos criar" on public.favoritos
  for insert with check (
    usuario_id = public.usuario_id()
    and exists (select 1 from public.anuncios a where a.id = anuncio_id and a.status = 'ativo'));
create policy "favoritos excluir" on public.favoritos
  for delete using (usuario_id = public.usuario_id());
revoke update, truncate on public.favoritos from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Quero vender (PF ou loja)
-- ---------------------------------------------------------------------
create type public.vendedor_resumo as (
  vitrine_id      uuid,
  tipo            text,
  slug            text,
  nome            text,
  plano           text,
  teste_expira_em timestamptz,
  plano_expira_em timestamptz
);

create or replace function public.slug_disponivel(slug text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select lower(btrim(coalesce(slug_disponivel.slug, ''))) ~ '^[a-z0-9-]{3,60}$'
     and not exists (
       select 1 from public.vitrines_lojas v
        where v.slug = lower(btrim(slug_disponivel.slug))
          and v.dono_id is distinct from public.usuario_id())
$$;
revoke all on function public.slug_disponivel(text) from public;
grant execute on function public.slug_disponivel(text) to anon, authenticated;

create or replace function public.quero_vender(
  tipo text, nome_loja text default null, slug text default null,
  whatsapp text default null, cidade text default null)
returns public.vendedor_resumo
language plpgsql security definer
set search_path = public
as $$
declare
  uid      text := public.usuario_id();
  v_tipo   text := lower(btrim(coalesce(quero_vender.tipo, '')));
  v_nome   text := btrim(coalesce(quero_vender.nome_loja, ''));
  v_slug   text := lower(btrim(coalesce(quero_vender.slug, '')));
  v_fone   text := regexp_replace(coalesce(quero_vender.whatsapp, ''), '[^0-9]', '', 'g');
  v_cidade text := nullif(btrim(coalesce(quero_vender.cidade, '')), '');
  pf       public.perfis;
  v        public.vitrines_lojas;
  sede     text;
  dias     integer;
  plano_pf text;
  plano_teste text;
  tentativa integer := 0;
  r        public.vendedor_resumo;
begin
  if uid is null then
    raise exception 'Faça login para vender.' using errcode = '28000';
  end if;
  select * into pf from public.perfis where id = uid;
  if pf.id is null then
    raise exception 'Complete seu cadastro antes de vender.' using errcode = 'P0001';
  end if;
  if v_tipo not in ('pf', 'loja') then
    raise exception 'Escolha como você quer vender: suas coisas ou sua loja.' using errcode = '22023';
  end if;

  select * into v from public.vitrines_lojas where dono_id = uid for update;
  if v.id is not null and v.status = 'suspensa' then
    raise exception 'Sua conta de vendedor está suspensa. Fale com o suporte.' using errcode = '42501';
  end if;
  select m.cidade_sede into sede from public.microrregioes m where m.id = pf.microrregiao_id;
  v_cidade := coalesce(v_cidade, v.cidade, pf.cidade, sede);

  if v_tipo = 'pf' then
    if v.id is null then
      if v_cidade is null then
        raise exception using errcode = '23514', message = 'Informe sua cidade.', detail = 'campo:cidade';
      end if;
      plano_pf := public.config('pf.plano_inicial', pf.microrregiao_id, '"pf_gratis"') #>> '{}';
      loop
        -- endereço interno (a pessoa física não tem página de loja)
        v_slug := 'pf-' || substr(md5(uid || tentativa::text), 1, 12);
        exit when not exists (select 1 from public.vitrines_lojas x where x.slug = v_slug);
        tentativa := tentativa + 1;
      end loop;
      insert into public.vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, bairro, whatsapp,
                                         tipo, plano, status, teste_expira_em)
      -- pessoa física aparece só pelo primeiro nome e sem bairro (privacidade)
      values (uid, pf.microrregiao_id, v_slug, left(split_part(btrim(pf.nome), ' ', 1), 80), v_cidade, null, null,
              'pf', plano_pf, 'ativa', now())
      returning * into v;
    end if;
    -- já vende (como PF ou loja): nada muda
  else
    -- loja
    if char_length(v_nome) not between 2 and 80 then
      raise exception using errcode = '23514', message = 'Escreva o nome da loja (de 2 a 80 letras).', detail = 'campo:nome_loja';
    end if;
    if v_slug !~ '^[a-z0-9-]{3,60}$' then
      raise exception using errcode = '23514',
        message = 'O endereço da loja deve ter de 3 a 60 letras minúsculas, números ou hífen, sem espaço nem acento.',
        detail = 'campo:slug';
    end if;
    if exists (select 1 from public.vitrines_lojas x where x.slug = v_slug and x.dono_id <> uid) then
      raise exception using errcode = '23505',
        message = format('O endereço olaki.com.br/loja/%s já está em uso. Escolha outro.', v_slug), detail = 'campo:slug';
    end if;
    if v_fone = '' then
      v_fone := coalesce(v.whatsapp, pf.whatsapp, '');
    elsif v_fone ~ '^[1-9][0-9]9?[0-9]{8}$' then
      v_fone := '55' || v_fone;            -- veio sem o 55
    end if;
    if v_fone = '' then
      raise exception using errcode = '23514', message = 'Informe o WhatsApp da loja.', detail = 'campo:whatsapp';
    end if;
    if v_fone !~ '^55[1-9][0-9]9?[0-9]{8}$' then
      raise exception using errcode = '23514', message = 'WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.', detail = 'campo:whatsapp';
    end if;
    if v_cidade is null then
      raise exception using errcode = '23514', message = 'Informe a cidade da loja.', detail = 'campo:cidade';
    end if;
    dias := coalesce((public.config('teste.dias', pf.microrregiao_id, '30') #>> '{}')::int, 30);
    plano_teste := coalesce(public.config('loja.plano_teste', pf.microrregiao_id, '"teste"') #>> '{}', 'teste');

    begin
      if v.id is null then
        insert into public.vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, bairro, whatsapp,
                                           tipo, plano, status, teste_expira_em)
        values (uid, pf.microrregiao_id, v_slug, v_nome, v_cidade, pf.bairro, v_fone,
                'loja', plano_teste, 'ativa', now() + make_interval(days => dias))
        returning * into v;
      elsif v.tipo = 'pf' then
        -- pessoa vira loja sem perder os anúncios; começa o teste grátis
        -- (se estiver num plano pago em dia, mantém o plano)
        update public.vitrines_lojas x
           set tipo = 'loja', nome = v_nome, slug = v_slug, whatsapp = v_fone, cidade = v_cidade,
               plano = case when coalesce((public.plano_efetivo(v)).preco_centavos, 0) = 0 then plano_teste else x.plano end,
               teste_expira_em = case when coalesce((public.plano_efetivo(v)).preco_centavos, 0) = 0
                                      then now() + make_interval(days => dias) else x.teste_expira_em end
         where x.id = v.id
        returning * into v;
      else
        -- já é loja: só atualiza os dados (não reinicia o teste)
        update public.vitrines_lojas x
           set nome = v_nome, slug = v_slug, whatsapp = v_fone, cidade = v_cidade
         where x.id = v.id
        returning * into v;
      end if;
    exception when unique_violation then
      raise exception using errcode = '23505',
        message = format('O endereço olaki.com.br/loja/%s já está em uso. Escolha outro.', v_slug), detail = 'campo:slug';
    end;
  end if;

  r := (v.id, v.tipo, v.slug, v.nome, v.plano, v.teste_expira_em, v.plano_expira_em);
  return r;
end $$;
revoke all on function public.quero_vender(text, text, text, text, text) from public, anon;
grant execute on function public.quero_vender(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Publicar e marcar como vendido
-- ---------------------------------------------------------------------
create or replace function public.publicar_anuncio(anuncio_id uuid)
returns text language plpgsql security definer
set search_path = public
as $$
declare
  a      public.anuncios;
  dono   text;
  minimo integer;
  novo   public.status_anuncio;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para publicar.' using errcode = '28000';
  end if;
  select * into a from public.anuncios x where x.id = publicar_anuncio.anuncio_id for update;
  select v.dono_id into dono from public.vitrines_lojas v where v.id = a.vitrine_id;
  if a.id is null or dono is distinct from public.usuario_id() then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status in ('ativo', 'em_analise') then
    return a.status::text;                     -- já publicado (chamada repetida)
  end if;
  if a.status not in ('rascunho', 'pausado', 'expirado') then
    raise exception 'Este anúncio não pode ser publicado.' using errcode = '42501';
  end if;
  if a.categoria_id is null then
    raise exception using errcode = '23514', message = 'Escolha a categoria do anúncio.', detail = 'campo:categoria';
  end if;
  minimo := coalesce((public.config('anuncio.fotos_minimo', a.microrregiao_id, '1') #>> '{}')::int, 0);
  if cardinality(a.fotos) < minimo then
    raise exception using errcode = '23514',
      message = case when minimo = 1 then 'Coloque pelo menos 1 foto no anúncio.'
                     else format('Coloque pelo menos %s fotos no anúncio.', minimo) end,
      detail = 'campo:fotos';
  end if;
  -- os gatilhos conferem limite do plano, campos obrigatórios e moderação
  update public.anuncios x set status = 'ativo' where x.id = a.id returning x.status into novo;
  return novo::text;
end $$;
revoke all on function public.publicar_anuncio(uuid) from public, anon;
grant execute on function public.publicar_anuncio(uuid) to authenticated;

create or replace function public.marcar_vendido(anuncio_id uuid, pelo_olaki boolean default null)
returns text language plpgsql security definer
set search_path = public
as $$
declare
  a    public.anuncios;
  dono text;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  select * into a from public.anuncios x where x.id = marcar_vendido.anuncio_id for update;
  select v.dono_id into dono from public.vitrines_lojas v where v.id = a.vitrine_id;
  if a.id is null or dono is distinct from public.usuario_id() then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status not in ('ativo', 'vendido') then
    raise exception 'Só um anúncio que está no ar pode ser marcado como vendido.' using errcode = '42501';
  end if;
  update public.anuncios x
     set status = 'vendido',
         vendido_pelo_olaki = coalesce(marcar_vendido.pelo_olaki, x.vendido_pelo_olaki),
         vendido_em = coalesce(x.vendido_em, now())
   where x.id = a.id;
  return 'vendido';
end $$;
revoke all on function public.marcar_vendido(uuid, boolean) from public, anon;
grant execute on function public.marcar_vendido(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Busca
-- ---------------------------------------------------------------------
create type public.anuncio_card as (
  id              uuid,
  titulo          text,
  preco_centavos  bigint,
  aceita_troca    boolean,
  cidade          text,
  bairro          text,
  capa            text,
  atributos       jsonb,
  criado_em       timestamptz,     -- quando foi publicado (publicado_em; se não houver, criado_em)
  categoria_slug  text,
  categoria_nome  text,
  vitrine_nome    text,
  vitrine_slug    text,
  vitrine_selo    boolean,
  vitrine_tipo    text,
  destaque        boolean,
  total           bigint
);

create or replace function public.buscar_anuncios(
  q                 text    default null,
  categoria_slug    text    default null,
  cidade            text    default null,
  preco_min         bigint  default null,
  preco_max         bigint  default null,
  filtros           jsonb   default null,
  ordem             text    default 'relevancia',
  microrregiao_slug text    default null,
  limite            integer default 24,
  deslocamento      integer default 0)
returns setof public.anuncio_card
language sql stable security definer
set search_path = public, extensions
as $$
  with par as (
    select nullif(btrim(buscar_anuncios.q), '')                                  as termo,
           nullif(btrim(buscar_anuncios.categoria_slug), '')                     as cat_slug,
           nullif(public.sem_acento(lower(btrim(buscar_anuncios.cidade))), '')   as cidade_n,
           nullif(btrim(buscar_anuncios.microrregiao_slug), '')                  as reg_slug,
           case when buscar_anuncios.ordem in ('relevancia', 'recentes', 'menor_preco', 'maior_preco')
                then buscar_anuncios.ordem else 'relevancia' end                 as ord,
           coalesce(public.numero_ou_nulo(public.config('busca.similaridade_minima', null, '0.45')), 0.45)::real as sim_min,
           case when jsonb_typeof(buscar_anuncios.filtros) = 'object' then buscar_anuncios.filtros else '{}'::jsonb end as filt,
           to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDD')           as dia
  ),
  consulta as (
    select par.*,
           case when par.termo is not null then websearch_to_tsquery('portuguese', public.sem_acento(par.termo)) end as tsq,
           public.sem_acento(lower(par.termo)) as termo_n,
           (select m.id from public.microrregioes m where m.slug = par.reg_slug) as reg_id
      from par
  ),
  cats as (
    select c.id from public.categorias c, consulta
     where consulta.cat_slug is not null
       and (c.slug = consulta.cat_slug
            or c.pai_id in (select c2.id from public.categorias c2 where c2.slug = consulta.cat_slug))
  ),
  achados as (
    select a.*, consulta.ord, consulta.dia,
           case when consulta.termo is null then 0
                else ts_rank(a.busca, consulta.tsq)
                     + extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, ''))))
           end as rel,
           coalesce(a.destaque_ate > now(), false) as em_destaque
      from public.anuncios a
      cross join consulta
     where a.status = 'ativo'
       and (consulta.reg_slug is null or a.microrregiao_id = consulta.reg_id)
       and (consulta.cat_slug is null or a.categoria_id in (select cats.id from cats))
       and (consulta.cidade_n is null or public.sem_acento(lower(a.cidade)) = consulta.cidade_n)
       and (buscar_anuncios.preco_min is null or a.preco_centavos >= buscar_anuncios.preco_min)
       and (buscar_anuncios.preco_max is null or a.preco_centavos <= buscar_anuncios.preco_max)
       and (consulta.termo is null
            or a.busca @@ consulta.tsq
            or extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, '')))) >= consulta.sim_min)
       and not exists (
         select 1 from jsonb_each(consulta.filt) f
          where jsonb_typeof(f.value) <> 'null'
            and not (
              case
                when jsonb_typeof(f.value) = 'object' then
                  public.numero_ou_nulo(a.atributos->f.key) is not null
                  and (public.numero_ou_nulo(f.value->'min') is null
                       or public.numero_ou_nulo(a.atributos->f.key) >= public.numero_ou_nulo(f.value->'min'))
                  and (public.numero_ou_nulo(f.value->'max') is null
                       or public.numero_ou_nulo(a.atributos->f.key) <= public.numero_ou_nulo(f.value->'max'))
                when jsonb_typeof(f.value) = 'array' then
                  exists (select 1 from jsonb_array_elements(f.value) e
                           where public.sem_acento(lower(e #>> '{}')) = public.sem_acento(lower(a.atributos->>f.key)))
                else
                  coalesce(public.sem_acento(lower(a.atributos->>f.key)) = public.sem_acento(lower(f.value #>> '{}')), false)
              end))
  )
  select x.id, x.titulo, x.preco_centavos, x.aceita_troca, x.cidade, x.bairro,
         x.fotos[1], x.atributos, coalesce(x.publicado_em, x.criado_em),
         c.slug, c.nome, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.slug, v.selo_loja_verificada, v.tipo,
         x.em_destaque, count(*) over ()
    from achados x
    join public.vitrines_lojas v on v.id = x.vitrine_id and v.status = 'ativa'
    left join public.categorias c on c.id = x.categoria_id
   order by x.em_destaque desc,
            case when x.em_destaque then md5(x.id::text || x.dia) end,     -- rodízio justo entre quem pagou (muda a cada dia)
            case when x.ord = 'menor_preco' then x.preco_centavos end asc nulls last,
            case when x.ord = 'maior_preco' then x.preco_centavos end desc nulls last,
            case when x.ord = 'relevancia' then x.rel end desc,
            coalesce(x.publicado_em, x.criado_em) desc,
            x.id
   limit least(greatest(coalesce(buscar_anuncios.limite, 24), 1), 48)
  offset greatest(coalesce(buscar_anuncios.deslocamento, 0), 0)
$$;
revoke all on function public.buscar_anuncios(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) from public;
grant execute on function public.buscar_anuncios(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) to anon, authenticated;

-- Dica de preço do passo 4: "Parecidos na região: R$ X a R$ Y" (dos anúncios reais)
create or replace function public.faixa_preco_regiao(categoria_id uuid, microrregiao_id uuid default null)
returns table (minimo bigint, maximo bigint, quantidade integer)
language sql stable security definer
set search_path = public
as $$
  with dados as (
    select a.preco_centavos as p
      from public.anuncios a
     where a.status = 'ativo'
       and a.categoria_id = faixa_preco_regiao.categoria_id
       and (faixa_preco_regiao.microrregiao_id is null or a.microrregiao_id = faixa_preco_regiao.microrregiao_id)
       and a.preco_centavos > 0
  ), agg as (
    select count(*)::int as n,
           percentile_cont(0.25) within group (order by p) as p25,
           percentile_cont(0.75) within group (order by p) as p75
      from dados
  ), corte as (
    select coalesce(public.numero_ou_nulo(public.config('busca.faixa_preco_minimo_anuncios',
                                                        faixa_preco_regiao.microrregiao_id, '3')), 3) as m
  )
  select case when agg.n >= corte.m then round(agg.p25)::bigint end,
         case when agg.n >= corte.m then round(agg.p75)::bigint end,
         agg.n
    from agg, corte
$$;
revoke all on function public.faixa_preco_regiao(uuid, uuid) from public;
grant execute on function public.faixa_preco_regiao(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Página pública do anúncio
-- ---------------------------------------------------------------------
create type public.anuncio_detalhe as (
  id                    uuid,
  titulo                text,
  descricao             text,
  preco_centavos        bigint,
  aceita_troca          boolean,
  cidade                text,
  bairro                text,
  fotos                 text[],
  atributos             jsonb,
  status                text,
  criado_em             timestamptz,   -- publicado_em (ou criado_em)
  vendido_em            timestamptz,
  destaque              boolean,
  visualizacoes         integer,
  total_favoritos       integer,
  microrregiao_id       uuid,
  categoria_id          uuid,
  categoria_slug        text,
  categoria_nome        text,
  categoria_icone       text,
  categoria_pai_slug    text,
  categoria_pai_nome    text,
  campos                jsonb,
  vitrine_id            uuid,
  vitrine_slug          text,
  vitrine_nome          text,
  vitrine_tipo          text,
  vitrine_logo_url      text,
  vitrine_selo          boolean,
  vitrine_desde         timestamptz,
  vendedor_certificado  boolean,
  whatsapp              text,
  e_dono                boolean
);

-- Visitante: só anúncio 'ativo' ou 'vendido' de vendedor ativo.
-- Dono e admin: qualquer status (prévia do passo "Revisar").
-- WhatsApp de contato (o produto é "Chamar no WhatsApp"): loja → WhatsApp da loja;
-- pessoa física → só o celular confirmado do perfil. Só sai para 'ativo'. Nunca CNPJ.
-- Pessoa física aparece só pelo primeiro nome.
create or replace function public.anuncio_publico(anuncio_id uuid)
returns setof public.anuncio_detalhe
language sql stable security definer
set search_path = public
as $$
  select a.id, a.titulo, a.descricao, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
         a.fotos, a.atributos, a.status::text, coalesce(a.publicado_em, a.criado_em), a.vendido_em,
         coalesce(a.destaque_ate > now(), false), a.visualizacoes, a.total_favoritos, a.microrregiao_id,
         c.id, c.slug, c.nome, c.icone, cp.slug, cp.nome, coalesce(c.campos, '[]'::jsonb),
         v.id, v.slug, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.tipo, v.logo_url, v.selo_loja_verificada, v.criado_em,
         pf.selo_negociador_certificado,
         case when a.status = 'ativo' then
           case when v.tipo = 'loja'
                then coalesce(v.whatsapp, case when pf.whatsapp_verificado_em is not null then pf.whatsapp end)
                else case when pf.whatsapp_verificado_em is not null then pf.whatsapp end
           end
         end,
         (v.dono_id = public.usuario_id())
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    join public.perfis pf on pf.id = v.dono_id
    left join public.categorias c on c.id = a.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   where a.id = anuncio_publico.anuncio_id
     and ((a.status in ('ativo', 'vendido') and v.status = 'ativa')
          or v.dono_id = public.usuario_id()
          or public.e_admin())
$$;
revoke all on function public.anuncio_publico(uuid) from public;
grant execute on function public.anuncio_publico(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Eventos do anúncio (visualização, clique no WhatsApp, compartilhar)
--    Sem dados pessoais: só um resumo (hash) diário do visitante para não
--    contar a mesma pessoa várias vezes seguidas.
-- ---------------------------------------------------------------------
create table public.eventos_anuncio (
  id              bigint generated always as identity primary key,
  anuncio_id      uuid not null references public.anuncios(id) on delete cascade,
  tipo            text not null check (tipo in ('visualizacao', 'clique_whatsapp', 'compartilhar')),
  visitante_hash  text,
  criado_em       timestamptz not null default now()
);
create index eventos_anuncio_idx on public.eventos_anuncio (anuncio_id, tipo, criado_em desc);
create index eventos_criado_idx  on public.eventos_anuncio (criado_em);
alter table public.eventos_anuncio enable row level security;
create policy "eventos leitura" on public.eventos_anuncio for select using (
  public.e_admin() or exists (
    select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = anuncio_id and v.dono_id = public.usuario_id()));
revoke all on public.eventos_anuncio from anon, authenticated;
grant select on public.eventos_anuncio to authenticated;

-- Quem conta como "o mesmo visitante": IP (+ usuário logado). O navegador (user-agent) NÃO
-- entra: o visitante muda à vontade e inflaria os números. O servidor do site (service_role)
-- pode informar o visitante e o usuário de verdade, porque ele chama em nome do visitante.
create or replace function public.registrar_evento(anuncio_id uuid, tipo text, visitante text default null, usuario text default null)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  a        record;
  servidor boolean := coalesce(auth.role(), '') = 'service_role';
  ip       inet := public.ip_requisicao();
  uid      text;
  chave    text;
  h        text;
  janela   integer;
begin
  if coalesce(registrar_evento.tipo, '') not in ('visualizacao', 'clique_whatsapp', 'compartilhar') then
    return false;                                   -- tipo desconhecido: ignora
  end if;
  uid := case when servidor then nullif(btrim(registrar_evento.usuario), '') else public.usuario_id() end;
  chave := case when servidor and nullif(btrim(registrar_evento.visitante), '') is not null
                then 'v:' || left(btrim(registrar_evento.visitante), 200)
                else host(ip) end;
  select x.id, x.status, x.microrregiao_id, v.dono_id into a
    from public.anuncios x join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = registrar_evento.anuncio_id;
  if a.id is null or a.status <> 'ativo' then return false; end if;
  if a.dono_id = uid then return false; end if;       -- o próprio vendedor não conta

  if chave is not null or uid is not null then
    h := left(encode(sha256(convert_to(
           coalesce(chave, '') || '|' || coalesce(uid, '') || '|' || current_date::text, 'UTF8')), 'hex'), 32);
    janela := coalesce(public.numero_ou_nulo(public.config('eventos.repetir_apos_minutos', a.microrregiao_id, '30')), 30)::int;
    if exists (select 1 from public.eventos_anuncio e
                where e.anuncio_id = a.id and e.tipo = registrar_evento.tipo and e.visitante_hash = h
                  and e.criado_em > now() - make_interval(mins => janela)) then
      return false;
    end if;
  end if;

  insert into public.eventos_anuncio (anuncio_id, tipo, visitante_hash) values (a.id, registrar_evento.tipo, h);
  if registrar_evento.tipo in ('visualizacao', 'clique_whatsapp') then
    perform set_config('olaki.sistema', '1', true);   -- libera contador protegido
    update public.anuncios x
       set visualizacoes    = x.visualizacoes    + case when registrar_evento.tipo = 'visualizacao'    then 1 else 0 end,
           cliques_whatsapp = x.cliques_whatsapp + case when registrar_evento.tipo = 'clique_whatsapp' then 1 else 0 end
     where x.id = a.id;
    perform set_config('olaki.sistema', '', true);
  end if;
  return true;
end $$;
revoke all on function public.registrar_evento(uuid, text, text, text) from public;
grant execute on function public.registrar_evento(uuid, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10. Fotos (Supabase Storage): bucket público 'anuncios'
--     Caminho: <usuario_id>/<anuncio_id>/<arquivo> ou <usuario_id>/loja/<arquivo>.
--     Cada um só envia para a própria pasta, de um anúncio seu (ou da sua loja), e com
--     limite de arquivos por pasta (config fotos.max_por_pasta).
--     Ninguém lista o bucket dos outros: o endereço público da foto funciona sem policy de leitura.
--     (No banco de teste local não existe o schema storage: o bloco é pulado.)
-- ---------------------------------------------------------------------
create or replace function public.pode_enviar_foto(nome text)
returns boolean language plpgsql stable security definer
set search_path = public
as $$
declare
  uid    text := public.usuario_id();
  partes text[] := string_to_array(coalesce(pode_enviar_foto.nome, ''), '/');
  regiao uuid;
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
revoke all on function public.pode_enviar_foto(text) from public, anon;
grant execute on function public.pode_enviar_foto(text) to authenticated, service_role;

do $$
declare
  tamanho bigint := coalesce(public.numero_ou_nulo(public.config('fotos.tamanho_max_bytes', null, '5242880')), 5242880)::bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $q$insert into storage.buckets (id, name, public) values ('anuncios', 'anuncios', true)
               on conflict (id) do update set public = true$q$;
    if exists (select 1 from information_schema.columns
                where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
      execute format('update storage.buckets set file_size_limit = %s where id = %L', tamanho, 'anuncios');
    end if;
    if exists (select 1 from information_schema.columns
                where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
      execute $q$update storage.buckets set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'] where id = 'anuncios'$q$;
    end if;

    execute 'drop policy if exists "anuncios fotos leitura" on storage.objects';
    execute 'drop policy if exists "anuncios fotos enviar" on storage.objects';
    execute 'drop policy if exists "anuncios fotos trocar" on storage.objects';
    execute 'drop policy if exists "anuncios fotos apagar" on storage.objects';
    -- leitura pela API só da própria pasta (necessária para apagar); o público usa o endereço da foto
    execute $q$create policy "anuncios fotos leitura" on storage.objects
               for select to authenticated
               using (bucket_id = 'anuncios' and (storage.foldername(name))[1] = public.usuario_id())$q$;
    execute $q$create policy "anuncios fotos enviar" on storage.objects
               for insert to authenticated
               with check (bucket_id = 'anuncios' and public.pode_enviar_foto(name))$q$;
    execute $q$create policy "anuncios fotos trocar" on storage.objects
               for update to authenticated
               using (bucket_id = 'anuncios' and (storage.foldername(name))[1] = public.usuario_id())
               with check (bucket_id = 'anuncios' and (storage.foldername(name))[1] = public.usuario_id())$q$;
    execute $q$create policy "anuncios fotos apagar" on storage.objects
               for delete to authenticated
               using (bucket_id = 'anuncios' and (storage.foldername(name))[1] = public.usuario_id())$q$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 11. Meu plano (a tela "Minha conta" usa o mesmo cálculo do banco, inclusive
--     quando o plano contratado deixou de ser vendido: planos.ativo = false)
-- ---------------------------------------------------------------------
create or replace function public.meu_plano()
returns table (codigo text, nome text, descricao text, publico text, preco_centavos integer,
               periodo_dias integer, limite_anuncios integer, acesso_radar boolean,
               propostas_radar_mes integer, e_teste boolean, ordem integer)
language sql stable security definer
set search_path = public
as $$
  select p.codigo, p.nome, p.descricao, p.publico::text, p.preco_centavos, p.periodo_dias, p.limite_anuncios,
         p.acesso_radar, p.propostas_radar_mes, p.e_teste, p.ordem
    from public.vitrines_lojas v
    cross join lateral public.plano_efetivo(v) p
   where v.dono_id = public.usuario_id() and p.codigo is not null
$$;
revoke all on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;

-- ---------------------------------------------------------------------
-- 12. Endurecimento (mesma regra do Security Advisor): search_path fixo em toda
--     função do schema public e gatilhos fora da API. Pode rodar de novo sem problema.
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
-- Funções auxiliares novas: visitante não precisa chamar direto
revoke execute on function public.validar_campos_categoria(jsonb) from public, anon;
revoke execute on function public.normalizar_atributos(jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.foto_do_olaki(text, text, text) from public, anon;
grant execute on function public.validar_campos_categoria(jsonb), public.normalizar_atributos(jsonb, jsonb, boolean),
  public.foto_do_olaki(text, text, text) to authenticated, service_role;
