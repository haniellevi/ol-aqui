\set ON_ERROR_STOP on
\set QUIET on
-- Banco descartável. Verifica as políticas e os gatilhos reais, sem dados de produção.
begin;
create function pg_temp.recusa(comando text) returns void language plpgsql as $$
begin
 begin execute comando;
 exception when insufficient_privilege or check_violation or invalid_parameter_value then return;
 end;
 raise exception 'Comando aceito indevidamente: %', comando;
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade) values ('user_loja250',:'reg','Loja 250','Corrente');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em) values
('95000000-0000-4000-a000-000000000001','user_loja250',:'reg','loja-250','Loja 250','Corrente','loja','full',now()+interval '30 days');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
do $$ declare n int; begin
 update vitrines_lojas set nome='Invadida' where id='95000000-0000-4000-a000-000000000001';
 get diagnostics n=row_count; assert n=0, 'RLS impediu editar loja alheia';
 assert not pode_enviar_foto('user_loja250/loja/logo.webp'), 'Upload alheio recusado';
end $$;
set local request.jwt.claim.sub='user_loja250';
update vitrines_lojas set nome='Loja atualizada',whatsapp='5589999990250',bairro='Centro',endereco='Rua de teste, 250',instagram='loja.teste',sobre='Loja fictícia para testes',horarios='{"seg":[{"abre":"08:00","fecha":"12:00"},{"abre":"14:00","fecha":"24:00"}],"dom":[]}',logo_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja250/loja/logo.webp',banner_tipo='foto',banner_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja250/vitrine/banner.webp'
where id='95000000-0000-4000-a000-000000000001';
do $$ begin
 assert pode_enviar_foto('user_loja250/loja/nova.webp') and pode_enviar_foto('user_loja250/vitrine/nova.webp'), 'Upload próprio permitido';
 assert (select horarios->'seg'->1->>'fecha'='24:00' from vitrines_lojas where dono_id='user_loja250'), 'Meia-noite preservada';
end $$;
select pg_temp.recusa($q$update vitrines_lojas set logo_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_comprador/loja/logo.webp' where dono_id='user_loja250'$q$);
select pg_temp.recusa($q$update vitrines_lojas set banner_url='https://evil.test/foto.webp' where dono_id='user_loja250'$q$);
select pg_temp.recusa($q$update vitrines_lojas set horarios='{"seg":[{"abre":"18:00","fecha":"08:00"}]}' where dono_id='user_loja250'$q$);
select pg_temp.recusa($q$update vitrines_lojas set horarios='{"seg":[{"abre":"08:00","fecha":"12:00"},{"abre":"11:00","fecha":"16:00"}]}' where dono_id='user_loja250'$q$);
update vitrines_lojas set plano='free',status='suspensa',selo_loja_verificada=true where dono_id='user_loja250';
do $$ begin assert (select plano='full' and status='ativa' and not selo_loja_verificada from vitrines_lojas where dono_id='user_loja250'), 'Campos de sistema protegidos'; end $$;
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ declare v jsonb; begin
 v:=vitrine_publica('loja-250');
 assert v->>'nome'='Loja atualizada' and v->>'whatsapp'='5589999990250', 'Nome e contato atualizados na vitrine';
 assert v->'horarios'->'seg'->1->>'fecha'='24:00', 'Meia-noite pública';
 assert v->>'logo_url' like '%/user_loja250/loja/logo.webp' and v->>'banner_url' like '%/user_loja250/vitrine/banner.webp', 'Fotos públicas salvas';
end $$;
rollback;
