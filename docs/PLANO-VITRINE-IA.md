# Plano: vitrine das lojas com IA

Decidido em 11/11/2026 (sessão de perguntas com o Raniel). Este documento guia a construção.
Ramo de trabalho: `claude/vitrine-ia`, criado a partir da `main` (528c9e1).

## Ideia em uma frase

Cada lojista ganha uma vitrine bonita e organizada sozinha. O cliente navega, favorita e chama no
WhatsApp. A IA mostra ao lojista o que melhorar e o que a região está procurando. Não vendemos:
só ligamos cliente e loja.

## O que já existe (não refazer)

- **Página da loja:** `src/app/(publico)/loja/[slug]`, com os componentes em `src/components/vitrine/*`.
- **Dados da loja:** tabela `vitrines_lojas`, com capa, logo, endereço, `lat`/`lng`, horários e WhatsApp.
- **Produtos:** são os próprios `anuncios`, com fotos, preço, `categoria_id` na árvore `categorias` e `atributos`.
- **Favoritos:** tabela `favoritos` e a tela `/minha-conta/favoritos`.
- **Medição:** `eventos_anuncio` registra visualização, clique no WhatsApp e compartilhamento.
  `robo_buscas_vazias` guarda o que o robô não encontrou.
- **Radar:** tabelas `radar_pedidos` e `radar_propostas`. O pedido é criado por
  `criar_pedido_radar_site` e o feed das lojas por `radar_feed_regional`.
- **Robô Merc:** código em `src/lib/aki/*`, com Anthropic, OpenAI e OpenRouter, e imagem por
  `gpt-image`. O custo é registrado em `robo_uso`.
- **Planos:** tabela `planos` (`teste`, `pf_gratis`, `slim`, `full`), cobrados pelo Asaas.

## Decisões

| Tema | Decisão |
| --- | --- |
| Lançamento | Tudo junto, já com IA. A construção segue em etapas, na ordem abaixo. |
| Base | Evoluir a página atual `/loja/[slug]`, sem módulo novo. |
| Página da loja | Capa com logo por cima, abas de categoria fixas no topo, produtos em 2 colunas com o coração na foto e barra fixa embaixo com WhatsApp e Mapa. |
| Contato | WhatsApp com mensagem pronta: "Vi o produto X no Mercado da Região…". O clique é registrado. Não há chat interno. |
| Mapa | Mapa grátis (OpenStreetMap) com o pino da loja e o botão "Como chegar", que abre o Google Maps ou o Waze. Não há custo por visita. |
| Categorias dos produtos | A IA sugere e o lojista confirma com 1 toque. Os anúncios que já existem passam por um lote, numa fila "Revise suas categorias". |
| Nicho da loja | Lista fixa de nichos no lugar do texto livre (`categoria_loja`). A IA sugere o nicho e o lojista confirma. |
| Privacidade | Só números somados, sem mostrar ao lojista quem viu o quê. |
| Fotos | A IA aponta o problema e oferece melhorar (tirar o fundo, clarear). O lojista vê o antes e depois e aprova. |
| Frequência | Painel sempre aberto e um resumo semanal com visitas, os produtos mais vistos e de 3 a 5 sugestões. |
| Alerta de demanda | Junta as buscas do site (novo registro, somado), as buscas vazias do robô e os pedidos do Radar, filtrados pelo nicho e pela região da loja. |
| Favoritos e Radar | Cada favorito tem o botão "Pedir parecido no Radar", já preenchido. O sino lembra quando o favorito sai do ar ou fica 7 dias parado. (Padrão aplicado: o Raniel não escolheu.) |
| Merc | Um robô só, com um "manual" por nicho. Ele prepara a mudança e só aplica depois do "sim" do lojista. |
| Planos | **Teste e Slim:** números, resumo semanal e sugestões de texto e foto. **Full:** tudo isso mais o Merc agêntico e os alertas de demanda. |

## Etapas de construção

Cada etapa é um PR pequeno para a `main`. A vitrine só fica visível para todos quando as etapas 1 a 7
estiverem prontas, controlada por uma chave em `configuracoes`.

1. **Base de dados**
   - Tabela `nichos` e a coluna `vitrines_lojas.nicho_id`. O texto antigo continua como referência.
   - Tabela `buscas_termos`, só com dados somados: termo normalizado, microrregião, dia, quantidade e
     se teve resultado. Não guarda usuário.
   - Campos de "categoria sugerida" nos anúncios, com o estado: pendente, aceita ou corrigida.
2. **Página da loja nova**
   - O layout escolhido, o mapa OpenStreetMap, a mensagem pronta do WhatsApp e o coração nos cards.
   - Mantém o endereço de hoje e os dados atuais.
3. **Favoritos e Radar**
   - O botão "Pedir parecido no Radar", que preenche o pedido.
   - O lembrete no sino (`notificacoes`), por tarefa agendada.
