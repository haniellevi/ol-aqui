# Clareza do caminho de anunciar e do Radar, e link "Procuro algo parecido"

*   **Author:** Raniel Levi Lemos Lima
*   **Status:** Revisado; aguardando decisões do dono
*   **Date:** 2026-11-10

--------------------------------------------------------------------------------

## Overview

O OLAKI é um site de classificados regional. Ainda não está no ar: só o dono e alguns testadores usam. Nos testes, as pessoas travaram no botão de anunciar e não entenderam o que é o Radar.

**O que é o Radar.** É o caminho inverso do anúncio. O comprador escreve um **pedido** dizendo o que procura. Quem vende na região e tem plano vê o pedido e manda uma **proposta**. O comprador escolhe com quem falar.

Este desenho faz cinco mudanças de tela, sem tocar no banco e sem custo novo:

*   **A.** Quem precisa confirmar o WhatsApp no meio do caminho não cai mais em "editar meus dados".
*   **B.** A introdução do anúncio e o topo da tela passam a dizer o mesmo número de passos.
*   **C.** A aba "Pedidos na região" do Radar só aparece para quem vende e tem plano.
*   **D.** O Radar passa a ter um nome e uma palavra para cada coisa.
*   **E.** A página de um anúncio ganha o link "Procuro algo parecido", que abre um pedido já preenchido.

**Limites deste documento.**

*   Os defeitos foram lidos no código. Nenhum foi reproduzido no site. O primeiro passo é reproduzir; o que não se confirmar sai.
*   Ele **não explica por que os testadores travaram no "Anunciar"**. Pela leitura do código, a pessoa nova chega ao anúncio sem desvio. A causa só aparece quando o dono perguntar a quem testou.

**Palavras usadas aqui.**

*   **Dono:** Raniel, que decide o produto. **Revisores:** leitores automáticos que leram o código ou este documento.
*   **Plano:** sempre a assinatura paga do site. As mudanças descritas aqui são "este desenho".
*   **Vitrine:** a página de vendedor de uma conta, criada quando a pessoa responde "Como você quer vender?", como loja ou pessoa física, antes do primeiro anúncio. **Quem vende:** quem tem vitrine.
*   **Cartão borrado:** na aba "Pedidos na região", o cartão de pedido mostrado a quem não tem plano, com nome e telefone do comprador desfocados, o texto "Exclusivo para lojistas assinantes" e o botão "Desbloquear e Propor Produto". Acima dele há uma faixa com o título "Esses clientes já querem comprar".
*   **Produção:** o site publicado e o banco ligado a ele.
*   **Termos técnicos.** `middleware`: trecho do site que roda antes de qualquer página abrir. Layout da conta: moldura comum às telas da conta. Etiqueta interna: dado que o servidor anexa ao pedido de página e que a pessoa não vê. Commit: cada mudança gravada no histórico do código. Migração: arquivo que altera o banco. CUJ: caminho do usuário do começo ao fim de uma tarefa.

**Origem.** O resumo de conceitos (`concepts_brief.md`, na raiz do repositório, ainda fora do controle de versão) listou nove etapas, de 0 a 8. O dono escolheu o caminho curto: corrigir a clareza (etapa 3) e testar um link para o Radar que já existe (etapa 5), deixando para depois o perfil de desejos (etapa 8).

## The Problem

**1. O caminho de "Anunciar" é longo, e em um caso desvia a pessoa.**

*   Uma pessoa nova passa por 5 telas antes da primeira foto: login, código do WhatsApp, termos, "Como você quer vender?" e uma introdução. Este desenho não reduz essas telas.
*   Pela leitura do código, a pessoa nova volta ao "Anunciar" depois do cadastro (`src/app/entrar/[[...entrar]]/page.tsx:30-35`, `src/app/completar-perfil/page.tsx:35-37`), e um teste automático confere isso (`tests/fluxo.test.cjs:180-192`).
*   **Caso que desvia:** a pessoa já está logada, não confirmou o WhatsApp e toca em "Anunciar". A área da conta manda para a confirmação sem dizer o destino, e ela cai em "editar meus dados" (`src/app/(conta)/layout.tsx:20`, `src/app/confirmar-celular/page.tsx:23-24`). Não se sabe se é raro: a tela do código oferece o botão "Explorar a vitrine" (`src/app/confirmar-celular/page.tsx:32-34`), e quem toca nele e depois vai em "Anunciar" cai aqui.
*   A introdução promete 3 passos e o topo da tela mostra "Passo N de 6" (`src/app/(conta)/anunciar/page.tsx:76-78`, `src/components/anunciar/cabecalho-passo.tsx:54`).

**2. O Radar mostra ao comprador a tela de quem vende e usa três palavras para a mesma coisa.**

*   Quem não vende também vê a aba "Pedidos na região", com o cartão borrado (`src/app/radar/page.tsx:65`, `src/components/radar/radar-de-negocios.tsx:121,225-238,260-267`).
*   O nome muda: "Radar", "Radar de Negócios".
*   A mesma coisa é chamada de "ofertas", "propostas" e "contatos" (`src/components/radar/explicacao-radar.tsx:7-8`).

**3. Quem olha um anúncio não tem como dizer "quero algo assim, mas não este".**

*   Hoje as saídas são chamar o vendedor ou salvar nos favoritos.
*   O link que abre um pedido preenchido já existe (`linkPedirRadar` em `src/lib/rotas.ts:49-56`), usado na busca vazia e em anúncio fora do ar, mas não em anúncio no ar.

**O que este desenho não resolve.**

*   Explicar o Radar antes de a pessoa tocar nele. No menu continua só a palavra "Radar".
*   O número de telas do cadastro.
*   A queixa de "visual estranho". Fica para um desenho próprio, depois de escolhida uma referência visual e fechado o nome da marca.

## Goals

