# Leitor novo de UX Brainstormer

Lente: `egm-comprehension`. Modo: `BRAINSTORM`. Status: revisão independente concluída no recorte autorizado; recomendações ainda não aprovadas.

Critério de sucesso: apontar fricções comprováveis no caminho entre convite, cadastro, pedido, resposta e retomada, com uma ação pequena e aceite verificável para cada uma.

Versão efetivamente lida: `2f00c55df54cad2a4a687e4641a821566c800630`, confirmada no início e no fim da leitura. É posterior ao HEAD inicial da hipótese. O estado observado tinha `docs/brainstorm-piloto-2026-11-09/` e `supabase/.temp/` não versionados; não havia alteração de código rastreado no `git status` inicial. Só este parecer foi escrito.

O princípio que governa este piloto é preservar a intenção do participante e tornar cada próximo passo reconhecível. A assistência da equipe pode compensar uma limitação de interface, desde que seja registrada: uma conclusão acompanhada e um retorno espontâneo produzem evidências diferentes.

O fluxo atual já permite pedir, propor, comparar e abrir contato, com confirmação de WhatsApp, validação de campos, recuperação de falhas de envio e encerramento confirmado. Os cinco achados abaixo tratam de continuidade e interpretação. Não identifiquei um Blocker de UX demonstrado apenas pela leitura; isso não certifica a prontidão de produção.

## COMP-01: a confirmação pode devolver a pessoa a outra tarefa

**Prioridade: Major. Dimensão: UX e ergonomia.** A pessoa que já tem conta sem WhatsApp confirmado e tenta abrir uma área protegida é enviada a `/confirmar-celular` sem destino. Depois da confirmação, o destino padrão é Editar perfil. Na criação de pedido, o botão de confirmação também fixa o retorno em `/radar/pedir`, descartando texto, categoria, cidade e preços vindos da busca.

**Código comprovado:** [layout da conta, linhas 16 a 20](/home/raniel-linux/workspace/OLAQUI/src/app/(conta)/layout.tsx:16); [destino padrão da confirmação, linhas 18 a 19](/home/raniel-linux/workspace/OLAQUI/src/app/confirmar-celular/page.tsx:18); [retorno fixo do Radar, linhas 48 a 55](/home/raniel-linux/workspace/OLAQUI/src/app/radar/pedir/page.tsx:48). O cadastro novo já preserva o destino em [completar-perfil, linhas 29 a 37](/home/raniel-linux/workspace/OLAQUI/src/app/completar-perfil/page.tsx:29), portanto o problema não atinge todos os caminhos. A recuperação de erro dentro de um pedido usa outro link fixo em [form-pedido, linhas 246 a 252](/home/raniel-linux/workspace/OLAQUI/src/components/radar/form-pedido.tsx:246), enquanto os valores digitados estão no estado local, linhas 38 a 47.

**Consequência no piloto:** é plausível que o convidado conclua o cadastro e pense ter perdido o pedido ou precise de nova orientação. Isso deve ser medido como hipótese de abandono, pois não foi observado com participantes nesta revisão.

**Menor ação e requisito:** preservar um destino interno seguro, com os parâmetros necessários, em toda ida à confirmação. Se o desvio ocorrer depois de preencher o formulário, manter também o conteúdo suficiente para retomá-lo. No piloto acompanhado, o operador pode registrar e restaurar o contexto enquanto a correção não existe; isso conta como ajuda manual.

**Aceite:** uma conta existente sem confirmação acessa um destino de venda e uma busca que leva ao Radar; ao confirmar, retorna à tarefa original, com seus parâmetros. Um erro de confirmação durante o pedido não obriga a redigitar título e detalhes. O destino continua restrito ao próprio site.

**Contra-argumento:** o caminho de cadastro novo já transporta a origem, e um piloto pode receber contas preparadas. A recomendação continua útil se cadastro ou reativação fizerem parte do experimento; perde urgência se todos os convites forem para contas verificadas e essa preparação ficar explicitamente fora da medição.

## COMP-02: a etapa obrigatória de WhatsApp não oferece ajuda no bloqueio

