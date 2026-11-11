# Liberação do piloto acompanhado

Este roteiro transforma a ordem aprovada em verificações de abertura. **A preparação está autorizada; os convites ainda dependem de concluir as condições abaixo.** Nenhum teste futuro está marcado como executado neste documento.

Base de preparação: commit `e5063ec`, no ramo `codex/preparacao-piloto`, com alterações locais desta preparação. O manifesto distingue as 27 migrações cujos nomes e versões foram confirmados no ambiente das três novas migrações aplicadas nesta preparação. Os SHA-256 do manifesto são locais; nas três novas migrações, a igualdade de conteúdo remoto/local também foi confirmada por MD5. O conteúdo remoto das 27 anteriores não foi comparado por hash. A versão final deve registrar também o commit integrado, deployment, URL e horário do ensaio. Alterações posteriores exigem rever apenas as evidências afetadas.

A inspeção de 10/11/2026 encontrou produção `READY` no deployment `dpl_CjGBBzQtkrpibEox8kfcLVmmhMXU`, commit `81c7902`, com conteúdo equivalente à base `e5063ec`. A chave pública continuava sendo de desenvolvimento; o painel Clerk mostrava somente a instância Development e cinco contas visíveis.

O acesso ao projeto Supabase `ncrbqqdgweuqpsppxwti` foi estabelecido pelo conector com o identificador de ligação correto. O projeto estava `ACTIVE_HEALTHY`, em PostgreSQL 17.11, numa organização Free. O inventário agregado encontrou cinco perfis, um administrador, duas vitrines (uma ativa e uma suspensa), dois anúncios (um pausado e um em análise), um pedido encerrado, uma proposta, nenhum pagamento e três objetos no bucket `anuncios`. Não existe bucket `verificacoes` nesse projeto; esse dado não acrescenta bloqueio ao fluxo atual. Isso substitui a limitação de acesso registrada no início da preparação; a reconciliação do ponto atual foi concluída em controle privado: os cinco IDs do banco correspondem exatamente aos cinco IDs visíveis no Clerk Development. Três perfis têm vínculos com vitrines, pedidos ou arquivos; o administrador não tem esses vínculos. O inventário foi guardado fora do Git, em arquivo privado com permissão 0600, sem contatos.

Somente `olaki-moderacao-ia` estava agendado e ativo no cron; foi observada execução SQL bem-sucedida em `2026-11-10T03:05:00Z`, sem falha registrada na consulta realizada. O fuso do cron era GMT. Os três jobs de expiração, prazos do Radar e avisos de planos estavam ausentes e foram criados nesta preparação. A conferência posterior encontrou quatro jobs ativos em `postgres`/`postgres`: IA com ID 1 preservado, Radar ID 2, planos ID 3 e expiração ID 4. A primeira execução real dos jobs novos continua pendente de observação, nas janelas naturais das 03:15 e 03:20 UTC. Suporte por WhatsApp/e-mail continuava vazio, Aki desligado e documentos ativos versão 1 com campos por preencher e `revisado=false`. A tentativa de inspeção da VPS por SSH foi recusada por autenticação; nenhum novo estado da sessão de WhatsApp foi confirmado. Backup e restauração continuam pendentes de comprovação; o plano Free não permite inferir sua disponibilidade.

O princípio de liberação é permitir uma necessidade real chegar a uma resposta útil e a um desfecho verificável, preservando identidade, contato e dados. Acompanhamento humano pode recuperar dúvidas de uso; não substitui autorização de acesso, confirmação do telefone nem integridade do banco.

## 1. Definições da rodada

| Campo | Preenchimento antes dos convites |
| --- | --- |
| Responsável operacional e substituto | Pendente |
| Domínio definitivo, operador e canal público | Pendente de informação do responsável pelo projeto |
| Cidade/área e segmentos | Pendente de oferta confirmada |
| Lojas, contato responsável e horário de resposta | Pendente; cadastrar a relação em controle privado |
| Compradores e necessidades atuais | Pendente; participação voluntária e demanda autêntica |
| Tamanho do lote e duração | A definir conforme capacidade; cinco lojas, quinze compradores e 14 a 21 dias continuam sendo uma proposta |
| Prazo combinado para resposta útil | Pendente; registrar antes de medir |
| Gratuidade/cortesia e encerramento | Definir duração, cotas e o que acontece ao final |
| Limite de gasto e horas de acompanhamento | Pendente; incluir serviços ativos e ajuda humana |
| URL, commit, deployment e data do ensaio | Preencher para a versão efetivamente testada |

