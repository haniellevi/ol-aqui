-- Evita retenção de aluguel pelo piso de venda. Anúncios já em análise não são liberados automaticamente.
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
    -- O piso genérico dos imóveis é de venda. Aluguéis mantêm limites específicos,
    -- teto de preço e filtro de conteúdo, sem herdar o piso de venda.
    minp := coalesce(cmin, case
      when tg_table_name = 'anuncios' and cat = 'imovel' and new.atributos->>'finalidade' = 'Aluguel' then null
      else (public.config('moderacao.preco_min_centavos', new.microrregiao_id, '{}') ->> cat)::bigint
    end);
    if (maxp is not null and preco > maxp) or (minp is not null and preco > 0 and preco < minp) then
      new.status := 'em_analise';
      new.motivo_analise := 'Preço fora do normal para a categoria';
    end if;
  end if;
  return new;
end $$;

-- Edição de texto/preço também é moderada quando o anúncio está vendido (a página continua pública)
drop trigger anuncios_moderacao on public.anuncios;
create trigger anuncios_moderacao before insert or update of titulo, descricao, preco_centavos, atributos, categoria_id on public.anuncios
  for each row when (new.status in ('ativo', 'vendido')) execute function public.filtro_moderacao();

drop trigger anuncios_moderacao_publicar on public.anuncios;
create trigger anuncios_moderacao_publicar before update of status on public.anuncios
  for each row when (old.status in ('rascunho', 'pausado', 'expirado', 'vendido') and new.status = 'ativo')
  execute function public.filtro_moderacao();
