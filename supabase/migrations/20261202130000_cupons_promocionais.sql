alter table public.voucher_campanhas
  add column duracao_dias integer not null default 90 check (duracao_dias > 0),
  alter column valido_ate drop not null;

alter table public.voucher_atribuicoes
  add column acesso_promocional boolean not null default false,
  add constraint voucher_periodo_promocional check (
    not acesso_promocional or (vitrine_id is null and reservado_em is null
      and resgatado_em is not null and concedido_de is not null
      and concedido_ate is not null and concedido_de < concedido_ate)
  );
create index voucher_promocional_dono_vencimento
  on public.voucher_atribuicoes(dono_id, concedido_ate desc)
  where acesso_promocional;

-- Só as atribuições antigas ficam visíveis antes de digitar um código.
drop trigger voucher_nova_loja on public.vitrines_lojas;
drop function public.voucher_atribuir_nova_loja();

-- Horas em vez de dias de calendário mantêm a duração em mudanças de fuso.
create function public.voucher_fim_promocional(inicio timestamptz, dias integer)
returns timestamptz language plpgsql immutable set search_path='' as $$
declare fim timestamptz;
begin
  if dias is null or dias<=0 then
    raise exception 'Confira a duração do cupom.' using errcode='22023';
  end if;
  fim := inicio + (dias::double precision * interval '24 hours');
  if not isfinite(fim) then
    raise exception 'A duração do cupom excede o prazo suportado.' using errcode='22023';
  end if;
  return fim;
exception when datetime_field_overflow or interval_field_overflow or numeric_value_out_of_range then
  raise exception 'A duração do cupom excede o prazo suportado.' using errcode='22023';
end $$;
revoke all on function public.voucher_fim_promocional(timestamptz,integer) from public,anon,authenticated;

