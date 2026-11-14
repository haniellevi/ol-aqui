# Radar piloto: o que mudou e o que falta para ligar

Ramo `claude/radar-piloto`. Nada foi enviado ao GitHub nem aplicado em produção.

## O que mudou

- **Pedido só por propostas com prazo.** O formulário do site não oferece mais "Podem me chamar no WhatsApp". O servidor recusa esse modo no pedido do site (`criar_pedido_radar_site`) e na validação do formulário. Pedidos antigos continuam como estavam.
- **Categoria obrigatória no pedido do site.** Vale no formulário, na validação do servidor e na função do banco. Uma subcategoria só vale se a categoria de cima também estiver ativa.
- **Pedido do Radar em "geral" vira sugestão de categoria.** Pedido sem categoria da tabela e do tipo "geral" (Aki) ou em Outros/Diversos (site) entra em Categorias sugeridas, marcado como "Pedido do Radar", com link para o pedido. Pedido do Aki em imóvel, veículo ou móvel não entra: já tem tipo próprio. Só o título vai junto, sem dados do comprador. A equipe cria categoria, junta (o pedido muda de categoria) ou recusa (nada muda). Um pedido tem no máximo uma sugestão. Migração `supabase/migrations/20261128030000_radar_categoria_geral.sql`; teste `supabase/testes/860_radar_categoria_geral.sql`.
- **Aki:** o pedido feito pelo Aki também sai só com propostas, com prazo de 72 horas. A mensagem de sucesso diz "vão mandar propostas aqui".
- **Aviso de pedido novo por WhatsApp** (Minha conta > Notificações):
  - desligado por padrão e só para a loja que ligou de propósito;
  - ligar exige celular confirmado e a chave `radar.whatsapp_ativo` ligada;
  - só chega se o aviso de pedido novo no site (sino) também estiver ligado;
  - uma mensagem por pedido e loja;
  - a mensagem diz só a cidade e o link do pedido, sem dados do comprador.
- **Janela de 8h às 20h de Fortaleza na hora de pegar a mensagem da fila.** Vale para toda a fila (inclusive avisos de verificação). Fora da janela nada sai (só a resposta de SAIR); a mensagem espera a próxima janela. O reenvio de falha também respeita a janela. Uma rodada de até 5 mensagens com 1,5 s entre elas: a última pode sair alguns segundos depois das 20h.
- **Telefone no padrão da região.** Número digitado sem DDD recebe o DDD da região (`microrregioes.ddd`, hoje Corrente-PI = 89). Cidade da região com DDD próprio (`cidades.ddd`, Barreiras-BA e Formosa do Rio Preto-BA = 77) não recebe o da região: a pessoa tem de digitar o DDD. Regra única em `src/lib/telefone.ts` e `src/lib/telefone-regiao.ts`. Exibição: (89) 99999-0000.
- **Radar de pedido fechado ou vencido** não sai mais da fila (fica cancelado). Com a chave geral desligada, os avisos do Radar ficam na fila sem sair; se o pedido fechar ou vencer enquanto isso, são cancelados.
- **Pedido de saída:** o webhook `/api/whatsapp/evolution` desliga o aviso do Radar de quem tem o número (com ou sem o 9 depois do DDD), cancela o que estava na fila dessa pessoa e manda UMA resposta de confirmação. Detalhes na seção abaixo. Não guarda o texto nem o número. Não cancela avisos de verificação.
- **Meu plano:**
  - mostra o nome do plano contratado mesmo quando ele saiu de venda;
  - se o plano saiu de venda, a renovação só oferece o plano recomendado (regra em `plano_a_venda`);
  - "Radar: até N propostas" só aparece para loja verificada; sem verificação mostra "depois que a loja for verificada";
  - "Radar liberado por cortesia até DD/MM" só aparece para a própria loja, e só com a loja ativa;
  - se a leitura do plano falhar, a página segue sem o nome extra (não cai).
- **Planos com Radar** listam só os planos ativos.
- **Modelo `proposta_nova` (WhatsApp):** "OLAKI" trocado por "Mercado da Região". Nenhuma mensagem nova vai ao comprador.

## SAIR: como funciona

- **Quais mensagens valem:** a mensagem inteira tem de ser um pedido (sem acento, sem caixa, sem pontuação; "por favor", "obrigado", "daqui", "agora" são ignorados). Verbos: sair, sai, saia, remover, remova, tirar, tira, retirar, descadastrar, desinscrever, parar, pare, para de, stop, cancelar. Verbo sozinho, com "quero", "pode" ou "me", ou com palavras de lista (meu número, da lista, do radar, mensagens): vale. Não vale verbo dentro de uma conversa ("posso remover o anúncio", "quero cancelar meu anúncio", "não quero sair"). Texto acima de 80 caracteres não vale.
  - Vale: "Sair", "SAIR!", "quero sair daqui", "pare por favor", "para de mandar", "não quero mais receber", "me tira da lista", "remover meu número".
  - Não vale: "vou sair de casa agora pra loja", "posso remover o anúncio", "parabéns", "oi".
  - Lista completa: `comandoDeSaida` em `src/lib/whatsapp/evolution.ts` e os testes em `tests/whatsapp-evolution.test.cjs`.