4. **Categorização com IA**
   - A sugestão aparece no cadastro de anúncio e de loja (nicho).
   - Um lote para os anúncios atuais, com a fila de revisão por lojista.
5. **Painel do lojista e resumo semanal**
   - Visitas, produtos mais vistos e cliques no WhatsApp.
   - Sugestões de texto e foto, e a melhoria de foto com aprovação.
6. **Alerta de demanda (Full)**
   - Cards no formato "Muita gente buscou X perto de você", com o número de buscas, o motivo e o botão "Cadastrar produto".
7. **Merc agêntico (Full)**
   - Manuais por nicho e ferramentas novas: editar texto, trocar categoria e criar um rascunho de produto.
   - Toda mudança passa pelo "sim" do lojista e fica registrada em `logs_atividade`.

## Custo de IA (estimar antes de ligar)

- **Conversa do Merc:** a estimativa do projeto (`docs/PRODUTO-CONTAS-ANUNCIOS-ROBO.md`) é de
  R$ 0,30 a R$ 0,50 com o Opus e de R$ 0,02 a R$ 0,03 com o Haiku, por conversa.
- **Categorização e resumo semanal:** usar o modelo barato. O custo por anúncio e por loja ainda **não foi medido**.
  Medir com 20 anúncios reais antes de rodar o lote.
- **Melhoria de foto (`gpt-image`):** o custo por imagem **não foi medido**. Medir antes e
  limitar por plano (ex.: N melhorias por mês no Slim).
- Todo custo passa pelo registro que já existe (`robo_uso`).

## Como ligar a categorização com IA (etapa 4)

1. Aplicar a migração `20261111040000_categorizacao_ia.sql`.
2. Conferir `robo.cotacao_dolar` e `robo.orcamento_mensal_centavos` (o lote para quando o orçamento do mês acaba).
3. Medir: pôr `vitrine_ia.categorizacao_por_dia` = 20 e ligar `vitrine_ia.categorizacao_ativa`.
   No dia seguinte, ver o custo em `robo_uso` (tipo `categorizacao`) e a qualidade em `categorizacao_ia`.
4. Se estiver bom, subir o limite por dia (padrão 300).

A rotina `olaki-categorizacao-ia` roda a cada 5 minutos e usa o mesmo segredo interno da moderação
(`MODERACAO_IA_SECRET` na Vercel e `olaki_moderacao_ia_token` no cofre do Supabase).
A tela "Revise suas categorias" e o aviso no sino só aparecem com `vitrine_ia.ativa` ligada.

## Painel da loja (etapa 5a, sem IA)

- Conta visita na loja e cliques no WhatsApp e no mapa (`eventos_loja`), só com a vitrine nova ligada na região. Guarda um resumo embaralhado, nunca o IP. Visitas do dono não contam; o mesmo visitante só conta de novo depois de `eventos.repetir_apos_minutos`.
- Tela `/minha-conta/loja/desempenho`: números de 7 ou 30 dias comparados ao período anterior, 5 produtos mais vistos e dicas por regra (sem foto, sem preço, poucas fotos, descrição ou título curtos, muito visto sem clique).
- Resumo semanal no sino toda segunda, 9h de Fortaleza (`olaki-resumo-semanal-loja`); a loja pode desligar em Avisos. Pula loja sem visita e sem dica.
- Etapa 5b (depois): melhoria de texto e foto com IA, com antes/depois aprovado pelo lojista.

## Riscos e pontos em aberto

- **Tamanho:** lançar tudo junto é o caminho mais longo. A chave em `configuracoes` permite ligar por partes se for preciso.
- **Começo sem dados:** as buscas do site só passam a ser registradas na etapa 1. O alerta de
  demanda precisa de algumas semanas de dados para valer.
- **LGPD:** mesmo com números somados, um advogado deve revisar antes do lançamento. Atualizar a página de privacidade.
- **Trabalhos paralelos:** os worktrees `OLAQUI-feed`, `OLAQUI-home-vitrine`, `clareza-radar` e o
  branch local `codex/visual-compacto-aki` mexem em telas próximas. Conferir antes das etapas 2 e 3.
- **Banco de produção:** confirmar se a migração `20261111010000_robo_merc.sql` já foi aplicada.
- **Pesquisa incompleta:** Pinterest, Shopee, OLX e Etsy não entraram na pesquisa de referências.

## Referências usadas

- **Google Business Profile (Produtos):** produto com foto, categoria e itens em destaque no topo.
- **Catálogo do WhatsApp Business:** coleções (categorias) e contato pelo produto.
- **Airbnb (Mobbin):** mapa e lista juntos e chips de filtro em rolagem. Vale para a tela "Lojas perto de você".
- **Shopify Sidekick:** sugestões com prioridade e o dado que motivou cada uma. Modelo para os cards de sugestão.
- **21st.dev:** Shop by Category Grid, Product Card e Carousel Cards, só como inspiração.
