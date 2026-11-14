-- A criação manual e o piloto passam pelo mesmo lock, inclusive quando ainda não há vitrine.
create function public.loja_criacao_travar(p_dono text) returns void
language sql set search_path='' as $$
  select pg_advisory_xact_lock(hashtextextended('criar-loja:' || p_dono, 0))
$$;
revoke all on function public.loja_criacao_travar(text) from public, anon, authenticated, service_role;

create or replace function public.quero_vender(
  tipo text, nome_loja text default null, slug text default null,
  whatsapp text default null, cidade text default null)
returns public.vendedor_resumo
language plpgsql security definer
set search_path = public
as $$
declare
  uid      text := public.usuario_id();
  v_tipo   text := lower(btrim(coalesce(quero_vender.tipo, '')));
  v_nome   text := btrim(coalesce(quero_vender.nome_loja, ''));
  v_slug   text := lower(btrim(coalesce(quero_vender.slug, '')));
  v_fone   text := regexp_replace(coalesce(quero_vender.whatsapp, ''), '[^0-9]', '', 'g');
  v_cidade text := nullif(btrim(coalesce(quero_vender.cidade, '')), '');
  pf       public.perfis;
  v        public.vitrines_lojas;
  sede     text;
  dias     integer;
  plano_pf text;
  plano_teste text;
  tentativa integer := 0;
  restricao text;
  r        public.vendedor_resumo;
