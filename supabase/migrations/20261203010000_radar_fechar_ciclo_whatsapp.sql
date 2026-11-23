-- Fechamento do ciclo de avisos por WhatsApp do Radar (comprador e lojista):
-- 1. Modelo WhatsApp para proposta_escolhida (proposta_nova já existe).
-- 2. proposta_nova (radar_avisar_proposta) e proposta_escolhida (escolher_proposta) passam a enfileirar
--    na whatsapp_fila respeitando radar.whatsapp_ativo, janela 8h-20h de Fortaleza, número confirmado
--    no padrão regional, contas ativas, preferências do sino (app) e opt-out (whatsapp/SAIR), sem duplicar.
-- 3. fechar_pedido_radar (e fechamento/expiração/moderação do pedido ou ocultação/remoção da proposta)
--    cancela avisos pendentes do Radar na fila, e whatsapp_fila_pegar_em / confirmar_envio rechecam
--    tudo antes de enviar.
-- 4. SAIR/VOLTAR e salvar_preferencia_whatsapp_radar passam a cobrir os três avisos do Radar no WhatsApp.

-- ---------------------------------------------------------------------
-- 1. Modelo WhatsApp de proposta escolhida (proposta_nova já existe)
-- ---------------------------------------------------------------------
insert into public.modelos_mensagem (
  chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo_padrao, texto_padrao
)
select 'proposta_escolhida', 'whatsapp', 76, 'Proposta escolhida (para a loja)',
       'Quando o comprador escolhe a proposta da loja no Radar.',
       array['pedido', 'loja']::text[], null,
       'Mercado da Região: o comprador de “{pedido}” escolheu a proposta da {loja} para conversar. Veja o pedido no link. Responda SAIR para parar estes avisos.',
       null,
       'Mercado da Região: o comprador de “{pedido}” escolheu a proposta da {loja} para conversar. Veja o pedido no link. Responda SAIR para parar estes avisos.'
 where not exists (
   select 1 from public.modelos_mensagem m
    where m.chave = 'proposta_escolhida' and m.canal = 'whatsapp'
 );