**Prioridade: Major. Dimensão: UX e ergonomia.** Há mensagens adequadas para número inválido, código expirado, três erros e intervalo entre envios. Quando a infraestrutura falha ou a cota termina, a pessoa recebe a orientação de tentar depois, sem um caminho de ajuda nessa tela. A saída disponível é voltar ao início.

**Código comprovado:** [ações da confirmação, linhas 20 a 31](/home/raniel-linux/workspace/OLAQUI/src/app/confirmar-celular/actions.ts:20) incluem indisponibilidade e espera de 24 horas; [página, linhas 20 a 26](/home/raniel-linux/workspace/OLAQUI/src/app/confirmar-celular/page.tsx:20) oferece a mensagem de indisponibilidade e o retorno ao início. O componente completo [confirmar-whatsapp, linhas 64 a 84](/home/raniel-linux/workspace/OLAQUI/src/components/conta/confirmar-whatsapp.tsx:64) permite novo código e correção do número, mas não encaminha ao suporte. A obrigatoriedade atual também está nas operações do banco em [20261110014434, linhas 22 a 30](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:22).

**Consequência no piloto:** um incidente de entrega pode impedir todo o percurso de um convidado e ser interpretado como dificuldade de usar o produto. A existência dessa falha em produção não foi verificada; a ausência de uma saída assistida na tela foi verificada.

**Menor ação e requisito:** oferecer “Preciso de ajuda” no ponto de bloqueio, ligado ao canal realmente atendido pela equipe do piloto, com uma orientação de retomada. Manter a comprovação de posse do número. Registrar falha de entrega, dificuldade de uso e abandono como causas distintas.

**Aceite:** diante de indisponibilidade, limite ou CAPTCHA que não carrega, o participante encontra ajuda sem voltar a explorar o site; o responsável sabe qual tarefa ficou interrompida e consegue orientar a retomada. Ninguém pede o código ao participante ou confirma o número manualmente para contornar a proteção.

**Contra-argumento:** acompanhamento próximo pode significar suporte já aberto em outro canal. Nesse caso, basta documentar esse ponto de contato e exercitar a recuperação antes da primeira sessão. O teste real descrito no QA comprova um recebimento anterior, sem demonstrar todas as recuperações.

## COMP-03: receber uma proposta ainda depende de voltar ao site

**Prioridade: Major. Dimensão: UX e ergonomia.** O modo de propostas privadas exige que comprador e loja retomem o site. O sucesso do pedido explica que as ofertas aparecem na página e nas notificações da conta, mas o estado vazio usa a expressão mais ampla “avisamos você”. A confirmação por WhatsApp pode reforçar a expectativa de que os demais avisos também chegarão por esse canal.

**Código comprovado:** [sucesso do pedido, linhas 54 a 58](/home/raniel-linux/workspace/OLAQUI/src/app/radar/pedido/[id]/page.tsx:54); [estado vazio, linhas 34 a 43](/home/raniel-linux/workspace/OLAQUI/src/components/radar/propostas-recebidas.tsx:34). O sino consulta enquanto a página está visível e atualiza periodicamente, em [sino-avisos, linhas 19 a 43](/home/raniel-linux/workspace/OLAQUI/src/components/conta/sino-avisos.tsx:19). O caminho atual de avisos do Radar seleciona `canal = 'notificacao'` e chama `notificar` sem canal externo em [20261108060000, linhas 304 a 339](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:304); `notificar` grava `app` por padrão em [20261108020000, linhas 162 a 180](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:162). O catálogo de canais ativos confirma apenas `notificacao` em [tipos-relatorios, linha 41](/home/raniel-linux/workspace/OLAQUI/src/lib/tipos-relatorios.ts:41).

**Consequência no piloto:** uma oferta útil pode não ser percebida a tempo. É hipótese de uso, não evidência de que compradores reais ignoraram propostas. Um operador que lembra todos de voltar pode melhorar a conclusão e esconder a dificuldade de retorno espontâneo.

**Menor ação e requisito:** explicitar o canal em todas as mensagens de espera e combinar, com os convidados, quando consultar pedidos e ofertas. Usar acompanhamento manual no piloto sem exigir agora uma nova integração de mensagens; registrar cada lembrete e o retorno que ocorreu sem ele.

