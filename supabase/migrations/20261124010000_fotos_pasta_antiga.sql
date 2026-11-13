-- Fotos na pasta do ID antigo depois da troca de ID do Clerk.
-- admin_trocar_id_usuario (padrão p_mover_arquivos = false) troca o dono da loja para o ID novo,
-- mas as fotos continuam em .../anuncios/<ID_ANTIGO>/... . Antes desta mudança, o gatilho
-- conferia TODAS as fotos da lista contra a pasta do dono atual, então o dono não conseguia
-- tirar, trocar a ordem nem pôr foto nova num anúncio com foto antiga ("Use só fotos enviadas").
--
-- Regra nova: numa edição (UPDATE) do mesmo anúncio, na mesma loja, a foto que JÁ estava no
-- anúncio continua valendo (já foi conferida quando entrou). Só foto que entra agora precisa
-- estar na pasta do dono atual. Tirar e reordenar nunca coloca endereço novo. Usar uma foto
-- antiga em OUTRO anúncio continua recusado.
-- O resto da função é igual ao de 20261107020000_categorias_e_anuncios.sql.

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
  -- Fotos que já estavam neste anúncio, nesta loja (não precisam de nova conferência de pasta).
  ja_tinha text[] := case when tg_op = 'UPDATE' and new.vitrine_id = old.vitrine_id
                          then coalesce(old.fotos, '{}') else '{}' end;
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
    continue when foto = any(ja_tinha);
    if not coalesce(public.foto_do_olaki(foto, dono), false) then
      raise exception using errcode = '22023', message = 'Use só fotos enviadas pelo OLAKI.', detail = 'campo:fotos';
    end if;
  end loop;
  return new;
end $$;
