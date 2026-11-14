-- Endurecimento de permissões do banco.
-- O que muda: o visitante (sem login) passa a ler só as colunas de anúncios e de lojas que as telas públicas usam;
-- quem está logado deixa de ler algumas colunas internas de anúncios e de lojas de outras pessoas; a leitura de
-- configurações internas passa por uma função que só entrega o que é público (ou tudo, para a administração);
-- a equipe lê só o que o seu papel precisa; conversas e mensagens do Merc ficam visíveis só para o dono;
-- campos que só o sistema pode mudar (IP de criação, data de criação, tipo de pessoa, origem do cadastro,
-- verificação da loja) são restaurados pelo banco; o nome da loja passa pelo mesmo filtro de palavras da
-- descrição; e privilégios de tabela que nenhum papel do site usa são retirados.
-- O uso normal do site não muda: o que o site lê e grava continua igual.
-- Idempotente: pode rodar de novo sem erro.
-- Ordem de deploy: aplicar esta migração ANTES de subir o código (o site já lê config_publica e moderacao_ia_ligada).

-- ---------------------------------------------------------------------
-- 1. Anúncios e lojas para o visitante e para quem está logado
-- ---------------------------------------------------------------------
-- Visitante: anúncios só nas colunas das telas públicas.
revoke select on table public.anuncios from anon;
grant select (
  id, slug, titulo, preco_centavos, preco_antes_centavos, aceita_troca, cidade, bairro,
  fotos, atributos, publicado_em, criado_em, destaque_ate, categoria_id, vitrine_id,
  microrregiao_id, status, fixado_na_loja
) on table public.anuncios to anon;

-- Logado: tudo menos o IP de criação e a revisão manual da equipe.
--    Lista explícita: coluna nova só fica legível para logado se entrar aqui de propósito.
revoke select on table public.anuncios from authenticated;
grant select (
  id, vitrine_id, microrregiao_id, categoria, subcategoria, titulo, descricao, preco_centavos,
  aceita_troca, cidade, bairro, fotos, atributos, status, destaque_ate, visualizacoes,
  cliques_whatsapp, total_favoritos, busca, congelado_motivo, criado_em, atualizado_em, pago_ate,
  motivo_analise, categoria_id, vendido_pelo_olaki, vendido_em, publicado_em, subido_em,
  fixado_na_loja, excluido_em, status_antes_exclusao, excluido_com_loja, categoria_sugerida_id,
  categoria_sugestao_estado, categoria_sugerida_em, slug, saiu_do_ar_em, pronto_em,
  preco_antes_centavos
) on table public.anuncios to authenticated;

-- Política de leitura de anúncios sem ler dono_id (o visitante não tem esse acesso).
--    Mesma regra: ativo/vendido, ou dona/ajudante da loja (pode_mexer_vitrine), ou administrador.
drop policy if exists "anuncios leitura publica" on public.anuncios;
create policy "anuncios leitura publica" on public.anuncios for select
  using (
    status = any (array['ativo'::public.status_anuncio, 'vendido'::public.status_anuncio])
    or public.pode_mexer_vitrine(vitrine_id)
    or public.e_admin()
  );

-- Visitante deixa de ler o ID do dono da loja. Logado (dona e administrador) continua lendo.
revoke select (dono_id) on table public.vitrines_lojas from anon;