- **Conta encontrada:** desliga o aviso do Radar por WhatsApp, cancela os avisos do Radar que estavam na fila e registra a saída (sem número e sem texto).
- **Confirmação:** entra na fila UMA resposta por número e por dia, com este texto: "Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações." Ela sai fora da janela de 8h às 20h, e o Radar nunca a cancela.
- **Sem conta:** nada é registrado e nada é respondido.
- **Conversa `@lid`:** a Evolution pode mandar o identificador oculto no lugar do número. Então o número real é lido de `remoteJidAlt`, `senderPn` ou `senderPN` (nessa ordem; a grafia muda entre versões). Se nenhum vier, a mensagem é ignorada e o log registra só "saida sem numero legivel" (sem número e sem texto). Grupo é ignorado.
- **Conferência logo antes do pedido de envio:** depois de checar que a instância está aberta, o banco confere de novo se o aviso do Radar ainda pode sair: chave geral ligada, aviso da pessoa ligado, pedido aberto, prazo de propostas e vaga, e quem recebe ainda pode (loja ativa na região, WhatsApp verificado e igual ao da fila, conta não revogada, plano que avisa na hora, área e nicho do pedido). Se não pode, a mensagem vira "cancelada" com o motivo e não sai. Se a conferência falhar (erro do banco), nada é enviado e a mensagem volta para a fila como falha. Resposta de SAIR e avisos de verificação passam direto.
- **Risco que sobra:** a janela vai da conferência até o pedido de envio à Evolution: milissegundos. Uma SAIR que chegue nesse intervalo não segura aquela mensagem. Depois que o pedido sai, a mensagem já foi enviada e não há como desfazer.

**O que conferir no teste real (antes de ligar `radar.whatsapp_ativo`):**
1. Mandar SAIR de um celular com conta e conferir: a preferência do aviso fica desligada, chega UMA resposta com o texto acima e, se havia aviso do Radar na fila, ele foi cancelado.
2. Mandar SAIR de um celular sem conta: não chega nada e o banco não registra nada.
3. Mandar "quero sair" e "pare por favor" de conta com aviso na fila: deve sair. Mandar "vou sair de casa agora pra loja": não deve.
4. Ver no payload real da Evolution qual campo traz o número quando `remoteJid` termina em `@lid` (`remoteJidAlt`, `senderPn` ou `senderPN`). Se vier outro nome, ajustar `numeroDaConversa` em `src/lib/whatsapp/evolution.ts`. Se aparecer "saida sem numero legivel" no log, o campo falta.
5. Confirmar que a Evolution envia o cabeçalho `Authorization: Bearer <segredo>` no webhook (passo 5 acima).

## VOLTAR pelo WhatsApp (29/11/2026)

