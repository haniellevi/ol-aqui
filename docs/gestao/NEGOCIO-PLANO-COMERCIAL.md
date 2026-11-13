# Mercado da Região · Negócio e plano comercial

Data: 13/11/2026. Origem: entrevista (grill-me 1 de 6) com o Raniel. **Resumo confirmado pelo Raniel em 13/11/2026.**
Parte das decisões já fechadas em `docs/PLANO-CRESCIMENTO-2026-11-11.md` (área, PWA, cupons, indicação de lojista,
sorteio etc.), que não foram rediscutidas aqui. Nada foi programado, publicado ou alterado em produção.

## 1. Decisões fechadas

### Plano do lojista

| Tema | Decisão |
|---|---|
| Quantos planos | **Um plano só**, com tudo incluído (substitui Slim R$ 49,90 e Full R$ 99,00) |
| Preço mensal | **R$ 99,90/mês** |
| O que inclui | Tudo o que o Full dá hoje: anúncios sem limite, Radar sem limite de propostas, vitrine com fachada, 10 seções e 6 fixados, **4 "Subir" grátis por mês** |
| Como paga o mensal | **Pix ou boleto, cobrança automática** todo mês (o Asaas emite e avisa antes de vencer) |
| Anual no Pix à vista | **40% de desconto** até 31/03/2027 (R$ 719,28 = R$ 59,94/mês). Depois, **20%** (R$ 959,04) |
| Anual no cartão (até 12×) | **30% de desconto** até 31/03/2027 (R$ 839,16). Depois, **10%** (R$ 1.078,92) |
| Teste grátis | **30 dias**, como hoje (10 anúncios, 3 propostas no Radar). Sem preço de fundador nem meses grátis extras |
| Indicação lojista → lojista | Mantém o que já está decidido: 1 mês grátis para as duas lojas |

### Pessoa física

Continua como hoje: **3 anúncios grátis** e **anúncio avulso de R$ 9,90** por 30 dias.

### Destaques pagos

**À venda desde o dia 1**, com os preços atuais. **Revisar depois de 3 meses** com os números reais de venda.

| Destaque | Preço | Duração | Vagas por região |
|---|---|---|---|
| Subir | R$ 4,90 | uma vez | sem limite |
| Destaque na busca | R$ 14,90 | 7 dias | sem limite (precisa de teto: ver seção 6) |
| Vitrine da página inicial | R$ 39,90 | 7 dias | 8 |
| Loja em destaque | R$ 49,90 | 7 dias | 6 |

### Metas e lucro

| Tema | Decisão |
|---|---|
| Lojas pagantes | **15 em 3 meses · 40 em 6 meses · 100 em 12 meses** |
| Lucro real | Paga também o trabalho: **retirada de R$ 3.000/mês** entra como custo |
| Vercel e Supabase no plano pago (Pro) | O Raniel decide o momento. Neste documento, entram como custo a partir do lançamento |
| WhatsApp | **Evolution agora**; migrar para a **API oficial da Meta ao chegar em 50 lojas pagantes** |
| Tráfego pago | **R$ 0 no 1º mês**; **R$ 300/mês** a partir do 2º mês (quando houver ~15 lojas com anúncios reais) |

## 2. Custos (levantados em 13/11/2026)

Câmbio usado: US$ 1 = R$ 5,63 (venda, 13/11/2026, AwesomeAPI, cotação de mercado). A PTAX de hoje não foi
conferida; as PTAX de outubro ficavam perto de R$ 5,0. Os números em dólar podem cair até ~10% com a PTAX.
Levantamento completo: notas da sessão (`custos-negocio.md` na pasta de notas compartilhadas).

### Fixos

