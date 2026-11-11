# Clareza do caminho de anunciar e do Radar, e link "Procuro algo parecido"

*   **Author:** Raniel Levi Lemos Lima
*   **Status:** Em revisão
*   **Date:** 2026-11-10

--------------------------------------------------------------------------------

## Overview

O OLAKI ainda não está no ar. Nos testes, as pessoas travaram no botão de anunciar e não entenderam o que é o Radar.

Este desenho cobre duas etapas do caminho curto escolhido no `concepts_brief.md`:

1.  **Etapa 3, palavras e estrutura.** Corrigir os pontos do caminho de anunciar e da tela do Radar que desviam ou confundem a pessoa.
2.  **Etapa 5, link "Procuro algo parecido".** Na página de um anúncio, um link que abre o pedido do Radar já preenchido, usando o Radar que já existe.

Nenhuma tabela nova é criada. O perfil de desejos, o botão no card e a tela de desejos para lojista ficam fora deste desenho.

**Limite deste documento.** Os defeitos descritos aqui foram lidos no código por revisores. Nenhum foi reproduzido no site ainda. O primeiro passo da implementação é reproduzir cada um; o que não se confirmar sai do plano.

## The Problem

**1. Quem toca em "Anunciar" é desviado antes de chegar ao anúncio.**

*   Uma pessoa nova passa por cerca de 5 telas antes da primeira foto: login, código do WhatsApp, termos, "Como você quer vender?" e uma introdução.
*   Depois de confirmar o WhatsApp, ela cai em "editar meus dados", não no anúncio (`src/app/(conta)/layout.tsx:20`, `src/app/confirmar-celular/page.tsx:22`). Ela precisa achar o botão "Anunciar" de novo.
*   A introdução promete 3 passos e o cabeçalho mostra "Passo N de 6" (`src/app/(conta)/anunciar/page.tsx:76-78`, `src/components/anunciar/cabecalho-passo.tsx:54`).
*   **Descartado ao ler o código:** os revisores apontaram que "Salvar e sair" na revisão não salva. A tela de revisão não tem campos para salvar, e cada passo anterior já grava o rascunho (`src/components/anunciar/cabecalho-passo.tsx:5-7`, `src/app/(conta)/anunciar/page.tsx`). Nada se perde. Não entra no plano.

**2. O Radar não se explica e mostra ao comprador a tela feita para lojista.**

*   No menu aparece só a palavra "Radar". A explicação em 3 passos só aparece depois do toque, e só para quem não entrou na conta.
*   O nome muda: "Radar", "Radar de Negócios", "Pedir no Radar".
*   A mesma coisa tem três nomes: "ofertas", "propostas" e "contatos" (`src/components/radar/explicacao-radar.tsx:7-8`).
*   Quem não é lojista também vê a aba "Pedidos na região", com "Exclusivo para lojistas assinantes" e "Desbloquear e Propor Produto" (`src/app/radar/page.tsx:60`, `src/components/radar/radar-de-negocios.tsx:105,211,242`).

**3. Quem está olhando um anúncio não tem como dizer "quero algo assim, mas não este".**

*   Hoje as saídas são chamar o vendedor ou salvar nos favoritos.
*   O link que abre o pedido do Radar preenchido já existe (`linkPedirRadar` em `src/lib/rotas.ts:44-51`). Ele é usado na busca vazia e em anúncio fora do ar, mas não na página de um anúncio no ar.

**O que este desenho não resolve.** A queixa de "visual estranho" e de falta de criatividade no estilo minimalista fica para um desenho próprio. Motivo: ainda não há referência visual escolhida nem nome de marca fechado, e uma reforma visual feita antes disso pode ter de ser refeita.

## Goals

