-- Titularidade operacional termina somente na purga; referências financeiras ficam na mesma loja.
lock table public.vitrines_lojas in share row exclusive mode;
alter table public.vitrines_lojas add column purgada_em timestamptz;
alter table public.vitrines_lojas add column dono_retido_id text references public.perfis(id) on update cascade on delete set null;
alter table public.vitrines_lojas alter column dono_id drop not null;
alter table public.vitrines_lojas add constraint vitrine_titular_ou_retida check (
  (dono_id is not null and purgada_em is null and dono_retido_id is null)
  or (dono_id is null and purgada_em is not null and status='suspensa' and excluida_em is not null));
create index vitrines_dono_retido_idx on public.vitrines_lojas(dono_retido_id) where dono_retido_id is not null;
-- Recuperação seletiva da assinatura exata produzida pela rotina antiga, fora da lixeira.
-- Não identifica lojas pelo nome isoladamente, nem toca uma suspensão verdadeira.
select set_config('olaki.sistema','1',true);
update public.vitrines_lojas v set dono_retido_id=dono_id, dono_id=null, purgada_em=now(), nome='Loja encerrada ' || left(v.id::text,8)
where v.dono_id is not null and v.status='suspensa' and v.excluida_em <= now()-interval '30 days'
  and v.slug='encerrada-' || v.id and v.cidade='Conta excluída' and v.whatsapp is null
  and v.nome in ('Loja encerrada', 'Loja encerrada ' || left(v.id::text,8))
  and v.logo_url is null and v.capa_url is null and v.cnpj is null and v.descricao is null
  and not exists(select 1 from public.lixeira_lojas l where l.vitrine_id=v.id)
  and (exists(select 1 from public.pagamentos p where p.vitrine_id=v.id)
    or v.gateway_assinatura_id is not null or exists(select 1 from public.anuncios a where a.vitrine_id=v.id)
    or exists(select 1 from public.radar_propostas rp where rp.vitrine_id=v.id));
select set_config('olaki.sistema','',true);
create or replace function public.purgar_loja(p_loja uuid)
returns text[] language plpgsql security definer set search_path = public, pg_temp as $$
declare
  loja public.vitrines_lojas;
  urls text[];
  sistema text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into loja from public.vitrines_lojas where id = p_loja for update;
  if not found or loja.excluida_em is null then return '{}'; end if;
  -- Só apaga se ainda estiver vencida na lixeira (pode ter sido restaurada depois da fila).
  if not exists(select 1 from public.lixeira_lojas where vitrine_id = p_loja and apagar_apos <= now() and origem <> 'conta') then
    return '{}';
  end if;
  select coalesce(array_agg(f), '{}') into urls from public.anuncios a, unnest(a.fotos) f
   where a.vitrine_id = p_loja and not public.anuncio_retido(a);
  urls := urls || array[loja.logo_url, loja.capa_url, loja.banner_url];
  delete from public.anuncios a where a.vitrine_id = p_loja and not public.anuncio_retido(a);
  with d as (
    delete from public.radar_propostas rp where rp.vitrine_id = p_loja
      and not exists(select 1 from public.radar_pedidos p where p.id = rp.pedido_id and p.status = 'congelado')
    returning rp.foto_url)
  select urls || coalesce(array_agg(foto_url) filter (where foto_url is not null), '{}') into urls from d;
  if exists(select 1 from public.pagamentos where vitrine_id = p_loja) or loja.gateway_assinatura_id is not null
     or exists(select 1 from public.anuncios where vitrine_id = p_loja)
     or exists(select 1 from public.radar_propostas where vitrine_id = p_loja) then
    perform set_config('olaki.sistema', '1', true);
    -- Com o dono ainda ativo, o nome reservado "Loja encerrada" é recusado; usa um sufixo único.
    update public.vitrines_lojas set dono_retido_id = dono_id, dono_id = null, purgada_em = now(), nome = 'Loja encerrada ' || left(id::text, 8),
      slug = 'encerrada-' || id, cidade = 'Conta excluída',
      bairro = null, criado_ip = null, selo_loja_verificada = false, descricao = null, whatsapp = null, cnpj = null,
      logo_url = null, capa_url = null, sobre = null, endereco = null, lat = null, lng = null, instagram = null,
      site_url = null, telefone_publico = null, entrega_obs = null, horarios = null, formas_pagamento = '{}',
      faz_entrega = null, banner_tipo = 'modelo', banner_url = null, banner_moderado_url = null,
      banner_moderado_motivo = null, banner_moderado_em = null
     where id = p_loja;
    perform set_config('olaki.sistema', sistema, true);
    delete from public.loja_secoes where vitrine_id = p_loja;
    update public.convites_gerente_loja set revogado_em = coalesce(revogado_em, now()) where vitrine_id = p_loja;
    delete from public.lixeira_lojas where vitrine_id = p_loja;
  else
    delete from public.vitrines_lojas where id = p_loja;
  end if;
  return public.limpeza_enfileirar(urls);
end $$;

