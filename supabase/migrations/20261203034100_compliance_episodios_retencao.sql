-- Episódios jurídicos usam o ID monotônico da auditoria existente, não atualizado_em.
-- Empates de now() numa mesma transação continuam distinguíveis pelo ID do log.
create function public.compliance_retencao_atual(p_tipo text,p_item uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('retencao_id',l.id::text,'retencao_em',l.criado_em,
    'retencao_motivo',case when p_tipo='anuncio' then l.dados_depois->>'congelado_motivo'
                         else l.dados_depois->>'moderado_motivo' end)
  from public.logs_atividade l
  where l.tabela=case when p_tipo='anuncio' then 'anuncios' else 'radar_pedidos' end
    and l.registro_id=p_item::text and l.acao in ('INSERT','UPDATE')
    and case when p_tipo='anuncio' then
      (l.dados_depois->>'congelado_motivo' is not null and
        (l.dados_antes->>'congelado_motivo' is distinct from l.dados_depois->>'congelado_motivo'
          or (l.dados_depois->>'status'='congelado' and l.dados_antes->>'status' is distinct from 'congelado')))
      or (l.dados_depois->>'status'='congelado' and l.dados_antes->>'status' is distinct from 'congelado')
    else l.dados_depois->>'status'='congelado' and
      (l.dados_antes->>'status' is distinct from 'congelado'
        or l.dados_antes->>'moderado_motivo' is distinct from l.dados_depois->>'moderado_motivo') end
  order by l.id desc limit 1),jsonb_build_object('retencao_id','legado','retencao_em',null,
    'retencao_motivo',case when p_tipo='anuncio' then (select a.congelado_motivo from public.anuncios a where a.id=p_item)
                         else (select p.moderado_motivo from public.radar_pedidos p where p.id=p_item) end))
$$;
revoke all on function public.compliance_retencao_atual(text,uuid) from public,anon,authenticated;

-- Os eventos anteriores já eram protegidos contra novo congelamento; representam
-- o episódio atual. Guarda também a prova original no evento permanente.
update public.admin_gestao_eventos e
set detalhes=e.detalhes || public.compliance_retencao_atual(e.detalhes->>'tipo',(e.detalhes->>'item')::uuid)
where e.acao='compliance_liberar_retencao' and not e.detalhes ? 'retencao_id';
drop index public.compliance_liberacao_item;
create unique index compliance_liberacao_item on public.admin_gestao_eventos
  ((detalhes->>'tipo'),(detalhes->>'item'),(detalhes->>'retencao_id')) where acao='compliance_liberar_retencao';

drop function public.compliance_liberar_retencao(uuid,text,uuid,text);
create function public.compliance_liberar_retencao(p_consulta uuid, p_tipo text, p_item uuid, p_motivo text, p_retencao text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  a public.anuncios; p public.radar_pedidos; evento uuid;
  alvo text; tipo text; estado text; retido boolean; retencao jsonb;
begin
  if not public.e_admin() then raise exception 'Acesso não permitido.' using errcode='42501'; end if;
  perform public.compliance_consulta_valida(p_consulta);
  if p_tipo is null or p_tipo not in ('anuncio','pedido') or p_item is null
    or p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 300 then
    raise exception 'Informe o item e um motivo de 3 a 300 caracteres.' using errcode='22023';
  end if;
  if p_tipo='anuncio' then
    select * into a from public.anuncios where id=p_item for update;
    if not found then raise exception 'Item não encontrado.' using errcode='P0002'; end if;
    alvo:=a.vitrine_id::text; tipo:='loja'; estado:=a.status::text;
    -- Não libera por tabela a retenção pertencente a um pedido relacionado.
    retido:=a.status='congelado' or a.congelado_motivo is not null or a.status_antes_exclusao='congelado';
  else
    select * into p from public.radar_pedidos where id=p_item for update;
    if not found then raise exception 'Item não encontrado.' using errcode='P0002'; end if;
    alvo:=p.comprador_id; tipo:='usuario'; estado:=p.status;
    retido:=p.status='congelado';
  end if;
  retencao:=public.compliance_retencao_atual(p_tipo,p_item);
  if p_retencao is distinct from retencao->>'retencao_id' then
    raise exception 'A retenção mudou. Atualize a consulta antes de confirmar.' using errcode='55000'; end if;
  select id into evento from public.admin_gestao_eventos
    where acao='compliance_liberar_retencao' and detalhes->>'tipo'=p_tipo and detalhes->>'item'=p_item::text
      and detalhes->>'retencao_id'=retencao->>'retencao_id';
  if found then return evento; end if;
  if not coalesce(retido,false) then raise exception 'Este item não possui retenção própria.' using errcode='P0002'; end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo,detalhes,criado_em)
  values(tipo,alvo,public.usuario_id(),'compliance_liberar_retencao',btrim(p_motivo),
    jsonb_build_object('tipo',p_tipo,'item',p_item,'estado','revisao_manual_pendente',
      'estado_comercial',estado,'consulta',p_consulta) || retencao,clock_timestamp()) returning id into evento;
  return evento;
