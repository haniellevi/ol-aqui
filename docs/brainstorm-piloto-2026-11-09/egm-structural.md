# Parecer estrutural: manutenção do piloto acompanhado

Persona: **egm-structural**, título solicitado **Arquiteto de manutenção Brainstormer**. Modo: **BRAINSTORM**. Dimensão dos achados: dívida técnica e manutenção.

Status: análise estática concluída; recomendações ainda não aprovadas. Base exclusiva do produto: `2f00c55df54cad2a4a687e4641a821566c800630`. Critério de sucesso: identificar riscos materiais para o piloto, explicar o efeito operacional e indicar uma ação pequena com aceite verificável.

O princípio adotado é preservar o núcleo de regras já existente no banco e tornar explícitos os contratos de repetição, expiração e encerramento. Não há justificativa, nesta leitura, para uma reorganização ampla do projeto. RLS, funções transacionais e a chave de envio do formulário do Radar são ativos a reaproveitar.

## Limites da evidência

Os achados abaixo distinguem código lido, consequência inferida e produção não verificada. Não executei build, testes, banco, serviços externos nem fluxos reais. As verificações descritas nos documentos QA são registros históricos, não resultados desta análise.

A hipótese registra um HEAD inicial anterior. O responsável pela revisão fixou a base acima, e as leituras posteriores usaram `git show` desse commit. O trabalho concorrente de moderação por IA ficou fora da análise: `.env.example`, `src/app/api/interno/`, `src/lib/moderacao-ia.ts`, as migrações `20261110030000_moderacao_ia.sql` e `20261110030100_moderacao_ia_agendamento.sql`, além das alterações observadas em `src/app/(conta)/anunciar/pronto/page.tsx` e `src/app/admin/moderacao/page.tsx`. Não atribuo implantação ou validação a esses arquivos.

Não consultei memórias, conversas, `concepts_brief.md`, `verificacao-atual.md`, `roteiro-piloto.md`, pareceres alheios ou o relatório antigo de riscos. A única escrita realizada foi este parecer.

## 1. Major: o encerramento por prazo impede registrar uma resolução comercial posterior

**Escopo:** núcleo do piloto e medição de resultados.

**Código comprovado.** A leitura do pedido considera fechado qualquer pedido com `expira_em <= now()`, mesmo antes da rotina atualizar seu status (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:54-57`). A tela retira a ação de resolver quando a situação é fechada (`src/app/radar/pedido/[id]/page.tsx:114-116`). A RPC de fechamento só aceita resolver um pedido ainda aberto (`supabase/migrations/20261108020000_radar_completo.sql:475-493`). Entretanto, a versão cumulativa de `escolher_proposta` permite obter o contato após o prazo, exceto nos bloqueios explícitos de moderação e cancelamento (`supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:194-214`).

**Consequência e limite.** É possível negociar a partir de uma oferta antiga e concluir depois da expiração, sem registrar essa resolução pelo fluxo disponível. A ocorrência comercial é uma hipótese; a diferença entre os contratos está comprovada no código. Usar apenas `atendido` ou `fechado_motivo` como resultado do piloto perderia parte desses desfechos. A proposta escolhida permanece um evento separado e não prova venda.

**Menor ação e requisito de manutenção.** Durante o piloto, manter um registro de acompanhamento vinculado ao ID do pedido, com oferta escolhida, resultado relatado, confirmação de cada participante e eventual ajuda da equipe. Preservar o estado operacional do pedido e registrar o resultado comercial de forma independente. Só ampliar a interface se o acompanhamento mostrar necessidade recorrente.

**Aceite.** Um caso que expira antes de a negociação terminar pode receber um resultado posterior, com data e origem do relato, sem ser reaberto nem contado automaticamente como negócio confirmado.

**Contra-argumento.** A equipe pode obter o resultado por conversa. Isso atende ao piloto se houver um registro compartilhado e consistente; lembranças individuais não permitem comparar retorno espontâneo e retorno provocado pela equipe.

## 2. Major: a implantação precisa comprovar rotinas que materializam o estado

**Escopo:** núcleo operacional, principalmente prazos, anúncios e acesso por plano.

**Código comprovado.** O agendamento de `expirar_rotina` aparece como instrução comentada na migração inicial (`supabase/migrations/20261107000000_olaki_inicial.sql:644`). A versão cumulativa chama `radar_avisar_prazos` e a rotina base (`supabase/migrations/20261108020000_radar_completo.sql:1026-1036`). Esta materializa troca de plano, expira anúncios avulsos, pausa excedentes e chama a expiração de destaques (`supabase/migrations/20261108010000_cobranca_planos.sql:907-946`). Os jobs de Radar e mensagens só são criados quando `pg_cron` já existe (`supabase/migrations/20261108020000_radar_completo.sql:1016-1024`; `supabase/migrations/20261108060000_mensagens_relatorios.sql:466-472`).

**Consequência e limite.** Aplicar as migrações não comprova que todas essas tarefas estejam agendadas e funcionando. Sem execução, o estado persistido pode ficar atrasado em relação às regras calculadas por data, dificultando suporte e diagnóstico. Não constatei job ausente ou parado em produção, pois não consultei o ambiente.

**Menor ação e requisito de manutenção.** Antes de abrir o piloto, registrar os jobs exigidos, responsável, periodicidade e evidência da última execução. Conferir o agendamento real e acompanhar falhas usando os mecanismos existentes. Não criar um segundo agendador se o banco já atende ao contrato.

**Aceite.** Em ambiente controlado, um pedido vencido recebe o motivo de prazo e um anúncio fora do limite assume o estado esperado; no ambiente do piloto, cada rotina necessária tem agendamento e execução recente identificáveis. Os testes devem ocorrer em trabalho posterior autorizado, não foram executados aqui.

**Contra-argumento.** Leituras como o feed do Radar já filtram por data, reduzindo exposição de pedidos expirados (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:33-34`). Isso protege parte da experiência, mas não substitui os avisos, a materialização dos estados e a rotina de anúncios.