*   Quem precisa confirmar o WhatsApp depois de tocar em "Anunciar" não cai em "editar meus dados". O caminho da pessoa nova, que funciona pela leitura do código, não pode quebrar.
*   A introdução do anúncio e o topo da tela dizem o mesmo número de passos.
*   Na tela principal do Radar, a aba "Pedidos na região" só aparece para quem vende e tem plano com Radar. Os demais não veem a aba nem o cartão borrado.
*   Nas telas do Radar há um único nome para ele e, do lado do comprador, uma única palavra para cada coisa.
*   Em um anúncio no ar existe um link que abre um pedido preenchido com o título e a categoria do anúncio.
*   Antes de enviar um pedido, a pessoa lê em uma frase que o WhatsApp dela será mostrado a quem mandar proposta.

**Restrição:** nenhuma tabela nova no banco e nenhum custo mensal novo.

### Medida de sucesso

Repetir o teste de `docs/USABILIDADE.md:80-87`: cinco pessoas da região, no celular delas, 20 minutos cada, tarefas sem ajuda (achar um produto, anunciar um, pedir um no Radar). Este desenho acrescenta uma quarta tarefa: "Você gostou deste anúncio, mas quer outro parecido. O que você faz?".

1.  Ninguém cai em "editar meus dados" no meio do caminho.
2.  Ninguém pergunta se são 3 ou 6 passos.
3.  Pelo menos N das 5 acham e usam o link na quarta tarefa. O dono define N antes do teste.

Só observação, sem alvo: no fim, perguntar a cada pessoa para que serve o Radar e qual a diferença entre salvar um anúncio e pedir no Radar. Este desenho muda pouco nisso, mas a resposta decide o que vem depois (regra de parada, no fim do documento).

Fora da medida: publicar em menos de 2 minutos (`docs/USABILIDADE.md:92-96`), porque este desenho não reduz telas.

## Non-Goals

*   Perfil de desejos: uma lista em que a pessoa guardaria o que procura sem publicar um pedido. Inclui tabela nova, botão no card do anúncio e tela para quem vende navegar por desejos. É diferente de favorito, que é um anúncio salvo.
*   Reforma visual: letras, cores, superfícies, página inicial.
*   Mudar as regras do Radar no banco: limite de 10 pedidos abertos, validade de 15 dias, WhatsApp confirmado obrigatório, o que o banco entrega a cada conta.
*   Avisos por WhatsApp, e-mail ou aviso na tela do celular.
*   Uso de IA para comparar pedido com anúncio.
*   Reduzir o número de telas do cadastro.
*   Nome da marca, domínio, login de produção e pagamento real.
*   Contar em números o uso do link (ver parte E).

## Open Questions

### O que falta o dono decidir

| # | Decisão | O que ela trava | Onde estão as opções |
| --- | --- | --- | --- |
| 1 | Perguntar aos testadores: travou antes de tocar em "Anunciar" ou nas telas depois? Saiu da tela do código do WhatsApp antes de confirmar? Caiu em "editar meus dados"? | Parte A | "Quanto fazer na parte A" |
| 2 | Dizer "6 passos" na introdução ou agrupar o topo da tela em 3 etapas | Parte B | "Como igualar o número de passos" |
| 3 | Texto do link, lugar do link (inclusive no celular) e modo de contato do pedido | Parte E (trocar depois é refazer a mesma tela) | Três blocos em Alternatives Considered |
| 4 | Conferir no painel do Supabase se a migração `20261109032907_seguranca_fluxo_radar` está aplicada em produção | Publicação da parte E. Sem ela, criar pedido falha | — |
| 5 | Quantas das 5 pessoas precisam usar o link para o teste contar | Medida de sucesso | — |
| 6 | As palavras finais do Radar, a partir do que os testadores disseram | Parte D | — |
| 7 | O que mostrar a quem vende sem plano | Um detalhe da parte C | "O que mostrar a quem vende sem plano" |
| 8 | Aprovar ou trocar as frases novas, que estão escritas como provisórias na lista de arquivos | Partes B, C e E | "Frases novas" no fim deste documento |

### A conferir, sem decisão

*   **Plano grátis de pessoa física dá acesso ao Radar?** Vale a mesma marca do item abaixo, e ela existe também no plano grátis de pessoa física (`supabase/migrations/20261108010000_cobranca_planos.sql:180-190`). Se estiver ligada nele, quem não paga vê a aba, o que contraria "apenas pago acessa". O dono olha no painel.

*   **Teste grátis dá acesso ao Radar?** O acesso vem de uma marca "acesso ao Radar" no plano em vigor (`supabase/migrations/20261107010100_painel_admin.sql:168-175`). O teste grátis dá acesso se o plano de teste tiver essa marca ligada. O dono olha no painel. Se a regra "apenas pago acessa" excluir o teste grátis, basta desligar a marca; este desenho não muda.
*   **Selo.** Ao decidir quem vê a aba, o dono escreveu "vendedores confirmados com selo e perfil pago". O único selo que o painel concede, "Loja Verificada", é dado só a lojas; exigi-lo deixaria de fora a pessoa física que paga, que o dono quer incluir. Este desenho exige vitrine e plano, não selo.
*   **Quais defeitos se confirmam** no passo 0.

## Critical User Journeys (CUJs)

### CUJ 1: Pessoa nova anuncia pela primeira vez (conferir que continua funcionando)

*   **Given**: Uma pessoa sem conta, no celular, na página inicial.
*   **When**: Toca em "Anunciar", cria a conta, confirma o WhatsApp e aceita os termos.
*   **Then**: Chega a "Como você quer vender?" sem passar por "editar meus dados". A introdução e o topo da tela dizem o mesmo número de passos (isto muda).

### CUJ 1b: Pessoa logada sem WhatsApp confirmado toca em "Anunciar"

*   **Given**: Uma pessoa com conta, que saiu da tela do código sem confirmar o WhatsApp.
*   **When**: Toca em "Anunciar" e confirma o WhatsApp.
*   **Then**: Não cai em "editar meus dados". Para onde vai depende da decisão 1.

### CUJ 2: Comprador sem vitrine abre o Radar

