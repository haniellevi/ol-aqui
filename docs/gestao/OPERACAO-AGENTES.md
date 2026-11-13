# Mercado da Região · Operação com agentes de IA

Data: 13/11/2026. Origem: entrevista (grill-me 2 de 6) com o Raniel. **Resumo confirmado pelo Raniel em 13/11/2026.**
Base: `NEGOCIO-PLANO-COMERCIAL.md` (sessão 1), `PLANO-CRESCIMENTO-2026-11-11.md`, `MODERACAO-IA.md`,
`MODERACAO-ANUNCIOS.md`, `GESTAO-USUARIOS-LOJAS.md`, `etapa5/equipe.md`, `PAINEL-ADMIN.md` e o código da `origin/main`.
Nada foi programado, instalado, publicado ou alterado em produção.

Princípio: **os agentes fazem, o Raniel aprova.** Nenhum agente gasta dinheiro, dá desconto ou cortesia, apaga dados,
publica ou responde por lei sem o "sim" de uma pessoa.

## 1. Decisões fechadas

| Tema | Decisão |
|---|---|
| Equipe hoje | **Só o Raniel.** Tudo o que precisa de gente cai para ele. Contratar ajudante: decidir depois |
| Ferramenta dos agentes | **Claude Code com tarefas agendadas + rotinas do próprio app.** Sem Paperclip e sem n8n por agora |
| Cérebro (memória e wiki) | **Pasta `docs` do repositório**, aberta como cofre no Obsidian |
| Rotina diária | **Agente na nuvem, todo dia às 7h**, escreve o "Diário do dia" e abre um PR só de texto para o Raniel aceitar |
| Onde o Raniel recebe | **WhatsApp curto (3 a 5 linhas + link)** + aba **"Hoje"** no painel com os botões de aprovar. Urgência chega na hora |
| Atendimento | **WhatsApp + página de ajuda no app**, a IA responde primeiro |
| Número do atendimento | **O mesmo número dos códigos de acesso** (escolha do Raniel; risco na seção 8) |
| Quando passa para humano | Regra padrão (seção 4.1). Resposta humana em até **24h úteis** |
| Moderação de anúncios por IA | **Ligar no lançamento** (`moderacao.ia_ativa`) |
| Robô Merc (antigo Aki) | **Ligar no lançamento**, com o **DeepSeek V4.1 Flash pelo OpenRouter** (conferido em `/admin/robo` e mantido pelo Raniel em 13/11), teto de **R$ 100/mês** (dividido com a moderação), alerta em 80% |
| Cobrança vencida e renovação | **WhatsApp automático no dia −7, 0 e +3** com o link de pagamento. Com **+7 dias vencido**, vira tarefa para o Raniel ligar ou visitar |
| Custos fixos no painel | **Cadastrados 1 vez e repetidos todo mês**; IA e taxas do Asaas entram sozinhas; no dia 1 um agente confere e pede "sim" se algum valor mudou |
| Monitoramento | **Vigias grátis** (site no ar a cada 5 min + registro de erros) + o agente da manhã explica. **Teste de restaurar o backup 1 vez por mês** |
| Visitas às 30 lojas (mês 1) | **O Raniel visita**; a IA prepara a lista, o roteiro do dia e registra o resultado de cada visita |
| Trilha de conhecimento | **A IA explica quando o tema surgir**. A seção 6 guarda a lista dos temas que não podem faltar |

## 2. Ferramenta: por que Claude Code + rotinas do app

Pesquisa de 13/11/2026 (completa em `pesquisa-agentes-operacao.md`, na pasta de notas compartilhadas). Câmbio US$ 1 = R$ 5,63.

