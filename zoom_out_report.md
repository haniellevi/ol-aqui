# Revisão, etapa 5: visão de cima

*   **Documento revisado:** `docs/designs/clareza-anunciar-radar.md` (linhas 1 a 333)
*   **Data:** 2026-11-10
*   **Revisores:** visão de cima (zoom-out) e saídas inventivas, cada um sem o contexto da conversa
*   **Limite:** tudo abaixo vem de leitura de código. Nada foi aberto no navegador.

**Contagem:** 1 bloqueio, 7 importantes, 9 detalhes.

--------------------------------------------------------------------------------

## Bloqueio

### 1. A parte A conserta um caminho que a pessoa nova provavelmente não percorre

**Onde no documento:** Problema 1, CUJ 1, CUJ 4, parte A.

**O que o código mostra** (conferido também por quem conduz a revisão):

*   Quem toca em "Anunciar" sem conta vai para `/entrar`. O login e o cadastro mandam sempre para `/completar-perfil` levando o destino (`src/app/entrar/[[...entrar]]/page.tsx:30-35`).
*   `/completar-perfil` manda para a confirmação do WhatsApp **com** o destino, e depois do código e dos termos segue para ele (`src/app/completar-perfil/page.tsx:35-37`).
*   Já existe teste que trava isso, incluindo `/radar/pedir?q=...` (`tests/fluxo.test.cjs:180-192`).

**Consequência:** os CUJs 1 e 4, como escritos, provavelmente já funcionam hoje. A queda em "editar meus dados" só pega um caso mais estreito: quem já está logado, ainda não confirmou o WhatsApp (por exemplo, fechou a tela do código) e depois toca em "Anunciar".

**Por que bloqueia:** se a parte A cair no passo 0, sobra para "travaram no Anunciar" só a troca de uma frase (parte B). A maior peça técnica do plano, a mudança no `middleware`, ficaria sem motivo, e a causa do travamento continuaria desconhecida.

**O que mudar:**

*   Reescrever o Problema 1 e o CUJ 1 para o caso real (pessoa já logada, sem WhatsApp confirmado).
*   Marcar os CUJs 1 e 4 como "conferir que continua funcionando".
*   Dizer que a parte A só é feita se o passo 0 reproduzir o caso estreito, e o que acontece se não reproduzir.

--------------------------------------------------------------------------------

## Importante

### 2. A medida de sucesso não é movida por este desenho

O alvo é "publicar em menos de 2 minutos", mas o desenho declara que não reduz o número de telas. O teste final pode falhar no alvo sem que isso diga algo sobre este trabalho. **Mudar:** medir o que o desenho altera (não cai em "editar meus dados"; não pergunta "são 3 ou 6 passos?"; explica o Radar com as próprias palavras), ou escrever que o alvo de 2 minutos fica para o desenho que reduzir telas.

### 3. A dúvida que decide o item 1 continua aberta

Não se sabe se as pessoas travaram antes de tocar no botão ou depois. O documento supõe "depois". **Mudar:** responder isso antes das partes A e B, com uma conversa com quem testou. As partes C e E não dependem dessa resposta.

### 4. A meta "um nome só em todo o site" não bate com o plano

O plano mantém "Radar de Negócios" em planos, cobrança, `src/app/layout.tsx:19`, `quero-vender/page.tsx:59` e `limite-atingido.tsx:75`. E a lista da parte D deixa de fora textos do comprador que dizem "ofertas" ou "contatos":

*   `src/app/radar/page.tsx:23`
*   `src/components/radar/listas-radar.tsx:25`
*   `src/app/radar/pedido/[id]/page.tsx:57`
*   `src/components/radar/acoes-pedido.tsx:56,61,68`
*   `src/lib/dados/radar.ts:189`
*   `src/app/(conta)/minha-conta/notificacoes/page.tsx:30`

**Mudar:** a meta vira "um nome só nas telas do comprador" e a lista é completada, ou o plano cobre o site inteiro.

### 5. A parte D pode ser feita duas vezes, e um item dela já existe

*   As palavras são provisórias; se os testadores preferirem outras, cerca de dez arquivos são trocados de novo.
*   A frase que explica o Radar para quem está logado e não pediu nada **já está na tela**: "Diga o que você procura e as lojas da região mandam ofertas para você." (`src/components/radar/listas-radar.tsx:25`). A afirmação do documento de que só o visitante lê a explicação não confere.

**Mudar:** tirar a parte D até haver as palavras dos testadores, ou reduzi-la. Corrigir a afirmação e a linha correspondente da tabela.

**Saída proposta pelo revisor inventivo:** guardar as frases do Radar do lado do comprador em um arquivo só. A parte D entra cedo com palavras provisórias e a troca depois vira edição de um arquivo. Custo: o arquivo precisa guardar frases inteiras, porque em português a palavra muda o artigo e a concordância.

