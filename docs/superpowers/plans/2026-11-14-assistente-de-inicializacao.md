# Plano de implementação do assistente de inicialização

> Para executar, use `superpowers:executing-plans` nesta sessão ou `superpowers:subagent-driven-development` para delegar cada tarefa.

**Objetivo**. Levar a pessoa, por botões e pelas telas existentes, do primeiro acesso à listagem regional, ao envio de um anúncio ou ao envio de um pedido no Radar.

**Arquitetura**. A página inicial mostra o convite e a retomada. Uma rota interna curta, `/assistente`, resolve login, perfil, WhatsApp e a próxima ação com base na conta atual. O navegador guarda o último objetivo e o ponto de retomada. Os formulários e as ações existentes continuam responsáveis pelas gravações e permissões.

**Tecnologia**. Next.js, React, TypeScript, Clerk, Supabase e o executor de testes do Node já configurado no OLAKI.

**Desenho**. [Assistente de inicialização](../specs/2026-11-14-assistente-de-inicializacao-design.md).

## Restrições

- Entrada na página inicial com **Começar**, **Agora não**, **Preciso de ajuda** e **Continuar** nas situações definidas no desenho.
- Quatro objetivos. **Explorar a região**, **Vender um item**, **Vender pela minha loja** e **Procurar algo**.
- Formulários existentes, retomada no mesmo navegador e cópia baseada no estado real do anúncio, pedido ou verificação.
- Login e WhatsApp devolvem à ação original. Toda leitura de rascunho e ação de publicação passa pelas regras da conta atual.
- A primeira versão reaproveita o checkout e as regras de limite existentes. Se houver um anúncio aguardando pagamento, a orientação mantém o caminho pendente e leva à tela que informa esse status.

## Pontos de revisão

| Caso | Resultado esperado | Tarefa |
| --- | --- | --- |
| Segundo usuário no mesmo navegador | O progresso da primeira conta fica indisponível para a segunda. | 1 |
| Destino inválido ou retorno interrompido | Nenhum endereço externo é seguido. Retomar permite repetir a etapa pendente. | 1 e 2 |
| Rascunho excluído ou publicado em outra aba | O caminho é recalculado com a lista atual de rascunhos. | 3 |
| Uma aba conclui um objetivo antigo após a troca de caminho | O objetivo mais recente continua disponível em **Continuar**. | 1, 3 e 4 |
| Pedido em análise ou envio recusado | A análise aparece como tal. Envio recusado mantém o caminho pendente. | 4 |

## Tarefa 1. Convite e progresso no mesmo navegador

**Arquivos**. Criar `src/lib/assistente.ts` e `src/components/assistente/entrada.tsx`. Integrar em `src/app/(publico)/page.tsx`. Testar em `tests/assistente.test.cjs` e `tests/fluxo.test.cjs`.

- [ ] Adicionar testes para troca de conta, retomada após leitura do armazenamento, progresso com formato inválido e conclusão antiga após começar outro objetivo. Usar o carregador de TypeScript dos testes existentes.
- [ ] Definir `ObjetivoAssistente = "explorar" | "item" | "loja" | "procurar"` e `ProgressoAssistente` com `tentativa`, `dono`, `objetivo` e os campos opcionais `radar` (`q` mais `FiltrosPedido`) ou `anuncio` (`id` mais `SlugPasso`). Exportar `lerProgresso(raw: string | null, dono: string | null): ProgressoAssistente | null` e `podeConcluir(progresso: ProgressoAssistente | null, tentativa: string): boolean`. Validar os dados do armazenamento e manter chaves separadas por conta e visitante. Vincular progresso de visitante à conta apenas no retorno da tentativa que iniciou o login.
- [ ] Implementar `EntradaAssistente({ dono }: { dono: string | null })` usando o `userId` que a página inicial já resolve. Persistir o estado do convite e a tentativa atual no navegador. A troca de objetivo substitui a tentativa. Se o armazenamento falhar, os botões ainda abrem os destinos. **Explorar a região** abre a listagem regional e conclui a tentativa. No celular e no computador, manter a navegação disponível antes de a pessoa escolher.
- [ ] Rodar `node --test tests/assistente.test.cjs tests/fluxo.test.cjs`. Conferir **Agora não**, **Preciso de ajuda**, **Continuar** e a exploração em sessão anônima.

## Tarefa 2. Retorno após login, perfil e WhatsApp

**Arquivos**. Criar `src/app/assistente/page.tsx` e `src/components/assistente/retomar.tsx`. Reusar `src/lib/caminho-seguro.ts` e o retorno de `src/app/entrar/[[...entrar]]/page.tsx`, `src/app/completar-perfil/page.tsx` e `src/app/confirmar-celular/page.tsx`.

- [ ] Testar que a rota rejeita objetivo ou identificador inválido e não segue um destino fornecido pelo navegador. Testar que o mesmo endereço curto da tentativa retorna após as etapas obrigatórias.
- [ ] Exportar `linkAssistente(objetivo: ObjetivoAssistente, tentativa: string): string` em `src/lib/assistente.ts`. Gerar `/assistente` com `objetivo` e `tentativa` e validar ambos na chegada. Ao seguir para formulário existente, manter `assistente=<tentativa>` nas transições guiadas que anotam progresso ou confirmam conclusão. Passar o endereço curto a `redirect_url` ou `destino` com as regras das telas atuais. Recuperar os dados da tentativa no navegador após o retorno, evitando transportar o texto e os filtros do Radar por redirecionamentos encadeados.
- [ ] Fazer a página consultar a conta apenas nas ações que exigem login e encaminhar para os formulários após validar o contexto. Uma falha de leitura oferece nova tentativa. Uma mudança na situação da conta recalcula o próximo passo. As entradas diretas mantêm as regras atuais.
- [ ] Rodar `node --test tests/assistente.test.cjs`. Exercitar em navegador uma conta nova e uma conta com WhatsApp pendente. Verificar que completar o cadastro ou confirmar o número devolve à tentativa iniciada.