*   **Given**: Uma pessoa com conta, sem vitrine e sem plano.
*   **When**: Toca em "Radar" no menu.
*   **Then**: Vê os próprios pedidos e o botão para pedir. Não vê a aba "Pedidos na região" nem o cartão borrado.

### CUJ 3: Comprador pede algo parecido a partir de um anúncio

*   **Given**: Uma pessoa com conta e WhatsApp confirmado, em um anúncio no ar.
*   **When**: Toca no link "Procuro algo parecido".
*   **Then**: Abre o formulário de pedido com título e categoria preenchidos. Antes de enviar, lê que o WhatsApp dela será mostrado a quem mandar proposta. Ao enviar, vai para a tela do pedido criado.

### CUJ 3b: Pessoa logada sem WhatsApp confirmado pede algo parecido

*   **Given**: Uma pessoa com conta, sem WhatsApp confirmado, em um anúncio no ar.
*   **When**: Toca no link, vê o aviso de confirmar o celular, toca em "Confirmar meu celular" e confirma.
*   **Then**: Volta ao formulário ainda preenchido. Pela leitura do código, hoje volta vazio.

### CUJ 4: Visitante sem conta toca no link (conferir que continua funcionando)

*   **Given**: Uma pessoa sem conta, em um anúncio no ar.
*   **When**: Toca no link "Procuro algo parecido".
*   **Then**: Vai ao login e, depois de entrar e confirmar o WhatsApp, volta ao formulário preenchido.

### CUJ 5: Quem vende e tem plano abre o Radar

*   **Given**: Uma loja ou pessoa física com vitrine e plano com Radar.
*   **When**: Toca em "Radar" no menu.
*   **Then**: Vê as abas "Pedidos na região", "Meus pedidos" e "Minhas propostas", como hoje.

### CUJ 6: Quem vende e não tem plano abre o Radar

*   **Given**: Uma pessoa com vitrine e sem plano com Radar.
*   **When**: Toca em "Radar" no menu, ou abre o endereço da aba da região direto.
*   **Then**: Cai em "Meus pedidos". Vê "Meus pedidos" e "Minhas propostas". Não vê a aba da região nem o cartão borrado. Se há ou não uma linha com link para os planos depende da decisão 7.

## Technical Plan

Nenhuma mudança no banco, nenhuma dependência nova. Para desfazer uma parte, reverte-se o commit dela.

| Problema | Parte | CUJs |
| --- | --- | --- |
| 1. Caminho de "Anunciar" | A e B | 1, 1b |
| 2. Radar mostra a tela de quem vende | C e D | 2, 5, 6 |
| 3. Sem saída "quero algo assim" | E | 3, 3b, 4 |

### Ordem

1.  **Passo 0:** reproduzir no site, em tamanho de celular, os CUJs 1, 1b, 2, 3b (pelo link da busca vazia) e 4. O que não se confirmar sai.
2.  **Parte C.** Não depende de ninguém; a decisão 7 muda só um detalhe dela.
3.  **Parte E.** Pode ser construída depois da decisão 3. Só é publicada depois da decisão 4.
4.  **Parte B,** depois da decisão 2.
5.  **Parte A,** depois da decisão 1.
6.  **Parte D,** depois da decisão 6.
7.  Repetir o teste de 5 pessoas.

### A. Depois de confirmar o WhatsApp, não cair em "editar meus dados"

Hoje a área da conta manda para a confirmação sem dizer de onde a pessoa veio, e a tela de confirmação, sem destino, manda para "editar meus dados".

A parte A tem duas formas. A escolha depende da resposta dos testadores (decisão 1):

*   **Forma mínima.** A tela de confirmação, quando não recebe destino, manda para a página inicial. A pessoa não volta sozinha ao "Anunciar", mas não cai em uma tela que não pediu. Efeito colateral a tratar junto: quem troca o número ou a foto dentro de "Meus dados" passa hoje pela confirmação sem destino e volta a "Meus dados". Esses caminhos passam a dizer o destino, para continuar voltando ao mesmo lugar.
*   **Forma completa.** Inclui a forma mínima. Além dela, o `middleware` anota o endereço pedido em uma etiqueta interna, que o servidor sempre sobrescreve. O layout da conta lê a etiqueta e manda para a confirmação com o destino. A tela de confirmação já valida o destino e só aceita endereço do próprio site (`src/lib/caminho-seguro.ts`). A pessoa volta ao "Anunciar". Custo: mexe em código que roda antes de todas as páginas do site.

Regra: a forma completa só é feita se os testadores disserem que saíram da tela do código ou que caíram em "editar meus dados". Nos outros casos faz-se a forma mínima, e a forma completa vai para Future Improvements.

### B. Mesmo número de passos na introdução e no topo da tela

Provisório: a introdução deixa de numerar "1, 2, 3" e passa a dizer o total real, lido de `TOTAL_PASSOS` (hoje 6). O topo da tela, "Passo N de 6", não muda. A outra opção está em Alternatives Considered e depende da decisão 2.

### C. Aba "Pedidos na região" só para quem vende e tem plano

A regra fica em um só lugar, `src/app/radar/page.tsx`:

*   **Tem vitrine e o plano da conta tem acesso ao Radar:** abas "Pedidos na região", "Meus pedidos", "Minhas propostas". Abre na região, como hoje.
*   **Tem vitrine, sem plano:** "Meus pedidos" e "Minhas propostas". Abre em "Meus pedidos". "Minhas propostas" continua porque a pessoa pode ter mandado propostas quando tinha plano.
*   **Sem vitrine:** só "Meus pedidos", sem barra de abas.
*   Quem abrir o endereço da aba da região sem poder vê-la cai em "Meus pedidos". O código já recusa aba que a conta não tem; muda só a aba de entrada de quem vende sem plano, que hoje é a região.

