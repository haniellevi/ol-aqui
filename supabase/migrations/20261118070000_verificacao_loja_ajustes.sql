-- Ajustes da revisão final da verificação de lojas:
-- 1. reconferência mensal do CNPJ só roda com a chave verificacao.reconferencia_ativa (desligada de fábrica);
-- 2. o dono da loja não escreve cnpj_conferido_em;
-- 3. a revisão manual antiga fecha o pedido aberto; aviso "dados mudaram" só quando a loja realmente espera novo envio;
--    selo removido pela Receita fecha o pedido em revisão por amostra;
-- 4. rede de segurança: pedido preso em "Conferindo" por mais de 30 minutos vai para a equipe.

-- ---------------------------------------------------------------------
-- 1. Chave da reconferência (desligada de fábrica, como as outras chaves da verificação)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('verificacao.reconferencia_ativa', 'false', 'verificacao', false, 'Liga a reconferência mensal do CNPJ das lojas verificadas na Receita. Desligada, nenhuma loja perde o selo por esse caminho.')
on conflict do nothing;

create or replace function public.verificacao_loja_reconferir_reservar(p_limite integer default 30)
returns table (vitrine_id uuid, cnpj text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  -- Chave desligada: nenhuma loja é reservada.
  if public.config('verificacao.reconferencia_ativa', null, 'false'::jsonb) <> 'true'::jsonb then
    return;
  end if;
  return query
  select l.id, l.cnpj
    from public.vitrines_lojas l
   where l.tipo = 'loja' and l.selo_loja_verificada and l.cnpj is not null
     and (l.cnpj_conferido_em is null or l.cnpj_conferido_em < now() - interval '30 days')
   order by l.cnpj_conferido_em asc nulls first, l.id
   limit greatest(least(coalesce(p_limite, 30), 100), 1);
end $$;

create or replace function public.verificacao_loja_reconferir_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; pedido bigint;
begin
  if public.config('verificacao.reconferencia_ativa', null, 'false'::jsonb) <> 'true'::jsonb then
    return null;
  end if;
  if not exists (select 1 from public.vitrines_lojas l
                  where l.tipo = 'loja' and l.selo_loja_verificada and l.cnpj is not null
                    and (l.cnpj_conferido_em is null or l.cnpj_conferido_em < now() - interval '30 days')) then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/verificacao-loja-reconferir',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 300000) into pedido;
  return pedido;
end $$;

-- ---------------------------------------------------------------------
-- 2. cnpj_conferido_em é só do servidor: o dono da loja não escreve nessa coluna
-- ---------------------------------------------------------------------
create or replace function public.proteger_verificacao_loja()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := 1;
    new.verificacao_motivo := null;
    new.selo_loja_verificada := false;
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      new.cnpj_conferido_em := null;
    end if;
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.verificacao_estado := old.verificacao_estado;
    new.verificacao_revisao := old.verificacao_revisao;
    new.verificacao_motivo := old.verificacao_motivo;
    new.selo_loja_verificada := old.selo_loja_verificada;
    new.cnpj_conferido_em := old.cnpj_conferido_em;
  end if;

  if row(new.dono_id, new.tipo, new.cnpj, new.cidade, new.bairro,
         new.microrregiao_id, new.endereco, new.lat, new.lng, new.whatsapp)
      is distinct from
     row(old.dono_id, old.tipo, old.cnpj, old.cidade, old.bairro,
         old.microrregiao_id, old.endereco, old.lat, old.lng, old.whatsapp) then
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := old.verificacao_revisao + 1;
    new.verificacao_motivo := null;
    new.selo_loja_verificada := false;
  elsif new.selo_loja_verificada and new.verificacao_estado <> 'aprovada' then
    raise exception 'Use a revisão da loja para conceder o selo.' using errcode = '23514';
  elsif old.selo_loja_verificada and not new.selo_loja_verificada and new.verificacao_estado = 'aprovada' then
    -- A ação legada de retirar o selo também cancela a aprovação.
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := old.verificacao_revisao + 1;
    new.verificacao_motivo := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3a. Revisão manual antiga: a decisão da equipe encerra o pedido aberto da loja
-- ---------------------------------------------------------------------
create or replace function public.admin_revisar_loja(p_loja uuid, p_revisao integer, p_decisao text, p_motivo text,
                                                     p_dados boolean, p_link boolean, p_whatsapp boolean)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  loja public.vitrines_lojas;
  estado text;
  acao text;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe OLAKI pode revisar lojas.' using errcode = '42501';
  end if;
  if p_decisao = 'aprovar' then
    estado := 'aprovada';
    acao := 'verificacao_aprovada';
    if p_dados is not true or p_link is not true or p_whatsapp is not true then
      raise exception 'Confirme os dados, os links e o WhatsApp antes de aprovar.' using errcode = '23514';
    end if;
  elsif p_decisao in ('correcao', 'recusar') then
    estado := case when p_decisao = 'correcao' then 'correcao' else 'recusada' end;
    acao := case when p_decisao = 'correcao' then 'verificacao_correcao' else 'verificacao_recusada' end;
    if p_motivo is null or p_motivo not in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro') then
      raise exception 'Escolha o motivo da decisão.' using errcode = '23514';
    end if;
  else
    raise exception 'Escolha uma decisão válida.' using errcode = '22023';
  end if;

  select * into loja from public.vitrines_lojas v where v.id = p_loja and v.tipo = 'loja' for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;
  if p_revisao is distinct from loja.verificacao_revisao then
    raise exception 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.' using errcode = 'P0001';
  end if;
  if estado = 'aprovada' and not public.whatsapp_confirmado(loja.dono_id) then
    raise exception 'A conta da loja precisa confirmar o WhatsApp antes da aprovação.' using errcode = '23514';
  end if;

  perform public.verificacao_loja_definir(loja.id, estado, case when estado <> 'aprovada' then p_motivo end,
                                          acao, public.usuario_id(), null);

  -- A loja decidiu por aqui: um pedido ainda aberto (IA, fila da equipe ou revisão por amostra) perde o sentido.
  -- Fecha depois da decisão, com a loja já travada (ordem: loja -> pedido). Os arquivos são apagados.
  -- Sem reserva, uma resposta tardia da IA cai em "ignorado" e não decide nada.
  update public.verificacoes_loja x
     set status = 'obsoleta', reserva = null, decidido_em = now(),
         decidido_por = (select p.id from public.perfis p where p.id = public.usuario_id()),
         comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
   where x.vitrine_id = loja.id and x.status in ('enviada', 'analisando', 'equipe', 'revisao_amostra');
end $$;

-- ---------------------------------------------------------------------
-- 3b. Aviso "falta algo / dados mudaram" ao virar obsoleta: só se a loja ainda espera um novo envio
--     (sem selo e com a situação "pendente"). Se a loja já tem selo, ou já recebeu uma decisão final
--     (revisão manual, selo removido pela Receita), o pedido some em silêncio.
-- ---------------------------------------------------------------------
create or replace function public.verificacao_loja_avisos_gatilho()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare loja public.vitrines_lojas;
begin
  if new.status is not distinct from old.status then return null; end if;
  begin
    if new.status in ('aprovada', 'revisao_amostra') then
      if old.status in ('analisando', 'equipe') then
        perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_aprovada', '{}'::jsonb, 'verificacao_aprovada:' || new.id);
      end if;
    elsif new.status = 'correcao' then
      perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_falta_algo',
        jsonb_build_object('motivo', public.verificacao_frase_motivo_loja(new.motivo)), 'verificacao_falta_algo:' || new.id);
    elsif new.status = 'obsoleta' then
      select * into loja from public.vitrines_lojas l where l.id = new.vitrine_id;
      if found and not loja.selo_loja_verificada and loja.verificacao_estado = 'pendente' then
        perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_falta_algo',
          jsonb_build_object('motivo', public.verificacao_frase_motivo_loja('dados_mudaram')), 'verificacao_falta_algo:' || new.id);
      end if;
    elsif new.status = 'recusada' then
      perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_recusada',
        jsonb_build_object('motivo', public.verificacao_frase_motivo_loja(new.motivo)), 'verificacao_recusada:' || new.id);
    elsif new.status = 'equipe' then
      select * into loja from public.vitrines_lojas l where l.id = new.vitrine_id;
      perform public.verificacao_avisar_equipe('verificacao_equipe_chamada',
        jsonb_build_object('loja', loja.nome, 'cidade', coalesce(loja.cidade, ''),
                           'motivo', public.verificacao_frase_motivos_equipe(new.motivos_equipe)),
        'verificacao_equipe_chamada:' || new.id);
    end if;
  exception when others then
    -- Aviso nunca derruba a decisão do pedido.
    raise warning 'Aviso da verificação não saiu: %', sqlerrm;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3c. Selo removido pela reconferência: o pedido em revisão por amostra fecha como obsoleto, sem segundo aviso
