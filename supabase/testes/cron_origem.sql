\set ON_ERROR_STOP on
begin;
do $$
declare f record; resposta bigint; captura cron_capturas; invalido text; papel text;
begin
 for f in select * from cron_esperados loop
   execute format('select public.%I()', f.nome) into resposta;
   assert resposta is not null, 'Trabalho elegível deve disparar: '||f.nome;
   select * into strict captura from cron_capturas where id=resposta;
   assert captura.url='https://cron.example.test/api/interno/'||f.caminho,
     'Origem configurada ignorada: '||f.nome;
   assert captura.body='{}'::jsonb and captura.timeout_ms=f.timeout_ms;
   assert captura.headers=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
     (select decrypted_secret from vault.decrypted_secrets where name=f.token));
   foreach papel in array array['anon','authenticated'] loop
     assert not has_function_privilege(papel,'public.'||f.nome||'()','execute');
     execute format('set local role %I',papel);
     begin
       execute format('select public.%I()',f.nome);
       raise exception 'Chamada indevida autorizada';
     exception when insufficient_privilege then null;
     end;
     reset role;
   end loop;
   assert has_function_privilege('service_role','public.'||f.nome||'()','execute')=f.servico;
   if f.servico then
     set local role service_role;
     execute format('select public.%I()',f.nome) into resposta;
     reset role;
     assert resposta is not null;
   end if;
 end loop;
 -- Ausência, vazio, HTTP, credencial embutida, porta, rota errada, query e fragmento.
 foreach invalido in array array[null,'','http://cron.example.test/api/interno/loja-ia',
   'https://usuario@cron.example.test/api/interno/loja-ia','https://cron.example.test:443/api/interno/loja-ia',
   'https://cron.example.test/api/interno/limpeza','https://cron.example.test/api/interno/loja-ia?x=1',
   'https://cron.example.test/api/interno/loja-ia#x',' https://cron.example.test/api/interno/loja-ia',
   'https://cron.example.test/api/interno/loja-ia/'] loop
   update vault.decrypted_secrets set decrypted_secret=invalido where name='olaki_loja_ia_endpoint';
   truncate cron_capturas;
   for f in select * from cron_esperados loop
     execute format('select public.%I()',f.nome) into resposta;
     assert resposta is null, 'Configuração inválida precisa retornar null: '||f.nome;
   end loop;
   assert not exists(select 1 from cron_capturas);
 end loop;
 delete from vault.decrypted_secrets where name='olaki_loja_ia_endpoint';
 for f in select * from cron_esperados loop
   execute format('select public.%I()',f.nome) into resposta;
   assert resposta is null;
 end loop;
 insert into vault.decrypted_secrets values('olaki_loja_ia_endpoint','https://outro.example.test/api/interno/loja-ia');
 for f in select * from cron_esperados loop
   execute format('select public.%I()',f.nome) into resposta;
   assert (select url='https://outro.example.test/api/interno/'||f.caminho from cron_capturas where id=resposta);
 end loop;
 foreach invalido in array array[null,'',repeat('x',31)] loop
   update vault.decrypted_secrets set decrypted_secret=invalido where name in ('olaki_moderacao_ia_token','olaki_limpeza_token');
   truncate cron_capturas;
   for f in select * from cron_esperados loop
     execute format('select public.%I()',f.nome) into resposta;
     assert resposta is null;
   end loop;
   assert not exists(select 1 from cron_capturas);
 end loop;
 delete from vault.decrypted_secrets where name in ('olaki_moderacao_ia_token','olaki_limpeza_token');
 for f in select * from cron_esperados loop
   execute format('select public.%I()',f.nome) into resposta;
   assert resposta is null;
 end loop;
 insert into vault.decrypted_secrets values('olaki_moderacao_ia_token',repeat('m',32)),('olaki_limpeza_token',repeat('l',32));
 perform set_config('cron.teste_falha','sim',true);
 for f in select * from cron_esperados loop
   begin
     execute format('select public.%I()',f.nome);
     raise exception 'Falha de transporte foi engolida';
   exception when raise_exception then
     if sqlerrm <> 'Falha sintética de transporte' then raise; end if;
   end;
 end loop;
 perform set_config('cron.teste_falha','nao',true);
 -- Chaves de ativação continuam impedindo o disparo mesmo com trabalho e Vault válidos.
 for f in select * from (values
   ('categorizacao_ia_disparar','vitrine_ia.categorizacao_ativa'),
   ('moderacao_ia_disparar','moderacao.ia_ativa'),
   ('radar_ia_novidades_disparar','radar_ia.ativa'),
   ('radar_ia_novidades_disparar','radar_ia.novidades_ativa'),
   ('verificacao_loja_reconferir_disparar','verificacao.reconferencia_ativa')
 ) t(nome,chave) loop
   update configuracoes set valor='false' where chave=f.chave and microrregiao_id is null;
   truncate cron_capturas;
   execute format('select public.%I()',f.nome) into resposta;
   assert resposta is null and not exists(select 1 from cron_capturas);
   update configuracoes set valor='true' where chave=f.chave and microrregiao_id is null;
 end loop;
 -- Filas sem trabalho elegível continuam sem chamada.
 set local session_replication_role=replica;
 update categorizacao_ia set estado='concluido';
 update anuncios set status='pausado';
 update moderacao_ia set estado='manual';
 update verificacoes_loja set proxima_em=now()+interval '1 day',iniciado_em=now();
 update vitrines_lojas set cnpj_conferido_em=now();
 update whatsapp_fila set enviar_apos=now()+interval '1 day';
 set local session_replication_role=origin;
 truncate cron_capturas;
 for f in select * from cron_esperados where nome not in ('limpeza_disparar','radar_ia_novidades_disparar') loop
   execute format('select public.%I()',f.nome) into resposta;
   assert resposta is null, 'Fila sem trabalho deve permanecer ociosa: '||f.nome;
 end loop;
 assert not exists(select 1 from cron_capturas);
 assert not exists(select * from cron.job except select * from cron_agenda_antes);
 assert not exists(select * from cron_agenda_antes except select * from cron.job);
 assert not exists(select * from pg_policies except select * from cron_politicas_antes);
 assert not exists(select * from cron_politicas_antes except select * from pg_policies);
 assert not exists(select 1 from cron_funcoes_antes b join pg_proc p on p.oid=b.oid
   where row(p.proacl,p.proowner,p.prosecdef,p.proconfig) is distinct from row(b.proacl,b.proowner,b.prosecdef,b.proconfig));
 assert not exists(select 1 from net.http_request_queue), 'Nenhum envio HTTP real';
end $$;
rollback;