- **O que a pessoa manda:** "voltar", "volta", "quero voltar", "ativar", "ativa", "reativar", "quero receber", "quero receber de novo", "voltar a receber", "religar". Vale só a frase inteira (sem acento e sem caixa; "por favor" e "obrigado" são ignorados). "voltar amanhã na loja" é outra mensagem. "ligar" sozinho não volta (pode ser pedido de ligação): conta como SIM, abaixo.
- **SIM:** "sim", "s", "sim quero", "pode", "quero" e "ligar" só contam como volta quando há uma pergunta pendente: feita nos últimos 7 dias e sem resposta depois. Fora disso, SIM não faz nada (não gera pergunta nova).
- **Pergunta automática:** quem saiu pelo WhatsApp e ainda não voltou, ao mandar qualquer outra mensagem, recebe UMA pergunta a cada 7 dias, só com o Radar pelo WhatsApp ligado: "Oi! Você pediu para não receber pedidos do Radar pelo WhatsApp. Quer voltar a receber? Responda SIM." Não pergunta a quem nunca saiu, a número sem conta confirmada, nem a quem desligou pelo site depois da saída (quem decide por último, vale).
- **Volta:** liga o aviso do Radar no WhatsApp. Não mexe no sino do pedido novo no app: se o sino estiver desligado, a pessoa recebe "Para voltar a receber pedidos do Radar pelo WhatsApp, ligue antes o aviso de pedido novo no app em Minha conta > Notificações. Depois responda VOLTAR." (o WhatsApp só sai com o sino ligado; ligar ou desligar o sino é decisão da pessoa). Com o sino ligado, confirma: "Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR." Fica registrada uma volta por saída. Cada ativação tem a sua confirmação: VOLTAR, SAIR e VOLTAR no mesmo dia mandam as duas (dentro do limite de 3 por dia).
- **Já recebe:** "Você já recebe os pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR." Só sai quando o aviso no WhatsApp e o sino estão ligados. Com o sino desligado, sai o aviso de ligar o sino.
- **Quem nunca teve o aviso:** não é ligado pelo WhatsApp. Recebe, uma vez por dia: "Para receber pedidos do Radar no WhatsApp, ligue em Minha conta > Notificações no Mercado da Região."
- **Chave geral desligada (`radar.whatsapp_ativo`):** responde "No momento os avisos do Radar pelo WhatsApp estão pausados." e não liga nada. A pergunta também não sai com a chave desligada.
- **Mensagem repetida:** se uma outra mensagem é igual à anterior do mesmo número, em até 1 dia, não se responde nada. VOLTAR e SIM não entram nessa checagem: são sempre avaliados contra as preferências atuais, e apagam o resumo do número (a saída também apaga, com e sem o 9). Quem manda é o servidor: manda só um resumo (sha256) do texto, normalizado, e o banco guarda esse resumo de cada número por 1 dia (tabela `whatsapp_ultima_mensagem`). O texto não é guardado. Um resumo de palavra curta pode ser adivinhado; por isso ele só serve para repetição e dura 1 dia. Um agendamento de hora em hora (pg_cron, job `olaki-whatsapp-ultima-mensagem-limpar`) apaga o que tem mais de 1 dia, mesmo sem mensagem nova.
- **Mensagem sem texto** (foto, figurinha, reação): não vai ao banco e não é respondida.
- **Conta:** só conta com número confirmado (com ou sem o 9) e não revogada. Sem conta ou número não confirmado: nada é respondido e nada é registrado. O cadastro de WhatsApp é único com o número exato (`whatsapp_vinculos`), então não há duas contas com o mesmo número escrito igual.
- **Dados que o webhook manda ao banco:** o número e a intenção (voltar, sim, outra) de toda mensagem recebida de pessoa, com texto, e o resumo do texto. Para quem não tem conta, o banco não grava nada e responde "sem_conta". Isso precisa estar na política de privacidade antes do deploy (não foi alterada aqui).
- **Limites:** no máximo 3 respostas automáticas por número por dia (contando saída, volta, pergunta, pausado, sino e orientação). Cada tipo sai uma vez por dia. Essas respostas saem fora da janela de 8h às 20h e o Radar nunca as cancela. Se a volta acontece mas a resposta passa do limite, a volta fica registrada e a resposta não sai. Mensagem nossa, de grupo ou de status não é respondida.
- **Onde fica:** o webhook classifica o texto em `intencaoDaMensagem` (`src/lib/whatsapp/evolution.ts`) e chama `whatsapp_mensagem_recebida(numero, intencao, resumo)` no banco, que decide tudo numa transação, com trava por conta (a saída usa a mesma trava). A resposta automática passa por `whatsapp_resposta_automatica`. O texto da mensagem não é guardado. `whatsapp_respostas` guarda só o tipo (SAIR, VOLTAR, PERGUNTA_VOLTAR), sem número e sem texto.
- **Migração:** `20261129020000_whatsapp_voltar_ajustes.sql` vem depois da `20261129010000` (que já está em produção; esta não foi editada). Ela troca as funções da volta, da saída e da limpeza, e cria o job de hora em hora.
- **Risco que sobra:** duas contas com números que são iguais exceto pelo 9 (com e sem o 9) não são barradas pelo cadastro; a volta vale para uma só (a de menor id). Ninguém testou ainda a Evolution real: que tipos de evento ela manda para reação, figurinha e aviso de mensagem apagada.

**O que conferir no teste real (depois do SAIR):**
1. Conta que saiu: mandar "oi" → chega a pergunta UMA vez. Mandar "oi" de novo → não chega nada.
2. Responder "SIM" → chega a confirmação de volta, e Minha conta > Notificações mostra o aviso ligado.
3. Número sem conta mandando "voltar" ou "oi" → não chega nada.
4. Conta que nunca teve o aviso mandando "voltar" → chega só a orientação de ligar pelo site.
5. Conta com o sino do pedido novo desligado no app, que saiu, mandando "voltar" → chega o aviso para ligar o sino antes; o WhatsApp não é ligado.
6. Mandar a mesma mensagem duas vezes seguidas → só a primeira é respondida.
7. Mandar uma reação (👍) ou uma figurinha para a conversa → não chega resposta. Se chegar, registrar o que a Evolution mandou e corrigir antes de liberar.

