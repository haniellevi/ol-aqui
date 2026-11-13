-- Radar v2 · fase 2 · Conversas: Radar, bloquear, denunciar, leitura do admin e limpeza.
-- O Radar não é editado: dois gatilhos novos em radar_propostas fazem a ligação.

-- ---------------------------------------------------------------------
-- 1. Proposta do Radar abre a conversa (cartão "proposta")
-- ---------------------------------------------------------------------
create or replace function public.conversas_ao_propor()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_cli  text;
  v_conv uuid;
begin
  if not public.conversas_ligadas() then return null; end if;
  select p.comprador_id into v_cli from public.radar_pedidos p where p.id = new.pedido_id;
  if v_cli is null then return null; end if;
  insert into public.conversas (cliente_id, vitrine_id, origem, loja_lido_em)
  values (v_cli, new.vitrine_id, 'radar', clock_timestamp())
  on conflict (cliente_id, vitrine_id) do nothing;
  select c.id into v_conv from public.conversas c where c.cliente_id = v_cli and c.vitrine_id = new.vitrine_id;
  insert into public.conversa_mensagens (conversa_id, autor_id, lado, tipo, texto, anuncio_id, pedido_id, proposta_id)
  values (v_conv, public.usuario_id(), 'loja', 'proposta', left(nullif(btrim(new.mensagem), ''), 1000),
          new.anuncio_id, new.pedido_id, new.id);
  update public.conversas set ultima_msg_em = clock_timestamp(), loja_lido_em = clock_timestamp() where id = v_conv;
  return null;
end $$;
create trigger conversas_proposta_radar after insert on public.radar_propostas
  for each row execute function public.conversas_ao_propor();

-- Loja bloqueada pelo cliente não manda proposta nos pedidos dele.
create or replace function public.conversas_bloqueio_proposta()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.radar_pedidos p
               join public.conversa_bloqueios b on b.cliente_id = p.comprador_id and b.vitrine_id = new.vitrine_id and b.por = 'cliente'
              where p.id = new.pedido_id) then
    raise exception 'Este cliente não recebe propostas da sua loja.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger conversas_bloqueio_proposta before insert on public.radar_propostas
  for each row execute function public.conversas_bloqueio_proposta();

-- ---------------------------------------------------------------------
-- 2. Bloquear / desbloquear (vale para o par cliente ↔ loja inteiro)
-- ---------------------------------------------------------------------
create or replace function public.bloquear_conversa(p_conversa uuid, p_bloquear boolean)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_papel text;
  c       public.conversas;
begin
  perform public.conversas_exigir_ligadas();
  v_papel := public.conversa_papel(p_conversa);
  if v_papel is null then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  select * into c from public.conversas x where x.id = p_conversa;
  if coalesce(p_bloquear, true) then
    insert into public.conversa_bloqueios (cliente_id, vitrine_id, por)
    values (c.cliente_id, c.vitrine_id, v_papel) on conflict do nothing;
  else
    delete from public.conversa_bloqueios b
     where b.cliente_id = c.cliente_id and b.vitrine_id = c.vitrine_id and b.por = v_papel;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Denunciar (vai para a fila da equipe e já bloqueia)
-- ---------------------------------------------------------------------
alter table public.denuncias drop constraint denuncias_alvo_tipo_check;
alter table public.denuncias add constraint denuncias_alvo_tipo_check
  check (alvo_tipo in ('anuncio', 'pedido', 'vitrine', 'conversa'));

-- Denúncia de conversa só pela função (quem denuncia precisa participar da conversa).
drop policy if exists "denunciar" on public.denuncias;
create policy "denunciar" on public.denuncias for insert
  with check (denunciante_id = public.usuario_id() and status = 'aberta' and alvo_tipo <> 'conversa');

-- Alvo e autor de uma denúncia não mudam depois de criada: senão a equipe "criaria" uma denúncia de conversa
-- trocando o alvo de outra e leria qualquer conversa. A equipe continua decidindo (status, nota, etc.).
create or replace function public.denuncias_alvo_fixo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if new.alvo_tipo is distinct from old.alvo_tipo or new.alvo_id is distinct from old.alvo_id then
    raise exception 'O alvo de uma denúncia não pode ser trocado.' using errcode = '42501';
  end if;
  -- denunciante só muda pela troca de ID do Clerk (on update cascade): aí o ID antigo já saiu de perfis
  if new.denunciante_id is distinct from old.denunciante_id
     and exists (select 1 from public.perfis pf where pf.id = old.denunciante_id) then
    raise exception 'Quem denunciou não pode ser trocado.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger denuncias_alvo_fixo before update on public.denuncias
  for each row execute function public.denuncias_alvo_fixo();

