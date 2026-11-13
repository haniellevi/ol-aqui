# Crescimento pelo Radar e área do lojista — decisões (13/11/2026)

Conversa de decisão com o Raniel ("grill"). Objetivo: cada pessoa da região conhecer o site,
entrar, ficar, e fazer o primeiro anúncio ou o primeiro pedido no Radar.
No site não há pagamento de produto. O lojista continua pagando o plano.

## Estado antes (main c764047)

- O Radar avisa só lojas com plano Full ou cortesia, e só pelo sino. Não há WhatsApp nem push.
- A loja só manda proposta. Não há "ficar de olho" no pedido.
- `/radar/pedir` exige login e celular confirmado antes de escrever.
- O painel "Desempenho" (cliques no WhatsApp) existe, mas fica atrás de `vitrine_ia.ativa` (desligado).
- O botão de compartilhar o anúncio já existe.

## Decisões

1. **Estratégia:** trazer primeiro quem compra, pelo Radar. A demanda é o que segura o lojista.
2. **Motivo de quem não vende:** pedir uma vez no Radar e ser avisado.
3. **Radar para o lojista:** continua só para plano pago ou cortesia (sem mudança).
4. **Avisos fora do site:** WhatsApp oficial só nos avisos principais (proposta nova → comprador;
   pedido novo → loja). Teto de R$ 100 por mês. Passou do teto, os avisos voltam para o sino até o mês virar.
5. **"Vou procurar":** a loja marca o pedido. O comprador é avisado. A marca conta no limite de 5 lojas.
   Sem proposta em 3 dias, a vaga volta. A loja recebe um lembrete antes de o pedido vencer.
6. **Prova de venda:** o painel "Desempenho" é separado da vitrine nova e ligado só para planos pagos.
   O lojista grátis vê só o total de cliques no WhatsApp.
7. **Cortesia:** 30 dias de Radar no primeiro anúncio. Só loja, uma vez por loja.
8. **Divulgação:** o site gera um cartaz com QR por loja ("Não achou aqui? Peça no Radar").
   A loja ganha dias de Radar por cadastro pelo cartaz dela (exemplo: a cada 5 → +7 dias).
   Conta só quem confirmar o celular.
9. **Primeiro pedido:** a pessoa escreve o pedido antes de entrar. A conta e o celular vêm no fim.

## Ordem das etapas

1. Pedir antes do login → `docs/superpowers/plans/2026-11-13-radar-pedido-antes-login.md`
2. Cartaz com QR e recompensa para a loja
3. Botão "Vou procurar"
4. Total de contatos para o grátis e cortesia de 30 dias no primeiro anúncio
5. WhatsApp oficial (precisa de cadastro na Meta; tem custo; ligar só com o "sim" do Raniel)

## Para reavaliar depois do lançamento

- O lojista grátis vê pouco resultado (só o total de contatos). Se ele abandonar, abrir mais do painel.
