-- Fila da equipe na verificação de lojas: lista os pedidos encaminhados e as aprovações da IA em revisão por amostra,
-- entrega os arquivos só para quem é da equipe, decide pela função única (verificacao_loja_definir) e apaga os
-- arquivos na saída. Também lista e resolve os avisos da equipe e limpa as amostras vencidas todo dia.
-- Quem pode: tem_papel('suporte') = administrador ou suporte (igual à fila de vendedores individuais).

-- ---------------------------------------------------------------------
-- 1. Fila
-- ---------------------------------------------------------------------
create function public.admin_fila_verificacao_loja()
returns table (id uuid, vitrine_id uuid, loja_nome text, cidade text, cnpj text, status text, motivos_equipe text[], parecer jsonb,
               criado_em timestamptz, prazo_em timestamptz, atrasada boolean, amostra boolean, tem_fachada boolean)
language plpgsql stable security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode consultar a fila.' using errcode = '42501';
  end if;
  return query
  select v.id, v.vitrine_id, l.nome, l.cidade, v.cnpj, v.status, v.motivos_equipe, v.parecer,
         v.criado_em, v.prazo_em,
         (v.status = 'equipe' and v.prazo_em is not null and v.prazo_em < now()),
         v.amostra, (v.fachada is not null)
    from public.verificacoes_loja v
    join public.vitrines_lojas l on l.id = v.vitrine_id
   where v.status in ('equipe', 'revisao_amostra')
   order by v.criado_em, v.id
   limit 50;
end $$;

