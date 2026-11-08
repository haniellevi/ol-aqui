-- =====================================================================
-- OLAKI · Painel: Regiões e cidades (tela 7) e Categorias e campos (tela 9)
-- Base: PAINEL-ADMIN.md (telas 7 e 9), PRODUTO-CONTAS-ANUNCIOS-ROBO.md (seção 3)
-- e docs/etapa5/cadastros.md.
-- As tabelas já existem (microrregioes, cidades, categorias). Aqui entram as regras
-- que o painel precisa para editar sem quebrar nada:
--  * cidade/região/categoria em uso nunca é apagada (mensagem clara, vale até pela API)
--  * cidade inativa some das listas, mas o histórico fica
--  * campos da categoria sempre válidos para o cadastro e a busca
--  * toda mudança no histórico (logs_atividade)
-- Nada fica no código: limites novos vêm de configuracoes (painel).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configurações novas (editáveis em Configurações > Anúncios)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('categorias.campos_max', '20', 'anuncios', false, 'Máximo de campos que uma subcategoria pode pedir no anúncio'),
  ('categorias.opcoes_max', '60', 'anuncios', false, 'Máximo de opções num campo do tipo lista')
on conflict do nothing;

-- Mesma comparação de nomes em todo lugar: sem acento, minúscula, espaços limpos.
create or replace function public.nome_comparavel(p text)
returns text language sql immutable parallel safe
set search_path = public, extensions
as $$ select public.sem_acento(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))) $$;

-- ---------------------------------------------------------------------
-- 1. Cidades
-- ---------------------------------------------------------------------

-- Quanto uma cidade é usada (anúncios em qualquer status, lojas/vendedores, pessoas, pedidos do Radar).
-- A cidade fica guardada pelo nome nessas tabelas: por isso cidade usada não muda de nome nem sai.
create or replace function public.uso_cidade(p_regiao uuid, p_nome text)
returns table (anuncios integer, lojas integer, pessoas integer, pedidos integer)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    (select count(*)::int from public.anuncios a
      where a.microrregiao_id = p_regiao and public.nome_comparavel(a.cidade) = public.nome_comparavel(p_nome)),
    (select count(*)::int from public.vitrines_lojas v
      where v.microrregiao_id = p_regiao and public.nome_comparavel(v.cidade) = public.nome_comparavel(p_nome)),
    (select count(*)::int from public.perfis p
      where p.microrregiao_id = p_regiao and public.nome_comparavel(p.cidade) = public.nome_comparavel(p_nome)),
    (select count(*)::int from public.radar_pedidos r
      where r.microrregiao_id = p_regiao and public.nome_comparavel(r.cidade) = public.nome_comparavel(p_nome))
$$;

-- Texto "3 anúncios, 1 loja" para as mensagens
create or replace function public.texto_uso_cidade(p_regiao uuid, p_nome text)
returns text language sql stable
set search_path = public, extensions
as $$
  select nullif(concat_ws(', ',
           case when u.anuncios > 0 then u.anuncios || case when u.anuncios = 1 then ' anúncio' else ' anúncios' end end,
           case when u.lojas    > 0 then u.lojas    || case when u.lojas = 1    then ' vendedor' else ' vendedores' end end,
           case when u.pessoas  > 0 then u.pessoas  || case when u.pessoas = 1  then ' pessoa' else ' pessoas' end end,
           case when u.pedidos  > 0 then u.pedidos  || case when u.pedidos = 1  then ' pedido no Radar' else ' pedidos no Radar' end end), '')
    from public.uso_cidade(p_regiao, p_nome) u
$$;

create or replace function public.e_sede(p_regiao uuid, p_nome text)
returns boolean language sql stable
set search_path = public, extensions
as $$
  select exists (select 1 from public.microrregioes m
                  where m.id = p_regiao and public.nome_comparavel(m.cidade_sede) = public.nome_comparavel(p_nome))
$$;

create or replace function public.validar_cidade()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  outra text;
  uso   text;
