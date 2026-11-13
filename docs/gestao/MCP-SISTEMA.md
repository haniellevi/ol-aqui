# Mercado da Região · MCP do sistema

Data: 13/11/2026. Origem: entrevista (grill-me 6 de 6) com o Raniel. Base: os 5 documentos desta pasta
(`NEGOCIO-PLANO-COMERCIAL.md`, `OPERACAO-AGENTES.md`, `PONTOS-INDICACAO-SORTEIO.md`, `MARKETING-TRAFEGO.md`,
`ASSISTENTE-LOJISTA.md`), o código na `origin/main` de 13/11/2026 e pesquisa sobre o protocolo MCP (seção 9).
Nada foi programado, publicado ou alterado em produção. **Resumo confirmado pelo Raniel em 13/11/2026.**

**O que é MCP, em uma frase:** uma tomada que deixa uma IA, como o Claude ou o ChatGPT, ler e operar o sistema com
permissão.

Princípio (o mesmo da operação): **a IA lê e prepara; o Raniel aprova.** O MCP é **um caminho a mais**, não substitui
o painel. Tudo o que não entrar no MCP continua no `/admin`, como hoje.

## 1. Decisões fechadas

| # | Tema | Decisão |
|---|---|---|
| 1 | Para quem primeiro | **Admin master (o Raniel) primeiro.** Depois **lojista**, depois **usuário** |
| 2 | 1ª versão do admin | **Só leitura.** Escrita entra na 2ª versão, depois de testada a leitura |
| 3 | Quais IAs | **Claude** (app e site), **ChatGPT** (o Raniel já usa) e o **agente das 7h** |
| 4 | Escrita no ChatGPT | **Igual ao Claude** (ler e escrever), sempre com o "sim". Conferir se o plano do ChatGPT do Raniel permite escrita (seção 10) |
| 5 | Onde roda | **Dentro do próprio app na Vercel** (um endereço novo, ex.: `/api/mcp`). Sem servidor novo |
| 6 | Login | **Login do próprio site (Clerk).** Ao ligar o MCP no Claude ou no ChatGPT, abre a tela de entrada do Mercado. A IA vê **só o que aquela pessoa já vê no app** |
| 7 | Agente das 7h | **Conta própria, só leitura** (ex.: "agente-diario"). Não pode escrever nada. Desliga-se sem afetar a conta do Raniel |
| 8 | Como é o "sim" | **Ações simples** (visita, custo, filas, textos): a IA mostra o resumo e o Raniel aprova no chat. **Ações de loja** (suspender, reativar, selo, cortesia): ficam **esperando um toque na aba "Hoje"** do painel |
| 9 | Histórico | **Toda chamada** é gravada: quem, qual IA, qual ferramenta, quando, se deu certo. Nas escritas, também o **antes e o depois**. **Sem os dados lidos.** Guarda 6 meses |
| 10 | Vazamento | **Botão geral** no painel desliga o MCP inteiro na hora + **desligar por conta**. O acesso vence sozinho em **1 hora** e precisa ser renovado |
| 11 | Limite por dia | **Admin 500 chamadas · agente 200 · escritas 50 no total.** Passou, o MCP pausa até o dia seguinte e avisa o Raniel |
| 12 | Meta Ads | **Continua o CSV** exportado pelo Raniel (como o Marketing decidiu). Sem API da Meta por agora |
| 13 | Dados pessoais | **Não entram.** A IA vê nome de loja, números e códigos, nunca nome, telefone ou documento de cliente (LGPD) |
| 14 | Lojista e o assistente | **Um código só:** o MCP do lojista usa **as mesmas ações do Merc** (assistente do lojista). Publicar continua **só na tela de conferência do app** |
| 15 | Créditos no MCP do lojista | **Não gasta crédito** quando a IA do próprio lojista lê o encarte (sem custo para o Mercado). Mas tudo cai na **mesma tela de conferência**, com linhas amarelas e desfazer em 7 dias |
| 16 | Quando começa o do lojista | **Depois da etapa 1 do assistente (encarte) no ar** e da escrita do admin testada |
| 17 | Usuário comum | **Só busca e o que é dele** (seção 3.3). Vem por último |

**Regras que vieram de sessões anteriores e foram mantidas:** números da sorte **nunca** se editam (nem pelo MCP);
nenhuma escrita sem "sim"; o agente nunca escreve dados pessoais no diário.