**Aceite:** comprador e lojista conseguem explicar onde verão novidades e como retomar o pedido. O registro do piloto distingue retorno espontâneo, retorno após lembrete e falta de retorno. Fechar o site não deve ser apresentado como suficiente para receber um aviso externo.

**Contra-argumento:** o modo direto já encaminha a conversa para o WhatsApp e a confirmação do pedido privado está parcialmente clara. A recomendação se torna menos urgente se o piloto usar apenas o modo direto, mas esse recorte precisa ser registrado para não generalizar os resultados ao modo privado.

## COMP-04: um pedido sem resposta termina com orientação contraditória

**Prioridade: Major. Dimensão: UX e ergonomia.** Depois do prazo, a página informa que nenhuma loja mandou proposta, mas o componente vazio continua dizendo “Nenhuma proposta ainda” e “Quando uma loja mandar oferta”. Não existe nessa combinação um próximo passo específico para quem ficou sem resposta.

**Código comprovado:** [prazo encerrado, linhas 104 a 114](/home/raniel-linux/workspace/OLAQUI/src/app/radar/pedido/[id]/page.tsx:104) sempre renderiza `PropostasRecebidas`, passando somente propostas, permissão de escolha e modo. [O componente, linhas 17 a 44](/home/raniel-linux/workspace/OLAQUI/src/components/radar/propostas-recebidas.tsx:17) desconhece o estado encerrado e oferece apenas procurar anúncios. O link para um pedido novo aparece na seção de resolvido ou cancelado, [linhas 89 a 101](/home/raniel-linux/workspace/OLAQUI/src/app/radar/pedido/[id]/page.tsx:89).

**Consequência no piloto:** no cenário possível de baixa oferta inicial, o comprador pode continuar esperando um resultado que já não chegará por esse pedido. Isso dificulta observar se houve interesse em tentar novamente e qual parte do pedido não recebeu atendimento.

**Menor ação e requisito:** diferenciar espera em andamento de prazo encerrado sem ofertas. Neste último estado, oferecer uma escolha explícita entre buscar anúncios, criar outro pedido reaproveitando os dados ou pedir ajuda à equipe. Uma nova publicação deve exigir intenção explícita, para não criar pedidos repetidos automaticamente.

**Aceite:** um pedido privado expirado com zero propostas não exibe promessa de novas ofertas. A pessoa entende que a tentativa terminou e consegue iniciar a próxima ação sem reconstruir todo o contexto. A equipe consegue registrar “sem resposta” separadamente de “resolvido”.

**Contra-argumento:** a página já informa o fim do prazo e fornece busca nos anúncios. Isso evita um bloqueio absoluto, mas a combinação das mensagens ainda exige interpretação do usuário; por isso a ação proposta é pequena e específica ao estado vazio.

## COMP-05: contato e resolução ainda não identificam negócio realizado

**Prioridade: Major. Dimensão: UX e ergonomia.** “Chamar no WhatsApp” marca a proposta como escolhida antes de existir evidência de mensagem enviada. “Já resolvi” apenas encerra o pedido com esse motivo. Esses eventos são úteis, mas não demonstram que houve uma negociação concluída por meio do piloto.

**Código comprovado:** [propostas-recebidas, linhas 84 a 103](/home/raniel-linux/workspace/OLAQUI/src/components/radar/propostas-recebidas.tsx:84) chama `escolherProposta` antes de navegar ao contato e exibe “Você escolheu” nas linhas 140 a 144. A função atual grava `escolhida` em [20261110014434, linhas 209 a 214](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:209). [AcoesPedido, linhas 38 a 47](/home/raniel-linux/workspace/OLAQUI/src/components/radar/acoes-pedido.tsx:38) pergunta se a pessoa encontrou o que procurava; [fechar_pedido_radar, linhas 475 a 489](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:475) grava somente motivo, status e horário. A comunicação ao lojista já foi corrigida para “escolheu sua proposta para conversar” em [20261109195657, linhas 21 a 30](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109195657_notificacoes_confiaveis.sql:21); esse avanço deve ser preservado.

