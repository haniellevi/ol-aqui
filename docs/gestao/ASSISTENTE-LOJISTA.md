# Mercado da Região · Assistente de IA do lojista

Sessão 5 da fila de gestão (grill-me de 13/11/2026). Base: `NEGOCIO-PLANO-COMERCIAL.md`, `OPERACAO-AGENTES.md`,
`PONTOS-INDICACAO-SORTEIO.md`, `MARKETING-TRAFEGO.md` e o código na `origin/main` de 13/11/2026.
Nada foi programado, publicado ou alterado em produção.

> Atenção para quem for programar: a pasta local estava no ramo `feat/home-3-colunas`, 222 commits atrás da
> `origin/main`. Os fatos abaixo foram conferidos na `origin/main`.

## 1. A ideia em uma frase

O lojista, que é ocupado e não é técnico, manda o encarte da semana, uma planilha ou fotos; o **Merc** prepara
os anúncios e as mudanças de preço; o **dono ou o gerente** confere numa tela simples e publica. Nada vai para o ar
sem um toque de uma pessoa.

## 2. O que já existe (não precisa decidir de novo)

| Já existe | Onde |
|---|---|
| Robô Merc (no código ainda "Aki"), só dentro do app, cria e altera **só rascunho**; publicar, pagar e apagar pedem toque da pessoa | `src/lib/aki/*`, `src/app/aki`, `src/app/api/aki` |
| "Merc do lojista": sugere categoria e descrição da loja, faz banner e fundo branco na foto (OpenAI, `gpt-6-luna`) | `src/lib/aki/lojista.ts`, migração `20261111000000_aki_lojistas.sql` |
| Gerente da loja por convite (WhatsApp confirmado). Hoje ele mexe na vitrine e vê o desempenho; **o que gasta IA, plano e pagamento são só do dono** | migrações `20261110140634_gerentes_loja.sql`, `20261114030000_ajudantes_loja.sql` |
| Painel do lojista: visitas, cliques no WhatsApp e no mapa, mais vistos, sugestões por regra, resumo semanal | migração `20261111050000_painel_loja.sql` |
| Lixeira reversível de anúncios e histórico de alterações | `20261109190459_lixeira_anuncios.sql`, `registrar_log` |
| Livro-caixa de gasto de IA (`robo_uso`) e teto de R$ 100/mês com alerta em 80% | `20261107031000_robo_aki.sql` |
| WhatsApp pela Evolution, **só envia** (código e avisos). Não recebe mensagens | `src/lib/whatsapp/servico.ts` |

**Não existe ainda:** preço de oferta e validade no anúncio, leitura de encarte, importação de planilha, créditos de
IA, fotos em lote, "repetir oferta", página Meu Marketing, entrada de mensagens pelo WhatsApp, transcrição de áudio.

## 3. Decisões

