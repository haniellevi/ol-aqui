-- Vitrine com IA, etapa 1: base de dados (docs/PLANO-VITRINE-IA.md).
-- 1. Nicho da loja: é a categoria principal da árvore (pai_id nulo), a mesma que o catálogo
--    de lojas e o Radar já usam. O texto livre categoria_loja continua guardado como referência.
-- 2. Buscas do site somadas por dia, região e termo, sem pessoa, para o alerta de demanda.
-- 3. Categoria sugerida pela IA em cada anúncio, que o dono aceita ou recusa.
-- 4. Chave que deixa a vitrine nova desligada até o lançamento.

-- ---------------------------------------------------------------------
-- 1. Nicho da loja
-- ---------------------------------------------------------------------
alter table public.vitrines_lojas
  add column nicho_id uuid references public.categorias(id) on delete set null,
  add column nicho_sugerido_id uuid references public.categorias(id) on delete set null,
  add column nicho_sugerido_em timestamptz;
create index vitrines_lojas_nicho_idx on public.vitrines_lojas (nicho_id) where nicho_id is not null;
-- O nicho aparece na página pública. A sugestão da IA só sai pela função minha_sugestao_nicho().
grant select (nicho_id) on public.vitrines_lojas to anon, authenticated;

create function public.validar_nicho_loja()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and (new.nicho_sugerido_id is not null or new.nicho_sugerido_em is not null))
     or (tg_op = 'UPDATE' and (new.nicho_sugerido_id is distinct from old.nicho_sugerido_id
                               or new.nicho_sugerido_em is distinct from old.nicho_sugerido_em)) then
    if not public.acesso_sistema() then
      raise exception using errcode = '42501', message = 'Só o sistema grava a sugestão de nicho.';
    end if;
  end if;
  if new.nicho_id is not null and (tg_op = 'INSERT' or new.nicho_id is distinct from old.nicho_id)
     and not exists (select 1 from public.categorias c
                      where c.id = new.nicho_id and c.pai_id is null and public.categoria_disponivel(c.id)) then
    raise exception using errcode = '23514', message = 'Escolha um nicho da lista.', detail = 'campo:nicho_id';
  end if;
  if new.nicho_sugerido_id is not null
     and (tg_op = 'INSERT' or new.nicho_sugerido_id is distinct from old.nicho_sugerido_id)
     and not exists (select 1 from public.categorias c where c.id = new.nicho_sugerido_id and c.pai_id is null) then
    raise exception using errcode = '23514', message = 'A sugestão de nicho precisa ser uma categoria principal.';
  end if;
  return new;
end $$;
create trigger vitrines_validar_nicho before insert or update of nicho_id, nicho_sugerido_id, nicho_sugerido_em
  on public.vitrines_lojas for each row execute function public.validar_nicho_loja();

-- O dono lê a sugestão de nicho da própria loja (a IA preenche na etapa 4).
create function public.minha_sugestao_nicho(p_vitrine uuid)
returns table (nicho_id uuid, nicho_nome text, sugerido_id uuid, sugerido_nome text, sugerido_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select v.nicho_id, n.nome, v.nicho_sugerido_id, s.nome, v.nicho_sugerido_em
    from public.vitrines_lojas v
    left join public.categorias n on n.id = v.nicho_id
    left join public.categorias s on s.id = v.nicho_sugerido_id
   where v.id = p_vitrine and v.dono_id = public.usuario_id()
$$;

-- Lojas que já existem:
-- a) o texto que o lojista digitou com o mesmo nome de uma categoria principal vira o nicho;
-- b) as outras recebem como sugestão a categoria principal mais comum entre seus anúncios ativos.
update public.vitrines_lojas v
   set nicho_id = c.id
  from public.categorias c
 where v.nicho_id is null and v.categoria_loja is not null
   and c.pai_id is null and c.ativa
   and lower(public.sem_acento(btrim(v.categoria_loja))) = lower(public.sem_acento(c.nome));