## 2. O que nunca entra no MCP

Fica só no painel `/admin`, com o Raniel:

| Nunca no MCP | Por quê |
|---|---|
| **Apagar** (anúncio, loja, conta, categoria) | Irreversível ou quase; a Lixeira é só no painel |
| **Pagamentos** (cobrar, devolver, contestar) | Dinheiro é decisão do dono |
| **Números da sorte** (criar, mudar, tirar) | Regra da Sorte da Região: não se editam à mão |
| **Polícia, justiça e LGPD** (tela Compliance, exportar/apagar dados) | Responsabilidade legal, exige motivo registrado |
| **Ligar/desligar IA, tetos de gasto, chaves e configurações** | Controle de gasto e de risco |
| **Equipe e permissões** (dar ou tirar acesso) | Um erro daria poder a quem não deve |
| **Preços e planos** (plano, destaques, descontos) | Receita é decisão do dono |

## 3. Ferramentas por perfil

Nomes provisórios (as sessões de programação podem ajustar). Cada ferramenta de leitura é marcada como "só leitura"
para a IA; cada escrita é marcada como "muda dados".

### 3.1 Admin master (Raniel)

**Leitura (1ª versão)**

| Ferramenta | O que devolve | Já existe no sistema? |
|---|---|---|
| `resumo_negocio` | Receita do mês, lucro do mês × ponto de equilíbrio, lojas pagantes (mensal × anual), em teste, cortesia, vencidas, cancelamentos, receita fixa mensal | Parcial: `admin_estatisticas`, `relatorio_receita`, `relatorio_conversao_teste`. **Falta** lucro, custos fixos e cancelamentos (sessão 1) |
| `filas_do_dia` | Contagem e lista curta (sem dados pessoais) de: moderação, verificação de lojas, conversas passadas para humano, suspeitos do antifraude, devoluções | Parcial: aba `/admin/hoje`, moderação, verificação. **Falta** atendimento por WhatsApp e antifraude |
| `lojas_vencidas` | Lojas vencidas por faixa (−7, 0, +3, +7 dias), nome da loja e valor | Parcial (dados de pagamento existem) |
| `gasto_ia` | Gasto do mês × teto de R$ 100, por uso (Merc, moderação, assistente) e o Radar × teto de R$ 30 | Sim: `robo_uso`, `relatorio_custo_aki` |
| `saude_sistema` | Rotinas que não rodaram, falhas na fila de WhatsApp, erros, último backup testado | Parcial (rotinas `pg_cron`, fila de WhatsApp). **Falta** vigias e backup (sessão 2) |
| `buscas_sem_resultado` | O que o povo procura e não acha, por região | Parcial: só buscas do robô (`robo_buscas_vazias`). **Falta** gravar as buscas do site |
| `lojas_por_origem` | Lojas criadas por origem: anúncio, visita, indicação, QR | Parcial: `/admin/visitas` (origens). **Falta** campo "origem da loja" e UTM no cadastro |
| `cliques_whatsapp` | Cliques no WhatsApp por vitrine e período | Sim: `eventos_anuncio` |
| `ofertas_por_categoria` | Ofertas reais por categoria e região | Sim (contagem por categoria) |
| `importacoes_encarte` | Quantas importações, quantas linhas amarelas, quantas desfeitas, por loja | **Não** (depende do assistente, etapa 1) |
| `creditos_por_loja` | Créditos de IA gastos por loja no mês (do plano e extras) | **Não** (depende do assistente) |
| `ofertas_vencendo` | Ofertas "de/por" que vencem amanhã | **Não** (depende do assistente) |
| `sorte_do_mes` | Total de números da sorte do mês por região e tamanho da fila de suspeitos (só contagem) | **Não** (Sorte ainda não existe no código) |
| `historico_mcp` | As últimas chamadas ao MCP (quem, ferramenta, quando, resultado) | **Não** (nasce com o MCP) |

**Escrita (2ª versão, sempre com "sim")**

