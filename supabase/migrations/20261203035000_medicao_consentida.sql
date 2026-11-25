-- Onda A: nenhuma purga ou aumento de retenção. Históricos ficam separados.
alter table public.visitas add column coorte text not null default 'legado';
alter table public.visitas add column sessao uuid;
alter table public.visitas add column ocorrencia uuid;
create unique index visitas_ocorrencia_idx on public.visitas(ocorrencia) where ocorrencia is not null;
create index visitas_coorte_data_idx on public.visitas(coorte, criado_em);

create function public.registrar_visita_consentida(
  p_visitante uuid, p_sessao uuid, p_ocorrencia uuid, p_caminho text,
  p_origem text default null, p_celular boolean default false, p_primeira boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare origem text;
begin
  if p_visitante is null or p_sessao is null or p_ocorrencia is null or p_caminho not in
    ('/', '/busca', '/lojas', '/categorias', '/anuncio/:item', '/loja/:loja', '/categoria/:categoria') or p_caminho is null then return false; end if;
  if (select count(*) from public.visitas where visitante=p_visitante::text and criado_em > now()-interval '1 minute') >= 30 then return false; end if;
  select codigo into origem from public.origens_visita where ativa and codigo=p_origem
    and codigo in ('instagram','whatsapp','google','radio','qr_loja','facebook','panfleto','indicacao','outro_site','direto');
  insert into public.visitas(visitante,caminho,origem,celular,primeira,coorte,sessao,ocorrencia)
    values(p_visitante::text,p_caminho,coalesce(origem,'direto'),p_celular,p_primeira,'consentida_v1',p_sessao,p_ocorrencia)
    on conflict (ocorrencia) where ocorrencia is not null do nothing;
  return found;
end $$;
revoke all on function public.registrar_visita_consentida(uuid,uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.registrar_visita_consentida(uuid,uuid,uuid,text,text,boolean,boolean) to service_role;
-- A entrada antiga deixa de ser pública. O gate é verificado pelo servidor antes da RPC nova.
revoke all on function public.registrar_visita(text,text,text,text,text,boolean,boolean) from anon,authenticated;
revoke all on function public.registrar_evento(uuid,text,text,text,text) from anon,authenticated;

create table public.buscas_faixas_dia (
  dia date not null default current_date,
  microrregiao_id uuid references public.microrregioes(id),
  categoria_id uuid references public.categorias(id),
  faixa text not null check(faixa in ('zero','1-10','11+')),
  vezes bigint not null default 1 check(vezes>0),
  coorte text not null default 'consentida_v1' check(coorte='consentida_v1')
);
create unique index buscas_faixas_chave on public.buscas_faixas_dia
  (dia,coalesce(microrregiao_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(categoria_id,'00000000-0000-0000-0000-000000000000'::uuid),faixa);
alter table public.buscas_faixas_dia enable row level security;
revoke all on public.buscas_faixas_dia from public,anon,authenticated;
grant select on public.buscas_faixas_dia to authenticated;
create policy "admin lê faixas" on public.buscas_faixas_dia for select to authenticated using(public.e_admin());
create function public.registrar_busca_consentida(p_microrregiao uuid,p_categoria_slug text,p_faixa text)
returns void language plpgsql security definer set search_path=public as $$
declare cat uuid;
begin
  if p_faixa is null or p_faixa not in ('zero','1-10','11+') then return; end if;
  if p_microrregiao is not null and not exists(select 1 from public.microrregioes where id=p_microrregiao) then return; end if;
  select id into cat from public.categorias where slug=p_categoria_slug;
  insert into public.buscas_faixas_dia(microrregiao_id,categoria_id,faixa) values(p_microrregiao,cat,p_faixa)
    on conflict (dia,coalesce(microrregiao_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(categoria_id,'00000000-0000-0000-0000-000000000000'::uuid),faixa)
    do update set vezes=buscas_faixas_dia.vezes+1;
end $$;
revoke all on function public.registrar_busca_consentida(uuid,text,text) from public,anon,authenticated;
grant execute on function public.registrar_busca_consentida(uuid,text,text) to service_role;

-- Congelar coleta de termos antigos mantendo assinatura e histórico para migração.
create or replace function public.registrar_busca(p_termo text,p_microrregiao uuid,p_categoria_slug text default null,p_total integer default null)
returns void language plpgsql security definer set search_path=public as $$ begin return; end $$;
create or replace function public.robo_registrar_busca_vazia(p_termo text,p_microrregiao uuid,p_categoria text default null)
returns void language plpgsql security definer set search_path=public as $$ begin return; end $$;

-- Reusar regras de dono, publicação e repetição. Remover conta do hash e texto livre.
do $$ declare definicao text; begin
  definicao := pg_get_functiondef('public.registrar_evento(uuid,text,text,text,text)'::regprocedure);
  definicao := replace(definicao, 'coalesce(uid, '''')', '''''');
  definicao := replace(definicao, 't := public.normaliza_termo(registrar_evento.termo);', 't := null;');
  execute definicao;
  definicao := pg_get_functiondef('public.registrar_evento_loja(uuid,text,text,text)'::regprocedure);
  execute replace(definicao, 'coalesce(uid, '''')', '''''');
  -- A RPC mantém o formato de relatórios, porém não revela termos históricos.
  definicao := pg_get_functiondef('public.metricas_produtos_periodo(integer,uuid)'::regprocedure);
  definicao := regexp_replace(definicao, 'coalesce\(\(select jsonb_agg\(jsonb_build_object\(''termo''[\s\S]*?limit 3\) t\), ''\[\]''::jsonb\)', '''[]''::jsonb');
  execute definicao;
  definicao := pg_get_functiondef('public.meu_marketing_loja(uuid)'::regprocedure);
  execute replace(definicao, 'to_jsonb(f)', 'jsonb_set(to_jsonb(f), ''{termo}'', to_jsonb(f.categoria_nome))');
  definicao := pg_get_functiondef('public.robo_painel(integer)'::regprocedure);
  execute replace(definicao, 'b.id, b.termo, b.categoria_slug', 'b.id, coalesce(b.categoria_slug, ''Categoria não informada'') as termo, b.categoria_slug');
end $$;
revoke select on public.anuncios_termos_dia,public.buscas_termos,public.robo_buscas_vazias,public.visitas from authenticated;

comment on column public.visitas.coorte is 'legado: população sem gate anterior; consentida_v1: páginas opcionais. Nunca somar como série homogênea.';
comment on column public.visitas.sessao is 'Aba consentida com 30 min de inatividade; distinto de navegador e pessoa.';

-- As séries diárias antigas conservam os contadores; o dia da mudança é misto.
create table public.metricas_marcos (codigo text primary key, inicio timestamptz not null default now());
insert into public.metricas_marcos(codigo) values('consentida_v1');
alter table public.metricas_marcos enable row level security;
revoke all on public.metricas_marcos from public,anon,authenticated;
grant select on public.metricas_marcos to authenticated;
create policy "admin lê marco" on public.metricas_marcos for select to authenticated using(public.e_admin());

create function public.admin_medicao_resumo(p_de date,p_ate date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  return (select jsonb_build_object('fonte','interno','coorte','consentida_v1','pageviews',count(*),
    'navegadores',count(distinct visitante),'sessoes',count(distinct sessao),'sem_dados',count(*)=0)
    from public.visitas where coorte='consentida_v1' and criado_em >= p_de::timestamptz and criado_em < (p_ate+1)::timestamptz);
end $$;
revoke all on function public.admin_medicao_resumo(date,date) from public,anon;
grant execute on function public.admin_medicao_resumo(date,date) to authenticated,service_role;

-- O relatório antigo permanece consultável, separado da coorte nova e sem caminhos/termos livres.
alter function public.admin_visitas(date,date) rename to admin_visitas_legado;
revoke all on function public.admin_visitas_legado(date,date) from public,anon,authenticated;
do $$ declare d text; begin
  d := pg_get_functiondef('public.admin_visitas_legado(date,date)'::regprocedure);
  d := replace(d,'from visitas where','from visitas where coorte = ''legado'' and');
  execute d;
end $$;
create function public.admin_visitas(p_de date,p_ate date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb; begin
  if not public.e_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  r := public.admin_visitas_legado(p_de,p_ate);
  return r || jsonb_build_object('paginas','[]'::jsonb,'por_campanha','[]'::jsonb,'coorte','legado','fonte','interno_legado');
end $$;
revoke all on function public.admin_visitas(date,date) from public,anon;
grant execute on function public.admin_visitas(date,date) to authenticated,service_role;