**De onde vem a resposta "tem acesso".** A página do Radar já carrega o plano da conta, que traz a marca de acesso ao Radar (`src/app/radar/page.tsx:60`, `src/lib/tipos.ts:199`). Provisório: decidir as abas por essa marca, sem consulta nova; se a leitura do plano falhar, vale "sem acesso" e a pessoa vê "Meus pedidos". A consulta `acessoRadar()` continua só dentro da aba da região, como hoje. A outra opção está em Alternatives Considered.

Consequências:

*   **O que sai de `radar-de-negocios.tsx`:** o trecho borrado do cartão e a faixa mostrada a quem não tem plano. **O que fica:** a mesma faixa e o botão "Desbloquear e Propor Produto" também aparecem para quem tem plano e esgotou as propostas ("Você atingiu o limite de novas ofertas do plano."); esse uso e a lista de planos que ele mostra continuam.
*   Provisório: para quem vende sem plano, "Meus pedidos" ganha uma linha com link para a página de planos (decisão 7).
*   **Botões que levam à aba da região.** São três: dois na tela de um pedido aberto por link direto (`src/app/radar/[id]/page.tsx`, "Ver pedidos na região" e "Ver pedidos da minha região") e um em "Minhas propostas" vazia (`src/components/radar/listas-radar.tsx:73`). Quem pode ver a aba continua com eles. Para quem não pode, os dois primeiros viram "Abrir o Radar" e apontam para o Radar sem escolher aba; a frase "Veja outros pedidos da região." e o terceiro botão não aparecem. O resto da tela de um pedido não muda: ela continua convidando quem não vende a criar vitrine e quem vende sem plano a assinar.
*   O banco continua entregando a lista a qualquer conta logada da região (ver Risks).

### D. Um nome e uma palavra para cada coisa

Só começa depois da decisão 6. Palavras provisórias: **Radar**, **pedido**, **proposta**.

Regra: nos textos do Radar que o comprador lê, "Radar de Negócios" vira "Radar", e "oferta" ou "contato" viram "proposta" só quando significam proposta. Textos lidos apenas por quem vende ficam para depois. Textos de aviso gravados pelo banco também ficam de fora, porque mudá-los exige migração. A lista de arquivos é escrita neste documento depois da decisão 6, com uma busca por essas palavras em `src/app/radar/`, `src/components/radar/`, `src/lib/dados/radar.ts` e `src/app/(conta)/minha-conta/notificacoes/`.

Não mudam: páginas de planos e de cobrança, e a descrição do site usada por buscadores (`src/app/layout.tsx`). Continuam dizendo "Radar de Negócios". O botão "Pedir no Radar" e a palavra "Radar" no menu também não mudam.

### E. Link "Procuro algo parecido" na página do anúncio

A parte E é um teste. Ela sai se, no piloto, quem vende reclamar do link na própria página, ou se ninguém o usar na quarta tarefa do teste.

*   O link aparece em anúncio no ar, para quem não é o dono do anúncio. A página já calcula essa condição para mostrar os botões de contato. Lugar provisório: logo depois do bloco dos botões de contato (decisão 3). **No celular os botões de contato ficam em uma barra fixa no rodapé da tela** (`src/app/(publico)/anuncio/[idslug]/barra-contato.tsx:74`); ali o link provisório aparece no corpo da página, depois do cartão de quem vende, e não junto dos botões.
*   Usa `linkPedirRadar` com o título do anúncio e o nome-código da categoria (`categoria_slug`, o que o formulário reconhece; o número da categoria ele ignora). Sem nome-código, o link vai sem categoria.
*   **Corte do título.** O caminho de volta do login guarda no máximo 300 caracteres de endereço (`src/app/completar-perfil/page.tsx:25`), contados depois de codificado: uma letra acentuada ocupa 6. Regra: cortar o título em 80 letras e, se o endereço inteiro ainda passar de 300 caracteres, continuar cortando letras inteiras do fim até caber.
*   Não leva cidade nem preço. O formulário escolhe a cidade como já faz: primeiro a cidade em que a pessoa navega, depois a do perfil (`src/app/radar/pedir/page.tsx:96-98`).
*   **Formulário preenchido depois de confirmar o celular.** Dois links "Confirmar meu celular" na tela de pedir mandam hoje para a confirmação sem os dados de preenchimento (`src/app/radar/pedir/page.tsx:54` e `src/components/radar/form-pedido.tsx:254`). Passam a levar o que veio no endereço da tela de pedir (texto, categoria, cidade e faixa de preço), não o que a pessoa digitou depois. A página monta o endereço pronto e o entrega ao formulário. O segundo link só aparece se o envio falhar por celular não confirmado; é caso raro.
*   **Aviso sobre o WhatsApp.** A frase "As lojas que enviarem uma proposta poderão ver este número" está em um trecho do formulário que hoje não aparece para ninguém (`src/components/radar/form-pedido.tsx:234-248`; o site sempre exige o celular confirmado antes, `src/lib/dados/radar.ts:47-50`). Todos leem apenas "As lojas mandam mensagem direto para o seu celular". A descrição da opção "Podem me chamar no WhatsApp" passa a dizer que o número é mostrado a quem mandar proposta.
*   **O uso do link não é contado em números.** É avaliado pela quarta tarefa do teste. Formas de contar não adotadas: coluna nova no banco, excluída pela restrição; um tipo novo no registro de eventos da página do anúncio (`registrarEvento`), que pode exigir mudança no banco, não conferido; marcar o endereço com `origem=anuncio`, que só serve com uma ferramenta de medição, e o site não tem.

## Risks & Mitigations

