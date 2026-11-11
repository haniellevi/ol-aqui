# Revisão, etapa 7: crítica do desenho

*   **Documento:** `docs/designs/clareza-anunciar-radar.md`, linhas 1 a 274 (tudo antes da implementação detalhada)
*   **Data:** 2026-11-10
*   **Revisores:** arquitetura, estrutura e escrita, cada um sem o contexto da conversa
*   **Resultado:** nenhum bloqueio. Arquitetura: 6 importantes, 8 detalhes. Estrutura: 4 importantes, 8 detalhes. Escrita: 11 importantes, 4 detalhes. Abaixo estão juntos e sem repetição.

--------------------------------------------------------------------------------

## Importante: o desenho

### 1. A ordem das partes põe o link no ar com defeito

A correção dos dois links "Confirmar meu celular" está na parte A, que espera a conversa com os testadores. O link "Procuro algo parecido" está na parte E, que sai antes. Resultado: a pessoa logada sem WhatsApp confirmado toca no link novo, confirma o celular e volta com o formulário vazio (CUJ 3b). **Mudar:** levar a correção dos dois links para a parte E. Ela não depende do `middleware` nem dos testadores.

### 2. O link é chamado de "teste", mas nada mede o uso dele

O documento diz que não grava de onde o pedido veio, e as três tarefas do teste de 5 pessoas não passam pelo link. Só foi avaliada a saída "coluna nova no banco". Há duas mais baratas, não avaliadas: um parâmetro `origem=anuncio` no endereço, como a página de planos já faz, e o registro de eventos que a página do anúncio já usa (`registrarEvento` em `src/app/(publico)/anuncio/[idslug]/actions.ts:22`). **Mudar:** escolher uma forma de contar, ou dizer que o link não será avaliado nesta etapa. Incluir uma quarta tarefa no teste: "você gostou deste anúncio mas quer outro parecido; o que faz?".

### 3. Falta uma seção de riscos, e três riscos não aparecem em lugar nenhum

Os riscos conhecidos estão espalhados em cinco lugares. E faltam:

*   **O link tira o comprador da página do vendedor.** Ele fica abaixo dos botões de contato e convida a pedir propostas a outras lojas, inclusive na página de quem paga plano.
*   **Pedidos de um toque.** O formulário preenchido facilita pedidos de pouca intenção, e cada pedido gera aviso às lojas com plano. Dizer se os limites atuais bastam.
*   **Texto do vendedor vira pedido do comprador.** O título do anúncio pode trazer nome de loja, telefone ou propaganda, e passa a ser publicado como pedido de outra pessoa.

**Mudar:** criar a seção "Riscos e como reduzir", reunindo estes e os já escritos (leitura direta do banco, migração não confirmada, corte em 300 letras, perda do gancho de venda).

### 4. Tirar o cartão borrado de quem vende sem plano não tem motivo escrito

O texto reconhece que bastaria esconder a aba de quem não vende. O motivo para ir além é só "decisão do dono". A opção "manter aba e cartão para quem vende sem plano" não está nas alternativas. Depois da mudança, o único gancho de venda no Radar fica na tela de um pedido, onde o vendedor sem plano só chega por link direto. **Mudar:** registrar a alternativa com o motivo, e dizer como o vendedor sem plano fica sabendo que há pedidos.

### 5. A tela de um pedido "não muda", mas fica com botões sem saída

Em `src/app/radar/[id]/page.tsx:39` e `:67` há botões "Ver pedidos na região". Depois da parte C, quem não tem a aba cai em "Meus pedidos" sem explicação. A mesma tela mostra a quem não vende "Você vende? Crie sua vitrine grátis para mandar ofertas" e "Detalhes só para quem tem plano com Radar", o que contraria a meta de não mostrar texto de lojista. **Mudar:** dizer o que essa tela mostra a cada tipo de conta, ou limitar a meta à tela principal do Radar.

### 6. "Caso estreito" é afirmado sem prova

A própria tela do código do WhatsApp oferece o botão "Explorar a vitrine". Quem aceita e depois toca em "Anunciar" cai exatamente no desvio. Pode ser caminho comum de pessoa nova, não caso raro. **Mudar:** tirar "estreito" ou marcar como hipótese. Perguntar aos testadores: "você saiu da tela do código antes de confirmar?".

### 7. O passo 0 não reproduz tudo o que promete

O documento promete reproduzir cada defeito, mas o passo 0 só refaz quatro jornadas. O CUJ 3b fica de fora, e dá para reproduzi-lo hoje pelo link da busca vazia. **Mudar:** incluir o 3b e listar as jornadas pelo nome.

--------------------------------------------------------------------------------

## Importante: o texto

### 8. Três palavras com dois sentidos