| Ferramenta | O que faz | Onde é o "sim" |
|---|---|---|
| `registrar_visita` | Lança o resultado de uma visita a loja (data, loja, resultado, origem) | Chat |
| `lancar_custo_fixo` | Lança ou ajusta um custo fixo do mês | Chat |
| `decidir_moderacao` | Aprova ou recusa um anúncio retido | Chat |
| `decidir_verificacao_loja` | Aprova ou recusa a verificação de uma loja | Chat |
| `decidir_suspeito_sorte` | Marca um suspeito do antifraude como "ok" ou "fraude" (não mexe nos números; a regra da Sorte aplica o resultado) | Chat |
| `editar_texto` | Muda texto da home, FAQ ou modelo de mensagem (não inclui documentos legais) | Chat |
| `pedir_acao_loja` | Pede suspender, reativar, dar selo ou cortesia a uma loja | **Aba "Hoje"** (a ação só acontece com o toque do Raniel) |

Todas as escritas pedem **motivo** (como o painel já exige em ações de gestão) e entram no histórico com antes e depois.

**Agente das 7h:** usa só as ferramentas de leitura acima, com a conta própria "agente-diario". Escreve o diário em
`docs/gestao/diario/` pelo PR de texto, como decidido na sessão 2 (o MCP não escreve no repositório).

**Equipe (moderador, financeiro, suporte, franqueado):** fora por agora (hoje a equipe é só o Raniel). Quando houver,
cada papel vê pelo MCP só as telas que já vê no painel.

### 3.2 Lojista (dono e gerente da loja)

Mesmas ações do Merc do lojista (`ASSISTENTE-LOJISTA.md`), sem caminho próprio. Dono e gerente, como no assistente.
Só a loja dele.

| Leitura | Escrita (rascunho; publicar só no app) |
|---|---|
| Desempenho da loja (visitas, cliques no WhatsApp, propostas do Radar) | Mandar linhas de encarte ou planilha já lidas pela IA dele → caem na tela de conferência |
| Meus anúncios e ofertas, ofertas que vencem amanhã | Criar rascunho de anúncio |
| Saldo de créditos | Repetir oferta (prepara; o lojista confirma no app) |
| Pedidos do Radar da região | — |
| Números da sorte da loja e link de indicação (só com a Sorte ligada) | — |

Nunca pelo MCP do lojista: publicar, pagar, comprar créditos, apagar, mudar plano.

### 3.3 Usuário comum

| Leitura | Escrita (rascunho) |
|---|---|
| Buscar ofertas e anúncios públicos da região | Rascunho de anúncio |
| Meus anúncios e meus pedidos do Radar | Rascunho de pedido do Radar |
| Meus números da sorte (só com a Sorte ligada) | — |

Nunca: ver contato de vendedor fora da regra do app, publicar, pagar, apagar. O robô Aki/Merc já tem essas ferramentas
(`buscar_anuncios`, `meus_anuncios`, `salvar_rascunho_anuncio`, `preparar_pedido_radar`) e o MCP reaproveita.

## 4. Segurança

1. **Mesmo login e mesmas travas do app.** O MCP entra com a conta Clerk da pessoa e consulta o banco **como ela**,
   então as regras de acesso do Supabase (RLS + funções que conferem `e_admin`, `meu_papel`, dono da loja) valem
   igual. Nada de chave mestra do banco no MCP, salvo onde o app já usa hoje.
2. **Token só para o MCP** (o "crachá" emitido para o endereço do MCP; não serve para outro lugar), vence em 1 hora.
3. **Conta do agente das 7h** com papel só de leitura. Se a rotina na nuvem não conseguir fazer o login interativo,
   ela recebe uma chave própria, **só leitura**, guardada nos segredos da rotina e trocável no painel (ver seção 10).
4. **Escritas:** marcadas como "muda dados" para o Claude e o ChatGPT pedirem aprovação; além disso o próprio MCP
   exige o "sim" (chat) ou o toque na aba "Hoje" (lojas). Não confiar só no botão "permitir" do Claude/ChatGPT,
   porque ele pode ficar como "sempre permitir".
5. **Texto vindo de fora não manda** (anúncio, conversa, encarte podem trazer ordens escondidas para a IA). Por isso
   as ações de loja precisam do toque no painel, e nada destrutivo entra no MCP.
6. **Histórico** de toda chamada (seção 1, item 9), em tabela própria ou junto do registro de gestão que já existe
   (`admin_gestao_eventos`, `logs_atividade`).
7. **Limites por dia** (item 11) e **botão geral** para desligar (item 10). Se uma chave vazar: apertar o botão geral,
   cortar o acesso da conta no painel, trocar a chave e olhar o histórico.

## 5. Onde roda