create function public.voucher_admin_criar(p_codigo text, p_duracao_dias integer, p_valido_ate timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_codigo text := upper(btrim(coalesce(p_codigo,'')));
begin
  if not public.e_super_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  if v_codigo !~ '^[A-Z0-9-]{4,32}$'
     or (p_valido_ate is not null and (not isfinite(p_valido_ate) or p_valido_ate<=clock_timestamp())) then
    raise exception 'Confira o código, a duração e a validade.' using errcode='22023';
  end if;
  perform public.voucher_fim_promocional(clock_timestamp(),p_duracao_dias);
  insert into public.voucher_campanhas(codigo,duracao_dias,valido_ate,criado_por)
  values(v_codigo,p_duracao_dias,p_valido_ate,public.usuario_id()) returning id into v_id;
  return v_id;
end $$;

create function public.voucher_admin_configurar(p_id uuid,p_ativo boolean,p_duracao_dias integer,p_valido_ate timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.e_super_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  if p_ativo is null
     or (p_valido_ate is not null and not isfinite(p_valido_ate)) then
    raise exception 'Confira a duração e a validade.' using errcode='22023';
  end if;
  perform public.voucher_fim_promocional(clock_timestamp(),p_duracao_dias);
  update public.voucher_campanhas set ativo=p_ativo,duracao_dias=p_duracao_dias,valido_ate=p_valido_ate where id=p_id;
  if not found then raise exception 'Cupom não encontrado.' using errcode='22023'; end if;
end $$;

create or replace function public.voucher_admin_criar(p_codigo text,p_valido_ate timestamptz)
returns uuid language sql security invoker set search_path='' as $$
  select public.voucher_admin_criar(p_codigo,90,p_valido_ate)
$$;

create or replace function public.voucher_admin_configurar(p_id uuid,p_ativo boolean,p_valido_ate timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare dias integer;
begin
  if not public.e_super_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  select duracao_dias into dias from public.voucher_campanhas where id=p_id for update;
  if not found then raise exception 'Cupom não encontrado.' using errcode='22023'; end if;
  perform public.voucher_admin_configurar(p_id,p_ativo,dias,p_valido_ate);
end $$;

alter policy voucher_admin_leitura on public.voucher_campanhas using (public.e_super_admin());

drop function public.meus_vouchers();
create function public.meus_vouchers()
returns table(codigo text,valido_ate timestamptz,resgatado_em timestamptz,reservado_em timestamptz,duracao_dias integer)
language sql stable security definer set search_path='' as $$
  select c.codigo,c.valido_ate,a.resgatado_em,a.reservado_em,c.duracao_dias
  from public.voucher_atribuicoes a join public.voucher_campanhas c on c.id=a.campanha_id
  where a.dono_id=public.usuario_id() and a.resgatado_em is null
    and ((a.reservado_em is not null and not a.acesso_promocional)
         or (c.ativo and (c.valido_ate is null or c.valido_ate>statement_timestamp())))
  order by c.valido_ate,c.codigo
$$;

create or replace function public.resgatar_voucher(p_codigo text) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare
  dono text := public.usuario_id();
  c public.voucher_campanhas;
  a public.voucher_atribuicoes;
  inicio timestamptz;
  fim timestamptz;
begin
  if dono is null or not exists (select 1 from public.perfis where id=dono) then
    raise exception 'Entre na sua conta para ativar o cupom.' using errcode='42501';
  end if;

  -- Divide a trava da vitrine com a rotina que pausa anúncios após vencimentos.
  perform 1 from public.vitrines_lojas where dono_id=dono for update;
  select * into c from public.voucher_campanhas where codigo=upper(btrim(coalesce(p_codigo,''))) for share;
  if c.id is null then raise exception 'Cupom inválido.' using errcode='22023'; end if;

  insert into public.voucher_atribuicoes(campanha_id,dono_id)
  values(c.id,dono) on conflict(campanha_id,dono_id) do nothing;
  select * into a from public.voucher_atribuicoes where campanha_id=c.id and dono_id=dono for update;
  if a.resgatado_em is not null then raise exception 'Você já usou este cupom.' using errcode='22023'; end if;
  inicio := clock_timestamp();
  -- Uma reserva antiga conserva a elegibilidade mesmo depois do fim da campanha.
  if a.reservado_em is null or a.acesso_promocional then
    if not c.ativo then raise exception 'Cupom desativado.' using errcode='22023'; end if;
    if c.valido_ate is not null and c.valido_ate<=inicio then
      raise exception 'Cupom vencido.' using errcode='22023';
    end if;
  end if;
  fim := public.voucher_fim_promocional(inicio,c.duracao_dias);
  update public.voucher_atribuicoes
    set vitrine_id=null,reservado_em=null,resgatado_em=inicio,
        concedido_de=inicio,concedido_ate=fim,acesso_promocional=true
    where id=a.id;
  return fim;
end $$;

create function public.meu_promocional()
returns table(codigo text,ativado_em timestamptz,vence_em timestamptz)
language sql stable security definer set search_path='' as $$
  select c.codigo,a.concedido_de,a.concedido_ate
  from public.voucher_atribuicoes a join public.voucher_campanhas c on c.id=a.campanha_id
  where a.dono_id=public.usuario_id() and a.acesso_promocional
    and a.concedido_de<=statement_timestamp() and a.concedido_ate>statement_timestamp()
  order by a.concedido_ate desc, a.concedido_de desc, a.id
  limit 1
$$;

revoke all on function public.voucher_admin_criar(text,integer,timestamptz),
  public.voucher_admin_configurar(uuid,boolean,integer,timestamptz),
  public.meus_vouchers(),public.meu_promocional() from public,anon;
grant execute on function public.voucher_admin_criar(text,integer,timestamptz),
  public.voucher_admin_configurar(uuid,boolean,integer,timestamptz),
  public.meus_vouchers(),public.meu_promocional() to authenticated;

-- ativo=false tira o plano das listas públicas e das opções à venda; a vigência
-- dos direitos vem do período da conta.
do $$
begin
  insert into public.planos(codigo,nome,publico,preco_centavos,limite_anuncios,acesso_radar,
    propostas_radar_mes,aviso_radar_na_hora,vitrine_foto_fachada,vitrine_secoes_max,vitrine_fixados_max,ativo)
  select 'promocional','Promocional','todos',0,limite_anuncios,acesso_radar,
    propostas_radar_mes,aviso_radar_na_hora,vitrine_foto_fachada,vitrine_secoes_max,vitrine_fixados_max,false
  from public.planos where codigo='full';
  if not found then raise exception 'O plano Full é necessário para iniciar as permissões do plano Promocional.'; end if;
end $$;

alter table public.planos add constraint planos_promocional_interno
  check (codigo<>'promocional' or
    (not ativo and not e_teste and not recomendado and preco_centavos=0 and publico='todos'));

-- Restringe a escrita mesmo quando há outras políticas permissivas para planos.
revoke truncate on public.planos from public,anon,authenticated;
create policy plano_promocional_inserir on public.planos as restrictive for insert to authenticated
  with check (codigo<>'promocional' or public.e_super_admin());
create policy plano_promocional_editar on public.planos as restrictive for update to authenticated
  using (codigo<>'promocional' or public.e_super_admin())
  with check (codigo<>'promocional' or public.e_super_admin());
create policy plano_promocional_excluir on public.planos as restrictive for delete to authenticated
  using (codigo<>'promocional' or public.e_super_admin());
create policy plano_promocional_leitura on public.planos for select to authenticated
  using (codigo='promocional' and exists (select 1 from public.meu_promocional()));

-- O plano interno nunca pode ser selecionado como plano de origem por um RPC.
alter table public.vitrines_lojas add constraint vitrine_plano_base_comercial
  check (plano is distinct from 'promocional' and plano_proximo is distinct from 'promocional');

create function public.plano_efetivo_base(v public.vitrines_lojas)
returns public.planos language plpgsql stable security definer set search_path=public,extensions as $$
declare
  p public.planos;
  tipo public.tipo_pessoa;
begin
  v := public.vitrine_com_proximo(v);
  select * into p from public.planos where codigo=v.plano;
  if v.status='ativa' and (
       (p.e_teste and v.teste_expira_em>now())
    or (not p.e_teste and p.preco_centavos>0 and coalesce(v.plano_expira_em,'-infinity')>now())
    or (not p.e_teste and p.preco_centavos=0)) then
    return p;
  end if;
  if v.tipo='loja' then
    if v.status<>'ativa' then return null; end if;
    select * into p from public.planos where codigo='loja_gratis';
    return p;
  end if;
  select tipo_pessoa into tipo from public.perfis where id=v.dono_id;
  if tipo='pf' and v.status<>'suspensa' then
    select * into p from public.planos where codigo<>'promocional'
      and codigo=public.config('pf.plano_apos_teste',v.microrregiao_id,'"pf_gratis"') #>> '{}';
    return p;
  end if;
  return null;
end $$;

revoke all on function public.plano_efetivo_base(public.vitrines_lojas) from public,anon,authenticated;

create function public.plano_efetivo_em(v public.vitrines_lojas, momento timestamptz)
returns public.planos language plpgsql stable security definer set search_path=public,extensions as $$
declare
  p public.planos;
begin
  if v.status='ativa' and v.arquivada_em is null and v.excluida_em is null
     and exists (select 1 from public.voucher_atribuicoes a
       where a.dono_id=v.dono_id and a.acesso_promocional
         and a.concedido_de<=momento and a.concedido_ate>momento)
     and not exists (select 1 from public.contas_revogadas where usuario_id=v.dono_id)
     and not exists (select 1 from public.contas_bloqueadas where usuario_id=v.dono_id)
     and not exists (select 1 from public.lixeira_contas where usuario_id=v.dono_id) then
    select * into p from public.planos where codigo='promocional';
    if found then return p; end if;
  end if;

  return public.plano_efetivo_base(v);
end $$;

revoke all on function public.plano_efetivo_em(public.vitrines_lojas,timestamptz) from public,anon,authenticated;

create or replace function public.plano_efetivo(v public.vitrines_lojas)
returns public.planos language sql stable security definer set search_path='' as $$
  select public.plano_efetivo_em(v,statement_timestamp())
$$;

-- Mantém a rotina agendada e aplica o limite corrente de cada vitrine, inclusive PF.
create or replace function public.aplicar_limite_loja_gratis() returns void
language plpgsql security definer set search_path='' as $$
declare
  v public.vitrines_lojas;
  limite integer;
begin
  for v in
    select l.* from public.vitrines_lojas l cross join lateral public.plano_efetivo(l) p
    where l.status='ativa' and l.arquivada_em is null and l.excluida_em is null and p.limite_anuncios is not null
      and (select count(*) from public.anuncios a where a.vitrine_id=l.id and a.status='ativo'
           and (a.pago_ate is null or a.pago_ate<=now())) > p.limite_anuncios
    order by l.id limit 100 for update of l skip locked
  loop
    -- A trava da vitrine serializa a rechecagem com resgate, renovação e publicação.
    select * into v from public.vitrines_lojas where id=v.id;
    if not found or v.status<>'ativa' or v.arquivada_em is not null or v.excluida_em is not null then continue; end if;
    limite := (public.plano_efetivo_em(v,clock_timestamp())).limite_anuncios;
    if limite is null then continue; end if;
    update public.anuncios a set status='pausado'
    where a.id in (
      select candidato.id from public.anuncios candidato
      join (
        select an.id, row_number() over (order by an.publicado_em desc nulls last,an.criado_em desc,an.id) as pos
        from public.anuncios an where an.vitrine_id=v.id and an.status='ativo' and (an.pago_ate is null or an.pago_ate<=now())
      ) ordem on ordem.id=candidato.id
      where ordem.pos>limite
      for update of candidato skip locked
    ) and a.status='ativo' and (a.pago_ate is null or a.pago_ate<=now());
  end loop;
end $$;

-- Radar promocional conserva as exigências de verificação e de status.
create or replace function public.pode_atender_radar(uid text default public.usuario_id())
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v         public.vitrines_lojas;
  p         public.planos;
  verificada boolean;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null or v.status <> 'ativa' or v.arquivada_em is not null or v.excluida_em is not null then return false; end if;
  if public.radar_cortesia_ativa(v.id) then return true; end if;

  if v.tipo = 'loja' then
    verificada := v.selo_loja_verificada;
  else
    select coalesce(pf.selo_negociador_certificado and pf.verificacao_pf_em is not null, false)
      into verificada from public.perfis pf where pf.id = uid;
  end if;
  if not coalesce(verificada, false) then return false; end if;

  p := public.plano_efetivo(v);
  return p.codigo is not null and p.acesso_radar and not p.e_teste and (p.preco_centavos > 0 or p.codigo = 'promocional');
end $$;

create or replace function public.recebe_aviso_radar_na_hora(uid text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v public.vitrines_lojas;
  p public.planos;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null or v.arquivada_em is not null or v.excluida_em is not null then return false; end if;
  if v.status = 'ativa' and public.radar_cortesia_ativa(v.id) then return true; end if;
  if not public.pode_atender_radar(uid) then return false; end if;
  p := public.plano_efetivo(v);
  return coalesce(p.aviso_radar_na_hora, false);
end $$;

-- A vitrine PF com promoção consulta os mesmos direitos configurados.
create or replace function public.recursos_vitrine(v public.vitrines_lojas)
returns table (foto_fachada boolean, secoes_max integer, fixados_max integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  if v.id is null then
    return query select false, 0, 0;
    return;
  end if;
  p := public.plano_efetivo(v);
  if p.codigo is null or (v.tipo is distinct from 'loja' and p.codigo<>'promocional') then
    return query select false, 0, 0;
    return;
  end if;
  return query select p.vitrine_foto_fachada, p.vitrine_secoes_max, p.vitrine_fixados_max;
end $$;

-- A escrita de seções usa os direitos da vitrine, inclusive para PF em promoção.
create or replace function public.validar_secao_loja()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  v       record;
  rec     record;
  total   integer;
  nomes   text;
begin
  if tg_op = 'UPDATE' then
    new.vitrine_id := old.vitrine_id;
    new.criado_em := old.criado_em;
  end if;
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 40 then
    raise exception using errcode = '23514', message = 'Escreva o nome da seção (de 2 a 40 letras).', detail = 'campo:nome';
  end if;
  select x.id, x.tipo, x.microrregiao_id, x.dono_id into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if v.id is null or (not sistema and not public.pode_mexer_vitrine(v.id)) then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  if tg_op = 'INSERT' and not sistema then
    perform 1 from public.vitrines_lojas where id = v.id for update;   -- duas abas ao mesmo tempo não passam do limite
  end if;
  select * into rec from public.recursos_vitrine_id(v.id);
  if v.tipo <> 'loja' and rec.secoes_max = 0 then
    raise exception using errcode = '42501', message = 'Seções próprias não fazem parte do seu plano.';
  end if;
  if not sistema and (tg_op = 'INSERT' or new.nome is distinct from old.nome) then
    if public.texto_bloqueado(new.nome, v.microrregiao_id) is not null then
      raise exception using errcode = '23514', detail = 'campo:nome',
        message = 'O nome da seção tem uma palavra que não é permitida no OLAKI.';
    end if;
  end if;
  if exists (select 1 from public.loja_secoes s
              where s.vitrine_id = new.vitrine_id and lower(s.nome) = lower(new.nome) and s.id <> new.id) then
    raise exception using errcode = '23505', message = 'Você já tem uma seção com esse nome.', detail = 'campo:nome';
  end if;
  if tg_op = 'INSERT' then
    if not sistema then
      select count(*) into total from public.loja_secoes s where s.vitrine_id = v.id;
      if rec.secoes_max is not null and total >= rec.secoes_max then
        nomes := public.planos_com_recurso('secoes');
        raise exception using errcode = 'P0001',
          message = case
            when rec.secoes_max = 0 and nomes is null then 'Seções próprias não fazem parte do seu plano.'
            when rec.secoes_max = 0 then format('Seções próprias fazem parte destes planos: %s.', nomes)
            else format('Seu plano permite até %s seções. Apague uma ou troque de plano.', rec.secoes_max) end;
      end if;
    end if;
    new.ordem := least(coalesce((select max(s.ordem) from public.loja_secoes s where s.vitrine_id = v.id), 0) + 1, 10000);
    new.criado_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end $$;

-- A conversão de PF em loja e a lista de assinaturas preservam o plano comercial.
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
               plano = case when coalesce((public.plano_efetivo_base(v)).preco_centavos, 0) = 0 then plano_teste else x.plano end,
               teste_expira_em = case when coalesce((public.plano_efetivo_base(v)).preco_centavos, 0) = 0
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

create or replace function public.opcoes_assinatura()
returns table (codigo text, nome text, descricao text, preco_centavos integer, periodo_dias integer, limite_anuncios integer,
               acesso_radar boolean, propostas_radar_mes integer, recomendado boolean, ordem integer,
               meses integer, desconto_percentual numeric, valor_centavos integer, dias integer,
               regra text, inicio timestamptz, fim timestamptz, atual boolean, disponivel boolean, motivo text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v     public.vitrines_lojas;
  p     public.planos;
  per   record;
  r     record;
  ef    public.planos;
begin
  if public.usuario_id() is null then return; end if;
  select * into v from public.vitrines_lojas x where x.dono_id = public.usuario_id();
  if v.id is null then return; end if;
  ef := public.plano_efetivo_base(v);
  for p in select * from public.planos x order by x.ordem, x.codigo loop
    continue when not public.plano_a_venda(p, v);
    for per in select * from public.periodos_assinatura(v.microrregiao_id) pa order by pa.meses loop
      select * into r from public.periodo_assinatura(v, p, p.periodo_dias * per.meses);
      codigo := p.codigo; nome := p.nome; descricao := p.descricao; preco_centavos := p.preco_centavos;
      periodo_dias := p.periodo_dias; limite_anuncios := p.limite_anuncios; acesso_radar := p.acesso_radar;
      propostas_radar_mes := p.propostas_radar_mes; recomendado := p.recomendado; ordem := p.ordem;
      meses := per.meses; desconto_percentual := per.desconto_percentual;
      valor_centavos := round(p.preco_centavos::numeric * per.meses * (100 - per.desconto_percentual) / 100)::int;
      dias := p.periodo_dias * per.meses;
      regra := r.regra; inicio := r.inicio; fim := r.fim;
      atual := ef.codigo is not distinct from p.codigo and not coalesce(ef.e_teste, false) and ef.preco_centavos > 0;
      if v.status = 'suspensa' then
        disponivel := false; motivo := 'Sua conta de vendedor está suspensa. Fale com o suporte.';
      else
        disponivel := r.motivo is null; motivo := r.motivo;
      end if;
      return next;
    end loop;
  end loop;
end $$;
