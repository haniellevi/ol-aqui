# Radar piloto: o que mudou e o que falta para ligar

Ramo `claude/radar-piloto`. Nada foi enviado ao GitHub nem aplicado em produção.

## O que mudou

- **Pedido só por propostas com prazo.** O formulário do site não oferece mais "Podem me chamar no WhatsApp". O servidor recusa esse modo no pedido do site (`criar_pedido_radar_site`) e na validação do formulário. Pedidos antigos continuam como estavam.
- **Categoria obrigatória no pedido do site.** Vale no formulário, na validação do servidor e na função do banco. Uma subcategoria só vale se a categoria de cima também estiver ativa.
- **Pedido do Radar em "geral" vira sugestão de categoria.** Pedido sem categoria (Aki) ou em Outros/Diversos (site) entra em Categorias sugeridas, marcado como "Pedido do Radar", com link para o pedido. Só o título vai junto, sem dados do comprador. A equipe cria categoria, junta (o pedido muda de categoria) ou recusa (nada muda). Um pedido tem no máximo uma sugestão. Migração `supabase/migrations/20261125050000_radar_categoria_geral.sql`; teste `supabase/testes/860_radar_categoria_geral.sql`.
- **Aki:** o pedido feito pelo Aki também sai só com propostas, com prazo de 72 horas. A mensagem de sucesso diz "vão mandar propostas aqui".
- **Aviso de pedido novo por WhatsApp** (Minha conta > Notificações):
  - desligado por padrão e só para a loja que ligou de propósito;
  - ligar exige celular confirmado e a chave `radar.whatsapp_ativo` ligada;
  - só chega se o aviso de pedido novo no site (sino) também estiver ligado;
  - uma mensagem por pedido e loja;
  - a mensagem diz só a cidade e o link do pedido, sem dados do comprador.
- **Janela de 8h às 20h de Fortaleza na hora de enviar.** Vale para toda a fila (inclusive avisos de verificação). Fora da janela nada sai; a mensagem espera a próxima janela. O reenvio de falha também respeita a janela.
- **Radar de pedido fechado ou vencido** não sai mais da fila (fica cancelado). Com a chave geral desligada, os avisos do Radar ficam na fila sem sair; se o pedido fechar ou vencer enquanto isso, são cancelados.
- **SAIR, PARAR, STOP e CANCELAR** (sem acento e sem caixa): o webhook `/api/whatsapp/evolution` desliga o aviso do Radar de quem tem o número (com ou sem o 9 depois do DDD) e cancela o que estava na fila dessa pessoa. Não guarda o texto nem o número. Não cancela avisos de verificação.
- **Meu plano:**
  - mostra o nome do plano contratado mesmo quando ele saiu de venda;
  - se o plano saiu de venda, a renovação só oferece o plano recomendado (regra em `plano_a_venda`);
  - "Radar: até N propostas" só aparece para loja verificada; sem verificação mostra "depois que a loja for verificada";
  - "Radar liberado por cortesia até DD/MM" só aparece para a própria loja, e só com a loja ativa;
  - se a leitura do plano falhar, a página segue sem o nome extra (não cai).
- **Planos com Radar** listam só os planos ativos.
- **Modelo `proposta_nova` (WhatsApp):** "OLAKI" trocado por "Mercado da Região". Nenhuma mensagem nova vai ao comprador.

## Ordem para ligar o piloto (nada disso foi feito)

1. **Aplicar a migração ANTES de fazer merge ou deploy.** Arquivo: `supabase/migrations/20261125010000_radar_piloto.sql`, no editor SQL do Supabase, como as anteriores. Meu plano usa funções novas; sem elas a página segue, mas sem a cortesia e com o nome do plano vindo da leitura normal.
2. **Antes de desativar o Slim no painel, marcar o Full como recomendado.** Hoje o recomendado é o Slim. Se o Slim sair de venda sem outro recomendado à venda, a renovação de quem está nele volta a oferecer todos os planos à venda.
3. Fazer merge e deploy do código.
4. Na Vercel (Production), criar `EVOLUTION_WEBHOOK_SEGREDO` com 32 caracteres ou mais, gerado fora do código, e fazer novo deploy. Sem ela o webhook responde 503 e não aceita nada.
5. Na Evolution, configurar o webhook de mensagens recebidas para `https://<seu-site>/api/whatsapp/evolution`, com o cabeçalho `Authorization: Bearer <segredo>`.
   - Antes, confirmar que a Evolution aceita cabeçalho personalizado. Se não aceitar, parar e não colocar o segredo na URL.
6. Ligar `radar.whatsapp_ativo` (painel ou SQL). É seguro: só recebe quem ligou o aviso no WhatsApp, e isso começa desligado para todas as lojas.
7. Testar com 1 loja: ligar o aviso em Minha conta > Notificações, criar um pedido com outra conta, conferir a chegada, responder SAIR e conferir que o aviso desligou. Conferir também que a conversa chega com número brasileiro (`@s.whatsapp.net`), não com `@lid`.

## Ficou de fora (pendências e riscos)

- **SAIR não alcança a mensagem que já foi marcada para envio** (janela de segundos entre pegar e enviar). Aceito para o piloto.
- **Conversa `@lid` é ignorada pelo webhook.** Se a Evolution mandar SAIR por esse tipo de conversa, o pedido de saída não vale. Conferir no passo 5.
- **Aki sem categoria escolhida:** o Aki ainda usa o tipo antigo (imóvel, veículo, móvel ou geral) e cai em "geral" quando falta. A categoria obrigatória vale só no formulário do site. Pedido do Aki em "geral" já aparece para a equipe em Categorias sugeridas. Decidir se o Aki também deve pedir categoria.
- **Número separado para os avisos:** recomendado, não configurado.
- **Linha `Co-Authored-By` dos commits:** os 5 primeiros commits dizem "Claude Opus 5.5"; o modelo em uso é "Claude Haiku 5.5". Decidir qual vale antes de qualquer push (reescrever commit só com aprovação).
- **Nada foi testado com a Evolution de verdade.** O webhook foi testado com banco simulado.
- **Sem `next build` nesta rodada.**
