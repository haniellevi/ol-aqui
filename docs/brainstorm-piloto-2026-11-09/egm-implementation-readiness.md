# Líder de migração segura Brainstormer

Modo: BRAINSTORM. Lente: `egm-implementation-readiness`. Status: prontidão condicionada, com cinco achados Major. Recomendações não aprovadas e nenhuma implantação autorizada por este parecer.

Princípio: o piloto precisa preservar a identidade, a propriedade e a recuperabilidade dos dados quando o aplicativo, o banco ou uma integração mudarem. O padrão de prontidão foi usado como apoio para definir decisões e aceites mínimos, sem exigir um plano de implementação completo nesta ideação.

## Base e limites

A análise foi fixada no commit `2f00c55df54cad2a4a687e4641a821566c800630`. A hipótese citava um HEAD anterior; as conclusões abaixo usam o commit fixado e as migrações cumulativas pertinentes, incluindo a confirmação obrigatória de WhatsApp e a correção de moderação de aluguel.

No início da leitura, o diretório também tinha alterações em `.env.example`, `src/app/(conta)/anunciar/pronto/page.tsx` e `src/app/admin/moderacao/page.tsx`, além de arquivos não versionados de moderação por IA, suas duas migrações `20261110030000` e `20261110030100`, `supabase/.temp/` e documentos em elaboração. Essas alterações ficaram fora da base avaliada. Arquivos de produto foram lidos pelo conteúdo do commit fixado. Não foram lidos os pareceres das outras lentes nem o `concepts_brief.md` concorrente.

Não executei build, testes, banco, serviços externos ou inspeção de produção. Não consultei memória ou conversas. A única escrita desta lente é este parecer. As localizações de código abaixo são linhas do commit fixado.

## O que a evidência permite afirmar

**Código comprovado por leitura:** a sessão Clerk fornece o `sub` usado como identidade no banco; o cliente comum usa esse token e o cliente administrativo usa segredo apenas no servidor. Existem RLS e permissões por papel, isolamento regional no Radar, reservas de cobrança, idempotência de pedido e confirmação por código com cotas atômicas. A função de escolha de proposta preserva as verificações de proprietário e de oferta disponível. Essas proteções existentes devem ser preservadas, não reimplementadas.

**QA histórico:** `docs/QA-WHATSAPP-2026-11-09.md:19-29` registra migrações aplicadas, um recebimento real de código, reinício sem novo pareamento e corte no SHA `7f1ce107...`. `docs/QA-RADAR-2026-11-09.md:17-27` registra testes isolados e esclarece os limites dos fixtures. `docs/QA-MEU-PLANO-2026-11-09.md:16-28` registra testes de cobrança e informa que o webhook financeiro real não foi exercitado. São evidências anteriores, não um reteste do HEAD ou do ambiente atual.

**Hipótese:** participantes convidados podem ser acompanhados individualmente, e a verificação manual do canal comercial pode caber no onboarding. Não há quantidade, responsável ou disponibilidade aprovados.

**Produção não verificada:** commit servido, sequência efetivamente aplicada, privilégios atuais, estado da sessão Evolution, configurações Clerk, capacidade de restauração e versão dos textos publicados. A ausência desta verificação não demonstra que a produção esteja quebrada.

## 1. Major: uma troca de instância de identidade pode separar participantes de seus dados

**Dimensão:** migração e compatibilidade de dados.

**Evidência:** `supabase/migrations/20261107000000_olaki_inicial.sql:65-67,90-108,298-298` usa o `sub` do Clerk como chave do perfil e como referência do pedido. `src/lib/perfil.ts:36-50` cria outro perfil quando não encontra aquele ID. `supabase/migrations/20261107020000_categorias_e_anuncios.sql:1399-1412` vincula acesso aos arquivos ao primeiro segmento da pasta, também o ID do usuário. `supabase/migrations/20261108050000_equipe_compliance.sql:163-183,697-743` vincula administração e equipe à mesma identidade. O QA em `docs/VALIDACAO-CADASTRO-CONTATO-2026-11-09.md:40-44` relata Clerk Development e já alerta para reconciliação administrativa numa futura mudança.

