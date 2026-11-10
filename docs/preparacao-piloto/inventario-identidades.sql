-- Inventário somente leitura para o projeto correto, por operador autorizado.
-- Não executado no ambiente publicado durante a preparação deste arquivo.
-- Guardar resultados em local privado; não copiar IDs de participantes para o Git.
-- Não contém dados de contato, códigos, chaves, conteúdo de conversa ou valores do Vault.
-- Falha de permissão ou tabela ausente torna o inventário incompleto; não tratar como zero.
begin transaction read only;

-- Estrutura efetiva dos vínculos diretos com a identidade e com suas entidades.
select n.nspname as esquema, t.relname as tabela, c.conname as restricao,
       pg_get_constraintdef(c.oid) as definicao
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where c.contype = 'f' and n.nspname = 'public'
  and c.confrelid in ('public.perfis'::regclass,
                     'public.vitrines_lojas'::regclass,
                     'public.radar_pedidos'::regclass,
                     'public.anuncios'::regclass)
order by t.relname, c.conname;

-- Contagens por ID interno. Reconciliar com a instância Clerk verificada.
select p.id as perfil_id,
       p.e_admin as administrador,
       (select count(*) from public.vitrines_lojas v where v.dono_id = p.id) as vitrines,
       (select count(*) from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
          where v.dono_id = p.id) as anuncios,
       (select count(*) from public.radar_pedidos r where r.comprador_id = p.id) as pedidos,
       (select count(*) from public.radar_propostas rp join public.vitrines_lojas v on v.id = rp.vitrine_id
          where v.dono_id = p.id) as propostas_enviadas,
       (select count(*) from public.radar_propostas rp join public.radar_pedidos r on r.id = rp.pedido_id
          where r.comprador_id = p.id) as propostas_recebidas,
       (select count(*) from public.pagamentos pg join public.vitrines_lojas v on v.id = pg.vitrine_id
          where v.dono_id = p.id) as pagamentos,
       (select count(*) from public.robo_conversas rc where rc.usuario_id = p.id) as conversas_aki,
       (select count(*) from public.aceites ac where ac.usuario_id = p.id) as aceites,
       (select count(*) from public.equipe e where e.usuario_id = p.id) as registros_equipe,
       (select count(*) from storage.objects o
          where o.bucket_id = 'anuncios' and split_part(o.name, '/', 1) = p.id) as objetos_storage
from public.perfis p
order by p.id;

-- Pastas do bucket com arquivos, inclusive aquelas sem perfil correspondente.
-- Contar metadados não verifica presença, integridade ou recuperação dos bytes.
select split_part(o.name, '/', 1) as pasta_titular,
       count(*) as objetos,
       exists(select 1 from public.perfis p where p.id = split_part(o.name, '/', 1)) as perfil_existe
from storage.objects o
where o.bucket_id = 'anuncios'
group by split_part(o.name, '/', 1)
order by pasta_titular;

rollback;