| # | Assunto | Decisão |
|---|---|---|
| 1 | Canal | **App primeiro** (área da loja, funciona no celular). WhatsApp **só quando entrar o WhatsApp oficial da Meta** (com 50 lojas, já decidido na sessão 1). Nunca pelo número dos códigos na Evolution |
| 2 | Robô | **Mesmo Merc** para atendimento e assistente do lojista |
| 3 | IA que lê | **GPT-6 Luna** (`gpt-6-luna`), que já está ligado no sistema. Trocável no painel `/admin/robo` |
| 4 | Teto de gasto | **Sem reserva separada**: tudo dentro dos R$ 100/mês já decididos (Merc + moderação + assistente). Motivo: o Merc usa um modelo barato (conferido em `/admin/robo` em 13/11/2026: DeepSeek V4.1 Flash; ver risco 7.7) |
| 5 | Ajuda humana | Sim, pela **regra 4.1 de `OPERACAO-AGENTES.md`** (dinheiro, golpe, pedir para falar com alguém, 2 tentativas sem resolver). Resposta em até 24h úteis |
| 6 | Quem confirma | **Dono e gerente.** Funcionário não existe como papel; o dono vê quem confirmou cada mudança |
| 7 | Gerente gasta IA | **Sim**, mudando a regra atual. Usa os **mesmos créditos da loja** |
| 8 | Créditos de IA | **10 por mês** no plano e no teste grátis, **não acumulam**. **1 crédito = 1 página ou imagem lida pela IA** (PDF de 4 páginas = 4) |
| 9 | Créditos extras | Pacotes de **R$ 10 (10 créditos)** e **R$ 20 (20 créditos)**, **R$ 1 por crédito**, pagos por **Pix no Asaas**, valem **12 meses**. Usa primeiro os do mês, depois os extras |
| 10 | Quem tem o assistente | **Só loja** (plano ou teste). Pessoa física não tem |
| 11 | Oferta no anúncio | **"De R$ X por R$ Y" com data de fim.** O anúncio guarda o preço normal e o preço de oferta |
| 12 | Oferta venceu | **Volta ao preço normal sozinho.** Se não havia preço normal, o anúncio é **pausado**. Aviso ao lojista **1 dia antes** |
| 13 | Produto que já tem anúncio | **A IA sugere** ("atualizar anúncio X" ou "novo"); o lojista troca se estiver errado; a escolha fica guardada para as próximas semanas |
| 14 | Foto de produto novo | **Recorte do próprio encarte**, com botão para trocar por foto tirada na hora. **A IA nunca busca foto na internet** |
| 15 | Preço suspeito | Linhas suspeitas **em amarelo**, conferidas **uma a uma**. As outras podem ir com "confirmar todas" |
| 16 | Desfazer | Botão **"desfazer importação" por 7 dias**: volta os preços de antes e manda os anúncios novos para a Lixeira. Depois, só anúncio por anúncio |
| 17 | Foto de terceiros | Ao confirmar, o lojista marca **"as fotos são minhas ou tenho permissão"**. Denúncia tira a foto e o anúncio fica com "foto pendente" |
| 18 | Planilha | **Importa quando o lojista manda** (Google Planilhas por link, ou arquivo Excel/CSV). Sem sincronização automática. Mostra só o que mudou e pede confirmação |
| 19 | Modelo de planilha | **Modelo nosso** (seção 5), mas **a IA aceita a planilha do jeito do lojista** e mostra como entendeu as colunas |
| 20 | Crédito da planilha | **Planilha no modelo: grátis** (não usa IA). Planilha fora do modelo: **1 crédito** por importação |
| 21 | Retorno da loja | **Resumo curto no assistente** ("120 visitas e 15 cliques no WhatsApp esta semana") com link para o painel completo, que já existe |
| 22 | Sorte da Região | O assistente mostra os **números da sorte** do lojista e o **link/QR de indicação de lojista** (1 mês grátis), **só quando a Sorte estiver ligada** |
| 23 | Facilidades escolhidas | **Repetir oferta**, **fotos em lote**, **página Meu Marketing**, **áudio** e **WhatsApp** (este com a Meta) |
| 24 | Criativo da semana | **Modelo pronto com a foto real** (foto, "de/por", logo da loja, marca do Mercado), em **stories e feed**. Não usa IA de imagem. A IA só escolhe os produtos e escreve a legenda |
| 25 | Crédito do criativo | **1 criativo por semana incluído** para loja pagante (nos dois formatos). Outro produto ou outra arte: **1 crédito** |
| 26 | QR e cartaz | O Meu Marketing entrega o **QR da loja** e mostra **quantos clientes vieram pelo cartaz** (depende do QR com rastreio pedido pelo Marketing) |
| 27 | Entrevista e prêmio | O lojista **não pede pelo assistente**. O Raniel convida |
| 28 | Cópia do Instagram | **Fora do começo** (não escolhida) |

## 4. Fluxos

### 4.1 Encarte (o principal)

1. **Entrada.** Na área da loja, botão "Mandar encarte". Aceita foto (JPG/PNG) ou PDF. O app mostra antes:
   "isto vai usar N créditos (você tem X)". PDF vira uma imagem por página antes de ir para a IA (o Luna não lê PDF
   direto).