| Serviço | Para quê | R$/mês | Fonte | Certeza |
|---|---|---|---|---|
| Vercel Pro | Hospedagem do site. O Hobby (grátis) **não permite uso comercial** | 112,60 | [vercel.com/pricing](https://vercel.com/pricing), [termos, seção 4](https://vercel.com/legal/terms) | Alta |
| Supabase Pro | Banco, fotos, rotinas. O Free pausa após 7 dias sem uso | 140,75 | [supabase.com/pricing](https://supabase.com/pricing) | Alta |
| Clerk | Login. Grátis até 50 mil usuários com login Google; celular (SMS) só no Pro (+R$ 140,75 + SMS) | 0 | [clerk.com/pricing](https://clerk.com/pricing) | Alta (preço do SMS no Brasil não achado) |
| Domínio .com.br | mercadodaregiao.com.br | 3,33 (R$ 40/ano) | NIC.br citado por terceiros ([Teletime](https://teletime.com.br/14/10/2026/br-6-milhoes/)) | Média |
| **Total fixo mínimo** | | **≈ 257** | | |

### Variáveis

| Serviço | Para quê | Custo | Fonte | Certeza |
|---|---|---|---|---|
| Asaas | Pix, boleto, cartão | Sem mensalidade. Pix: R$ 0,79 a R$ 1,59 por cobrança (a página mostra os dois). Boleto e cartão: **não confirmados** | [asaas.com/precos-e-taxas](https://www.asaas.com/precos-e-taxas) | Média (Pix), baixa (boleto e cartão) |
| OpenRouter gpt-4.1-mini | Moderação de anúncios | ≈ R$ 7 por mil anúncios (hipótese de tamanho) | [openrouter.ai](https://openrouter.ai/openai/gpt-4.1-mini) | Alta no preço, baixa no volume |
| OpenRouter gemini-2.5-flash-lite + TypeSafe JEV | Radar com IA | **Teto de R$ 30/mês** configurado | [openrouter.ai](https://openrouter.ai/google/gemini-2.5-flash-lite) | Média |
| TypeSafe JEV | Sugestão de categoria | Centavos por mil sugestões | Terceiro ([eesel.ai](https://www.eesel.ai/blog/typesafe-jev-pricing)); página oficial não achada | Baixa |
| Aki (Claude/GPT) | Robô do lojista | **Desconhecido**: não se sabe se está ligado em produção | Catálogo no banco (`robo_aki.sql`) | Baixa |
| WhatsApp Evolution | Códigos e avisos | R$ 0 por mensagem; **custo do servidor não achado**; risco de bloqueio do número | Repo | Alta (tarifa), nula (servidor) |
| WhatsApp oficial Meta (com 50 lojas) | Mesmo uso | ≈ R$ 0,035 a R$ 0,19 por mensagem de serviço/autenticação; marketing ≈ R$ 0,32. 3 mil msgs/mês: R$ 105 a R$ 570 | [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing) (tabela em R$ não abriu; terceiros divergem) | Média/baixa |
| E-mail transacional | — | Não existe no código hoje | — | Alta |

### Totais estimados

| Cenário | Servidores e serviços (R$/mês) |
|---|---|
| Hoje / lançamento | ≈ 257 a 300 |
| 100 lojas, 3 mil usuários (sem Meta) | ≈ 300 a 350 |
| 100 lojas com Meta oficial | ≈ 400 a 900 |
| 300 lojas, 10 mil usuários (sem Meta) | ≈ 360 a 450 |

## 3. Ponto de equilíbrio

Custos do mês "de pé": servidores ≈ R$ 350 + tráfego R$ 300 + retirada R$ 3.000 = **≈ R$ 3.650/mês**.
Taxa do Asaas considerada: R$ 1,59 por cobrança mensal (pior caso do Pix).

| O que cobre | Lojas pagantes necessárias |
|---|---|
| Só servidores e tráfego (R$ 650) | **7 lojas** no mensal |
| Tudo + retirada, todas no mensal (R$ 98,31 líquido cada) | **38 lojas** |
| Tudo + retirada, metade no anual com 40% (até mar/2027) | **47 lojas** |
| Tudo + retirada, metade no anual com 20% (a partir de abr/2027) | **≈ 41 lojas** |

Destaques e avulsos não entram nessa conta: são margem a mais.
Com a migração para a Meta (50 lojas), somam R$ 100 a R$ 570/mês: o equilíbrio sobe 1 a 6 lojas.

### Metas em reais

| Quando | Lojas | Receita de planos/mês (todas mensais) | Metade anual (40%) | Custos sem retirada | Sobra para a retirada |
|---|---|---|---|---|---|
| 3 meses (fev/2027) | 15 | R$ 1.498 | R$ 1.199 | ≈ R$ 600 | ≈ R$ 600 a 900 |
| 6 meses (mai/2027) | 40 | R$ 3.996 | R$ 3.197 | ≈ R$ 650 | ≈ R$ 2.550 a 3.350 (bate os R$ 3.000 se a maioria for mensal) |
| 12 meses (nov/2027) | 100 | R$ 9.990 | R$ 7.992 | ≈ R$ 750 a 1.200 (com Meta) | ≈ R$ 6.800 a 9.200 |

Atenção: o anual entra como caixa adiantado. Para medir o mês, o painel deve dividir o anual por 12 (ver seção 4).

## 4. BI: o que já existe e o que falta

### Já existe
- **Resumo** (`/admin`, `estatisticas.tsx`): anúncios no ar e publicados, usuários cadastrados e novos, Radar
  (pedidos, propostas, contatos, movimentação aproximada) e faturamento recebido (total, planos, avulsos, destaques),
  com filtro de região e período.
- **Relatórios** (`/admin/relatorios`): funil (visualizações → cliques no WhatsApp → vendido), anúncios por categoria
  e cidade, conversão do teste grátis, receita por mês e tipo, custo do Aki; CSV de cada bloco.
- **Pagamentos** (`/admin/pagamentos`): totais por status e tipo, devoluções, CSV.

### O que falta (decidido)

| Número | Para quê |
|---|---|
| **Lucro do mês** | Receita − custos (servidores, IA, WhatsApp, taxas do Asaas, tráfego, retirada), com a linha do ponto de equilíbrio. Os custos fixos são lançados à mão no painel; IA e Asaas vêm do sistema |
| **Lojas pagantes e cancelamentos** | Pagantes (mensal × anual), em teste, cortesia, vencidas, quem não renovou no mês e **receita fixa mensal** (mensal + anual ÷ 12). Cortesia **não conta** como pagante |
| **Retorno para a loja** | Por loja: visitas, cliques no WhatsApp, propostas do Radar e resultado dos destaques. Serve para mostrar ao lojista que vale pagar (e para a renovação) |
| **Buscas sem resultado** | O que o povo procura e não acha: indica quais lojas convidar. Hoje só as buscas do Aki são gravadas; precisa gravar as buscas do site (decisão pendente desde `etapa5/relatorios.md`, agora aprovada) |

Também da auditoria de 10/11 (já recomendado, mantido): o financeiro mostra **"Indisponível"** quando a consulta
falha (nunca R$ 0,00) e separa **produção de testes** (sandbox) nos totais e no CSV.

## 5. Admin mais simples (só decidido, não programado)

- **Resumo começa por "Hoje"**: tarefas do dia no topo (moderação, atendimento, verificação de lojas, devoluções,
  cobranças vencidas); os gráficos vêm depois.
- **Menu de 17 itens vira 4 grupos:**
  - **Vendas**: Lojas, Pagamentos, Plano, Destaques
  - **Conteúdo**: Anúncios, Moderação, Categorias, Página inicial e textos
  - **Pessoas**: Usuários, Equipe, Mensagens automáticas
  - **Sistema**: Configurações, Regiões, Robô Aki, Jurídico
  - Relatórios fica junto ao Resumo (é a parte de números).
- **Tela de Planos** fica simples: um plano, o preço mensal e os descontos anuais (Pix e cartão, com data de fim
  da oferta de lançamento). Slim e Full saem do catálogo (ninguém assinou).

## 6. Lançamento

### Antes de convidar a 1ª loja de fora (obrigatório)
1. **Clerk em produção** (a instância de teste trava em 100 usuários). Roteiro já na main (fase 3 do Raniel).
2. **Asaas em produção** (`asaas.ambiente = producao`) com a chave e o webhook configurados.
3. **Cobrança automática** do mensal (Pix/boleto) e o **anual com desconto diferente para Pix e cartão**. Hoje a
   cobrança é avulsa por período, só Pix e cartão, sem boleto e sem desconto por forma de pagamento: precisa mudar.
4. **Plano único** de R$ 99,90 no catálogo, com 4 "Subir" por mês.
5. **Teto de patrocinados na busca** (máx. 2 a cada 24 resultados), já que os destaques serão vendidos desde o dia 1.
   Hoje a busca põe todos os patrocinados antes dos demais (`brainstorm-piloto-2026-11-09/vitrine-planos-destaques-admin.md`).
6. Vercel e Supabase no Pro: decisão do Raniel (Hobby da Vercel não permite uso comercial).

### Primeiros passos
1. **Mês 1**: o Raniel visita **30 lojas** no centro de Corrente. Na visita: cria a loja, sobe 5 anúncios junto
   e deixa o QR no balcão. Meta: 15 lojas ativas no teste, com anúncios reais.
2. **Dia 30 de cada loja**: cobrança automática começa; oferecer o anual com 40% (Pix) / 30% (cartão).
3. **Mês 2 em diante**: tráfego pago de **R$ 300/mês** (a estratégia fica com a sessão de Marketing).
4. **Mês 3**: revisar preços dos destaques com os dados reais.
5. **31/03/2027**: fim da oferta de lançamento do anual (40% → 20%; 30% → 10%).
6. **50 lojas pagantes**: migrar o WhatsApp para a API oficial da Meta.

## 7. Riscos e o que falta saber

- **Slim e Full**: nenhuma loja assinou (o app ainda não foi lançado para lojas). Saem do catálogo sem migração.
- **Taxas do Asaas** de boleto e cartão parcelado não confirmadas; o cartão em 12× tem custo de antecipação. Conferir
  na conta antes de fixar os 30%/10%.
- **Custo do servidor da Evolution** e **se o Aki está ligado** (gasto sem teto conhecido): conferir.
- **Plano atual da Vercel e do Supabase**: não conferido (painéis).
- **Câmbio**: os custos em dólar foram convertidos a R$ 5,63; a PTAX pode estar mais baixa.
- **Cidade pequena (~27 mil habitantes)**: 100 lojas em 12 meses provavelmente exige as cidades vizinhas da microrregião.
- **App vazio**: tráfego pago antes de haver ofertas reais queima verba (por isso começa só no mês 2).

## 8. Perguntas que passam para outras sessões

| Sessão | Pergunta |
|---|---|
| 2. Operação com IA | Quem atende a cobrança vencida e a renovação (lembrete por WhatsApp no dia −7, 0 e +3)? Quem faz as 30 visitas junto com o Raniel, se alguém? Como lançar os custos fixos do mês no painel (à mão ou por agente)? |
| 2. Operação com IA | Ligar o Aki em produção? Com qual teto de gasto mensal? |
| 3. Pontos, indicação e sorteio | Os números da sorte do plano (20 e 30) foram pensados para 2 planos: como ficam com o plano único e com o anual? O mês grátis por indicação vale também para quem paga anual? |
| 4. Marketing e tráfego pago | Estratégia para os R$ 300/mês a partir do mês 2: onde anunciar, para comprador ou lojista, e como medir. Material da visita às 30 lojas (QR, cartaz, roteiro de conversa) |
| 4. Marketing e tráfego pago | Como comunicar a oferta de lançamento do anual (40% até 31/03/2027) |
| 5. Assistente do lojista | O "retorno para a loja" (visitas, cliques, propostas) deve aparecer para o lojista no assistente ou só no painel dele? |
| 6. MCP do sistema | O MCP deve expor os números do BI (lucro, pagantes, cancelamentos) para os agentes? |