**Consequência no piloto:** interpretar esses eventos como venda produziria uma conclusão mais forte que a evidência disponível. A pessoa pode abrir contato e desistir, resolver fora da plataforma ou não completar a compra. Esses exemplos são hipóteses plausíveis, sem frequência demonstrada.

**Menor ação e requisito:** usar uma ficha curta do piloto que separe contato aberto, oferta escolhida para conversar, negócio relatado por uma parte e negócio confirmado pelas duas partes. Registrar se a resposta ajudou, mesmo quando não houve compra. A confirmação pode ser manual no grupo convidado; não é necessário criar agora um sistema de reputação ou checkout. Nos textos de interface, manter clara a finalidade de conversar.

**Aceite:** abrir WhatsApp e fechar a aba não aumenta o número de negócios confirmados; “Já resolvi” sozinho permanece resolução relatada pelo comprador. O resultado confirmado tem evidência de ambas as partes e origem atribuída. Falta de confirmação continua desconhecida.

**Contra-argumento:** o produto pode ser um classificado que termina na abertura do contato. Essa escolha de produto é compatível com a implementação. A hipótese autorizada do piloto, porém, pede evidências sobre negociações reais e respostas úteis; uma ficha manual é suficiente para cumprir esse objetivo sem ampliar a plataforma.

## Acessibilidade e carga de uso observadas

Há bases positivas comprovadas: rótulos vinculados aos campos, erros escritos e `aria-describedby` em `src/components/ui/campo.tsx:33-78`; estado pressionado nos chips em `src/components/ui/chip.tsx:37-40`; diálogo nativo de proposta com rótulo e manejo de foco em `src/components/radar/folha-propor.tsx:51-63,205-224`; confirmação de encerramento com foco inicial em “Manter pedido” em `src/components/radar/acoes-pedido.tsx:17-21,40-48`; navegação móvel com nomes e estado atual em `src/components/ui/barra-inferior.tsx:25-49`.

Isso não comprova o uso com leitor de tela, ampliação ou aparelho físico. Para os percursos dos achados, o aceite deve incluir navegar por teclado, reconhecer o erro, recuperar a tarefa e voltar do WhatsApp em um dispositivo usado pelos convidados. O QA histórico relata dimensões móveis de Chromium e explicita que isso não equivale a Safari ou celular físico. Não atribuo um defeito de acessibilidade sem demonstração adicional.

## Evidência, leituras e limites

**Código atual:** conclusões acima derivam da árvore no HEAD registrado. As definições de `escolher_proposta`, `fechar_pedido_radar`, `radar_aviso` e `notificar` foram procuradas em todas as migrações; os trechos citados são as definições cumulativas pertinentes. A migração final `20261110020853_moderacao_aluguel.sql` foi pesquisada por funções e não redefine essas rotinas. Não afirmo que todas as migrações foram lidas integralmente.

**QA histórico:** `QA-RADAR` registra a base `58ae93075ce1fad309846750ebb22d71d3280c2a` e testes com fronteiras simuladas, sem negociação comercial real. `QA-WHATSAPP`, linhas 21 a 29, relata um código recebido e confirmado pelo usuário e um corte no SHA `7f1ce1072b32ffae71cdc0763bf34bcdc2c1d0fb`. `QA-MEU-PLANO` relata sandbox e fixtures; seu trecho sobre provedor de confirmação ainda pendente foi superado pelo código e pelo QA específico de WhatsApp. Os relatos foram tratados como históricos, sem reexecução.

**Hipóteses:** risco de abandono, expectativa de aviso externo, frequência de pedidos sem resposta e interpretação de “resolvido” precisam ser observados com os convidados. Não foram convertidos em números nem resultados.

**Produção não verificada:** entrega atual de códigos, contato comercial das lojas, avisos percebidos, serviços configurados, tecnologias assistivas e negociação entre pessoas. Não executei build, testes, banco, navegador ou serviços externos. Não consultei memória, conversas, relatório antigo de riscos, `concepts_brief.md`, `verificacao-atual.md` ou pareceres de outras lentes.

