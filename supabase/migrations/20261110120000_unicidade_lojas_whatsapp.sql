-- Integridade compartilhada entre o perfil e a vitrine, independente do fluxo que grava os dados.
-- Na transação da migração, nenhuma gravação pode entrar entre o inventário, a carga e os gatilhos.
lock table public.perfis, public.vitrines_lojas in share row exclusive mode;

create function public.normalizar_nome_loja(p_nome text)
returns text language sql immutable strict parallel safe
set search_path = pg_catalog, public
as $$
  select regexp_replace(lower(public.sem_acento(normalize(p_nome, NFKC))), '[^[:alnum:]]+', '', 'g');
$$;

do $$
declare
  nomes_invalidos integer;
  nomes_conflitantes integer;
  numeros_conflitantes integer;
  anonimizacoes_sem_revogacao integer;
begin
  select count(*) into nomes_invalidos from public.vitrines_lojas
   where tipo = 'loja' and public.normalizar_nome_loja(nome) = '';

  select count(*) into nomes_conflitantes
    from (
      select public.normalizar_nome_loja(nome)
        from public.vitrines_lojas where tipo = 'loja'
          and not (status = 'suspensa' and nome = 'Loja encerrada' and slug = 'encerrada-' || id
                   and cidade = 'Conta excluída' and whatsapp is null)
       group by 1 having count(*) > 1
    ) conflitos;

  select count(*) into numeros_conflitantes
    from (
      select numero
        from (
          select whatsapp as numero, id as dono_id from public.perfis where whatsapp is not null
          union all
          select whatsapp, dono_id from public.vitrines_lojas where whatsapp is not null
        ) vinculos
       group by numero having count(distinct dono_id) > 1
    ) conflitos;

  select count(*) into anonimizacoes_sem_revogacao
    from public.vitrines_lojas v
   where tipo = 'loja' and status = 'suspensa' and nome = 'Loja encerrada' and slug = 'encerrada-' || id
     and cidade = 'Conta excluída' and whatsapp is null
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id);

  if nomes_invalidos > 0 or nomes_conflitantes > 0 or numeros_conflitantes > 0 or anonimizacoes_sem_revogacao > 0 then
    raise exception using errcode = '23505',
      message = 'Resolva os conflitos de titularidade e nomes comerciais antes de aplicar esta migração.',
      detail = format('Nomes inválidos: %s. Nomes em conflito: %s. Números em conflito: %s. Lojas anonimizadas sem revogação: %s.',
                      nomes_invalidos, nomes_conflitantes, numeros_conflitantes, anonimizacoes_sem_revogacao);
  end if;
end $$;

-- Vitrines anonimizadas são preservadas apenas como referência de cobranças.
create unique index vitrines_nome_loja_unico
  on public.vitrines_lojas (public.normalizar_nome_loja(nome))
  where tipo = 'loja' and not (status = 'suspensa' and nome = 'Loja encerrada' and slug = 'encerrada-' || id
                             and cidade = 'Conta excluída' and whatsapp is null);

create function public.validar_identidade_loja()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if public.normalizar_nome_loja(new.nome) = '' then
    raise exception using errcode = '23514', message = 'O nome da loja precisa conter letra ou número.', detail = 'campo:nome';
  end if;
  if new.status = 'suspensa' and new.nome = 'Loja encerrada' and new.slug = 'encerrada-' || new.id
     and new.cidade = 'Conta excluída' and new.whatsapp is null
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = new.dono_id) then
    raise exception using errcode = '23514', message = 'Este nome está reservado para uma loja encerrada.', detail = 'campo:nome';
  end if;
  return new;
end $$;
revoke all on function public.validar_identidade_loja() from public, anon, authenticated, service_role;

create trigger zz_validar_identidade_loja before insert or update on public.vitrines_lojas
  for each row when (new.tipo = 'loja') execute function public.validar_identidade_loja();

-- Cada fonte admite um vínculo por conta. Os formatos canônicos já são exigidos nas duas tabelas.
-- O número só é liberado quando as duas fontes deixam de usá-lo.
create table public.whatsapp_vinculos (
  numero text primary key check (numero ~ '^55[1-9][0-9]9?[0-9]{8}$'),
  dono_id text not null,
  no_perfil boolean not null,
  na_vitrine boolean not null
);
alter table public.whatsapp_vinculos enable row level security;
revoke all on table public.whatsapp_vinculos from public, anon, authenticated, service_role;