## 2. Quadro de liberação

Cada linha precisa de responsável, data e evidência. Use `pendente`, `aprovado` ou `bloqueado`; explicite a falha ao marcar bloqueado. Evidência pode ser log sem segredo, ID de execução ou relato do ensaio com os IDs internos utilizados.

| Ordem | Condição | Evidência de aceite | Estado inicial desta preparação |
| --- | --- | --- | --- |
| A1 | Identidade de produção e domínio | Instância correta, integração Supabase, OAuth e webhook conferidos; nova conta entra e uma conta existente conserva os vínculos previstos; plano de retorno preserva dados | Inventário e reconciliação atuais concluídos; domínio, instância de produção, tratamento dos novos IDs e ensaio ainda pendentes |
| A2 | Operador, documentos e ajuda | Identificação real e canais aplicáveis publicados; sem campos por preencher; ajuda acessível no erro de confirmação e testada no celular | Depende dos dados públicos fornecidos pelo responsável |
| A3 | Dependências e uploads | Auditoria atual analisada, correções compatíveis verificadas, foto válida publica e entrada inválida é recusada | Correções locais: sharp 0.35.5 e PostCSS 8.5.32, auditoria de produção sem alertas; ensaio de publicação de foto ainda pendente |
| A4.1 | Banco e rotinas | Histórico comparado com manifesto final; jobs necessários presentes e com execução concluída; rotinas exercitadas em cópia isolada | 30 migrações registradas, três novas com conteúdo conferido; quatro jobs ativos. Teste com pg_cron real passou; primeira execução real dos jobs novos ainda pendente |
| A4.2 | Backup e recuperação | Backup protegido e restauração isolada de banco e arquivo concluída; procedimento, tempo e perdas possíveis registrados | Ensaio real concluído em 5,05 s. Rotina da VPS ativa a cada 6 h com 14 dias de retenção local e no Drive. Responsável de incidente pendente |
| A4.3 | Confirmação de WhatsApp | Estado `open`, entrega real autorizada, uso único, erro/expiração recuperáveis e responsável por reconectar | Há QA histórico; ensaio da versão alvo pendente |
| A4.4 | Comprador e loja | Percursos do quadro de ensaio concluídos, sem perda de vínculo, exposição de contato privado ou duplicação | Testes locais e ensaio publicado devem ser registrados separadamente |
| A4.5 | Privacidade | Exportação completa ou erro explícito; exclusão e retenção verificadas com e sem referência financeira | Migrações de proteção e revogação aplicadas; guardas e permissões conferidas. Testes locais passaram; publicação do aplicativo e ensaio real do webhook pendentes |
| A5 | Oferta e capacidade | Lojas confirmam itens, condições, área, horário e saldo suficiente para repetir propostas; equipe consegue atender o lote | Pendente de operação comercial |
| P1 | Registro dos casos | Uma ficha de ensaio preenchida, sem dados sensíveis; responsável consegue distinguir resposta, contato, negócio e retorno | Modelo preparado; uso pendente |

Somente abrir o lote quando A1 a A5 e P1 estiverem aprovados para o fluxo oferecido. Aki e cobrança podem permanecer fora da rodada; se fizerem parte da experiência oferecida, precisam de validação própria. A triagem por IA tem alternativa manual, desde que exista responsável e prazo de atendimento da fila.

## 3. Conferência do ambiente

### Identidade e configuração pública

Registrar metadados do projeto Vercel, deployment ativo e instância Clerk, sem valores secretos. Conferir o domínio controlado, chave pública de produção, integração de autenticação externa no Supabase e webhook da mesma instância. Confirmar também OAuth, URLs de retorno, `TURNSTILE_HOSTNAMES`, origem das fotos e destino da rotina de moderação.

Antes de qualquer troca de instância, inventariar contas e vínculos de perfis, vitrines, anúncios, pedidos, propostas, pagamentos e pastas do Storage. Definir o tratamento das contas existentes, validar em ambiente isolado e registrar como recuperar em caso de falha. Não associar contas somente por coincidência de e-mail ou telefone. Um perfil criado na instância nova não comprova preservação da identidade anterior.