## 3. Major: o roteiro principal de instalação descreve um contrato ultrapassado

**Escopo:** manutenção e recuperação do núcleo do piloto.

**Código e documentação comprovados.** O `README.md:24-42` lista quatro migrações e oferece execução manual dessa ordem, omitindo inclusive a migração de endurecimento situada entre elas. O aplicativo atual chama `criar_pedido_radar_site` (`src/app/radar/actions.ts:71-81`), criada numa migração posterior (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:163-187`). O `README.md:12` ainda trata cobrança como próxima etapa, e `README.md:46-51` descreve confirmação exclusivamente pelo Clerk. O QA de WhatsApp documenta historicamente a ativação de Evolution e das migrações de confirmação e obrigatoriedade.

**Consequência e limite.** Uma reinstalação ou entrada de outro mantenedor pode partir de um banco incompatível e de dependências incompletas. Os QA detalhados ajudam a reconstruir o histórico, mas obrigam o operador a reconciliar documentos de entregas distintas. Isso não demonstra que a implantação atual esteja incorreta.

**Menor ação e requisito de manutenção.** Atualizar o ponto de entrada para indicar todas as migrações versionadas em ordem, os comandos existentes de verificação e as dependências efetivas. Acrescentar um registro curto da versão do aplicativo, migrações aplicadas, jobs e limites do ambiente do piloto. Manter QA como histórico, com link para a instrução operacional vigente.

**Aceite.** Uma pessoa que não acompanhou o desenvolvimento consegue identificar a base, a sequência completa e as dependências sem deduzi-las a partir de chats ou cronologia de QA; o roteiro não recomenda uma instalação incompatível com a RPC usada pelo site.

**Contra-argumento.** Um único mantenedor pode conhecer a sequência correta. O piloto acompanhado aumenta a necessidade de repetir diagnósticos e recuperar serviço; um ajuste pequeno de documentação reduz essa dependência pessoal sem alterar arquitetura.

## 4. Major: o Aki usa duas transações para uma confirmação que promete ocorrer uma vez

**Escopo:** condicionado ao Aki participar do piloto; não bloqueia o formulário convencional do Radar.

**Código comprovado.** `confirmarPedidoRadar` grava `usada=true` por `robo_marcar_acao`, depois chama `criar_pedido_radar`, e tenta desfazer a marca em erro (`src/lib/aki/acoes.ts:81-107`). A repetição da marca é convertida em sucesso textual, sem recuperar um pedido persistido (`src/lib/aki/acoes.ts:82-84`; `supabase/migrations/20261107031000_robo_aki.sql:531-547`). O formulário convencional já usa criação idempotente em uma RPC, com trava e recuperação do ID por chave (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:175-184`).