| Risco | O que acontece | Como se reduz |
| --- | --- | --- |
| Defeitos não reproduzidos | Corrige-se algo que não acontece no site | Passo 0 |
| Causa do travamento no "Anunciar" desconhecida | As correções saem e as pessoas continuam travando | Decisão 1 antes da parte A; teste de 5 pessoas no fim |
| Lista da região legível por consulta direta ao banco | Conta logada sem plano lê título, categoria, cidade, faixa de preço, urgência, número de propostas e data dos pedidos | Aceito enquanto não há comprador real. Bloqueio no banco antes do lançamento (Future Improvements) |
| Perda do gancho de venda do plano | Quem vende sem plano não vê mais, na tela principal do Radar, que há clientes procurando | Convite mantido na tela de um pedido; decisão 7 |
| O link tira o comprador da página de quem vende | Em um anúncio, inclusive de quem paga plano, o comprador é convidado a pedir propostas a outros | Link com menos destaque que os botões de contato. Sem outra redução; ouvir quem vende no piloto |
| Pedidos de pouca intenção | Pedir fica a dois toques, e cada pedido avisa quem tem plano | Valem os limites atuais: 10 pedidos abertos por pessoa e o limite por dia do painel. Não foi medido se bastam |
| Texto de quem vende vira pedido do comprador | O título do anúncio pode trazer nome de loja, telefone ou propaganda, e seria publicado como pedido de outra pessoa | A pessoa revisa o formulário antes de enviar; o pedido passa pela validação e moderação de qualquer pedido. Não há filtro novo |
| Migração do Radar não confirmada em produção | Criar pedido falha e o link leva a um erro | Decisão 4 antes de publicar a parte E |
| Etiqueta interna forjada (só na forma completa da parte A) | Tentativa de mandar a pessoa a outro site depois da confirmação | O servidor sobrescreve a etiqueta; a tela de confirmação só aceita endereço do próprio site |
| Outra ferramenta (Codex) altera o Radar em paralelo | Trechos e números de linha deste desenho ficam velhos | Conferir o código antes de cada parte, em ramo novo saído do principal |

## Alternatives Considered

### Opções do resumo de conceitos

| # | Opção | Situação | Motivo |
| --- | --- | --- | --- |
| 1 | Só palavras: trocar as palavras do Radar do lado do comprador | Adotada como parte D | Sem mudança no banco; trata a confusão relatada nos testes |
| 2 | Link "Procuro algo parecido" | Adotada como parte E | Reusa o Radar que existe; um link novo e uma frase alterada |
| 3 | Coração e, depois de salvar, a pergunta "Quer receber ofertas de parecidos?" | Rejeitada | A pergunta só aparece depois de salvar; quem não salva nunca a vê |
| 4 | Item guardado com alerta ao comprador | Adiada | Tabela nova e trabalho de privacidade antes de haver uso |
| 5 | Quem vende vê só totais do que se procura na cidade | Adiada | Fica vazio com poucos usuários |
| 6 | Quem vende vê cada desejo e aborda o cliente | Adiada | Maior custo e risco: limites, bloqueio, moderação, textos de privacidade |
| 7 | Guardar o desejo como pedido do Radar | Rejeitada | Entrega o telefone, estoura o limite de 10 pedidos e enche de avisos quem vende |
| 8 | Uma marca no anúncio salvo | Rejeitada | Some quando o anúncio é apagado |

As partes A, B e C vêm da etapa 3 do resumo, não dessas opções.

### Diferenças em relação ao resumo, mantidas pelo dono em 10/11/2026

*   **Coração no card.** O resumo juntava o link e um coração no card. Este desenho entrega só o link. Desvantagem: quem está na lista de anúncios continua sem atalho para salvar.
*   **Palavras.** O resumo propunha "procura" e "oferta". Este desenho mantém "pedido" e "proposta", que o site já usa, até a decisão 6.
*   **Ordem.** O resumo punha antes a conferência da base e o teste de 5 pessoas. Este desenho começa por reproduzir os defeitos e deixa o teste para o fim. Desvantagem: as partes B, C e E saem sem prova escrita de onde as pessoas travaram.

### Decisões deste desenho

**Quem vê "Pedidos na região": bloquear no banco ou só na tela.**

*   *Só na tela* — adotada pelo dono em 10/11/2026. Não mexe no banco. Desvantagem: a lista continua legível por consulta direta (ver Risks).
*   *Bloquear no banco* — adiada pelo dono para antes do lançamento. Fecha também a consulta direta. Pode ser testada no banco temporário de `npm run test:db`. Riscos que restam: não há ambiente de ensaio igual à produção nem migração de volta.

**De quem esconder a aba.**

*   *De quem não vende e de quem vende sem plano* — adotada pelo dono, com a regra "apenas pago acessa": a lista é benefício de quem paga, sem amostra para os demais. Desvantagem: sai o cartão borrado, que o código descreve como o gancho que vende o plano (`radar-de-negocios.tsx:199`).
*   *Só de quem não vende* — não adotada. Resolveria sozinha o problema relatado pelos testadores e manteria o gancho. Contraria a regra do dono.

**O que mostrar a quem vende sem plano** (decisão 7).

*   *Uma linha com link para a página de planos em "Meus pedidos"* — provisória. Mantém um convite na tela principal; é um texto novo a escrever e a testar.
*   *Nada* — alternativa. É a menor mudança. O convite ao plano fica só na tela de um pedido e na página de planos.

**De onde vem a resposta "tem acesso" na tela do Radar.**

*   *A marca de acesso no plano que a página já carrega* — provisória. Nenhuma consulta nova; se a leitura falhar, a pessoa vê "Meus pedidos". A conferir antes de começar: que essa marca e a consulta `acessoRadar()` dão sempre a mesma resposta.
*   *Chamar `acessoRadar()` em toda abertura do Radar por quem vende* — alternativa. Usa a mesma consulta da aba da região. Desvantagens: duas consultas a mais por abertura; se ela falhar, a tela inteira do Radar dá erro para quem vende (`src/lib/dados/radar.ts:71`), e hoje só a aba da região daria.

**Quanto fazer na parte A** (decisão 1).

