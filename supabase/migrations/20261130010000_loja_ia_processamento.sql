create table public.loja_ia_trabalhos (
  id uuid primary key default gen_random_uuid(),
  rascunho_id uuid not null references public.loja_ia_rascunhos(id) on delete cascade,
  fonte text not null check (fonte in ('site','instagram','facebook','cnpj','whatsapp','materiais','informado','merc')),
  estado text not null default 'pendente' check (estado in ('pendente','reservado','concluido')),
  tentativa uuid,
  tentativas integer not null default 0,
  reserva_ate timestamptz,
  resultado jsonb,
  retentada_em timestamptz,
  ordem bigint generated always as identity,
  unique (rascunho_id, fonte)
);
alter table public.loja_ia_trabalhos enable row level security;
revoke all on public.loja_ia_trabalhos from public, anon, authenticated, service_role;

-- A chave de implementação só é habilitada em ambiente que tem a consulta autorizada.
create function public.loja_ia_cnpj_disponivel() returns boolean language sql stable
security definer set search_path = '' as $$
  select public.config('loja_ia.cnpj_autorizado', null, 'false'::jsonb) = 'true'::jsonb
$$;

create function public.loja_ia_iniciar(p_id uuid, p_revisao integer) returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos;
  font text; fontes text[] := '{}'; campos_ jsonb; material boolean;
begin
  select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
  if not found then raise exception 'Rascunho não encontrado.' using errcode='42501'; end if;
  if r.estado <> 'coleta' then return public.loja_ia_json(r); end if;
  if r.revisao is distinct from p_revisao then raise exception 'Rascunho atualizado em outra aba.' using errcode='40001'; end if;
  foreach font in array array['site','instagram','facebook'] loop
    if nullif(btrim(r.entrada->>font),'') is not null then fontes := array_append(fontes,font); end if;
  end loop;
  if public.loja_ia_cnpj_disponivel() and nullif(btrim(r.entrada->>'cnpj'),'') is not null then fontes := array_append(fontes,'cnpj'); end if;
  if r.entrada->'consultarWhatsapp' = 'true'::jsonb and r.whatsapp_autorizado is not null then fontes := array_append(fontes,'whatsapp'); end if;
  material := false;
  if to_regclass('public.loja_ia_imagens') is not null then
    execute 'select exists (select 1 from public.loja_ia_imagens where rascunho_id=$1 and estado=''pronta'' and $2 ? id::text)'
      into material using r.id, r.entrada->'materiais';
  end if;
  if material then fontes := array_append(fontes,'materiais'); end if;
  if cardinality(fontes)=0 and char_length(btrim(coalesce(r.entrada->>'descricao',''))) < 10 then
    raise exception 'Adicione uma fonte ou escreva pelo menos 10 caracteres sobre a loja.' using errcode='22023';
  end if;
  if char_length(btrim(r.entrada->>'nome')) not between 2 and 80 or nullif(btrim(r.entrada->>'cidade'),'') is null then
    raise exception 'Confira o nome e a cidade da loja.' using errcode='22023';
  end if;
  fontes := array['informado'] || fontes || array['merc'];
  insert into public.loja_ia_trabalhos(rascunho_id,fonte) select r.id, x from unnest(fontes) x;
  select jsonb_object_agg(x,'{"estado":"pendente"}'::jsonb) into campos_ from unnest(fontes) x;
  update public.loja_ia_rascunhos set estado='processando', fontes=campos_, revisao=revisao+1, atualizado_em=now()
    where id=r.id returning * into r;
  return public.loja_ia_json(r);
end $$;

create function public.loja_ia_worker_autorizado(p_dono text) returns boolean language sql stable
security definer set search_path='' as $$
  select exists(select 1 from public.loja_ia_convites where usuario_id=p_dono)
    and not exists(select 1 from public.contas_revogadas where usuario_id=p_dono)
    and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_dono)
    and not exists(select 1 from public.lixeira_contas where usuario_id=p_dono)
    and not exists(select 1 from public.vitrines_lojas where dono_id=p_dono and (tipo='loja' or status='suspensa'))
$$;
revoke all on function public.loja_ia_worker_autorizado(text) from public, anon, authenticated, service_role;

-- Reconsulta a autorização antes de usar dados de um perfil comercial.
create function public.loja_ia_whatsapp_consulta_atual(p_rascunho uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.loja_ia_rascunhos r join public.perfis p on p.id=r.dono_id
    where r.id=p_rascunho and r.entrada->'consultarWhatsapp'='true'::jsonb
      and p.whatsapp=r.whatsapp_autorizado and p.whatsapp_verificado_em=r.whatsapp_verificado_autorizado_em
  )