begin
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  new.uf := upper(btrim(coalesce(new.uf, '')));
  if char_length(new.nome) not between 2 and 80 then
    raise exception using errcode = '23514', message = 'O nome da cidade precisa ter de 2 a 80 letras.', detail = 'campo:nome';
  end if;
  if new.uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI',
                    'RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
    raise exception using errcode = '23514', message = 'Escolha o estado (UF) da cidade.', detail = 'campo:uf';
  end if;

  if tg_op = 'UPDATE' then
    if new.microrregiao_id is distinct from old.microrregiao_id then
      raise exception using errcode = '22023',
        message = 'Cidade não muda de região. Desative aqui e adicione na outra região.';
    end if;
    if public.nome_comparavel(new.nome) <> public.nome_comparavel(old.nome) or new.uf <> old.uf then
      if public.e_sede(old.microrregiao_id, old.nome) then
        raise exception using errcode = '23514', detail = 'campo:nome',
          message = 'Esta cidade é a sede da região. Escolha outra sede antes de mudar o nome.';
      end if;
      uso := public.texto_uso_cidade(old.microrregiao_id, old.nome);
      if uso is not null then
        raise exception using errcode = '23514', detail = 'campo:nome',
          message = format('Não dá para mudar o nome: %s usam "%s". Desative e adicione a cidade com o nome certo.', uso, old.nome);
      end if;
    end if;
    if old.ativa and not new.ativa and public.e_sede(old.microrregiao_id, old.nome) then
      raise exception using errcode = '23514',
        message = 'Esta cidade é a sede da região. Escolha outra sede antes de desativar.';
    end if;
  end if;

  -- a mesma cidade não fica em duas regiões (o visitante escolhe a cidade e cai na região dela)
  if tg_op = 'INSERT' or public.nome_comparavel(new.nome) <> public.nome_comparavel(old.nome) or new.uf <> old.uf then
    select m.nome into outra
      from public.cidades c join public.microrregioes m on m.id = c.microrregiao_id
     where c.id <> new.id and c.uf = new.uf and public.nome_comparavel(c.nome) = public.nome_comparavel(new.nome)
     limit 1;
    if outra is not null then
      raise exception using errcode = '23505', detail = 'campo:nome',
        message = format('%s-%s já está na região "%s".', new.nome, new.uf, outra);
    end if;
  end if;
  return new;
end $$;
create trigger cidades_validar before insert or update on public.cidades
  for each row execute function public.validar_cidade();

create or replace function public.impedir_apagar_cidade()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare uso text;
begin
  -- sede: só conta se a região ainda existe (apagar região vazia leva as cidades junto)
  if public.e_sede(old.microrregiao_id, old.nome) then
    raise exception using errcode = 'P0001',
      message = format('%s é a sede da região. Escolha outra sede antes de remover.', old.nome);
  end if;
  uso := public.texto_uso_cidade(old.microrregiao_id, old.nome);
  if uso is not null then
    raise exception using errcode = 'P0001',
      message = format('Não dá para remover %s: tem %s. Desative a cidade: ela some das listas e o histórico fica guardado.', old.nome, uso);
  end if;
  return old;
end $$;
create trigger cidades_impedir_apagar before delete on public.cidades
  for each row execute function public.impedir_apagar_cidade();

create trigger log_cidades after insert or update or delete on public.cidades
  for each row execute function public.registrar_log();

-- ---------------------------------------------------------------------
-- 2. Microrregiões
-- ---------------------------------------------------------------------
create or replace function public.validar_microrregiao()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare sede text;
begin
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 80 then
    raise exception using errcode = '23514', message = 'O nome da região precisa ter de 2 a 80 letras.', detail = 'campo:nome';
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception using errcode = '22023',
      message = 'O endereço interno da região não muda depois de criado (o site usa ele). Mude só o nome.';
  end if;
  new.cidade_sede := nullif(regexp_replace(btrim(coalesce(new.cidade_sede, '')), '\s+', ' ', 'g'), '');
  if new.cidade_sede is not null and (tg_op = 'INSERT' or new.cidade_sede is distinct from old.cidade_sede) then
    -- região que já tem cidades: a sede é uma delas, ativa (grava o nome do jeito certo).
    -- Região sem cidade ainda (acabou de nascer): aceita o nome; admin_criar_regiao cria a cidade junto.
    if exists (select 1 from public.cidades c where c.microrregiao_id = new.id) then
      select c.nome into sede from public.cidades c
       where c.microrregiao_id = new.id and c.ativa and public.nome_comparavel(c.nome) = public.nome_comparavel(new.cidade_sede)
       limit 1;
      if sede is null then
        raise exception using errcode = '23514', detail = 'campo:cidade_sede',
          message = 'A sede precisa ser uma cidade ativa desta região.';
      end if;
      new.cidade_sede := sede;
    end if;
  end if;
  return new;
end $$;
create trigger microrregioes_validar before insert or update on public.microrregioes
  for each row execute function public.validar_microrregiao();