*   Quem toca em "Anunciar" sem conta, cria a conta e confirma o WhatsApp, chega à tela de vender sem tocar em "Anunciar" outra vez.
*   O número de passos anunciado na introdução é o mesmo mostrado no cabeçalho.
*   A aba "Pedidos na região" só aparece para quem vende (loja ou pessoa física) e tem plano com Radar. Os demais não veem a aba, nem texto ou botão dirigido a lojista assinante.
*   O Radar tem um nome só em todo o site e uma frase que diz o que ele faz no primeiro lugar em que a pessoa o encontra.
*   Cada coisa do Radar tem uma palavra só do lado do comprador (hoje: ofertas, propostas, contatos).
*   Na página de um anúncio no ar existe um link que abre o pedido do Radar preenchido com o que o anúncio mostra.
*   Antes de enviar um pedido criado por esse link, a pessoa lê, em uma frase, se o WhatsApp dela será mostrado às lojas.
*   Nenhuma tabela nova no banco e nenhum custo mensal novo.
*   Medida de sucesso: repetir o teste de 5 pessoas de `docs/USABILIDADE.md:80-87`. Alvo já escrito no projeto: publicar um anúncio em menos de 2 minutos (`docs/USABILIDADE.md:92-96`), e a pessoa explicar com as próprias palavras para que serve o Radar.

## Non-Goals

*   Tabela de desejos, página "perfil do Radar" e botão de desejo no card do anúncio.
*   Tela para o lojista navegar por desejos, e qualquer aviso de desejo.
*   Reforma visual: letras, cores, superfícies, página inicial. Fica para um desenho próprio.
*   Mudar as regras do Radar no banco: limite de 10 pedidos abertos, validade de 15 dias, WhatsApp confirmado obrigatório, o que o banco entrega a cada conta. A aba "Pedidos na região" muda só na tela (decisão do dono em 10/11/2026).
*   Bloquear no banco a lista da região para quem não paga. **Limite conhecido:** uma conta logada que saiba consultar o banco direto continua lendo título, cidade, faixa de preço e urgência dos pedidos da região. Fica para antes do lançamento.
*   Avisos por WhatsApp, e-mail ou push.
*   Uso de IA para comparar pedido com anúncio.
*   Reduzir o número de telas do cadastro (login, código, termos). Este desenho corrige o desvio e as promessas erradas, não a quantidade de telas.
*   Nome da marca, domínio, Clerk de produção e pagamento real.

## Open Questions

*   **Onde os testadores travaram no "Anunciar"**: antes de tocar (não acharam o botão) ou depois (se perderam nas telas seguintes)? Este desenho supõe "depois". Se foi "antes", o item 1 do problema muda.
*   **As palavras finais** para o nome do Radar, para "pedido" e para "oferta/proposta/contato". O `concepts_brief.md` pede que venham das palavras dos testadores. Ainda não há registro escrito das sessões.
*   **O texto do link** na página do anúncio. Candidatas do resumo: "Procuro algo assim" e "Quero ofertas de parecidos". "Me avise" foi rejeitada por um revisor.
*   **Teste grátis conta como plano pago?** Hoje o site trata quem está no teste grátis como quem tem acesso ao Radar. O plano técnico mantém isso. Se "apenas pago" exclui o teste grátis, a regra muda.
*   **O que é o "selo" do vendedor.** Hoje existem dois: "Loja Verificada", dado pelo painel só a lojas, e o de negociador. Pessoa física não recebe o primeiro. O plano técnico não exige selo para ver a aba; exige vitrine e plano.
*   **Aviso de plano para quem vende sem plano.** O plano técnico troca o cartão borrado por uma linha com link para a página de planos, só para quem já vende. Alternativa: não mostrar nada.
*   **Modo de contato do pedido criado pelo link.** O plano técnico mantém o padrão do formulário: o WhatsApp do comprador aparece para a loja que faz proposta. O outro modo esconde o número, mas exige prazo de no máximo 168 horas.
*   **Anúncio com título curto.** O pedido do Radar exige título de 8 a 120 letras; o anúncio aceita 5. O plano técnico deixa o formulário pedir o complemento.
*   **Anúncio de outra região.** O plano técnico usa a cidade de quem pede, não a do anúncio.
*   **Migrações em produção.** Nenhum documento confirma que `20261109032907_seguranca_fluxo_radar` está aplicada. Sem ela, criar pedido no Radar falha.
*   **Quais defeitos se confirmam** ao reproduzir no site.