create or replace function public.excluir_minha_loja(p_confirmacao text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare loja public.vitrines_lojas; eu text := public.usuario_id();
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into loja from public.vitrines_lojas where dono_id = eu for update;
  if not found then raise exception 'Você não tem loja.' using errcode = '22023'; end if;
  if upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' then
    raise exception 'Para confirmar, escreva EXCLUIR.' using errcode = '23514';
  end if;
  if loja.excluida_em is not null then
    return (select apagar_apos from public.lixeira_lojas where vitrine_id = loja.id);
  end if;
  if loja.arquivada_em is not null or loja.status = 'suspensa' then
    raise exception 'Sua loja está suspensa pela equipe. Fale com o suporte.' using errcode = '23514';
  end if;
  perform public.lixeira_mover_loja(loja.id, 'dono', null, eu);
  return (select apagar_apos from public.lixeira_lojas where vitrine_id = loja.id);
end $$;

create or replace function public.restaurar_minha_loja()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare eu text := public.usuario_id(); alvo uuid;
begin
  if eu is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select l.vitrine_id into alvo from public.lixeira_lojas l join public.vitrines_lojas v on v.id = l.vitrine_id
   where v.dono_id = eu and l.origem = 'dono';
  if alvo is null then raise exception 'Não há loja sua para restaurar.' using errcode = '22023'; end if;
  perform 1 from public.vitrines_lojas where id=alvo for update;
  if not exists(select 1 from public.lixeira_lojas where vitrine_id=alvo and origem='dono' and apagar_apos>now()) then
    raise exception 'O prazo para restaurar terminou.' using errcode='22023';
  end if;
  perform public.lixeira_restaurar_loja(alvo);
end $$;


-- Descartar só o rascunho próprio não publicado. DELETE cascateia trabalhos e a fila
-- independente de mídia recebe os caminhos pelo trigger já existente. Callback tardio retorna false.
create function public.loja_ia_descartar(p_id uuid, p_revisao integer) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid text:=public.usuario_id(); r public.loja_ia_rascunhos;
begin
 if uid is null then raise exception 'Faça login para continuar.' using errcode='28000'; end if;
 perform public.loja_criacao_travar(uid);
 select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
 if not found then raise exception 'Rascunho não encontrado.' using errcode='42501'; end if;
 if r.estado='publicado' or r.vitrine_id is not null then raise exception 'Esta loja já foi publicada.' using errcode='22023'; end if;
 if r.revisao is distinct from p_revisao then raise exception 'O rascunho mudou. Atualize a página.' using errcode='40001'; end if;
 delete from public.loja_ia_rascunhos where id=r.id;
 return true;
end $$;
create function public.sair_da_loja(p_loja uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid text:=public.usuario_id(); saiu boolean;
begin
 if uid is null then raise exception 'Faça login para continuar.' using errcode='28000'; end if;
 perform 1 from public.vitrines_lojas where id=p_loja for update;
 if exists(select 1 from public.vitrines_lojas where id=p_loja and dono_id=uid) then
   raise exception 'O dono deve usar o encerramento da loja.' using errcode='22023'; end if;
 with revogados as (update public.convites_gerente_loja set revogado_em=now()
   where vitrine_id=p_loja and aceito_por=uid and revogado_em is null returning id)
 select exists(select 1 from revogados) into saiu;
 if saiu then
  insert into public.historico_alteracoes(vitrine_id,quem,papel,acao,de,para,motivo)
  values(p_loja,uid,'ajudante','editou','gerente','saiu','Saída voluntária da equipe.');
 end if;
 return saiu;
end $$;
revoke all on function public.loja_ia_descartar(uuid,integer),public.sair_da_loja(uuid) from public,anon,authenticated;
grant execute on function public.loja_ia_descartar(uuid,integer),public.sair_da_loja(uuid) to authenticated;

-- Espera 24h para uploads assinados já emitidos (tokens valem 2h) e callbacks em trânsito.
create or replace function public.loja_ia_enfileirar_imagem_excluida() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.estado <> 'apagada' then
  insert into public.loja_ia_imagens_lixeira(caminho) values(old.caminho)
    on conflict(caminho) do update set criado_em=now();
 end if;
 return old;
end $$;
create or replace function public.loja_ia_lote_limpeza() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'imagens', coalesce((select jsonb_agg(id) from (select i.id from public.loja_ia_imagens i join public.loja_ia_rascunhos r on r.id=i.rascunho_id
      where i.estado <> 'apagada' and i.criado_em < now()-interval '1 day'
      and not (r.estado <> 'publicado' and coalesce((r.entrada->'materiais') ? i.id::text,false))
      and not (r.estado <> 'publicado' and i.id::text in (coalesce(r.campos->'logo'->>'valor',''),coalesce(r.campos->'capa'->>'valor',''),coalesce(r.campos->'logo'->'sugestao'->>'valor',''),coalesce(r.campos->'capa'->'sugestao'->>'valor','')))
      and not exists(select 1 from public.vitrines_lojas v where ('/api/loja/imagem/' || i.id::text) in (v.logo_url,v.capa_url,v.banner_url))
      order by i.criado_em limit 100) x),'[]'::jsonb),
    'lixeira', coalesce((select jsonb_agg(caminho) from (select caminho from public.loja_ia_imagens_lixeira where criado_em <= now()-interval '1 day' order by criado_em limit 100) x),'[]'::jsonb))
$$;
create or replace function public.loja_ia_confirmar_lixeira(p_caminho text) returns void
language sql security definer set search_path=public,pg_temp as $$
 delete from public.loja_ia_imagens_lixeira where caminho=p_caminho and criado_em<=now()-interval '1 day'
$$;
