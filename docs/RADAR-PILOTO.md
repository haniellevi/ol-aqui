# Radar piloto: o que mudou e o que falta para ligar

O texto até a seção de operação é o histórico do ramo `claude/radar-piloto`. O roteiro vigente para esta candidata está em [Operação do piloto fechado de 30 dias](#operação-do-piloto-fechado-de-30-dias).

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
- **Limites:** no máximo 3 respostas automáticas por número por dia (pergunta, pausado, sino, orientação, já recebe e volta; a saída conta para as outras, mas não passa pelo limite, ver "Ficou de fora"). Cada tipo sai uma vez por dia, exceto a confirmação da volta, que sai uma por ativação. Essas respostas saem fora da janela de 8h às 20h e o Radar nunca as cancela. Se a volta acontece mas a resposta passa do limite, a volta fica registrada e a resposta não sai. Mensagem nossa, de grupo ou de status não é respondida.
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

1. **Aplicar as migrações ANTES de fazer merge ou deploy, nesta ordem** (no editor SQL do Supabase, como as anteriores; aplicar só as que ainda não estão em produção; a `20261129010000` já está): `20261125010000_radar_piloto.sql`, `20261125020000_radar_fila_recheca_propostas.sql`, `20261128010000_whatsapp_sair_completo.sql`, `20261128020000_microrregiao_ddd.sql`, `20261128030000_radar_categoria_geral.sql`, `20261128040000_whatsapp_sair_ajustes.sql`, `20261128050000_radar_ddd_cidade_e_geral.sql`, `20261129010000_whatsapp_voltar.sql`, `20261129020000_whatsapp_voltar_ajustes.sql`. Sem elas o Radar e a cortesia não funcionam como descritos (o meu plano usa funções novas; sem elas a página segue, mas sem a cortesia e com o nome do plano vindo da leitura normal).
2. **Antes de desativar o Slim no painel, marcar o Full como recomendado.** Hoje o recomendado é o Slim. Se o Slim sair de venda sem outro recomendado à venda, a renovação de quem está nele volta a oferecer todos os planos à venda.
3. Fazer merge e deploy do código.
4. Na Vercel (Production), criar `EVOLUTION_WEBHOOK_SEGREDO` com 32 caracteres ou mais, gerado fora do código, e fazer novo deploy. Sem ela o webhook responde 503 e não aceita nada.
5. Na Evolution, configurar o webhook de mensagens recebidas para `https://<seu-site>/api/whatsapp/evolution`, com o cabeçalho `Authorization: Bearer <segredo>`.
   - Antes, confirmar que a Evolution aceita cabeçalho personalizado. Se não aceitar, parar e não colocar o segredo na URL.
6. Ligar `radar.whatsapp_ativo` (painel ou SQL). É seguro: só recebe quem ligou o aviso no WhatsApp, e isso começa desligado para todas as lojas.
7. Testar com 1 loja: ligar o aviso em Minha conta > Notificações, criar um pedido com outra conta, conferir a chegada, responder SAIR e conferir que o aviso desligou. Conferir também que a conversa chega com número brasileiro (`@s.whatsapp.net`), não com `@lid`.
8. Antes de ligar em cidade com DDD próprio (Barreiras-BA, Formosa do Rio Preto-BA): cadastrar uma loja com número sem DDD e conferir que a tela pede o DDD.

## Ficou de fora (pendências e riscos)

- **Saída fora do limite:** a confirmação de SAIR entra direto na fila, sem passar pelo limite de 3 por número e dia. Pode ser a 4ª resposta do dia (ex.: pergunta, SIM, VOLTAR, SAIR). Decisão pendente: passar a saída pelo limite ou manter como está.
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

## Operação do piloto fechado de 30 dias

O Item 15 e468 aprovou a restrição dos três avisos em todo o serviço aos convidados de Corrente e região e a suspensão ao fim. Também aprovou a prova de aceite por tipo para VOLTAR e SIM em qualquer modo. Uma conta com preferência antiga ativa continua elegível em legado. Se usar SAIR e faltar prova do aceite, a pessoa deve ligar o aviso no site. O registro anterior permanece. A aprovação autoriza implementação local. Implantação, teste no aparelho, cadastro real, início e eventual volta ao legado exigem decisões próprias.

### Conferência e ativação

1. Com autorização de implantação, confirmar a release, versão de catálogo, privilégios de fila e webhook e acesso da sessão de manutenção. Registrar somente contagens dos três avisos por estado, perguntas automáticas, opt-ins por tipo e estado da chave geral e dos modelos. A fotografia do Item 11 serve de referência histórica.
2. Na mesma janela, instalar primeiro a migração em `legado` e depois o Worker novo. A migração conserva as RPCs anteriores. Com o Worker antigo, SAIR, a orientação para o site após VOLTAR e as demais finalidades da fila permanecem disponíveis. A entrada antiga não cria perguntas de SIM, e a coleta antiga ignora perguntas válidas que o Worker novo tenha enfileirado. A tela antiga ainda não oferece confirmação por tipo. O Worker novo usa as RPCs de evento, criação de pergunta, coleta e comprovante, concedidas só a `service_role`. Confirmar Notificações, webhook e gravação do resultado antes de mudar o modo. Preservar a chave `radar.whatsapp_ativo` e os limites do painel.
3. Identificar a microrregião no cadastro. A sessão de manutenção autorizada trava a linha de `radar_piloto_controle` com `FOR UPDATE` em toda mudança do modo ou da participação. Gravar região, ID próprio da rodada, início, fim e piso. Usar limites em UTC apresentados em Fortaleza. A vigência usa início inclusivo e fim exclusivo. Teste e piloto oficial recebem IDs distintos. O piloto oficial dura 30 dias desde o início aprovado.
4. Na mesma ordem de trava, validar conta, região e rodada antes de escrever em `radar_piloto_participantes`. Limitar o convite ao período da rodada e registrar retirada em `revogado_em`. Se a pessoa reentrar por decisão da equipe, usar um novo início após obter a trava e limpar a revogação. Repetir a mesma ação conserva o estado atual. Registrar operador, horário e motivo no controle operacional restrito. O aceite é feito pela própria conta em Notificações.
5. Explicar o descarte das pendências legadas antes de fechar. Avisos e perguntas do estoque incompatível são cancelados pelo banco. Depois da troca, conferir agregados e acompanhar a drenagem. Nenhum evento antigo é reprocessado.

### Comandos e confirmação

- SAIR grava o desligamento e troca a versão antes de tentar cancelar pendências livres. Uma coleta pode deter linhas de tipos misturados. As linhas ocupadas são reavaliadas no envio e por coletas seguintes. SAIR alcança as variantes do telefone. Quando mais de uma conta confirmada corresponde ao número, a reativação por WhatsApp fica bloqueada. A confirmação diária criada nesse caso indica que a pessoa deve entrar na própria conta e ligar cada aviso no site.
- VOLTAR exige prova de aceite individual, ID do evento e hora da mensagem posterior à retirada registrada. A hora precisa estar nos últimos sete dias e até a hora de processamento. A retirada usa a hora do banco e, quando compatível com o relógio local, a hora de origem como limite adicional. Eventos do mesmo segundo ou sem ordem demonstrável podem pedir confirmação no site. Reentrega com o mesmo ID fica sem efeito, mesmo que o texto seja um comando. Uma nova mensagem com o mesmo texto tem outro ID.
- Para usar SIM, a pessoa precisa escolher **Responder** na pergunta recebida e citá-la. A pergunta vale por sete dias desde a entrada na fila, com a mesma regra na coleta, no envio e na aceitação. O banco requer o comprovante de sucesso da Evolution para o ID citado. Se a resposta citada chega enquanto a tentativa está em andamento, o banco espera esse comprovante e avalia de novo depois de gravá-lo. Uma pergunta ainda pendente, sem citação correspondente, vencida, invalidada por retirada posterior ou com resultado incerto não reativa. A falta de prova deixa o caminho pelo site disponível.
- A Evolution 2.3.7 publica o texto em `data.message.conversation` e a citação em `data.contextInfo.stanzaId` no evento `messages.upsert`. O webhook também aceita a forma interna `data.message.extendedTextMessage.contextInfo.stanzaId` e descarta a referência se ambas estiverem presentes e divergirem. O evento usa o resumo SHA-256 de `data.key.id` com o escopo do telefone normalizado. O comprovante de envio usa o resumo do ID devolvido em `key.id`. [Preparação do payload na versão fixada](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts#L4650-L4682)
- O diário de deduplicação conserva o resumo do evento e a hora de registro por 14 dias, com limpeza em lotes de entradas posteriores. Comandos ignorados de números sem conta ficam fora do diário. Enquanto falta o comprovante, pode ser guardado o vínculo com a pergunta e o resumo citado. O histórico de SAIR guarda `data.messageTimestamp` quando a origem é admitida. Se o timestamp informado estiver mais de um minuto adiantado na entrada da RPC, guarda somente uma marca de incompatibilidade. Uma segunda saída e a passagem do tempo local não resolvem a incompatibilidade. A pessoa pode ligar o aviso no site ou citar uma nova pergunta válida, se disponível e com comprovante. Texto e IDs brutos ficam fora desses registros. Confirmar retenção, permissões e compatibilidade da entrada na janela própria. As provas locais usam relógios sintéticos e não verificam ordem real, reentrega ou chegada no aparelho.
- Com o Worker novo, a repetição automática fica restrita a falha definida anterior ao POST. Resposta HTTP sem sucesso, desligamento da conexão após o POST ou sucesso sem ID válido ficam como entrega incerta. O HTTP 400 genérico da Evolution pode ocorrer no tratamento posterior ao envio. As provas locais exercitam a rota da fila com esse retorno e verificam que a pergunta fica incerta após a primeira tentativa. [Tratamento da resposta no provedor](https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts#L2409-L2425)

### Pausa, estoque e reversão

- Alterar para `pausado` sob a trava de controle e confirmar a transação. Limpar pendências numa transação separada. A última leitura do banco bloqueia a tentativa quando pausa ou retirada já confirmou. A partir dessa leitura, uma chamada pode estar liberada ou em trânsito. SAIR, verificação, OTP, loja IA e respostas a VOLTAR explícito mantêm seu tratamento.
- Antes de retomar dentro do prazo, reconciliar pendentes e itens em envio com agregados restritos. Elevar `piso_fila_em` ao instante da retomada, depois de obter a trava, e manter a data final. Avisos e perguntas anteriores ao piso continuam inválidos. Preservar registros enviados, falhas definitivas e incertos. Incertos exigem investigação e ficam fora de reenvio automático.
- Ao fim do prazo, o banco bloqueia os avisos e perguntas do piloto sem reabrir o legado. Para reabrir expressamente, manter o modo pausado enquanto reconcilia e cancela o estoque anterior dos três tipos e perguntas; conferir ausência de tentativas em andamento e executar a mudança sob a trava de controle. Novos eventos elegíveis podem voltar a gerar aviso em qualquer região.
- Na reversão do Worker, usar versão compatível com as RPCs da fila/webhook e as credenciais recuperadas da versão 22. O Worker anterior perde a tela de aceite por tipo e o caminho de reativação pelo WhatsApp. Desligamento em bloco, SAIR e a orientação de VOLTAR continuam disponíveis. A coleta antiga mantém perguntas válidas pendentes para uma versão que comprove seu envio. Durante pausa ou expiração elas ficam inelegíveis, e a coleta cancela o estoque inválido. Uma tentativa já em andamento segue a última conferência e a regra de resultado da versão que a iniciou. Pausar se for necessário aguardar o restabelecimento da tela. Manter a guarda no banco. Uma correção de banco segue em nova migração.

### Teste com autorização separada

Abrir uma rodada curta, com comprador e loja controlados. Usar como controle uma loja apta com preferência ativa, fora do grupo. O próprio controle registra seu aceite em legado enquanto ainda não tem elegibilidade para receber pedido novo. Depois do fechamento, conferir que passaria pelos filtros de pedido sem a regra da coorte. Usar nicho e área reduzidos e pausar se chegar um evento fora do roteiro aos destinatários controlados.

Criar pedidos e propostas controlados, verificar cada aviso no aparelho e comprovar a ausência de aviso na conta de controle. Conferir que link e instrução SAIR são legíveis, sem dado desnecessário no texto ou título. Exercitar SAIR no aparelho, VOLTAR, retirada com pendência e um evento posterior para provar que itens anteriores não voltam. A corrida de um item já colhido é testada no banco descartável. Em qualquer falha, pausar e investigar antes de abrir os 30 dias.

### Medição

Nos primeiros sete dias, conferir diariamente. No restante, conferir semanalmente. Registrar opt-ins por tipo, fila por estado e motivo, tempo entre criação e envio por janela, comandos e contas distintas, pedidos com proposta e tempo até a primeira proposta. Ao fim, registrar totais, incidentes, pausas e indicadores com seus denominadores. Manter telefones, IDs de participantes e textos fora do relatório compartilhado. `enviada` é sucesso registrado na Evolution; a chegada no aparelho exige confirmação do teste controlado. O Radar não mede venda concluída.