-- -----------------------------------------------------------------
-- 2. Configurações: quem está logado lê só o que é público
-- ---------------------------------------------------------------------
create or replace function public.config_publica(p_chave text, p_microrregiao uuid default null, p_padrao jsonb default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  publica boolean;
begin
  -- administrador lê tudo (a tela de configurações já lê a tabela assim)
  if public.e_admin() then
    return public.config(p_chave, p_microrregiao, p_padrao);
  end if;
  -- a linha que config() escolheria (região primeiro, depois a global) decide se pode sair
  select c.publico into publica
    from public.configuracoes c
   where c.chave = p_chave
     and (c.microrregiao_id = p_microrregiao or c.microrregiao_id is null)
   order by (c.microrregiao_id is not null) desc
   limit 1;
  if publica is true then
    return public.config(p_chave, p_microrregiao, p_padrao);
  end if;
  return p_padrao;
end $$;

-- Quem vem pelo site (papel authenticated) usa só a função nova. Visitante (anon) nunca teve config().
revoke all on function public.config_publica(text, uuid, jsonb) from public, anon;
grant execute on function public.config_publica(text, uuid, jsonb) to authenticated;

-- A tela de moderação mostra se a análise automática está ligada. Moderador não é admin, então recebe só
-- esse sinal (sim/não), sem a configuração em si. Quem não é da equipe recebe falso.
create or replace function public.moderacao_ia_ligada()
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.tem_papel('moderador') then return false; end if;
  return coalesce(public.config('moderacao.ia_ativa', null, 'false'::jsonb) = 'true'::jsonb, false);
end $$;
revoke all on function public.moderacao_ia_ligada() from public, anon;
grant execute on function public.moderacao_ia_ligada() to authenticated;

-- Chaves que a área logada lê e que ainda não estavam marcadas como públicas.
-- Não são segredo: plano de entrada de quem vende pela primeira vez (usado na tela "Quero vender").
update public.configuracoes set publico = true where chave = 'pf.plano_inicial' and not publico;

-- Gatilhos e funções de quem está logado passam a usar config_publica()
-- (mesmos valores: as chaves que eles leem já estão marcadas como públicas)
CREATE OR REPLACE FUNCTION public.foto_do_olaki(p_url text, p_dono text, p_pasta text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  origem  text := rtrim(public.config_publica('fotos.origem', null, 'null') #>> '{}', '/');
  prefixo text;
  resto   text;
begin
  if p_url is null or p_dono is null or nullif(origem, '') is null or origem !~ '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' then
    return false;
  end if;
  prefixo := origem || '/storage/v1/object/public/anuncios/' || p_dono || '/' || coalesce(p_pasta || '/', '');
  if left(p_url, char_length(prefixo)) <> prefixo then return false; end if;
  resto := substr(p_url, char_length(prefixo) + 1);
  if p_pasta is not null then
    return resto ~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$';                 -- só o nome do arquivo
  end if;
  return resto ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'
     and resto !~ '(^|/)\.\.?(/|$)';
end $function$;


CREATE OR REPLACE FUNCTION public.limitar_rascunhos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  maximo integer;
  total  integer;
begin
  if public.acesso_sistema() or new.status <> 'rascunho' then
    return new;
  end if;
  maximo := public.numero_ou_nulo(public.config_publica('anuncio.rascunhos_max',
                (select v.microrregiao_id from public.vitrines_lojas v where v.id = new.vitrine_id), 'null'))::int;
  if maximo is null then return new; end if;
  -- Serializa criação e restauração de rascunhos da mesma vitrine.
  perform 1 from public.vitrines_lojas where id = new.vitrine_id for update;
  select count(*) into total from public.anuncios a where a.vitrine_id = new.vitrine_id and a.status = 'rascunho';
  if total >= maximo then
    raise exception using errcode = 'P0001',
      message = format('Você já tem %s rascunhos guardados. Termine ou mova um para a lixeira antes de começar outro.', total);
  end if;
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.proteger_insercao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.e_admin() then
    return new;
  end if;

  if tg_table_name = 'perfis' then
    new.e_admin := false;
    new.selo_negociador_certificado := false;
    new.whatsapp_verificado_em := null;
    new.criado_em := now();
  elsif tg_table_name = 'vitrines_lojas' then
    new.plano := coalesce(public.config_publica('loja.plano_teste', new.microrregiao_id, '"teste"') #>> '{}', 'teste');
    new.status := 'ativa';
    new.tipo := 'loja';
    new.teste_expira_em := now() + make_interval(days => coalesce((public.config_publica('teste.dias', new.microrregiao_id, '30'))::int, 30));
    new.plano_expira_em := null;
    new.gateway_cliente_id := null;
    new.gateway_assinatura_id := null;
    new.selo_loja_verificada := false;
    new.criado_em := now();
  elsif tg_table_name = 'anuncios' then
    if new.status not in ('rascunho', 'ativo') then new.status := 'ativo'; end if;
    new.pago_ate := null;
    new.destaque_ate := null;
    new.visualizacoes := 0;
    new.cliques_whatsapp := 0;
    new.total_favoritos := 0;
    new.congelado_motivo := null;
    new.motivo_analise := null;
    new.vendido_pelo_olaki := null;
    new.vendido_em := null;
    new.publicado_em := null;
    new.criado_em := now();
  elsif tg_table_name = 'radar_pedidos' then
    new.status := 'aberto';
    new.total_propostas := 0;
    new.resumo_enviado_em := null;
    new.motivo_analise := null;
    new.criado_em := now();
  end if;
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.validar_fotos_anuncio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  dono    text;
  regiao  uuid;
  foto    text;
  minimo  integer;
  publico boolean := new.status in ('ativo', 'em_analise', 'vendido');
  mudou   boolean := tg_op = 'INSERT' or new.fotos is distinct from old.fotos;
  -- Fotos que já estavam neste anúncio, nesta loja (não precisam de nova conferência de pasta).
  ja_tinha text[] := case when tg_op = 'UPDATE' and new.vitrine_id = old.vitrine_id
                          then coalesce(old.fotos, '{}') else '{}' end;
begin
  if public.acesso_sistema() then
    return new;
  end if;
  select v.dono_id, v.microrregiao_id into dono, regiao from public.vitrines_lojas v where v.id = new.vitrine_id;

  if publico and (mudou or old.status not in ('ativo', 'em_analise', 'vendido')) then
    minimo := coalesce(public.numero_ou_nulo(public.config_publica('anuncio.fotos_minimo', regiao, '1')), 0)::int;
    if coalesce(cardinality(new.fotos), 0) < minimo then
      raise exception using errcode = '23514',
        message = case when minimo = 1 then 'Coloque pelo menos 1 foto no anúncio.'
                       else format('Coloque pelo menos %s fotos no anúncio.', minimo) end,
        detail = 'campo:fotos';
    end if;
  end if;

  if not mudou or coalesce(cardinality(new.fotos), 0) = 0 then
    return new;
  end if;
  if nullif(public.config_publica('fotos.origem', null, 'null') #>> '{}', '') is null then
    raise exception using errcode = 'P0001', detail = 'campo:fotos',
      message = 'As fotos ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
  end if;
  foreach foto in array new.fotos loop
    continue when foto = any(ja_tinha);
    if not coalesce(public.foto_do_olaki(foto, dono), false) then
      raise exception using errcode = '22023', message = 'Use só fotos enviadas pelo OLAKI.', detail = 'campo:fotos';
    end if;
  end loop;
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.validar_imagens_vitrine()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.acesso_sistema() or (new.logo_url is null and new.capa_url is null) then
    return new;
  end if;
  if nullif(public.config_publica('fotos.origem', null, 'null') #>> '{}', '') is null then
    raise exception using errcode = 'P0001',
      message = 'As imagens ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
  end if;
  if new.logo_url is not null and (tg_op = 'INSERT' or new.logo_url is distinct from old.logo_url)
     and not coalesce(public.foto_do_olaki(new.logo_url, new.dono_id, 'loja'), false) then
    raise exception using errcode = '22023', message = 'Envie a logo pelo botão do OLAKI.', detail = 'campo:logo_url';
  end if;
  if new.capa_url is not null and (tg_op = 'INSERT' or new.capa_url is distinct from old.capa_url)
     and not coalesce(public.foto_do_olaki(new.capa_url, new.dono_id, 'loja'), false) then
    raise exception using errcode = '22023', message = 'Envie a capa pelo botão do OLAKI.', detail = 'campo:capa_url';
  end if;
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.validar_secao_anuncio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  s       public.loja_secoes;
  vit     uuid;
  regiao  uuid;
  maximo  integer;
  total   integer;
begin
  select * into s from public.loja_secoes where id = new.secao_id;
  if s.id is null then
    raise exception using errcode = '42501', message = 'Seção não encontrada.';
  end if;
  select a.vitrine_id into vit from public.anuncios a where a.id = new.anuncio_id;
  if vit is distinct from s.vitrine_id then
    raise exception using errcode = '42501', message = 'Só dá para pôr na seção anúncios da sua loja.', detail = 'campo:anuncios';
  end if;
  if tg_op = 'INSERT' and not public.acesso_sistema() then
    select v.microrregiao_id into regiao from public.vitrines_lojas v where v.id = s.vitrine_id;
    maximo := public.numero_ou_nulo(public.config_publica('vitrine.anuncios_por_secao_max', regiao, 'null'))::int;
    if maximo is not null then
      select count(*) into total from public.loja_secao_anuncios x where x.secao_id = new.secao_id;
      if total >= maximo then
        raise exception using errcode = 'P0001', message = format('Cada seção pode ter até %s produtos.', maximo), detail = 'campo:anuncios';
      end if;
    end if;
  end if;
  return new;
end $function$;


CREATE OR REPLACE FUNCTION public.validar_vitrine_completa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  sistema boolean := public.acesso_sistema();
  rec     record;
  nomes   text;
  lista   jsonb;
  f       text;
  achou   text;
  limpo   text[] := '{}';
begin
  -- Moderação do banner: só a equipe grava.
  if not sistema then
    if tg_op = 'INSERT' then
      new.banner_moderado_em := null;
      new.banner_moderado_motivo := null;
      new.banner_moderado_url := null;
    else
      new.banner_moderado_em := old.banner_moderado_em;
      new.banner_moderado_motivo := old.banner_moderado_motivo;
      new.banner_moderado_url := old.banner_moderado_url;
    end if;
  end if;

  -- Pessoa física não tem página de vitrine e nunca mostra endereço exato
  if new.tipo = 'pf' and not sistema then
    new.endereco := null;
    new.lat := null;
    new.lng := null;
  end if;

  -- Textos: tira espaços sobrando; vazio vira "não informado"
  new.sobre       := nullif(btrim(new.sobre), '');
  new.endereco    := nullif(regexp_replace(btrim(coalesce(new.endereco, '')), '\s+', ' ', 'g'), '');
  new.entrega_obs := nullif(regexp_replace(btrim(coalesce(new.entrega_obs, '')), '\s+', ' ', 'g'), '');
  if char_length(new.sobre) > 1500 then
    raise exception using errcode = '23514', message = 'O texto "Sobre nós" pode ter até 1500 letras.', detail = 'campo:sobre';
  end if;
  if char_length(new.endereco) > 160 then
    raise exception using errcode = '23514', message = 'O endereço pode ter até 160 letras.', detail = 'campo:endereco';
  end if;
  if char_length(new.entrega_obs) > 200 then
    raise exception using errcode = '23514', message = 'O recado da entrega pode ter até 200 letras.', detail = 'campo:entrega_obs';
  end if;
  -- A descrição curta antiga (etapa 2, ainda lida por outras telas) vira cópia do "Sobre nós", que
  -- passa pelo filtro abaixo: o dono não grava a coluna antiga direto (nenhum texto sem filtro aparece).
  if not sistema then
    if tg_op = 'INSERT' or new.sobre is distinct from old.sobre then
      new.descricao := left(new.sobre, 600);
    else
      new.descricao := old.descricao;
    end if;
  end if;
  if not sistema then
    -- A mensagem não diz a palavra: a lista não sai para quem escreve.
    if tg_op = 'INSERT' or new.sobre is distinct from old.sobre then
      if public.texto_bloqueado(new.sobre, new.microrregiao_id) is not null then
        raise exception using errcode = '23514', detail = 'campo:sobre',
          message = 'O texto "Sobre nós" tem uma palavra que não é permitida no OLAKI.';
      end if;
    end if;
    if tg_op = 'INSERT' or new.entrega_obs is distinct from old.entrega_obs then
      if public.texto_bloqueado(new.entrega_obs, new.microrregiao_id) is not null then
        raise exception using errcode = '23514', detail = 'campo:entrega_obs',
          message = 'O recado da entrega tem uma palavra que não é permitida no OLAKI.';
      end if;
    end if;
  end if;

  -- Instagram: guarda só o nome (sem @, sem endereço, minúsculo)
  if new.instagram is not null then
    new.instagram := lower(btrim(new.instagram));
    new.instagram := regexp_replace(new.instagram, '^(https?://)?(www\.)?(instagram\.com|instagr\.am)/', '');
    new.instagram := regexp_replace(new.instagram, '[/?#].*$', '');
    new.instagram := nullif(ltrim(new.instagram, '@'), '');
    if new.instagram is not null and (new.instagram !~ '^[a-z0-9._]{1,30}$' or new.instagram ~ '\.\.') then
      raise exception using errcode = '23514', message = 'Instagram inválido. Escreva só o nome, ex.: @minhaloja.', detail = 'campo:instagram';
    end if;
  end if;

  -- Localização: os dois números juntos
  if (new.lat is null) <> (new.lng is null) then
    raise exception using errcode = '23514', message = 'A localização ficou pela metade. Toque de novo em "Usar minha localização".', detail = 'campo:localizacao';
  end if;
  if new.lat is not null and (new.lat not between -90 and 90 or new.lng not between -180 and 180) then
    raise exception using errcode = '23514', message = 'Localização inválida.', detail = 'campo:localizacao';
  end if;

  -- Horários
  if new.horarios = '{}'::jsonb or jsonb_typeof(new.horarios) = 'null' then
    new.horarios := null;
  end if;
  if not public.horarios_validos(new.horarios) then
    raise exception using errcode = '23514', detail = 'campo:horarios',
      message = 'Confira os horários: a hora de abrir vem antes da hora de fechar, e os horários do mesmo dia não podem se cruzar.';
  end if;

  -- Cor do banner: uma das cores do painel. Ao trocar, cor fora da lista é recusada.
  -- Loja nova criada direto (sem passar pelo sistema) com cor fora da lista fica com a 1ª cor da lista.
  new.banner_cor := upper(btrim(coalesce(new.banner_cor, '')));
  if new.banner_cor !~ '^#[0-9A-F]{6}$' and not (tg_op = 'INSERT' and not sistema) then
    raise exception using errcode = '23514', message = 'Escolha uma das cores da lista.', detail = 'campo:banner_cor';
  end if;
  if not sistema and (tg_op = 'INSERT' or new.banner_cor is distinct from old.banner_cor) then
    lista := public.config_publica('vitrine.banner_cores', new.microrregiao_id, '[]');
    if jsonb_typeof(lista) = 'array' and jsonb_array_length(lista) > 0
       and not exists (select 1 from jsonb_array_elements_text(lista) c where upper(btrim(c)) = new.banner_cor) then
      if tg_op = 'INSERT' then
        select upper(btrim(c)) into new.banner_cor from jsonb_array_elements_text(lista) c
         where upper(btrim(c)) ~ '^#[0-9A-F]{6}$' limit 1;
        new.banner_cor := coalesce(new.banner_cor, '#4B1248');
      else
        raise exception using errcode = '23514', message = 'Escolha uma das cores da lista.', detail = 'campo:banner_cor';
      end if;
    end if;
  end if;

  -- Formas de pagamento: só as da lista do painel (guarda com a grafia do painel, sem repetir).
  -- Uma forma que a loja já tinha e que o painel tirou da lista continua valendo (a loja não
  -- fica presa sem poder mudar as outras); só não dá para marcar de novo depois de tirar.
  if tg_op = 'INSERT' or new.formas_pagamento is distinct from old.formas_pagamento then
    lista := public.config_publica('vitrine.formas_pagamento', new.microrregiao_id, '[]');
    foreach f in array coalesce(new.formas_pagamento, '{}') loop
      achou := null;
      if nullif(btrim(f), '') is null then continue; end if;
      if jsonb_typeof(lista) = 'array' then
        select o into achou from jsonb_array_elements_text(lista) o
         where public.sem_acento(lower(btrim(o))) = public.sem_acento(lower(btrim(f))) limit 1;
      end if;
      if achou is null and tg_op = 'UPDATE' then
        select o into achou from unnest(old.formas_pagamento) o
         where public.sem_acento(lower(btrim(o))) = public.sem_acento(lower(btrim(f))) limit 1;
      end if;
      if achou is null then
        if not sistema then
          raise exception using errcode = '23514', message = 'Escolha as formas de pagamento da lista.', detail = 'campo:formas_pagamento';
        end if;
        achou := btrim(f);
      end if;
      if not achou = any(limpo) then limpo := limpo || achou; end if;
    end loop;
    new.formas_pagamento := limpo;
  end if;

  -- Banner com foto: só em plano com foto da fachada, e só arquivo do OLAKI na pasta <dono>/vitrine/
  if not sistema and (
       (new.banner_url is not null and (tg_op = 'INSERT' or new.banner_url is distinct from old.banner_url))
    or (new.banner_tipo = 'foto' and (tg_op = 'INSERT' or old.banner_tipo is distinct from 'foto'))) then
    select * into rec from public.recursos_vitrine(new);
    if not coalesce(rec.foto_fachada, false) then
      nomes := public.planos_com_recurso('foto');
      raise exception using errcode = '42501', detail = 'campo:banner',
        message = case when nomes is null then 'A foto da fachada não faz parte do seu plano.'
                       else format('A foto da fachada faz parte destes planos: %s.', nomes) end;
    end if;
  end if;
  if new.banner_tipo = 'foto' and new.banner_url is null then
    raise exception using errcode = '23514', message = 'Envie a foto da fachada ou escolha um banner modelo.', detail = 'campo:banner';
  end if;
  if not sistema and new.banner_url is not null and (tg_op = 'INSERT' or new.banner_url is distinct from old.banner_url) then
    if nullif(public.config_publica('fotos.origem', null, 'null') #>> '{}', '') is null then
      raise exception using errcode = 'P0001', detail = 'campo:banner',
        message = 'As imagens ainda não estão liberadas no OLAKI (falta a configuração fotos.origem). Avise o suporte.';
    end if;
    if not coalesce(public.foto_do_olaki(new.banner_url, new.dono_id, 'vitrine'), false) then
      raise exception using errcode = '22023', message = 'Envie a foto da fachada pelo botão do OLAKI.', detail = 'campo:banner';
    end if;
    -- a foto que a equipe tirou não volta
    if new.banner_url = new.banner_moderado_url then
      raise exception using errcode = '42501', detail = 'campo:banner',
        message = 'Essa foto foi tirada pela equipe do OLAKI. Envie outra foto ou escolha um banner modelo.';
    end if;
    -- foto nova (diferente da que foi tirada): o aviso de moderação antigo sai
    new.banner_moderado_em := null;
    new.banner_moderado_motivo := null;
  end if;
  return new;
end $function$;



-- texto_bloqueado() devolve só o sinal 'bloqueado' (ou nulo). A palavra da lista não sai do banco.
-- Roda como dono (lê a lista); continua liberada para quem está logado, porque os gatilhos a chamam como usuário.
-- ATENÇÃO: NÃO trocar os gatilhos validar_* para SECURITY DEFINER. acesso_sistema() confere current_user = 'postgres',
-- então um gatilho DEFINER pularia as regras de quem está logado (texto, selo, banner).
create or replace function public.texto_bloqueado(p_texto text, p_regiao uuid default null)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  t       text := public.sem_acento(lower(coalesce(p_texto, '')));
  lista   jsonb;
  palavra text;
begin
  if btrim(t) = '' then return null; end if;
  lista := public.config('moderacao.palavras_bloqueadas', p_regiao, '[]');
  if jsonb_typeof(lista) is distinct from 'array' then return null; end if;
  for palavra in select jsonb_array_elements_text(lista) loop
    if btrim(palavra) <> '' and t ~ ('\m' || public.sem_acento(lower(btrim(palavra))) || '\M') then
      return 'bloqueado';
    end if;
  end loop;
  return null;
end $$;

-- A regra de criação de loja (policy) também lê o plano de teste.
drop policy if exists "vitrine propria criar" on public.vitrines_lojas;
create policy "vitrine propria criar" on public.vitrines_lojas for insert
  with check (
    dono_id = public.usuario_id()
    and plano = coalesce((public.config_publica('loja.plano_teste', microrregiao_id, '"teste"'::jsonb) #>> '{}'), 'teste')
    and selo_loja_verificada = false
  );


-- -----------------------------------------------------------------
-- 3. Equipe: a moderação lê anúncios e lojas (nacional, como antes). O financeiro lê só o anúncio e a loja
-- ligados a um pagamento, que é o que a tela de Pagamentos mostra (nome da loja e título do anúncio).
-- ---------------------------------------------------------------------
create or replace function public.financeiro_ve_anuncio_pago(p_anuncio uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.tem_papel('financeiro') and exists (select 1 from public.pagamentos p where p.anuncio_id = p_anuncio) $$;

create or replace function public.financeiro_ve_loja_paga(p_loja uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.tem_papel('financeiro') and exists (select 1 from public.pagamentos p where p.vitrine_id = p_loja) $$;

revoke all on function public.financeiro_ve_anuncio_pago(uuid), public.financeiro_ve_loja_paga(uuid) from public, anon;
grant execute on function public.financeiro_ve_anuncio_pago(uuid), public.financeiro_ve_loja_paga(uuid) to authenticated;

drop policy if exists "equipe moderacao anuncios" on public.anuncios;
create policy "equipe moderacao anuncios" on public.anuncios for select
  using ((select public.tem_papel('moderador')));
drop policy if exists "equipe financeira anuncio pago" on public.anuncios;
create policy "equipe financeira anuncio pago" on public.anuncios for select to authenticated
  using ((select public.tem_papel('financeiro')) and public.financeiro_ve_anuncio_pago(anuncios.id));

drop policy if exists "equipe leitura vitrines" on public.vitrines_lojas;
create policy "equipe leitura vitrines" on public.vitrines_lojas for select
  using ((select public.tem_papel('moderador')));
drop policy if exists "equipe financeira loja paga" on public.vitrines_lojas;
create policy "equipe financeira loja paga" on public.vitrines_lojas for select to authenticated
  using ((select public.tem_papel('financeiro')) and public.financeiro_ve_loja_paga(vitrines_lojas.id));

-- -----------------------------------------------------------------
-- Conversas e mensagens do Merc: só o dono lê direto (a equipe usa a função com denúncia e registro)
-- ---------------------------------------------------------------------
drop policy if exists "robo mensagens leitura" on public.robo_mensagens;
create policy "robo mensagens leitura" on public.robo_mensagens for select
  using (usuario_id = public.usuario_id());

drop policy if exists "robo conversas leitura" on public.robo_conversas;
create policy "robo conversas leitura" on public.robo_conversas for select
  using (usuario_id = public.usuario_id());

-- ---------------------------------------------------------------------
-- 4. Campos que o dono não muda e recusa da moderação
-- ---------------------------------------------------------------------
-- 4.1 Campos protegidos numa alteração (UPDATE).
create or replace function public.proteger_campos_do_dono()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.acesso_sistema() then
    return new;
  end if;
  new.criado_em := old.criado_em;
  if tg_table_name = 'perfis' then
    new.tipo_pessoa := old.tipo_pessoa;
    new.origem_cadastro := old.origem_cadastro;
    new.campanha_cadastro := old.campanha_cadastro;
  end if;
  return new;
end $$;

-- 4.2 IP e, nas tabelas sem gatilho de criação, data: o cliente não escolhe.
create or replace function public.gravar_ip_do_servidor()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if public.acesso_sistema() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.criado_ip := public.ip_requisicao();
    if tg_table_name in ('denuncias', 'perfis_verificacoes') then
      new.criado_em := now();
    end if;
  else
    new.criado_ip := old.criado_ip;
  end if;
  return new;
end $$;

-- 4.3 Nome da loja passa pelo mesmo filtro de palavras da descrição.
-- Fica de fora: equipe (e_admin), serviço, olaki.sistema e rotina sem login (postgres).
-- quero_vender roda como postgres, mas tem login (auth.role() = authenticated): o filtro vale.
create or replace function public.validar_nome_loja_palavras()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or public.e_admin()
     or current_setting('olaki.sistema', true) = '1'
     or (coalesce(auth.role(), '') = '' and current_user in ('postgres', 'supabase_admin', 'service_role')) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.nome is not distinct from old.nome and new.tipo is not distinct from old.tipo then
    return new;
  end if;
  -- Venda como pessoa física não tem nome de loja próprio: o filtro vale só para lojas.
  if new.tipo = 'pf' then
    return new;
  end if;
  -- A mensagem não diz a palavra (a lista não sai para quem escreve).
  if public.texto_bloqueado(new.nome, new.microrregiao_id) is not null then
    raise exception using errcode = '23514', detail = 'campo:nome',
      message = 'O nome da loja tem uma palavra que não é permitida no OLAKI.';
  end if;
  return new;
end $$;

-- 4.4 Troca de nome de loja aprovada volta para conferência e zera o selo, como CNPJ e endereço.
-- Maiúscula, espaço, acento e pontuação não contam: é o mesmo critério do índice de nome único.
-- Corpo de 20261118070000_verificacao_loja_ajustes.sql + a condição do nome.
create or replace function public.proteger_verificacao_loja()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := 1;
    new.verificacao_motivo := null;
    new.selo_loja_verificada := false;
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      new.cnpj_conferido_em := null;
    end if;
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.verificacao_estado := old.verificacao_estado;
    new.verificacao_revisao := old.verificacao_revisao;
    new.verificacao_motivo := old.verificacao_motivo;
    new.selo_loja_verificada := old.selo_loja_verificada;
    new.cnpj_conferido_em := old.cnpj_conferido_em;
  end if;

  if row(new.dono_id, new.tipo, new.cnpj, new.cidade, new.bairro,
         new.microrregiao_id, new.endereco, new.lat, new.lng, new.whatsapp)
      is distinct from
     row(old.dono_id, old.tipo, old.cnpj, old.cidade, old.bairro,
         old.microrregiao_id, old.endereco, old.lat, old.lng, old.whatsapp)
     or ((old.verificacao_estado = 'aprovada' or old.selo_loja_verificada)
         and public.normalizar_nome_loja(new.nome) is distinct from public.normalizar_nome_loja(old.nome)) then
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

-- 4.5 Aviso à equipe quando muda o nome ou o Instagram de loja com selo.
-- Corpo de 20261118010000_verificacao_loja_reabertura.sql; nome comparado sem maiúscula e espaço.
create or replace function public.avisar_mudanca_loja_verificada()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.normalizar_nome_loja(old.nome) is distinct from public.normalizar_nome_loja(new.nome) then
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

-- O aviso precisa sair mesmo quando o gatilho acima já tirou o selo na mesma troca de nome.
-- Assim o aviso sai também quando a troca de nome tira o selo na mesma operação.
drop trigger if exists z_aviso_verificacao_loja on public.vitrines_lojas;
create trigger z_aviso_verificacao_loja after update on public.vitrines_lojas
  for each row
  when (old.selo_loja_verificada
        and (public.normalizar_nome_loja(old.nome) is distinct from public.normalizar_nome_loja(new.nome)
             or old.instagram is distinct from new.instagram))
  execute function public.avisar_mudanca_loja_verificada();

-- 4.6 Recusa da fila de moderação deixa o anúncio pedindo decisão da equipe.
-- Assim o anúncio recusado não volta ao ar sem nova análise da equipe.
-- Recusado = true; aprovado = false (como a tela de administração; o gatilho já fazia isso).
-- Corpo de 20261108050000_equipe_compliance.sql + a coluna revisao_manual_admin.
create or replace function public.moderar_anuncio(p_id uuid, p_decisao text, p_motivo text default null::text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a        public.anuncios;
  aprovar  boolean := p_decisao = 'aprovar';
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
begin
  if not public.tem_papel('moderador') then
    raise exception 'Só a equipe de moderação pode fazer isso.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'recusar') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  select * into a from public.anuncios x where x.id = p_id for update;
  if a.id is null then
    raise exception 'Anúncio não encontrado.' using errcode = 'P0002';
  end if;
  if a.status <> 'em_analise' then
    raise exception 'Este anúncio não está mais em análise.' using errcode = 'P0001';
  end if;
  update public.anuncios x
     set status = case when aprovar then 'ativo'::public.status_anuncio else 'pausado'::public.status_anuncio end,
         motivo_analise = case when aprovar then null else 'Recusado: ' || coalesce(v_motivo, 'fora das regras do Mercado da Região') end,
         revisao_manual_admin = not aprovar
   where x.id = a.id;
  update public.denuncias d
     set status = case when aprovar then 'improcedente' else 'procedente' end,
         resolvido_por = public.usuario_id(), resolvido_em = now()
   where d.alvo_tipo = 'anuncio' and d.alvo_id = a.id and d.status = 'aberta';
end $$;

-- Permissões: gatilho não é chamado por SQL direto (mesmo padrão das outras funções de gatilho).
revoke all on function public.proteger_campos_do_dono() from public, anon, authenticated;
revoke all on function public.gravar_ip_do_servidor() from public, anon, authenticated;
revoke all on function public.validar_nome_loja_palavras() from public, anon, authenticated;

-- 4.7 Gatilhos novos (nomes novos; nada que já existe é apagado).
drop trigger if exists perfis_proteger_campos_do_dono on public.perfis;
create trigger perfis_proteger_campos_do_dono before update on public.perfis
  for each row execute function public.proteger_campos_do_dono();
drop trigger if exists vitrines_proteger_campos_do_dono on public.vitrines_lojas;
create trigger vitrines_proteger_campos_do_dono before update on public.vitrines_lojas
  for each row execute function public.proteger_campos_do_dono();
drop trigger if exists anuncios_proteger_campos_do_dono on public.anuncios;
create trigger anuncios_proteger_campos_do_dono before update on public.anuncios
  for each row execute function public.proteger_campos_do_dono();
drop trigger if exists radar_proteger_campos_do_dono on public.radar_pedidos;
create trigger radar_proteger_campos_do_dono before update on public.radar_pedidos
  for each row execute function public.proteger_campos_do_dono();

drop trigger if exists perfis_gravar_ip_servidor on public.perfis;
create trigger perfis_gravar_ip_servidor before insert or update on public.perfis
  for each row execute function public.gravar_ip_do_servidor();
drop trigger if exists vitrines_gravar_ip_servidor on public.vitrines_lojas;
create trigger vitrines_gravar_ip_servidor before insert or update on public.vitrines_lojas
  for each row execute function public.gravar_ip_do_servidor();
drop trigger if exists anuncios_gravar_ip_servidor on public.anuncios;
create trigger anuncios_gravar_ip_servidor before insert or update on public.anuncios
  for each row execute function public.gravar_ip_do_servidor();
drop trigger if exists radar_gravar_ip_servidor on public.radar_pedidos;
create trigger radar_gravar_ip_servidor before insert or update on public.radar_pedidos
  for each row execute function public.gravar_ip_do_servidor();
drop trigger if exists perfis_verificacoes_gravar_ip_servidor on public.perfis_verificacoes;
create trigger perfis_verificacoes_gravar_ip_servidor before insert or update on public.perfis_verificacoes
  for each row execute function public.gravar_ip_do_servidor();
drop trigger if exists denuncias_gravar_ip_servidor on public.denuncias;
create trigger denuncias_gravar_ip_servidor before insert or update on public.denuncias
  for each row execute function public.gravar_ip_do_servidor();

drop trigger if exists vitrines_validar_nome_palavras on public.vitrines_lojas;
create trigger vitrines_validar_nome_palavras before insert or update of nome, tipo on public.vitrines_lojas
  for each row execute function public.validar_nome_loja_palavras();

-- 4.8 Nome de seção: a mensagem não diz a palavra (mesmo critério da loja). Corpo de 20261114030000_ajudantes_loja.sql.
create or replace function public.validar_secao_loja()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  v       record;
  rec     record;
  total   integer;
  nomes   text;
begin
  if tg_op = 'UPDATE' then
    new.vitrine_id := old.vitrine_id;
    new.criado_em := old.criado_em;
  end if;
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 40 then
    raise exception using errcode = '23514', message = 'Escreva o nome da seção (de 2 a 40 letras).', detail = 'campo:nome';
  end if;
  select x.id, x.tipo, x.microrregiao_id, x.dono_id into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if v.id is null or (not sistema and not public.pode_mexer_vitrine(v.id)) then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  if v.tipo <> 'loja' then
    raise exception using errcode = '42501', message = 'Só lojas têm seções na vitrine.';
  end if;
  if not sistema and (tg_op = 'INSERT' or new.nome is distinct from old.nome) then
    if public.texto_bloqueado(new.nome, v.microrregiao_id) is not null then
      raise exception using errcode = '23514', detail = 'campo:nome',
        message = 'O nome da seção tem uma palavra que não é permitida no OLAKI.';
    end if;
  end if;
  if exists (select 1 from public.loja_secoes s
              where s.vitrine_id = new.vitrine_id and lower(s.nome) = lower(new.nome) and s.id <> new.id) then
    raise exception using errcode = '23505', message = 'Você já tem uma seção com esse nome.', detail = 'campo:nome';
  end if;
  if tg_op = 'INSERT' then
    if not sistema then
      perform 1 from public.vitrines_lojas where id = v.id for update;   -- duas abas ao mesmo tempo não passam do limite
      select * into rec from public.recursos_vitrine_id(v.id);
      select count(*) into total from public.loja_secoes s where s.vitrine_id = v.id;
      if rec.secoes_max is not null and total >= rec.secoes_max then
        nomes := public.planos_com_recurso('secoes');
        raise exception using errcode = 'P0001',
          message = case
            when rec.secoes_max = 0 and nomes is null then 'Seções próprias não fazem parte do seu plano.'
            when rec.secoes_max = 0 then format('Seções próprias fazem parte destes planos: %s.', nomes)
            else format('Seu plano permite até %s seções. Apague uma ou troque de plano.', rec.secoes_max) end;
      end if;
    end if;
    new.ordem := least(coalesce((select max(s.ordem) from public.loja_secoes s where s.vitrine_id = v.id), 0) + 1, 10000);
    new.criado_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end $$;

-- 4.9 Anúncio recusado pela equipe antes deste lote recebe a mesma marca das recusas novas, em qualquer
-- situação (pausado, rascunho, lixeira ou já republicado): a próxima publicação passa pela equipe.
-- Não muda o status de nenhum anúncio.
-- O gatilho anuncios_0_revisao_manual_admin troca a marca para quem não é da equipe; por isso fica desligado só aqui.
alter table public.anuncios disable trigger anuncios_0_revisao_manual_admin;
update public.anuncios set revisao_manual_admin = true
 where motivo_analise like 'Recusado:%' and not revisao_manual_admin;
alter table public.anuncios enable trigger anuncios_0_revisao_manual_admin;

-- ---------------------------------------------------------------------
-- 5. Permissões de tabela e perguntas sobre outra conta
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 5.1 Privilégios de tabela que nenhum papel do site usa (TRUNCATE, REFERENCES, TRIGGER e MAINTAIN)
-- ---------------------------------------------------------------------
-- Só o dono (postgres) e o service_role usam essas permissões. A RLS controla SELECT, INSERT, UPDATE e DELETE.
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
-- Tabelas criadas daqui para a frente pelo postgres já nascem sem elas.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5.2 Quem pode perguntar sobre a conta de outra pessoa
-- ---------------------------------------------------------------------
-- Regra: a própria conta sempre pode. Visitante e logado (papel anon ou authenticated, definido pelo
-- PostgREST) só recebem resposta sobre si mesmos, a não ser que sejam administradores ou membros ativos
-- da equipe (suporte, compliance etc.: as telas de revisão de loja e de verificação consultam o WhatsApp do dono).
-- Chamadas de dentro do banco (funções de dono postgres), do service_role e do painel SQL seguem como antes.
-- Dentro de função DEFINER, current_user é sempre o dono; por isso o papel vem de current_setting('role').
create or replace function public.pode_perguntar_sobre(uid text) returns boolean
    language plpgsql stable security definer
    set search_path to 'public'
    as $$
declare
  eu text := public.usuario_id();
begin
  if uid is not distinct from eu then return true; end if;
  if coalesce(current_setting('role', true), '') not in ('anon', 'authenticated') then return true; end if;
  return coalesce((select p.e_admin from public.perfis p where p.id = eu), false)
      or exists (select 1 from public.equipe e where e.usuario_id = eu and e.ativo);
end $$;
revoke all on function public.pode_perguntar_sobre(text) from public, anon, authenticated;

-- Mesmas assinaturas e valores padrão: a RLS (e_admin()) e o site (rpc sem argumento) não mudam.
create or replace function public.e_admin(uid text default public.usuario_id()) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$ select case when public.pode_perguntar_sobre(uid)
                      then coalesce((select p.e_admin from public.perfis p where p.id = uid), false)
                      else false end $$;

create or replace function public.e_super_admin(uid text default public.usuario_id()) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$ select case when public.pode_perguntar_sobre(uid)
                      then coalesce((select p.e_super_admin from public.perfis p where p.id = uid), false)
                      else false end $$;

create or replace function public.whatsapp_confirmado(uid text default public.usuario_id()) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$ select case when public.pode_perguntar_sobre(uid)
                      then exists(select 1 from perfis where id = uid and whatsapp is not null and whatsapp_verificado_em is not null)
                      else false end $$;

create or replace function public.tem_plano_pago(uid text default public.usuario_id()) returns boolean
    language sql stable security definer
    set search_path to 'public', 'extensions'
    as $$ select case when public.pode_perguntar_sobre(uid) then public.pode_atender_radar(uid) else false end $$;

create or replace function public.propostas_restantes(uid text default public.usuario_id()) returns integer
    language plpgsql stable security definer
    set search_path to 'public', 'extensions'
    as $$
declare
  v public.vitrines_lojas;
  p public.planos;
  usadas integer;
begin
  -- Só a própria conta, o administrador ou o banco veem quantas propostas restam.
  if not public.pode_perguntar_sobre(uid) then return 0; end if;
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null then return 0; end if;
  if public.pode_atender_radar(uid) and public.radar_cortesia_ativa(v.id) then return null; end if;
  p := public.plano_efetivo(v);
  if p.codigo is null or not p.acesso_radar then return 0; end if;
  if p.propostas_radar_mes is null then return null; end if;
  select count(*) into usadas from public.radar_propostas
   where vitrine_id = v.id
     and criado_em >= case when p.e_teste then v.criado_em else date_trunc('month', now()) end;
  return greatest(p.propostas_radar_mes - usadas, 0);
end $$;

-- Limites do plano da loja: só quem pode mexer na loja (dono, ajudante), o admin, a equipe ou o banco.
-- Quem não pode recebe zeros (falha fechada); as triggers de seção e de fixado só rodam para quem grava.
create or replace function public.recursos_vitrine_id(p_vitrine uuid)
    returns table(foto_fachada boolean, secoes_max integer, fixados_max integer)
    language plpgsql stable security definer
    set search_path to 'public', 'extensions'
    as $$
declare v public.vitrines_lojas;
begin
  select * into v from public.vitrines_lojas where id = p_vitrine;
  if coalesce(current_setting('role', true), '') in ('anon', 'authenticated')
     and not (public.pode_mexer_vitrine(p_vitrine) or public.pode_perguntar_sobre(v.dono_id)) then
    return query select false, 0, 0;
    return;
  end if;
  return query select * from public.recursos_vitrine(v);
end $$;

-- A equipe da loja: o admin que é gerente aparece como equipe. Antes isto chamava e_admin(outra conta),
-- que agora responderia falso para o dono da loja. Usa a coluna que já está na consulta (p.e_admin).
create or replace function public.equipe_minha_loja(p_loja uuid)
    returns table(id uuid, final_telefone text, expira_em timestamp with time zone, gerente text, e_equipe boolean)
    language sql stable security definer
    set search_path to ''
    as $$
  select c.id, c.final_telefone, c.expira_em, p.nome,
         p.id is not null and (p.e_admin
           or exists (select 1 from public.equipe e where e.usuario_id = p.id and e.ativo))
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
    left join public.perfis p on p.id = c.aceito_por
   where v.id = p_loja and v.dono_id = public.usuario_id() and v.tipo = 'loja'
     and c.revogado_em is null and (c.aceito_por is not null or c.expira_em > now())
   order by c.expira_em desc
$$;

-- ---------------------------------------------------------------------
-- 5.3 Pedido de verificação só aponta para arquivo da própria pessoa
-- ---------------------------------------------------------------------
-- O caminho do arquivo precisa começar com o id de quem envia (formato <id>/arquivo, como no teste 80) e não pode ter "..".
-- Mesmo fluxo para quem envia para si mesmo; o site atual não insere aqui (só o admin lê).
drop policy if exists "verificacao propria envio" on public.perfis_verificacoes;
create policy "verificacao propria envio" on public.perfis_verificacoes for insert
  with check (perfil_id = public.usuario_id()
              and status = 'pendente'::public.status_verificacao
              and (arquivo_path is null
                   or (starts_with(arquivo_path, public.usuario_id() || '/') and position('..' in arquivo_path) = 0)));
