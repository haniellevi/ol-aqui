# Revisão, etapa 9: pronto para implementar?

*   **Documento:** `docs/designs/clareza-anunciar-radar.md`, seção "Detailed Implementation Plan" (linha 344 ao fim)
*   **Data:** 2026-11-10
*   **Revisores:** prontidão, conferência no código e escrita, cada um sem o contexto da conversa
*   **Limite:** leitura do documento e do código no ramo `codex/moderacao-termos-sensiveis`, não no principal. Nada foi executado nem aberto no navegador.
*   **Resultado, sem repetição:** 3 bloqueios, 12 importantes, 9 detalhes.

## Veredito

Ainda não dá para executar só com o documento. A parte C tem um erro de fato. As partes E, B, A e D deixam para quem implementa escolhas que deveriam estar escritas. Quase todas as citações de arquivo e linha conferem.

## Bloqueios

### 1. A parte C manda apagar coisas que quem paga ainda usa

O documento diz que a faixa, o botão "Desbloquear e Propor Produto" e a lista de planos "deixam de ser alcançáveis". Não é verdade para tudo:

*   A mesma faixa aparece para quem **tem plano e esgotou as propostas** ("Você atingiu o limite de novas ofertas do plano.", `src/components/radar/radar-de-negocios.tsx:128`).
*   O botão aparece também para assinante sem proposta sobrando (`radar-de-negocios.tsx:260`).

Seguir o texto apaga o aviso de limite de quem paga. **Mudar:** sai só a faixa de quem não tem plano (linha 121) e o trecho borrado (225-238). Ficam a faixa de limite, a lista de planos e o botão para o caso de cota esgotada.

### 2. Três textos novos são pedidos sem o texto

*   A linha com link para os planos em "Meus pedidos".
*   A frase que avisa que o WhatsApp é mostrado a quem manda proposta.
*   A frase da introdução com o total de passos.

Quem implementa teria de inventar. **Mudar:** escrever a frase exata, ou marcar cada uma como decisão do dono.

### 3. A forma completa da parte A não cumpre a meta

Na forma completa, o documento diz que a tela de confirmação "não muda". Então quem chegar a ela sem destino continua caindo em "editar meus dados", o que contraria a meta. **Mudar:** a forma completa inclui a mudança da forma mínima.

## Importantes

### Parte C

4.  **Um terceiro botão leva à aba da região:** "Ver pedidos na região", no vazio de "Minhas propostas" (`src/components/radar/listas-radar.tsx:73`). Quem vende sem plano toca e cai em "Meus pedidos". Os rótulos dos outros dois botões e a frase "Veja outros pedidos da região." (`src/app/radar/[id]/page.tsx:38`) também continuam prometendo a região. Dizer o que cada tipo de conta vê.
5.  **Se a consulta de acesso falhar, a tela inteira do Radar cai** para quem vende (`src/lib/dados/radar.ts:71`). Hoje só cai a aba da região. Há outra fonte sem consulta nova: a página já carrega o plano da conta, com a marca de acesso ao Radar (`src/app/radar/page.tsx:60`, `src/lib/tipos.ts:199`); em erro ela devolve "sem acesso" em vez de quebrar. Escolher uma e escrever o que acontece na falha.
6.  **Falta dizer como "Meus pedidos" sabe que a pessoa vende sem plano**, e onde a linha com link aparece (lista vazia, com pedidos, arquivados).

### Parte E

7.  **O corte em 80 letras não garante o limite de 300.** O limite vale para o endereço já codificado, em que cada letra acentuada ocupa 6 caracteres. Um título de 80 letras com muitos acentos estoura, e a categoria é a primeira a se perder. A própria checagem do documento falharia. Definir o corte pelo tamanho do endereço.
8.  **"Identificador da categoria" induz a erro.** O formulário reconhece o nome-código da categoria (`a.categoria_slug`), não o número dela. Escrever isso e o que fazer quando estiver vazio.
9.  **O segundo link "Confirmar meu celular" não tem como levar os dados.** O formulário não recebe os parâmetros do endereço. Falta definir a propriedade nova e quais dados vão (os do endereço ou o que a pessoa já digitou).
10. **"Abaixo dos botões de contato" não existe no celular.** Ali os botões ficam em uma barra fixa no rodapé (`barra-contato.tsx:74`). Posto depois dela no código, o link aparece logo após o cartão do vendedor, longe dos botões. Dizer a posição no celular e o arquivo.
11. **A tabela só vale para as opções provisórias da decisão 3**, e não diz isso. Falta também repetir que a parte E só é publicada depois da decisão 4. Faltam testes para os dois links de confirmação e para a função nova.

