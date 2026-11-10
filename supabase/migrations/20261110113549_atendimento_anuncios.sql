-- Atendimento privado entre o anunciante e a administração. A IA só responde por delegação.
alter table public.anuncios add column revisao_manual_admin boolean not null default false;

create function public.proteger_revisao_manual_admin()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    new.revisao_manual_admin := false;
  elsif public.tem_papel('moderador') then
    if new.status = 'ativo' then new.revisao_manual_admin := false; end if;
  else
    new.revisao_manual_admin := old.revisao_manual_admin;
    if old.revisao_manual_admin then
      if new.status = 'vendido' or (old.status = 'em_analise' and new.status = 'ativo') then
        raise exception 'O anúncio precisa de uma decisão da equipe.' using errcode = 'P0001';
      end if;
      if new.status = 'ativo' then new.status := 'em_analise'; end if;
      if new.status = 'em_analise' then
        new.motivo_analise := coalesce(old.motivo_analise, 'Revisão da equipe necessária.');
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.proteger_revisao_manual_admin() from public, anon, authenticated;
create trigger anuncios_0_revisao_manual_admin before insert or update on public.anuncios
  for each row execute function public.proteger_revisao_manual_admin();

create table public.atendimentos_anuncio (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  anunciante_id text not null references public.perfis(id) on delete cascade,
  aki_ativo boolean not null default false,
  aki_versao integer not null default 0,
  aguarda_equipe boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (anuncio_id, anunciante_id)
);
create index atendimentos_anuncio_dono on public.atendimentos_anuncio(anunciante_id, atualizado_em desc, id);
create index atendimentos_anuncio_fila on public.atendimentos_anuncio(aguarda_equipe desc, atualizado_em desc, id);

create table public.atendimento_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.atendimentos_anuncio(id) on delete cascade,
  chave_envio uuid not null default gen_random_uuid(),
  autor text not null check (autor in ('equipe', 'anunciante', 'aki')),
  autor_id text,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  criado_em timestamptz not null default now(),
  aki_versao integer,
  aki_uso_id bigint unique,
  respondida_pelo_aki boolean not null default false,
  unique (conversa_id, chave_envio),
  check ((autor = 'aki') = (autor_id is null))
);
create index atendimento_mensagens_historico on public.atendimento_mensagens(conversa_id, id desc);
create index atendimento_mensagens_ritmo on public.atendimento_mensagens(conversa_id, autor_id, criado_em desc);

alter table public.atendimentos_anuncio enable row level security;
alter table public.atendimento_mensagens enable row level security;
revoke all on public.atendimentos_anuncio, public.atendimento_mensagens from public, anon, authenticated;
grant select on public.atendimentos_anuncio to authenticated;
grant select (id, conversa_id, autor, texto, criado_em) on public.atendimento_mensagens to authenticated;

create policy "participantes leem atendimento" on public.atendimentos_anuncio for select to authenticated
  using (anunciante_id = (select public.usuario_id()) or (select public.e_admin()));
create policy "participantes leem mensagens" on public.atendimento_mensagens for select to authenticated
  using (exists (select 1 from public.atendimentos_anuncio c where c.id = conversa_id));

create function public.admin_gerenciar_anuncio(p_id uuid, p_acao text, p_esperado text, p_atualizado timestamptz, p_motivo text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  a public.anuncios;
  v public.vitrines_lojas;
  motivo text := nullif(btrim(p_motivo), '');
  novo text;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  if p_acao is null or p_acao not in ('revisar', 'aprovar', 'recusar') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if p_acao <> 'aprovar' and coalesce(char_length(motivo), 0) not between 3 and 280 then
    raise exception 'Informe um motivo entre 3 e 280 caracteres.' using errcode = '22023';
  end if;
  select * into a from public.anuncios where id = p_id for update;
  if a.id is null or a.status::text is distinct from p_esperado or a.atualizado_em is distinct from p_atualizado then
    raise exception 'O anúncio mudou. Atualize a página e confira os dados antes de decidir.' using errcode = 'P0001';
  end if;
  select * into v from public.vitrines_lojas where id = a.vitrine_id;
  if p_acao = 'revisar' then
    if a.status not in ('ativo', 'pausado') then
      raise exception 'Só anúncios no ar ou pausados podem voltar para revisão.' using errcode = 'P0001';
    end if;
    -- Motivo próprio preserva a decisão humana. A IA de moderação só busca preço/palavras.
    update public.anuncios set status = 'em_analise', motivo_analise = 'Revisão da equipe: ' || motivo,
      revisao_manual_admin = true where id = a.id;
  else
    if p_acao = 'aprovar' and (v.status <> 'ativa' or not public.whatsapp_confirmado(v.dono_id)) then
      raise exception 'A vitrine precisa estar ativa e o anunciante deve confirmar o WhatsApp.' using errcode = 'P0001';
    end if;
    perform public.moderar_anuncio(a.id, p_acao, motivo);
    if p_acao = 'recusar' then
      update public.anuncios set revisao_manual_admin = true where id = a.id;
    end if;
  end if;
  select status::text into novo from public.anuncios where id = a.id;
  perform public.notificar(v.dono_id, 'anuncio_equipe', 'A equipe atualizou seu anúncio',
    'Confira a situação do anúncio em Meus anúncios.', '/minha-conta/anuncios');
  return novo;
end $$;

-- Uma conta revogada ou uma transferência do anúncio encerra o envio naquela conversa.
create function public.atendimento_anunciante_valido(p_anuncio uuid, p_anunciante text)
returns boolean language sql stable set search_path = public, extensions as $$
  select exists (
    select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
    where a.id = p_anuncio and v.dono_id = p_anunciante
      and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p_anunciante)
  )