## Critical User Journeys (CUJs)

### CUJ 1: Pessoa nova anuncia pela primeira vez

*   **Given**: Uma pessoa sem conta, no celular, na página inicial.
*   **When**: Toca em "Anunciar", cria a conta, confirma o WhatsApp por código e aceita os termos.
*   **Then**: Chega à tela "Como você quer vender?" sem passar por "editar meus dados". A introdução e o cabeçalho mostram o mesmo número de passos.

### CUJ 2: Comprador sem loja abre o Radar

*   **Given**: Uma pessoa com conta, sem loja e sem plano.
*   **When**: Toca em "Radar" no menu.
*   **Then**: Lê em uma frase o que o Radar faz e vê os próprios pedidos e o botão para pedir. Não vê a aba "Pedidos na região", nem "Exclusivo para lojistas assinantes", nem "Desbloquear e Propor Produto".

### CUJ 3: Comprador pede algo parecido a partir de um anúncio

*   **Given**: Uma pessoa com conta e WhatsApp confirmado, na página de um anúncio no ar.
*   **When**: Toca no link "Procuro algo parecido".
*   **Then**: Abre o formulário do pedido do Radar com o texto do anúncio já preenchido. Antes de enviar, ela lê se o WhatsApp dela será mostrado às lojas. Ao enviar, o pedido aparece em "Meus pedidos".

### CUJ 4: Visitante sem conta toca no link

*   **Given**: Uma pessoa sem conta, na página de um anúncio no ar.
*   **When**: Toca no link "Procuro algo parecido".
*   **Then**: É levada ao login e, depois de entrar e confirmar o WhatsApp, volta ao formulário preenchido, não à página inicial nem a "editar meus dados".

### CUJ 5: Vendedor com plano abre o Radar

*   **Given**: Uma loja ou pessoa física que vende e tem plano com Radar.
*   **When**: Toca em "Radar" no menu.
*   **Then**: Vê as abas "Pedidos na região", "Meus pedidos" e "Minhas propostas", como hoje.

### CUJ 6: Vendedor sem plano abre o Radar

*   **Given**: Uma pessoa que já publicou um anúncio e não tem plano com Radar.
*   **When**: Toca em "Radar" no menu, ou abre o endereço da aba da região direto.
*   **Then**: Cai em "Meus pedidos". Não vê a aba "Pedidos na região" nem o cartão borrado. Vê, no máximo, uma linha com link para a página de planos.

## Technical Plan

Nenhuma mudança no banco, nenhuma dependência nova, nenhum custo novo. Tudo é mudança de tela e de redirecionamento. Para desfazer, basta reverter o commit.

**Passo 0. Reproduzir antes de mexer.** Abrir o site local no tamanho de celular e refazer os CUJs 1, 2 e 4 como estão hoje. O que não se confirmar sai do plano.

### A. Voltar ao lugar certo depois de confirmar o WhatsApp

Hoje a área da conta manda para `/confirmar-celular` sem dizer de onde a pessoa veio, porque esse arquivo não tem acesso ao endereço pedido. A tela de confirmação, sem destino, manda para "editar meus dados".

*   O `middleware` passa a anotar o endereço pedido (caminho e parâmetros) em um cabeçalho interno da requisição. O valor é sempre sobrescrito pelo servidor; o que vier do navegador com esse nome é descartado.
*   O layout da conta lê esse cabeçalho e redireciona para `/confirmar-celular?destino=<endereço>`.
*   A tela de confirmação já valida o destino com `caminhoInterno` (só aceita endereço do próprio site). Ela já aceita destino com parâmetros (`src/lib/caminho-seguro.ts`). Nada muda nela.
*   Na tela de pedir no Radar, o botão "Confirmar meu celular" hoje manda `destino=/radar/pedir` sem os parâmetros de preenchimento (`src/app/radar/pedir/page.tsx:54`). Passa a levar os parâmetros, senão o CUJ 4 perde o texto do anúncio.