### 6. A parte C vai além do problema relatado

O problema relatado é o comprador ver a tela de lojista. Para isso basta esconder a aba de quem não vende. O plano também tira a aba e o cartão borrado de quem vende sem plano. No código esse cartão é descrito como o gancho que vende o plano (`src/components/radar/radar-de-negocios.tsx:199`). **Mudar:** registrar que a decisão do dono remove a vitrine de venda do Radar para vendedor sem plano, e fechar a pergunta em aberto sobre a linha com link.

### 7. Número de passos: a opção recusada custa menos do que o documento diz

O documento recusou agrupar o cabeçalho em 3 etapas porque mexeria na navegação e nos endereços. O revisor mostra que não mexe: o cabeçalho só escreve um texto a partir da lista em `src/components/anunciar/passos.ts`. Dar a cada passo uma "etapa" (Fotos = 1; Categoria, Detalhes, Preço e Local = 2; Revisar = 3) faz o cabeçalho dizer "Etapa 2 de 3" e a introdução continuar com "1, 2, 3". Dois arquivos, sem mudança de fluxo. Custo: a etapa 2 dura 4 telas e o número fica parado enquanto a barra anda. Dizer "6 passos" na primeira tela pode assustar quem deveria terminar em 2 minutos.

### 8. A espera pelo trabalho do Codex pode já ter acabado

O documento manda esperar o trabalho sem commit em `src/lib/rotas.ts`. O repositório está agora na `main`, com o PR 43 mesclado, e `rotas.ts` já traz os endereços de atendimento. **Mudar:** atualizar esse aviso.

--------------------------------------------------------------------------------

## Detalhe

9.  **Segundo link que perde o texto do anúncio.** `src/components/radar/form-pedido.tsx:254` tem o mesmo endereço fixo que o plano corrige em `radar/pedir/page.tsx:54`. Incluir. A função nova em `rotas.ts` deve servir também a `completar-perfil/page.tsx:35` e `minha-conta/verificacao/page.tsx:31`.
10. **Consulta a mais desnecessária.** Para quem não vende, a resposta já é "não vê a aba", sem consultar o acesso. Consultar só quando a pessoa vende.
11. **Lugar e nome do link.** A página do anúncio já tem a seção "Parecidos na região" (`conteudo-anuncio.tsx:216-221`). "Procuro algo parecido" ao lado dela pode confundir. Sugestão: pôr o link junto dessa seção, e considerar também o anúncio vendido.
12. **Título longo com acentos.** `completar-perfil/page.tsx:25` corta o destino em 300 letras. Um título perto de 120 letras com acentos, mais a categoria, pode passar disso depois de codificado. Acrescentar à conferência da parte E.
13. **Como testar a regra das abas.** Dizer que o teste carrega `src/app/radar/page.tsx` com dependências trocadas, como `tests/fluxo.test.cjs` já faz, para ninguém criar módulo novo só para testar.
14. **Números de linha.** `linkPedirRadar` está em `src/lib/rotas.ts:49-56`; a regra das abas em `src/app/radar/page.tsx:65`; o destino em `confirmar-celular/page.tsx:24-25`.
15. **A frase sobre o Radar não aparece no primeiro encontro.** A meta pede a frase no primeiro lugar em que a pessoa encontra o Radar; o plano a põe depois do toque. Saída: balão pequeno sobre o ícone nas primeiras visitas. Custo: mais um elemento sobre a tela do celular; chega perto da reforma visual, que está fora.
16. **Medir pedidos vindos do link sem mexer no banco.** Marcar o link com `origem=anuncio`, como o site já faz em `/planos?origem=radar`. Custo: conta quem abriu o formulário, não quem enviou, e o site não tem ferramenta de medição instalada.
17. **Vendedor sem plano: linha com número.** "Há N pedidos abertos na sua região", contando o que o banco já devolve, sem mostrar nenhum. Custo: uma consulta a mais; com poucos usuários o número pode desanimar.

--------------------------------------------------------------------------------

## Ponto a conferir sobre "tela ou banco"

O documento justifica adiar o bloqueio no banco por não haver "banco de testes separado". O projeto tem `npm run test:db` e um teste próprio da função da lista (`supabase/testes/330_radar_feed_nichos.sql`). O revisor não verificou contra qual banco esses testes rodam. Se for um banco local, o motivo do adiamento é mais fraco do que o texto diz.

## O que os revisores não pediram para mudar

*   Contexto, limite declarado ("lido no código, não reproduzido") e passo 0.
*   Sem tabela, dependência ou custo novo; reuso de `linkPedirRadar`, `caminhoInterno`, `acessoRadar` e do comportamento de `abas-radar.tsx:13`.
*   Parte E como menor mudança possível para o que se propõe.
*   Alternativas rejeitadas: bloqueio no banco agora, checagem em cada tela, `middleware` consultando o banco.