*   *Forma mínima* — a pessoa cai na página inicial. Não toca o `middleware`. Quatro arquivos pequenos, porque os caminhos que hoje dependem de voltar a "Meus dados" passam a dizer o destino. Desvantagem: ela precisa tocar em "Anunciar" de novo.
*   *Forma completa, etiqueta interna anotada pelo `middleware`* — a pessoa volta ao "Anunciar". Um ponto só de mudança, vale para todas as telas da conta. Desvantagem: mexe em código que roda antes de todas as páginas. Falha se a etiqueta vinda do navegador não for sobrescrita; por isso a sobrescrita é exigida e o destino continua validado.
*   *Cada tela da conta faz a própria checagem* — não usada. Mais de dez telas a alterar, e uma tela nova esquecida volta ao defeito.
*   *O `middleware` faz a checagem* — não usada. Obrigaria a consultar o banco antes de toda página.
*   *Guardar "WhatsApp confirmado" na sessão do login* — não avaliada a fundo. Cria um segundo lugar para a mesma informação, que pode ficar diferente do banco.

**Como igualar o número de passos** (decisão 2).

*   *A introdução diz o total real, 6* — provisória. Um arquivo. Desvantagem: "6 passos" na primeira tela pode assustar.
*   *Agrupar o topo da tela em 3 etapas* — alternativa. Cada passo ganha uma etapa em `passos.ts` (Fotos = 1; Categoria, Detalhes, Preço e Local = 2; Revisar = 3); o topo diz "Etapa 2 de 3 · Preço" e a introdução continua com "1, 2, 3". Dois arquivos, sem mexer na navegação. Desvantagens: o número fica parado por 4 telas enquanto a barra anda; o texto lido por leitor de tela muda junto.

**Texto do link** (decisão 3).

*   *"Procuro algo parecido"* — provisória.
*   *"Procuro algo assim"* e *"Quero propostas de parecidos"* — candidatas do resumo. "Me avise" foi descartada porque promete um aviso que o Radar não manda.

**Lugar do link** (decisão 3).

*   *Logo depois do bloco dos botões de contato* — provisória. No computador fica abaixo dos botões. No celular fica no corpo da página, depois do cartão de quem vende. Um arquivo.
*   *Dentro da barra fixa do celular, junto dos botões* — alternativa. Fica sempre à vista. Desvantagens: disputa espaço com os botões de quem vende, aumenta a barra e obriga a mexer em mais um arquivo e no espaço reservado no fim da página.
*   *Junto da seção "Parecidos na região", e também em anúncio vendido* — alternativa. Põe lado a lado "ver parecidos" e "pedir parecido". Desvantagem: fica mais abaixo na página.

**Modo de contato do pedido criado pelo link** (decisão 3).

*   *O padrão do formulário: WhatsApp visível a quem manda proposta* — provisória. Nenhuma mudança além do aviso.
*   *Abrir no modo "Quero receber propostas aqui", que esconde o número* — alternativa. Protege mais o comprador; obriga a escolher até quando aceita propostas, no máximo 168 horas.

**O que o link leva para o pedido.**

*   *Título e categoria* — usada.
*   *Também cidade e preço* — não usada. A cidade do anúncio pode ser de outra região, e o preço viraria teto de quem procura outro produto.

## Non-Functional Requirements

*   **Segurança.** O destino depois da confirmação só pode ser um endereço do próprio site; a validação existente continua sendo a única porta.
*   **Privacidade.** Nenhum dado novo é guardado. O aviso sobre o WhatsApp aparece antes do envio do pedido.
*   **Desempenho.** Na opção provisória da parte C, nenhuma consulta nova ao banco. Na forma completa da parte A, o `middleware` anota o endereço antes de toda página, sem consultar o banco. Nada disso foi medido.
*   **Acessibilidade.** O link novo segue o padrão dos demais: alvo de toque de pelo menos 48 px e contorno de foco por teclado.
*   **Celular primeiro.** Toda conferência no navegador é feita em largura de celular.

## Future Improvements

*   Bloquear no banco a lista da região para quem não paga. Gatilho: antes de o primeiro comprador real criar pedido. Entra na lista de bloqueios de lançamento (etapa 6 do resumo).
*   Forma completa da parte A, se a mínima for a escolhida agora.
*   Contar em números o uso do link.
*   Perfil de desejos (etapa 8 do resumo), quando houver uso.
*   Reforma visual, em desenho próprio.

## Detailed Implementation Plan

Um commit por parte, na ordem: função de endereço, C, E, B, A, D. Nenhum arquivo de `supabase/` é tocado.

Regras de trabalho:

*   Código lido em 10/11/2026, no ramo `codex/moderacao-termos-sensiveis`. Outra ferramenta, o Codex, altera o mesmo repositório em paralelo, inclusive telas do Radar.
*   Cada parte é feita em ramo novo saído do principal e entra no principal antes de a seguinte começar.
*   Antes de cada parte, conferir os trechos citados. Os números de linha servem de pista; vale o texto citado. Se um trecho mudou de sentido, parar e avisar o dono.
*   As tabelas valem para as opções provisórias. Se o dono escolher outra opção, a tabela da parte é refeita antes de começar.

### Frases novas (decisão 8)

Provisórias, para o dono aprovar ou trocar:

| Onde | Frase provisória |
| --- | --- |
| Introdução do anúncio (parte B) | "São 6 passos curtos." O número vem de `TOTAL_PASSOS` |
| "Meus pedidos", para quem vende sem plano (parte C, decisão 7) | "Quer ver os pedidos da sua região? Conheça os planos." A parte "Conheça os planos" é o link |
| Descrição da opção "Podem me chamar no WhatsApp" (parte E) | "Quem mandar proposta vê o seu número." |
| Botão para quem não vê a aba da região (parte C) | "Abrir o Radar" |

### Passo 0. Reproduzir

Subir o site local e refazer, em largura de celular, os CUJs 1, 1b, 2, 3b (pelo link da busca vazia) e 4. Anotar em `docs/USABILIDADE.md`, para cada CUJ, o que aconteceu.

