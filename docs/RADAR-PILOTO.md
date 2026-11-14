# Radar piloto: o que mudou e o que falta para ligar

Ramo `claude/radar-piloto`. Nada foi enviado ao GitHub nem aplicado em produção.

## O que mudou

- **Pedido só por propostas com prazo.** O formulário do site não oferece mais "Podem me chamar no WhatsApp". O servidor também recusa esse modo.
- **Categoria obrigatória no pedido do site.** Vale no formulário, na validação do servidor e na função `criar_pedido_radar_site`. O Aki usa outra função (`criar_pedido_radar`) e não muda.
- **Cortesia do Radar por loja.** Meu plano mostra "Radar liberado por cortesia até DD/MM" só para a loja que tem cortesia.
- **Meu plano:** mostra o nome do plano contratado mesmo quando ele saiu de venda, e avisa que a renovação vai para o plano recomendado. No período grátis não há promessa de Radar.
- **Planos com Radar** listam só os planos ativos.
- **Aviso de pedido novo por WhatsApp** (Minha conta > Notificações):
  - desligado por padrão;
  - ligar exige celular confirmado;
  - só entre 8h e 20h (horário de Fortaleza); fora disso a mensagem espera a próxima janela;
  - uma mensagem por pedido e loja;
  - a mensagem diz só a cidade e o link do pedido, sem dados do comprador;
  - só é enviado com a chave `radar.whatsapp_ativo` ligada (começa desligada).
- **SAIR, PARAR, STOP e CANCELAR** (sem acento e sem caixa): o webhook `/api/whatsapp/evolution` desliga o aviso do Radar de quem tem o número e cancela o que estava na fila dessa pessoa. Não guarda o texto nem o número. Não cancela outros avisos.
- **Modelo `proposta_nova` (WhatsApp):** "OLAKI" trocado por "Mercado da Região". Nenhuma mensagem nova vai ao comprador.

## Passos para ligar o piloto (nenhum foi feito)

1. Aplicar `supabase/migrations/20261125010000_radar_piloto.sql` no editor SQL do Supabase, como as migrações anteriores.
2. Na Vercel, criar `EVOLUTION_WEBHOOK_SEGREDO` (32 caracteres ou mais, gerado fora do código) em Production e fazer novo deploy. Sem ela o webhook responde 503 e não aceita nada.
3. Na Evolution, configurar o webhook de mensagens recebidas para `https://<seu-site>/api/whatsapp/evolution`, com o cabeçalho `Authorization: Bearer <segredo>`.
   - Antes, confirmar que a Evolution aceita cabeçalho personalizado. Se não aceitar, parar e não colocar o segredo na URL.
4. Testar com 1 loja: ligar o aviso em Minha conta > Notificações, criar um pedido com outra conta, conferir a chegada, responder SAIR e conferir que o aviso desligou.
5. Só depois, ligar `radar.whatsapp_ativo` (painel ou SQL) para todas as lojas.

Número separado para os avisos: recomendado, mas não configurado neste trabalho.

## Ficou de fora

- SAIR não cancela avisos de verificação de loja, só os do Radar.
- Nenhuma resposta automática é enviada ao SAIR.
- O webhook só lê conversa de pessoa com número brasileiro (`@s.whatsapp.net`). Conversa com identificador novo (`@lid`) é ignorada. Se a Evolution mandar SAIR por esse tipo de conversa, o pedido de saída não vale: conferir no teste do passo 4.
- Número separado para os avisos: não configurado.