*   **"Plano"** é ora a assinatura paga, ora este plano de trabalho. Reservar "plano" para a assinatura e usar "este desenho" para o documento.
*   **"Cabeçalho"** é ora a faixa no topo da tela, ora um dado técnico invisível. Usar "etiqueta interna" para o segundo.
*   **"Lojista", "loja", "vendedor"** se misturam com "quem vende". Pessoa física que vende não é loja. Usar "quem vende" e "sem vitrine"; deixar "lojista" só em textos de tela citados entre aspas.

### 9. Afirmações mais fortes que a prova

Nenhum defeito foi reproduzido no site, mas o texto diz "defeitos reais", "já funciona", "a revisão mostrou". **Mudar** para "lidos no código, ainda não reproduzidos" e equivalentes. Também: "consultas pequenas" e "nenhuma outra tela fica mais lenta" não foram medidos; dizer isso.

### 10. O texto do link está fixado e em aberto ao mesmo tempo

Título, plano e jornadas usam "Procuro algo parecido", que não está entre as candidatas listadas. Uma candidata usa "ofertas", palavra que a parte D elimina. **Mudar:** dizer que "Procuro algo parecido" é o texto provisório.

### 11. Medida de sucesso sem número

Dois critérios dizem "ninguém"; o terceiro não diz quantas das cinco pessoas precisam explicar o Radar. **Mudar:** quebrar em lista e o dono define o número.

### 12. "Dono" e "autor" alternam

Se é a mesma pessoa, usar só "dono" no documento todo.

### 13. Termos técnicos sem explicação na primeira vez

`middleware`, layout da conta, commit, migração, Clerk, push, CUJ. Uma frase curta para cada no glossário.

### 14. Alternativas reais estão fora da seção de alternativas

Esconder a aba só de quem não vende; linha de planos ou nada; lugar do link; modo de contato. Dar a cada uma um bloco na seção de alternativas.

### 15. Rejeições atribuídas ao dono sem motivo

Na maioria das linhas o motivo está escrito e basta tirar "pelo autor". Em dois casos o motivo é só a vontade do dono: a opção C da tabela e a retirada do cartão borrado. Escrever o motivo.

--------------------------------------------------------------------------------

## Detalhe

16. **Segurar a parte B pelos testadores não tem motivo.** "3 passos" contra "de 6" é erro de fato. B só espera a escolha do dono entre "6" e "3 etapas".
17. **"Não está no ar" e "produção".** Dizer o que é produção hoje. Sem usuários reais, o motivo de adiar o bloqueio no banco fica mais fraco ainda. "Antes do lançamento" não tem gatilho nem lista onde fique registrado.
18. **Aviso de WhatsApp.** A frase "poderão ver este número" está em `form-pedido.tsx:246`, e esse bloco hoje não aparece para ninguém, porque `exigeCelularConfirmado()` devolve sempre "sim". Hoje ninguém é avisado. A conclusão do desenho fica mais forte.
19. **"A cidade é a de quem pede" não é o que o código faz.** O formulário usa primeiro a cidade escolhida na navegação, depois a do perfil. Quem navega em outra região lê um aviso sobre "a cidade da busca" sem ter feito busca.
20. **A categoria vai pelo identificador, não pelo nome.** Dizer isso.
21. **Etiqueta interna do `middleware`.** Dizer que parâmetros internos do Next não entram no destino; o que acontece em envio de formulário; e que o `middleware` não roda em endereços com extensão de arquivo. Alternativa não avaliada: guardar "WhatsApp confirmado" na sessão do login.
22. **Corte em 300 letras.** Dá para decidir já: limitar o título no link do anúncio custa uma linha e tira a pergunta da lista.
23. **Depois de enviar o pedido**, a pessoa vai para a tela do pedido criado, não para "Meus pedidos".
24. **O banco entrega mais do que o documento lista:** também categoria, total de propostas, data e selo do comprador.
25. **Nome na tela do vendedor.** Dizer se o vendedor passa a ver dois nomes ao trocar de aba.
26. **"Me avise" foi rejeitada "por um revisor"** sem motivo escrito.
27. **Estrutura.** Quatro numerações diferentes (problemas, etapas, opções, partes) sem tabela de ligação; perguntas em aberto em lista única de 16 itens, sem separar as que travam o trabalho; visão geral sobrecarregada; passo 0 sem título; itens de metas que não são metas; `concepts_brief.md` citado sem caminho e fora do controle de versão.
28. **Palavras.** "Falha:" usado para desvantagem aceita; "protege de verdade"; "quase sem código"; "não paga nada a mais" (parece dinheiro); "caso mais comum" sem dado; "há teste que trava isso" (confunde com o testador que trava).

## Não conferido pelos revisores

*   Se o teste grátis conta como acesso ao Radar.
*   Como o Next entrega o endereço ao `middleware` em navegação interna.