**Consequência:** se os convidados passarem a receber IDs diferentes após uma mudança de instância, terão perfis novos sem propriedade dos pedidos, lojas, fotos e permissões anteriores. Trocar apenas chaves e emissor não demonstra preservação desses vínculos. Isso é um risco de migração, não uma perda observada.

**Menor ação proposta:** decidir explicitamente se a identidade permanece estável durante o piloto. Se houver troca, preparar antes um mapeamento controlado das contas e dos vínculos, incluindo equipe e pastas de Storage. Preservar a instância anterior até conferir o acesso restaurado. Não usar coincidência de telefone ou e-mail como autorização suficiente para transferir uma loja.

**Aceite proposto:** a conta de comprador mantém seus pedidos; a de lojista mantém loja, propostas e acesso aos arquivos; uma conta distinta continua sem acesso; a administração continua acessível depois do corte e da reversão prevista. Se a instância permanecer congelada durante o piloto, basta registrar essa decisão e a condição para reabrir a migração.

**Contra-argumento:** mudar a autenticação agora pode aumentar o risco e atrasar o experimento. Concordo; este achado pede uma decisão de continuidade e preservação, não obriga a migrar o Clerk antes do piloto.

## 2. Major: voltar somente o aplicativo pode deixá-lo incompatível com o WhatsApp obrigatório

**Dimensão:** rollout, rollback e recuperação.

**Evidência:** `supabase/migrations/20261110012622_confirmacao_whatsapp.sql:1-4,21-37,39-79` adiciona o estado de confirmação e os RPCs privados. A migração seguinte, `20261110014434_whatsapp_obrigatorio.sql:1-30`, manda ativar depois do aplicativo, remove a antiga configuração de dispensa e instala bloqueios no banco. `src/app/completar-perfil/page.tsx:31-37` depende do novo fluxo; `src/lib/whatsapp/servico.ts:10-23,46-62` depende da configuração e de uma sessão Evolution aberta. O README ainda enumera somente quatro migrações em `README.md:24-31`; o QA de WhatsApp documenta a ordem correta do corte inicial em `docs/QA-WHATSAPP-2026-11-09.md:29`.

**Consequência:** uma reversão para versão anterior ao fluxo de confirmação conserva os bloqueios do banco e pode impedir novas operações de participantes sem confirmação. Uma sessão Evolution fechada também impede novos códigos, embora usuários já confirmados possam continuar. Restaurar todo o banco para recuperar o aplicativo poderia apagar negociações criadas depois da cópia.

**Menor ação proposta:** definir uma versão de retorno que já entenda o esquema atual, registrar a combinação de commit, migrações e integrações escolhida para o piloto e designar quem recupera a sessão de verificação. Conservar as migrações aditivas ao voltar o aplicativo. Para indisponibilidade, suspender novas entradas até recuperar o serviço, sem reabrir a dispensa de comprovação. Conferir separadamente a recuperação do banco e dos objetos de Storage.

**Aceite proposto:** ensaio isolado de atualização e retorno preserva um pedido, uma proposta e uma confirmação existentes; participante ainda não confirmado consegue retomar o fluxo após a recuperação; nenhuma confirmação pode ser gravada diretamente pelo usuário. O responsável consegue identificar a versão e restaurar um objeto e seu vínculo sem substituir os dados posteriores do piloto. A checagem no ambiente de destino deve preceder o primeiro lote de convites.

**Contra-argumento:** o QA já registra corte bem-sucedido e reinício do serviço. Isso reduz a incerteza de implantação inicial, mas não prova retorno para uma versão anterior nem recuperação após perda de dados. Não é necessário criar infraestrutura nova se o procedimento existente demonstrar esses aceites.

## 3. Major: a exclusão com pagamentos associados conserva dados além do tratamento explícito

**Dimensão:** ciclo dos dados e recuperação de operação parcial.