*   CUJ 1b não cai em "editar meus dados": a parte A sai.
*   No CUJ 1, a introdução e o topo já dizem o mesmo número: a parte B sai.
*   No CUJ 2, quem não vende não vê a aba da região: a parte C sai.
*   No CUJ 3b, o formulário volta preenchido: sai da parte E a linha dos links "Confirmar meu celular".
*   Os CUJs 1 e 4 devem funcionar. Se um deles falhar, parar e avisar o dono.

### Função de endereço (commit próprio, antes da parte C)

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/lib/rotas.ts` | Função nova `linkConfirmarCelular(destino)`, que devolve o endereço da tela de confirmação com o destino codificado | Usada nas partes E e A. Fica mesmo se a parte E for retirada |
| `tests/fluxo.test.cjs` | Caso: destino com parâmetros sai inteiro no endereço | Confere a função |

`src/app/completar-perfil/page.tsx` e `src/app/(conta)/minha-conta/verificacao/page.tsx` montam um endereço parecido e ficam como estão, para não mexer no caminho da pessoa nova.

### Parte C. Aba "Pedidos na região"

"Pode ver a região" quer dizer: tem vitrine e o plano da conta tem a marca de acesso ao Radar (`conta.plano?.acesso_radar`).

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/radar/page.tsx` | Calcular "pode ver a região" a partir da conta já carregada, sem consulta nova | Regra em um lugar só |
| `src/app/radar/page.tsx` | Montar as abas pelos três casos da parte C do Technical Plan | Hoje todos recebem a aba da região |
| `src/app/radar/page.tsx` | Aba de entrada: região para quem pode vê-la; "Meus pedidos" para os demais, inclusive quando o endereço pede a região | Hoje quem vende entra sempre pela região |
| `src/app/radar/page.tsx` | Informar a "Meus pedidos" se a pessoa vende sem plano, e a "Minhas propostas" se pode ver a região | As duas listas precisam saber para mostrar ou esconder a linha e o botão |
| `src/components/radar/radar-de-negocios.tsx` | Retirar a faixa mostrada a quem não tem plano (perto da linha 121) e o trecho borrado do cartão, com o texto "Exclusivo para lojistas assinantes" (perto das linhas 225-238) | Deixam de ser alcançáveis |
| `src/components/radar/listas-radar.tsx` | "Meus pedidos": para quem vende sem plano, a frase provisória com link para os planos, acima da lista, com ou sem pedidos; não aparece nos arquivados. Se a decisão 7 for "nada", esta mudança não é feita | Mantém um convite ao plano na tela principal |
| `src/components/radar/listas-radar.tsx` | "Minhas propostas" vazia: o botão "Ver pedidos na região" só aparece para quem pode ver a região | Para os demais ele levaria a "Meus pedidos" |
| `src/app/radar/[id]/page.tsx` | Para quem não pode ver a região: os botões "Ver pedidos na região" e "Ver pedidos da minha região" viram "Abrir o Radar" e apontam para o Radar sem escolher aba; a frase "Veja outros pedidos da região." não aparece | Depois desta parte, levariam a uma aba que a pessoa não tem |
| `tests/radar.test.cjs` | Carregar `src/app/radar/page.tsx` com as consultas ao banco trocadas por respostas falsas, como `tests/fluxo.test.cjs` já faz, e ler as abas e a aba de entrada. Casos: com vitrine e acesso; com vitrine sem acesso; sem vitrine; endereço pedindo a região sem poder vê-la; a frase dos planos aparece só para quem vende sem plano | Confere a regra |

Não mudam em `radar-de-negocios.tsx`: a faixa de quem tem plano e esgotou as propostas, a lista de planos que ela mostra e o botão "Desbloquear e Propor Produto" para esse caso. Também não mudam `src/lib/dados/radar.ts` e `src/components/radar/abas-radar.tsx`, que já esconde a barra quando há uma aba só. Se, depois das retiradas, alguma propriedade do componente ficar sem uso, ela sai; `npm run typecheck` mostra.

### Parte E. Link na página do anúncio

Vale para as três opções provisórias da decisão 3: texto "Procuro algo parecido", lugar logo depois do bloco dos botões de contato, modo de contato padrão. A parte E só é publicada depois da decisão 4.

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/(publico)/anuncio/[idslug]/conteudo-anuncio.tsx` | Link "Procuro algo parecido" logo depois do bloco dos botões de contato, na mesma condição que já mostra esses botões (anúncio no ar e a pessoa não é dona dele). Montado com `linkPedirRadar` a partir do título real do anúncio (`a.titulo`, não o substituto "Anúncio sem título") e de `a.categoria_slug`. Título cortado pela regra da parte E do Technical Plan. Sem título, o link não aparece | Dá a saída "quero algo assim, mas não este" |
| `src/app/radar/pedir/page.tsx` | O link "Confirmar meu celular" passa a usar `linkConfirmarCelular` com o endereço da própria tela e os parâmetros que vieram nele | Pela leitura do código, sem isso o formulário volta vazio |
| `src/app/radar/pedir/page.tsx` e `src/components/radar/form-pedido.tsx` | A página entrega ao formulário esse mesmo endereço pronto, em uma propriedade nova; o segundo link "Confirmar meu celular" passa a usá-lo | O formulário não tem acesso ao endereço da tela |
| `src/components/radar/form-pedido.tsx` | A descrição da opção "Podem me chamar no WhatsApp" passa a ser a frase provisória | Pela leitura do código, o aviso atual não aparece para ninguém |
| `tests/anuncio.test.cjs` | Casos: o link aparece para visitante sem conta e para pessoa logada que não é dona do anúncio; não aparece para a dona nem em anúncio fora do ar; leva título e categoria, sem cidade nem preço; título longo com acentos gera endereço de no máximo 300 caracteres | Confere a regra |
| `tests/fluxo.test.cjs` | Caso: tela de pedir aberta com texto e categoria por pessoa sem celular confirmado; o link "Confirmar meu celular" leva os dois no destino | Confere o CUJ 3b |

`linkPedirRadar` não muda.

### Parte B. Número de passos

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/(conta)/anunciar/page.tsx` | Tirar os números "1, 2, 3" dos três blocos da introdução, que continuam como descrição, e pôr acima deles a frase provisória com o total lido de `TOTAL_PASSOS` | Pela leitura do código, a introdução promete 3 e o topo mostra 6 |

