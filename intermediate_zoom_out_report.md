# Revisão, etapa 8: segunda visão de cima

*   **Documento:** `docs/designs/clareza-anunciar-radar.md` (450 linhas, lido inteiro)
*   **Comparado com:** `zoom_out_report.md` (etapa 5)
*   **Data:** 2026-11-10
*   **Limite:** leitura do documento e do código. Nada foi aberto no navegador nem executado.
*   **Contagem:** 0 bloqueios, 6 importantes, 8 detalhes.

## Veredito

O documento continua na altura certa e não se afastou do problema. Não surgiu tabela, dependência nem peça nova. O bloqueio da etapa 5 deixou de ser bloqueio.

As correções trouxeram três problemas:

*   **Tamanho.** O documento foi de 333 para 450 linhas, e quase todo o aumento é a mesma decisão contada em vários lugares.
*   **Contradição.** A ordem de trabalho é dada de duas formas diferentes.
*   **Regra vazia.** A trava da parte A não muda nada, qualquer que seja a resposta dos testadores.

## Situação dos achados da etapa 5

| # | Achado da etapa 5 | Situação |
| --- | --- | --- |
| 1 | Parte A conserta caminho que a pessoa nova não percorre (bloqueio) | Parcialmente resolvido. Falta a regra de decisão (achado 2 abaixo) |
| 2 | Medida de sucesso não é movida pelo desenho | Resolvido. Sobra um resto (achado 6 abaixo) |
| 3 | Não se sabe se travaram antes ou depois do botão | Aberto, agora declarado. Só o dono responde |
| 4 | Meta "um nome só" não bate com o plano | Parcialmente resolvido. Faltam dois textos (achado 5 abaixo) |
| 5 | Parte D feita duas vezes; frase já existe | Resolvido |
| 6 | Parte C vai além do problema relatado | Resolvido. Custo e alternativa registrados |
| 7 | Opção "3 etapas" custa menos do que dito | Resolvido como registro. A escolha é do dono |
| 8 | Espera pelo Codex | Resolvido. O repositório está hoje no ramo `codex/moderacao-termos-sensiveis`; os números de linha conferidos continuam certos |
| 9 a 16 | Demais itens | Resolvidos ou registrados |

## Importante

### 1. A ordem de trabalho aparece de duas formas

Uma parte do documento dá a ordem: passo 0, C e E, B, A, D. A implementação detalhada diz "na ordem abaixo", e abaixo vem A, B, C, E, D. Quem seguir a segunda começa pelo `middleware`, justamente a parte que deveria esperar os testadores. **Mudar:** reordenar as seções da implementação detalhada, ou apontar para a ordem certa.

### 2. A trava da parte A não decide nada

*   O desvio vai se reproduzir no passo 0 com certeza: o código redireciona sem destino e a tela de confirmação manda para "editar meus dados".
*   O documento diz que, se os testadores responderem "não achei o botão", a parte A "continua válida como correção pequena". Ou seja, nenhuma resposta cancela a parte A.
*   "Correção pequena" é a única parte que mexe em código que roda em toda requisição do site.
*   **Falta a opção de fazer menos:** trocar o destino padrão da tela de confirmação, de "editar meus dados" para a página inicial. É uma linha e não toca o `middleware`. A pessoa não volta sozinha ao "Anunciar", mas deixa de cair numa tela que não pediu.

**Mudar:** escrever a regra de verdade (a parte A com `middleware` só é feita se os testadores disserem que saíram da tela do código ou que caíram em "editar meus dados"); nos outros casos ela vira a correção de uma linha ou vai para melhorias futuras. Incluir a opção de uma linha nas alternativas.

### 3. A parte E é a menos fechada e está marcada como a que "não depende de ninguém"

*   Publicá-la depende de o dono conferir a migração.
*   Texto do link, lugar do link e modo de contato são provisórios.
*   Três riscos novos foram escritos sem redução.

Os riscos são honestos e devem ficar. O que não fecha é a ordem. **Mudar:** só C não depende de ninguém; E pode ser construída, mas não publicada, antes da conferência da migração. Pedir ao dono as três escolhas provisórias antes da parte E, porque trocá-las depois é refazer a mesma tela. Dizer em uma frase que a parte E é um teste e o que a faz ser retirada.

