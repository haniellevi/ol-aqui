# Parecer independente: Arquiteto cético Brainstormer

Modo: BRAINSTORM. Dimensão: Contrarian / YAGNI & Code Minimization.

Status: revisão concluída para esta lente, com recomendações ainda não aprovadas. Não é auditoria exaustiva nem liberação de produção.

Versão efetivamente lida: `2f00c55df54cad2a4a687e4641a821566c800630`, conferida no início e no fim da leitura. A hipótese começa em `af2d3bf62bed537b7481f3653d6cf9a292a50a65`. A diferença inclui a revisão de `20261110020853_moderacao_aluguel.sql`, lida integralmente, e o QA de cadastro, também lido. Na inspeção inicial, a migração já não aparecia modificada; estavam não versionados a pasta deste brainstorm e `supabase/.temp/`. Nada disso foi alterado por esta lente.

Durante a conferência final surgiu a migração não versionada `supabase/migrations/20261110030000_moderacao_ia.sql`, lida integralmente no estado de SHA-256 `b0a57e090a8b6306afa322dbdc2c2a2cc8b25ce75bdc8ff13ed8532b49475405`. Ela acrescenta fila privada de análise de anúncios e configuração inicial desligada, com uso do orçamento do Aki. Não redefine as funções do Radar, relatórios ou concessão de plano usadas nos achados. Sua presença invalida uma afirmação genérica de que não existe código de moderação por IA; não comprova aplicação da migração, ativação ou operação em produção. Esse trabalho concorrente não foi auditado além da leitura dessa migração.

Princípio: o piloto deve reduzir a incerteza sobre conseguir uma resposta comercial útil e avançar uma negociação real. Já existe código suficiente para testar esse caminho sem construir outro produto. A oportunidade principal é combinar o fluxo disponível com recrutamento e observação delimitados.

## 1. Blocker: definir uma célula de demanda e oferta antes de convidar compradores

**Risco e consequência.** A hipótese ainda não define segmento, quantidade nem responsáveis (`hipotese.md:20`). Convidar pessoas dispersas por várias categorias e cidades pode produzir pedidos sem lojas aptas, deixando impossível separar falta de oferta, indisponibilidade das lojas e dificuldade de uso. Este bloqueio é operacional para começar um experimento interpretável; não é um defeito técnico demonstrado.