Depois de confirmar, a pessoa volta para `/anunciar`, que já a leva a "Como você quer vender?" quando ela ainda não vende (`src/app/(conta)/anunciar/page.tsx:31`).

### B. Mesmo número de passos na introdução e no cabeçalho

A introdução deixa de numerar "1, 2, 3" e passa a dizer o total real, lido de `TOTAL_PASSOS` (hoje 6). Os três blocos de texto continuam como descrição, sem número. O cabeçalho "Passo N de 6" não muda.

### C. Aba "Pedidos na região" só para quem vende e tem plano

A regra fica em um só lugar, `src/app/radar/page.tsx`:

*   **Vê a aba:** tem vitrine (loja ou pessoa física) **e** `acessoRadar()` diz que tem acesso. Abas: "Pedidos na região", "Meus pedidos", "Minhas propostas". Abre na região, como hoje.
*   **Vende, sem plano:** "Meus pedidos" e "Minhas propostas". Abre em "Meus pedidos".
*   **Não vende:** só "Meus pedidos", sem barra de abas.
*   Quem abrir o endereço da aba da região sem poder vê-la cai em "Meus pedidos". Isso já é o comportamento do código para aba inválida.

Consequências:

*   A consulta de acesso passa a rodar em toda abertura do Radar, não só na aba da região. São duas consultas pequenas a mais por abertura.
*   O cartão borrado e a faixa "Esses clientes já querem comprar" deixam de ser alcançáveis e saem de `radar-de-negocios.tsx`. A página de planos já descreve o Radar.
*   Para quem vende sem plano, "Meus pedidos" ganha uma linha com link para a página de planos.
*   A tela de um pedido visto pela loja (`/radar/[id]`) não muda.
*   O banco continua entregando a lista a qualquer conta logada da região (ver Non-Goals).

### D. Um nome e uma palavra para cada coisa

Depende das palavras finais (Open Questions). Até lá, o plano usa: nome **Radar**; o que o comprador cria é **pedido**; o que a loja manda é **proposta**.

*   Títulos de página e de tela que dizem "Radar de Negócios" passam a dizer "Radar" nas telas do comprador. Páginas de planos e de cobrança ficam como estão, para não mexer em texto de venda sem necessidade.
*   A explicação em 3 passos troca "ofertas" e "contatos" por "propostas".
*   Quem está logado e ainda não pediu nada passa a ler, no estado vazio de "Meus pedidos", a frase que diz o que o Radar faz. Hoje só o visitante sem conta lê a explicação.
*   A palavra "Radar" no menu não muda; não cabe frase ali.

### E. Link "Procuro algo parecido" na página do anúncio

*   Aparece em anúncio no ar, para quem não é o dono, abaixo dos botões de contato.
*   Usa `linkPedirRadar` com o título do anúncio e a categoria. Não leva cidade nem preço: a cidade é a de quem pede, e o preço do anúncio não é o teto de quem procura outro.
*   Visitante sem conta: o endereço `/radar/pedir` já exige login, e o login devolve a pessoa ao mesmo endereço com os parâmetros. A conferir no navegador.
*   Aviso sobre o WhatsApp: conferido no código em 10/11/2026. A frase "As lojas que enviarem uma proposta poderão ver este número" só aparece para quem ainda não confirmou o celular (`src/components/radar/form-pedido.tsx:230-243`). Quem já confirmou lê apenas "As lojas mandam mensagem direto para o seu celular" (linha 200), que não diz que o número é mostrado. A descrição da opção "Podem me chamar no WhatsApp" passa a dizer isso para todos.
*   Não se grava de onde o pedido veio. Saber quantos pedidos nasceram do link exigiria coluna nova no banco, o que este desenho exclui.

### F. Ordem e conferência

Ordem: passo 0, depois A, B, C, E, e D por último, porque D espera as palavras.

Conferência de cada parte: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, e refazer no navegador, em tamanho de celular, os CUJs 1 a 6. A regra das abas ganha teste em `tests/radar.test.cjs`, um caso para cada tipo de conta (vende com plano, vende sem plano, não vende). Se algum teste atual depender da aba da região para todos, é ajustado.

