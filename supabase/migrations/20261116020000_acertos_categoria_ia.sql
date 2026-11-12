-- Categorias · Etapa 2: onde a IA (JEV) erra a categoria.
-- Uma linha por anúncio: o texto de "O que você está anunciando?" (até 90 letras), as até 3 categorias
-- que o JEV sugeriu (com a chance de cada) e a categoria que ficou no anúncio quando a pessoa salvou.
-- Sem dado de quem digitou: só o anúncio. Apagar o anúncio apaga a linha.
-- Leitura: só administrador. Escrita: só pelas duas funções abaixo, por quem cuida do anúncio
-- (dono da loja ou ajudante). Ninguém grava direto na tabela.

create table public.categorias_ia_escolhas (
  anuncio_id             uuid primary key references public.anuncios(id) on delete cascade,
  texto                  text not null check (char_length(texto) between 1 and 90),
  sugestoes              jsonb not null default '[]'::jsonb
                           check (jsonb_typeof(sugestoes) = 'array' and jsonb_array_length(sugestoes) <= 3),
  sugerido_em            timestamptz not null default now(),
  categoria_escolhida_id uuid references public.categorias(id) on delete set null,
  escolhida_em           timestamptz
);
create index categorias_ia_escolhas_escolhida_idx on public.categorias_ia_escolhas (escolhida_em)
  where escolhida_em is not null;

alter table public.categorias_ia_escolhas enable row level security;
create policy "acertos ia leitura admin" on public.categorias_ia_escolhas
  for select using (public.e_admin());
revoke all on public.categorias_ia_escolhas from public, anon, authenticated;
grant select on public.categorias_ia_escolhas to authenticated;

-- Quem cuida do anúncio guarda o que a IA respondeu para o texto. Uma resposta nova troca a anterior
-- e apaga a escolha antiga (a escolha só vale para a última resposta que a pessoa viu).
-- p_sugestoes: [{"id": "<uuid da categoria>", "chance": 0.83}, ...], até 3, da mais para a menos provável.
create function public.registrar_sugestao_categoria_ia(p_anuncio uuid, p_texto text, p_sugestoes jsonb)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  v_texto text := left(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')), 90);
  limpas  jsonb := '[]'::jsonb;
  item    jsonb;
  v_id    uuid;
  v_chance numeric;
begin
  if public.usuario_id() is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para continuar.';
  end if;
  if not exists (select 1 from public.anuncios a
                  where a.id = p_anuncio and a.status <> 'excluido' and public.pode_mexer_vitrine(a.vitrine_id)) then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if v_texto = '' then
    raise exception using errcode = '22023', message = 'Texto vazio.';
  end if;
  if jsonb_typeof(p_sugestoes) is distinct from 'array' or jsonb_array_length(p_sugestoes) > 3 then
    raise exception using errcode = '22023', message = 'Sugestões inválidas.';
  end if;
  for item in select value from jsonb_array_elements(p_sugestoes) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'chance') is distinct from 'number'
       or jsonb_typeof(item->'id') is distinct from 'string' or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'Sugestões inválidas.';
    end if;
    v_id := (item->>'id')::uuid;
    v_chance := (item->>'chance')::numeric;
    if v_chance < 0 or v_chance > 1 or not exists (select 1 from public.categorias c where c.id = v_id)
       or limpas @> jsonb_build_array(jsonb_build_object('id', v_id)) then
      raise exception using errcode = '22023', message = 'Sugestões inválidas.';
    end if;
    limpas := limpas || jsonb_build_array(jsonb_build_object('id', v_id, 'chance', round(v_chance, 4)));
  end loop;

  insert into public.categorias_ia_escolhas as e (anuncio_id, texto, sugestoes, sugerido_em)
  values (p_anuncio, v_texto, limpas, now())
  on conflict (anuncio_id) do update
     set texto = excluded.texto, sugestoes = excluded.sugestoes, sugerido_em = excluded.sugerido_em,
         categoria_escolhida_id = null, escolhida_em = null;
  return true;