### 4. O documento engordou por repetição

A mesma decisão aparece em quatro a sete lugares: lista legível direto no banco, perda do cartão borrado, lugar do link, modo de contato, linha para quem vende sem plano, parte D agora ou depois. Dois itens das perguntas em aberto já estão decididos. Quatro trechos contam como o documento chegou aqui, não o que será feito.

Para um dono não técnico, o custo é não conseguir achar as decisões que são dele. Hoje são pelo menos seis, espalhadas:

*   onde os testadores travaram;
*   6 passos ou 3 etapas;
*   as palavras do Radar;
*   a migração em produção;
*   quantas das 5 pessoas precisam acertar no teste;
*   as três escolhas provisórias da parte E.

**Mudar:** cada decisão fica em um lugar só e os outros apontam para lá; as perguntas em aberto viram uma lista curta "o que falta o dono decidir"; o histórico de correções sai ou vai para uma nota no fim.

### 5. A tabela da parte D é detalhe cedo demais, e ainda assim incompleta

São onze linhas de arquivo e número de linha para uma parte que só começa quando as palavras forem escolhidas, em arquivos que outra ferramenta está alterando. E faltam dois textos que o comprador lê: `src/components/radar/propostas-recebidas.tsx:39` e `src/app/radar/[id]/page.tsx:58`. **Mudar:** trocar a tabela por uma regra e uma forma de conferir (uma busca pelas palavras nas pastas do Radar e em notificações). A lista de arquivos é feita no dia.

### 6. O título do Problema 2 promete mais do que o desenho entrega

O problema se chama "O Radar não se explica". O que muda para o comprador é: some a aba de quem vende, e uma palavra é trocada. O menu continua dizendo só "Radar". Mesmo assim, a medida de sucesso cobra que as pessoas expliquem para que serve o Radar. O teste pode falhar nela sem que isso diga algo sobre este trabalho. **Mudar:** renomear o problema para o que é tratado; dizer que explicar o Radar antes do toque fica de fora; e tratar essa medida como observação, sem alvo.

## Detalhe

7.  **Letras.** O texto fala em "partes A a F"; são A a E. Numerar as opções do resumo de 1 a 8 evita confundir "opção A" com "parte A".
8.  **Nome do botão.** O segundo botão da tela de um pedido diz "Ver pedidos da minha região" e só aparece para quem tem vitrine.
9.  **Função nova em `rotas.ts`.** São quatro lugares que montam o endereço, não cinco. Trocar o de `completar-perfil` "só por arrumação" mexe no caminho da pessoa nova, que não pode quebrar. Sugestão: a função serve aos dois links que mudam; os outros ficam como estão.
10. **Segundo link "Confirmar meu celular".** Só aparece se o envio falhar por celular não confirmado, e a página já barra antes. É caso raro; dizer isso.
11. **Detalhe de implementação no plano técnico.** Parâmetros internos do Next, envio de formulário e endereços com extensão descem a um nível que o dono não usa. Cabem na tabela da parte A.
12. **Teste grátis.** Tem resposta no código: o acesso vem de uma marca "acesso ao Radar" no plano em vigor. O teste grátis dá acesso se o plano de teste tiver essa marca ligada. É conferir uma linha no painel. O revisor não verificou o valor gravado.
13. **Glossário.** Com ele, o problema só começa na linha 41. Reduzir às palavras usadas no plano, ou passar para depois do problema.
14. **Número de pessoas no teste** não definido; e "6 passos ou 3 etapas" está no grupo das que travam, mas tem resposta provisória.

## O que se manteve

*   Contexto, limite declarado e a frase sobre o que o documento não explica.
*   Sem tabela, dependência ou custo novo; reuso do que existe.
*   CUJ 3b: defeito confirmado no código, no lugar certo, sem depender do `middleware`.
*   Parte C com a regra em um lugar só.
*   A seção de riscos, a tabela problema → parte → jornadas e a regra de parada.