## Alternatives Considered

### Do resumo de conceitos (`concepts_brief.md`)

| Opção | O que é | Situação | Motivo |
| --- | --- | --- | --- |
| A. Só palavras | Trocar as palavras do Radar do lado do comprador | **Adotada** (partes A a D do plano) | Sem mudança no banco; ataca a confusão relatada nos testes |
| B. Link "Procuro algo parecido" | Link na página do anúncio abre o pedido preenchido | **Adotada** (parte E) | Reusa o Radar que existe; quase sem código |
| C. Coração e uma pergunta depois | Após salvar: "Quer receber ofertas de parecidos?" | Rejeitada pelo autor | Fácil de não ver; o dono pediu um botão visível |
| D. Item guardado com alerta ao comprador | Tabela nova e privada; avisa quando surgir anúncio parecido | Adiada pelo autor | Tabela nova e trabalho de privacidade antes de haver uso |
| E. Lojista vê só totais | Painel "o que procuram na sua cidade" | Adiada pelo autor | Fica vazio com poucos usuários |
| F. Conceito como escrito | Lojista vê cada desejo e aborda o cliente | Adiada pelo autor | Maior custo e risco: ofertas, limites, bloqueio, moderação, textos de privacidade |
| G. Desejo como pedido do Radar | Guardar o desejo em `radar_pedidos` | Rejeitada pelo autor | Entrega o telefone, estoura o limite de 10 pedidos e enche as lojas de avisos |
| H. Marca no favorito | Uma marca no anúncio salvo | Rejeitada pelo autor | Some quando o anúncio é apagado; favorito e desejo são coisas diferentes |

### Diferenças em relação ao resumo de conceitos, mantidas pelo autor em 10/11/2026

*   **Coração no card.** O resumo juntava o link e um coração no card na etapa 5. Este desenho entrega só o link. Falha: quem está na lista de anúncios continua sem atalho para salvar.
*   **Palavras "pedido" e "proposta".** O resumo propunha "procura" e "oferta". Este desenho mantém as que o site já usa, até haver registro escrito dos testadores. Falha: se os testadores preferirem outras, a parte D é refeita.
*   **Ordem.** O resumo punha antes a conferência da base (testes e migrações de produção) e o teste de 5 pessoas. Este desenho começa por reproduzir os defeitos e deixa o teste de 5 pessoas para o fim. Falha: as correções saem sem prova escrita de onde as pessoas travaram, e a criação de pedido pode falhar em produção se a migração do Radar não estiver aplicada (ver Open Questions).

### Decididas neste desenho

**Quem vê "Pedidos na região": bloquear no banco ou só na tela.**

*   *Só na tela* — **adotada pelo autor em 10/11/2026.** Não mexe no banco e cabe no limite aprovado. Falha: conta logada que consulte o banco direto ainda lê título, cidade, faixa de preço e urgência.
*   *Bloquear no banco* — rejeitada pelo autor por enquanto. Protege de verdade, mas exige mudança em produção sem banco de testes separado nem caminho de volta, em função do Radar trocada três vezes em três dias. Pode ser feita depois, antes do lançamento.

**Como a área da conta descobre de onde a pessoa veio.**

*   *Cabeçalho interno anotado pelo `middleware`* — usada no plano. Um ponto só de mudança, vale para todas as telas da conta. Falha se o cabeçalho vindo do navegador não for sobrescrito; por isso o plano exige a sobrescrita e a tela de destino continua validando o endereço.
*   *Cada tela da conta faz a própria checagem do WhatsApp* — não usada. Mais de dez telas a alterar, e uma tela nova esquecida volta ao defeito.
*   *O `middleware` faz a checagem e o redirecionamento* — não usada. Obrigaria o `middleware` a consultar o banco em toda requisição.

**Como igualar o número de passos.**

*   *Mudar o texto da introdução para o total real* — usada no plano. Um arquivo, nenhuma mudança no fluxo.
*   *Agrupar o cabeçalho em 3 etapas* — não usada. Mexe na navegação dos 6 passos e nos endereços de rascunho, para corrigir uma frase.