**Consequência e limite.** Se o processo parar após marcar a ação e antes de criar o pedido, a repetição pode informar envio inexistente. Se a criação for confirmada no banco e sua resposta se perder, a compensação pode liberar uma nova criação. São cenários inferidos das fronteiras transacionais, sem reprodução nesta análise. A equipe teria de reconciliar conversa, marca e pedido manualmente.

**Menor ação e requisito de manutenção.** Excluir a criação de pedidos pelo Aki do recorte inicial ou reunir leitura da ação, criação e vínculo ao pedido em uma RPC transacional e repetível, reaproveitando as regras de `criar_pedido_radar`. A repetição deve devolver o mesmo ID e estado, preservando a origem Aki.

**Aceite.** Interrupção entre etapas, resposta perdida e dois cliques concorrentes resultam em exatamente um pedido recuperável, ou em erro explícito sem marca consumida. A correção não deve reconstruir as regras de cidade, confirmação, limites e moderação em outro módulo.

**Contra-argumento.** O Aki pode estar desligado, e a migração semeia `robo.ativo=false`. Nesse recorte a correção é adiável. O defeito não deve ser atribuído ao formulário convencional, cuja proteção idempotente está presente.

## 5. Major: a exclusão com pagamentos depende de uma lista manual de limpeza que ficou incompleta

**Escopo:** condicionado a contas com registros de pagamento; a retenção de conversas exige que a conta também tenha usado o Aki.

**Código comprovado.** Pagamentos impedem excluir a vitrine por uma chave com `on delete restrict` (`supabase/migrations/20261107010100_painel_admin.sql:238`). Quando a exclusão do perfil falha, o webhook passa a suspender e anonimizar entidades e a apagar algumas tabelas nominalmente (`src/app/api/webhooks/clerk/route.ts:61-113`). Esse ramo não apaga `robo_conversas`. As conversas dependem da exclusão do perfil para sua cascata, e as mensagens dependem da exclusão da conversa (`supabase/migrations/20261107031000_robo_aki.sql:89-113`). Como o perfil é mantido no ramo alternativo, essa cascata não ocorre.

**Consequência e limite.** A anonimização do cadastro não remove o texto livre já guardado nas conversas, que pode conter dados pessoais. A extensão de um produto exige lembrar de atualizar dois mecanismos de limpeza, o que já produziu diferença concreta entre eles. Não constatei conta real afetada e não faço conclusão jurídica sobre retenção fiscal. O ramo é condicionado à existência de registros de pagamento, inclusive sem comprovação de pagamento real.

**Menor ação e requisito de manutenção.** Revisar o ramo alternativo com uma matriz curta de dados que devem sair, permanecer ou ser anonimizados, acrescentando a limpeza das conversas e preservando separadamente os registros cuja retenção for necessária. Reutilizar um contrato único de encerramento de conta; não é necessário dividir o sistema em serviços.

**Aceite.** Duas contas de teste com conteúdo fictício, uma com registro financeiro e outra sem, terminam sem conversas nem mensagens pessoais após encerramento. Repetir o webhook mantém o resultado e conserva apenas os dados previstos no contrato de retenção.

**Contra-argumento.** Se o piloto excluir cobrança e Aki e as contas não tiverem registros financeiros anteriores, o cenário não é exercitado. Isso permite adiar a correção dentro desse limite explícito; não permite considerar o ramo de anonimização equivalente à cascata.

## Recorte recomendado

Há três Majors ligados à preparação e interpretação do piloto e dois condicionados a recursos opcionais. A análise estática não demonstrou um Blocker universal que exija reformular o produto. Recomendo conferir os jobs, corrigir a instrução operacional e definir o registro de resultados antes dos convites. O Aki pode ficar fora da primeira rodada; cobrança e histórico financeiro exigem atenção ao encerramento de conta se entrarem no recorte.