### Parte A

12. **A forma mínima afeta outros caminhos.** Quem troca o número ou a foto a partir de "Meus dados" passa pela confirmação sem destino e hoje volta a "Meus dados" (`form-whatsapp.tsx:11`, `concluir-dados-clerk.tsx:23`, `foto-perfil.tsx:40`, `src/app/aki/page.tsx:27`). Com a mudança, cairia na página inicial. Listar esses arquivos e dar a eles destino explícito.
13. **A forma completa não está escrita para executar:** falta o nome da etiqueta, como anotá-la dentro do `middleware` (hoje ele não devolve resposta), quais parâmetros ficam de fora e como testar. Além disso, ela usa uma função criada na parte E, o que amarra as duas partes; a função deveria ter commit próprio.

### Partes B e D, e geral

14. **Parte B:** falta onde a frase entra e um teste. A alternativa "3 etapas" não tem detalhe.
15. **Parte D:** sem lista de arquivos, e a regra se contradiz ("trocar o que o comprador lê", mas um dos lembretes é texto para quem vende). Os textos dos avisos são gravados pelo banco; se algum for lido pelo comprador, só muda com migração, o que contraria "o banco não muda". Não conferido.
16. **Passo 0 e regra de parada.** O passo 0 não diz o que fazer quando um defeito não aparece (qual parte sai) nem quando os CUJs 1 ou 4 falham. A regra de parada cobra a diferença entre salvar e pedir, mas o teste não tem tarefa de salvar, e ela contradiz o bloqueio no banco previsto para depois.
17. **Ramos.** Falta dizer que cada parte entra no principal antes da seguinte, e que se um trecho citado mudou, para-se e avisa-se o dono.

## Detalhes

18. As linhas `radar-de-negocios.tsx:105,211,242` citadas no problema 2 estão velhas. Hoje: faixa 121, trecho borrado 225-238, botão 260-267.
19. "O código já faz isso para aba inválida" só vale para quem não vende; para quem vende, a aba inválida cai na região.
20. Usar o título real do anúncio, não o substituto "Anúncio sem título". Cortar por letra pode partir um emoji.
21. Citar botões pelo texto, não pelo número de linha.
22. Checagens vagas: "não sai do site" (dizer para onde vai), "sem erro de tela", "o HTML não traz pedido de ninguém" (a tela mostra os da própria pessoa).
23. Conferência da parte D deve incluir o CUJ 6, um pedido com proposta recebida e a tela de avisos.
24. Dizer onde registrar o resultado do teste final (`docs/USABILIDADE.md`).
25. O assistente Aki tem o mesmo defeito do desvio (`src/lib/aki/acoes.ts:87`). Fora do escopo; registrar.
26. O teste automático da confirmação cabe melhor em `tests/whatsapp.test.cjs` que em `tests/perfil.test.cjs`.

## Fato novo para o dono

A regra "apenas pago acessa" depende de uma marca em cada plano, e isso inclui o **plano grátis de pessoa física**, não só o teste grátis (`supabase/migrations/20261108010000_cobranca_planos.sql:180-190`). Se essa marca estiver ligada no plano grátis, quem não paga vê a aba. É conferir no painel.

## Conferido e certo

*   Todos os arquivos citados existem, inclusive os de teste. Os comandos `lint`, `typecheck`, `test`, `build` e `test:db` existem.
*   Conferem as citações de: abas do Radar, barra de abas com uma aba só, `linkPedirRadar`, os dois links "Confirmar meu celular", o aviso de WhatsApp que não aparece para ninguém, o corte de 300, o destino padrão da confirmação, a recusa de `//outro-site.com`, o `middleware`, `TOTAL_PASSOS` igual a 6, o teste do caminho da pessoa nova.
*   Nenhum teste atual quebra com as partes C ou E, pela leitura.

## Não conferido

*   Nada foi executado. O ramo principal não foi lido.
*   Migração do Radar em produção e a marca de acesso de cada plano no banco real.
*   Quais textos de aviso vêm do banco.
*   Se o `middleware` pode ser carregado pelos testes atuais.