## Ordem para ligar o piloto (nada disso foi feito)

1. **Aplicar as migrações ANTES de fazer merge ou deploy, nesta ordem** (no editor SQL do Supabase, como as anteriores; nenhuma está aplicada em produção): `20261125010000_radar_piloto.sql`, `20261125020000_radar_fila_recheca_propostas.sql`, `20261128010000_whatsapp_sair_completo.sql`, `20261128020000_microrregiao_ddd.sql`, `20261128030000_radar_categoria_geral.sql`, `20261128040000_whatsapp_sair_ajustes.sql`, `20261128050000_radar_ddd_cidade_e_geral.sql`, `20261129010000_whatsapp_voltar.sql`. Sem elas o Radar e a cortesia não funcionam como descritos (o meu plano usa funções novas; sem elas a página segue, mas sem a cortesia e com o nome do plano vindo da leitura normal).
2. **Antes de desativar o Slim no painel, marcar o Full como recomendado.** Hoje o recomendado é o Slim. Se o Slim sair de venda sem outro recomendado à venda, a renovação de quem está nele volta a oferecer todos os planos à venda.
3. Fazer merge e deploy do código.
4. Na Vercel (Production), criar `EVOLUTION_WEBHOOK_SEGREDO` com 32 caracteres ou mais, gerado fora do código, e fazer novo deploy. Sem ela o webhook responde 503 e não aceita nada.
5. Na Evolution, configurar o webhook de mensagens recebidas para `https://<seu-site>/api/whatsapp/evolution`, com o cabeçalho `Authorization: Bearer <segredo>`.
   - Antes, confirmar que a Evolution aceita cabeçalho personalizado. Se não aceitar, parar e não colocar o segredo na URL.
6. Ligar `radar.whatsapp_ativo` (painel ou SQL). É seguro: só recebe quem ligou o aviso no WhatsApp, e isso começa desligado para todas as lojas.
7. Testar com 1 loja: ligar o aviso em Minha conta > Notificações, criar um pedido com outra conta, conferir a chegada, responder SAIR e conferir que o aviso desligou. Conferir também que a conversa chega com número brasileiro (`@s.whatsapp.net`), não com `@lid`.
8. Antes de ligar em cidade com DDD próprio (Barreiras-BA, Formosa do Rio Preto-BA): cadastrar uma loja com número sem DDD e conferir que a tela pede o DDD.

## Ficou de fora (pendências e riscos)

- **SAIR durante o envio:** a conferência fica logo antes do pedido de envio (depois da checagem da instância). Sobra a janela de milissegundos entre a conferência e o pedido à Evolution. Aceito para o piloto; não há como desfazer um envio já feito.
- **Campo de telefone:** a máscara ainda pede o DDD digitado (a pessoa não digita só o número). O DDD da região entra só no servidor, quando o número chega sem DDD. Trocar para um prefixo fixo "(89)" pede mudar `src/components/ui/use-campo-telefone.ts` e testar no navegador.
- **Telas sem região:** montagem de loja e equipe do admin, funil de lojistas usam o DDD da região (ou pedem o DDD), não o da cidade do lead. Região nova sem DDD pede o DDD em cada número (falta o campo DDD na tela de criar região).
- **Números de 8 dígitos:** celular de 8 dígitos (começando de 6 a 9) ganha o 9 sem aviso; formulários do admin gravam direto. Falta conferência visual antes de salvar.
- **Conversa `@lid`:** o número é lido de `remoteJidAlt` ou `senderPn`. Isso veio da documentação e de issues públicas da Evolution, não de um teste com a Evolution real. Conferir no teste real (seção SAIR).
- **Aki sem categoria escolhida:** o Aki ainda usa o tipo antigo (imóvel, veículo, móvel ou geral) e cai em "geral" quando falta. A categoria obrigatória vale só no formulário do site. Pedido do Aki em "geral" já aparece para a equipe em Categorias sugeridas. Decidir se o Aki também deve pedir categoria.
- **Número separado para os avisos:** recomendado, não configurado.
- **Linha `Co-Authored-By` dos commits:** os commits anteriores dizem "Claude Opus 5.5" ou "Claude Haiku 5.5"; os desta rodada dizem "Claude Haiku 5.5" (Opus 5.5 não é usado). Decidir o nome antes de qualquer push (reescrever commit só com aprovação).
- **Frases fora da lista** (ex.: "sai dessa lista", "parei") não são reconhecidas como saída. Frases de até 80 caracteres só.
- **Pedido do Radar em geral sem backfill:** pedidos já criados antes da migração 20261128030000 não geram sugestão.
- **Nada foi testado com a Evolution de verdade.** O webhook foi testado com banco simulado.
- **Sem `next build` nesta rodada.**
