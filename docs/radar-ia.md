# IA do Radar (fase 3)

Tudo chega **desligado**. Nada muda para o cliente até alguém ligar as chaves no painel.

## O que faz
1. **Pedido vago** ("celular"): até 2 perguntas com botões, logo depois de "O que você está procurando?". A resposta entra nos detalhes.
2. **"Achamos isso na região. Quer ver?"**: a busca do site traz até 20 anúncios e a IA mostra até 3, cada um com uma frase.
3. **Folha "Propor" da loja**: os 3 anúncios da vitrine que mais combinam com o pedido sobem para o topo, com o selo "Combina com o pedido".
4. **Anúncio novo parecido**: de hora em hora, o cliente com pedido aberto recebe no sino, no máximo 1 aviso por dia por pedido.
   A pessoa pode desligar em Minha conta > Notificações ("Anúncio novo parecido com meu pedido").
5. **"Já comprei" na conversa** (chave `radar_ia.ja_comprei_ativa`, PR separado): quando o cliente escreve numa
   conversa com proposta de um pedido dele ainda aberto uma mensagem com palavra de compra ("comprei", "achei",
   "consegui", "resolvi"…), o JEV julga se ele já resolveu. Se sim, aparece só para o cliente, logo abaixo das
   mensagens: "Parece que você já resolveu “{pedido}”. Posso tirar o pedido do Radar?" [Sim, pode tirar]
   [Não, ainda preciso]. "Sim" abre a folha "Com quem você resolveu?"; o pedido só sai do ar quando ele escolhe.
   "Não" vale para sempre naquele pedido. Mensagem da loja e conversa sem pedido aberto nunca vão para a IA.
   Vão só o texto da mensagem e os títulos dos pedidos abertos daquela conversa (até 5; o JEV escolhe de qual a
   mensagem fala), sem links, e-mails e telefones. Plano:
   `docs/superpowers/plans/2026-11-13-radar-ja-comprei.md`. Texto da política: `docs/designs/conversas-politica-privacidade.md`.

Qual IA: o **JEV** (TypeSafe) julga (o pedido está vago? o anúncio novo combina?) e o **Gemini 2.5 Flash-Lite** (OpenRouter,
sem guardar dados, `zdr`) escreve as perguntas e as frases. Falhou ou demorou mais de 3 segundos: o Radar segue igual a hoje, sem aviso.

## Custo e limites
- O "já comprei" entra no mesmo teto de R$ 30 e nos mesmos 20 usos por dia por pessoa (parte `ja_comprei` no `radar_ia_uso`).
- Teto do mês **só do Radar**: R$ 30 (`radar_ia.orcamento_mensal_centavos = 3000`). Acabou, segue sem IA até o mês seguinte. Não mexe no teto do Aki.
- Cada pessoa usa a IA do Radar até 20 vezes por dia (`radar_ia.usos_por_dia`).
- Cada chamada fica no livro-caixa próprio `radar_ia_uso` (custo real do OpenRouter; JEV estimado em US$ 0,0002). É separado do `robo_uso` para o gasto do Radar não apertar o teto do Aki e das outras IAs.
- Com tudo desligado, a tela do pedido nem chama o servidor. Ligada, a IA tem até 3,5 s; passou disso, o pedido segue sem IA.
- Anúncio novo: o pedido só é marcado como conferido depois que a IA julgou. Se a IA falhar ou o teto acabar, ele volta na hora seguinte.
- Estimativa (não medida ainda): ~US$ 0,0003 por chamada do Gemini, ~US$ 0,0002 por chamada do JEV.

## Como ligar (cada passo só com "sim" do Raniel)
1. Juntar o PR na `main`.
2. Aplicar a migração `20261121010000_radar_ia.sql` no Supabase (ensaio com rollback antes, como nas outras).
3. Conferir na Vercel que `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY` e `MODERACAO_IA_SECRET` estão preenchidas (já existem para outras partes).
4. Publicar a nova versão da política de privacidade (texto abaixo) em `/admin/textos`.
5. No painel, ligar `radar_ia.ativa` e **uma parte por vez** (comece por `radar_ia.parecidos_ativa`).
6. No dia seguinte, ver o custo: `select date_trunc('day', criado_em), count(*), sum(custo_centavos)/100 as reais from radar_ia_uso group by 1 order by 1;`
7. Se estiver bom, ligar a próxima parte.

## Texto para a política de privacidade (proposta, não publicada)
Acrescentar na seção sobre inteligência artificial:

> **Radar.** Quando você pede algo no Radar, o texto do pedido (o que procura e os detalhes que você escreveu) pode ser enviado
> a serviços de inteligência artificial — o OpenRouter, que usa o modelo Gemini, do Google, e a TypeSafe — só para sugerir
> perguntas que ajudem as lojas a entender o pedido, mostrar anúncios parecidos da região e avisar quando entrar um anúncio novo
> parecido. Das lojas, vão só o título, o preço e a cidade dos anúncios. Não enviamos seu nome, telefone nem endereço. Esses
> serviços são contratados sem guardar os dados nem usá-los para treinar modelos. O Mercado da Região não guarda o que a
> inteligência artificial respondeu; guarda só o custo de cada uso.

Antes de publicar, conferir se a política já fala da TypeSafe e do OpenRouter em outra seção (a versão 4 cita a TypeSafe) e
juntar o texto para não repetir.

## Como ligar o "já comprei" (cada passo só com "sim" do Raniel)
1. Juntar o PR na `main`.
2. Aplicar a migração `20261122010000_radar_ja_comprei.sql` no Supabase (ensaio com rollback antes).
3. Publicar em `/admin/textos` o parágrafo novo de "Inteligência artificial" das Conversas
   (`docs/designs/conversas-politica-privacidade.md`) **antes** de ligar.
4. Ligar `radar_ia.ja_comprei_ativa` (a chave geral `radar_ia.ativa` e `conversas.ativa` já estão ligadas).
5. Testar com conta de teste: pedido aberto, loja manda oferta, cliente escreve "já comprei" na conversa → a faixa
   aparece em uns 5 segundos; "Não, ainda preciso" → some e não volta.
