-- Reaproveita a fila privada para dificuldades com a confirmação do WhatsApp.
alter table public.atendimentos_anuncio alter column anuncio_id drop not null;
alter table public.atendimentos_anuncio add constraint atendimento_cadastro_sem_delegacao
  check (anuncio_id is not null or not aki_ativo);
create unique index atendimento_cadastro_por_conta
  on public.atendimentos_anuncio(anunciante_id) where anuncio_id is null;

-- Guarda a referência mesmo se a pessoa apagar o histórico do Aki.
alter table public.atendimento_mensagens add column referencia_aki bigint unique;

create or replace function public.atendimento_anunciante_valido(p_anuncio uuid, p_anunciante text)
returns boolean language sql stable set search_path = public, extensions as $$
  select exists (select 1 from public.perfis p where p.id = p_anunciante)
    and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p_anunciante)
    and (p_anuncio is null or exists (
      select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
      where a.id = p_anuncio and v.dono_id = p_anunciante
    ))
$$;

create function public.abrir_atendimento_cadastro(p_mensagem bigint)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  uid text := public.usuario_id();
  resposta public.robo_mensagens;
  pergunta text;
  conversa uuid;
begin
  if uid is null or not public.atendimento_anunciante_valido(null, uid) then
    raise exception 'Entre na sua conta para pedir ajuda.' using errcode = '42501';
  end if;

  select m.* into resposta from public.robo_mensagens m
    join public.robo_conversas c on c.id = m.conversa_id and c.usuario_id = uid
    where m.id = p_mensagem and m.usuario_id = uid and m.papel = 'assistente';
  if not found then
    raise exception 'Resposta não encontrada.' using errcode = '42501';
  end if;

  -- O conflito bloqueia a conversa até o fim da transação, inclusive em cliques simultâneos.
  insert into public.atendimentos_anuncio(anunciante_id) values (uid)
    on conflict (anunciante_id) where anuncio_id is null
    do update set anunciante_id = excluded.anunciante_id returning id into conversa;
  if exists (select 1 from public.atendimento_mensagens where referencia_aki = p_mensagem) then
    return conversa;
  end if;

  select nullif(btrim(m.conteudo->>'texto'), '') into pergunta
    from public.robo_mensagens m where m.conversa_id = resposta.conversa_id
      and m.usuario_id = uid and m.papel = 'usuario' and m.id < resposta.id
    order by m.id desc limit 1;
  insert into public.atendimento_mensagens(conversa_id, autor, autor_id, texto)
    values (conversa, 'anunciante', uid, left(coalesce(pergunta, 'Preciso de ajuda com a confirmação do WhatsApp.'), 2000));
  insert into public.atendimento_mensagens(conversa_id, autor, texto, referencia_aki)
    values (conversa, 'aki', left(coalesce(nullif(btrim(resposta.conteudo->>'texto'), ''), 'Resposta do Aki sem texto.'), 2000), resposta.id);
  perform public.robo_avaliar(resposta.id, -1);
  update public.atendimentos_anuncio set aguarda_equipe = true, atualizado_em = clock_timestamp() where id = conversa;
  return conversa;
end $$;

revoke all on function public.abrir_atendimento_cadastro(bigint) from public, anon, authenticated;
grant execute on function public.abrir_atendimento_cadastro(bigint) to authenticated;

create or replace function public.enviar_mensagem_atendimento(p_conversa uuid, p_chave uuid, p_texto text, p_aki boolean default false)
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
      'Abra sua conversa privada para responder.', case when c.anuncio_id is null then '/aki?ajuda=whatsapp&atendimento=1'
           else '/minha-conta/atendimento/' || c.id end, 'atendimento:' || novo);
  end if;
  return novo;
end $$;
