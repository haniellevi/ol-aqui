-- Troca de ID do Clerk (desenvolvimento -> produção).
-- Cada pessoa ganha um ID novo (user_...). O banco usa esse ID como chave em perfis(id) e em
-- dezenas de tabelas. Esta migração só PREPARA a troca; nada muda para ninguém até alguém chamar
-- public.admin_trocar_id_usuario(...) com a chave secreta (service_role).
--
-- 1) Todas as chaves estrangeiras que apontam para perfis(id) ganham ON UPDATE CASCADE
--    (descobertas pelo catálogo, sem lista à mão; o ON DELETE, o nome e as colunas ficam iguais).
-- 2) Função admin_trocar_id_usuario(antigo, novo): troca o ID de uma pessoa em tudo, numa transação só.
--    Para desfazer, chame com os dois IDs invertidos.

-- ---------------------------------------------------------------------
-- 1. ON UPDATE CASCADE em toda FK para perfis(id)
-- ---------------------------------------------------------------------
do $$
declare
  f record;
  acao text;
begin
  for f in
    select k.conrelid::regclass as tabela, k.conname, k.confdeltype, k.confmatchtype,
           k.condeferrable, k.condeferred, k.convalidated,
           (select string_agg(quote_ident(a.attname), ', ' order by u.ord)
              from unnest(k.conkey) with ordinality as u(attnum, ord)
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.attnum) as colunas,
           (select string_agg(quote_ident(a.attname), ', ' order by u.ord)
              from unnest(k.confkey) with ordinality as u(attnum, ord)
              join pg_attribute a on a.attrelid = k.confrelid and a.attnum = u.attnum) as colunas_ref
      from pg_constraint k
     where k.contype = 'f'
       and k.confrelid = 'public.perfis'::regclass
       and k.conparentid = 0
       and k.confupdtype <> 'c'            -- já com CASCADE: não mexe (migração repetível)
  loop
    acao := case f.confdeltype
              when 'a' then 'no action' when 'r' then 'restrict' when 'c' then 'cascade'
              when 'n' then 'set null'  when 'd' then 'set default' end;
    -- Um só comando: não existe instante sem a chave.
    execute format(
      'alter table %s drop constraint %I, add constraint %I foreign key (%s) references public.perfis (%s) match %s on update cascade on delete %s%s%s',
      f.tabela, f.conname, f.conname, f.colunas, f.colunas_ref,
      case f.confmatchtype when 'f' then 'full' else 'simple' end,
      acao,
      case when f.condeferrable then ' deferrable' || case when f.condeferred then ' initially deferred' else '' end else '' end,
      case when f.convalidated then '' else ' not valid' end);
  end loop;

  if exists (select 1 from pg_constraint k
              where k.contype = 'f' and k.confrelid = 'public.perfis'::regclass and k.confupdtype <> 'c') then
    raise exception 'Sobrou chave estrangeira para perfis(id) sem ON UPDATE CASCADE';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Função de troca (só service_role)