begin
  if uid is null then
    raise exception 'Faça login para vender.' using errcode = '28000';
  end if;
  perform public.loja_criacao_travar(uid);
  select * into pf from public.perfis where id = uid;
  if pf.id is null then
    raise exception 'Complete seu cadastro antes de vender.' using errcode = 'P0001';
  end if;
  if v_tipo not in ('pf', 'loja') then
    raise exception 'Escolha como você quer vender: suas coisas ou sua loja.' using errcode = '22023';
  end if;

  select * into v from public.vitrines_lojas where dono_id = uid for update;
  if v.id is not null and v.status = 'suspensa' then
    raise exception 'Sua conta de vendedor está suspensa. Fale com o suporte.' using errcode = '42501';
  end if;
  select m.cidade_sede into sede from public.microrregioes m where m.id = pf.microrregiao_id;
  v_cidade := coalesce(v_cidade, v.cidade, pf.cidade, sede);

  if v_tipo = 'pf' then
    if v.id is null then
      if v_cidade is null then
        raise exception using errcode = '23514', message = 'Informe sua cidade.', detail = 'campo:cidade';
      end if;
      plano_pf := public.config('pf.plano_inicial', pf.microrregiao_id, '"pf_gratis"') #>> '{}';
      loop
        -- endereço interno (a pessoa física não tem página de loja)
        v_slug := 'pf-' || substr(md5(uid || tentativa::text), 1, 12);
        exit when not exists (select 1 from public.vitrines_lojas x where x.slug = v_slug);
        tentativa := tentativa + 1;
      end loop;
      insert into public.vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, bairro, whatsapp,
                                         tipo, plano, status, teste_expira_em)
      -- pessoa física aparece só pelo primeiro nome e sem bairro (privacidade)
      values (uid, pf.microrregiao_id, v_slug, left(split_part(btrim(pf.nome), ' ', 1), 80), v_cidade, null, null,
              'pf', plano_pf, 'ativa', now())
      returning * into v;
    end if;
    -- já vende (como PF ou loja): nada muda
  else
    -- loja
    if char_length(v_nome) not between 2 and 80 then
      raise exception using errcode = '23514', message = 'Escreva o nome da loja (de 2 a 80 letras).', detail = 'campo:nome_loja';
    end if;
    if public.normalizar_nome_loja(v_nome) = '' then
      raise exception using errcode = '23514', message = 'O nome da loja precisa conter letra ou número.', detail = 'campo:nome_loja';
    end if;
    if v_slug !~ '^[a-z0-9-]{3,60}$' then
      raise exception using errcode = '23514',
        message = 'O endereço da loja deve ter de 3 a 60 letras minúsculas, números ou hífen, sem espaço nem acento.',
        detail = 'campo:slug';
    end if;
    if exists (select 1 from public.vitrines_lojas x where x.slug = v_slug and x.dono_id <> uid) then
      raise exception using errcode = '23505',
        message = format('O endereço olaki.com.br/loja/%s já está em uso. Escolha outro.', v_slug), detail = 'campo:slug';
    end if;
    if v_fone = '' then
      v_fone := coalesce(v.whatsapp, pf.whatsapp, '');
    elsif v_fone ~ '^[1-9][0-9]9?[0-9]{8}$' then
      v_fone := '55' || v_fone;            -- veio sem o 55
    end if;
    if v_fone = '' then
      raise exception using errcode = '23514', message = 'Informe o WhatsApp da loja.', detail = 'campo:whatsapp';
    end if;
    if v_fone !~ '^55[1-9][0-9]9?[0-9]{8}$' then
      raise exception using errcode = '23514', message = 'WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.', detail = 'campo:whatsapp';
    end if;
    if v_cidade is null then
      raise exception using errcode = '23514', message = 'Informe a cidade da loja.', detail = 'campo:cidade';
    end if;
    dias := coalesce((public.config('teste.dias', pf.microrregiao_id, '30') #>> '{}')::int, 30);
    plano_teste := coalesce(public.config('loja.plano_teste', pf.microrregiao_id, '"teste"') #>> '{}', 'teste');

    begin
      if v.id is null then
        insert into public.vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, bairro, whatsapp,
                                           tipo, plano, status, teste_expira_em)
        values (uid, pf.microrregiao_id, v_slug, v_nome, v_cidade, pf.bairro, v_fone,
                'loja', plano_teste, 'ativa', now() + make_interval(days => dias))
        returning * into v;
      elsif v.tipo = 'pf' then
        -- pessoa vira loja sem perder os anúncios; começa o teste grátis
        -- (se estiver num plano pago em dia, mantém o plano)
        update public.vitrines_lojas x
           set tipo = 'loja', nome = v_nome, slug = v_slug, whatsapp = v_fone, cidade = v_cidade,
               plano = case when coalesce((public.plano_efetivo(v)).preco_centavos, 0) = 0 then plano_teste else x.plano end,
               teste_expira_em = case when coalesce((public.plano_efetivo(v)).preco_centavos, 0) = 0
                                      then now() + make_interval(days => dias) else x.teste_expira_em end
         where x.id = v.id
        returning * into v;
      else
        -- já é loja: só atualiza os dados (não reinicia o teste)
        update public.vitrines_lojas x
           set nome = v_nome, slug = v_slug, whatsapp = v_fone, cidade = v_cidade
         where x.id = v.id
        returning * into v;
      end if;
    exception when unique_violation then
      get stacked diagnostics restricao = constraint_name;
      if restricao = 'vitrines_nome_loja_unico' then
        raise exception using errcode = '23505', constraint = restricao,
          message = 'Já existe uma loja com este nome. Informe um nome que identifique sua loja.',
          detail = 'campo:nome_loja';
      elsif restricao in ('vitrines_slug_unico', 'vitrines_lojas_microrregiao_id_slug_key') then
        raise exception using errcode = '23505', constraint = restricao,
          message = 'Este endereço de vitrine já está em uso. Escolha outro.', detail = 'campo:slug';
      end if;
      raise;
    end;
  end if;

  r := (v.id, v.tipo, v.slug, v.nome, v.plano, v.teste_expira_em, v.plano_expira_em);
  return r;
end $$;

-- Um formulário manual aberto antes da publicação do piloto só devolve o resultado já criado.
create function public.loja_cadastro_manual(p_nome text,p_slug text,p_whatsapp text,p_cidade text,p_categoria text,p_sobre text)
returns public.vendedor_resumo language plpgsql security definer set search_path='' as $$
declare uid text := public.usuario_id(); v public.vitrines_lojas; res public.vendedor_resumo;
begin
  perform public.loja_criacao_travar(uid);
  select l.* into v from public.vitrines_lojas l where l.dono_id=uid and l.tipo='loja'
    and exists(select 1 from public.loja_ia_rascunhos r where r.dono_id=uid and r.vitrine_id=l.id and r.estado='publicado');
  if found then
    return (v.id,v.tipo,v.slug,v.nome,v.plano,v.teste_expira_em,v.plano_expira_em)::public.vendedor_resumo;
  end if;
  res := public.quero_vender_com_descricao(p_nome,p_slug,p_whatsapp,p_cidade,p_categoria,p_sobre);
  update public.loja_ia_rascunhos set estado='publicado', vitrine_id=res.vitrine_id, revisao=revisao+1, atualizado_em=now()
    where dono_id=uid and estado<>'publicado';
  return res;
end $$;
revoke all on function public.loja_cadastro_manual(text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.loja_cadastro_manual(text,text,text,text,text,text) to authenticated;

-- Checagem pontual para imagens vinculadas ao cadastro, sem alterar os paths aceitos em outros fluxos.
create function public.loja_ia_imagem_aprovada(p_vitrine uuid,p_dono text,p_url text,p_uso text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.loja_ia_imagens_vinculos v
    join public.loja_ia_imagens i on i.id=v.imagem_id and i.estado='pronta'
    join public.loja_ia_rascunhos r on r.id=i.rascunho_id and r.dono_id=p_dono
    where v.vitrine_id=p_vitrine and v.uso=p_uso and p_url='/api/loja/imagem/' || i.id::text
  )
$$;
revoke all on function public.loja_ia_imagem_aprovada(uuid,text,text,text) from public, anon;
grant execute on function public.loja_ia_imagem_aprovada(uuid,text,text,text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validar_imagens_vitrine()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if public.acesso_sistema() or (new.logo_url is null and new.capa_url is null) then
    return new;
  end if;
  if nullif(public.config_publica('fotos.origem', null, 'null') #>> '{}', '') is null then
    raise exception using errcode = 'P0001',
      message = 'As imagens ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
  end if;
  if new.logo_url is not null and (tg_op = 'INSERT' or new.logo_url is distinct from old.logo_url)
     and not coalesce(public.foto_do_olaki(new.logo_url, new.dono_id, 'loja'), false)
     and not public.loja_ia_imagem_aprovada(new.id, new.dono_id, new.logo_url, 'logo') then
    raise exception using errcode = '22023', message = 'Envie a logo pelo botão do OLAKI.', detail = 'campo:logo_url';
  end if;
  if new.capa_url is not null and (tg_op = 'INSERT' or new.capa_url is distinct from old.capa_url)
     and not coalesce(public.foto_do_olaki(new.capa_url, new.dono_id, 'loja'), false)
     and not public.loja_ia_imagem_aprovada(new.id, new.dono_id, new.capa_url, 'capa') then
    raise exception using errcode = '22023', message = 'Envie a capa pelo botão do OLAKI.', detail = 'campo:capa_url';
  end if;
  return new;
end $function$;

-- O vínculo das imagens é criado e verificado dentro da própria publicação.
create function public.loja_ia_publicar(p_id uuid,p_revisao integer,p_campos jsonb,p_imagens jsonb) returns public.vendedor_resumo
language plpgsql security definer set search_path=public, pg_temp as $$
declare
  uid text := public.usuario_id();
  r public.loja_ia_rascunhos;
  v public.vitrines_lojas;
  res public.vendedor_resumo;
  logo text;
  capa text;
begin
  if uid is null then raise exception 'Faça login para continuar.' using errcode='28000'; end if;
  perform public.loja_criacao_travar(uid);
  select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
  if not found then raise exception 'Rascunho não encontrado.' using errcode='42501'; end if;
  if r.estado='publicado' then
    select * into v from public.vitrines_lojas where id=r.vitrine_id and dono_id=uid and tipo='loja';
    if not found then raise exception 'A vitrine não está mais disponível.' using errcode='42501'; end if;
    return (v.id,v.tipo,v.slug,v.nome,v.plano,v.teste_expira_em,v.plano_expira_em)::public.vendedor_resumo;
  end if;
  select * into v from public.vitrines_lojas where dono_id=uid and tipo='loja';
  if found then
    -- A criação manual concluiu primeiro. Preserva todos os dados dela.
    update public.loja_ia_rascunhos set estado='publicado', vitrine_id=v.id, revisao=revisao+1, atualizado_em=now()
      where id=r.id;
    return (v.id,v.tipo,v.slug,v.nome,v.plano,v.teste_expira_em,v.plano_expira_em)::public.vendedor_resumo;
  end if;
  perform public.loja_ia_exigir_elegibilidade();
  if r.estado<>'pronto' then raise exception 'A revisão ainda não está disponível.' using errcode='42501'; end if;
  if r.revisao is distinct from p_revisao then raise exception 'Rascunho atualizado. Recarregue para continuar.' using errcode='40001'; end if;
  if jsonb_typeof(p_campos) is distinct from 'object' or jsonb_typeof(p_imagens) is distinct from 'object'
     or pg_column_size(p_campos)>16000 or pg_column_size(p_imagens)>256
     or (p_imagens - array['logo','capa']) <> '{}' then
    raise exception 'Confira os dados da loja.' using errcode='22023';
  end if;
  res:=public.quero_vender_com_descricao(p_campos->>'nome',p_campos->>'slug',p_campos->>'whatsapp',
    p_campos->>'cidade',p_campos->>'categoria',p_campos->>'sobre');
  if p_imagens ? 'logo' then logo:=public.loja_ia_vincular_imagem(r.id,(p_imagens->>'logo')::uuid,res.vitrine_id,'logo'); end if;
  if p_imagens ? 'capa' then
    select * into v from public.vitrines_lojas where id=res.vitrine_id;
    if not coalesce((select foto_fachada from public.recursos_vitrine(v)),false) and not exists (
      select 1 from public.loja_ia_imagens where id=(p_imagens->>'capa')::uuid and rascunho_id=r.id and tipo='capa' and origem='merc'
    ) then raise exception 'Escolha o modelo do Merc ou deixe a capa em branco. Seu plano atual não inclui foto de capa.'
      using errcode='42501', detail='campo:capa'; end if;
    capa:=public.loja_ia_vincular_imagem(r.id,(p_imagens->>'capa')::uuid,res.vitrine_id,'capa');
  end if;
  update public.vitrines_lojas set endereco=nullif(btrim(p_campos->>'endereco'),''),
    site_url=nullif(btrim(p_campos->>'site'),''), instagram=nullif(btrim(p_campos->>'instagram'),''),
    logo_url=logo, capa_url=capa
    where id=res.vitrine_id and dono_id=uid;
  update public.loja_ia_rascunhos set estado='publicado', vitrine_id=res.vitrine_id, revisao=revisao+1, atualizado_em=now()
    where id=r.id;
  return res;
end $$;
revoke all on function public.loja_ia_publicar(uuid,integer,jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.loja_ia_publicar(uuid,integer,jsonb,jsonb) to authenticated;