end $$;
revoke all on function public.compliance_liberar_retencao(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.compliance_liberar_retencao(uuid,text,uuid,text,text) to authenticated;

-- O evento é o estado persistente. Não se apaga nem se sobrescreve o motivo original.
drop function public.compliance_revisar_retencao(uuid,text,uuid,text);
create function public.compliance_revisar_retencao(p_consulta uuid,p_tipo text,p_item uuid,p_motivo text,p_retencao text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.admin_gestao_eventos; resultado uuid;
begin
  if not public.e_admin() then raise exception 'Acesso não permitido.' using errcode='42501'; end if;
  perform public.compliance_consulta_valida(p_consulta);
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 300 then
    raise exception 'Escreva um motivo de 3 a 300 caracteres.' using errcode='22023'; end if;
  if p_tipo='anuncio' then perform 1 from public.anuncios where id=p_item for update;
  elsif p_tipo='pedido' then perform 1 from public.radar_pedidos where id=p_item for update;
  else raise exception 'Tipo inválido.' using errcode='22023'; end if;
  if p_retencao is distinct from public.compliance_retencao_atual(p_tipo,p_item)->>'retencao_id' then
    raise exception 'A retenção mudou. Atualize a consulta antes de confirmar.' using errcode='55000'; end if;
  select * into e from public.admin_gestao_eventos where acao='compliance_liberar_retencao'
    and detalhes->>'tipo'=p_tipo and detalhes->>'item'=p_item::text
    and detalhes->>'retencao_id'=public.compliance_retencao_atual(p_tipo,p_item)->>'retencao_id' for update;
  if not found then raise exception 'Revisão não encontrada.' using errcode='P0002'; end if;
  -- Retry da mesma anotação não duplica o histórico.
  select id into resultado from public.admin_gestao_eventos where acao='compliance_revisar_retencao'
    and detalhes->>'liberacao'=e.id::text and autor=public.usuario_id() and motivo=btrim(p_motivo);
  if found then return resultado; end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo,detalhes,criado_em)
  values(e.tipo,e.alvo,public.usuario_id(),'compliance_revisar_retencao',btrim(p_motivo),
    e.detalhes || jsonb_build_object('liberacao',e.id,'consulta',p_consulta),clock_timestamp()) returning id into resultado;
  return resultado;
end $$;
revoke all on function public.compliance_revisar_retencao(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.compliance_revisar_retencao(uuid,text,uuid,text,text) to authenticated;

create or replace function public.compliance_fila_retencoes(p_consulta uuid,p_pagina integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not public.e_admin() then raise exception 'Acesso não permitido.' using errcode='42501'; end if;
  perform public.compliance_consulta_valida(p_consulta);
  if p_pagina is null or p_pagina not between 0 and 100000 then
    raise exception 'Página inválida.' using errcode='22023'; end if;
  with itens as (
    select 'anuncio'::text tipo,a.id,a.titulo,a.status::text estado_comercial from public.anuncios a
      where a.status='congelado' or a.congelado_motivo is not null or a.status_antes_exclusao='congelado'
    union all
    select 'pedido',p.id,p.titulo,p.status::text from public.radar_pedidos p where p.status='congelado'
  ), pagina as (
    select i.*,public.compliance_retencao_atual(i.tipo,i.id) as retencao,e.id liberacao,e.motivo,e.autor,e.criado_em,
      case when e.id is null then 'retido' else 'revisao_manual_pendente' end estado,
      (select jsonb_build_object('motivo',r.motivo,'autor',r.autor,'criado_em',r.criado_em)
        from public.admin_gestao_eventos r where r.acao='compliance_revisar_retencao'
          and r.detalhes->>'liberacao'=e.id::text order by r.criado_em desc,r.id limit 1) ultima_revisao
    from itens i left join public.admin_gestao_eventos e on e.acao='compliance_liberar_retencao'
      and e.detalhes->>'tipo'=i.tipo and e.detalhes->>'item'=i.id::text
      and e.detalhes->>'retencao_id'=public.compliance_retencao_atual(i.tipo,i.id)->>'retencao_id'
    order by i.tipo,i.id limit 51 offset p_pagina*50
  ) select coalesce(jsonb_agg((to_jsonb(pagina)-'retencao') || pagina.retencao),'[]') into resultado from pagina;
  return resultado;
end $$;
revoke all on function public.compliance_fila_retencoes(uuid,integer) from public,anon;
grant execute on function public.compliance_fila_retencoes(uuid,integer) to authenticated;

-- Trava final: restauração/moderação antiga não pode concluir a revisão implicitamente.
create or replace function public.compliance_preservar_revisao()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text:=case when tg_table_name='anuncios' then 'anuncio' else 'pedido' end;
begin
  if exists(select 1 from public.admin_gestao_eventos e where e.acao='compliance_liberar_retencao'
    and e.detalhes->>'tipo'=v_tipo and e.detalhes->>'item'=old.id::text) then
    if tg_table_name='anuncios' then
      -- A liberação de um ativo não retira a competência já existente de aplicar
      -- outro congelamento. O log AFTER UPDATE identifica o novo episódio.
      if old.status='ativo' and new.status='congelado' and public.e_admin()
        and char_length(btrim(new.congelado_motivo)) between 3 and 300 then return new; end if;
      if new.congelado_motivo is distinct from old.congelado_motivo then
        raise exception 'Preservação da revisão manual pendente.' using errcode='55000';
      end if;
      if old.status in ('excluido','congelado') and
        (new.status is distinct from old.status or new.fotos is distinct from old.fotos
          or (new.titulo,new.descricao,new.atributos,new.preco_centavos,new.vitrine_id)
            is distinct from (old.titulo,old.descricao,old.atributos,old.preco_centavos,old.vitrine_id)
          or new.congelado_motivo is distinct from old.congelado_motivo
          or new.status_antes_exclusao is distinct from old.status_antes_exclusao
          or new.excluido_em is distinct from old.excluido_em) then
        raise exception 'Revisão manual pendente: registre a decisão de destino antes de alterar o item.' using errcode='55000';
      end if;
    elsif (new.status,new.arquivado_em,new.titulo,new.detalhes,new.atributos)
      is distinct from (old.status,old.arquivado_em,old.titulo,old.detalhes,old.atributos) then
      raise exception 'Revisão manual pendente: registre a decisão de destino antes de alterar o pedido.' using errcode='55000';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.compliance_preservar_revisao() from public,anon,authenticated;
