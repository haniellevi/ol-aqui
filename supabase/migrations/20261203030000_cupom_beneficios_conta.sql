-- Item 22 A: padrões copiados dos valores Full existentes, sem mexer em concessões/uso.
insert into public.destaque_creditos_plano(plano_codigo,tipo,quantidade_mes)
select 'promocional',tipo,quantidade_mes from public.destaque_creditos_plano where plano_codigo='full'
on conflict(plano_codigo,tipo) do nothing;
insert into public.configuracoes(chave,microrregiao_id,valor,grupo,publico,descricao)
select 'robo.lojista_creditos_promocional',microrregiao_id,valor,grupo,publico,
       'Créditos mensais de imagem do plano Promocional'
from public.configuracoes where chave='robo.lojista_creditos_full';
update public.configuracoes set valor=valor || jsonb_build_object('promocional',valor->'full')
where chave='vitrine_ia.melhorias_mes' and valor ? 'full' and not valor ? 'promocional';

-- O restante dos benefícios continua com as permissões anteriores.
create policy credito_promocional_inserir on public.destaque_creditos_plano as restrictive for insert to authenticated
with check (plano_codigo<>'promocional' or public.e_super_admin());
create policy credito_promocional_editar on public.destaque_creditos_plano as restrictive for update to authenticated
using (plano_codigo<>'promocional' or public.e_super_admin()) with check (plano_codigo<>'promocional' or public.e_super_admin());
create policy credito_promocional_excluir on public.destaque_creditos_plano as restrictive for delete to authenticated
using (plano_codigo<>'promocional' or public.e_super_admin());

-- Protege só a parcela promocional do objeto, conservando a edição dos demais planos.
create function public.proteger_config_beneficio_promocional() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and not public.e_super_admin() then
   if (case when TG_OP<>'INSERT' then old.chave='robo.lojista_creditos_promocional' else false end)
      or (case when TG_OP<>'DELETE' then new.chave='robo.lojista_creditos_promocional' else false end)
      or ((case when TG_OP<>'INSERT' and old.chave='vitrine_ia.melhorias_mes' then old.valor->'promocional' end)
        is distinct from (case when TG_OP<>'DELETE' and new.chave='vitrine_ia.melhorias_mes' then new.valor->'promocional' end)) then
     raise exception 'Só o master pode alterar os benefícios promocionais.' using errcode='42501';
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.proteger_config_beneficio_promocional() from public,anon,authenticated;
create trigger proteger_config_beneficio_promocional before insert or update or delete on public.configuracoes
for each row execute function public.proteger_config_beneficio_promocional();

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
  -- Mesmo lock da cobrança/vencimento. A recusa desfaz qualquer atribuição nova.
  if exists(select 1 from public.vitrines_lojas v
     where v.dono_id=dono and (public.plano_efetivo_base(v)).preco_centavos>0) then
    raise exception 'Seu plano atual está ativo. Use o cupom depois do vencimento, se ele ainda estiver válido.' using errcode='22023';
  end if;
  if exists(select 1 from public.pagamentos pg join public.vitrines_lojas v on v.id=pg.vitrine_id
     where v.dono_id=dono and pg.tipo='assinatura' and pg.status='pendente') then
    raise exception 'Há um pagamento de plano pendente. Resolva esse pagamento antes de ativar o cupom.' using errcode='22023';
  end if;
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

create or replace function public.plano_efetivo_em(v public.vitrines_lojas, momento timestamptz)
returns public.planos language plpgsql stable security definer set search_path=public,extensions as $$
declare
  p public.planos;
begin
  p := public.plano_efetivo_base(v);
  -- Uma assinatura vigente conserva todos os direitos e seu prazo original.
  if p.preco_centavos>0 then return p; end if;
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

create or replace function public.aki_creditos_imagem(p_usuario text)
returns table (restantes integer, gratuito boolean, ligado boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v public.vitrines_lojas;
  p public.planos;
  limite integer;
  inicio timestamptz;
begin
  select * into v from public.vitrines_lojas where dono_id = p_usuario and tipo = 'loja';
  if v.id is null or v.status = 'suspensa' then return query select 0, true, false; return; end if;
  p := public.plano_efetivo(v);
  gratuito := coalesce(p.preco_centavos, 0) = 0 and p.codigo is distinct from 'promocional';
  limite := case when p.codigo = 'promocional' then public.aki_limite_configurado('robo.lojista_creditos_promocional', 1000)
                 when p.codigo = 'slim' and not gratuito then public.aki_limite_configurado('robo.lojista_creditos_slim', 1000)
                 when p.codigo = 'full' and not gratuito then public.aki_limite_configurado('robo.lojista_creditos_full', 1000)
                 when p.codigo is not null and gratuito then public.aki_limite_configurado('robo.lojista_creditos_gratis', 1000)
                 else 0 end;
  ligado := public.config('robo.ativo', v.microrregiao_id, 'false') is not distinct from 'true'::jsonb;

  if p.codigo = 'promocional' then
    inicio := public.robo_inicio('mes');
  elsif not gratuito and limite > 0 then
    v := public.vitrine_com_proximo(v);
    -- Uma assinatura pré-paga por vários meses tem uma janela por período do plano.
    inicio := v.plano_expira_em - make_interval(days => p.periodo_dias *
      greatest(1, ceil(extract(epoch from (v.plano_expira_em - now())) / (86400 * p.periodo_dias))::int));
  end if;

  select greatest(0, limite - count(*)::int) into restantes
    from public.aki_imagens i
    where i.usuario_id = p_usuario and (p.codigo = 'promocional' or i.gratuito = aki_creditos_imagem.gratuito
        -- Antes desta correção, o cupom registrava imagens como gratuitas até no Full.
        or (not aki_creditos_imagem.gratuito and exists (
          select 1 from public.voucher_atribuicoes a where a.dono_id=p_usuario and a.acesso_promocional
            and a.concedido_de<=i.criada_em and a.concedido_ate>i.criada_em)))
      and (inicio is null or i.criada_em >= inicio)
      and (i.estado = 'pronta' or (i.estado = 'reservada' and i.criada_em > now() - interval '5 minutes'));
  return next;
end $$;
