# Validação isolada do agendamento

Execução em 10/11/2026 para a migração `20261110031138_rotinas_piloto.sql`, sem conexão com o projeto publicado e sem executar as funções de negócio.

## Ambiente

| Item | Valor observado |
| --- | --- |
| Imagem já disponível localmente | `public.ecr.aws/supabase/postgres:17.11.0.004` |
| Extensão real | `pg_cron` 1.6.4 |
| Binários | `/nix/var/nix/profiles/default/bin/` |
| Usuário do processo | `postgres`, UID 100, GID 101 |
| Dados | `tmpfs` exclusivo em `/pgdata` |
| Rede e portas | `--network none`, sem porta publicada, conexão por socket Unix |
| Execução de jobs | `cron.launch_active_jobs=off` durante todo o ensaio |
| Fuso observado | `cron.timezone=GMT` |

O contêiner temporário recebeu nome exclusivo. A inicialização utilizou `initdb -D /pgdata -A trust --no-locale`; o servidor foi iniciado com `shared_preload_libraries=pg_cron`, `cron.database_name=postgres`, `cron.launch_active_jobs=off`, `listen_addresses=` e `unix_socket_directories=/pgdata`. Autenticação local sem senha ficou restrita a esse contêiner sem rede; não é configuração recomendada para o projeto publicado.

## Resultados

1. `CREATE EXTENSION pg_cron` concluiu e reportou a versão 1.6.4.
2. Um job de teste foi criado, desativado e atualizado por `cron.schedule` usando o mesmo nome. Conservou o `jobid` e permaneceu `active=false`, embora a expressão e o comando fossem atualizados.
3. Um job `olaki-moderacao-ia` foi preparado com comando inofensivo `select 123`, permanecendo sem execução pelo bloqueio global.
4. A migração criou os três jobs esperados: Radar `*/10 * * * *`, planos `20 * * * *` e expiração `15 3 * * *`.
5. A migração foi executada novamente. Comparação dos IDs, nomes, horários, estado ativo e comandos mostrou resultado idêntico. O job da IA continuou intacto.
6. `supabase/testes/310_rotinas_piloto.sql` passou usando a extensão real.
7. A conferência final mostrou `cron.launch_active_jobs=off` e zero linhas em `cron.job_run_details`. O contêiner e seus volumes foram removidos ao terminar, com saída zero na limpeza.

O teste comprova criação e repetição do agendamento nesta versão da extensão. Não comprova aplicação no Supabase publicado, execução efetiva das funções, entrega de avisos nem horário da primeira execução real. Antes dos convites, conferir os três jobs ativos e seus resultados no ambiente alvo. Um job previamente pausado exige decisão operacional explícita antes de reativação; repetir a migração não remove essa pausa.


## Aplicação posterior no projeto

A migração foi aplicada em produção como `20261110031138_rotinas_piloto.sql`, com igualdade de conteúdo remoto/local confirmada por MD5 (`2abcb629076b0db7db46b7d54a840a7a`). A conferência encontrou quatro jobs ativos sob usuário/banco `postgres`, em GMT: IA ID 1 preservado, Radar ID 2, planos ID 3 e expiração ID 4.

Essa inspeção comprova aplicação e configuração dos agendamentos. A primeira execução real dos três jobs novos ainda não foi observada neste registro; conferir as janelas naturais das 03:15 e 03:20 UTC e registrar resultado separadamente.