**Código comprovado.** O feed atual usa a microrregião do perfil e entrega pedidos abertos (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:27-34`). A proposta exige loja com acesso ao Radar e a mesma microrregião do pedido (`supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:56-71`). A tela já possui categorias cadastradas, abas pessoais e atualização (`src/app/radar/page.tsx:59-99`, `126-149`). São recursos reutilizáveis para organizar uma primeira célula; não comprovam que existam lojas prontas para responder.

**Menor ação proposta.** Selecionar uma cidade e uma categoria pela disponibilidade real das lojas. Como parâmetros de teste, considerar 3 a 5 lojas e 8 a 12 compradores com necessidades autênticas, por 14 dias. Confirmar previamente quem atende, quais itens consegue oferecer e qual pessoa acompanha cada dia. Recrutamento manual e links existentes bastam; sistema de convites, campanhas amplas e expansão regional podem esperar.

**Aceite.** Antes do primeiro convite, registrar recorte, responsável, período e lojas aptas, com cadastro, WhatsApp confirmado, acesso ao Radar e disponibilidade acordada. Todo pedido admitido no experimento deve ter pelo menos uma loja potencialmente capaz de atendê-lo; cobertura comercial não equivale a promessa de venda.

**Contra-argumento.** Abrir várias categorias pode revelar demanda inesperada. Isso faz sentido em uma rodada exploratória distinta. Nesta hipótese, a prioridade é observar negociações e respostas; a dispersão acrescenta uma causa de insucesso difícil de interpretar. Os números acima não têm validade estatística nem representam disponibilidade encontrada.

## 2. Major: a loja não precisa cadastrar um catálogo completo para participar

**Risco e consequência.** Fazer a entrada depender de importação de estoque, edição extensa da vitrine ou novos recursos de catálogo aumenta trabalho antes da primeira resposta útil. O esforço de preparação pode ser confundido com rejeição à proposta comercial do produto.

**Código comprovado.** A interface oferece escolher um anúncio ou mandar uma foto (`src/components/radar/folha-propor.tsx:224-279`) e aceita a segunda alternativa na validação (`101-108`). A ação usa `propor_radar` (`src/app/radar/actions.ts:105-118`); esse invólucro chama a regra completa (`supabase/migrations/20261108020000_radar_completo.sql:642-650`), cuja versão atual exige preço e anúncio ou foto no modo de propostas privadas (`supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:90-99`). Há ainda retorno de contato direto e escolha posterior da proposta (`151-168`, `209-214`).

**Menor ação proposta.** Preparar conta e vitrine mínimas, orientar a resposta por foto e preço e usar anúncios existentes quando houver. Escolher um caminho principal para a primeira rodada, preferencialmente pedido, proposta privada, escolha e conversa, deixando identificado o uso do modo direto. Adiar importadores, integrações de estoque, nova navegação e expansão do Aki enquanto não houver uma dificuldade observada que os justifique.

**Aceite.** Uma loja convidada consegue enviar oferta real com foto e preço sem publicar previamente um catálogo. O comprador consegue comparar e iniciar o contato usando o fluxo existente. Registrar tempo, ajuda e abandono dessa entrada antes de solicitar implementação adicional.

**Contra-argumento.** Catálogo e busca podem ser o principal valor percebido. Se a rodada escolher explicitamente essa hipótese, uma seleção pequena de anúncios reais passa a ser necessária. Isso ainda não exige catálogo completo nem importação. O QA do Radar relata exercícios anteriores com fixtures (`docs/QA-RADAR-2026-11-09.md:21-23`); a execução comercial atual continua por verificar.

## 3. Major: medir o desfecho com um registro pequeno antes de construir mais analytics

**Risco e consequência.** Usar os números disponíveis como prova de venda ou retorno pode produzir um falso resultado positivo. O relatório de funil atual soma visualizações e cliques de anúncios e o relato de anúncios vendidos (`supabase/migrations/20261108060000_mensagens_relatorios.sql:505-529`). Ele não é o funil completo de pedidos do Radar.

**Código comprovado.** Escolher a proposta marca `escolhida` e devolve o contato (`supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:209-214`). A ação devolve um link de WhatsApp (`src/app/radar/actions.ts:139-151`). “Já resolvi” altera o pedido pelo comando do comprador (`supabase/migrations/20261108020000_radar_completo.sql:463-491`); a tela pergunta se ele encontrou o que procurava (`src/components/radar/acoes-pedido.tsx:38-47`). Nenhum desses sinais, isoladamente, demonstra uma negociação confirmada pelas duas partes.

**Menor ação proposta.** Usar um registro manual por ID de pedido: entrada, primeira resposta útil, escolha, contato relatado, negócio relatado, confirmação de comprador e loja, motivo de insucesso e ajuda necessária. Registrar convite, ativação e eventual nova utilização por participante, separando iniciativa espontânea de lembrete ou assistência. Reutilizar datas e IDs já existentes; não criar um novo CRM, rastreamento de todas as buscas ou painel de retenção nesta rodada.

**Aceite.** Todo pedido da amostra termina com desfecho conhecido ou explicitamente desconhecido. Relatórios mostram numerador e denominador, diferenciam os estados acima e informam quais interações tiveram ajuda. Repetição espontânea deve ser observada apenas quando houver nova necessidade real; ausência de uma segunda compra em 14 dias não prova rejeição em categorias de baixa frequência.

**Contra-argumento.** O registro manual custa tempo e pode errar. Com a amostra proposta, permite descobrir quais dados realmente fazem falta. Se o volume impedir reconciliação ou a mesma lacuna se repetir, automatizar somente o campo ou evento demonstrado como necessário. A hipótese já exige essas distinções (`hipotese.md:17`), mas ainda não define sua rotina de coleta.

## 4. Major: combinar uma rotina de resposta, pois o código de WhatsApp não é aviso comercial

**Risco e consequência.** O comprador pode criar um pedido enquanto as lojas estão fora do site. Esperar que a verificação de WhatsApp também entregue novos pedidos às lojas cria uma dependência inexistente no fluxo lido. Respostas tardias podem então ser interpretadas como falta de interesse ou falha do Radar.

**Código comprovado.** Os canais ativos do editor de mensagens incluem apenas `notificacao` (`src/lib/tipos-relatorios.ts:40-41`). `radar_aviso` seleciona esse canal e chama `notificar` (`supabase/migrations/20261108060000_mensagens_relatorios.sql:304-339`), que grava a notificação no app (`supabase/migrations/20261108020000_radar_completo.sql:162-183`). A integração Evolution encontrada envia um código de verificação (`src/lib/whatsapp/servico.ts:46-61`); seus usos encontrados ficam na confirmação cadastral. Isso não elimina a implementação de WhatsApp existente, apenas delimita sua finalidade.

**Menor ação proposta.** Acordar com as lojas janelas para consultar o Radar e um responsável pelo acompanhamento. Como parâmetro inicial, medir resposta útil dentro de um dia útil e registrar intervenções manuais separadamente. Se for necessário avisar uma loja, usar uma comunicação humana previamente combinada, com registro da ajuda. O parecer não autoriza envios. Evitar iniciar por filas, disparos multicanal e outro provedor.

**Aceite.** Cada pedido tem horário de entrada, horário da primeira resposta útil e indicação de aviso humano. As lojas sabem que a notificação existente é interna. Se o prazo acordado falhar repetidamente apesar de cobertura disponível, a próxima decisão considera um alerta específico, sem tratar a automação como pré-requisito presumido.

**Contra-argumento.** Ajudar manualmente pode esconder baixa capacidade de retorno espontâneo. Por isso, o resultado assistido e o espontâneo precisam ser apresentados separadamente. Quando a hipótese passar a ser operação autônoma ou o acompanhamento se mostrar impraticável, uma rotina manual deixa de ser suficiente. Disponibilidade atual de notificações e Evolution em produção não foi testada nesta revisão.

## 5. Major: usar acesso temporário existente sem tornar cobrança real uma condição do piloto

**Risco e consequência.** Misturar aquisição inicial, resposta comercial e cobrança amplia as causas de abandono. Também pode levar a construir cupons ou um plano especial de piloto quando o projeto já oferece um caminho administrativo.

**Código comprovado.** A ação de lojas chama `admin_acao_loja` com motivo, dias e plano (`src/app/admin/lojas/actions.ts:32-51`). A versão cumulativa da função permite estender teste ou plano, atribuir plano por prazo e registrar antes/depois (`supabase/migrations/20261108050000_equipe_compliance.sql:544-574`, `597-605`). O acesso depende de `acesso_radar` do plano efetivo (`supabase/migrations/20261107010100_painel_admin.sql:168-174`), e a validade é considerada em `plano_efetivo` (`supabase/migrations/20261108010000_cobranca_planos.sql:170-192`). Apenas acrescentar dias não garante acesso nem aumenta a cota de propostas.

**Menor ação proposta.** Se a decisão comercial for testar sem cobrar, usar a administração existente para fornecer prazo e plano adequados, com motivo, cota suficiente e data de término explícita. Não mudar a configuração global de preços nem criar um mecanismo de cupons. Custos operacionais e tempo de acompanhamento ainda precisam de um teto definido pelo responsável.

**Aceite.** Cada loja sabe quando o acesso termina; plano, cota e prazo permitem concluir a rodada; a concessão fica no histórico. Antes de alterar uma loja já pagante, conferir eventual próximo plano, pois a troca administrativa limpa esse agendamento (`20261108050000_equipe_compliance.sql:573`). A avaliação final separa utilidade gratuita de disposição a pagar.

**Contra-argumento.** Cobrar pode selecionar lojas mais comprometidas e validar receita. É uma hipótese legítima para uma rodada que inclua monetização. O QA financeiro relata sandbox e ausência de cobrança real (`docs/QA-MEU-PLANO-2026-11-09.md:3`, `24`); isso é evidência histórica, não confirmação do ambiente financeiro atual. Para a hipótese autorizada, a negociação entre comprador e loja pode ser testada antes de acrescentar esse eixo.

## Evidências, limites e registro de leitura

**Código comprovado** significa presença e encadeamento encontrados no repositório, não execução aprovada neste parecer. As redefinições cumulativas das funções citadas foram pesquisadas nas migrações; os achados usam as versões mais recentes encontradas. Não executei build, testes, banco, navegador ou serviços externos.

**QA histórico** foi usado como relato com limites: Radar teve fronteiras substituídas por fixtures; WhatsApp registra confirmação real anterior; cobrança registra sandbox; o QA adicional de cadastro relata conta e anúncio fictício em produção. Nenhum desses relatos confirma o percurso comercial completo entre convidados agora. A correção recente de moderação de aluguel foi considerada; não foi reaberta como defeito atual.

**Hipóteses de negócio** são o recorte sugerido, a quantidade de convidados, os 14 dias, o prazo de resposta e a conveniência da gratuidade. **Produção não verificada:** lojas disponíveis, configurações efetivas, acesso e cotas reais, rotinas de avisos, estabilidade do cadastro, negociação e retorno espontâneo. Nenhuma consulta foi feita a memórias, conversas, `concepts_brief.md`, `verificacao-atual.md`, relatório antigo de riscos ou pareceres de outros revisores.

As leituras obrigatórias foram concluídas. Hashes abaixo são prefixos SHA-256 para identificar a versão lida, não substitutos da leitura.

| Leitura integral | Identificador |
| --- | --- |
| `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/zoom_out.md` | `adc9d7b7db4c3048`, “Skeptical Architect” |
| `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/resources/document_standards/zoom-out-standard.md` | `0a01013bd363a8d7`, “Root Problem Focus” |
| `docs/brainstorm-piloto-2026-11-09/hipotese.md` | `300e8605e1052ff2`, “piloto acompanhado” |
| `README.md` | `eeefff69f2382183b`, “Radar de Negócios” |
| `package.json` | `1b49959e46284d49`, `next: 15.5.29` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | `85a98209cf498811`, “Base reconciliada” |
| `docs/QA-RADAR-2026-11-09.md` | `4adf95b28cf27d60`, “fixtures locais” |
| `docs/QA-WHATSAPP-2026-11-09.md` | `79269508ee0cc14e`, “Confirmação do WhatsApp” |
| `docs/QA-MEU-PLANO-2026-11-09.md` | `66b5265a9eb8c317`, “sandbox” |
| `docs/etapa5/relatorios.md` | `610fed3364604f3b`, “Buscas não são medidas” |
| `docs/etapa4/paginas.md` | `fa04d3fac0bd3f0cb`, “Blocos da home” |
| `docs/QA-CADASTRO-INICIO-2026-11-09.md` | `ff6345af45fe4f86`, “anúncio fictício” |

Leituras de implementação abaixo são integrais somente quando indicado. Os demais intervalos foram lidos como trechos completos, além das buscas de símbolos nas migrações e em `src`.

| Arquivo | Extensão lida e identificador |
| --- | --- |
| `src/lib/dados/radar.ts` | Integral, `acessoRadar`, `meusPedidos`, `avisosNaoLidos` |
| `src/app/radar/page.tsx` | Integral, `radar_feed`, `AbasRadar` |
| `src/components/radar/acoes-pedido.tsx` | Integral, “Já resolvi” |
| `src/app/admin/lojas/actions.ts` | Integral, `admin_acao_loja` |
| `src/lib/whatsapp/servico.ts` | Integral, `enviarCodigo` |
| `src/app/radar/actions.ts` | 105-166, `propor_radar`, `escolher_proposta`, `fechar_pedido_radar` |
| `src/components/radar/folha-propor.tsx` | 99-113 e 212-292, “Ou mande uma foto” |
| `src/lib/tipos-relatorios.ts` | 1-48, `CANAIS_ATIVOS` |
| `src/lib/aki/motor.ts` | 77-111, `estadoAki` |
| `supabase/migrations/20261107010100_painel_admin.sql` | 163-176, `tem_plano_pago` |
| `supabase/migrations/20261108010000_cobranca_planos.sql` | 170-196, `plano_efetivo` |
| `supabase/migrations/20261108020000_radar_completo.sql` | 162-188, 217-284, 455-496, 642-667; `notificar`, `fechar_pedido_radar`, `propor_radar` |
| `supabase/migrations/20261108050000_equipe_compliance.sql` | 507-610, `admin_acao_loja` |
| `supabase/migrations/20261108060000_mensagens_relatorios.sql` | 283-340 e 505-534, `radar_aviso`, `relatorio_funil` |
| `supabase/migrations/20261109032907_seguranca_fluxo_radar.sql` | 1-80, `radar_feed`, `radar_pedido` |
| `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql` | Integral, `exigir_whatsapp_operacao`, `radar_propor`, `escolher_proposta` |
| `supabase/migrations/20261110020853_moderacao_aluguel.sql` | Integral, “Aluguéis mantêm limites específicos” |
| `supabase/migrations/20261110030000_moderacao_ia.sql` | Integral, arquivo não versionado observado ao final; `moderacao_ia_reservar`, `moderacao_ia_concluir` |

Recomendação desta lente: preparar uma célula local acompanhada com o fluxo atual, entrada das lojas por foto, acesso temporário registrado e observação manual por pedido. Investimento adicional deve responder ao que impedir essa célula de gerar e concluir conversas úteis.
