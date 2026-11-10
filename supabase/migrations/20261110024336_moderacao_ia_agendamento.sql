-- Em Supabase, agenda o consumidor; no Postgres isolado dos testes as extensões não existem.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
   create extension if not exists pg_cron;
 end if;
 if exists(select 1 from pg_available_extensions where name='pg_net') then
   create extension if not exists pg_net with schema extensions;
 end if;
end $$;

create function public.moderacao_ia_disparar()
returns bigint language plpgsql security definer set search_path=public,extensions as $$
declare segredo text; pedido bigint;
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
 select net.http_post(url:='https://ol-aqui.vercel.app/api/interno/moderacao',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||segredo),
   body:='{}'::jsonb,timeout_milliseconds:=60000) into pedido;
 return pedido;
end $$;
revoke all on function public.moderacao_ia_disparar() from public,anon,authenticated;
grant execute on function public.moderacao_ia_disparar() to service_role;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_extension where extname='pg_net') then
   perform cron.schedule('olaki-moderacao-ia','* * * * *','select public.moderacao_ia_disparar()');
 end if;
end $$;