$$;
revoke all on function public.atendimento_anunciante_valido(uuid, text) from public, anon, authenticated;

create function public.abrir_atendimento_anuncio(p_anuncio uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare dono text; conversa uuid;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  select v.dono_id into dono from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
    where a.id = p_anuncio;
  if dono is null or dono = public.usuario_id() or not public.atendimento_anunciante_valido(p_anuncio, dono) then
    raise exception 'O anunciante está indisponível para contato.' using errcode = '22023';
  end if;
  insert into public.atendimentos_anuncio(anuncio_id, anunciante_id) values (p_anuncio, dono)
    on conflict (anuncio_id, anunciante_id) do nothing returning id into conversa;
  if conversa is null then
    select id into conversa from public.atendimentos_anuncio where anuncio_id = p_anuncio and anunciante_id = dono;
  end if;
  return conversa;
end $$;

create function public.admin_whatsapp_anunciante(p_anuncio uuid)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare telefone text;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  select p.whatsapp into telefone from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    join public.perfis p on p.id = v.dono_id
    where a.id = p_anuncio and p.whatsapp_verificado_em is not null
      and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.id);
  return telefone;
end $$;

create function public.delegar_atendimento_aki(p_conversa uuid, p_ativo boolean, p_versao integer)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode = '42501'; end if;
  if p_ativo is null then raise exception 'Escolha quem vai atender.' using errcode = '22023'; end if;
  update public.atendimentos_anuncio set aki_ativo = p_ativo,
    aki_versao = aki_versao + case when aki_ativo is distinct from p_ativo then 1 else 0 end
    where id = p_conversa and aki_versao = p_versao
      and (not p_ativo or public.atendimento_anunciante_valido(anuncio_id, anunciante_id));
  if not found then raise exception 'O atendimento mudou. Atualize a conversa.' using errcode = 'P0001'; end if;
end $$;

create function public.enviar_mensagem_atendimento(p_conversa uuid, p_chave uuid, p_texto text, p_aki boolean default false)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  uid text := public.usuario_id();
  c public.atendimentos_anuncio;
  m public.atendimento_mensagens;
  texto_limpo text := regexp_replace(coalesce(p_texto, ''), '^\s+|\s+$', '', 'g');
  papel text;
  novo bigint;
begin
  if uid is null then raise exception 'Entre na sua conta.' using errcode = '28000'; end if;
  if p_chave is null or char_length(texto_limpo) not between 1 and 2000 then
    raise exception 'Escreva uma mensagem de até 2000 caracteres.' using errcode = '22023';
  end if;
  select * into c from public.atendimentos_anuncio x where x.id = p_conversa
    and (x.anunciante_id = uid or public.e_admin()) for update;
  if c.id is null then raise exception 'Conversa indisponível.' using errcode = '42501'; end if;
  if not public.atendimento_anunciante_valido(c.anuncio_id, c.anunciante_id) then
    raise exception 'O anunciante está indisponível para contato.' using errcode = 'P0001';
  end if;
  papel := case when c.anunciante_id = uid then 'anunciante' else 'equipe' end;
  select * into m from public.atendimento_mensagens where conversa_id = c.id and chave_envio = p_chave;
  if m.id is not null then
    if m.autor_id is distinct from uid or m.texto is distinct from texto_limpo then
      raise exception 'Atualize a conversa antes de enviar novamente.' using errcode = '22023';
    end if;
    return m.id;
  end if;
  if (select count(*) from public.atendimento_mensagens
      where conversa_id = c.id and autor_id = uid and criado_em >= now() - interval '1 minute') >= 30 then
    raise exception 'Aguarde um minuto antes de enviar outra mensagem.' using errcode = 'P0001';
  end if;
  insert into public.atendimento_mensagens(conversa_id, chave_envio, autor, autor_id, texto, aki_versao)
    values (c.id, p_chave, papel, uid, texto_limpo,
      case when papel = 'anunciante' and p_aki and c.aki_ativo then c.aki_versao end)
    returning id into novo;
  update public.atendimentos_anuncio set atualizado_em = clock_timestamp(), aguarda_equipe = (papel = 'anunciante') where id = c.id;
  if papel = 'equipe' then
    perform public.notificar(c.anunciante_id, 'atendimento_anuncio', 'Mensagem da equipe do OL-AKI',
      'Abra sua conversa privada para responder.', '/minha-conta/atendimento/' || c.id, 'atendimento:' || novo);
  end if;
  return novo;