**Evidência:** `supabase/migrations/20261107010100_painel_admin.sql:236-245` impede excluir uma vitrine referenciada por qualquer pagamento, inclusive pendente ou cancelado. `src/app/api/webhooks/clerk/route.ts:58-113` tenta excluir o perfil e, diante de qualquer erro, entra no caminho que suspende a loja e troca alguns dados do perfil. Esse caminho não exclui `robo_conversas` nem o texto dos pedidos/propostas. `supabase/migrations/20261107031000_robo_aki.sql:89-113` só remove as conversas em cascata quando o perfil é efetivamente apagado. `src/app/(conta)/minha-conta/privacidade/actions.ts:15-20` informa sucesso assim que o Clerk aceita a exclusão, antes do processamento do webhook.

**Consequência:** uma conta com cobrança associada pode desaparecer do login e continuar ligada a conversas e conteúdo livre no banco. O código não demonstra anonimização desse conteúdo. Em falha operacional, o usuário também não tem evidência de conclusão da limpeza. O problema independe de provar que já ocorreu com alguém em produção. Logs de auditoria e dados fiscais têm tratamento próprio; não proponho apagá-los indiscriminadamente.

**Menor ação proposta:** delimitar os dados que precisam permanecer por retenção e tornar explícita a limpeza dos demais no caminho com pagamentos. Distinguir a restrição esperada de exclusão de outros erros de banco. Registrar estado de processamento suficiente para repetição e conciliação, e comunicar solicitação recebida até a confirmação da limpeza. Reaproveitar a verificação de assinatura e o retorno 500 já existentes no webhook.

**Aceite proposto:** contas sem pagamento, com pagamento pendente/cancelado e com pagamento concluído chegam ao estado documentado; conversas pessoais não ficam apenas porque existe uma FK financeira; falha de Storage ou banco pode ser repetida sem reativar conteúdo; os dados retidos têm finalidade e acesso identificados. Os logs históricos devem entrar na conferência de retenção, pois o gatilho guarda versões anteriores do cadastro (`20261107000000_olaki_inicial.sql:446-464`).

**Contra-argumento:** preservar registros financeiros pode ser necessário, e um piloto pode ocorrer sem cobrança. Isso não justifica automaticamente conservar conversas do Aki nem tratar qualquer erro como retenção financeira. Se nenhuma conta puder gerar pagamentos, esse caminho tem menor exposição no piloto, mas continua sendo uma pendência real do produto.

## 4. Major: a exportação pode apresentar uma cópia parcial como completa

**Dimensão:** integridade, compatibilidade de leitura e recuperação.

**Evidência:** `src/app/(conta)/minha-conta/privacidade/baixar/route.ts:21-34` faz várias consultas e verifica apenas `perfil.error`. As consultas dependentes de vitrine em `:36-47` também não têm os erros conferidos. A montagem em `:49-66` substitui ausência de dados por `null` ou `[]` e devolve arquivo com sucesso. Há ainda uma lista fixa de campos da vitrine em `:9-10`, menor que o conjunto de dados de vitrine já existente, como endereço, localização e horários tratados no webhook em `src/app/api/webhooks/clerk/route.ts:82-96`.

**Consequência:** uma indisponibilidade ou mudança de permissão pode parecer ausência de dados. Se a consulta da vitrine falhar, anúncios, propostas e pagamentos nem serão buscados. A pessoa pode guardar esse arquivo como cópia antes de excluir a conta e descobrir depois que ele estava incompleto. O recorte fixo também precisa acompanhar a evolução do esquema.

**Menor ação proposta:** recusar a exportação quando qualquer consulta essencial falhar, mantendo a possibilidade de tentar novamente. Conferir um inventário pequeno dos campos e coleções pertencentes à pessoa, com exclusões justificadas para dados internos ou de terceiros. Preservar sessão, RLS e cabeçalhos privados já presentes.

**Aceite proposto:** provocar falha individual em cada consulta não gera um download apresentado como completo; uma conta sem vitrine continua sendo caso válido; uma conta preenchida recupera os campos próprios esperados e nenhum dado de outra conta. Alterar um privilégio de coluna deve produzir erro recuperável, não arquivo silenciosamente reduzido.

**Contra-argumento:** um piloto pequeno pode atender exportações manualmente. Essa é uma saída operacional aceitável enquanto a correção não entra, desde que o botão atual não comunique uma completude que o código não garante e o suporte tenha como conferir a cópia.

