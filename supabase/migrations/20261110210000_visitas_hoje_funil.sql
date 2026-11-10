-- Painel: medir visitas e origem, tela "Hoje" e funil de vendas de lojistas.
-- Nada fixo: origens, etapas do funil e limites da tela Hoje vêm de tabelas e de configuracoes.

-- ---------------------------------------------------------------------
-- 1. Origens das visitas (Instagram, rádio, QR da loja...)
-- ---------------------------------------------------------------------
create table public.origens_visita (
  codigo     text primary key check (codigo ~ '^[a-z0-9_-]{2,40}$'),
  nome       text not null check (char_length(btrim(nome)) between 2 and 60),
  -- endereços que contam como esta origem quando a pessoa chega sem link marcado (ex.: instagram.com)
  dominios   text[] not null default '{}',
  ordem      integer not null default 100,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.origens_visita enable row level security;
create policy "origens leitura" on public.origens_visita for select using (true);
create policy "origens admin" on public.origens_visita for all using (public.e_admin()) with check (public.e_admin());
create trigger tocar_origens_visita before update on public.origens_visita for each row execute function public.tocar_atualizado_em();
create trigger log_origens_visita after insert or update or delete on public.origens_visita for each row execute function public.registrar_log_chave();

insert into public.origens_visita (codigo, nome, dominios, ordem) values
  ('instagram',  'Instagram',            '{instagram.com,l.instagram.com}', 10),
  ('facebook',   'Facebook',             '{facebook.com,m.facebook.com,l.facebook.com,fb.com}', 20),
  ('whatsapp',   'WhatsApp',             '{wa.me,whatsapp.com,api.whatsapp.com,web.whatsapp.com}', 30),
  ('radio',      'Rádio',                '{}', 40),
  ('qr_loja',    'QR code na loja',      '{}', 50),
  ('panfleto',   'Panfleto e cartaz',    '{}', 60),
  ('indicacao',  'Indicação',            '{}', 70),
  ('google',     'Google',               '{google.com,google.com.br}', 80),
  ('outro_site', 'Outro site',           '{}', 900),
  ('direto',     'Direto (sem origem)',  '{}', 999)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Visitas (sem IP e sem conta: só um código aleatório do navegador)
-- ---------------------------------------------------------------------
create table public.visitas (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  visitante   text not null check (visitante ~ '^[a-z0-9-]{8,40}$'),
  caminho     text not null check (char_length(caminho) between 1 and 200),
  origem      text not null references public.origens_visita(codigo) on update cascade,
  campanha    text check (campanha ~ '^[a-z0-9_-]{1,60}$'),
  referencia  text check (char_length(referencia) <= 100),
  celular     boolean not null default true,
  primeira    boolean not null default false     -- primeira visita deste navegador
);
create index visitas_criado_idx on public.visitas (criado_em);
create index visitas_origem_idx on public.visitas (origem, criado_em);
create index visitas_visitante_idx on public.visitas (visitante, criado_em);
alter table public.visitas enable row level security;
create policy "visitas admin" on public.visitas for select using (public.e_admin());
revoke all on public.visitas from anon, authenticated;
grant select on public.visitas to authenticated;   -- a policy deixa só o admin

-- De onde a conta veio (primeiro clique antes do cadastro)
alter table public.perfis add column if not exists origem_cadastro text references public.origens_visita(codigo) on update cascade on delete set null;
alter table public.perfis add column if not exists campanha_cadastro text check (campanha_cadastro ~ '^[a-z0-9_-]{1,60}$');

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('visitas.guardar_dias', '400', 'visitas', false, 'Por quantos dias as visitas ficam guardadas para os gráficos'),
  ('visitas.max_por_minuto', '30', 'visitas', false, 'Quantas visitas por minuto um mesmo navegador pode registrar (o resto é ignorado)')
on conflict do nothing;

/** Normaliza um texto livre para código: minúsculas, sem acento, só letras, números, _ e -. */
create or replace function public.codigo_simples(p text, p_max integer default 60)
returns text language sql immutable
set search_path = public, extensions
as $$
  select nullif(left(regexp_replace(lower(translate(coalesce(btrim(p), ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn_')), '[^a-z0-9_-]', '', 'g'), p_max), '')
$$;

/**
 * Registra uma página vista. Chamado pelo site (visitante sem login também).
 * p_origem: o ?origem= ou ?utm_source= do link; p_referencia: o endereço do site de onde veio.
 */
create or replace function public.registrar_visita(
  p_visitante text, p_caminho text, p_origem text default null, p_campanha text default null,
  p_referencia text default null, p_celular boolean default true, p_primeira boolean default false)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_origem text;
  v_ref    text := nullif(lower(regexp_replace(left(coalesce(p_referencia, ''), 100), '^www\.', '')), '');
  v_max    integer := coalesce((public.config('visitas.max_por_minuto') #>> '{}')::integer, 30);
begin
  if p_visitante is null or p_visitante !~ '^[a-z0-9-]{8,40}$' then return null; end if;
  if p_caminho is null or left(p_caminho, 1) <> '/' or p_caminho like '/admin%' or p_caminho like '/api/%' then return null; end if;
  -- trava contra robô que fica chamando sem parar
  if (select count(*) from public.visitas where visitante = p_visitante and criado_em > now() - interval '1 minute') >= v_max then return null; end if;

  -- 1º o link marcado; 2º o site de onde veio; 3º direto
  select codigo into v_origem from public.origens_visita
   where ativa and codigo = public.codigo_simples(p_origem, 40);
  if v_origem is null and v_ref is not null then
    select codigo into v_origem from public.origens_visita
     where ativa and exists (select 1 from unnest(dominios) d where v_ref = d or v_ref like '%.' || d)
     order by ordem limit 1;
    if v_origem is null then v_origem := 'outro_site'; end if;
  end if;
  v_origem := coalesce(v_origem, 'direto');
  if not exists (select 1 from public.origens_visita where codigo = v_origem) then return null; end if;

  insert into public.visitas (visitante, caminho, origem, campanha, referencia, celular, primeira)
  values (p_visitante, left(split_part(p_caminho, '?', 1), 200), v_origem, public.codigo_simples(p_campanha, 60),
          v_ref, coalesce(p_celular, true), coalesce(p_primeira, false));

  -- limpeza de vez em quando (as antigas não servem mais aos gráficos)
  if random() < 0.002 then
    delete from public.visitas
     where criado_em < now() - make_interval(days => coalesce((public.config('visitas.guardar_dias') #>> '{}')::integer, 400));
  end if;
  return v_origem;
end $$;

/** Guarda na conta logada a origem da primeira visita do navegador (só uma vez). */
create or replace function public.marcar_origem_conta(p_origem text, p_campanha text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if public.usuario_id() is null then return; end if;
  update public.perfis
     set origem_cadastro = (select codigo from public.origens_visita where codigo = public.codigo_simples(p_origem, 40)),
         campanha_cadastro = public.codigo_simples(p_campanha, 60)
   where id = public.usuario_id() and origem_cadastro is null
     and criado_em > now() - interval '1 day'      -- só conta nova: conta antiga não ganha origem inventada
     and exists (select 1 from public.origens_visita where codigo = public.codigo_simples(p_origem, 40));
end $$;

/** Números das visitas de um período (só administrador). */
create or replace function public.admin_visitas(p_de date, p_ate date)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  ini timestamptz := (p_de::timestamp at time zone 'America/Fortaleza');
  fim timestamptz := ((p_ate + 1)::timestamp at time zone 'America/Fortaleza');
begin
  if not public.e_admin() then raise exception 'Só o administrador vê as visitas.' using errcode = '42501'; end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'visitas',    (select count(*) from visitas where criado_em >= ini and criado_em < fim),
    'pessoas',    (select count(distinct visitante) from visitas where criado_em >= ini and criado_em < fim),
    'novas',      (select count(*) from visitas where primeira and criado_em >= ini and criado_em < fim),
    'celular',    (select count(*) from visitas where celular and criado_em >= ini and criado_em < fim),
    'por_dia',    coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'visitas', n, 'pessoas', p) order by dia) from (
                    select (criado_em at time zone 'America/Fortaleza')::date as dia, count(*) n, count(distinct visitante) p
                      from visitas where criado_em >= ini and criado_em < fim group by 1) x), '[]'),
    'por_origem', coalesce((select jsonb_agg(jsonb_build_object('codigo', x.origem, 'nome', o.nome, 'visitas', x.n, 'pessoas', x.p,
                                                                'contas', coalesce(c.n, 0)) order by x.p desc) from (
                    select origem, count(*) n, count(distinct visitante) p
                      from visitas where criado_em >= ini and criado_em < fim group by 1) x
                    join origens_visita o on o.codigo = x.origem
                    left join (select origem_cadastro, count(*) n from perfis
                                where criado_em >= ini and criado_em < fim and origem_cadastro is not null group by 1) c
                      on c.origem_cadastro = x.origem), '[]'),
    'por_campanha', coalesce((select jsonb_agg(jsonb_build_object('campanha', campanha, 'origem', origem, 'visitas', n, 'pessoas', p) order by p desc) from (
                    select campanha, origem, count(*) n, count(distinct visitante) p
                      from visitas where criado_em >= ini and criado_em < fim and campanha is not null
                     group by 1, 2 order by 4 desc limit 30) x), '[]'),
    'paginas',    coalesce((select jsonb_agg(jsonb_build_object('caminho', caminho, 'visitas', n) order by n desc) from (
                    select caminho, count(*) n from visitas where criado_em >= ini and criado_em < fim
                     group by 1 order by 2 desc limit 15) x), '[]'),
    'contas_novas', (select count(*) from perfis where criado_em >= ini and criado_em < fim),
    'contas_com_origem', (select count(*) from perfis where criado_em >= ini and criado_em < fim and origem_cadastro is not null)
  );
end $$;

-- ---------------------------------------------------------------------
-- 3. Funil de vendas de lojistas (CRM simples)
-- ---------------------------------------------------------------------
create table public.funil_etapas (
  codigo     text primary key check (codigo ~ '^[a-z0-9_]{2,30}$'),
  nome       text not null check (char_length(btrim(nome)) between 2 and 40),
  tipo       text not null default 'aberta' check (tipo in ('aberta', 'ganho', 'perdido')),
  ordem      integer not null default 100,
  ativa      boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.funil_etapas enable row level security;
create policy "funil etapas leitura" on public.funil_etapas for select using (public.e_admin());
create policy "funil etapas admin" on public.funil_etapas for all using (public.e_admin()) with check (public.e_admin());
create trigger tocar_funil_etapas before update on public.funil_etapas for each row execute function public.tocar_atualizado_em();
create trigger log_funil_etapas after insert or update or delete on public.funil_etapas for each row execute function public.registrar_log_chave();

insert into public.funil_etapas (codigo, nome, tipo, ordem) values
  ('contato',  'Contato',  'aberta',  10),
  ('visitado', 'Visitado', 'aberta',  20),
  ('em_teste', 'Em teste', 'aberta',  30),
  ('pagando',  'Pagando',  'ganho',   40),
  ('cancelou', 'Cancelou', 'perdido', 50)
on conflict do nothing;

create table public.funil_lojistas (
  id              uuid primary key default gen_random_uuid(),
  microrregiao_id uuid not null references public.microrregioes(id),
  cidade_id       uuid references public.cidades(id) on delete set null,
  nome_loja       text not null check (char_length(btrim(nome_loja)) between 2 and 80),
  contato_nome    text check (char_length(contato_nome) <= 80),
  whatsapp        text check (whatsapp ~ '^55[1-9][0-9]9?[0-9]{8}$'),
  categoria_id    uuid references public.categorias(id) on delete set null,
  origem          text references public.origens_visita(codigo) on update cascade on delete set null,
  etapa           text not null references public.funil_etapas(codigo) on update cascade,
  etapa_desde     timestamptz not null default now(),
  vitrine_id      uuid unique references public.vitrines_lojas(id) on delete set null,
  responsavel_id  text references public.perfis(id) on delete set null,
  proximo_passo   text check (char_length(proximo_passo) <= 200),
  proximo_em      date,
  motivo_perda    text check (char_length(motivo_perda) <= 200),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_por      text references public.perfis(id) on delete set null,
  atualizado_por  text references public.perfis(id) on delete set null
);
create index funil_etapa_idx on public.funil_lojistas (etapa, atualizado_em desc);
create index funil_proximo_idx on public.funil_lojistas (proximo_em) where proximo_em is not null;
create index funil_whatsapp_idx on public.funil_lojistas (whatsapp) where whatsapp is not null;
alter table public.funil_lojistas enable row level security;
create policy "funil admin" on public.funil_lojistas for all using (public.e_admin()) with check (public.e_admin());
create trigger tocar_funil_lojistas before update on public.funil_lojistas for each row execute function public.tocar_atualizado_em();
create trigger log_funil_lojistas after insert or update or delete on public.funil_lojistas for each row execute function public.registrar_log();

create table public.funil_notas (
  id          uuid primary key default gen_random_uuid(),
  lojista_id  uuid not null references public.funil_lojistas(id) on delete cascade,
  texto       text not null check (char_length(btrim(texto)) between 1 and 1000),
  automatica  boolean not null default false,
  autor_id    text references public.perfis(id) on delete set null default public.usuario_id(),
  criado_em   timestamptz not null default now()
);
create index funil_notas_idx on public.funil_notas (lojista_id, criado_em desc);
alter table public.funil_notas enable row level security;
create policy "funil notas leitura" on public.funil_notas for select using (public.e_admin());
create policy "funil notas criar" on public.funil_notas for insert
  with check (public.e_admin() and not automatica and autor_id = public.usuario_id());
create policy "funil notas apagar" on public.funil_notas for delete using (public.e_admin() and not automatica);

grant select, insert, update, delete on public.funil_lojistas, public.funil_etapas, public.origens_visita to authenticated;
grant select, insert, delete on public.funil_notas to authenticated;

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('funil.etapa_ao_cadastrar', '"em_teste"', 'funil', false, 'Etapa do funil em que a loja entra sozinha quando se cadastra no site'),
  ('funil.etapa_ao_pagar',     '"pagando"',  'funil', false, 'Etapa do funil para onde a loja vai sozinha quando paga um plano')
on conflict do nothing;

-- Mudou de etapa: guarda a data e escreve a nota automática
create or replace function public.funil_ao_mudar()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_desde := now();
    insert into public.funil_notas (lojista_id, texto, automatica, autor_id)
    values (new.id, 'Mudou de ' || coalesce((select nome from funil_etapas where codigo = old.etapa), old.etapa)
                    || ' para ' || coalesce((select nome from funil_etapas where codigo = new.etapa), new.etapa) || '.',
            true, public.usuario_id());
  end if;
  if tg_op = 'UPDATE' and new.vitrine_id is distinct from old.vitrine_id and new.vitrine_id is not null then
    insert into public.funil_notas (lojista_id, texto, automatica, autor_id)
    values (new.id, 'Ligado à loja cadastrada no site.', true, public.usuario_id());
  end if;
  return new;
end $$;
create trigger funil_ao_mudar before update on public.funil_lojistas for each row execute function public.funil_ao_mudar();

-- Etapa configurada no painel, se existir e estiver ativa
create or replace function public.funil_etapa_config(p_chave text)
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select codigo from public.funil_etapas where ativa and codigo = (public.config(p_chave) #>> '{}')
$$;

-- Loja se cadastrou no site: liga ao contato do funil com o mesmo WhatsApp, ou cria um novo
create or replace function public.funil_loja_cadastrada()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_etapa text := public.funil_etapa_config('funil.etapa_ao_cadastrar');
  v_id uuid;
begin
  begin
    if v_etapa is null then return null; end if;
    if new.whatsapp is not null then
      select id into v_id from public.funil_lojistas
       where whatsapp = new.whatsapp and vitrine_id is null order by criado_em limit 1;
    end if;
    if v_id is not null then
      update public.funil_lojistas f
         set vitrine_id = new.id,
             etapa = case when (select tipo from funil_etapas where codigo = f.etapa) = 'aberta'
                           and (select ordem from funil_etapas where codigo = f.etapa) < (select ordem from funil_etapas where codigo = v_etapa)
                          then v_etapa else f.etapa end
       where id = v_id;
    else
      insert into public.funil_lojistas (microrregiao_id, nome_loja, whatsapp, etapa, vitrine_id,
                                         cidade_id, origem)
      values (new.microrregiao_id, new.nome, new.whatsapp, v_etapa, new.id,
              (select c.id from cidades c where c.microrregiao_id = new.microrregiao_id and c.nome = new.cidade limit 1),
              (select origem_cadastro from perfis where id = new.dono_id));
    end if;
  exception when others then
    -- o funil nunca pode impedir o cadastro da loja
    raise warning 'funil_loja_cadastrada: %', sqlerrm;
  end;
  return null;
end $$;
create trigger funil_loja_cadastrada after insert on public.vitrines_lojas for each row execute function public.funil_loja_cadastrada();

-- Loja passou a pagar um plano: move para a etapa de ganho configurada
create or replace function public.funil_loja_pagou()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_etapa text := public.funil_etapa_config('funil.etapa_ao_pagar');
begin
  begin
    if v_etapa is null then return null; end if;
    if new.plano_expira_em is not null and new.plano_expira_em > now()
       and (old.plano is distinct from new.plano or old.plano_expira_em is distinct from new.plano_expira_em)
       and exists (select 1 from planos p where p.codigo = new.plano and not p.e_teste and p.preco_centavos > 0) then
      update public.funil_lojistas set etapa = v_etapa where vitrine_id = new.id and etapa <> v_etapa;
    end if;
  exception when others then
    raise warning 'funil_loja_pagou: %', sqlerrm;
  end;
  return null;
end $$;
create trigger funil_loja_pagou after update of plano, plano_expira_em on public.vitrines_lojas
  for each row execute function public.funil_loja_pagou();

/** Traz para o funil as lojas que já estavam cadastradas antes dele existir (só administrador). */
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

-- ---------------------------------------------------------------------
-- 4. Tela "Hoje": limites e o "feito" de cada tarefa
-- ---------------------------------------------------------------------
create table public.hoje_feitas (
  tipo      text not null check (tipo ~ '^[a-z_]{2,30}$'),
  alvo_id   text not null check (char_length(alvo_id) between 1 and 60),
  dia       date not null default ((now() at time zone 'America/Fortaleza')::date),
  feito_por text references public.perfis(id) on delete set null default public.usuario_id(),
  criado_em timestamptz not null default now(),
  primary key (tipo, alvo_id, dia)
);
alter table public.hoje_feitas enable row level security;
create policy "hoje admin" on public.hoje_feitas for all using (public.e_admin()) with check (public.e_admin());
grant select, insert, delete on public.hoje_feitas to authenticated;

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('hoje.max_tarefas',              '10', 'hoje', false, 'Quantas tarefas a tela Hoje mostra de cada vez'),
  ('hoje.teste_acabando_dias',      '2',  'hoje', false, 'Avisar na tela Hoje quando o teste grátis da loja acaba em até quantos dias'),
  ('hoje.radar_sem_proposta_horas', '12', 'hoje', false, 'Pedido do Radar aparece na tela Hoje quando passa este tempo (horas) sem nenhuma proposta'),
  ('hoje.loja_sem_anuncio_dias',    '3',  'hoje', false, 'Loja que se cadastrou há este número de dias e ainda não tem anúncio aparece na tela Hoje'),
  ('hoje.vencidas_dias',            '30', 'hoje', false, 'Cobranças vencidas dos últimos quantos dias aparecem na tela Hoje'),
  ('hoje.msg_teste_acabando', '"Oi, {nome}! Aqui é do Mercado da Região. Seu teste grátis acaba {quando}. Quer que eu te ajude a escolher um plano para sua loja continuar aparecendo?"',
     'hoje', false, 'Mensagem pronta do WhatsApp para loja com teste acabando. Use {nome} e {quando}'),
  ('hoje.msg_cobranca_vencida', '"Oi, {nome}! Aqui é do Mercado da Região. Vi que a cobrança de {valor} venceu. Posso te mandar o link de novo para sua loja não sair do ar?"',
     'hoje', false, 'Mensagem pronta do WhatsApp para cobrança vencida. Use {nome} e {valor}'),
  ('hoje.msg_loja_sem_anuncio', '"Oi, {nome}! Aqui é do Mercado da Região. Vi que sua loja ainda não tem produtos. Posso te ajudar a colocar os primeiros agora?"',
     'hoje', false, 'Mensagem pronta do WhatsApp para loja sem anúncio. Use {nome}')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. Permissões das funções
-- ---------------------------------------------------------------------
revoke all on function public.registrar_visita(text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, boolean, boolean) to anon, authenticated, service_role;
revoke all on function public.marcar_origem_conta(text, text) from public, anon;
grant execute on function public.marcar_origem_conta(text, text) to authenticated, service_role;
revoke all on function public.admin_visitas(date, date) from public, anon;
grant execute on function public.admin_visitas(date, date) to authenticated, service_role;
revoke all on function public.funil_importar_lojas() from public, anon;
grant execute on function public.funil_importar_lojas() to authenticated, service_role;
revoke all on function public.funil_ao_mudar(), public.funil_loja_cadastrada(), public.funil_loja_pagou(), public.funil_etapa_config(text) from public, anon, authenticated;