Dentro do app Next.js na Vercel, num endereço novo (ex.: `/api/mcp`), com o pacote `mcp-handler` e a integração
do Clerk para MCP. Não precisa de Redis nem de servidor novo. Custo: o uso cai na mesma conta da Vercel (lembrete da
sessão 1: o plano grátis da Vercel não permite uso comercial; o Pro é decisão do Raniel).

## 6. Ordem de construção

1. **Base**: endereço do MCP, login Clerk (OAuth), histórico, limites por dia, botão geral e desligar por conta.
2. **Admin leitura** com o que já existe: `gasto_ia`, `cliques_whatsapp`, `ofertas_por_categoria`, `filas_do_dia`
   (parcial), `resumo_negocio` (parcial), `lojas_vencidas`, `buscas_sem_resultado` (só robô), `historico_mcp`.
3. **Conta do agente das 7h** e ligar a rotina diária ao MCP (testar 1 semana lendo junto com o painel).
4. **Ligar no Claude e no ChatGPT** do Raniel e testar.
5. **Admin escrita**: `registrar_visita`, `lancar_custo_fixo`, filas, textos e `pedir_acao_loja` com a aba "Hoje".
6. As ferramentas novas entram **junto com a função de que dependem** (custos fixos, buscas do site, origem da loja,
   encarte, créditos, Sorte). Cada sessão de programação acrescenta a leitura correspondente.
7. **Lojista** (depois do encarte no ar).
8. **Usuário** (por último).

Cada etapa: programar com dados fictícios, revisar, pedir "sim" para publicar.

## 7. Relação com as outras partes

| Parte | Como o MCP se encaixa |
|---|---|
| Agente das 7h (sessão 2) | Lê pelo MCP em vez de abrir o painel. Continua escrevendo o diário por PR |
| Aba "Hoje" (sessões 1 e 2) | Recebe os pedidos de ação de loja vindos do MCP |
| Assistente do lojista (sessão 5) | Um código só; o MCP do lojista é outra porta para as mesmas ações |
| Sorte da Região (sessão 3) | Só leitura de contagens e decisão de suspeitos; números nunca |
| Marketing (sessão 4) | Leitura de buscas, origens, cliques e ofertas; Meta continua por CSV |

## 8. Riscos

- **Prompt injection** (ordens escondidas em anúncios, conversas ou encartes): mitigado com leitura sem dados
  pessoais, ações de loja só com toque no painel e nada destrutivo no MCP. Não some de todo.
- **"Sempre permitir"** no Claude/ChatGPT tira o "sim" do cliente; por isso o MCP confere o "sim" do seu lado.
- **ChatGPT com escrita**: o plano exato que permite não foi confirmado.
- **Mais uma porta de entrada** no sistema: um erro de permissão no MCP expõe dados. Rever a segurança antes de
  ligar (revisão de código + teste com conta de lojista tentando ver outra loja).
- **Rotina das 7h na nuvem** pode não aceitar login interativo; aí precisa da chave só leitura (risco de vazar menor
  por ser só leitura e ter limite de 200/dia).
- **Custo da Vercel**: cada chamada é uma função; com os limites diários o custo é pequeno, mas não foi medido.

## 9. Fontes (pesquisa de 13/11/2026)

- Especificação MCP 2026-07-28 (versão mais recente; Streamable HTTP é o transporte remoto; SSE obsoleto):
  https://modelcontextprotocol.io/specification/2026-07-28/changelog e
  https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- Autorização (OAuth 2.1, metadados do recurso RFC 9728, PKCE obrigatório, token só para o servidor, sem repasse):
  https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization e
  https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices
- Ferramentas, marcações "só leitura"/"destrutiva" (são dicas, não garantias) e humano aprovando:
  https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP na Vercel com `mcp-handler` v2 e `withMcpAuth` (sem Redis): https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
  e https://github.com/vercel/mcp-handler
- Clerk para MCP em Next.js: https://clerk.com/docs/nextjs/guides/ai/mcp/build-mcp-server.md
- Claude, conectores remotos (todos os planos; no grátis, 1 conector): https://claude.com/docs/connectors/custom/remote-mcp
- Claude Code com MCP remoto: https://code.claude.com/docs/en/mcp
- ChatGPT, modo desenvolvedor (leitura e escrita; escrita pede confirmação):
  https://developers.openai.com/api/docs/guides/developer-mode.md