| Opção | Prós | Contras | Custo/mês |
|---|---|---|---|
| **Claude Code + rotinas do app (escolhida)** | O que roda 24h já mora no sistema (17 rotinas `pg_cron`, fila de WhatsApp, moderação, verificação de lojas, robô Merc). Os agentes de gestão leem o painel e escrevem no Obsidian. Sem sistema novo para manter | Aprovação humana precisa ser desenhada no painel (aba "Hoje"). As rotinas na nuvem do Claude ainda são prévia e têm limite por dia (Pro 5, Max 15, segundo terceiro; não confirmado na página oficial) | Assinatura do Claude que o Raniel já tem + IA do app (teto R$ 100) |
| n8n | Fluxos visuais, nó de WhatsApp e aprovação humana pronta | Mais um sistema para pagar e manter; repete o que o app já faz | Starter €20 (≈ R$ 124, câmbio do euro estimado) |
| Paperclip | Organograma de agentes com orçamento por agente, fila de aprovação, agendas. Grátis (MIT) | Projeto novo, partes "experimentais", ~3,8 mil problemas abertos, sem auditoria de segurança achada, precisa de servidor e alguém técnico | Software R$ 0 + servidor ≈ R$ 56 a 169 (estimativa de terceiro) + modelos |

**Quando rever:** Paperclip ou n8n só quando houver uma pessoa técnica na equipe ou quando as rotinas do Claude não
derem conta (limite diário). Fontes: [paperclip.ing](https://paperclip.ing/llms.txt), [github paperclipai](https://github.com/paperclipai/paperclip), [n8n.io/pricing](https://n8n.io/pricing/).

## 3. Cérebro no Obsidian e rotina diária

### Onde fica
- O cofre é a pasta **`docs/`** do repositório OLAQUI, aberta no Obsidian. Fica no GitHub, com histórico.
- Estrutura nova sugerida (a pasta hoje é plana, com documentos em MAIÚSCULAS):
  - `docs/gestao/` — decisões de negócio e operação (este documento, o plano comercial).
  - `docs/gestao/diario/AAAA-MM-DD.md` — o Diário do dia.
  - `docs/gestao/wiki/` — páginas vivas: FAQ do atendimento, lojas visitadas, glossário, custos fixos.
  - `docs/gestao/decisoes.md` — registro de decisões do Raniel, com data (uma linha por decisão).
- A memória do Claude Code (`~/.claude/projects/.../memory/`) continua existindo, mas o que importa para a gestão
  passa a ser copiado para `docs/gestao/`, que é o lugar oficial.

### Quem escreve
- **Agente das 7h**: escreve o diário e atualiza a wiki (FAQ, buscas sem resultado). Sempre por **PR só de texto**.
- **Raniel**: aceita o PR, escreve decisões e anotações direto no Obsidian.
- **Sessões de programação**: atualizam os documentos técnicos que já existem.
- Agente **nunca** escreve no diário senhas, chaves, telefones ou dados pessoais de clientes (LGPD): usa só números e
  nomes de loja.

### Rotina diária (7h, na nuvem)
1. Lê o painel (números, filas, saúde do sistema). Quando existir, usa o MCP do sistema (sessão 6).
2. Escreve `docs/gestao/diario/AAAA-MM-DD.md` com quatro blocos:
   - **Tarefas que esperam o Raniel**: fila de moderação, conversas passadas para humano, lojas com +7 dias vencidas,
     verificações de loja, aprovações pendentes.
   - **Números do dia**: lojas pagantes, em teste, vencidas; receita; gasto de IA × teto; lucro do mês × ponto de
     equilíbrio (38 a 47 lojas).
   - **Saúde do sistema**: site fora do ar, erros, falhas no envio de WhatsApp, rotinas que não rodaram, backup.
   - **Aprendizados e decisões**: perguntas novas do atendimento (viram FAQ), buscas sem resultado (lojas para
     convidar), decisões tomadas na véspera.
3. Abre o PR e manda ao Raniel um WhatsApp curto: 3 a 5 linhas + link.
4. Se o PR não for aceito no dia, o diário seguinte avisa.

Fora da rotina: **site fora do ar** avisa na hora (vigia grátis), sem esperar as 7h.

## 4. Mapa de agentes

| Agente | O que faz sozinho | O que passa para o Raniel | Onde roda | Custo/mês |
|---|---|---|---|---|
| **Atendimento** (robô Merc no WhatsApp + ajuda no app) | Responde perguntas comuns: como anunciar, como pagar, Radar, plano, teste grátis. Busca anúncios. Sugere a página de ajuda | Regra da seção 4.1 | Dentro do app (Merc) | Dentro do teto de R$ 100 |
| **Moderação de anúncios** | Publica anúncio comum na hora (já existe). IA libera retidos por preço/palavra com confiança ≥ 98% | Termos sexuais ou violentos (sempre), dúvidas da IA, denúncias. Fila 1×/dia, prazo 24h | App (`pg_cron` a cada minuto) | ≈ R$ 7 por mil anúncios, dentro do teto |
| **Moderação de cadastros / verificação de lojas** | IA + BrasilAPI conferem CNPJ, documento e selfie (já ligado desde 12/11) | Casos divergentes (fila `/admin/lojas`, prazo 24h) | App | OpenRouter, centavos por loja |
| **Denúncias** | Oculta o anúncio com 3 denúncias (já existe) | Decidir procedente/improcedente; congelar (Compliance) é só do administrador | App | R$ 0 |
| **Categorias** | JEV sugere a categoria (já ligado); painel "Acertos da IA" | Erros que o painel mostrar | App | Centavos |
| **Cobrança e renovação** | WhatsApp no dia −7, 0 e +3 com link do Pix/boleto; pagamento confirmado pelo webhook do Asaas | Lojas com +7 dias vencidas (ligar/visitar); qualquer desconto, cortesia, devolução ou contestação | App (rotina de hora em hora + fila de WhatsApp) | Taxa do Asaas por cobrança; WhatsApp Evolution R$ 0 por mensagem |
| **Financeiro / custos** | Soma IA e taxas do Asaas; repete os custos fixos; no dia 1 confere as faturas | Valor de custo fixo que mudou (pede "sim") | Claude Code (tarefa do dia 1) + painel | Assinatura do Claude |
| **Vigia do sistema** | Confere o site a cada 5 min; guarda erros; o agente da manhã explica | Site fora do ar (na hora); erro repetido; backup que não restaurou | Serviços grátis + agente das 7h | R$ 0 (planos grátis) |
| **Diário / cérebro** | Escreve o diário, atualiza FAQ e lista de buscas sem resultado | Aceitar o PR | Claude Code na nuvem, 7h | Assinatura do Claude |
| **Visitas** | Monta a lista de lojas e o roteiro do dia; registra o resultado de cada visita | A visita em si | Claude Code | Assinatura do Claude |

### 4.1 Quando o atendimento passa para humano
A IA passa a conversa para o Raniel (e avisa no WhatsApp dele e na aba "Hoje") quando:
1. envolve **dinheiro**: devolução, cobrança errada, contestação, desconto;
2. **golpe ou ameaça** (comprador ou vendedor);
3. **polícia ou justiça** (ofício, pedido de dados) → tela Compliance, só administrador;
4. pedido de **apagar ou exportar dados** (LGPD);
5. a pessoa **pede para falar com alguém**;
6. a IA **não resolve em 2 tentativas**.

Prazo de resposta humana: **até 24h úteis**. A IA avisa a pessoa desse prazo. A IA **nunca** promete devolução,
desconto, cortesia ou prazo de solução.

### 4.2 Teto de gasto de IA
- Orçamento único `robo.orcamento_mensal_centavos` = **R$ 100/mês** (Merc + moderação + Merc do lojista). Alerta em 80%.
  Ao bater o teto, o robô descansa até o mês seguinte e a moderação cai para a fila humana.
- O Radar com IA tem teto próprio de R$ 30/mês (já decidido na sessão 1).
- O Merc usa o **DeepSeek V4.1 Flash 1017 pelo OpenRouter** (`deepseek/deepseek-v4.1-flash-1017`), na conversa e na foto.
  Conferido em `/admin/robo` em 13/11/2026 e mantido pelo Raniel (substitui a anotação anterior de `claude-opus-5-5`,
  que não era o modelo em uso). Gasto do mês na conferência: R$ 0,03 com 19 respostas. A chave da Anthropic não está
  configurada. Risco na seção 8.

## 5. Trabalho humano indispensável (só o Raniel)

| O quê | Por quê |
|---|---|
| Aprovar dinheiro: devolução, cortesia, desconto, mudança de preço, custo que mudou | Gasto e receita são decisão do dono |
| Responder polícia, justiça e ofícios (tela Compliance) | Responsabilidade legal (Marco Civil); exige motivo registrado |
| Pedidos de LGPD (apagar ou exportar dados) | Responsabilidade legal do controlador dos dados |
| Decidir casos de golpe, congelar anúncio, suspender loja por fraude | Afeta a pessoa; precisa de julgamento |
| Conferir anúncios com termos sexuais ou violentos | Regra do sistema: a IA não libera esses casos |
| Ligar para lojas com +7 dias vencidas | Relação com o cliente; evita cancelamento |
| Visitar as lojas (30 no mês 1) | Venda presencial; cria a loja e os 5 primeiros anúncios junto |
| Aceitar o PR do diário e registrar decisões | O cérebro só vale se o dono confere |
| Ligar e desligar IA, mudar tetos e chaves | Controle de gasto e de risco |
| Publicar código, fazer merge, mudar produção | Regra do Raniel: só com "sim" |
| Contratar ajudante | Decidir depois (não definido agora) |

## 6. Trilha de conhecimento (sob demanda)

Decisão: **a IA explica quando o tema surgir**, com exemplo do próprio Mercado da Região. Para não deixar buraco, o
agente das 7h confere esta lista e, quando um tema aparecer no dia, explica em 5 linhas no diário e marca como visto
em `docs/gestao/wiki/trilha.md`.

1. **Os dois lados do marketplace**: sem anúncio não vem comprador, sem comprador o lojista não paga. Por que começar
   pelas lojas (visitas) e só depois tráfego pago.
2. **Números que importam**: lojas pagantes, cancelamentos, receita fixa mensal, custo por loja, ponto de equilíbrio,
   conversão do teste grátis.
3. **Golpes comuns em classificados**: falso comprador, falso pagamento (comprovante de Pix falso), anúncio clonado,
   pedido de sinal. O que fazer em cada um.
4. **Moderação**: o que é proibido anunciar, denúncias, quando congelar.
5. **Lei**: Marco Civil (guardar registros 6 meses, responder ofício), LGPD (dados pessoais, pedido de apagar),
   Código do Consumidor (o Mercado é intermediário, não o vendedor), termos de uso e política de privacidade
   (seção 1 ainda com razão social/CNPJ/DPO "a preencher"), sorteio só com autorização.
6. **Dinheiro**: Asaas (Pix, boleto, cartão, taxas, devolução, contestação de cartão), anual como caixa adiantado.
7. **Sistema no ar**: o que é Vercel, Supabase, Clerk e Evolution; o que fazer quando o site cai; backup.
8. **Custo de IA**: por que existe teto, o que acontece quando bate.
9. **WhatsApp**: risco de bloqueio do número, limite de mensagens, quando migrar para a API oficial (50 lojas).
10. **Atendimento**: tom de voz, prazo de resposta, como transformar perguntas repetidas em FAQ.

## 7. O que precisa ser construído (para as sessões de programação)

Nada disto existe hoje (conferido na `origin/main` em 13/11/2026):
1. **WhatsApp de cobrança**: hoje `plano_vencendo` e `plano_vencido` saem só no aviso do app; a fila de WhatsApp só
   envia código de acesso e avisos de verificação. Ligar o envio por WhatsApp no −7, 0 e +3 e criar a tarefa de +7.
2. **Atendimento pelo WhatsApp**: hoje não há chat de suporte; o número de suporte (`contato.whatsapp_suporte`) está
   vazio. Receber mensagens do número no app e responder com o Merc, com a regra de passar para humano (4.1).
3. **Aba "Hoje" no painel** com as tarefas e os botões de aprovar (já decidida na sessão 1, seção 5).
4. **Custos fixos recorrentes** no painel (lucro do mês, já decidido na sessão 1, seção 4).
5. **Registro de visitas** às lojas (lista, roteiro, resultado).
6. **Vigias**: alarme de site fora do ar e registro de erros (hoje não há Sentry nem health check).
7. **Backup**: responsável e teste de restauração (hoje "Pendente" em `preparacao-piloto/liberacao.md`; o backup do
   banco não cobre as fotos do Storage).
8. **Rotina das 7h** (tarefa agendada do Claude Code na nuvem) e a estrutura `docs/gestao/diario` e `wiki`.
9. (Retirado: o modelo do Merc não muda.)
10. Envio de e-mail não existe; não é necessário para esta operação.

## 8. Riscos

- **Mesmo número para códigos e atendimento** (escolha do Raniel): se o WhatsApp bloquear o número, caem juntos o
  login por código e o atendimento. A Evolution não é oficial e já tem risco de bloqueio. Mitigar: limitar volume do
  atendimento, ter um chip reserva pronto e migrar para a API oficial da Meta com 50 lojas (já decidido).
- **Rotinas na nuvem do Claude em prévia**, com limite por dia e preço de excedente não publicado. Se falhar, a rotina
  pode rodar no computador do Raniel (só funciona com ele ligado).
- **Só uma pessoa**: férias, doença ou a agenda da Igreja 12 param as filas humanas. O diário mostra o tempo gasto
  em trabalho manual para decidir a contratação depois.
- **Teto de R$ 100 dividido entre Merc, moderação e assistente do lojista**: com o DeepSeek o risco de estourar é baixo, mas se alguém trocar o modelo no painel para um caro (Opus, Sonnet, Sol), o teto pode ser atingido cedo no mês. Aí o Merc para até o mês seguinte e a moderação por IA cai para a fila humana. Trocar o modelo do Merc pede "sim" do Raniel; acompanhar o gasto × teto no diário das 7h nas primeiras semanas.
- **Sem backup testado** hoje e sem alarme de site fora do ar.
- **Trilha sob demanda** pode deixar buracos em lei e golpes; por isso a lista da seção 6.

## 9. Perguntas que passam para outras sessões

| Sessão | Pergunta |
|---|---|
| 3. Pontos, indicação e sorteio | O agente antifraude (JEV) confere indicações e números da sorte: quem aprova os casos duvidosos e em que prazo? |
| 4. Marketing e tráfego pago | Material da visita às 30 lojas (QR, cartaz, roteiro de conversa) que a IA vai usar para montar o roteiro do dia. Quem acompanha o tráfego pago no diário? |
| 4. Marketing e tráfego pago | As "buscas sem resultado" do diário viram lista de lojas para convidar: isso entra na estratégia de prospecção? |
| 5. Assistente do lojista | O Merc do lojista e o atendimento usam o mesmo robô e o mesmo teto de R$ 100? O lojista pode pedir ajuda humana pelo assistente? |
| 6. MCP do sistema | O MCP deve dar ao agente das 7h leitura de: filas (moderação, verificação, atendimento), lojas vencidas, números do BI, gasto de IA e saúde do sistema? Nenhuma escrita sem aprovação humana? |
| 6. MCP do sistema | O registro de visitas e os custos fixos podem ser lançados pelo agente via MCP (com "sim" do Raniel)? |
| Programação (fora da fila) | Itens da seção 7, em ordem de lançamento: WhatsApp de cobrança, vigias e backup, aba "Hoje", custos recorrentes, atendimento pelo WhatsApp |