$$;
revoke all on function public.loja_ia_whatsapp_consulta_atual(uuid) from public, anon, authenticated, service_role;

create function public.loja_ia_evidencias_atuais(p_trabalho uuid,p_tentativa uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce((
    select jsonb_agg(x.valor order by a.retentada_em nulls first, a.ordem)
    from public.loja_ia_trabalhos a cross join lateral jsonb_array_elements(coalesce(a.resultado->'evidencias','[]'::jsonb)) x(valor)
    where a.rascunho_id=t.rascunho_id and a.fonte<>'merc'
      and (a.fonte<>'whatsapp' or public.loja_ia_whatsapp_consulta_atual(t.rascunho_id))
  ),'[]'::jsonb)
  from public.loja_ia_trabalhos t join public.loja_ia_rascunhos r on r.id=t.rascunho_id
  where t.id=p_trabalho and t.tentativa=p_tentativa and t.fonte='merc' and t.estado='reservado'
    and t.reserva_ate>now() and r.estado<>'publicado' and public.loja_ia_worker_autorizado(r.dono_id)
$$;
revoke all on function public.loja_ia_evidencias_atuais(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.loja_ia_evidencias_atuais(uuid,uuid) to service_role;

create function public.loja_ia_pegar(p_limite integer) returns table (
  id uuid, rascunho_id uuid, dono_id text, fonte text, tentativa uuid, entrada jsonb, evidencias jsonb
) language plpgsql security definer set search_path=public, pg_temp as $$
begin
  -- Um worker que morre repetidamente ainda deixa a revisão seguir.
  perform public.loja_ia_finalizar_fonte(t.id,t.tentativa,'{"estado":"indisponivel","motivo":"A fonte demorou para responder."}'::jsonb,true)
    from public.loja_ia_trabalhos t
    where t.estado='reservado' and t.reserva_ate <= now() and t.tentativas >= 3
    and exists(select 1 from public.loja_ia_rascunhos r where r.id=t.rascunho_id and r.estado <> 'publicado');
  return query with elegiveis as (
    select t.id
    from public.loja_ia_trabalhos t
    join public.loja_ia_rascunhos r on r.id=t.rascunho_id
    join public.loja_ia_convites c on c.usuario_id=r.dono_id
    where r.estado in ('processando','pronto')
      and public.loja_ia_worker_autorizado(r.dono_id)
      and (t.estado='pendente' or (t.estado='reservado' and t.reserva_ate <= now() and t.tentativas < 3))
      and (t.fonte <> 'merc' or not exists(
        select 1 from public.loja_ia_trabalhos o where o.rascunho_id=t.rascunho_id and o.fonte <> 'merc' and o.estado <> 'concluido'
      ))
    order by t.ordem
    limit least(greatest(coalesce(p_limite, 1),1),8)
    for update of t skip locked
  ), reservados as (
    update public.loja_ia_trabalhos t
    set estado='reservado', tentativa=gen_random_uuid(), tentativas=t.tentativas+1, reserva_ate=now()+interval '3 minutes'
    from elegiveis e where e.id=t.id returning t.*
  )
  select t.id, r.id, r.dono_id, t.fonte, t.tentativa,
    case when t.fonte='merc' or t.fonte='whatsapp' then '{}'::jsonb
      when t.fonte='cnpj' then jsonb_build_object('cnpj',r.entrada->'cnpj')
      when t.fonte='materiais' then r.entrada - array['cnpj','consultarWhatsapp','avisarWhatsapp']
      else r.entrada - array['cnpj','materiais','consultarWhatsapp','avisarWhatsapp'] end,
    '[]'::jsonb
  from reservados t join public.loja_ia_rascunhos r on r.id=t.rascunho_id;
end $$;

create function public.loja_ia_finalizar_fonte(p_trabalho uuid, p_tentativa uuid, p_resultado jsonb, p_expirada boolean) returns boolean
language plpgsql security definer set search_path=public, pg_temp as $$
declare t public.loja_ia_trabalhos; r public.loja_ia_rascunhos;
  novo_estado text; novos_campos jsonb; valor text; chave text; registro jsonb; resumo jsonb; sugestoes jsonb;
begin
  select * into t from public.loja_ia_trabalhos where id=p_trabalho;
  if not found then return false; end if;
  select * into r from public.loja_ia_rascunhos where id=t.rascunho_id for update;
  if not found or r.estado='publicado' or not public.loja_ia_worker_autorizado(r.dono_id) then return false; end if;
  select * into t from public.loja_ia_trabalhos where id=p_trabalho for update;
  if t.estado <> 'reservado' or t.tentativa is distinct from p_tentativa or
    ((t.reserva_ate <= now()) is distinct from p_expirada) or (p_expirada and t.tentativas < 3) then
    return false;
  end if;
  if t.fonte='whatsapp' and not public.loja_ia_whatsapp_consulta_atual(r.id) then
    p_resultado := '{"estado":"indisponivel","motivo":"A autorização do perfil comercial não está disponível."}'::jsonb;
  end if;
  novo_estado := p_resultado->>'estado';
  if novo_estado is null or novo_estado not in ('ok','indisponivel') or pg_column_size(p_resultado)>100000 then
    raise exception 'Resultado de fonte inválido.' using errcode='22023';
  end if;
  resumo := jsonb_strip_nulls(jsonb_build_object('estado',novo_estado,'motivo',left(p_resultado->>'motivo',240)));
  if t.fonte <> 'merc' then
    update public.loja_ia_trabalhos set estado='concluido', reserva_ate=null, resultado=p_resultado where id=t.id;
    update public.loja_ia_rascunhos set fontes=jsonb_set(fontes,array[t.fonte],resumo), atualizado_em=now() where id=r.id;
    return true;
  end if;

  -- Fontes diretas entram mesmo se a chamada da IA falhar; edições sempre vencem.
  novos_campos := r.campos;
  for chave, valor in select * from (values ('nome',r.entrada->>'nome'),('cidade',r.entrada->>'cidade'),('slug',nullif(rtrim(public.slug_texto(r.entrada->>'nome'),'-'),''))) v(k,v) loop
    if novos_campos->chave->>'valor' is null and not coalesce((novos_campos->chave->>'editado')::boolean,false) then
      novos_campos := jsonb_set(novos_campos,array[chave],jsonb_build_object('valor',valor,'editado',false,
        'origem',jsonb_build_object('fonte','informado','rotulo','Informado por você'),'sugestao',null));
    end if;
  end loop;
  sugestoes := coalesce(p_resultado->'sugestoes',(
    select jsonb_agg(x.valor order by a.retentada_em nulls first, a.ordem)
    from public.loja_ia_trabalhos a cross join lateral jsonb_array_elements(coalesce(a.resultado->'evidencias','[]'::jsonb)) x(valor)
    where a.rascunho_id=r.id and a.fonte <> 'merc'
  ),'[]'::jsonb);
  for registro in select value from jsonb_array_elements(sugestoes) loop
    chave := registro->>'campo'; valor := nullif(btrim(registro->>'valor'),'');
    if novos_campos ? chave and valor is not null and char_length(valor) <= 2048
      and (registro#>>'{origem,fonte}' <> 'whatsapp' or public.loja_ia_whatsapp_consulta_atual(r.id))
      and registro#>>'{origem,fonte}' in ('site','instagram','facebook','cnpj','materiais','whatsapp','informado')
      and char_length(registro#>>'{origem,rotulo}') between 1 and 120
      and (registro#>>'{origem,url}' is null or (char_length(registro#>>'{origem,url}') <= 2048 and registro#>>'{origem,url}' ~ '^https://[^[:space:]]+$')) then
      if novos_campos->chave->>'valor' is distinct from valor then
        if novos_campos->chave->>'valor' is null and not coalesce((novos_campos->chave->>'editado')::boolean,false) then
          novos_campos := jsonb_set(novos_campos,array[chave],jsonb_build_object('valor',valor,'editado',false,
            'origem',registro->'origem','sugestao',null));
        else
          novos_campos := jsonb_set(novos_campos,array[chave,'sugestao'],jsonb_build_object('valor',valor,'origem',registro->'origem'));
        end if;
      end if;
    end if;
  end loop;
  update public.loja_ia_trabalhos set estado='concluido', reserva_ate=null, resultado=resumo where id=t.id;
  update public.loja_ia_rascunhos set estado='pronto', campos=novos_campos, fontes=jsonb_set(fontes,array[t.fonte],resumo),
    atualizado_em=now() where id=r.id;
  return true;
end $$;

revoke all on function public.loja_ia_finalizar_fonte(uuid,uuid,jsonb,boolean) from public, anon, authenticated, service_role;
create function public.loja_ia_concluir_fonte(p_trabalho uuid,p_tentativa uuid,p_resultado jsonb) returns boolean
language sql security definer set search_path='' as $$
  select public.loja_ia_finalizar_fonte(p_trabalho,p_tentativa,p_resultado,false)
$$;

create function public.loja_ia_salvar_revisao(p_id uuid,p_revisao integer,p_edicoes jsonb) returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos; k text; v jsonb; novo jsonb;
begin
  select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
  if not found or r.estado <> 'pronto' then raise exception 'Revisão não disponível.' using errcode='42501'; end if;
  if r.revisao is distinct from p_revisao then raise exception 'Rascunho atualizado. Recarregue para continuar.' using errcode='40001'; end if;
  if jsonb_typeof(p_edicoes) is distinct from 'object' or pg_column_size(p_edicoes)>16000 then
    raise exception 'Edições inválidas.' using errcode='22023';
  end if;
  novo := r.campos;
  for k, v in select key, value from jsonb_each(p_edicoes) loop
    if not (novo ? k) or jsonb_typeof(v) not in ('string','null') then raise exception 'Campo inválido.' using errcode='22023'; end if;
    novo := jsonb_set(novo,array[k],jsonb_build_object('valor',v,'editado',true,
      'origem',case when v=r.campos->k->'sugestao'->'valor' then r.campos->k->'sugestao'->'origem'
        when v='null'::jsonb then null else '{"fonte":"informado","rotulo":"Informado por você"}'::jsonb end,'sugestao',null));
  end loop;
  update public.loja_ia_rascunhos set campos=novo, revisao=revisao+1, atualizado_em=now() where id=r.id returning * into r;
  return public.loja_ia_json(r);
end $$;

create function public.loja_ia_retentar_fonte(p_id uuid,p_fonte text) returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos;
begin
  select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
  if not found or r.estado <> 'pronto' then raise exception 'Revisão não disponível.' using errcode='42501'; end if;
  if r.fontes->p_fonte->>'estado' is distinct from 'indisponivel' then return public.loja_ia_json(r); end if;
  update public.loja_ia_trabalhos set estado='pendente', tentativa=null, tentativas=0, reserva_ate=null, retentada_em=clock_timestamp()
  where rascunho_id=r.id and fonte in (p_fonte,'merc');
  update public.loja_ia_rascunhos
    set fontes=jsonb_set(jsonb_set(fontes,array[p_fonte],'{"estado":"pendente"}'),array['merc'],'{"estado":"pendente"}'),
      revisao=revisao+1, atualizado_em=now()
    where id=r.id returning * into r;
  return public.loja_ia_json(r);
end $$;

create function public.loja_ia_disparar() returns bigint security definer
language plpgsql set search_path=public, extensions, pg_temp as $$
declare segredo text; endereco text; pedido bigint;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name='olaki_moderacao_ia_token';
  select decrypted_secret into endereco from vault.decrypted_secrets where name='olaki_loja_ia_endpoint';
  if segredo is null or length(segredo)<32
    or endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  select net.http_post(url:=endereco,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||segredo),
    body:='{}'::jsonb,timeout_milliseconds:=120000) into pedido;
  return pedido;
end $$;

revoke all on function public.loja_ia_cnpj_disponivel(), public.loja_ia_iniciar(uuid,integer),
  public.loja_ia_pegar(integer), public.loja_ia_concluir_fonte(uuid,uuid,jsonb),
  public.loja_ia_salvar_revisao(uuid,integer,jsonb), public.loja_ia_retentar_fonte(uuid,text),
  public.loja_ia_disparar() from public, anon, authenticated, service_role;
grant execute on function public.loja_ia_cnpj_disponivel(), public.loja_ia_iniciar(uuid,integer),
  public.loja_ia_salvar_revisao(uuid,integer,jsonb), public.loja_ia_retentar_fonte(uuid,text) to authenticated;
grant execute on function public.loja_ia_cnpj_disponivel(), public.loja_ia_pegar(integer),
  public.loja_ia_concluir_fonte(uuid,uuid,jsonb), public.loja_ia_disparar() to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') and exists (select 1 from pg_extension where extname='pg_net') then
    perform cron.schedule('olaki-loja-ia','* * * * *','select public.loja_ia_disparar()');
  end if;
end $$;