## 5. Major: confirmar o dono não comprova o número comercial que receberá a negociação

**Dimensão:** identidade do destinatário e compatibilidade do contato.

**Evidência:** `src/app/(conta)/minha-conta/loja/actions.ts:54-91` permite ao dono gravar o WhatsApp da vitrine após validação de formato. A função cumulativa mais recente `escolher_proposta`, em `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:197-207`, prefere esse número quando o tipo é loja; a confirmação do perfil entra como alternativa. A separação do contato comercial já é reconhecida no QA de WhatsApp, linha 5.

**Consequência:** o código confirma posse do telefone do perfil, mas uma proposta pode encaminhar o comprador para outro número comercial digitado. Um erro de digitação ou canal sem atendimento pode produzir ausência de resposta e expor a conversa a um destinatário indevido. Não foi observada fraude nem contato errado; o risco decorre dessa separação comprovada no código.

**Menor ação proposta:** no piloto acompanhado, conferir com cada lojista convidado o número comercial e quem atende nele, registrando a conferência antes de liberar a loja. Revalidar quando o contato mudar. Uma segunda implementação de OTP só se justifica se o experimento mostrar que o acompanhamento manual não resolve.

**Aceite proposto:** cada loja do lote tem canal comercial conferido e responsável por responder; a abertura do contato usa esse número; uma troca aciona nova conferência. Registrar contato aberto, resposta recebida e negócio confirmado como fatos diferentes, sem inferir venda a partir da escolha da proposta.

**Contra-argumento:** muitas lojas precisam usar um telefone comercial diferente do pessoal. A recomendação preserva essa necessidade; exige apenas uma conferência proporcional ao piloto, sem obrigar identidade de números.

## Recomendação de prontidão

Recomendo preparar o piloto com identidade estável, versão de retorno compatível e recuperação demonstrada; tratar a exclusão e a exportação antes de apresentá-las como garantias aos convidados; e usar o acompanhamento inicial para conferir o contato comercial. Nenhum Blocker de execução foi demonstrado apenas pela leitura local. Uma decisão de migrar identidades sem reconciliar vínculos ou reverter para aplicativo incompatível criaria um bloqueio concreto e deve ser rejeitada até passar pelos respectivos aceites.

## Fontes efetivamente lidas

Os hashes abaixo são prefixos de 12 caracteres de SHA-256. Os arquivos do repositório correspondem ao commit fixado, não às alterações concorrentes. “Integral” indica conteúdo lido; “trechos” indica leitura parcial e buscas cumulativas, sem alegar auditoria integral das migrações.