end $$;

-- O servidor recebe só a pergunta escolhida pelo anunciante. Reserva e reivindicação são atômicas.
create function public.reservar_atendimento_aki(p_mensagem bigint, p_usuario text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.atendimentos_anuncio; m public.atendimento_mensagens; r record;
begin
  select x.* into c from public.atendimentos_anuncio x join public.atendimento_mensagens y on y.conversa_id = x.id
    where y.id = p_mensagem and x.anunciante_id = p_usuario for update of x;
  if c.id is null or not c.aki_ativo or not public.atendimento_anunciante_valido(c.anuncio_id, c.anunciante_id) then return null; end if;
  select * into m from public.atendimento_mensagens where id = p_mensagem;
  if m.autor <> 'anunciante' or m.autor_id is distinct from p_usuario or m.aki_versao is distinct from c.aki_versao
     or m.aki_uso_id is not null or m.criado_em < now() - interval '1 minute'
     or char_length(m.texto) > 1000 or m.texto ~* '(@|https?://|www\.|[0-9]([ .()+-]*[0-9]){5,})'
     or exists (select 1 from public.atendimento_mensagens where conversa_id = c.id and id > m.id) then
    return null;
  end if;
  select * into r from public.robo_reservar(p_usuario, 'conversa');
  if not coalesce(r.pode, false) or r.uso_id is null then return null; end if;
  update public.atendimento_mensagens set aki_uso_id = r.uso_id where id = m.id;
  return jsonb_build_object('texto', m.texto, 'uso_id', r.uso_id, 'provedor', r.provedor, 'modelo', r.modelo);
end $$;

create function public.concluir_atendimento_aki(p_mensagem bigint, p_uso bigint, p_resposta text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare c public.atendimentos_anuncio; m public.atendimento_mensagens;
begin
  select x.* into c from public.atendimentos_anuncio x join public.atendimento_mensagens y on y.conversa_id = x.id
    where y.id = p_mensagem for update of x;
  if c.id is null or not c.aki_ativo or p_uso is null or coalesce(char_length(btrim(p_resposta)), 0) not between 1 and 800
     or not public.atendimento_anunciante_valido(c.anuncio_id, c.anunciante_id) then
    return false;
  end if;
  select * into m from public.atendimento_mensagens where id = p_mensagem;
  if m.aki_uso_id is distinct from p_uso or m.aki_versao is distinct from c.aki_versao
     or not exists (select 1 from public.robo_uso u where u.id = p_uso and u.erro is null)
     or exists (select 1 from public.atendimento_mensagens where conversa_id = c.id and id > m.id) then
    return false;
  end if;
  insert into public.atendimento_mensagens(conversa_id, autor, texto) values (c.id, 'aki', p_resposta);
  update public.atendimento_mensagens set respondida_pelo_aki = true where id = m.id;
  update public.atendimentos_anuncio set atualizado_em = clock_timestamp(), aguarda_equipe = exists (
    select 1 from public.atendimento_mensagens x
    where x.conversa_id = c.id and x.autor = 'anunciante' and not x.respondida_pelo_aki
      and x.id > coalesce((select max(e.id) from public.atendimento_mensagens e
        where e.conversa_id = c.id and e.autor = 'equipe'), 0)
  ) where id = c.id;
  return true;
end $$;

revoke all on function public.admin_gerenciar_anuncio(uuid, text, text, timestamptz, text), public.abrir_atendimento_anuncio(uuid),
  public.admin_whatsapp_anunciante(uuid),
  public.delegar_atendimento_aki(uuid, boolean, integer), public.enviar_mensagem_atendimento(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_gerenciar_anuncio(uuid, text, text, timestamptz, text), public.abrir_atendimento_anuncio(uuid),
  public.admin_whatsapp_anunciante(uuid),
  public.delegar_atendimento_aki(uuid, boolean, integer), public.enviar_mensagem_atendimento(uuid, uuid, text, boolean) to authenticated;
revoke all on function public.reservar_atendimento_aki(bigint, text), public.concluir_atendimento_aki(bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.reservar_atendimento_aki(bigint, text), public.concluir_atendimento_aki(bigint, bigint, text) to service_role;
