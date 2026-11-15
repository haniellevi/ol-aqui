-- Lojas permanecem gratuitas após o benefício, com até dez anúncios ativos.
insert into public.planos(codigo,nome,descricao,publico,preco_centavos,periodo_dias,limite_anuncios,acesso_radar,propostas_radar_mes,e_teste,ordem,vitrine_foto_fachada,vitrine_secoes_max,vitrine_fixados_max)
values ('loja_gratis','Loja grátis','Vitrine gratuita com até 10 anúncios no ar. Se houver mais, os mais recentes permanecem ativos e os demais são pausados.','pj',0,30,10,false,0,false,1,true,10,6)
on conflict(codigo) do nothing;

create or replace function public.plano_efetivo(v public.vitrines_lojas)
returns public.planos language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  p    public.planos;
  tipo public.tipo_pessoa;
begin
  v := public.vitrine_com_proximo(v);
  select * into p from public.planos where codigo = v.plano;
  if v.status = 'ativa' and (
       (p.e_teste and v.teste_expira_em > now())
    or (not p.e_teste and p.preco_centavos > 0 and coalesce(v.plano_expira_em, '-infinity') > now())
    or (not p.e_teste and p.preco_centavos = 0)) then
    return p;
  end if;
  -- Ao vencer, a loja permanece no plano gratuito; suspensões continuam respeitadas.
  if v.tipo = 'loja' then
    if v.status <> 'ativa' then return null; end if;
    select * into p from public.planos where codigo='loja_gratis';
    return p;
  end if;
  -- Pessoa física mantém seu próprio plano gratuito.
  select tipo_pessoa into tipo from public.perfis where id = v.dono_id;
  if tipo = 'pf' and v.status <> 'suspensa' then
    select * into p from public.planos where codigo = public.config('pf.plano_apos_teste', v.microrregiao_id, '"pf_gratis"') #>> '{}';
    return p;
  end if;
  return null;
end $$;

-- O código identifica a campanha. A atribuição é individual e o resgate é atômico.
create table public.voucher_campanhas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9-]{4,32}$'),
  valido_ate timestamptz not null,
  ativo boolean not null default true,
  criado_por text references public.perfis(id) on update cascade on delete set null,
  criado_em timestamptz not null default now()
);
create table public.voucher_atribuicoes (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.voucher_campanhas(id),
  dono_id text references public.perfis(id) on update cascade on delete set null,
  vitrine_id uuid references public.vitrines_lojas(id) on delete set null,
  atribuido_em timestamptz not null default now(),
  reservado_em timestamptz,
  resgatado_em timestamptz,
  concedido_de timestamptz,
  concedido_ate timestamptz,
  unique(campanha_id,dono_id),
  unique(campanha_id,vitrine_id)
);
alter table public.voucher_campanhas enable row level security;
alter table public.voucher_atribuicoes enable row level security;
revoke all on public.voucher_campanhas, public.voucher_atribuicoes from public, anon, authenticated;

