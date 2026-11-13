# Radar v2 — decisões do produto (12/11/2026)

Decidido com o Raniel em 7 rodadas de perguntas. Substitui o desenho em aberto do ramo `claude/clareza-radar`.
O Radar atual (docs/etapa4/radar.md) continua valendo onde este documento não muda nada.

**Objetivo:** a pessoa da região diz o que precisa e encontra rápido, sem atrito. Visual, didático,
usável por idoso ou criança sem ser infantil.

## Nome e texto
- Nome continua **Radar**. Botão: **"Estou procurando…"**. Frase: **"Diga o que precisa. As lojas da região te respondem."**

## Quem pede
- Só com conta e celular confirmado (como hoje).
- Escreve ou **fala** (botão "Falar em vez de digitar"). Sem foto nesta versão.
- Se o pedido estiver vago, a IA faz no máximo 2 perguntas com botões (fase 3).
- Antes de publicar, a IA mostra até 3 anúncios parecidos da região: "Achamos isso na região. Quer ver?" (fase 3).

## Área e visibilidade
- **Área:** "Toda a região" já marcado; pode escolher uma ou várias cidades da microrregião.
- **Quem vê:** "Só lojas" já marcado; pode trocar para "Todo mundo".
  - Só lojas = só quem pode atender o Radar vê o pedido.
  - Todo mundo = qualquer pessoa logada vê; quem não pode atender só pode tocar em **"Eu sei onde tem"** e indicar um anúncio do site.

## Quem atende (manda oferta)
- Loja **verificada** (selo) **e** com plano **pago**; vendedor pessoa física verificado e pago conta como loja.
- **Cortesia:** o admin libera tudo do Radar para uma loja por tempo determinado, mesmo sem plano pago.
- Até **5 lojas** por pedido.
- A loja manda anúncios da vitrine (a IA marca os 3 melhores — fase 3), pode publicar anúncio novo para atender,
  e chama no WhatsApp se o cliente aceitou.

## Aviso de pedido novo
- **Só plano Full** (e cortesia). O Slim deixa de receber na hora da mudança, sem período de transição.
- Só lojas da área escolhida (cidades marcadas, ou a região toda).

## Prazo e relação
- Pedido fica **15 dias**. Aviso **2 dias antes**: "Achou? / Ainda preciso".
- "Ainda preciso" estende +15 dias, **no máximo 2 vezes** (até 45 dias). Depois: "Pedir de novo" (1 toque, texto já preenchido).
- Anúncio novo parecido com pedido aberto: aviso ao cliente, no máximo 1 por dia por pedido (fase 3).
- Ao resolver: "Com quem você resolveu?" [loja A] [loja B] [Outro lugar] e depois 👍/👎.

## Chat "Conversas" (fase 2)
- Ícone "Conversas" no menu com bolinha de não lidas; separado do Merc.
- 2a: chat do Radar (pedido ↔ loja, anúncios como cartões). 2b: botão "Conversar" em todo anúncio.
- **Feito (13/11/2026):** ver `docs/superpowers/plans/2026-11-13-radar-v2-fase2-conversas.md` (decisões do Raniel na tabela do plano). A IA que lê o chat continua na fase 3.
- Aviso fixo no topo: "O Mercado da Região acompanha esta conversa para sua segurança e para saber se você já resolveu."
- A IA lê só esse chat; ao perceber "já comprei", pergunta ao cliente se pode tirar o pedido; só tira com a confirmação.
- Contra golpe: aviso "Nunca pague adiantado sem ver o produto", Bloquear, Denunciar, telefone escondido até o cliente aceitar.

## Canais de aviso (fase 4)
- Site + **WhatsApp oficial da Meta** só nos momentos importantes (custo por conversa a confirmar antes).

## IA (fase 3)
- Busca atual traz ~20 anúncios; um modelo Gemini barato via OpenRouter (provedor que o projeto já usa) escolhe 3 e explica em 1 linha.
- **Feito (13/11/2026, desligado):** perguntas do pedido vago, "Achamos isso na região", os 3 da vitrine e o aviso de anúncio novo.
  IA mista: o JEV (TypeSafe) julga, o Gemini 2.5 Flash-Lite escreve. Teto próprio de R$ 30/mês, 20 usos por dia por pessoa.
  Detalhes e como ligar: `docs/radar-ia.md`. Plano: `docs/superpowers/plans/2026-11-13-radar-v2-fase3-ia.md`.
- **Falta:** a IA que lê o chat (fase 2) e pergunta "já comprou?" — PR separado depois que o chat entrar na main.

## Onde o Radar aparece
- Busca sem resultado, topo da home ("Estou procurando…"), Merc ("Quer que eu peça para as lojas?"), favoritos e anúncio vendido.

## Modo fácil (vale para todas as telas do Radar)
- Botões de no mínimo 48px de altura, texto do corpo 18px, uma pergunta por tela, nenhum ícone sem texto.
- Antes de lançar: teste com 5 a 10 pessoas mais velhas da região.

## Ordem de entrega
1. Base (este plano). 2a/2b. Chat. 3. IA. 4. WhatsApp oficial.