Fatos do código (`origin/main`, 13/11/2026): login Clerk ligado ao Supabase como "third-party auth" (`src/lib/supabase/server.ts`);
papéis `e_admin`, `equipe` (administrador, moderador, financeiro, suporte, franqueado), dono da loja (`vitrines_lojas.dono_id`)
e gerente por convite (`convites_gerente_loja`); RLS em todas as tabelas + funções que conferem o papel; histórico em
`logs_atividade`, `admin_gestao_eventos`, `vitrines_acoes_admin`, `compliance_acessos`; nenhum MCP no código hoje.
Observação: a pasta local estava no ramo `feat/home-3-colunas`, 222 commits atrás da `origin/main`.

## 10. Pendências gerais (as 6 sessões)

### Decisões do Raniel ainda abertas
- Momento de passar **Vercel e Supabase para o Pro** (o grátis da Vercel não permite uso comercial). (Sessão 1)
- **Contratar ajudante**: decidir depois, com o tempo gasto em trabalho manual mostrado no diário. (Sessão 2)
- **Ligar o botão 1 da Sorte antes da autorização**: escolha do Raniel; levar ao advogado antes. (Sessão 3)

### Conferir (fatos que faltam)
- Taxas do Asaas de boleto, cartão em 12× e Pix pequeno (compensa o pacote de R$ 10 de créditos?). (Sessões 1 e 5)
- Custo do servidor da Evolution; plano atual da Vercel e do Supabase; câmbio. (Sessão 1)
- `OPERACAO-AGENTES.md` foi corrigido sobre o modelo do Merc (DeepSeek no painel); manter o diário vigiando o gasto × teto. (Sessões 2 e 5)
- Custo por página do GPT-6 Luna em PDF: medir no 1º teste. (Sessão 5)
- Limite diário das rotinas na nuvem do Claude e se aceitam MCP com login. (Sessões 2 e 6)
- Plano do ChatGPT que permite ferramentas de escrita no MCP. (Sessão 6)
- Regra do Google Meu Negócio para "empresa de área de atuação". (Sessão 4)

### Com o advogado e o contador (fora da fila)
- Abrir o **CNPJ**; pedido de autorização da Sorte na SPA (40 a 120 dias); MEI, vale-compra, menores de 14 a 17,
  pedido anual ou mensal, regulamento. (Sessão 3)
- Preço "de/por" (propaganda enganosa) e fotos de encarte de indústria. (Sessão 5)
- Política de privacidade: seção 1 com razão social/CNPJ/DPO "a preencher". (Sessão 2)
- Autorização de imagem de lojistas e clientes nos vídeos. (Sessão 4)

### Tarefas do Raniel (fora da fila)
- Criar Canal do WhatsApp, conta de anúncios da Meta, Google Meu Negócio e canal no YouTube; autorizar o Canva;
  cotar cartaz e adesivo; tripé e microfone (gasto: pede "sim"). (Sessão 4)
- Chip reserva para o número do WhatsApp. (Sessão 2)

### Para as sessões de programação (antes do lançamento para lojas)
1. Clerk e Asaas em produção, cobrança automática (Pix/boleto), anual com desconto por forma de pagamento,
   plano único de R$ 99,90 com 4 "Subir", teto de patrocinados na busca. (Sessão 1)
2. WhatsApp de cobrança −7/0/+3 e tarefa de +7; vigias e backup testado; aba "Hoje" completa; custos fixos
   recorrentes e lucro do mês; registro de visitas; atendimento pelo WhatsApp. (Sessão 2)
3. UTM e "origem da loja", QR por loja, gravar buscas do site. (Sessões 1 e 4)
4. Assistente do lojista na ordem: encarte, repetir oferta, planilha, fotos em lote, Meu Marketing, áudio, WhatsApp
   (com a Meta). (Sessão 5)
5. Sorte da Região na ordem: indicação e antifraude, números, página e card, botões 1 e 2, avisos, lista pública
   e sorteio. (Sessão 3)
6. MCP na ordem da seção 6 deste documento. (Sessão 6)

### Documentos a atualizar
- `PLANO-CRESCIMENTO-2026-11-11.md`: tirar os níveis da Sorte, trocar a tabela da Etapa 5 e pôr links para os
  documentos de marketing. (Sessões 3 e 4)
- Criar `docs/gestao/diario/`, `docs/gestao/wiki/` (trilha, FAQ, ideias do YouTube, objeções) e `docs/gestao/marketing/`. (Sessões 2 e 4)