with contagem as (
  select a.vitrine_id, coalesce(c.pai_id, c.id) as raiz, count(*) as n,
         row_number() over (partition by a.vitrine_id order by count(*) desc, coalesce(c.pai_id, c.id)) as pos
    from public.anuncios a
    join public.categorias c on c.id = a.categoria_id
   where a.status = 'ativo'
   group by a.vitrine_id, coalesce(c.pai_id, c.id)
)
update public.vitrines_lojas v
   set nicho_sugerido_id = k.raiz, nicho_sugerido_em = now()
  from contagem k
 where k.vitrine_id = v.id and k.pos = 1 and v.nicho_id is null and v.nicho_sugerido_id is null;

-- ---------------------------------------------------------------------
-- 2. Buscas do site (somadas, sem pessoa)
-- ---------------------------------------------------------------------
create table public.buscas_termos (
  id                   bigint generated always as identity primary key,
  microrregiao_id      uuid references public.microrregioes(id) on delete cascade,
  dia                  date not null,
  termo_normalizado    text not null check (char_length(termo_normalizado) between 2 and 80),
  categoria_id         uuid references public.categorias(id) on delete set null,
  vezes                integer not null default 1 check (vezes >= 1),
  vezes_sem_resultado  integer not null default 0 check (vezes_sem_resultado between 0 and vezes)
);
create unique index buscas_termos_chave on public.buscas_termos (
  coalesce(microrregiao_id, '00000000-0000-0000-0000-000000000000'), dia, termo_normalizado,
  coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'));
create index buscas_termos_dia_idx on public.buscas_termos (dia);
alter table public.buscas_termos enable row level security;
create policy "buscas termos admin leitura" on public.buscas_termos for select using (public.e_admin());
revoke all on public.buscas_termos from anon, authenticated;
grant select on public.buscas_termos to authenticated;   -- a policy deixa só o admin
grant all on public.buscas_termos to service_role;

-- Soma uma busca. Só o servidor chama (o navegador não consegue inflar os números).
create function public.registrar_busca(p_termo text, p_microrregiao uuid, p_categoria_slug text default null,
                                        p_total integer default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_norm text := left(btrim(regexp_replace(lower(public.sem_acento(coalesce(p_termo, ''))), '\s+', ' ', 'g')), 80);
  v_cat  uuid;
  v_dia  date := (now() at time zone 'America/Fortaleza')::date;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o servidor grava as buscas.' using errcode = '42501';
  end if;
  if char_length(v_norm) < 2 then return; end if;
  if nullif(btrim(coalesce(p_categoria_slug, '')), '') is not null then
    select c.id into v_cat from public.categorias c where c.slug = btrim(p_categoria_slug);
  end if;
  insert into public.buscas_termos (microrregiao_id, dia, termo_normalizado, categoria_id, vezes, vezes_sem_resultado)
  values (p_microrregiao, v_dia, v_norm, v_cat, 1, case when coalesce(p_total, 1) = 0 then 1 else 0 end)
  on conflict (coalesce(microrregiao_id, '00000000-0000-0000-0000-000000000000'), dia, termo_normalizado,
               coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'))
  do update set vezes = buscas_termos.vezes + 1,
                vezes_sem_resultado = buscas_termos.vezes_sem_resultado + excluded.vezes_sem_resultado;
end $$;

-- ---------------------------------------------------------------------
-- 3. Categoria sugerida nos anúncios
-- ---------------------------------------------------------------------
alter table public.anuncios
  add column categoria_sugerida_id uuid references public.categorias(id) on delete set null,
  add column categoria_sugestao_estado text check (categoria_sugestao_estado in ('pendente', 'aceita', 'recusada')),
  add column categoria_sugerida_em timestamptz;
create index anuncios_sugestao_pendente_idx on public.anuncios (vitrine_id)
  where categoria_sugestao_estado = 'pendente';

-- Só o sistema grava a sugestão. O dono decide por decidir_categoria_sugerida().
create function public.proteger_categoria_sugerida()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and (new.categoria_sugerida_id is not null or new.categoria_sugestao_estado is not null
                            or new.categoria_sugerida_em is not null))
     or (tg_op = 'UPDATE' and (new.categoria_sugerida_id is distinct from old.categoria_sugerida_id
                               or new.categoria_sugestao_estado is distinct from old.categoria_sugestao_estado
                               or new.categoria_sugerida_em is distinct from old.categoria_sugerida_em)) then
    if not public.acesso_sistema() then
      raise exception using errcode = '42501', message = 'Só o sistema grava a categoria sugerida.';
    end if;
  end if;
  -- Se o dono trocar a categoria por conta própria, a sugestão pendente perde o sentido.
  if tg_op = 'UPDATE' and new.categoria_id is distinct from old.categoria_id
     and old.categoria_sugestao_estado = 'pendente' and new.categoria_sugestao_estado = 'pendente'
     and new.categoria_id is distinct from new.categoria_sugerida_id then
    new.categoria_sugestao_estado := 'recusada';
  end if;
  return new;
end $$;
create trigger anuncios_proteger_categoria_sugerida
  before insert or update of categoria_id, categoria_sugerida_id, categoria_sugestao_estado, categoria_sugerida_em
  on public.anuncios for each row execute function public.proteger_categoria_sugerida();

-- Fila "Revise suas categorias" do dono.
create function public.minhas_sugestoes_categoria(p_vitrine uuid)
returns table (anuncio_id uuid, titulo text, foto text, categoria_atual_id uuid, categoria_atual text,
               sugerida_id uuid, sugerida text, sugerida_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.titulo, a.fotos[1], a.categoria_id, ca.nome, a.categoria_sugerida_id, cs.nome, a.categoria_sugerida_em
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    left join public.categorias ca on ca.id = a.categoria_id
    join public.categorias cs on cs.id = a.categoria_sugerida_id
   where a.vitrine_id = p_vitrine and v.dono_id = public.usuario_id()
     and a.categoria_sugestao_estado = 'pendente' and a.status <> 'excluido'
   order by a.categoria_sugerida_em, a.id
$$;

create function public.decidir_categoria_sugerida(p_anuncio uuid, p_aceitar boolean)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  a public.anuncios;
begin
  select x.* into a from public.anuncios x
    join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and v.dono_id = public.usuario_id()
   for update of x;
  if not found then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if a.categoria_sugestao_estado is distinct from 'pendente' or a.categoria_sugerida_id is null then
    raise exception using errcode = '22023', message = 'Essa sugestão já foi decidida.';
  end if;
  if coalesce(p_aceitar, false) then
    if not public.categoria_disponivel(a.categoria_sugerida_id) then
      raise exception using errcode = '22023', message = 'Essa categoria não está mais disponível.';
    end if;
    update public.anuncios set categoria_id = a.categoria_sugerida_id, categoria_sugestao_estado = 'aceita'
     where id = a.id;
  else
    update public.anuncios set categoria_sugestao_estado = 'recusada' where id = a.id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Chave da vitrine nova (desligada até o lançamento)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select 'vitrine_ia.ativa', 'false', 'vitrine', true, 'Liga a vitrine nova das lojas, com IA (plano em docs/PLANO-VITRINE-IA.md)'
 where not exists (select 1 from public.configuracoes where chave = 'vitrine_ia.ativa' and microrregiao_id is null);

-- ---------------------------------------------------------------------
-- 5. Permissões das funções
-- ---------------------------------------------------------------------
revoke all on function public.validar_nicho_loja(), public.proteger_categoria_sugerida()
  from public, anon, authenticated;
revoke all on function public.registrar_busca(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_busca(text, uuid, text, integer) to service_role;
revoke all on function public.minha_sugestao_nicho(uuid), public.minhas_sugestoes_categoria(uuid),
                       public.decidir_categoria_sugerida(uuid, boolean) from public, anon;
grant execute on function public.minha_sugestao_nicho(uuid), public.minhas_sugestoes_categoria(uuid),
                          public.decidir_categoria_sugerida(uuid, boolean) to authenticated, service_role;