create or replace function public.denunciar_conversa(p_conversa uuid, p_motivo text, p_detalhes text default null)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  v_det    text := nullif(btrim(coalesce(p_detalhes, '')), '');
  v_id     uuid;
begin
  perform public.conversas_exigir_ligadas();
  if public.conversa_papel(p_conversa) is null then
    raise exception 'Conversa não encontrada.' using errcode = 'P0002';
  end if;
  if p_motivo is null or p_motivo not in ('golpe', 'proibido', 'falso', 'ofensivo', 'duplicado', 'outro') then
    raise exception 'Escolha o motivo da denúncia.' using errcode = '23514', detail = 'campo:motivo';
  end if;
  if char_length(v_det) > 1000 then
    raise exception 'Escreva os detalhes em até 1.000 letras.' using errcode = '23514', detail = 'campo:detalhes';
  end if;
  insert into public.denuncias (alvo_tipo, alvo_id, denunciante_id, motivo, detalhes)
  values ('conversa', p_conversa, uid, p_motivo, v_det)
  on conflict (alvo_tipo, alvo_id, denunciante_id) do nothing
  returning id into v_id;
  if v_id is null then
    select d.id into v_id from public.denuncias d
     where d.alvo_tipo = 'conversa' and d.alvo_id = p_conversa and d.denunciante_id = uid;
  end if;
  perform public.bloquear_conversa(p_conversa, true);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Leitura do admin: só conversa denunciada; cada leitura fica registrada
--    (logs_atividade só aceita INSERT/UPDATE/DELETE, por isso uma tabela própria)
-- ---------------------------------------------------------------------
create table public.conversa_leituras_admin (
  id          bigint generated always as identity primary key,
  conversa_id uuid not null,               -- sem FK: o registro fica mesmo depois de a conversa ser apagada
  admin_id    text references public.perfis(id) on update cascade on delete set null,
  criado_em   timestamptz not null default now()
);
create index conversa_leituras_admin_idx on public.conversa_leituras_admin (conversa_id, criado_em desc);
alter table public.conversa_leituras_admin enable row level security;
revoke all on public.conversa_leituras_admin from public, anon, authenticated;

create or replace function public.admin_ler_conversa(p_conversa uuid)
returns table (id uuid, lado text, tipo text, texto text, alerta_golpe boolean, criado_em timestamptz,
               anuncio_id uuid, anuncio_titulo text, anuncio_preco_centavos bigint, anuncio_foto text, anuncio_link text,
               pedido_id uuid, pedido_titulo text, proposta_preco_centavos bigint, autor_nome text,
               proposta_id_ref uuid, proposta_retirada boolean)
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  -- mesma equipe que resolve denúncias (resolver_denuncia)
  if not public.tem_papel('moderador') then
    raise exception 'Só a equipe de moderação pode ler conversas.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.denuncias d where d.alvo_tipo = 'conversa' and d.alvo_id = p_conversa) then
    raise exception 'Só dá para ler conversa denunciada.' using errcode = '42501';
  end if;
  insert into public.conversa_leituras_admin (conversa_id, admin_id) values (p_conversa, public.usuario_id());
  return query
    select l.id, l.lado, l.tipo, l.texto, l.alerta_golpe, l.criado_em, l.anuncio_id, l.anuncio_titulo,
           l.anuncio_preco_centavos, l.anuncio_foto, l.anuncio_link, l.pedido_id, l.pedido_titulo,
           l.proposta_preco_centavos,
           case when l.lado = 'sistema' then 'Sistema' else pf.nome end,
           l.proposta_id_ref, l.proposta_retirada
      from public.conversa_mensagens_ler(p_conversa, null) l
      left join public.perfis pf on pf.id = l.autor_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Limpeza: conversa sem mensagem há conversas.guarda_dias some (com as mensagens),
--    a não ser que tenha denúncia aberta.
-- ---------------------------------------------------------------------
create or replace function public.conversas_limpar()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  delete from public.conversas c
   where c.ultima_msg_em < now() - make_interval(days => public.config_inteiro('conversas.guarda_dias', 180, 30, 3650))
     and not exists (select 1 from public.denuncias d
                      where d.alvo_tipo = 'conversa' and d.alvo_id = c.id and d.status = 'aberta');
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-conversas-limpar', '40 3 * * *', 'select public.conversas_limpar()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.conversas_ao_propor(), public.conversas_bloqueio_proposta(), public.denuncias_alvo_fixo(),
  public.bloquear_conversa(uuid, boolean), public.denunciar_conversa(uuid, text, text),
  public.admin_ler_conversa(uuid), public.conversas_limpar()
  from public, anon, authenticated;
grant execute on function public.bloquear_conversa(uuid, boolean), public.denunciar_conversa(uuid, text, text),
  public.admin_ler_conversa(uuid) to authenticated, service_role;
grant execute on function public.conversas_limpar() to service_role;