2. **Leitura.** O Luna devolve uma lista: produto, marca, tamanho, preço de oferta, preço "de" (se o encarte tiver),
   validade (se o encarte tiver) e a posição da foto de cada produto.
3. **Casar com anúncios.** Para cada produto, o sistema procura anúncio da loja pelo **código** (se veio da planilha),
   depois pela **escolha guardada** de semanas anteriores, e por último por nome, marca e tamanho. Resultado:
   "atualizar anúncio X" ou "novo anúncio".
4. **Tela de conferência** (dono ou gerente):
   - uma linha por produto: foto recortada, nome, "de R$ X por R$ Y", até quando, e "novo" ou "atualiza X";
   - validade única no topo ("ofertas válidas até ___"), que vale para todas, com troca por linha;
   - **linhas amarelas** (preço de oferta maior que o normal, queda maior que 50%, número que a IA não leu bem,
     produto sem preço): precisam de um toque cada;
   - o lojista pode trocar o anúncio casado, trocar a foto, tirar a linha ou corrigir o preço;
   - categoria dos novos: sugerida pela IA que já sugere categoria no cadastro;
   - caixa "as fotos são minhas ou tenho permissão";
   - botão "confirmar todas" (só libera quando não há linha amarela pendente).
5. **Publicar.** Anúncios novos entram pela moderação normal (já existe). Os existentes mudam de preço. Tudo fica
   registrado como **uma importação** com quem confirmou e quando.
6. **Desfazer.** Por 7 dias, "desfazer importação" volta tudo.
7. **Vencimento.** No dia antes, aviso no app: "12 ofertas acabam amanhã. Repetir na semana que vem?". No dia
   seguinte ao fim, volta ao preço normal (ou pausa, se não havia preço normal).

### 4.2 Planilha

1. Botão "Importar planilha": colar o link do Google Planilhas (compartilhado para leitura) ou subir o arquivo.
2. Se as colunas forem as do modelo: lê sem IA (grátis). Se não forem: a IA mostra "entendi que a coluna B é o
   preço"; o lojista confirma (1 crédito).
3. Mesma tela de conferência do encarte, mostrando **só o que mudou** desde a última vez.
4. Mesma regra de desfazer por 7 dias.

### 4.3 Repetir oferta

Na lista de importações: "Repetir esta oferta". Reabre os mesmos produtos com novas datas; o lojista só ajusta os
preços que mudaram. Sem IA, sem crédito.

### 4.4 Fotos em lote

O lojista tira até 10 fotos de uma vez. A IA cria um rascunho por foto (título, categoria e descrição). Ele confere,
põe o preço e publica. 1 crédito por foto. O fundo branco (que já existe) continua opcional.

### 4.5 Página Meu Marketing

- **Criativo da semana** (loja pagante): a IA escolhe os produtos que mais renderiam (mais vistos, em oferta, com boa
  foto) e sugere 3; o lojista escolhe 1; o sistema monta a arte em **stories** e **feed** com a foto real, o preço,
  o logo e o link da loja. Pronto para baixar e postar.
- **QR da loja** para cartaz, e quantos clientes vieram por ele.
- **Sugestões do mês**: o que melhorar nos anúncios (sem foto, descrição curta, sem preço, muito visto sem clique),
  usando as sugestões por regra que o painel já faz.
- **Produtos procurados que a loja não tem**: a partir dos pedidos do Radar e das buscas da região
  ("esta semana 9 pessoas procuraram ventilador e você não anuncia").
- Resumo de retorno (visitas e cliques) com link para o painel.

### 4.6 Áudio (no app)

O lojista grava: "coloca o feijão a 8,99 até domingo". O áudio é transcrito, o Merc entende e prepara a mudança, que
vai para a mesma tela de conferência. Não publica sozinho. Conta 1 crédito por áudio de até 1 minuto
(sugestão; confirmar ao construir).

### 4.7 WhatsApp (quando entrar a Meta oficial)