-- ---------------------------------------------------------------------
-- 2. Arquivo (nunca sai por outro caminho)
-- ---------------------------------------------------------------------
create function public.admin_arquivo_verificacao_loja(p_id uuid, p_tipo text)
returns table (arquivo_base64 text, mime text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode consultar os arquivos.' using errcode = '42501';
  end if;
  return query
  select encode(case when p_tipo = 'fachada' then v.fachada else v.comprovante end, 'base64'),
         case when p_tipo = 'fachada' then v.tipo_fachada else v.tipo_comprovante end
    from public.verificacoes_loja v
   where v.id = p_id and v.status in ('equipe', 'revisao_amostra') and p_tipo in ('comprovante', 'fachada')
     and (case when p_tipo = 'fachada' then v.fachada else v.comprovante end) is not null;
end $$;

-- ---------------------------------------------------------------------
-- 3. Decisão da equipe
-- ---------------------------------------------------------------------
-- equipe:          aprovar (exige p_conferido), correcao, recusar (exigem motivo)
-- revisao_amostra: confirmar, tirar_selo (exige motivo)
create function public.admin_decidir_verificacao_loja(p_id uuid, p_decisao text, p_motivo text, p_conferido boolean)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  vid uuid;
  l public.vitrines_lojas;
  v public.verificacoes_loja;
  ator text;
  v_motivo text := nullif(btrim(p_motivo), '');
  mudou constant text := 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.';
  ident text;
  estado text;
  acao text;
  atual boolean;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode decidir o pedido.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'correcao', 'recusar', 'confirmar', 'tirar_selo') then
    raise exception 'Escolha uma decisão válida.' using errcode = '22023';
  end if;
  ator := public.usuario_id();

  -- Mesma ordem de trava do envio e da IA: loja primeiro, pedido depois.
  select x.vitrine_id into vid from public.verificacoes_loja x where x.id = p_id;
  if vid is null then raise exception '%', mudou using errcode = 'P0001'; end if;
  select * into l from public.vitrines_lojas x where x.id = vid and x.tipo = 'loja' for update;
  if not found then raise exception 'Loja não encontrada.' using errcode = '22023'; end if;
  select * into v from public.verificacoes_loja x where x.id = p_id for update;

  -- Outro da equipe (ou a rotina) pode ter decidido antes: o pedido precisa estar no status que esta decisão espera.
  if v.status is distinct from (case when p_decisao in ('aprovar', 'correcao', 'recusar') then 'equipe' else 'revisao_amostra' end) then
    raise exception '%', mudou using errcode = 'P0001';
  end if;

  if p_decisao in ('correcao', 'recusar', 'tirar_selo')
     and (v_motivo is null or v_motivo not in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro',
                                           'arquivo_ilegivel', 'comprovante_invalido', 'cnpj_inativo', 'cnpj_nao_encontrado', 'dados_mudaram')) then
    raise exception 'Escolha o motivo da decisão.' using errcode = '23514';
  end if;

  if p_decisao = 'aprovar' then
    if p_conferido is not true then
      raise exception 'Confirme que você conferiu o comprovante antes de aprovar.' using errcode = '23514';
    end if;
    -- O cadastro precisa ser o mesmo que foi enviado (aprovar dados que mudaram seria aprovar outra coisa).
    ident := md5(concat_ws('|', coalesce(l.cidade, ''), coalesce(l.bairro, ''), coalesce(l.endereco, ''),
                           coalesce(l.whatsapp, ''), coalesce(l.microrregiao_id::text, ''), v.cnpj));
    if ident is distinct from v.identidade or l.verificacao_revisao is distinct from v.revisao_loja or l.status <> 'ativa' then
      raise exception '%', mudou using errcode = 'P0001';
    end if;
    if not public.whatsapp_confirmado(l.dono_id) then
      raise exception 'A conta da loja precisa confirmar o WhatsApp antes da aprovação.' using errcode = '23514';
    end if;
    -- Grava o CNPJ ANTES da decisão (gravar reabre a verificação; a decisão abaixo fecha de novo), sem repetir o de outra loja.
    perform pg_advisory_xact_lock(hashtext('verificacao_cnpj:' || v.cnpj));
    if exists (select 1 from public.vitrines_lojas o where o.id <> l.id and o.cnpj = v.cnpj) then
      raise exception 'Este CNPJ já está em outra loja. Peça a correção ou recuse.' using errcode = '23514';
    end if;
    begin
      update public.vitrines_lojas set cnpj = v.cnpj where id = l.id and cnpj is distinct from v.cnpj;
    exception when unique_violation then
      raise exception 'Este CNPJ já está em outra loja. Peça a correção ou recuse.' using errcode = '23514';
    end;
    perform public.verificacao_loja_definir(l.id, 'aprovada', null, 'verificacao_aprovada', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'equipe'));
    update public.verificacoes_loja
       set status = 'aprovada', motivo = null, decidido_em = now(), decidido_por = ator, reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;

  elsif p_decisao in ('correcao', 'recusar') then
    -- Cadastro que mudou não impede pedir correção nem recusar: senão o pedido ficaria preso na fila.
    estado := case when p_decisao = 'correcao' then 'correcao' else 'recusada' end;
    acao := case when p_decisao = 'correcao' then 'verificacao_correcao' else 'verificacao_recusada' end;
    update public.verificacoes_loja
       set status = estado, motivo = v_motivo, decidido_em = now(), decidido_por = ator, reserva = null,
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;
    perform public.verificacao_loja_definir(l.id, estado, v_motivo, acao, ator, jsonb_build_object('pedido', v.id, 'origem', 'equipe'));

  elsif p_decisao = 'confirmar' then
    -- A aprovação da IA só se confirma enquanto o selo ainda vale.
    atual := l.selo_loja_verificada and l.verificacao_estado = 'aprovada';
    if not atual then raise exception '%', mudou using errcode = 'P0001'; end if;
    perform public.verificacao_loja_definir(l.id, 'aprovada', null, 'verificacao_revisada', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'amostra'));
    update public.verificacoes_loja
       set status = 'aprovada', decidido_em = now(), decidido_por = ator, reserva = null,
           parecer = parecer || jsonb_build_array(jsonb_build_object('item', 'revisao_humana', 'ok', true)),
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;

  else  -- tirar_selo
    atual := l.selo_loja_verificada and l.verificacao_estado = 'aprovada';
    if not atual then raise exception '%', mudou using errcode = 'P0001'; end if;
    -- O pedido muda de status aqui: o gatilho do WhatsApp/sino já avisa a loja ("falta algo"). A equipe ganha só o aviso da lista.
    update public.verificacoes_loja
       set status = 'correcao', motivo = v_motivo, decidido_em = now(), decidido_por = ator, reserva = null,
           parecer = parecer || jsonb_build_array(jsonb_build_object('item', 'revisao_humana', 'ok', false, 'nota', 'selo removido')),
           comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = v.id;
    perform public.verificacao_loja_definir(l.id, 'correcao', v_motivo, 'verificacao_selo_removido', ator,
      jsonb_build_object('pedido', v.id, 'origem', 'amostra'));
    insert into public.verificacao_loja_avisos (vitrine_id, tipo, detalhe)
    values (l.id, 'amostra_erro', jsonb_build_object('pedido', v.id, 'motivo', v_motivo))
    on conflict (vitrine_id, tipo) where resolvido_em is null do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Avisos para a equipe