-- ---------------------------------------------------------------------
create or replace function public.verificacao_loja_reconferir_registrar(p_vitrine uuid, p_cnpj text, p_resultado text, p_situacao text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  l public.vitrines_lojas;
  rev integer;
  situacao text := left(nullif(btrim(p_situacao), ''), 60);
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_resultado is null or p_resultado not in ('ativa', 'inativa', 'nao_encontrada') then
    raise exception 'Resultado inválido.' using errcode = '22023';
  end if;
  select * into l from public.vitrines_lojas x where x.id = p_vitrine and x.tipo = 'loja' for update;
  -- Loja sumiu ou já sem selo (a equipe tirou no meio): nada a fazer.
  if not found or not l.selo_loja_verificada then return; end if;
  -- Resultado de um CNPJ antigo (a loja trocou de CNPJ e foi aprovada de novo no meio da rodada): não vale.
  if l.cnpj is distinct from p_cnpj then return; end if;

  if p_resultado = 'ativa' then
    update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
    return;
  end if;

  perform public.verificacao_loja_definir(l.id, 'recusada', 'cnpj_inativo', 'verificacao_selo_removido', null,
    jsonb_build_object('origem', 'receita', 'resultado', p_resultado, 'situacao', situacao));
  update public.vitrines_lojas set cnpj_conferido_em = now() where id = l.id;
  select x.verificacao_revisao into rev from public.vitrines_lojas x where x.id = l.id;

  -- Sem selo, a revisão por amostra não tem o que conferir: fecha o pedido e apaga os arquivos.
  -- A loja já está "recusada", então o gatilho dos avisos não manda o aviso de "dados mudaram".
  update public.verificacoes_loja x
     set status = 'obsoleta', reserva = null, decidido_em = now(),
         comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
   where x.vitrine_id = l.id and x.status = 'revisao_amostra';

  insert into public.verificacao_loja_avisos (vitrine_id, tipo, detalhe)
  values (l.id, 'receita_inativa', jsonb_build_object('resultado', p_resultado, 'situacao', situacao))
  on conflict (vitrine_id, tipo) where resolvido_em is null do nothing;

  -- A mudança de estado da loja não passa pelo gatilho dos pedidos: os dois avisos saem daqui, uma vez cada.
  perform public.verificacao_avisar_loja(l.id, 'verificacao_selo_removido', '{}'::jsonb, 'verificacao_selo_removido:' || l.id || ':' || rev);
  perform public.verificacao_avisar_equipe('verificacao_equipe_chamada',
    jsonb_build_object('loja', l.nome, 'cidade', coalesce(l.cidade, ''), 'motivo', 'selo removido, CNPJ não está ativo na Receita'),
    'verificacao_selo_removido_equipe:' || l.id || ':' || rev);
end $$;

-- ---------------------------------------------------------------------
-- 4. Rede de segurança do lembrete (roda a cada 15 minutos): pedido que nunca devia ficar parado
--    ("enviada" ou "analisando" há mais de 30 minutos, porque o agendador, o cofre ou a rota falharam)
--    vai para a equipe com o motivo ia_falhou. Vale com a IA ligada ou desligada.
-- ---------------------------------------------------------------------
create or replace function public.verificacao_loja_lembrar()
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare r record; horas numeric; prazo interval;
begin
  horas := coalesce(public.numero_ou_nulo(public.config('verificacao.prazo_equipe_horas', null, '24'::jsonb)), 24);
  if horas < 1 or horas > 720 then horas := 24; end if;
  prazo := make_interval(hours => horas::int);

  for r in
    select v.id from public.verificacoes_loja v
     where (v.status = 'enviada' and greatest(v.criado_em, v.proxima_em) < now() - interval '30 minutes')
        or (v.status = 'analisando' and coalesce(v.iniciado_em, v.criado_em) < now() - interval '30 minutes')
     order by v.criado_em
     for update of v skip locked
  loop
    begin
      -- O gatilho dos avisos chama a equipe (status 'equipe'); o prazo conta a partir de agora.
      update public.verificacoes_loja
         set status = 'equipe', motivos_equipe = '{ia_falhou}', encaminhada_em = now(), prazo_em = now() + prazo
       where id = r.id;
    exception when others then
      raise warning 'Pedido parado não foi encaminhado: %', sqlerrm;
    end;
  end loop;

  for r in
    select v.id, l.nome from public.verificacoes_loja v join public.vitrines_lojas l on l.id = v.vitrine_id
     where v.status = 'equipe' and v.prazo_em < now()
       and (v.lembrete_em is null or v.lembrete_em < now() - interval '24 hours')
     order by v.prazo_em
     for update of v skip locked
  loop
    begin
      perform public.verificacao_avisar_equipe('verificacao_equipe_atrasada', jsonb_build_object('loja', r.nome),
        'atraso:' || r.id || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'));
      update public.verificacoes_loja set lembrete_em = now() where id = r.id;
    exception when others then
      -- Um pedido com problema não pode parar o lembrete dos outros.
      raise warning 'Lembrete da verificação não saiu: %', sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Permissões (repetidas após cada create or replace)
-- ---------------------------------------------------------------------
revoke all on function public.verificacao_loja_reconferir_reservar(integer), public.verificacao_loja_reconferir_registrar(uuid, text, text, text),
  public.verificacao_loja_reconferir_disparar(), public.proteger_verificacao_loja(),
  public.admin_revisar_loja(uuid, integer, text, text, boolean, boolean, boolean),
  public.verificacao_loja_avisos_gatilho(), public.verificacao_loja_lembrar()
  from public, anon, authenticated, service_role;
grant execute on function public.verificacao_loja_reconferir_reservar(integer), public.verificacao_loja_reconferir_registrar(uuid, text, text, text),
  public.verificacao_loja_reconferir_disparar() to service_role;
grant execute on function public.admin_revisar_loja(uuid, integer, text, text, boolean, boolean, boolean) to authenticated;