create or replace function public.impedir_apagar_regiao()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  n_pessoas integer;
  n_lojas   integer;
  n_anunc   integer;
  n_pedidos integer;
  n_pagtos  integer;
  uso       text;
begin
  select count(*) into n_pessoas from public.perfis where microrregiao_id = old.id;
  select count(*) into n_lojas   from public.vitrines_lojas where microrregiao_id = old.id;
  select count(*) into n_anunc   from public.anuncios where microrregiao_id = old.id;
  select count(*) into n_pedidos from public.radar_pedidos where microrregiao_id = old.id;
  select count(*) into n_pagtos  from public.pagamentos where microrregiao_id = old.id;
  uso := nullif(concat_ws(', ',
           case when n_pessoas > 0 then n_pessoas || case when n_pessoas = 1 then ' pessoa' else ' pessoas' end end,
           case when n_lojas   > 0 then n_lojas   || case when n_lojas = 1   then ' vendedor' else ' vendedores' end end,
           case when n_anunc   > 0 then n_anunc   || case when n_anunc = 1   then ' anúncio' else ' anúncios' end end,
           case when n_pedidos > 0 then n_pedidos || case when n_pedidos = 1 then ' pedido no Radar' else ' pedidos no Radar' end end,
           case when n_pagtos  > 0 then n_pagtos  || case when n_pagtos = 1  then ' pagamento' else ' pagamentos' end end), '');
  if uso is not null then
    raise exception using errcode = 'P0001',
      message = format('Não dá para apagar a região "%s": ela tem %s. Desative as cidades que não quer mais nas listas.', old.nome, uso);
  end if;
  return old;
end $$;
create trigger microrregioes_impedir_apagar before delete on public.microrregioes
  for each row execute function public.impedir_apagar_regiao();