-- ---------------------------------------------------------------------
-- Colunas que guardam ID de usuário SEM chave estrangeira (a função cuida de todas):
--   logs_atividade.usuario_id, logs_atividade.registro_id (quando tabela = 'perfis')
--   robo_mensagens.usuario_id
--   equipe.adicionado_por, equipe.desativado_por
--   compliance_acessos.admin_id, compliance_acessos.alvo_usuario
--   atendimento_mensagens.autor_id
--   whatsapp_vinculos.dono_id
--   lixeira_lojas.autor, lixeira_contas.autor
--   radar_cortesias.criado_por
--   contas_revogadas.usuario_id
--   hoje_feitas.alvo_id
--   limpeza_arquivos.pasta
--   admin_gestao_eventos.autor, admin_gestao_eventos.alvo (quando tipo = 'usuario')
-- Texto do ID dentro de jsonb de histórico (troca só o ID inteiro, nunca um pedaço de outro ID):
--   logs_atividade.dados_antes e dados_depois
--   admin_gestao_eventos.detalhes, vitrines_acoes_admin.detalhes, verificacao_loja_avisos.detalhe
-- Endereços de foto do bucket 'anuncios' (.../anuncios/<ID>/...):
--   anuncios.fotos, vitrines_lojas.logo_url/capa_url/banner_url/banner_moderado_url,
--   perfis.avatar_url, radar_propostas.foto_url, aki_imagens.url/foto_original, limpeza_arquivos.url
-- Caminhos de arquivo que começam com <ID>/ :
--   perfis_verificacoes.arquivo_path, storage.objects.name (buckets 'anuncios' e 'verificacoes')
--   e storage.objects.owner_id (quando a coluna existe)
--
-- GATILHOS: perfis e quase toda tabela ligada têm gatilhos de proteção, auditoria e aviso
--   (ex.: "Versão publicada não muda" em documentos_legais, "registro do Compliance não pode ser
--   mudado" em compliance_acessos, vínculo de WhatsApp que acusa "outra conta"). Trocar o ID é
--   migração de dados, não ação da pessoa. Por isso, DENTRO desta transação, a função desliga só
--   os gatilhos de usuário (nunca os internos das chaves estrangeiras, que fazem o CASCADE) das
--   tabelas que ela toca e religa todos no fim. Se qualquer passo falhar, tudo volta (o DDL é
--   transacional, os gatilhos continuam ligados). Em troca, a própria função grava UMA linha em
--   admin_gestao_eventos (acao = 'troca_id_clerk') com os dois IDs e a contagem de linhas.
--
-- ARQUIVOS (fotos e documentos): por padrão (p_mover_arquivos = false) NADA de arquivo muda: as
--   fotos continuam na pasta do ID antigo, os endereços gravados continuam apontando para lá e
--   tudo segue aparecendo. Isso inclui endereços de foto, perfis_verificacoes.arquivo_path,
--   limpeza_arquivos.pasta/url e storage.objects. Só passe true DEPOIS de mover os arquivos de
--   verdade pela API do Storage (move): renomear storage.objects pelo banco não move o arquivo
--   físico no Supabase real e deixaria as fotos quebradas.
create or replace function public.admin_trocar_id_usuario(p_antigo text, p_novo text, p_mover_arquivos boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  formato   constant text := '^user_[A-Za-z0-9]+$';
  padrao    text := '(?<![A-Za-z0-9_])' || p_antigo || '(?![A-Za-z0-9])';  -- só o ID inteiro
  url_de    text := '/anuncios/' || p_antigo || '/';
  url_para  text := '/anuncios/' || p_novo || '/';
  tocadas   oid[];
  religar   text[] := '{}';
  f         record;
  cmd       text;
  n         bigint;
  contagem  jsonb := '{}'::jsonb;
begin
  -- Validações
  if p_antigo is null or p_novo is null or p_antigo !~ formato or p_novo !~ formato then
    raise exception 'ID inválido: use user_ seguido só de letras e números.' using errcode = '22023';
  end if;
  if p_antigo = p_novo then
    raise exception 'O ID antigo e o novo são iguais.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('admin_trocar_id_usuario', 0));

  perform 1 from public.perfis where id = p_antigo for update;
  if not found then
    raise exception 'O usuário % não existe em perfis.', p_antigo using errcode = 'P0002';
  end if;
  if exists (select 1 from public.perfis where id = p_novo) then
    raise exception 'O ID novo % já existe em perfis.', p_novo using errcode = '23505';
  end if;
  if exists (select 1 from public.contas_revogadas where usuario_id = p_novo)
     or exists (select 1 from public.whatsapp_vinculos where dono_id = p_novo) then
    raise exception 'O ID novo % já aparece em contas revogadas ou vínculos de WhatsApp.', p_novo using errcode = '23505';
  end if;

  -- Antes de mexer: quantas linhas cada chave estrangeira vai levar (relatório).
  contagem := jsonb_build_object('perfis.id', 1);
  for f in
    select k.conrelid::regclass::text as tabela, quote_ident(a.attname) as coluna
      from pg_constraint k
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.perfis'::regclass
       and k.conparentid = 0 and array_length(k.conkey, 1) = 1
  loop
    execute format('select count(*) from %s where %s = $1', f.tabela, f.coluna) into n using p_antigo;
    if n > 0 then
      contagem := contagem || jsonb_build_object(replace(f.tabela, 'public.', '') || '.' || f.coluna, n);
    end if;
  end loop;

  -- Desliga os gatilhos de usuário das tabelas que serão tocadas.
  select array_agg(distinct x) into tocadas from (
    select k.conrelid as x from pg_constraint k
     where k.contype = 'f' and k.confrelid = 'public.perfis'::regclass
    union
    select 'public.perfis'::regclass::oid
    union
    select to_regclass('public.' || nome)::oid
      from unnest(array['anuncios', 'compliance_acessos', 'atendimento_mensagens', 'whatsapp_vinculos',
                        'admin_gestao_eventos', 'logs_atividade', 'robo_mensagens', 'lixeira_lojas',
                        'lixeira_contas', 'radar_cortesias', 'hoje_feitas', 'contas_revogadas',
                        'vitrines_acoes_admin', 'verificacao_loja_avisos', 'limpeza_arquivos',
                        'perfis_verificacoes']) as nome
     where to_regclass('public.' || nome) is not null
  ) s;
  for f in
    select distinct t.tgrelid::regclass::text as tabela, t.tgname
      from pg_trigger t
     where t.tgrelid = any(tocadas) and not t.tgisinternal and t.tgenabled = 'O'
  loop
    execute format('alter table %s disable trigger %I', f.tabela, f.tgname);
    religar := religar || format('alter table %s enable trigger %I', f.tabela, f.tgname);
  end loop;

  -- O ID em si: as chaves estrangeiras (ON UPDATE CASCADE) levam o resto.
  update public.perfis set id = p_novo where id = p_antigo;

  -- Colunas com ID de usuário e sem chave estrangeira.
  for f in
    select * from (values
      ('logs_atividade', 'usuario_id'), ('robo_mensagens', 'usuario_id'),
      ('equipe', 'adicionado_por'), ('equipe', 'desativado_por'),
      ('compliance_acessos', 'admin_id'), ('compliance_acessos', 'alvo_usuario'),
      ('atendimento_mensagens', 'autor_id'), ('whatsapp_vinculos', 'dono_id'),
      ('lixeira_lojas', 'autor'), ('lixeira_contas', 'autor'), ('radar_cortesias', 'criado_por'),
      ('contas_revogadas', 'usuario_id'), ('hoje_feitas', 'alvo_id')
    ) as v(tabela, coluna)
  loop
    execute format('update public.%I set %I = $1 where %I = $2', f.tabela, f.coluna, f.coluna) using p_novo, p_antigo;
    get diagnostics n = row_count;
    if n > 0 then contagem := contagem || jsonb_build_object(f.tabela || '.' || f.coluna, n); end if;
  end loop;

  update public.logs_atividade set registro_id = p_novo where tabela = 'perfis' and registro_id = p_antigo;
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('logs_atividade.registro_id', n); end if;

  -- O registro de trocas anteriores (acao = 'troca_id_clerk') guarda os dois IDs e não é reescrito,
  -- para que desfazer não apague a prova do que foi feito.
  update public.admin_gestao_eventos set autor = p_novo where autor = p_antigo and acao <> 'troca_id_clerk';
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('admin_gestao_eventos.autor', n); end if;
  update public.admin_gestao_eventos set alvo = p_novo where tipo = 'usuario' and alvo = p_antigo and acao <> 'troca_id_clerk';
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('admin_gestao_eventos.alvo', n); end if;

  -- ID dentro de jsonb de histórico.
  for f in
    select * from (values
      ('logs_atividade', 'dados_antes', ''), ('logs_atividade', 'dados_depois', ''),
      ('admin_gestao_eventos', 'detalhes', ' and acao <> ''troca_id_clerk'''),
      ('vitrines_acoes_admin', 'detalhes', ''), ('verificacao_loja_avisos', 'detalhe', '')
    ) as v(tabela, coluna, extra)
  loop
    execute format('update public.%I set %I = regexp_replace(%I::text, $1::text, $2::text, ''g'')::jsonb where %I::text ~ $1::text%s',
                   f.tabela, f.coluna, f.coluna, f.coluna, f.extra) using padrao, p_novo;
    get diagnostics n = row_count;
    if n > 0 then contagem := contagem || jsonb_build_object(f.tabela || '.' || f.coluna, n); end if;
  end loop;

  -- Arquivos: só com p_mover_arquivos = true (ver nota acima).
  if p_mover_arquivos then
  update public.limpeza_arquivos set pasta = p_novo where pasta = p_antigo;
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('limpeza_arquivos.pasta', n); end if;

  -- Endereços de foto (.../anuncios/<ID>/...).
  update public.anuncios a
     set fotos = array(select replace(x, url_de, url_para) from unnest(a.fotos) with ordinality as t(x, i) order by i)
   where exists (select 1 from unnest(a.fotos) as x where position(url_de in x) > 0);
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('anuncios.fotos', n); end if;

  for f in
    select * from (values
      ('vitrines_lojas', 'logo_url'), ('vitrines_lojas', 'capa_url'), ('vitrines_lojas', 'banner_url'),
      ('vitrines_lojas', 'banner_moderado_url'), ('perfis', 'avatar_url'), ('radar_propostas', 'foto_url'),
      ('aki_imagens', 'url'), ('aki_imagens', 'foto_original'), ('limpeza_arquivos', 'url')
    ) as v(tabela, coluna)
  loop
    execute format('update public.%I set %I = replace(%I, $1::text, $2::text) where position($1::text in %I) > 0',
                   f.tabela, f.coluna, f.coluna, f.coluna) using url_de, url_para;
    get diagnostics n = row_count;
    if n > 0 then contagem := contagem || jsonb_build_object(f.tabela || '.' || f.coluna, n); end if;
  end loop;

  -- Caminhos que começam com <ID>/ (bucket privado de verificações e objetos do Storage).
  update public.perfis_verificacoes
     set arquivo_path = p_novo || substr(arquivo_path, length(p_antigo) + 1)
   where starts_with(arquivo_path, p_antigo || '/');
  get diagnostics n = row_count;
  if n > 0 then contagem := contagem || jsonb_build_object('perfis_verificacoes.arquivo_path', n); end if;

  if to_regclass('storage.objects') is not null then
    execute 'update storage.objects set name = $2 || substr(name, length($1) + 1)
              where bucket_id in (''anuncios'', ''verificacoes'') and starts_with(name, $1 || ''/'')'
      using p_antigo, p_novo;
    get diagnostics n = row_count;
    if n > 0 then contagem := contagem || jsonb_build_object('storage.objects.name', n); end if;
    if exists (select 1 from information_schema.columns
                where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id') then
      execute 'update storage.objects set owner_id = $2 where owner_id = $1' using p_antigo, p_novo;
      get diagnostics n = row_count;
      if n > 0 then contagem := contagem || jsonb_build_object('storage.objects.owner_id', n); end if;
    end if;
  end if;
  end if;  -- p_mover_arquivos

  -- Prova da troca (os dois IDs ficam juntos aqui; ver nota acima).
  insert into public.admin_gestao_eventos (tipo, alvo, autor, acao, motivo, detalhes)
  values ('usuario', p_novo, 'sistema', 'troca_id_clerk', 'Troca de ID do Clerk',
          jsonb_build_object('id_antigo', p_antigo, 'id_novo', p_novo, 'mover_arquivos', p_mover_arquivos, 'linhas', contagem));

  -- Religa tudo.
  foreach cmd in array religar loop
    execute cmd;
  end loop;

  return contagem;
end $$;

comment on function public.admin_trocar_id_usuario(text, text, boolean) is
  'Troca o ID do Clerk de uma pessoa em todo o banco, numa transação. Só service_role. Para desfazer, chame com os IDs invertidos. Ver docs/PLANO-CLERK-PRODUCAO.md.';

revoke all on function public.admin_trocar_id_usuario(text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_trocar_id_usuario(text, text, boolean) to service_role;