-- Quem já respondeu SAIR antes desta migração e não voltou depois também fica fora dos novos avisos.
insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
select pf.id, t.tipo, 'whatsapp', false, now()
  from public.perfis pf
  cross join (values ('proposta_nova'), ('proposta_escolhida')) as t(tipo)
 where exists (
         select 1 from public.whatsapp_respostas r
          where r.usuario_id = pf.id and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')
       )
   and coalesce(
         (select max(r.criado_em) from public.whatsapp_respostas r
           where r.usuario_id = pf.id and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')),
         '-infinity'::timestamptz
       ) > coalesce(
         (select max(r.criado_em) from public.whatsapp_respostas r
           where r.usuario_id = pf.id and r.comando = 'VOLTAR'),
         '-infinity'::timestamptz
       )
   and coalesce(
         (select max(r.criado_em) from public.whatsapp_respostas r
           where r.usuario_id = pf.id and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR')),
         '-infinity'::timestamptz
       ) >= coalesce(
         (select pa.atualizado_em from public.preferencias_avisos pa
           where pa.usuario_id = pf.id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp'),
         '-infinity'::timestamptz
       )
on conflict (usuario_id, tipo, canal) do nothing;

-- ---------------------------------------------------------------------
-- 2. Cancelamento imediato na fila quando o pedido fecha ou a proposta sai do ar
-- ---------------------------------------------------------------------
create function public.radar_cancelar_fila_pedido(p_pedido_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if p_pedido_id is null then return; end if;
  update public.whatsapp_fila f
     set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente'
     and (f.chave like 'radar_pedido_novo:' || p_pedido_id::text || ':%'
          or f.chave like 'radar_proposta_nova:' || p_pedido_id::text || ':%'
          or f.chave like 'radar_proposta_escolhida:' || p_pedido_id::text || ':%');
end $$;

create function public.radar_pedido_fechado_cancelar_whatsapp()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if new.status <> 'aberto' then
    perform public.radar_cancelar_fila_pedido(new.id);
  end if;
  return null;
end $$;

drop trigger if exists z_radar_pedido_fechado_cancelar_whatsapp on public.radar_pedidos;
create trigger z_radar_pedido_fechado_cancelar_whatsapp
  after update of status on public.radar_pedidos
  for each row
  when (new.status <> 'aberto')
  execute function public.radar_pedido_fechado_cancelar_whatsapp();

create function public.radar_proposta_fechada_cancelar_whatsapp()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo_pedido uuid := case when tg_op = 'DELETE' then old.pedido_id else new.pedido_id end;
  alvo_prop   uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  if tg_op = 'DELETE' or new.status <> 'ativa' then
    update public.whatsapp_fila f
       set estado = 'cancelada', erro = 'pedido_fechado'
     where f.estado = 'pendente'
       and f.chave in (
         'radar_proposta_nova:' || alvo_pedido::text || ':' || alvo_prop::text,
         'radar_proposta_escolhida:' || alvo_pedido::text || ':' || alvo_prop::text
       );
  end if;
  return null;
end $$;

drop trigger if exists z_radar_proposta_fechada_cancelar_whatsapp on public.radar_propostas;
create trigger z_radar_proposta_fechada_cancelar_whatsapp
  after update of status or delete on public.radar_propostas
  for each row
  execute function public.radar_proposta_fechada_cancelar_whatsapp();

create or replace function public.fechar_pedido_radar(p_pedido uuid, p_motivo text)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  p   public.radar_pedidos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_motivo not in ('resolvido', 'cancelado') then
    raise exception 'Escolha "Já resolvi" ou "Cancelar".' using errcode = '22023';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_pedido for update;
  if p.id is null or p.comprador_id is distinct from uid then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p.fechado_motivo = p_motivo then
    perform public.radar_cancelar_fila_pedido(p.id);
    return p.status::text;                         -- toque repetido
  end if;
  if p.status = 'aberto' or (p_motivo = 'cancelado' and p.status = 'em_analise') then
    update public.radar_pedidos x
       set status = case when p_motivo = 'resolvido' then 'atendido'::public.status_pedido else 'encerrado'::public.status_pedido end,
           fechado_em = now(), fechado_motivo = p_motivo
     where x.id = p.id
    returning * into p;
    perform public.radar_cancelar_fila_pedido(p.id);
    return p.status::text;
  end if;
  raise exception 'Este pedido já está fechado.' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------
-- 3. Proposta nova → comprador (app + WhatsApp na fila)
-- ---------------------------------------------------------------------
create or replace function public.radar_avisar_proposta()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p         public.radar_pedidos;
  v         public.vitrines_lojas;
  vars      jsonb;
  ligados   jsonb;
  modelo_wa public.modelos_mensagem;
  texto_wa  text;
begin
  select * into p from public.radar_pedidos x where x.id = new.pedido_id;
  select * into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if p.id is null or v.id is null then return null; end if;

  vars := jsonb_build_object(
    'pedido', p.titulo,
    'loja', case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
    'preco', coalesce(public.radar_reais(new.preco_centavos), '')
  );

  perform public.radar_aviso(
    p.comprador_id, 'proposta_nova', p.microrregiao_id,
    vars, '/radar/pedido/' || p.id::text, 'proposta_nova:' || new.id::text
  );

  ligados := public.config('radar.avisos_ligados', p.microrregiao_id, null);
  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb
     and not (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_nova'))
     and p.status = 'aberto' and p.expira_em > now() and new.status = 'ativa'
     and p.comprador_id <> v.dono_id
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.comprador_id)
     and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = p.comprador_id)
     and not exists (select 1 from public.lixeira_contas l where l.usuario_id = p.comprador_id)
     and not exists (
       select 1 from public.preferencias_avisos pa
        where pa.usuario_id = p.comprador_id and pa.tipo = 'proposta_nova'
          and pa.canal in ('app', 'whatsapp') and not pa.ligado
     ) then
    select * into modelo_wa from public.modelos_mensagem x
     where x.chave = 'proposta_nova' and x.canal = 'whatsapp';
    if modelo_wa.id is not null and modelo_wa.ativo then
      begin
        texto_wa := public.mensagem_montar(modelo_wa.texto, vars, 1000);
        perform public.whatsapp_enfileirar(
          p.comprador_id, texto_wa, '/radar/pedido/' || p.id::text,
          'radar_proposta_nova:' || p.id::text || ':' || new.id::text
        );
      exception when others then
        -- aviso nunca derruba o envio da proposta
        raise warning 'Aviso de WhatsApp da proposta nova não saiu: %', sqlerrm;
      end;
    end if;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. Escolher proposta → lojista (app + WhatsApp na fila)
-- ---------------------------------------------------------------------
create or replace function public.escolher_proposta(p_proposta_id uuid)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid       text := public.usuario_id();
  rp        public.radar_propostas;
  v         public.vitrines_lojas;
  p         public.radar_pedidos;
  fone      text;
  vars      jsonb;
  ligados   jsonb;
  modelo_wa public.modelos_mensagem;
  texto_wa  text;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into rp from public.radar_propostas x where x.id = p_proposta_id;
  select * into p  from public.radar_pedidos x where x.id = rp.pedido_id for update;
  -- A edição da oferta e o encerramento também travam o pedido. Releia após a trava.
  select * into rp from public.radar_propostas x where x.id = p_proposta_id for update;
  if p.comprador_id is distinct from uid then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  if rp.status <> 'ativa' or p.status in ('em_analise', 'congelado') or p.fechado_motivo in ('cancelado', 'moderacao') then
    raise exception 'Esta proposta não está mais disponível.' using errcode = 'P0002';
  end if;
  select * into v from public.vitrines_lojas x where x.id = rp.vitrine_id;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está atendendo pelo Mercado da Região agora.' using errcode = 'P0002';
  end if;
  select public.contato_publico_vitrine(v, pf) into fone
    from public.perfis pf where pf.id = v.dono_id;
  if fone is null then
    raise exception 'Esta loja ainda não tem WhatsApp confirmado. Tente outra proposta.' using errcode = 'P0001';
  end if;
  if not rp.escolhida then
    update public.radar_propostas x set escolhida = true, escolhida_em = now() where x.id = rp.id;
    vars := jsonb_build_object('pedido', p.titulo, 'loja', v.nome);
    perform public.radar_aviso(
      v.dono_id, 'proposta_escolhida', p.microrregiao_id,
      vars, '/radar/' || p.id::text, 'proposta_escolhida:' || rp.id::text
    );

    ligados := public.config('radar.avisos_ligados', p.microrregiao_id, null);
    if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb
       and not (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_escolhida'))
       and p.status = 'aberto' and p.expira_em > now()
       and v.arquivada_em is null and v.excluida_em is null
       and v.dono_id <> p.comprador_id
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
       and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'proposta_escolhida'
            and pa.canal in ('app', 'whatsapp') and not pa.ligado
       ) then
      select * into modelo_wa from public.modelos_mensagem x
       where x.chave = 'proposta_escolhida' and x.canal = 'whatsapp';
      if modelo_wa.id is not null and modelo_wa.ativo then
        begin
          texto_wa := public.mensagem_montar(modelo_wa.texto, vars, 1000);
          perform public.whatsapp_enfileirar(
            v.dono_id, texto_wa, '/radar/' || p.id::text,
            'radar_proposta_escolhida:' || p.id::text || ':' || rp.id::text
          );
        exception when others then
          -- aviso nunca derruba a escolha da proposta
          raise warning 'Aviso de WhatsApp da proposta escolhida não saiu: %', sqlerrm;
        end;
      end if;
    end if;
  end if;
  return query select fone, format('Olá, %s! Vi sua proposta no Radar do Mercado da Região para "%s".', v.nome, p.titulo);
end $$;

-- ---------------------------------------------------------------------
-- 5. Fila de envio: pegar e confirmar envio cobrem os 3 avisos do Radar
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_fila_pegar_em(p_limite integer, p_quando timestamptz)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  dentro_janela boolean := public.proxima_janela_whatsapp(p_quando) = p_quando;
begin
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < p_quando - interval '10 minutes';

  -- Aviso de pedido novo de pedido fechado, vencido, fora do prazo de propostas ou lotado não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (
       select 1 from public.radar_pedidos rp
        where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and rp.total_propostas < rp.max_propostas
          and (rp.modo_contato <> 'propostas_prazo' or (rp.propostas_ate is not null and rp.propostas_ate > p_quando)));

  -- Aviso de proposta nova de pedido fechado/vencido ou proposta removida/oculta não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_nova:%'
     and not exists (
       select 1 from public.radar_pedidos rp
         join public.radar_propostas pr on pr.pedido_id = rp.id
        where rp.id::text = substring(f.chave from '^radar_proposta_nova:([0-9a-f-]{36}):')
          and pr.id::text = substring(f.chave from '([^:]+)$')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and pr.status = 'ativa');

  -- Aviso de proposta escolhida de pedido fechado/vencido ou proposta indisponível não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_escolhida:%'
     and not exists (
       select 1 from public.radar_pedidos rp
         join public.radar_propostas pr on pr.pedido_id = rp.id
        where rp.id::text = substring(f.chave from '^radar_proposta_escolhida:([0-9a-f-]{36}):')
          and pr.id::text = substring(f.chave from '([^:]+)$')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and pr.status = 'ativa' and pr.escolhida);

  -- Aviso do Radar de quem desligou (SAIR ou Minha conta) não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and (not exists (select 1 from public.preferencias_avisos pa
                       where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado)
          or exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado));

  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_nova:%'
     and exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova'
                    and pa.canal in ('whatsapp', 'app') and not pa.ligado);

  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_proposta_escolhida:%'
     and exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida'
                    and pa.canal in ('whatsapp', 'app') and not pa.ligado);

  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = p_quando
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= p_quando
          and (dentro_janela or x.chave like 'whatsapp_saida:%' or x.chave like 'whatsapp_resposta:%')
          and (radar_ligado or x.chave is null or (
                x.chave not like 'radar_pedido_novo:%'
                and x.chave not like 'radar_proposta_nova:%'
                and x.chave not like 'radar_proposta_escolhida:%'))
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- Conferência logo antes de enviar: whatsapp_fila_confirmar_envio (20261201020000) trata loja_ia_pronta:%
-- e delega o restante para whatsapp_fila_confirmar_envio_anterior_ia.
create or replace function public.whatsapp_fila_confirmar_envio_anterior_ia(p_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  f        public.whatsapp_fila;
  pedido   public.radar_pedidos;
  proposta public.radar_propostas;
  ligados  jsonb;
  motivo   text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorada'; end if;
  if f.chave is null or (
       f.chave not like 'radar_pedido_novo:%'
       and f.chave not like 'radar_proposta_nova:%'
       and f.chave not like 'radar_proposta_escolhida:%') then
    return 'pode';
  end if;

  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) is distinct from 'true'::jsonb then
    motivo := 'radar_desligado';
  elsif f.chave like 'radar_pedido_novo:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):');

    if not exists (select 1 from public.preferencias_avisos pa
                    where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado)
       or exists (select 1 from public.preferencias_avisos pa
                   where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or not (
            pedido.status = 'aberto' and pedido.expira_em > now()
            and pedido.total_propostas < pedido.max_propostas
            and (pedido.modo_contato <> 'propostas_prazo' or (pedido.propostas_ate is not null and pedido.propostas_ate > now()))) then
      motivo := 'pedido_fechado';
    elsif public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria) is null
       or not exists (
         select 1 from public.vitrines_lojas v
           join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
          where v.id::text = substring(f.chave from '([^:]+)$')
            and v.dono_id = f.usuario_id and v.dono_id <> pedido.comprador_id
            and v.status = 'ativa' and v.microrregiao_id = pedido.microrregiao_id
            and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
            and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
            and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
            and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
            and public.recebe_aviso_radar_na_hora(v.dono_id)
            and public.radar_pedido_na_area(pedido, v)
            and exists (select 1 from public.anuncios a
                         where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
                           and public.radar_nicho_corresponde(public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria), a.categoria_id))) then
      motivo := 'sem_direito_aviso';
    end if;
  elsif f.chave like 'radar_proposta_nova:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_proposta_nova:([0-9a-f-]{36}):');
    select * into proposta from public.radar_propostas pr
     where pr.id::text = substring(f.chave from '([^:]+)$') and pr.pedido_id = pedido.id;
    ligados := case when pedido.id is not null then public.config('radar.avisos_ligados', pedido.microrregiao_id, null) else null end;

    if exists (select 1 from public.preferencias_avisos pa
                where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_nova'
                  and pa.canal in ('whatsapp', 'app') and not pa.ligado)
       or (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_nova'))
       or not exists (select 1 from public.modelos_mensagem m where m.chave = 'proposta_nova' and m.canal = 'whatsapp' and m.ativo) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or proposta.id is null
       or not (pedido.status = 'aberto' and pedido.expira_em > now() and proposta.status = 'ativa') then
      motivo := 'pedido_fechado';
    elsif not exists (
      select 1 from public.perfis pf
       where pf.id = pedido.comprador_id and pf.id = f.usuario_id
         and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
         and not exists (select 1 from public.contas_revogadas r where r.usuario_id = pf.id)
         and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = pf.id)
         and not exists (select 1 from public.lixeira_contas l where l.usuario_id = pf.id)
    ) then
      motivo := 'sem_direito_aviso';
    end if;
  elsif f.chave like 'radar_proposta_escolhida:%' then
    select * into pedido from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_proposta_escolhida:([0-9a-f-]{36}):');
    select * into proposta from public.radar_propostas pr
     where pr.id::text = substring(f.chave from '([^:]+)$') and pr.pedido_id = pedido.id;
    ligados := case when pedido.id is not null then public.config('radar.avisos_ligados', pedido.microrregiao_id, null) else null end;

    if exists (select 1 from public.preferencias_avisos pa
                where pa.usuario_id = f.usuario_id and pa.tipo = 'proposta_escolhida'
                  and pa.canal in ('whatsapp', 'app') and not pa.ligado)
       or (jsonb_typeof(ligados) = 'array' and not (ligados ? 'proposta_escolhida'))
       or not exists (select 1 from public.modelos_mensagem m where m.chave = 'proposta_escolhida' and m.canal = 'whatsapp' and m.ativo) then
      motivo := 'radar_desligado';
    elsif pedido.id is null or proposta.id is null
       or not (pedido.status = 'aberto' and pedido.expira_em > now() and proposta.status = 'ativa' and proposta.escolhida) then
      motivo := 'pedido_fechado';
    elsif not exists (
      select 1 from public.vitrines_lojas v
        join public.perfis pf on pf.id = v.dono_id
       where v.id = proposta.vitrine_id
         and v.dono_id = f.usuario_id and v.dono_id <> pedido.comprador_id
         and v.status = 'ativa' and v.arquivada_em is null and v.excluida_em is null
         and v.microrregiao_id = pedido.microrregiao_id
         and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
         and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
         and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
         and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
    ) then
      motivo := 'sem_direito_aviso';
    end if;
  end if;

  if motivo is null then return 'pode'; end if;
  update public.whatsapp_fila set estado = 'cancelada', erro = motivo where id = f.id;
  return 'cancelada';
