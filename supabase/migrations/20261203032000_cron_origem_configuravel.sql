-- Origem compartilhada com Loja IA no Vault. Não altera jobs, aliases ou ACL.
-- Sem endpoint HTTPS válido, retorna null, como loja_ia_disparar.
-- CREATE OR REPLACE preserva owner, OID e grants já existentes.

do $$
declare nome text;
begin
  foreach nome in array array['categorizacao_ia_disparar', 'limpeza_disparar',
    'moderacao_ia_disparar', 'radar_ia_novidades_disparar', 'verificacao_loja_disparar',
    'verificacao_loja_reconferir_disparar', 'whatsapp_fila_disparar'] loop
    if to_regprocedure('public.' || nome || '()') is null then
      raise exception 'Preflight necessário: função interna ausente (%)', nome;
    end if;
  end loop;
end $$;

create or replace function public.categorizacao_ia_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  segredo text; endereco text;
  pedido bigint;
begin
  if public.config('vitrine_ia.categorizacao_ativa', null, 'false') is distinct from 'true'::jsonb
     or not public.categorizacao_ia_tem_trabalho() then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/categorizacao');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

create or replace function public.limpeza_disparar()
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare segredo text; endereco text; pedido bigint;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_limpeza_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/limpeza');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

create or replace function public.moderacao_ia_disparar()
returns bigint language plpgsql security definer set search_path=public,extensions as $$
declare segredo text; endereco text; pedido bigint;
begin
 if public.config('moderacao.ia_ativa',null,'false') <> 'true'::jsonb then return null; end if;
 if not exists(select 1 from public.moderacao_ia where estado='processando' and iniciado_em<now()-interval '3 minutes')
   and not exists(select 1 from public.anuncios a where a.status='em_analise'
     and a.vendido_em is null and a.congelado_motivo is null
     and (a.motivo_analise='Preço fora do normal para a categoria' or a.motivo_analise like 'Palavra bloqueada:%')
     and not exists(select 1 from public.denuncias d where d.alvo_tipo='anuncio' and d.alvo_id=a.id and d.status='aberta')
     and not exists(select 1 from public.moderacao_ia m where m.anuncio_id=a.id and m.revisao=public.moderacao_ia_revisao(a) and m.estado<>'pendente')) then
   return null;
 end if;
 select decrypted_secret into segredo from vault.decrypted_secrets where name='olaki_moderacao_ia_token';
 if segredo is null or length(segredo)<32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/moderacao');
 select net.http_post(url:=endereco,
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||segredo),
   body:='{}'::jsonb,timeout_milliseconds:=60000) into pedido;
 return pedido;
end $$;

create or replace function public.radar_ia_novidades_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  segredo text; endereco text;
  pedido bigint;
begin
  if public.config('radar_ia.ativa', null, 'false') is distinct from 'true'::jsonb
     or public.config('radar_ia.novidades_ativa', null, 'false') is distinct from 'true'::jsonb then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/radar-novidades');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

create or replace function public.verificacao_loja_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; endereco text; pedido bigint;
begin
  if not exists (select 1 from public.verificacoes_loja v where v.status = 'enviada' and v.proxima_em <= now())
     and not exists (select 1 from public.verificacoes_loja v where v.status = 'analisando' and v.iniciado_em < now() - interval '10 minutes') then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/verificacao-loja');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 120000) into pedido;
  return pedido;
end $$;

create or replace function public.verificacao_loja_reconferir_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; endereco text; pedido bigint;
begin
  if public.config('verificacao.reconferencia_ativa', null, 'false'::jsonb) <> 'true'::jsonb then
    return null;
  end if;
  if not exists (select 1 from public.vitrines_lojas l
                  where l.tipo = 'loja' and l.selo_loja_verificada and l.cnpj is not null
                    and (l.cnpj_conferido_em is null or l.cnpj_conferido_em < now() - interval '30 days')) then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/verificacao-loja-reconferir');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 300000) into pedido;
  return pedido;
end $$;

create or replace function public.whatsapp_fila_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; endereco text; pedido bigint;
begin
  if not exists (select 1 from public.whatsapp_fila f where f.estado = 'pendente' and f.enviar_apos <= now()) then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select decrypted_secret into endereco from vault.decrypted_secrets where name = 'olaki_loja_ia_endpoint';
  if endereco is null or endereco !~ '^https://[A-Za-z0-9.-]+/api/interno/loja-ia$' then return null; end if;
  endereco := regexp_replace(endereco, '/loja-ia$', '/whatsapp-fila');
  select net.http_post(url := endereco,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;
