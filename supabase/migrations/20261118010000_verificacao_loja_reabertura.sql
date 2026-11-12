-- Verificação de lojas: o selo só cai quando muda o que a revisão confere de verdade
-- (CNPJ, endereço, cidade, bairro, região, mapa e WhatsApp). Mudar nome ou Instagram mantém o selo
-- e deixa um aviso aberto para a equipe olhar.

create table public.verificacao_loja_avisos (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  tipo text not null check (tipo in ('mudou_nome','mudou_instagram','receita_inativa','amostra_erro')),
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por text references public.perfis(id) on delete set null
);
create unique index verificacao_loja_avisos_aberto_unico
  on public.verificacao_loja_avisos (vitrine_id, tipo) where resolvido_em is null;
alter table public.verificacao_loja_avisos enable row level security;
revoke all on public.verificacao_loja_avisos from public, anon, authenticated;

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
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.verificacao_estado := old.verificacao_estado;
    new.verificacao_revisao := old.verificacao_revisao;
    new.verificacao_motivo := old.verificacao_motivo;
    new.selo_loja_verificada := old.selo_loja_verificada;
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

create or replace function public.reabrir_verificacao_por_perfil()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  update public.vitrines_lojas
     set verificacao_estado = 'pendente', verificacao_motivo = null,
         verificacao_revisao = verificacao_revisao + 1, selo_loja_verificada = false
   where dono_id = new.id and tipo = 'loja';
  return null;
end $$;
drop trigger z_reabrir_verificacao_por_perfil on public.perfis;
create trigger z_reabrir_verificacao_por_perfil after update on public.perfis
  for each row
  when (old.whatsapp is distinct from new.whatsapp
        or (old.whatsapp_verificado_em is null) <> (new.whatsapp_verificado_em is null))
  execute function public.reabrir_verificacao_por_perfil();

create or replace function public.avisar_mudanca_loja_verificada()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if old.nome is distinct from new.nome then
    insert into public.verificacao_loja_avisos(vitrine_id, tipo, detalhe)
    values (new.id, 'mudou_nome', jsonb_build_object('antes', old.nome, 'depois', new.nome))
    on conflict do nothing;
  end if;
  if old.instagram is distinct from new.instagram then
    insert into public.verificacao_loja_avisos(vitrine_id, tipo, detalhe)
    values (new.id, 'mudou_instagram', jsonb_build_object('antes', old.instagram, 'depois', new.instagram))
    on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function public.avisar_mudanca_loja_verificada() from public, anon, authenticated;
create trigger z_aviso_verificacao_loja after update on public.vitrines_lojas
  for each row
  when (old.selo_loja_verificada and new.selo_loja_verificada
        and (old.nome is distinct from new.nome or old.instagram is distinct from new.instagram))
  execute function public.avisar_mudanca_loja_verificada();