As dez leituras iniciais obrigatórias foram integrais. Identificadores SHA-256, com os primeiros 12 caracteres:

| Fonte | Identificador |
|---|---|
| Persona `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/comprehension.md` | `974f4972f717`; “Comprehension Goldfish” |
| `docs/brainstorm-piloto-2026-11-09/hipotese.md` | `300e8605e105`; “piloto acompanhado do OL-AQUI” |
| `README.md` | `eefff69f2382`; “Shopping digital e classificados regionais” |
| `package.json` | `1b49959e4628`; pacote `olaki` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | `85a98209cf49`; “Segurança e fluxo do Radar” |
| `docs/QA-RADAR-2026-11-09.md` | `4adf95b28cf2`; “pedido, proposta e contato” |
| `docs/QA-WHATSAPP-2026-11-09.md` | `79269508ee0c`; “Confirmação do WhatsApp” |
| `docs/QA-MEU-PLANO-2026-11-09.md` | `66b5265a9eb8`; “assinatura e pagamentos” |
| `docs/etapa5/relatorios.md` | `610fed336460`; “mensagens automáticas” |
| `docs/etapa4/paginas.md` | `fa04d3fac0bd`; “Ajuda, termos e privacidade” |

Leituras adicionais de código, sob `/home/raniel-linux/workspace/OLAQUI`:

| Escopo efetivamente lido | Arquivos e trechos identificadores |
|---|---|
| Integral, entrada e confirmação | `src/app/entrar/perfil/page.tsx` (reexportação); `src/app/completar-perfil/page.tsx` (`destinoSeguro`); `src/app/confirmar-celular/page.tsx` e `actions.ts` (`ConfirmarCelular`, `solicitarCodigo`); `src/components/conta/confirmar-whatsapp.tsx` (`DesafioSeguranca`); `src/app/(conta)/layout.tsx`; `src/middleware.ts` |
| Integral, pedido e ofertas | `src/app/radar/layout.tsx`, `page.tsx`, `pedir/page.tsx`, `pedido/[id]/page.tsx`; `src/components/radar/form-pedido.tsx`, `propostas-recebidas.tsx`, `acoes-pedido.tsx`, `explicacao-radar.tsx`, `atualizar-radar.tsx`, `botao-enviar.tsx` |
| Integral, cadastro de loja e componentes | `src/app/(conta)/quero-vender/page.tsx`, `loja/page.tsx`; `src/components/anunciar/form-loja.tsx` (`Sua loja está pronta!`); `src/components/ui/campo.tsx`, `chip.tsx`, `barra-inferior.tsx`; `src/components/conta/sino-avisos.tsx`; `src/app/(publico)/anuncio/[idslug]/barra-contato.tsx` |
| Trechos de fluxo e apresentação | `src/app/radar/[id]/page.tsx:1-97,106-189`; `src/components/radar/radar-de-negocios.tsx:1-180`; `src/components/radar/folha-propor.tsx:44-96,163-234,256-334`; `src/app/radar/actions.ts:125-167`; `src/lib/tipos-relatorios.ts:1-55` |
| Trechos SQL | `20261110014434_whatsapp_obrigatorio.sql:1-37,110-215`; `20261108020000_radar_completo.sql:162-183,464-502`; `20261108060000_mensagens_relatorios.sql:277-345`; `20261109195657_notificacoes_confiaveis.sql` integral |
| Pesquisa de símbolos, sem leitura integral adicional | Definições das funções citadas em `supabase/migrations`; referências a confirmação em `src/lib/perfil.ts`, `src/lib/dados/radar.ts` e páginas de dados; referências a canais/notificações em `src`; suporte em `src/app/(publico)/ajuda/page.tsx`; selo de comprador em tipos, telas e migrações. Essas buscas orientaram a leitura e não foram usadas para declarar revisão integral desses arquivos. |

Recomendação: dar prioridade à continuidade depois da confirmação e ao protocolo de retorno e resultado. O piloto acompanhado pode validar as demais fricções com ações pequenas, mantendo registrado o que a equipe precisou fazer para cada participante chegar ao fim.
