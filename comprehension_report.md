**What this proposes**

O documento propõe cinco consertos de tela e de redirecionamento, sem mexer no banco:

- (A) quem já está logado, ainda não confirmou o WhatsApp e toca em "Anunciar" ou em "Pedir no Radar" volta ao lugar para onde ia, em vez de cair em "editar meus dados";
- (B) a introdução do anunciar passa a dizer o mesmo total de passos que o cabeçalho (6);
- (C) a aba "Pedidos na região" do Radar só aparece para quem vende e tem plano com Radar;
- (D) o Radar passa a ter um nome só ("Radar") e uma palavra por coisa ("pedido" e "proposta") nas telas do comprador;
- (E) a página de um anúncio no ar ganha o link "Procuro algo parecido", que abre o pedido do Radar já com título e categoria, e o formulário passa a avisar a todos que as lojas verão o WhatsApp.

Antes de tudo vem um "passo 0": reproduzir cada defeito no site, e o que não se confirmar sai do plano. O documento admite que não sabe por que os testadores travaram no "Anunciar" e que várias decisões ainda dependem do dono.

**How the existing system works, per this document**

O OLAKI é um site de anúncios que ainda não está no ar. Para anunciar, a pessoa nova passa por login, código do WhatsApp, termos, "Como você quer vender?" e uma introdução, e depois por 6 passos (Fotos, Categoria, Detalhes, Preço, Local, Revisar), com rascunho gravado a cada passo. Pelo código, a pessoa nova já é devolvida ao destino certo; só quem já está logado sem WhatsApp confirmado é desviado.

O Radar, pelo que o revisor conseguiu deduzir, é o lugar onde o comprador cria um "pedido" dizendo o que procura e as lojas da região respondem com propostas. Ele tem as abas "Pedidos na região", "Meus pedidos" e "Minhas propostas". Hoje todo mundo vê a aba da região, com um cartão borrado e texto de venda de plano. As regras do banco são: até 10 pedidos abertos, validade de 15 dias e WhatsApp confirmado obrigatório.

O link que abre o pedido preenchido (`linkPedirRadar`) já existe e é usado na busca vazia e em anúncio fora do ar.

Atenção: a frase sobre o que é o Radar é dedução do revisor. O documento não diz isso em lugar nenhum de forma direta (ver achado 1).

--------------------------------------------------------------------------------

# Revisão, etapa 6: teste de compreensão

*   **Documento:** `docs/designs/clareza-anunciar-radar.md` (linhas 1 a 355), lido sozinho, sem abrir código nem outros documentos
*   **Data:** 2026-11-10
*   **Resultado:** nenhum trecho ficou impossível de entender (0 bloqueios). 9 achados importantes e 9 detalhes.

## Importante

**1. O Radar nunca é explicado** (Overview e The Problem; Goals)
O documento existe porque as pessoas "não entenderam o que é o Radar", mas ele próprio não diz o que é. Falta uma frase logo no começo: quem pede, quem responde, o que cada um vê.

**2. A "frase que diz o que o Radar faz" não tem texto nem lugar definido** (Goals; CUJ 2; parte D)
A meta diz que a frase aparece "para quem abre o Radar, logado ou não". O plano só mostra dois lugares: a explicação em 3 passos (só para quem não entrou) e o estado vazio de "Meus pedidos" (só para quem nunca pediu). Quem está logado e já tem pedidos, ou o vendedor que abre na aba da região, não lê frase nenhuma. Ou a meta está maior que o plano, ou o plano está incompleto.

**3. "Quem vende" tem três definições diferentes** (Goals; CUJ 6; parte A; parte C)
- "tem vitrine (loja ou pessoa física)";
- "já publicou um anúncio";
- quem já passou por "Como você quer vender?".

"Vitrine" não é explicada. A regra da parte C depende disso. Quem escolheu como quer vender mas ainda não publicou nada vende ou não?

**4. Responder aos testadores antes de A e B: obrigatório ou não?** (Open Questions; parte F; Alternatives)
Uma parte manda responder antes de A e B. A ordem da parte F não tem essa espera. Outra parte diz que as correções saem sem prova escrita. As três não fecham.

**5. "Dono" e "autor" parecem a mesma pessoa, mas o documento não diz**
A mesma decisão é "do dono" num lugar e "do autor" em outro. Os "revisores" e "a revisão de 10/11/2026" também não são identificados.

**6. O documento depende do `concepts_brief.md` sem resumir o que usa dele**
Aparecem sem explicação: "caminho curto", "etapa 3", "etapa 5", "etapa 8", "cabe no limite aprovado" e a "regra de parada".

**7. O que sai da parte A se o defeito não se reproduzir?** (Technical Plan; Detailed Plan)
Um trecho diz que a parte A inteira sai, menos os dois links. Outro diz que só as duas primeiras linhas da tabela dependem do passo 0, o que deixa de pé a função nova em `rotas.ts`, as duas telas que passam a usá-la e os testes. As duas frases dão resultados diferentes.

**8. O caso que a correção dos dois links atende não tem jornada própria** (CUJ 3; CUJ 4; parte A)
Os dois links "Confirmar meu celular" servem a quem está logado, sem WhatsApp confirmado, e chegou pelo link do anúncio. O CUJ 3 exige WhatsApp confirmado; o CUJ 4 é de visitante sem conta. Falta uma jornada para esse caso; hoje a mudança não tem onde ser conferida.

**9. A pergunta sobre o "selo" chega sem contexto** (Open Questions)
O selo não foi citado antes. Não se sabe de onde veio a exigência, nem o que é o selo "de negociador". "Apenas pago" vem entre aspas como citação de algo que o documento não mostra.

## Detalhe

10. **Letras repetidas com sentidos diferentes.** As opções do resumo são A a H e as partes do plano são A a F. "Opção A, só palavras" cobre partes que não são só palavras.
11. **"Cartão borrado"** é citado antes de ser explicado e nunca é descrito. "Faixa de upgrade" e a faixa "Esses clientes já querem comprar" parecem a mesma coisa, mas o texto não diz.
12. **"Minhas propostas" para quem vende sem plano.** Se a pessoa não vê os pedidos da região, de onde viriam propostas dela?
13. **Modo de contato.** "Prazo de no máximo 168 horas": prazo de quê? O outro modo não tem nome.
14. **"Duas consultas pequenas a mais".** A parte C fala de uma consulta. Quais são as duas?
15. **Corte do destino em 300 letras.** O documento manda conferir que o texto volta inteiro, mas não diz o que fazer se não voltar.
16. **"Desejo" não é definido.** O documento exclui "perfil de desejos" sem dizer o que é um desejo e no que difere de favorito e de pedido. A regra de parada depende dessa diferença.
17. **Nome único com exceções não explicadas.** "Pedir no Radar" é listado como um dos nomes que confundem, mas não se diz se o botão muda. Não se explica por que `src/app/layout.tsx` pode continuar dizendo "Radar de Negócios".
18. **Contexto de equipe assumido.** O "teste de 5 pessoas" não é descrito. "PR 43", "trabalho de atendimento", "outra frente de trabalho" e "filtro por nicho" entram sem explicação. A dúvida sobre a migração de produção não diz quem confere nem quando.