-- ---------------------------------------------------------------------
-- 3. Funções do painel (tela 7). Conferem e_admin() por dentro.
-- ---------------------------------------------------------------------
create or replace function public.admin_regioes()
returns table (id uuid, slug text, nome text, cidade_sede text, ativa boolean, repasse_percentual numeric,
               cidades_total integer, cidades_ativas integer, lojas integer, vendedores_pf integer,
               anuncios_ativos integer, anuncios_total integer, pessoas integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode ver isso.' using errcode = '42501';
  end if;
  return query
  select m.id, m.slug, m.nome, m.cidade_sede, m.ativa, m.repasse_percentual,
         (select count(*)::int from public.cidades c where c.microrregiao_id = m.id),
         (select count(*)::int from public.cidades c where c.microrregiao_id = m.id and c.ativa),
         (select count(*)::int from public.vitrines_lojas v where v.microrregiao_id = m.id and v.tipo = 'loja'),
         (select count(*)::int from public.vitrines_lojas v where v.microrregiao_id = m.id and v.tipo = 'pf'),
         (select count(*)::int from public.anuncios a where a.microrregiao_id = m.id and a.status = 'ativo'),
         (select count(*)::int from public.anuncios a where a.microrregiao_id = m.id),
         (select count(*)::int from public.perfis p where p.microrregiao_id = m.id)
    from public.microrregioes m
   order by m.criado_em, m.nome;
end $$;

create or replace function public.admin_cidades(p_regiao uuid)
returns table (id uuid, nome text, uf text, ativa boolean, e_sede boolean,
               anuncios integer, lojas integer, pessoas integer, pedidos integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode ver isso.' using errcode = '42501';
  end if;
  return query
  select c.id, c.nome, c.uf::text, c.ativa, public.e_sede(c.microrregiao_id, c.nome),
         u.anuncios, u.lojas, u.pessoas, u.pedidos
    from public.cidades c
    cross join lateral public.uso_cidade(c.microrregiao_id, c.nome) u
   where c.microrregiao_id = p_regiao
   order by c.ativa desc, public.nome_comparavel(c.nome);
end $$;

-- Cria a região e a cidade-sede juntas (tudo ou nada). Devolve o id da região.
create or replace function public.admin_criar_regiao(p_nome text, p_slug text, p_sede text, p_uf text)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_sede text := regexp_replace(btrim(coalesce(p_sede, '')), '\s+', ' ', 'g');
  v_id   uuid;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode criar regiões.' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9-]{2,60}$' then
    raise exception using errcode = '23514', detail = 'campo:nome',
      message = 'O nome da região precisa ter letras ou números (de 2 a 60 no endereço interno).';
  end if;
  if exists (select 1 from public.microrregioes m where m.slug = v_slug) then
    raise exception using errcode = '23505', detail = 'campo:nome',
      message = format('Já existe uma região com o endereço "%s". Mude um pouco o nome.', v_slug);
  end if;
  if char_length(v_sede) < 2 then
    raise exception using errcode = '23514', detail = 'campo:sede', message = 'Escreva a cidade-sede da região.';
  end if;
  insert into public.microrregioes (slug, nome, cidade_sede) values (v_slug, p_nome, null) returning id into v_id;
  insert into public.cidades (microrregiao_id, nome, uf) values (v_id, v_sede, p_uf);
  update public.microrregioes set cidade_sede = v_sede where id = v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Categorias
-- ---------------------------------------------------------------------

-- Leitura de todas as categorias (inclusive escondidas): o vendedor que já tem anúncio numa
-- categoria escondida continua vendo os campos dela ao editar. O cadastro e a busca filtram
-- ativa = true no código (src/lib/dados/categorias.ts). Nome e campos não são segredo.
drop policy "categorias leitura" on public.categorias;
create policy "categorias leitura" on public.categorias for select using (true);

-- Regras extras (roda depois do gatilho categorias_validar, que já confere tipo, chave e lista)
create or replace function public.conferir_categoria()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c          jsonb;
  res        jsonb := '[]'::jsonb;
  rot        text;
  max_campos integer := coalesce(public.numero_ou_nulo(public.config('categorias.campos_max', null, '20')), 20)::int;
  max_opcoes integer := coalesce(public.numero_ou_nulo(public.config('categorias.opcoes_max', null, '60')), 60)::int;
  rotulos    text[] := '{}';
  chaves     text[];
  numeros    text[];
  opcoes     jsonb;
  op         text;
  vistas     text[];
begin
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 60 then
    raise exception using errcode = '23514', message = 'O nome da categoria precisa ter de 2 a 60 letras.', detail = 'campo:nome';
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception using errcode = '22023',
      message = 'O endereço da categoria (olaki.com.br/c/...) não muda depois de criado. Mude só o nome.';
  end if;
  if exists (select 1 from public.categorias x where x.slug = new.slug and x.id <> new.id) then
    raise exception using errcode = '23505', detail = 'campo:nome',
      message = format('Já existe uma categoria com o endereço "%s". Mude um pouco o nome.', new.slug);
  end if;

  if new.preco_min_centavos is not null and new.preco_max_centavos is not null
     and new.preco_min_centavos > new.preco_max_centavos then
    raise exception using errcode = '23514', detail = 'campo:preco',
      message = 'O preço mínimo precisa ser menor que o preço máximo.';
  end if;

  if new.pai_id is null then
    -- quem recebe anúncio é a subcategoria: a principal não tem campos nem limite de preço
    if jsonb_array_length(new.campos) > 0 then
      raise exception using errcode = '22023',
        message = 'Os campos do anúncio ficam nas subcategorias. Tire os campos antes de virar categoria principal.';
    end if;
    if new.preco_min_centavos is not null or new.preco_max_centavos is not null then
      raise exception using errcode = '22023',
        message = 'Preço mínimo e máximo ficam nas subcategorias. Apague os preços antes de virar categoria principal.';
    end if;
    if tg_op = 'UPDATE' and old.pai_id is not null
       and exists (select 1 from public.anuncios a where a.categoria_id = new.id) then
      raise exception using errcode = '23514',
        message = 'Esta subcategoria tem anúncios e não pode virar categoria principal. Mova para outra categoria.';
    end if;
  end if;

  -- limites dos campos (painel: categorias.campos_max e categorias.opcoes_max)
  if jsonb_array_length(new.campos) > max_campos then
    raise exception using errcode = '22023', message = format('Uma subcategoria pode ter no máximo %s campos.', max_campos);
  end if;
  select coalesce(array_agg(x->>'chave'), '{}') into chaves from jsonb_array_elements(new.campos) x;
  select coalesce(array_agg(x->>'chave'), '{}') into numeros from jsonb_array_elements(new.campos) x where x->>'tipo' = 'numero';

  for c in select * from jsonb_array_elements(new.campos) loop
    rot := c->>'rotulo';
    if public.nome_comparavel(rot) = any(rotulos) then
      raise exception using errcode = '22023', message = format('Dois campos com o mesmo nome: "%s".', rot);
    end if;
    rotulos := rotulos || public.nome_comparavel(rot);

    -- a busca usa c_<chave>_min e c_<chave>_max para números: não pode haver outra chave igual a isso
    if exists (select 1 from unnest(numeros) n where c->>'chave' in (n || '_min', n || '_max')) then
      raise exception using errcode = '22023',
        message = format('O campo "%s" tem uma chave que confunde o filtro da busca. Mude o nome do campo.', rot);
    end if;

    if c ? 'unidade' and char_length(c->>'unidade') > 12 then
      raise exception using errcode = '22023', message = format('No campo "%s", a unidade pode ter até 12 letras (ex.: km, ha).', rot);
    end if;
    if c ? 'unidade' and btrim(c->>'unidade') = '' then
      c := c - 'unidade';
    end if;

    if c->>'tipo' = 'lista' then
      if jsonb_array_length(c->'opcoes') > max_opcoes then
        raise exception using errcode = '22023', message = format('O campo "%s" pode ter no máximo %s opções.', rot, max_opcoes);
      end if;
      opcoes := '[]'::jsonb;
      vistas := '{}';
      for op in select btrim(o) from jsonb_array_elements_text(c->'opcoes') o loop
        op := regexp_replace(op, '\s+', ' ', 'g');
        if char_length(op) > 60 then
          raise exception using errcode = '22023', message = format('No campo "%s", cada opção pode ter até 60 letras.', rot);
        end if;
        if public.nome_comparavel(op) = any(vistas) then
          raise exception using errcode = '22023', message = format('No campo "%s", a opção "%s" aparece duas vezes.', rot, op);
        end if;
        vistas := vistas || public.nome_comparavel(op);
        opcoes := opcoes || to_jsonb(op);
      end loop;
      c := jsonb_set(c, '{opcoes}', opcoes);
    end if;
    res := res || jsonb_build_array(c);
  end loop;
  new.campos := res;
  return new;
end $$;
create trigger categorias_validar_2 before insert or update on public.categorias
  for each row execute function public.conferir_categoria();

-- Categoria em uso nunca é apagada: esconda em vez de apagar
create or replace function public.impedir_apagar_categoria()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  n_anunc   integer;
  n_pedidos integer;
  n_filhas  integer;
begin
  select count(*) into n_filhas  from public.categorias where pai_id = old.id;
  select count(*) into n_anunc   from public.anuncios where categoria_id = old.id;
  select count(*) into n_pedidos from public.radar_pedidos where categoria_id = old.id;
  if n_filhas > 0 then
    raise exception using errcode = 'P0001',
      message = format('"%s" tem %s subcategoria(s). Mova ou apague as subcategorias antes, ou esconda a categoria.', old.nome, n_filhas);
  end if;
  if n_anunc > 0 or n_pedidos > 0 then
    raise exception using errcode = 'P0001',
      message = format('Não dá para apagar "%s": tem %s. Esconda a categoria: ela sai do cadastro e os anúncios continuam.', old.nome,
        concat_ws(' e ',
          case when n_anunc > 0 then n_anunc || case when n_anunc = 1 then ' anúncio' else ' anúncios' end end,
          case when n_pedidos > 0 then n_pedidos || case when n_pedidos = 1 then ' pedido no Radar' else ' pedidos no Radar' end end));
  end if;
  return old;
end $$;
create trigger categorias_impedir_apagar before delete on public.categorias
  for each row execute function public.impedir_apagar_categoria();

-- Categoria que dá para escolher agora: ativa e com a mãe ativa
create or replace function public.categoria_disponivel(p_id uuid)
returns boolean language sql stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.categorias c left join public.categorias p on p.id = c.pai_id
     where c.id = p_id and c.ativa and (c.pai_id is null or coalesce(p.ativa, false)))
$$;

-- Ao ESCOLHER a categoria (inserção ou troca), a mãe também precisa estar visível.
-- Quem já estava na categoria continua como está (esconder não mexe nos anúncios).
create or replace function public.exigir_categoria_disponivel()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if new.categoria_id is null or public.acesso_sistema() then return new; end if;
  if tg_op = 'UPDATE' and new.categoria_id is not distinct from old.categoria_id then return new; end if;
  if not public.categoria_disponivel(new.categoria_id) then
    raise exception using errcode = '23514', detail = 'campo:categoria',
      message = 'Esta categoria não está disponível. Escolha outra.';
  end if;
  return new;
end $$;
create trigger anuncios_1_validar_mae before insert or update of categoria_id on public.anuncios
  for each row execute function public.exigir_categoria_disponivel();
create trigger radar_1_validar_mae before insert or update of categoria_id on public.radar_pedidos
  for each row execute function public.exigir_categoria_disponivel();

-- ---------------------------------------------------------------------
-- 5. Funções do painel (tela 9). Conferem e_admin() por dentro.
-- ---------------------------------------------------------------------
create or replace function public.admin_categorias()
returns table (id uuid, slug text, nome text, icone text, pai_id uuid, ordem integer, ativa boolean, campos jsonb,
               preco_min_centavos bigint, preco_max_centavos bigint, tipo_legado text,
               anuncios_ativos integer, anuncios_total integer, pedidos_radar integer, filhas integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode ver isso.' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.nome, c.icone, c.pai_id, c.ordem, c.ativa, c.campos,
         c.preco_min_centavos, c.preco_max_centavos, c.tipo_legado::text,
         (select count(*)::int from public.anuncios a where a.categoria_id = c.id and a.status = 'ativo'),
         (select count(*)::int from public.anuncios a where a.categoria_id = c.id),
         (select count(*)::int from public.radar_pedidos r where r.categoria_id = c.id),
         (select count(*)::int from public.categorias f where f.pai_id = c.id)
    from public.categorias c
   order by c.ordem, c.nome;
end $$;

-- Sobe ou desce uma categoria entre as irmãs (mesma mãe). Renumera 10, 20, 30... e troca com a vizinha.
create or replace function public.admin_mover_categoria(p_id uuid, p_direcao text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo    public.categorias;
  ids     uuid[];
  pos     integer;
  vizinho integer;
  i       integer;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode mudar a ordem.' using errcode = '42501';
  end if;
  if p_direcao not in ('subir', 'descer') then
    raise exception 'Direção inválida.' using errcode = '22023';
  end if;
  select * into alvo from public.categorias where id = p_id;
  if alvo.id is null then
    raise exception 'Categoria não encontrada.' using errcode = 'P0001';
  end if;
  -- trava as irmãs (evita dois cliques ao mesmo tempo bagunçarem a ordem)
  perform 1 from public.categorias where pai_id is not distinct from alvo.pai_id for update;
  select array_agg(x.id order by x.ordem, x.nome, x.id) into ids
    from public.categorias x where x.pai_id is not distinct from alvo.pai_id;
  pos := array_position(ids, p_id);
  vizinho := case when p_direcao = 'subir' then pos - 1 else pos + 1 end;
  if vizinho < 1 or vizinho > cardinality(ids) then
    return;                                 -- já está na ponta
  end if;
  ids[pos] := ids[vizinho];
  ids[vizinho] := p_id;
  for i in 1 .. cardinality(ids) loop
    update public.categorias set ordem = i * 10 where id = ids[i] and ordem is distinct from i * 10;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Endurecimento (mesma regra do Security Advisor): search_path fixo em toda
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

-- Painel (conferem e_admin() por dentro): só quem tem login chega até elas
revoke all on function public.admin_regioes() from public, anon;
revoke all on function public.admin_cidades(uuid) from public, anon;
revoke all on function public.admin_criar_regiao(text, text, text, text) from public, anon;
revoke all on function public.admin_categorias() from public, anon;
revoke all on function public.admin_mover_categoria(uuid, text) from public, anon;
grant execute on function public.admin_regioes(), public.admin_cidades(uuid), public.admin_criar_regiao(text, text, text, text),
  public.admin_categorias(), public.admin_mover_categoria(uuid, text) to authenticated;
-- Auxiliares: contam dados de outras pessoas (uso_cidade é SECURITY DEFINER), então só o servidor e os gatilhos
revoke all on function public.uso_cidade(uuid, text) from public, anon, authenticated;
revoke all on function public.texto_uso_cidade(uuid, text) from public, anon, authenticated;
revoke all on function public.e_sede(uuid, text) from public, anon, authenticated;
grant execute on function public.uso_cidade(uuid, text), public.texto_uso_cidade(uuid, text), public.e_sede(uuid, text) to service_role;
-- Públicas por desenho (só comparam nomes / dizem se a categoria pode ser escolhida)
revoke all on function public.nome_comparavel(text) from public;
revoke all on function public.categoria_disponivel(uuid) from public;
grant execute on function public.nome_comparavel(text), public.categoria_disponivel(uuid) to anon, authenticated, service_role;