create function public.voucher_admin_criar(p_codigo text, p_valido_ate timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_codigo text := upper(btrim(coalesce(p_codigo,'')));
begin
  if not public.e_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  if v_codigo !~ '^[A-Z0-9-]{4,32}$' or p_valido_ate is null or p_valido_ate <= now() then
    raise exception 'Confira o código e a validade.' using errcode='22023';
  end if;
  insert into public.voucher_campanhas(codigo,valido_ate,criado_por)
  values(v_codigo,p_valido_ate,public.usuario_id()) returning id into v_id;
  insert into public.voucher_atribuicoes(campanha_id,dono_id,vitrine_id)
  select v_id,v.dono_id,v.id from public.vitrines_lojas v where v.tipo='loja' and v.status='ativa'
  on conflict do nothing;
  return v_id;
end $$;

create function public.voucher_atribuir_nova_loja() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.tipo='loja' and (tg_op='INSERT' or old.tipo <> 'loja' or old.dono_id is distinct from new.dono_id) then
    if tg_op='UPDATE' and old.dono_id is distinct from new.dono_id then
      delete from public.voucher_atribuicoes a where a.vitrine_id=new.id and a.resgatado_em is null
        and exists (select 1 from public.voucher_atribuicoes outro where outro.campanha_id=a.campanha_id and outro.dono_id=new.dono_id);
      update public.voucher_atribuicoes set dono_id=new.dono_id where vitrine_id=new.id and resgatado_em is null;
    end if;
    insert into public.voucher_atribuicoes(campanha_id,dono_id,vitrine_id)
    select c.id,new.dono_id,new.id from public.voucher_campanhas c
    where c.ativo and c.valido_ate>now() on conflict do nothing;
  end if;
  return new;
end $$;
create trigger voucher_nova_loja after insert or update of tipo,dono_id on public.vitrines_lojas
for each row execute function public.voucher_atribuir_nova_loja();

create function public.meus_vouchers() returns table(codigo text,valido_ate timestamptz,resgatado_em timestamptz,reservado_em timestamptz)
language sql stable security definer set search_path='' as $$
  select c.codigo,c.valido_ate,a.resgatado_em,a.reservado_em from public.vitrines_lojas v
  cross join public.voucher_campanhas c
  left join public.voucher_atribuicoes a on a.campanha_id=c.id and a.dono_id=v.dono_id
  where v.dono_id=public.usuario_id() and v.tipo='loja' and v.status='ativa'
    and ((c.ativo and c.valido_ate>now()) or a.reservado_em is not null) and (a.id is null or (a.vitrine_id=v.id and a.resgatado_em is null))
    and not exists (select 1 from public.voucher_atribuicoes usado where usado.campanha_id=c.id and usado.vitrine_id=v.id and usado.resgatado_em is not null)
  order by c.valido_ate
$$;

create function public.resgatar_voucher(p_codigo text) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare v public.vitrines_lojas; a public.voucher_atribuicoes; c public.voucher_campanhas;
  inicio timestamptz; fim timestamptz; tem_cobranca boolean; antes text := coalesce(current_setting('olaki.sistema',true),'');
  antes_voucher text := coalesce(current_setting('olaki.voucher',true),'');
begin
  select * into v from public.vitrines_lojas where dono_id=public.usuario_id() and tipo='loja' for update;
  if v.id is null or v.status <> 'ativa' then raise exception 'Loja indisponível.' using errcode='42501'; end if;
  select ca.* into c from public.voucher_campanhas ca where ca.codigo=upper(btrim(coalesce(p_codigo,''))) for share;
  if c.id is null then raise exception 'Cupom inválido ou vencido.' using errcode='22023'; end if;
  if c.ativo and c.valido_ate>clock_timestamp() then
    insert into public.voucher_atribuicoes(campanha_id,dono_id,vitrine_id) values(c.id,v.dono_id,v.id) on conflict do nothing;
  end if;
  select * into a from public.voucher_atribuicoes where campanha_id=c.id and dono_id=v.dono_id and vitrine_id=v.id for update;
  if a.id is null or a.resgatado_em is not null or (a.reservado_em is null and (not c.ativo or c.valido_ate<=clock_timestamp())) then
    raise exception 'Cupom indisponível para esta loja.' using errcode='22023';
  end if;
  update public.voucher_atribuicoes set reservado_em=coalesce(reservado_em,now()) where id=a.id;
  select exists (select 1 from public.pagamentos p where p.vitrine_id=v.id and p.tipo='assinatura'
    and ((p.status='pago' and p.valor_centavos>0 and (p.concedido_ate is null or p.concedido_ate>now())) or (p.status='pendente' and not exists (select 1 from public.asaas_criacoes ac where ac.pagamento_id=p.id and ac.ambiente='sandbox')))) into tem_cobranca;
  if tem_cobranca or v.plano_proximo is not null or (v.plano_expira_em>now() and not (
    v.plano='full' and exists (select 1 from public.voucher_atribuicoes anterior
      where anterior.vitrine_id=v.id and anterior.resgatado_em is not null and anterior.concedido_ate=v.plano_expira_em)
  )) then return null; end if;
  inicio := case when v.plano='full' and v.plano_expira_em>now() then v.plano_expira_em else now() end;
  fim := inicio + interval '3 months';
  perform set_config('olaki.sistema','1',true);
  perform set_config('olaki.voucher','1',true);
  update public.vitrines_lojas set plano='full',plano_expira_em=fim where id=v.id;
  perform set_config('olaki.voucher',antes_voucher,true);
  update public.voucher_atribuicoes set resgatado_em=now(),concedido_de=inicio,concedido_ate=fim where id=a.id;
  perform set_config('olaki.sistema',antes,true);
  return fim;
end $$;
revoke all on function public.voucher_admin_criar(text,timestamptz),public.meus_vouchers(),public.resgatar_voucher(text) from public,anon;
grant execute on function public.voucher_admin_criar(text,timestamptz),public.meus_vouchers(),public.resgatar_voucher(text) to authenticated;
revoke all on function public.voucher_atribuir_nova_loja() from public,anon,authenticated;

create policy voucher_admin_leitura on public.voucher_campanhas for select to authenticated using (public.e_admin());
grant select on public.voucher_campanhas to authenticated;

create function public.voucher_admin_configurar(p_id uuid,p_ativo boolean,p_valido_ate timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  if p_ativo is null or p_valido_ate is null then raise exception 'Confira a validade.' using errcode='22023'; end if;
  update public.voucher_campanhas set ativo=p_ativo,valido_ate=p_valido_ate where id=p_id;
  if not found then raise exception 'Cupom não encontrado.' using errcode='22023'; end if;
end $$;
revoke all on function public.voucher_admin_configurar(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.voucher_admin_configurar(uuid,boolean,timestamptz) to authenticated;

-- Campanha inicial: o prazo limita o resgate, sem encurtar os três meses concedidos.
insert into public.voucher_campanhas(codigo,valido_ate,criado_por)
values ('LANCAMENTO2026','2027-01-01 03:00:00+00',null)
on conflict(codigo) do nothing;

-- A campanha também fica disponível para as lojas já cadastradas.
insert into public.voucher_atribuicoes(campanha_id,dono_id,vitrine_id)
select c.id,v.dono_id,v.id from public.voucher_campanhas c cross join public.vitrines_lojas v
where c.codigo='LANCAMENTO2026' and c.ativo and c.valido_ate>now() and v.tipo='loja' and v.status='ativa'
on conflict do nothing;

create function public.voucher_promocao_ativa() returns timestamptz
language sql stable security definer set search_path='' as $$
  select max(valido_ate) from public.voucher_campanhas where ativo and valido_ate>now()
$$;
revoke all on function public.voucher_promocao_ativa() from public;
grant execute on function public.voucher_promocao_ativa() to anon,authenticated;


-- Cupom não representa uma conversão paga.
create or replace function public.funil_loja_pagou()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_etapa text := public.funil_etapa_config('funil.etapa_ao_pagar');
begin
  begin
    if v_etapa is null or current_setting('olaki.voucher', true) = '1' then return null; end if;
    if new.plano_expira_em is not null and new.plano_expira_em > now()
       and (old.plano is distinct from new.plano or old.plano_expira_em is distinct from new.plano_expira_em)
       and exists (select 1 from planos p where p.codigo = new.plano and not p.e_teste and p.preco_centavos > 0)
       and exists (select 1 from public.pagamentos pg where pg.vitrine_id=new.id and pg.tipo='assinatura'
         and pg.status='pago' and pg.valor_centavos>0 and pg.plano_codigo=new.plano
         and (pg.concedido_ate>now() or pg.pago_em=now())) then
      update public.funil_lojistas set etapa = v_etapa where vitrine_id = new.id and etapa <> v_etapa;
    end if;
  exception when others then
    raise warning 'funil_loja_pagou: %', sqlerrm;
  end;
  return null;
end $$;

create or replace function public.funil_importar_lojas()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_teste text := public.funil_etapa_config('funil.etapa_ao_cadastrar');
  v_pago  text := public.funil_etapa_config('funil.etapa_ao_pagar');
  n integer;
begin
  if not public.e_admin() then raise exception 'Só o administrador.' using errcode = '42501'; end if;
  if v_teste is null then raise exception 'Escolha a etapa de quem se cadastra em Configurações (funil).' using errcode = '22023'; end if;
  insert into public.funil_lojistas (microrregiao_id, nome_loja, whatsapp, etapa, vitrine_id, cidade_id, origem, criado_por)
  select v.microrregiao_id, v.nome, v.whatsapp,
         case when v_pago is not null and v.plano_expira_em > now()
                   and exists (select 1 from planos p where p.codigo = v.plano and not p.e_teste and p.preco_centavos > 0)
                   and exists (select 1 from public.pagamentos pg where pg.vitrine_id=v.id and pg.tipo='assinatura'
                     and pg.status='pago' and pg.valor_centavos>0 and pg.plano_codigo=v.plano
                     and pg.concedido_de<=now() and pg.concedido_ate>now())
              then v_pago else v_teste end,
         v.id,
         (select c.id from cidades c where c.microrregiao_id = v.microrregiao_id and c.nome = v.cidade limit 1),
         (select origem_cadastro from perfis where id = v.dono_id),
         public.usuario_id()
    from public.vitrines_lojas v
   where not exists (select 1 from public.funil_lojistas f where f.vitrine_id = v.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- Comunicações padrão não devem dizer que a loja perde todos os anúncios.
-- A trava da tabela impede edições concorrentes enquanto o padrão é atualizado.
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
update public.modelos_mensagem set
  texto = case when texto=texto_padrao then case chave
    when 'plano_vencendo' then 'Olá, {nome}! O {plano} vence dia {data}. Confira os limites do seu plano gratuito em Minha conta > Meu plano.'
    else 'Olá, {nome}! O {plano} terminou dia {data}. Confira os limites do seu plano gratuito em Minha conta > Meu plano.' end else texto end,
  texto_padrao = case chave
    when 'plano_vencendo' then 'Olá, {nome}! O {plano} vence dia {data}. Confira os limites do seu plano gratuito em Minha conta > Meu plano.'
    else 'Olá, {nome}! O {plano} terminou dia {data}. Confira os limites do seu plano gratuito em Minha conta > Meu plano.' end
where chave in ('plano_vencendo','plano_vencido');
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;

-- Após o vencimento, aplica periodicamente o limite gratuito, sem apagar anúncios.
create function public.aplicar_limite_loja_gratis() returns void
language plpgsql security definer set search_path='' as $$
declare v public.vitrines_lojas;
begin
  for v in
    select l.* from public.vitrines_lojas l cross join lateral public.plano_efetivo(l) p
    where l.tipo='loja' and l.status='ativa' and p.codigo='loja_gratis' and p.limite_anuncios is not null
      and (select count(*) from public.anuncios an where an.vitrine_id=l.id and an.status='ativo'
           and (an.pago_ate is null or an.pago_ate<=now())) > p.limite_anuncios
    order by l.id limit 100 for update of l skip locked
  loop
    -- A mesma trava usada por pagamentos impede pausar depois de uma renovação.
    select * into v from public.vitrines_lojas where id=v.id;
    if not found or (public.plano_efetivo(v)).codigo is distinct from 'loja_gratis' then continue; end if;
    update public.anuncios a set status='pausado'
    where a.id in (
      select candidato.id from public.anuncios candidato
      join (
        select an.id, row_number() over (order by an.publicado_em desc nulls last,an.criado_em desc,an.id) as pos
        from public.anuncios an where an.vitrine_id=v.id and an.status='ativo' and (an.pago_ate is null or an.pago_ate<=now())
      ) ordem on ordem.id=candidato.id
      where ordem.pos>coalesce((public.plano_efetivo(v)).limite_anuncios,2147483647)
      for update of candidato skip locked
    ) and a.status='ativo' and (a.pago_ate is null or a.pago_ate<=now());
  end loop;
end $$;
revoke all on function public.aplicar_limite_loja_gratis() from public,anon,authenticated;
grant execute on function public.aplicar_limite_loja_gratis() to service_role;
do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('olaki-limite-loja-gratis','*/5 * * * *','select public.aplicar_limite_loja_gratis()');
  end if;
end $$;