A passagem para produção aguarda domínio e tratamento verificável das identidades existentes. A documentação consultada pelo responsável pela preparação informa que usuários de desenvolvimento não são transferidos automaticamente entre instâncias. O inventário de vínculos foi executado por consultas somente leitura e a reconciliação atual banco/Clerk Development foi concluída: cinco IDs correspondentes, sem publicar identidades no repositório. As [consultas de inventário](inventario-identidades.sql) permanecem como referência reutilizável. O plano de transposição para novos IDs continua aguardando domínio e instância de produção; a correspondência atual não autoriza associação automática por e-mail ou telefone.

Preencher os textos públicos pelos controles existentes. Conferir `/termos`, `/privacidade` e `/ajuda` fora da sessão administrativa; quando houver mudança de documento, verificar sua versão e o aceite correspondente. Testar abertura do contato humano sem exigir que a pessoa já tenha conseguido confirmar o telefone. Um envio de teste ao contato requer destinatário e autorização próprios, não é autorizado por este roteiro.

### Migrações e jobs

O [manifesto](migracoes.csv) contém a sequência completa preparada, com SHA-256 local e situação de aplicação observada. Os 27 nomes e versões da base correspondem ao histórico consultado; as três migrações novas também estão registradas e tiveram seu conteúdo comparado com os arquivos locais. A presença de um nome no histórico não prova que seu conteúdo corresponde ao arquivo local: preservar o artefato aplicado e investigar divergência antes de alterar o banco.

| Nova migração | Finalidade | Situação |
| --- | --- | --- |
| `20261110031133_preservar_conteudo_congelado.sql` | Impedir remoção direta ou por cascata de conteúdo sob retenção, incluindo anúncio congelado na lixeira e referências em propostas | Aplicada; conteúdo remoto/local conferido por MD5 |
| `20261110031135_revogacao_conta_excluida.sql` | Registrar a revogação da identidade para que tokens já emitidos não recuperem acesso após a exclusão | Aplicada; conteúdo remoto/local conferido por MD5 |
| `20261110031138_rotinas_piloto.sql` | Agendar expiração diária, prazos do Radar a cada dez minutos e avisos de planos a cada hora | Aplicada; conteúdo conferido por MD5; três jobs novos ativos |

As três migrações foram aplicadas e conferidas antes da publicação do aplicativo que depende delas. Foram confirmados três triggers de proteção ativos, a tabela de revogação vazia, ausência de privilégios SELECT/INSERT de `anon` e `authenticated` nessa tabela, e `usuario_id()` como SECURITY DEFINER. Depois do deploy, verificar o webhook, uma conta revogada e uma conta ativa de ensaio, além das execuções dos jobs. O retorno de versão deve preservar os registros de revogação e as proteções de conteúdo; não voltar a código que ignore esses controles sem avaliar sua compatibilidade. Jobs novos alteram vencimentos e avisos internos, portanto conferir o inventário afetado antes de ativá-los no ambiente real.

Consultas abaixo são somente leitura para um operador com acesso ao projeto correto. Não copiar valores do Vault nem comandos de jobs que possam conter segredos para o relatório:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;

select extname
from pg_extension
where extname in ('pg_cron', 'pg_net', 'supabase_vault');
```

Se `pg_cron` estiver instalado, conferir os nomes esperados e o histórico, incluindo o fuso usado pelo agendador. Não executar a segunda consulta antes de confirmar a extensão:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in ('olaki-expirar', 'olaki-radar-prazos',
                  'olaki-mensagens-planos', 'olaki-moderacao-ia');

select jobid, status, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname in ('olaki-expirar', 'olaki-radar-prazos',
                    'olaki-mensagens-planos', 'olaki-moderacao-ia')
)
order by start_time desc
limit 30;
```

Na base publicada, `expirar_rotina()` não tinha criação automática de job. Radar e planos tinham criação condicionada à presença de `pg_cron` no momento da migração. A inspeção inicial confirmou somente o job da IA. A migração `20261110031138`, agora aplicada, corrigiu os três agendamentos sem modificar esse job. Seu ensaio com pg_cron 1.6.4 real preservou IDs ao repetir a migração e manteve o job preexistente da IA intocado; nenhum trabalho foi executado no contêiner, pois `cron.launch_active_jobs=off`. A [evidência do ensaio](validacao-cron.md) registra o procedimento.

O cron usa GMT no projeto inspecionado: expiração `15 3 * * *`, Radar `*/10 * * * *` e planos `20 * * * *`. Reaplicar `cron.schedule` preserva uma pausa já existente (`active=false`); o teste de prontidão exige os três jobs ativos, por isso conferir a intenção operacional antes de reativar qualquer job pausado.