insert into public.whatsapp_vinculos (numero, dono_id, no_perfil, na_vitrine)
select numero, dono_id, bool_or(perfil), bool_or(not perfil)
  from (
    select whatsapp as numero, id as dono_id, true as perfil from public.perfis where whatsapp is not null
    union all
    select whatsapp, dono_id, false from public.vitrines_lojas where whatsapp is not null
  ) vinculos
 group by numero, dono_id;

create function public.manter_vinculo_whatsapp()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  origem_perfil boolean := tg_table_name = 'perfis';
  numero_antigo text;
  numero_novo text;
  dono_antigo text;
  dono_novo text;
begin
  if tg_op <> 'INSERT' then
    numero_antigo := old.whatsapp;
    if origem_perfil then dono_antigo := old.id; else dono_antigo := old.dono_id; end if;
  end if;
  if tg_op <> 'DELETE' then
    numero_novo := new.whatsapp;
    if origem_perfil then dono_novo := new.id; else dono_novo := new.dono_id; end if;
  end if;
  if numero_antigo is not distinct from numero_novo
     and (numero_novo is null or dono_antigo = dono_novo) then return null; end if;

  if numero_novo is not null then
    -- A chave primária arbitra o vínculo entre transações, inclusive com gravações em tabelas diferentes.
    insert into public.whatsapp_vinculos as v (numero, dono_id, no_perfil, na_vitrine)
    values (numero_novo, dono_novo, origem_perfil, not origem_perfil)
    on conflict (numero) do update set
      no_perfil = v.no_perfil or excluded.no_perfil,
      na_vitrine = v.na_vitrine or excluded.na_vitrine
    where v.dono_id = excluded.dono_id;
    if not found then
      raise exception using errcode = '23505', constraint = 'whatsapp_vinculos_pkey',
        message = 'Este WhatsApp já está vinculado a outra conta.', detail = 'campo:whatsapp';
    end if;
  end if;

  if numero_antigo is not null then
    update public.whatsapp_vinculos
       set no_perfil = no_perfil and not origem_perfil,
           na_vitrine = na_vitrine and origem_perfil
     where numero = numero_antigo and dono_id = dono_antigo;
    delete from public.whatsapp_vinculos
     where numero = numero_antigo and dono_id = dono_antigo and not no_perfil and not na_vitrine;
  end if;
  return null;
end $$;
revoke all on function public.manter_vinculo_whatsapp() from public, anon, authenticated, service_role;

-- Roda depois de gatilhos que atualizam a vitrine, seguindo a ordem vitrine → vínculo.
create trigger zz_vincular_whatsapp_perfil after insert or update or delete on public.perfis
  for each row execute function public.manter_vinculo_whatsapp();
create trigger vincular_whatsapp_vitrine after insert or update or delete on public.vitrines_lojas
  for each row execute function public.manter_vinculo_whatsapp();

-- Preserva o contrato do cadastro e associa cada conflito ao campo correspondente.
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

-- Um código válido de outro titular encerra o desafio sem alterar o perfil.
create or replace function public.confirmar_codigo_whatsapp(p_usuario text, p_id uuid, p_resumo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.whatsapp_desafios;
  restricao text;
begin
  -- Mesma ordem de travas do envio. Perfil e consumo são confirmados numa transação.
  perform 1 from perfis where id = p_usuario for update;
  if not found then return 'invalido'; end if;
  select * into d from whatsapp_desafios where id = p_id and usuario_id = p_usuario for update;
  if not found or d.cancelado or d.consumido_em is not null or d.envio = 'falha' then return 'invalido'; end if;
  if d.erros >= 3 then return 'bloqueado'; end if;
  if d.expira_em <= clock_timestamp() then return 'expirado'; end if;
  if p_resumo is null or p_resumo is distinct from d.resumo then
    update whatsapp_desafios set erros = erros + 1 where id = d.id;
    return case when d.erros + 1 >= 3 then 'bloqueado' else 'incorreto' end;
  end if;
  begin
    update perfis set whatsapp = d.numero, whatsapp_verificado_em = clock_timestamp(), whatsapp_origem = 'evolution' where id = p_usuario;
  exception when unique_violation then
    get stacked diagnostics restricao = constraint_name;
    if restricao <> 'whatsapp_vinculos_pkey' then raise; end if;
    update whatsapp_desafios set consumido_em = clock_timestamp() where id = d.id;
    return 'numero_vinculado';
  end;
  update whatsapp_desafios set consumido_em = clock_timestamp() where id = d.id;
  return 'confirmado';
end $$;