| Fonte | Leitura | SHA-256 |
|---|---|---|
| `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/implementation_readiness.md` | Integral, persona | `1f6aa61cfe7c` |
| `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/resources/document_standards/implementation-readiness-standard.md` | Integral, padrão | `49ef3a44228a` |
| `docs/brainstorm-piloto-2026-11-09/hipotese.md` | Integral, hipótese local | `c0246331ecc8` |
| `README.md` | Integral | `eefff69f2382` |
| `package.json` | Integral | `1b49959e4628` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | Integral | `85a98209cf49` |
| `docs/QA-RADAR-2026-11-09.md` | Integral | `4adf95b28cf2` |
| `docs/QA-WHATSAPP-2026-11-09.md` | Integral | `79269508ee0c` |
| `docs/QA-MEU-PLANO-2026-11-09.md` | Integral | `66b5265a9eb8` |
| `docs/etapa5/relatorios.md` | Integral | `610fed336460` |
| `docs/etapa4/paginas.md` | Integral | `fa04d3fac0bd` |
| `docs/VALIDACAO-CADASTRO-CONTATO-2026-11-09.md` | Integral | `c01da077c632` |
| `src/lib/perfil.ts` | Integral | `029fe791f2cb` |
| `src/app/api/webhooks/clerk/route.ts` | Integral | `7537a3ee45bd` |
| `src/middleware.ts` | Integral | `8b27dc9dfba4` |
| `src/lib/supabase/server.ts` | Integral | `8e747db89f66` |
| `src/lib/supabase/admin.ts` | Integral | `c525b7df71b8` |
| `src/lib/admin/auth.ts` | Integral | `4608a5386a51` |
| `src/lib/whatsapp/servico.ts` | Integral | `8b4f3529de92` |
| `src/app/confirmar-celular/actions.ts` | Integral | `a28791cc7e77` |
| `src/app/completar-perfil/page.tsx` | Integral | `ee06572749c7` |
| `src/app/(conta)/minha-conta/privacidade/actions.ts` | Integral | `d5e7b98fabd0` |
| `src/app/(conta)/minha-conta/privacidade/baixar/route.ts` | Integral | `b685710e37c4` |
| `src/app/(conta)/minha-conta/loja/actions.ts` | Integral | `bb6e0cbda942` |
| `src/app/api/asaas/webhook/route.ts` | Integral | `47227b1a3756` |
| `src/lib/dados/conta.ts` | Integral | `1215ae142825` |
| `supabase/migrations/20261107000000_olaki_inicial.sql` | Trechos de identidade, FKs, logs e RLS | `9a36fcbc7a03` |
| `supabase/migrations/20261107010100_painel_admin.sql` | Trechos de pagamentos e permissões | `5565d1c6c7ff` |
| `supabase/migrations/20261107010200_endurecimento_advisor.sql` | Integral | `73a0519ee588` |
| `supabase/migrations/20261107020000_categorias_e_anuncios.sql` | Trechos de Storage e permissões | `da1270235dd3` |
| `supabase/migrations/20261107031000_robo_aki.sql` | Trechos de conversas, FKs e permissões | `d0c747de5d6b` |
| `supabase/migrations/20261108020000_radar_completo.sql` | Trechos de esquema, permissões e rotina de prazos | `568b33b506a8` |
| `supabase/migrations/20261108030000_paginas_e_textos.sql` | Trecho dos textos semeados e buscas de FKs | `a35231dc2c31` |
| `supabase/migrations/20261108050000_equipe_compliance.sql` | Trechos de papéis, administração e consulta de histórico | `96be2cb4c2e5` |
| `supabase/migrations/20261109032907_seguranca_fluxo_radar.sql` | Integral | `3c7896c8c4c5` |
| `supabase/migrations/20261109195657_notificacoes_confiaveis.sql` | Integral | `2ba668ac439e` |
| `supabase/migrations/20261110002950_cobranca_sem_duplicidade.sql` | Integral | `4e65415c1a2a` |
| `supabase/migrations/20261110012622_confirmacao_whatsapp.sql` | Integral | `b1a96362202f` |
| `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql` | Integral | `d526e6624a79` |
| `supabase/migrations/20261110020853_moderacao_aluguel.sql` | Integral | `93b24e49bd8f` |

Também foram feitas buscas textuais de definições, FKs, privilégios e rotinas no conjunto de migrações do commit, sem leitura integral das restantes. As buscas documentais retornaram trechos de `docs/ARQUITETURA.md`, `docs/QA-CADASTRO-INICIO-2026-11-09.md`, `docs/QA-CRIAR-PUBLICAR-ANUNCIO-2026-11-09.md`, `docs/QA-FAVORITOS-2026-11-09.md`, `docs/QA-MEUS-ANUNCIOS-2026-11-09.md`, `docs/QA-MINHA-CONTA-2026-11-09.md`, `docs/QA-NOTIFICACOES-2026-11-09.md`, `docs/QA-PAGINA-LOJA-2026-11-09.md`, `docs/VALIDACAO-ANUNCIO-2026-11-09.md`, `docs/VALIDACAO-BUSCA-2026-11-09.md` e `docs/VALIDACAO-MINHA-LOJA-2026-11-09.md`. Serviram para localizar o QA de identidade e distinguir documentação de recuperação de testes funcionais; não foram usados como prova de produção atual. Exemplo do retorno: `docs/QA-CADASTRO-INICIO-2026-11-09.md:51`, “O Clerk permanece na instância de desenvolvimento existente”.

Checagem editorial concluída: cinco achados, todos com prioridade, consequência, evidência, menor ação, aceite e contra-argumento; fatos de código separados de QA histórico, hipóteses e produção não verificada. Nenhum teste ou alteração de produto foi realizado.