**O que o link do anúncio leva para o pedido.**

*   *Título e categoria* — usada no plano.
*   *Título, categoria, cidade e preço* — não usada. A cidade do anúncio pode ser de outra região, e o preço do anúncio viraria teto de quem procura outro produto.

## Non-Functional Requirements

*   **Segurança.** O destino do redirecionamento só pode ser um endereço do próprio site. A validação existente (`caminhoInterno`) continua sendo a única porta. O cabeçalho interno nunca aceita valor vindo do navegador.
*   **Privacidade.** Nenhum dado novo é guardado. O aviso sobre o WhatsApp no pedido tem de estar visível antes do envio.
*   **Desempenho.** O Radar faz duas consultas pequenas a mais por abertura. Nenhuma outra tela fica mais lenta.
*   **Acessibilidade.** O link novo segue o padrão dos demais: alvo de toque de pelo menos 48 px e contorno de foco por teclado.
*   **Celular primeiro.** Toda conferência no navegador é feita em largura de celular.

## Future Improvements

*   Bloquear no banco a lista da região para quem não paga, antes do lançamento.
*   Perfil de desejos, botão no card e tela de desejos para lojista (etapa 8 do resumo), quando houver uso.
*   Reforma visual, em desenho próprio, depois de escolhida a referência.
*   Medir quantos pedidos nascem do link do anúncio.

## Detailed Implementation Plan

Uma mudança por commit, na ordem abaixo. Nenhum arquivo de `supabase/` é tocado.

**Código conferido em 10/11/2026**, no ramo `codex/atendimento-anunciantes`, depois dos PRs 40, 41 e 42. Os defeitos descritos continuam no código. Há trabalho em andamento nesse ramo, ainda sem commit, que altera `src/lib/rotas.ts`. A parte A também altera esse arquivo: implementar só depois de esse trabalho entrar na `main`, em ramo novo saído dela.

### Passo 0. Reproduzir

Nenhum arquivo muda. Subir o site local e refazer os CUJs 1, 2 e 4 em largura de celular. Anotar em `docs/USABILIDADE.md` o que se confirmou. Parte que não se confirmar é retirada deste plano antes de qualquer edição.

### Parte A. Voltar ao lugar certo

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/middleware.ts` | Anotar caminho e parâmetros da requisição em um cabeçalho interno, sempre sobrescrevendo o valor recebido | O layout da conta não tem acesso ao endereço pedido |
| `src/app/(conta)/layout.tsx` | Ler o cabeçalho e redirecionar para `/confirmar-celular?destino=<endereço>`; sem cabeçalho, manter o comportamento de hoje | Corrige a queda em "editar meus dados" |
| `src/app/radar/pedir/page.tsx` | O botão "Confirmar meu celular" passa a levar os parâmetros de preenchimento no destino | Sem isso o CUJ 4 chega ao formulário vazio |
| `src/lib/rotas.ts` | Função pequena que monta o endereço de confirmação com destino, usada nos dois pontos acima | Evita montar o mesmo endereço à mão em dois lugares |
| `tests/perfil.test.cjs` ou arquivo novo `tests/destino.test.cjs` | Casos: destino com parâmetros é mantido; destino de outro site é recusado; sem destino vai para "editar meus dados" | Trava o defeito e a regra de segurança |

`src/app/confirmar-celular/page.tsx` não muda.

### Parte B. Número de passos

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/(conta)/anunciar/page.tsx` | Tirar a numeração "1, 2, 3" dos três blocos e dizer o total lido de `TOTAL_PASSOS` | A introdução prometia 3 e o cabeçalho mostrava 6 |

`src/components/anunciar/cabecalho-passo.tsx` e `passos.ts` não mudam.