Em banco isolado, preparar prazos vencidos e demonstrar a transição de pedido, anúncio e plano, os avisos esperados e a ausência de duplicação após repetir a execução. Em produção, observar a execução agendada e o efeito esperado em registros autorizados. Resultado local sem cron não comprova o agendamento publicado.

Na IA, execução SQL bem-sucedida pode significar apenas que não havia fila ou que a rotina retornou sem disparar. Se ativa, conciliar fila, chamada HTTP, resultado e custo. Conferir igualdade do token Vault/Vercel sem expô-lo; a migração usa o destino fixo `ol-aqui.vercel.app`. Se desligada, ensaiar aprovação/retenção manual e registrar quem assume a fila.

O advisor consultado apresentou quatro tabelas com RLS sem policies, compatíveis com tabelas de uso exclusivo do servidor, e avisos sobre 19 funções `SECURITY DEFINER` acessíveis a `anon` e 98 a `authenticated`. As contagens não equivalem a 117 vulnerabilidades confirmadas: cada função exige análise de concessões e validações internas, parte das quais já é exercitada nas suítes. O relatório de desempenho também apontou 34 FKs sem índice, 36 índices sem uso e 174 ocorrências de policies permissivas. Esses sinais ficam registrados para triagem específica; não justificam reescrever policies ou criar índices indiscriminadamente nesta preparação.

### Backup e restauração

Registrar o backup disponível, seu horário, cobertura, retenção e acesso restrito. Definir quanto tempo de dados pode ser perdido e o prazo de recuperação aceitável. Não presumir que há backup automático disponível apenas pela existência do projeto.