end $$;

-- ---------------------------------------------------------------------
-- 6. SAIR, VOLTAR e preferência do site cobrem os 3 avisos do Radar
-- ---------------------------------------------------------------------
create or replace function public.salvar_preferencia_whatsapp_radar(p_ligado boolean)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_ligado is null then
    raise exception 'Escolha ligar ou desligar.' using errcode = '22023';
  end if;
  if p_ligado and not public.whatsapp_confirmado(uid) then
    raise exception 'Confirme seu WhatsApp antes de ligar os avisos por WhatsApp.' using errcode = '42501';
  end if;
  if p_ligado and (public.config('radar.whatsapp_ativo', null, 'false'::jsonb) is distinct from 'true'::jsonb) then
    raise exception 'Este aviso ainda não está disponível.' using errcode = '55000';
  end if;
  insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
  values (uid, 'pedido_novo', 'whatsapp', p_ligado, now()),
         (uid, 'proposta_nova', 'whatsapp', p_ligado, now()),
         (uid, 'proposta_escolhida', 'whatsapp', p_ligado, now())
  on conflict (usuario_id, tipo, canal) do update set ligado = excluded.ligado, atualizado_em = now();
  return p_ligado;
end $$;

create or replace function public.whatsapp_sair(p_numero text, p_comando text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo record;
  achou boolean := false;
  primeiro text;
  variantes text[];
  numero13 text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_comando not in ('SAIR', 'PARAR', 'STOP', 'CANCELAR') then
    raise exception 'Pedido de saída inválido.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  for alvo in select distinct pf.id from public.perfis pf where pf.whatsapp = any(variantes) order by pf.id loop
    achou := true;
    primeiro := coalesce(primeiro, alvo.id);
    perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || alvo.id));
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (alvo.id, 'pedido_novo', 'whatsapp', false, now()),
           (alvo.id, 'proposta_nova', 'whatsapp', false, now()),
           (alvo.id, 'proposta_escolhida', 'whatsapp', false, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = false, atualizado_em = now();
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
     where f.usuario_id = alvo.id and f.estado = 'pendente'
       and (f.chave like 'radar_pedido_novo:%'
            or f.chave like 'radar_proposta_nova:%'
            or f.chave like 'radar_proposta_escolhida:%');
    insert into public.whatsapp_respostas (usuario_id, comando) values (alvo.id, p_comando);
  end loop;
  delete from public.whatsapp_ultima_mensagem where numero = any(variantes);
  if achou then
    insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
    values (primeiro, p_numero,
            'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações.',
            null,
            'whatsapp_saida:' || numero13 || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
            now())
    on conflict (chave) where chave is not null do nothing;
  end if;
  return achou;
end $$;

create or replace function public.whatsapp_mensagem_recebida(p_numero text, p_intencao text, p_hash text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text;
  numero13 text;
  variantes text[];
  radar_ligado boolean;
  pref_ligada boolean;
  pref_existe boolean;
  sino_desligado boolean;
  pref_mudou_em timestamptz;
  ultima_saida timestamptz;
  ultimo_voltar timestamptz;
  ultima_pergunta timestamptz;
  saiu boolean;
  pergunta_pendente boolean;
  hash_anterior text;
  recebido_anterior timestamptz;
  resultado text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_intencao not in ('voltar', 'sim', 'outra')
     or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Mensagem recebida inválida.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;

  select pf.id into uid from public.perfis pf
   where pf.whatsapp = any(variantes) and pf.whatsapp_verificado_em is not null
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = pf.id)
   order by pf.id limit 1;
  if uid is null then return 'sem_conta'; end if;

  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || uid));

  if p_intencao = 'outra' then
    delete from public.whatsapp_ultima_mensagem where recebido_em < now() - interval '1 day';
    select u.hash, u.recebido_em into hash_anterior, recebido_anterior
      from public.whatsapp_ultima_mensagem u where u.numero = numero13;
    insert into public.whatsapp_ultima_mensagem (numero, hash, recebido_em) values (numero13, p_hash, clock_timestamp())
      on conflict (numero) do update set hash = excluded.hash, recebido_em = excluded.recebido_em;
    if hash_anterior = p_hash and recebido_anterior > now() - interval '1 day' then
      return 'mensagem_repetida';
    end if;
  else
    delete from public.whatsapp_ultima_mensagem where numero = numero13;
  end if;

  radar_ligado := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) into pref_ligada;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp') into pref_existe;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado) into sino_desligado;
  select pa.atualizado_em into pref_mudou_em from public.preferencias_avisos pa
   where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp';
  select max(r.criado_em) into ultima_saida from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR');
  select max(r.criado_em) into ultimo_voltar from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'VOLTAR';
  select max(r.criado_em) into ultima_pergunta from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'PERGUNTA_VOLTAR';
  saiu := ultima_saida is not null and (ultimo_voltar is null or ultimo_voltar < ultima_saida)
          and (pref_mudou_em is null or pref_mudou_em <= ultima_saida);
  pergunta_pendente := ultima_pergunta is not null and ultima_pergunta > now() - interval '7 days'
    and not exists (select 1 from public.whatsapp_respostas r
                     where r.usuario_id = uid and r.criado_em > ultima_pergunta
                       and r.comando in ('VOLTAR', 'SAIR', 'PARAR', 'STOP', 'CANCELAR'));

  if p_intencao = 'voltar' or (p_intencao = 'sim' and pergunta_pendente) then
    if not radar_ligado then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'pausado', 'No momento os avisos do Radar pelo WhatsApp estão pausados.');
      return 'pausado';
    end if;
    if not pref_existe and ultima_saida is null then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'orientacao', 'Para receber pedidos do Radar no WhatsApp, ligue em Minha conta > Notificações no Mercado da Região.');
      return 'orientacao';
    end if;
    if sino_desligado then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'sino', 'Para voltar a receber pedidos do Radar pelo WhatsApp, ligue antes o aviso de pedido novo no app em Minha conta > Notificações. Depois responda VOLTAR.');
      return 'sino_desligado';
    end if;
    if pref_ligada then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'ja_ativo', 'Você já recebe os pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
      return 'ja_ativo';
    end if;
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (uid, 'pedido_novo', 'whatsapp', true, now()),
           (uid, 'proposta_nova', 'whatsapp', true, now()),
           (uid, 'proposta_escolhida', 'whatsapp', true, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = true, atualizado_em = now();
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'VOLTAR');
    perform public.whatsapp_resposta_automatica(uid, p_numero, 'voltar' || to_char(clock_timestamp(), 'HH24MISSUS'), 'Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
    return 'voltou';
  end if;

  if p_intencao = 'sim' then return 'nada'; end if;

  if saiu and not pref_ligada and radar_ligado then
    if ultima_pergunta is not null and ultima_pergunta > now() - interval '7 days' then
      return 'ja_perguntou';
    end if;
    resultado := public.whatsapp_resposta_automatica(uid, p_numero, 'pergunta', 'Oi! Você pediu para não receber pedidos do Radar pelo WhatsApp. Quer voltar a receber? Responda SIM.');
    if resultado <> 'enviada' then return resultado; end if;
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'PERGUNTA_VOLTAR');
    return 'pergunta';
  end if;
  return 'nada';
end $$;

-- ---------------------------------------------------------------------
-- 7. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.radar_cancelar_fila_pedido(uuid),
  public.radar_pedido_fechado_cancelar_whatsapp(),
  public.radar_proposta_fechada_cancelar_whatsapp(),
  public.radar_avisar_proposta(),
  public.whatsapp_fila_pegar_em(integer, timestamptz),
  public.whatsapp_fila_confirmar_envio_anterior_ia(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.fechar_pedido_radar(uuid, text),
  public.escolher_proposta(uuid),
  public.salvar_preferencia_whatsapp_radar(boolean)
  from public, anon;
grant execute on function public.fechar_pedido_radar(uuid, text),
  public.escolher_proposta(uuid),
  public.salvar_preferencia_whatsapp_radar(boolean)
  to authenticated;

revoke all on function public.whatsapp_sair(text, text),
  public.whatsapp_mensagem_recebida(text, text, text)
  from public, anon, authenticated;
grant execute on function public.whatsapp_sair(text, text),
  public.whatsapp_mensagem_recebida(text, text, text)
  to service_role;