O lojista manda encarte, foto ou áudio para o número do Mercado e recebe de volta um link para conferir no app.
**A conferência é sempre no app.** Só aceita mensagens do WhatsApp confirmado do dono ou de um gerente da loja.

## 5. Modelo de planilha

Uma linha por produto. Primeira linha com os nomes das colunas, exatamente assim:

| Coluna | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `codigo` | Não (recomendado) | 7891234 | Código do produto na loja. Liga a linha ao anúncio certo nas próximas importações |
| `produto` | Sim | Arroz branco tipo 1 | Nome que aparece no anúncio |
| `marca` | Não | Tio João | Ajuda a casar e entra no título |
| `tamanho` | Não | 5 kg | Peso, volume ou unidade |
| `preco_normal` | Sim | 32,90 | Preço de sempre |
| `preco_oferta` | Não | 27,90 | Se preenchido, mostra "de/por" |
| `oferta_ate` | Se tiver oferta | 20/11/2026 | Último dia da oferta |
| `no_ar` | Não (padrão "sim") | sim | "não" pausa o anúncio |

Regras: preço com vírgula ou ponto; data em dd/mm/aaaa; categoria e foto **não** vão na planilha (a categoria é
sugerida e a foto vem do anúncio que já existe ou é adicionada na conferência). O modelo fica para baixar
(Google Planilhas e Excel) com 3 linhas de exemplo.

## 6. Custos