Sem teste automático: nenhum teste atual carrega essa tela. A conferência é no navegador, pelo CUJ 1.

Se a decisão 2 for "3 etapas", `src/app/(conta)/anunciar/page.tsx` não muda, e a tabela de `src/components/anunciar/passos.ts` e `src/components/anunciar/cabecalho-passo.tsx` (inclusive o texto lido por leitor de tela) é escrita aqui antes de começar.

### Parte A. Depois de confirmar o WhatsApp

Forma mínima:

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/app/confirmar-celular/page.tsx` | Sem destino, mandar para a página inicial em vez de "editar meus dados" | A pessoa não cai em tela que não pediu |
| `src/components/conta/form-whatsapp.tsx`, `src/components/conta/concluir-dados-clerk.tsx`, `src/components/conta/foto-perfil.tsx` | Os links para a confirmação passam a dizer o destino "editar meus dados" | Vêm dessa tela e devem continuar voltando a ela |
| `tests/whatsapp.test.cjs` | Casos: sem destino vai para a página inicial; com destino interno vai para ele; destino `//outro-site.com` é recusado e vai para a página inicial | Confere o defeito e a regra de segurança |

Antes de começar, procurar no código outros links para a confirmação sem destino e tratá-los do mesmo modo. Um caso já visto fica como está: a tela de ajuda do assistente (`src/app/aki/page.tsx`) tem um link de volta para a tela de confirmação e repassa o destino quando ele existe.

Forma completa. Só é feita se os testadores disserem que saíram da tela do código ou que caíram em "editar meus dados" (decisão 1). Inclui tudo da forma mínima, mais:

| Arquivo | Mudança | Por quê |
| --- | --- | --- |
| `src/middleware.ts` | Em pedidos de página (não em envios de formulário), anotar caminho e parâmetros na etiqueta interna `x-olaki-destino`, sempre substituindo o valor recebido. Ficam de fora os parâmetros que o próprio Next acrescenta em navegação interna (`_rsc`). Para isso o `middleware` passa a devolver a resposta com os cabeçalhos do pedido alterados | O layout da conta não tem acesso ao endereço pedido |
| `src/app/(conta)/layout.tsx` | Ler a etiqueta e mandar para `linkConfirmarCelular` com esse destino; sem etiqueta, mandar para a confirmação sem destino | A pessoa volta ao "Anunciar" |

O `middleware` não roda em endereços com extensão de arquivo, e a etiqueta não é anotada em envio de formulário. Nesses casos a pessoa cai na página inicial depois de confirmar, como na forma mínima. Não foi conferido se os testes atuais conseguem carregar o `middleware`; se não conseguirem, a conferência desta forma é manual, pelas checagens abaixo.

### Parte D. Nome e palavras

Sem tabela agora: ela é escrita aqui depois da decisão 6, pela regra da parte D do Technical Plan. Pontos de partida já vistos no código, do lado do comprador: `src/app/radar/page.tsx`, `src/app/radar/pedir/page.tsx`, `src/app/radar/pedido/[id]/page.tsx`, `src/components/radar/explicacao-radar.tsx`, `listas-radar.tsx` (estado vazio de "Meus pedidos"), `form-pedido.tsx`, `acoes-pedido.tsx` e `propostas-recebidas.tsx`. A conferir no dia: de onde vêm os textos da tela de avisos; os que vierem do banco ficam de fora.

### Verification Plan

Depois de cada parte:

1.  `npm run lint`
2.  `npm run typecheck`
3.  `npm run test`
4.  `npm run build`
5.  No navegador, em largura de celular, refazer os CUJs da parte: C → 2, 5 e 6; E → 3, 3b e 4; B → 1; A → 1 e 1b; D → 2, 5 e 6, mais abrir um pedido com proposta recebida e a tela de avisos.

Checagens próprias:

*   **Parte C:** com uma conta com vitrine e sem plano, e com outra sem vitrine, abrir o endereço da aba da região direto. Resultado esperado: abre "Meus pedidos" e a página não traz pedidos de outras pessoas. Com uma conta com plano e propostas esgotadas: a faixa de limite continua aparecendo.
*   **Parte E:** anúncio com título de menos de 8 letras (o pedido exige 8). Resultado esperado: o formulário abre preenchido e, ao enviar, pede um título maior. Anúncio com título de mais de 80 letras e muitos acentos, aberto por visitante sem conta. Resultado esperado: depois do login, o título cortado e a categoria voltam inteiros; se não voltarem, a regra de corte está errada e a parte não é publicada.
*   **Parte A:** abrir `/confirmar-celular?destino=//outro-site.com`. Resultado esperado: depois de confirmar, a pessoa vai para a página inicial do site. Trocar o número em "editar meus dados": volta a "editar meus dados". Na forma completa, pedir uma página da conta com a etiqueta forjada apontando para outro endereço: a pessoa vai ao endereço que pediu, não ao forjado.

`npm run test:db` não é necessário: o banco não muda.

**Fim do trabalho:** com o N da decisão 5 definido, repetir o teste de 5 pessoas com a quarta tarefa e as duas perguntas finais da Medida de sucesso. Registrar em `docs/USABILIDADE.md` o resultado e as palavras que elas usaram.

**Regra de parada (do resumo de conceitos):** se, nesse teste final, a maioria não souber explicar a diferença entre salvar um anúncio e pedir no Radar, nenhuma função nova do Radar é feita e o perfil de desejos continua adiado. O bloqueio no banco, previsto em Future Improvements, não é função nova e continua valendo.

**Fora deste desenho, registrado:** o assistente Aki oferece "Confirmar meu celular" apontando para "editar meus dados" (`src/lib/aki/acoes.ts:87`), e quem toca passa pelo mesmo desvio do CUJ 1b.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