end $$;

-- Depois de salvar a categoria: guarda a que ficou no anúncio (lida do banco, não do navegador).
-- p_texto: o texto cujas sugestões estavam na tela quando a pessoa salvou. Só grava se for o mesmo texto
-- da última resposta guardada; senão (texto apagado, IA atrasada, respostas fora de ordem) o caso fica
-- fora da conta, em vez de virar um erro falso. Sem resposta guardada: não faz nada (devolve false).
create function public.registrar_escolha_categoria_ia(p_anuncio uuid, p_texto text)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  v_categoria uuid;
  v_texto text := left(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')), 90);
begin
  if public.usuario_id() is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para continuar.';
  end if;
  select a.categoria_id into v_categoria from public.anuncios a
   where a.id = p_anuncio and a.status <> 'excluido' and public.pode_mexer_vitrine(a.vitrine_id);
  if not found then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if v_categoria is null then return false; end if;
  update public.categorias_ia_escolhas
     set categoria_escolhida_id = v_categoria, escolhida_em = now()
   where anuncio_id = p_anuncio and texto = v_texto;
  return found;
end $$;

-- Painel: acertos no período (7, 30 ou 90 dias até hoje, pelo dia da escolha no horário de Brasília).
-- "acertou_1": a escolhida foi a 1ª sugestão. "acertou_3": estava entre as 3. "sem_sugestao": a IA não
-- deu nenhuma opção (conta como erro). "erros": os 100 casos mais recentes em que a escolhida não foi a 1ª.
create function public.admin_acertos_categoria_ia(p_dias integer default 30)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  periodo integer := case when p_dias in (7, 30, 90) then p_dias else 30 end;
  inicio  date;
  resultado jsonb;
begin
  if not public.e_admin() then
    raise exception using errcode = '42501', message = 'Acesso restrito.';
  end if;
  inicio := public.dia_metrica(now()) - (periodo - 1);
  with base as (
    select e.*,
           (e.sugestoes->0->>'id')::uuid = e.categoria_escolhida_id as foi_1,
           exists (select 1 from jsonb_array_elements(e.sugestoes) s
                    where (s->>'id')::uuid = e.categoria_escolhida_id) as foi_3
      from public.categorias_ia_escolhas e
     where e.categoria_escolhida_id is not null and e.escolhida_em is not null
       and public.dia_metrica(e.escolhida_em) >= inicio
  )
  select jsonb_build_object(
           'dias', periodo,
           'total', count(*),
           'acertou_1', count(*) filter (where foi_1),
           'acertou_3', count(*) filter (where foi_3),
           'sem_sugestao', count(*) filter (where jsonb_array_length(sugestoes) = 0),
           'erros', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'anuncio_id', x.anuncio_id, 'texto', x.texto, 'sugestoes', x.sugestoes,
                       'escolhida_id', x.categoria_escolhida_id, 'escolhida_em', x.escolhida_em,
                       'entre_as_3', x.foi_3)
                     order by x.escolhida_em desc, x.anuncio_id)
                from (select * from base b where not coalesce(b.foi_1, false)
                       order by b.escolhida_em desc, b.anuncio_id limit 100) x), '[]'::jsonb))
    into resultado
    from base;
  return resultado;
end $$;

revoke all on function public.registrar_sugestao_categoria_ia(uuid, text, jsonb),
  public.registrar_escolha_categoria_ia(uuid, text), public.admin_acertos_categoria_ia(integer) from public, anon;
grant execute on function public.registrar_sugestao_categoria_ia(uuid, text, jsonb),
  public.registrar_escolha_categoria_ia(uuid, text), public.admin_acertos_categoria_ia(integer) to authenticated, service_role;

comment on table public.categorias_ia_escolhas is
  'Etapa 2 das categorias: o que a IA (JEV) sugeriu ao anunciar e a categoria que ficou. Só admin lê.';