Fonte dos preços: [OpenAI pricing](https://developers.openai.com/api/docs/pricing) e
[guia de imagens](https://developers.openai.com/api/docs/guides/images-vision), lidos em 13/11/2026. Dólar R$ 5,51
(fechamento de 09/11/2026, [Brasil61](https://brasil61.com/n/dolar-hoje-fecha-em-leve-alta-a-r-5-51-apos-oscilar-entre-queda-e-valorizacao-bras2617447)).

| Item | Preço oficial | Custo estimado |
|---|---|---|
| GPT-6 Luna | US$ 0,10 entrada / US$ 0,50 saída por milhão de tokens | — |
| 1 imagem de encarte (1500×2000, ~3.000 tokens de imagem + 3.000 de resposta) | — | **~R$ 0,01** |
| PDF de 4 páginas (cada página como imagem) | sem tabela oficial por página | **~R$ 0,015 a R$ 0,04** (estimativa) |
| Transcrição de áudio (`gpt-4o-mini-transcribe`) | US$ 0,003 por minuto | ~R$ 0,02 por minuto |
| Criativo da semana | modelo pronto, sem IA de imagem | ~R$ 0 (só a legenda, centavos) |

**Pior caso do assistente** (100 lojas usando os 10 créditos do mês): 1.000 páginas × ~R$ 0,01 = **~R$ 10 a R$ 15/mês**,
dentro do teto de R$ 100. Comparação: o Claude Haiku 5.5 sai parecido (~R$ 0,01 por imagem) e o Claude Sonnet 5.5
~R$ 0,18 a R$ 0,33 por encarte ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)).

**Créditos extras:** vendidos a R$ 1 cada, custam ~R$ 0,01 de IA. A taxa do Asaas por Pix em pacote de R$ 10
**não foi conferida** (pode comer parte da margem).

Os números de tokens são estimativas. O custo real aparece no `robo_uso`; medir com 3 encartes reais antes de ligar.

## 7. Riscos

1. **Preço errado lido pela IA vai para o ar.** Defesa: linhas amarelas, conferência humana, desfazer em 7 dias.
   Testar com 3 encartes reais de Corrente e conferir preço por preço antes de ligar.
2. **Falsa promoção ("de" inflado).** O Código de Defesa do Consumidor proíbe propaganda enganosa; o preço "de" deve
   ser o preço real praticado. Colocar essa regra no termo do lojista e na tela de conferência. O Mercado é
   intermediário, mas pode ser cobrado. (Não é parecer jurídico: levar ao advogado junto com a Sorte.)
3. **Foto de terceiros** (indústria, outro site): declaração do lojista + remoção por denúncia. Não elimina o risco.
4. **Gerente gastando créditos**: mudança na regra de hoje ("o que gasta IA é só do dono"). O dono vê quem gastou.
5. **Oferta vencida no ar** se a rotina de vencimento falhar. A rotina entra na vigia do sistema.
6. **PDF**: a OpenAI não publica o custo por página para o Luna. Medir no primeiro teste.
7. **Modelo do Merc (conferido em 13/11/2026)**: `OPERACAO-AGENTES.md` diz `claude-opus-5-5`, mas o painel
   `/admin/robo` em produção mostra **DeepSeek V4.1 Flash 1017 pelo OpenRouter**, tanto na conversa quanto na foto.
   Merc ligado em todas as regiões; gasto do mês R$ 0,03 com 19 respostas; orçamento R$ 100, alerta em 80%.
   A chave da Anthropic **não está configurada** (o Claude Haiku não é opção sem ela); OpenAI e OpenRouter estão.
   O GPT-6 Luna (para ler encartes) está no catálogo com US$ 0,10 / 0,50. Risco restante: se alguém trocar o Merc
   para o Opus no painel, o teto único sem reserva pode acabar cedo e travar a leitura de encartes.
8. **WhatsApp**: receber arquivos pela Evolution no número dos códigos poderia bloquear o login de todos. Por isso
   o WhatsApp do assistente só entra com a Meta oficial.
9. **Lojista aperta "confirmar" sem olhar.** Por isso as linhas amarelas exigem toque uma a uma.

## 8. Ordem de construção

1. **Encarte**: campos de oferta no anúncio ("de/por" e validade) + rotina de vencimento e aviso + créditos de IA
   (10/mês, saldo, extras por Pix) + leitura pelo Luna + tela de conferência + importação com desfazer + gerente
   podendo usar. Antes de ligar: teste com 3 encartes reais.
2. **Repetir oferta** (sem IA).
3. **Planilha** (modelo grátis; fora do modelo com IA).
4. **Fotos em lote.**
5. **Meu Marketing**: criativo da semana (modelos stories/feed), QR e contagem do cartaz, sugestões do mês, produtos
   procurados pelo Radar, resumo de retorno no assistente, números da Sorte e link de indicação (quando a Sorte
   estiver ligada).
6. **Áudio no app.**
7. **WhatsApp** (quando entrar a Meta oficial).

Cada etapa: programar com dados fictícios, revisar, pedir "sim" para publicar e para aplicar migração em produção.

## 9. Perguntas que passam para outras sessões

| Sessão | Pergunta |
|---|---|
| 1. Negócio | Acrescentar ao plano: **10 créditos de IA por mês** no plano e no teste; **pacotes extras de R$ 10 e R$ 20** (R$ 1 por crédito, validade 12 meses, Pix no Asaas). A taxa do Asaas por Pix pequeno compensa um pacote de R$ 10? |
| 2. Operação | (Feito em 13/11/2026: `OPERACAO-AGENTES.md` corrigido; o Raniel decidiu **manter o DeepSeek V4.1 Flash** no Merc.) Teto de R$ 100 **sem reserva** para o assistente: acompanhar no diário das 7h. Pedidos de ajuda humana do assistente entram na aba "Hoje" |
| 4. Marketing | Desenhar os **modelos de criativo** (stories e feed) com a marca do Mercado. O QR por loja com rastreio (UTM) é pré-requisito do "clientes que vieram pelo cartaz". Entrevista no YouTube e prêmio da Sorte: **o Raniel convida**, o assistente não recebe pedidos |
| 3. Sorte da Região | O assistente mostra os números do lojista e o link de indicação **só com a Sorte ligada**. Confirmar o nome do botão que liga |
| 6. MCP do sistema | Dar ao agente leitura de: importações de encarte (quantas, quantas linhas amarelas, quantas desfeitas), gasto de créditos por loja e ofertas que vencem amanhã. Nenhuma escrita sem "sim" |
| Advogado (fora da fila) | Regra do preço "de/por" (propaganda enganosa) e uso de fotos de encarte de indústria |