O banco armazena metadados dos arquivos; o backup do banco não contém os objetos do Storage. A cópia dos arquivos e sua restauração precisam ser comprovadas separadamente, conforme a [documentação oficial do Supabase](https://supabase.com/docs/guides/platform/backups), consultada via Context7 nesta preparação.

Ensaiar em destino isolado, sem sobrescrever produção e com acesso restrito aos dados. Bloquear saídas externas e desativar jobs, webhooks e integrações de envio no destino antes de permitir processamento. Reconfigurar explicitamente as dependências necessárias; uma restauração de dados não comprova restauração de autenticação, chaves, extensões ou configuração do Storage.

O aceite é restaurar a estrutura e registros selecionados, conferir contagens e vínculos, autenticar uma conta de ensaio na configuração apropriada, abrir um arquivo restaurado e executar um percurso sem alterar o original. Registrar tempo total, faltas encontradas e localização privada das instruções/credenciais. O documento público guarda apenas os resultados, nunca o backup ou seus segredos.

#### Ensaio isolado de 10/11/2026

As 43 migrações do commit `3ad74f86104640faf8b75eee934df733c93392da`, identificado na implantação ativa da Vercel na hora da conferência, foram aplicadas na origem local. O ensaio usou PostgreSQL 17 e Supabase Storage API 1.80.2 com armazenamento em disco. Origem e destino tinham rede desativada, sem portas publicadas, e dados descartáveis em memória. Foram usados somente registros, credenciais e foto fictícios. As consultas do aplicativo foram exercitadas com os papéis de visitante e comprador, com sessão simulada.

1. Copiar o banco com `pg_dump` em formato customizado, incluindo os metadados do Storage. Exportar os papéis sem senhas. Copiar os arquivos e os atributos estendidos `user.supabase.*` em separado, com a origem sem gravações. Gerar SHA-256 dos quatro itens e cifrar o pacote. No ensaio, o pacote usou `age` e levou 0,48 s para ser gerado.
2. Decifrar o pacote e conferir os quatro hashes. Recriar os papéis no destino vazio e restaurar o banco com `pg_restore --exit-on-error --single-transaction`. A estrutura, as contagens e as consultas selecionadas coincidiram. O anúncio ativo de Corrente voltou vinculado à loja aprovada, a proposta do Radar preservou o preço de R$ 1.500,50 e o visitante ficou sem acesso aos desafios de WhatsApp.
3. Consultar a foto pelo caminho retornado por `anuncio_publico`. Com apenas o banco restaurado, o Storage local devolveu HTTP 500 e registrou arquivo ausente. A primeira cópia dos arquivos recuperou os bytes, mas serviu a foto como `application/octet-stream`. Com os atributos estendidos incluídos na cópia e reaplicados, o mesmo caminho devolveu HTTP 200 com `image/png`, 21.908 bytes, SHA-256, ETag e cache iguais aos da origem.

A restauração final com as verificações levou 3,11 s no cenário reduzido. Para fechar A4.2, falta confirmar a origem, cobertura e retenção dos backups reais, restaurar uma cópia autorizada em destino isolado e medir o tempo de recuperação e a janela possível de perda. A recuperação de documentos privados e das integrações externas ficou fora deste ensaio. Os convites seguem suspensos.

#### Restauração das fotos reais de 10/11/2026

O bucket `anuncios` do projeto OLAKI continha seis imagens WebP, totalizando 102.282 bytes. A cópia foi extraída de produção entre 10h45min30s e 10h45min32s, horário de Brasília, e cifrada com `age`. Os objetos foram lidos sem alterações na origem e conferidos por tamanho, tipo e ETag. O backup também incluiu um manifesto com SHA-256 e cinco caminhos de imagens referenciadas por anúncios fora da vitrine. Não havia anúncio ativo ou vendido com foto no momento.

Em um bucket vazio do Supabase Storage local, sem rede externa nem portas publicadas, o tempo da abertura do pacote cifrado até a última conferência foi de **2,96 s**. Os seis arquivos retornaram HTTP 200 com `image/webp`, foram decodificados como imagens e tinham o mesmo SHA-256 da origem. Os cinco caminhos do inventário de anúncios resolveram para os arquivos restaurados. Esse cruzamento usou o inventário de produção, pois o banco real ainda não foi restaurado.

As seis imagens continuavam iguais na comparação dos inventários de 10h43min58s e 10h47min27s, sem perda observada nessa janela de 3 min e 28 s. Isso mede apenas a diferença observada no bucket entre as duas conferências. A janela de perda em um incidente depende do último backup completo de banco e arquivos que seja recuperável. O projeto estava no plano Free, e a conexão SQL direta ou um arquivo de backup do banco não estavam disponíveis para este ensaio.

Na conferência autenticada do painel às 10h50, o projeto OLAKI exibiu `No backups` e informou que o plano Free não inclui backups programados. A tela de conexão por Session Pooler apresentou a string com a senha por preencher. Não havia credencial PostgreSQL local identificada para o projeto. A consulta de inventário da produção confirmou oito anúncios, cinco referências de foto e seis objetos, sem anúncio ativo ou vendido com foto. Sem um dump datado, continuam indeterminados o tempo de recuperação do banco e a janela possível de perda de dados. A etapa A4.2 segue pendente.

#### Restauração conjunta do banco e das fotos reais de 10/11/2026

O banco de produção foi copiado às **11h03min25s**, horário de Brasília, em uma transação somente de leitura com snapshot compartilhado. A cópia cifrada inclui os esquemas `public`, `auth`, `storage`, `extensions` e `supabase_migrations`. O destino usou PostgreSQL 17.11 e Supabase Storage 1.88 em contêineres descartáveis, com dados em memória, sem portas publicadas ou acesso externo. Os papéis e extensões foram preparados localmente. Segredos gerenciados, agendamentos de produção e serviços externos não foram restaurados.

As seis imagens foram copiadas entre 11h07min31s e 11h07min34s. O tamanho e o ETag de cada arquivo coincidiam com os metadados do snapshot do banco. Todos os arquivos foram decodificados como WebP e cifrados em pacote separado. Depois da restauração, as seis imagens e as cinco referências registradas nos anúncios voltaram a responder no Storage isolado, com HTTP 200, `image/webp` e SHA-256 idêntico. Uma referência também foi obtida pela consulta pública do anúncio no banco restaurado e validada contra o Storage local. As contagens de origem e destino coincidiram, incluindo oito anúncios, cinco perfis, um pedido e uma proposta do Radar.

O ensaio completo levou **5,05 s**, da verificação da cópia à última checagem de conteúdo, incluindo a criação do ambiente local a partir de imagens Docker já disponíveis. A etapa de decifrar e restaurar o PostgreSQL levou **0,48 s**. A captura da produção e o download de imagens Docker ficaram fora do cronômetro.

Em uma comparação às 11h07, 48 das 52 tabelas selecionadas tinham o mesmo conteúdo, incluindo anúncios, arquivos e perfis. A conferência por registro das quatro tabelas divergentes, às **11h08min26s**, encontrou uma nova mensagem de atendimento, uma nova notificação, uma alteração em um atendimento e uma migração posterior. Essas mudanças ficariam fora da cópia se o incidente fosse nesse momento, cerca de **5 minutos** depois do snapshot. Nenhum anúncio ou foto ficou faltando na comparação. Esse intervalo foi observado no ensaio. O limite de perda em incidentes futuros depende da frequência com que banco e arquivos são copiados e validados. A rotina e a retenção ainda precisam ser definidas. Os convites seguem suspensos.

#### Rotina de backup preparada em 10/11/2026

O timer do usuário foi instalado para rodar às **00h, 06h, 12h e 18h**, no horário de Brasília. A retenção é de **14 dias**. A limpeza só ocorre depois que um novo pacote completo foi publicado. O timer recupera uma execução perdida quando volta a ficar disponível. O computador precisa estar ligado e o chaveiro do usuário, acessível. A janela nominal de perda é de até seis horas entre execuções bem-sucedidas e pode crescer se a máquina ou a conexão estiverem indisponíveis.

Cada execução abre um snapshot PostgreSQL somente para leitura, exporta o banco e copia os objetos do bucket `anuncios` com o ETag registrado nesse snapshot. O banco e o pacote das fotos são cifrados com `age` antes de ir para a pasta permanente. O pacote de fotos inclui os caminhos, tipos de arquivo e hashes usados na restauração. Os demais buckets, caso sejam criados, aparecem como fora do escopo no resumo da execução. Os arquivos ficam em `~/.local/share/olaki-backup/archives` neste computador. A chave de restauração fica em `~/.config/olaki-backup/restore.key`, em arquivo restrito. O backup do ensaio já está na pasta permanente com hashes conferidos.

Para ativar, rodar `bash ~/.local/libexec/olaki-backup/ativar.sh` e digitar a senha no terminal. A senha é guardada no chaveiro do Linux. O timer é habilitado após a primeira cópia bem-sucedida. Conferir o próximo horário com `systemctl --user list-timers olaki-backup.timer`, a última execução com `journalctl --user -u olaki-backup.service -n 12 --no-pager` e a integridade do pacote com `sha256sum -c SHA256SUMS` dentro da pasta do backup. A rotina local não cobre a perda física deste computador.

#### Transferência da rotina para a VPS

A pasta dedicada `OLAKI Backups` foi criada no Google Drive escolhido pelo responsável. Os pacotes reais das **11h03** e **11h18**, horário de Brasília, foram enviados com o banco e as fotos cifrados. Cada arquivo foi baixado novamente e comparado por SHA-256 antes da publicação do índice de integridade. A chave de restauração ficou fora do Drive.

O serviço e o timer da VPS estão preparados em `infra/backup` para executar às **00h, 06h, 12h e 18h**, com retenção de **14 dias** no servidor e no destino externo. A rotina externa verifica os hashes antes de considerar uma nova cópia publicada. A limpeza só alcança pastas de backup datadas com os nomes de arquivo esperados, e a política de retenção foi exercitada em destino de teste.

A implantação segue pendente. O hPanel confirmou a VPS `srv2031318.hstgr.cloud`, mas a autenticação com a chave SSH disponível foi recusada e o console web abriu sem prompt utilizável. A instalação exige uma sessão administrativa na VPS, a credencial PostgreSQL entregue ao serviço e uma autorização do Drive dedicada aos backups. O timer local continua ativo até a execução e a entrega externa serem verificadas a partir da VPS. Os convites seguem suspensos.

Na tentativa seguinte, o console administrativo confirmou que a VPS está configurada com `PermitRootLogin no`. A entrada SSH temporária foi removida. Pelo console, foram instalados o cliente PostgreSQL 17.11 e o rclone, sem reiniciar serviços ou contêineres existentes. O serviço e o timer da VPS ainda não foram ativados. A entrada oculta do PostgreSQL foi aberta no console, e a autorização limitada do Drive precisa ser concluída na conta que contém a pasta `OLAKI Backups`. As autorizações de outra conta não foram copiadas para a VPS.

Em 10/11/2026, a rotina da VPS foi instalada e habilitada para gerar cópias locais cifradas com retenção de 14 dias. A primeira cópia, das **12h58min57s** de Brasília, contém oito fotos e passou na conferência de SHA-256. O serviço definitivo também terminou com código zero e gerou uma segunda cópia às **13h06min14s**. O systemd mostrou o timer ativo e habilitado, com próximo disparo às **18h** de Brasília.

O envio recorrente ao Drive segue desligado. A credencial limitada recebida pertencia a uma conta diferente da que contém a pasta dedicada. A tentativa de envio avulso a partir da VPS recebeu `rateLimitExceeded` na API do Google Drive. As cópias ficaram na VPS em `/var/lib/olaki-backup/archives`, e o timer do computador também segue ativo. Os convites continuam suspensos.

Ainda em 10/11/2026, a conta proprietária da pasta OLAKI Backups foi confirmada pelo identificador do Google, e a credencial `drive.file` foi instalada na VPS. O primeiro pacote da VPS, das **12h58min57s** de Brasília, foi publicado no Drive com o banco, oito fotos e o índice SHA-256. A VPS baixou e conferiu os dois arquivos cifrados. A verificação passou após mover o arquivo temporário de conferência para o diretório autorizado pelo serviço.

O serviço definitivo ficou configurado para enviar ao Drive e concluiu uma execução completa às **15h34min44s**, incluindo a conferência SHA-256 do segundo pacote. O timer estava ativo para as **00h, 06h, 12h e 18h** de Brasília, com **14 dias de retenção** na VPS e no Drive. O próximo disparo era às **18h**. A cota do cliente compartilhado do rclone atrasou o primeiro envio. A documentação do rclone informa que esse cliente está sendo descontinuado e orienta usar um identificador próprio. Os convites seguem suspensos. [Documentação do rclone](https://rclone.org/drive/#making-your-own-client_id)

## 4. Ensaio comprador e loja

Usar contas próprias autorizadas, identificadas como teste, sem misturar os resultados com negócios reais. Para falhas de banco/provedor, preferir ambiente isolado. Registrar aparelho, navegador, versão, IDs internos e resultado; limpar ou reter os registros de teste conforme o procedimento acordado.

| Caso | Entrada e ação | Aceite observável |
| --- | --- | --- |
| Entrada e retomada | Comprador e lojista entram, completam cadastro e voltam após sair; conta existente retorna depois do corte de identidade | Perfil e vínculos corretos, sem conta duplicada ou privilégio administrativo indevido |
| Código válido | Número de teste autorizado recebe OTP e confirma | Confirmação reconhecida uma vez e fluxo comercial liberado para a conta correta |
| Erro e expiração | Código errado, vencido e repetido; novo pedido após intervalo | Erro compreensível, código anterior inutilizável, cota respeitada, possibilidade de recuperação |
| Indisponibilidade | Simular falha explícita e timeout em ambiente isolado | Sem confirmação falsa, sem repetição automática que gere outro envio; ajuda humana acessível |
| Troca de número | Titular inicia troca e falha antes de concluir; depois confirma o novo número | Contato confirmado anterior preservado até a troca válida |
| Oferta realista | Loja cria rascunho, retoma, envia foto, publica, edita, pausa e marca vendido | Estados consistentes e visibilidade pública correspondente; upload inválido recusado |
| Retenção por moderação | Anúncio de teste aciona filtro; equipe analisa e registra decisão | Teste não publicado pela IA; revisão/versão preservadas; fila manual utilizável |
| Proteção da IA | Rodar testes de cota, denúncia, contato revogado, versão alterada e reserva concorrente | Aprovação não contorna regras; repetir conclusão não duplica custo nem aviso |
| Descoberta | Comprador busca por cidade/categoria e abre anúncio/loja | Oferta e localização corretas, contato coerente com as permissões |
| Radar privado | Comprador cria pedido privado; loja propõe com preço/foto; comprador compara e escolhe | Contato não liberado antecipadamente; proposta e preço corretos, escolha consistente |
| Radar direto | Repetir com modo de contato direto | Divulgação corresponde à escolha consciente do comprador; não enviar mensagem comercial no ensaio sem autorização |
| Resposta e avisos | Loja responde, comprador visita notificações e volta ao pedido | Aviso chega à conta certa; aplicação não promete alerta externo que não foi enviado |
| Encerramento e prazo | Encerrar pedido; conferir pedido vencido com e sem proposta | Propostas/contatos respeitam regras; caso sem resposta registrado como tal |
| Cotas e repetição | Conferir saldo da loja, enviar nova proposta e tentar ação além da cota em ambiente isolado | Saldo coerente, limite explicado, nenhuma duplicação por duplo clique ou retomada |
| Privacidade | Exportar conta com histórico e conta vazia; simular falha de uma leitura | Dados completos ou erro explícito; erro nunca apresentado como lista vazia |
| Exclusão | Contas de teste sem financeiro e com referência financeira; repetir webhook e simular falha operacional | Resultado documentado, retenção delimitada, conteúdo pessoal tratado e falha recuperável |
| Celular e acessibilidade | Percurso nos aparelhos do grupo; teclado, foco, erros, ida/volta do WhatsApp | Ação principal utilizável, sem travamento ou perda que exija reconstruir o pedido silenciosamente |
| Suporte | Titular autorizado abre ajuda no ponto de falha e usa o canal combinado | Atendimento identificado, registro da intervenção e solução ou próximo passo concreto |

Na verificação integrada desta preparação, 209 testes Node, a suíte SQL com concorrência e o build passaram. O build terminou com saída zero e dez avisos preexistentes.

O `npm test` cobre regras e interfaces de servidor com dependências controladas; `npm run test:db` cobre RLS, transações e concorrência no Postgres descartável. Executar também typecheck, lint, build com configuração válida e auditoria de dependências. Guardar os resultados da versão final. Os QA históricos ajudam a localizar cenários, mas não substituem a verificação após uma mudança que afeta o percurso.

## 5. Oferta, acompanhamento e decisão

Antes de convidar compradores, cada loja deve confirmar seu responsável, horário, área atendida e alguns itens/serviços realmente disponíveis. Ensaiar acesso e uma resposta, conferir plano/cota restante e registrar qualquer cortesia com duração e motivo no painel. Não exigir catálogo completo se a loja consegue responder por proposta; não publicar ofertas fictícias para preencher a home.

Manter uma linha por necessidade no [modelo de casos](casos.csv), em cópia privada com acesso restrito. O cabeçalho vazio é intencional: não contém resultados fabricados. Registrar IDs internos, horários, origem, resposta útil, ajuda, resultado e nova ação posterior; não incluir telefone, documento, código, segredo ou conversa integral. Resposta útil esclarece disponibilidade, área e preço/condições suficientes para avançar.

No início do período de acompanhamento, revisar pedidos sem resposta, cadastro travado e fila de moderação. Identificar qualquer lembrete humano, seu momento e os minutos gastos. Clicar no WhatsApp conta como clique; negócio exige relato, com confirmação de uma ou ambas as partes explicitada. Silêncio permanece resultado desconhecido.

Em cada revisão, apresentar numeradores e denominadores: necessidades válidas já fora da janela com resposta útil; casos com contato relatado; negócios confirmados; pessoas com nova ação em outro dia; casos assistidos e minutos de apoio. Separar retorno espontâneo, após aviso e após contato humano. Quem ainda não teve janela suficiente não entra como falha de resposta ou ausência de retorno.

Interromper novos convites diante de acesso indevido, exposição de dados, corrupção, confirmação de telefone falhando sem recuperação ou incapacidade persistente de atendimento. Preservar evidências e atender os participantes existentes. Reabrir após corrigir/conter a causa e repetir os casos afetados.

Ao final da janela, ampliar apenas se houver respostas úteis repetidas por lojas diferentes, negócios confirmados e capacidade operacional demonstrada. Se os resultados dependerem de lembretes constantes ou faltar tempo para observar nova necessidade, manter o grupo e ajustar um gargalo. Gratuidade e acompanhamento próximo não demonstram disposição a pagar nem operação autônoma.

## Registro de liberação a preencher

| Registro | Valor |
| --- | --- |
| Versão e ambiente conferidos | Pendente |
| Evidências locais da versão preparada | 209 testes Node, SQL com concorrência e build aprovados; dez avisos preexistentes |
| Evidências do ensaio publicado | Pendente |
| Backup/restauração e responsável de incidente | Banco e fotos reais restaurados em isolamento em 5,05 s. Backup da VPS a cada 6 h e 14 dias de retenção verificados. Responsável de incidente pendente |
| Condições A1 a A5 e P1 aprovadas por | Pendente |
| Pendências aceitas fora do fluxo oferecido | Pendente; registrar justificativa e contenção |
| Data e tamanho do lote liberado | Pendente |

Nesta preparação foram aplicadas e verificadas três migrações no Supabase, incluindo os agendamentos. Nenhum convite foi enviado e nenhuma conta real foi excluída. Ensaios publicados, primeira execução dos novos jobs e demais condições pendentes precisam de evidência própria.