### Parte C. Aba "Pedidos na região"

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/radar/page.tsx` | Consultar `acessoRadar()` antes de montar as abas; aplicar a regra dos três tipos de conta; aba padrão "Meus pedidos" para quem não vê a região; não passar mais a lista de planos ao componente | Regra em um lugar só |
| `src/components/radar/radar-de-negocios.tsx` | Retirar a faixa de upgrade, o cartão borrado e o botão "Desbloquear e Propor Produto", e as propriedades que só eles usavam | Deixam de ser alcançáveis |
| `src/components/radar/listas-radar.tsx` | Em "Meus pedidos", para quem vende sem plano, uma linha com link para a página de planos | Substitui o cartão borrado |
| `tests/radar.test.cjs` | Um caso por tipo de conta: vende com plano, vende sem plano, não vende; e endereço da aba da região aberto sem direito | Trava a regra |

`src/app/radar/[id]/page.tsx` e `src/lib/dados/radar.ts` não mudam. `src/components/radar/abas-radar.tsx` também não: ele já esconde a barra quando há uma aba só (linha 13).

### Parte E. Link na página do anúncio

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/(publico)/anuncio/[idslug]/conteudo-anuncio.tsx` | Link abaixo dos botões de contato, só em anúncio no ar e para quem não é o dono, montado com `linkPedirRadar(título, { categoria })` | Dá a saída "quero algo assim, mas não este" |
| `src/components/radar/form-pedido.tsx` | A descrição da opção "Podem me chamar no WhatsApp" passa a dizer que as lojas que mandarem proposta veem o número | Hoje quem já confirmou o celular não lê esse aviso |
| `tests/anuncio.test.cjs` | Casos: link aparece em anúncio no ar para visitante; não aparece para o dono nem em anúncio fora do ar; leva título e categoria, sem cidade nem preço | Trava a regra |

`src/lib/rotas.ts` (`linkPedirRadar`) não muda nesta parte.

### Parte D. Nome e palavras (por último)

Só começa depois de fechadas as palavras finais. Com as provisórias:

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/radar/page.tsx` | Título da página e título da moldura: "Radar" | Um nome só |
| `src/components/radar/radar-de-negocios.tsx` | Título da tela: "Radar" | Um nome só |
| `src/components/radar/explicacao-radar.tsx` | Título "Radar"; "ofertas" e "contatos" viram "propostas" | Uma palavra por coisa |
| `src/components/radar/listas-radar.tsx` | Estado vazio de "Meus pedidos" ganha a frase que diz o que o Radar faz | Quem está logado hoje não lê explicação |
| `src/app/radar/pedir/page.tsx` | "mandam ofertas" vira "mandam propostas" | Uma palavra por coisa |
| `src/components/radar/form-pedido.tsx` | "Como quer receber as ofertas?" vira "Como quer receber as propostas?" | Uma palavra por coisa |

Não mudam: páginas de planos e de cobrança, `src/app/layout.tsx`, menu e barra inferior.

### Verification Plan

Depois de cada parte:

1.  `npm run lint`
2.  `npm run typecheck`
3.  `npm run test`
4.  `npm run build`
5.  No navegador, em largura de celular, refazer os CUJs da parte: A → CUJs 1 e 4; B → CUJ 1; C → CUJs 2, 5 e 6; E → CUJs 3 e 4; D → CUJ 2.

Checagens próprias:

*   **Parte A:** abrir `/confirmar-celular?destino=//outro-site.com` e conferir que não sai do site. Enviar uma requisição com o cabeçalho interno forjado e conferir que é ignorado.
*   **Parte C:** com uma conta sem plano, abrir o endereço da aba da região direto e conferir que cai em "Meus pedidos" e que o HTML não traz pedido de ninguém.
*   **Parte E:** anúncio com título de menos de 8 letras: o formulário abre e pede o complemento, sem erro de tela.

`npm run test:db` não é necessário: o banco não muda.

**Fim do trabalho:** repetir o teste de 5 pessoas de `docs/USABILIDADE.md:80-87` e registrar por escrito o resultado e as palavras que elas usaram.

**Regra de parada (do resumo de conceitos):** se os testadores não souberem explicar, com as próprias palavras, a diferença entre salvar um anúncio e pedir no Radar, nenhuma outra mudança no Radar é feita além deste desenho, e o perfil de desejos continua adiado.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