-- ---------------------------------------------------------------------
create function public.admin_avisos_verificacao_loja()
returns table (id uuid, vitrine_id uuid, loja_nome text, tipo text, detalhe jsonb, criado_em timestamptz)
language plpgsql stable security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode consultar os avisos.' using errcode = '42501';
  end if;
  return query
  select a.id, a.vitrine_id, l.nome, a.tipo, a.detalhe, a.criado_em
    from public.verificacao_loja_avisos a
    join public.vitrines_lojas l on l.id = a.vitrine_id
   where a.resolvido_em is null
   order by a.criado_em, a.id
   limit 100;
end $$;

create function public.admin_resolver_aviso_verificacao(p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode resolver avisos.' using errcode = '42501';
  end if;
  update public.verificacao_loja_avisos a
     set resolvido_em = now(), resolvido_por = public.usuario_id()
   where a.id = p_id and a.resolvido_em is null;
  if not found then
    raise exception 'Este aviso já foi marcado como visto. Atualize a página.' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Amostras vencidas: sem revisão no prazo, a aprovação da IA fica e os arquivos são apagados
-- ---------------------------------------------------------------------
create function public.verificacao_loja_limpar_amostras()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  -- Se o cadastro mudou e o selo já caiu, o pedido vira obsoleto (não vira "aprovada" sem selo).
  update public.verificacoes_loja v
     set status = case when l.selo_loja_verificada then 'aprovada' else 'obsoleta' end,
         parecer = case when l.selo_loja_verificada
                        then v.parecer || jsonb_build_array(jsonb_build_object('item', 'revisao_humana', 'ok', null, 'nota', 'não revisada'))
                        else v.parecer end,
         comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
    from public.vitrines_lojas l
   where l.id = v.vitrine_id and v.status = 'revisao_amostra' and v.prazo_em < now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.admin_fila_verificacao_loja(), public.admin_arquivo_verificacao_loja(uuid, text),
  public.admin_decidir_verificacao_loja(uuid, text, text, boolean), public.admin_avisos_verificacao_loja(),
  public.admin_resolver_aviso_verificacao(uuid), public.verificacao_loja_limpar_amostras()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_fila_verificacao_loja(), public.admin_arquivo_verificacao_loja(uuid, text),
  public.admin_decidir_verificacao_loja(uuid, text, text, boolean), public.admin_avisos_verificacao_loja(),
  public.admin_resolver_aviso_verificacao(uuid) to authenticated;
grant execute on function public.verificacao_loja_limpar_amostras() to service_role;

-- Todo dia às 06:00 (Fortaleza = 09:00 UTC). Só roda onde o pg_cron existe (Supabase); nos testes não há.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-verificacao-amostras', '0 9 * * *', 'select public.verificacao_loja_limpar_amostras()');
  end if;
end $$;