O QA histórico relata proteções de concorrência e repetição do formulário, testes isolados do banco e confirmação real do WhatsApp. Nada disso comprova, por si só, a versão, as rotinas e as integrações atualmente em produção. A moderação por IA concorrente exige revisão própria após consolidar sua versão.

## Fontes efetivamente consultadas

Persona e hipótese foram lidas integralmente antes do código. Identificadores abaixo são os primeiros 16 caracteres do SHA-256; fontes do produto correspondem ao commit fixado. Os demais arquivos foram lidos integralmente quando pequenos ou nos trechos indicados pelos símbolos relevantes. Busca textual cumulativa nas migrações conferiu as últimas definições das funções citadas.

| Fonte | Registro da leitura |
|---|---|
| `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/structural.md` | `f0d4fe6faee4e388`; seção BRAINSTORM: acoplamento, dívida técnica e manutenção |
| `docs/brainstorm-piloto-2026-11-09/hipotese.md` | `c0246331ecc89395`; piloto pequeno acompanhado; recomendações não aprovadas |
| `README.md` | `eefff69f2382183b` |
| `package.json` | `1b49959e46284d49` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | `85a98209cf498811`; QA e publicação históricos |
| `docs/QA-RADAR-2026-11-09.md` | `4adf95b28cf27d60`; testes com fronteiras simuladas |
| `docs/QA-WHATSAPP-2026-11-09.md` | `79269508ee0cc14e`; teste real e corte de produção relatados |
| `docs/QA-MEU-PLANO-2026-11-09.md` | `66b5265a9eb8c317`; sandbox e webhook financeiro não exercitado |
| `docs/etapa5/relatorios.md` | `610fed3364604f3b` |
| `docs/etapa4/paginas.md` | `fa04d3fac0bd3f0c` |
| `src/lib/aki/acoes.ts` | `538050646d03ff47` |
| `src/app/radar/actions.ts` | `f398c555622fbe9b` |
| `src/app/api/webhooks/clerk/route.ts` | `7537a3ee45bd56ac` |
| `src/lib/dados/radar.ts` | `1f1fdc442c391323` |
| `src/lib/admin/relatorios.ts` | `51c2639d57df75af`; trechos de funções e falhas de leitura |
| `src/lib/dados/config.ts` | `e89e62c792fed43e` |
| `src/components/radar/acoes-pedido.tsx` | `8b38ce43310d0117` |
| `src/app/radar/pedido/[id]/page.tsx` | `c9f368c9a0945159` |
| `src/app/(conta)/minha-conta/privacidade/page.tsx` | `049b5b309e336647`; trechos de download, conversas e exclusão |
| `supabase/migrations/20261107000000_olaki_inicial.sql` | `9a36fcbc7a03e125`; referências, proposta e rotina |
| `supabase/migrations/20261107010100_painel_admin.sql` | `5565d1c6c7ffad49`; referências e pagamentos |
| `supabase/migrations/20261107031000_robo_aki.sql` | `d0c747de5d6bf9d8`; configurações, tabelas e marcação de ação |
| `supabase/migrations/20261108010000_cobranca_planos.sql` | `bee97c9cb1dea1da`; rotina cumulativa e situação da vitrine |
| `supabase/migrations/20261108020000_radar_completo.sql` | `568b33b506a890b5`; pedido, fechamento, avisos e rotinas |
| `supabase/migrations/20261108060000_mensagens_relatorios.sql` | `e823e2d5e43b237b`; avisos, jobs e relatórios |
| `supabase/migrations/20261109032907_seguranca_fluxo_radar.sql` | `3c7896c8c4c5cd70`; feed, situação e idempotência |
| `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql` | `d526e6624a79e9df`; versão atual da escolha de proposta |

Também consultei resultados de busca textual, sem leitura integral, em `src/app/(conta)/minha-conta/privacidade/baixar/route.ts`, `src/components/radar/listas-radar.tsx`, `src/components/radar/propostas-recebidas.tsx`, `src/lib/tipos-radar.ts`, `tests/fluxo.test.cjs` e nas migrações cumulativas de hardening, destaques, páginas, equipe, notificações, favoritos, confirmação de WhatsApp e cobrança sem duplicidade. Esses resultados serviram para localizar referências e possíveis substituições; não foram tratados como execução de testes.