## Tarefa 3. Primeiro anúncio e cadastro da loja

**Arquivos**. Integrar em `src/app/assistente/page.tsx`, `src/app/(conta)/anunciar/page.tsx`, `src/app/(conta)/anunciar/_carregar.ts`, `src/app/(conta)/anunciar/actions.ts`, nas seis páginas que usam `carregarPasso` e em `src/app/(conta)/anunciar/pronto/page.tsx`. Reusar `src/app/(conta)/quero-vender/actions.ts`, `src/app/(conta)/quero-vender/loja/page.tsx`, `src/components/anunciar/form-loja.tsx`, `src/components/anunciar/passos.ts` e a consulta de verificação já usada em **Minha loja**.

- [ ] Cobrir conta nova, vendedor pessoa física, loja existente, vários rascunhos, rascunho removido e verificação pendente. Assegurar que **Vender um item** em conta de loja exibe o nome da loja e **Anunciar pela loja** antes do anúncio.
- [ ] Levar a conta nova à ação existente de pessoa física ou de loja conforme a escolha. Usar o formulário existente para converter pessoa física em loja. Após o cadastro, exibir a ação que leva ao anúncio. Para loja existente, pular o cadastro. Em caso de suspensão ou limite, usar a orientação e as ações disponíveis no fluxo atual.
- [ ] Em **Anunciar**, oferecer **Continuar anúncio** e **Criar novo anúncio** quando houver rascunho. Com vários rascunhos, permitir selecionar. Usar o identificador e a etapa da tentativa se ainda corresponderem ao rascunho da conta. Para um rascunho escolhido sem etapa registrada na tentativa, usar o primeiro passo obrigatório incompleto consultando os campos persistidos. A consulta do rascunho e a autorização continuam no servidor.
- [ ] Nas etapas de anúncio, registrar a etapa após abrir com sucesso os dados autorizados do rascunho. Associar o progresso à tentativa que iniciou ou escolheu o rascunho para que abas antigas não sobrescrevam o atual. Em **Salvar e sair**, manter a última etapa. Na página de conclusão, encerrar apenas a tentativa correspondente ao anúncio confirmado pelo servidor. Mostrar **Meus anúncios** e, quando a loja estiver com verificação pendente, **Acompanhar verificação**.
- [ ] Rodar `node --test tests/assistente.test.cjs tests/loja.test.cjs tests/minha-loja.test.cjs tests/meus-anuncios.test.cjs tests/publicar-anuncio.test.cjs`. Conferir envio ativo, análise e checkout pendente em ambiente de teste.

## Tarefa 4. Busca e Radar

**Arquivos**. Integrar em `src/app/assistente/page.tsx`, `src/components/busca/listagem.tsx`, `src/app/radar/pedir/page.tsx`, `src/components/radar/form-pedido.tsx` e `src/app/radar/pedido/[id]/page.tsx`. Reusar `linkPedirRadar` de `src/lib/rotas.ts`.

- [ ] Testar preenchimento de termo, cidade, categoria e faixas de preço antes e depois da confirmação do WhatsApp. Cobrir pedido aberto, pedido em análise e falha de envio.
- [ ] Apresentar **Buscar anúncios** e **Publicar pedido no Radar**. Abrir a busca pública e concluir esse caminho. Quando a pessoa escolher publicar a partir da busca, iniciar a tentativa do Radar com os campos aceitos por `linkPedirRadar` e manter o atalho existente em buscas sem resultados.
- [ ] Usar o contexto da tentativa para reconstruir o destino do Radar após login e WhatsApp. Preservar os parâmetros aceitos quando o Radar encaminhar à confirmação do WhatsApp. Reaproveitar a validação da região e a escolha de cidade do formulário.
- [ ] Na confirmação do pedido, encerrar a tentativa correspondente quando o envio tiver sido confirmado e exibir o estado devolvido pelo servidor. Reaproveitar **Meus pedidos**. Manter a tentativa em caso de erro no envio. Para conclusão por outra aba ou ação iniciada anteriormente, conferir o identificador antes de limpar o progresso.
- [ ] Rodar `node --test tests/assistente.test.cjs tests/radar.test.cjs tests/fluxo.test.cjs`. Conferir no navegador com o título e a cidade preenchidos antes de entrar.

## Verificação da entrega

- [ ] Rodar `npm run typecheck`, `npm run lint` e `npm test`.
- [ ] Validar em navegador os quatro caminhos dos critérios de aceite. Incluir primeira visita anônima, retomada no mesmo navegador, troca de objetivo, troca de conta, rascunho existente, anúncio em análise e pedido no Radar depois de confirmar o WhatsApp.
- [ ] Revisar os arquivos tocados e separar as alterações da implementação das mudanças locais já presentes. Quando organizar commits por tarefa, incluir somente as mudanças da respectiva tarefa.
