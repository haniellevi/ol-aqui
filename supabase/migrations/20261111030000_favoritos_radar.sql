-- Vitrine com IA, etapa 3: favoritos levam ao Radar (docs/PLANO-VITRINE-IA.md).
-- Uma vez por dia, cada pessoa recebe no sino no máximo um lembrete: quando um favorito sai do ar
-- ou quando foi salvo há 7 dias e continua no ar. Cada favorito lembra uma vez só.
-- A pessoa pode desligar o aviso em Minha conta > Notificações (tipo favorito_radar).
-- Só vale onde a vitrine nova está ligada (vitrine_ia.ativa, respeitando a chave da região da pessoa).
-- No máximo um lembrete por pessoa por dia, mesmo que a rotina rode de novo no mesmo dia.

alter table public.favoritos add column radar_lembrado_em timestamptz;
create index favoritos_sem_lembrete_idx on public.favoritos (criado_em) where radar_lembrado_em is null;

create function public.favoritos_lembrar_radar()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c record;
  enviados integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o sistema envia os lembretes.' using errcode = '42501';
  end if;
  for c in
    select distinct on (f.usuario_id) f.usuario_id, f.anuncio_id, a.titulo,
           (a.status <> 'ativo' or v.status <> 'ativa') as fora
      from public.favoritos f
      join public.anuncios a on a.id = f.anuncio_id
      join public.vitrines_lojas v on v.id = a.vitrine_id
      join public.perfis pe on pe.id = f.usuario_id
     where f.radar_lembrado_em is null
       and public.config('vitrine_ia.ativa', pe.microrregiao_id, 'false') = 'true'::jsonb
       -- um por dia: quem já teve favorito lembrado hoje espera o próximo dia
       and not exists (select 1 from public.favoritos g
                        where g.usuario_id = f.usuario_id and g.radar_lembrado_em >= public.robo_inicio('dia'))
       and v.dono_id <> f.usuario_id
       and (a.status <> 'ativo' or v.status <> 'ativa' or f.criado_em <= now() - interval '7 days')
       -- quem já pediu no Radar nos últimos 7 dias não precisa do lembrete agora
       and not exists (select 1 from public.radar_pedidos p
                        where p.comprador_id = f.usuario_id and p.criado_em > now() - interval '7 days')
     order by f.usuario_id, (a.status <> 'ativo' or v.status <> 'ativa') desc, f.criado_em
     limit 2000
  loop
    update public.favoritos set radar_lembrado_em = now()
     where usuario_id = c.usuario_id and anuncio_id = c.anuncio_id and radar_lembrado_em is null;
    if not found then continue; end if;
    -- Anúncio fora do ar: o título não aparece (pode ser rascunho, pausado ou congelado).
    if public.notificar(
         c.usuario_id, 'favorito_radar',
         case when c.fora then 'Um favorito seu saiu do ar' else left('Ainda procura ' || c.titulo || '?', 120) end,
         case when c.fora then 'Peça parecido no Radar e as lojas da região mandam ofertas para você.'
              else 'Peça no Radar e receba ofertas de outras lojas da região.' end,
         '/minha-conta/favoritos', 'favorito_radar:' || c.anuncio_id::text,
         jsonb_build_object('anuncio_id', c.anuncio_id, 'motivo', case when c.fora then 'fora_do_ar' else 'parado' end)) then
      enviados := enviados + 1;
    end if;
  end loop;
  return enviados;
end $$;
revoke all on function public.favoritos_lembrar_radar() from public, anon, authenticated;
grant execute on function public.favoritos_lembrar_radar() to service_role;

-- Novo aviso que a pessoa pode ligar ou desligar.
update public.configuracoes
   set valor = valor || '["favorito_radar"]'::jsonb
 where chave = 'radar.avisos_escolha' and jsonb_typeof(valor) = 'array' and not (valor ? 'favorito_radar');

-- Todo dia às 10h no horário da região (13h UTC).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-favoritos-radar', '0 13 * * *', 'select public.favoritos_lembrar_radar()');
  end if;
end $$;
