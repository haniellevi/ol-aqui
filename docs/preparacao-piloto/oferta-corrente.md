# Preparação da oferta em Corrente

**10/11/2026 · Convites suspensos.** Inventário consultado em produção no commit `490e478`. O cadastro das lojas será por adesão. O responsável pelo piloto compartilha o link depois do ensaio e do aceite das condições do [roteiro de liberação](liberacao.md). A entrada de compradores começa quando houver lojas aprovadas com oferta disponível.

## Entrada das lojas

[Link de cadastro para lojistas](https://ol-aqui.vercel.app/entrar?redirect_url=%2Fquero-vender%2Floja). O endereço abre a entrada com destino ao formulário de loja após as etapas de cadastro e confirmação. A abertura da página de entrada foi conferida em produção. O percurso completo com uma conta nova precisa passar no ensaio antes do compartilhamento.

O lojista cria a conta, confirma o WhatsApp, preenche os dados da loja e prepara os primeiros anúncios. A equipe acompanha os novos registros no painel **Lojas** e organiza a fila por cidade e nicho à medida que os cadastros chegam. Usar as primeiras ofertas reais para escolher os segmentos que receberão compradores.

## Fila de preparação

| Loja | Cadastro e verificação | Oferta inicial | Radar | Próximo passo |
| --- | --- | --- | --- | --- |
| Multi, se aderir | Vitrine ativa, revisão pendente. O painel bloqueia a aprovação até o responsável confirmar o WhatsApp da conta. Cadastro consultado sem CNPJ, endereço, site, Instagram e WhatsApp comercial informados. | Um rascunho sem título e sem categoria. Zero anúncios ativos. | Teste grátis com 0 de 3 propostas usadas no mês. Sem anúncio elegível para aviso por nicho. | Completar os dados aplicáveis, confirmar titularidade e contato e preparar as primeiras ofertas reais. |
| Próximas lojas | Entram na fila conforme se cadastrarem pelo link. | Aguardando os primeiros anúncios e confirmação de disponibilidade. | Conferir na conta de cada loja antes da liberação. | Registrar loja, nicho e etapa de preparação nesta fila. |

A loja suspensa identificada como teste fica fora da relação do piloto.

## O que conferir por loja

1. Confirmar com quem representa a loja o nome comercial, endereço ou área de atendimento, os dados de identificação aplicáveis, o WhatsApp comercial e quem responde às mensagens. Se o número comercial for diferente do da conta, confirmar o controle de ambos.
2. Abrir a vitrine e os links que a loja informar. Conferir se levam à empresa certa. Registrar a conferência no painel em **Lojas → Revisar dados da loja**.
3. Preparar, como ponto de partida, até três ofertas reais por loja. Para cada uma, registrar título, categoria e subcategoria, foto autorizada, preço ou condição, disponibilidade, cidade e retirada ou entrega. A loja confirma os dados antes da publicação. Conferir que o cartão aparece na vitrine de Corrente e que o contato abre para o número correto.
4. Registrar o responsável, a janela em que acompanha pedidos e o prazo combinado para responder. A lista de contatos e as evidências de titularidade ficam no controle privado da equipe.

## Cotas e avisos do Radar

| Plano conferido em produção | Anúncios ativos | Propostas no mês | Aviso por nicho |
| --- | --- | --- | --- |
| Teste grátis | 10 | 3 | Fora da regra de avisos para planos elegíveis |
| Slim | 10 | Sem limite mensal no plano | Elegível com vigência, WhatsApp confirmado, anúncio ativo do nicho e avisos ligados |
| Full | Sem limite no plano | Sem limite mensal no plano | Mesmos requisitos de elegibilidade |

Proposta para a rodada acompanhada: usar **Slim por 14 dias em cortesia**, só para as lojas confirmadas que participarão do ensaio de avisos. No painel, usar **Lojas → Ações → Trocar o plano → Slim**, informar a duração e registrar o motivo da cortesia. O painel informa que a troca manual não gera cobrança. Registrar data de início e de vencimento por loja. A vigência começa quando houver oferta pronta para o ensaio.

Em Corrente, o aviso interno de pedido novo está ligado. Na consulta, os tetos eram dez avisos por dia por vendedor, dois por comprador por dia por vendedor e até 200 destinatários por pedido. São limites de **avisos**, separados do saldo de **propostas**. Antes de abrir o lote, conferir o saldo e observar uma notificação na conta do lojista.

## Ensaio de liberação

| Etapa | Evidência que precisa ficar registrada | Situação |
| --- | --- | --- |
| Chegar pelo link | Em celular e com conta de teste nova, abrir o link, criar conta, confirmar WhatsApp e chegar ao cadastro da loja | Interface local aprovada em 390 × 844 com login e código simulados. Produção e aparelho físico pendentes |
| Verificar a loja | Responsável confirmado, revisão aprovada no admin e vitrine com selo | Pendente de dados e confirmação do responsável |
| Publicar a oferta | Um anúncio real com foto visível na vitrine de Corrente e contato conferido | Anúncio fictício com foto publicada pela interface local. Oferta real pendente |
| Rodar Radar com duas contas | Comprador publica pedido do mesmo nicho, loja vê aviso e envia proposta, comprador recebe a proposta e abre o contato correto | Interface local confirmou aviso, envio e recebimento da proposta. A abertura do contato foi verificada na suíte isolada de banco |
| Repetir e encerrar | Loja consegue enviar outra proposta dentro das regras. Comprador encerra ou arquiva e a equipe registra o resultado no [modelo de casos](casos.csv) | Cotas e arquivamento cobertos pelos testes de banco. Registro do ensaio pelo site pendente |

Na revisão, o banco isolado passou nos cenários de verificação de loja, vitrine, Radar, notificações por nicho, cotas, contato e arquivamento. A conferência ao vivo confirmou o cadastro e os limites acima.

Em 10/11/2026, o formulário **Dados da loja** abriu em largura de celular no Chrome com uma sessão já autenticada. A suíte ganhou um cenário integrado com perfis fictícios que confirma o bloqueio sem WhatsApp, a reserva e o consumo simulado do código, o cadastro da loja, a revisão e a cortesia no admin, a publicação com referência fictícia de foto, a notificação por nicho, a proposta e o arquivamento. A suíte passou no PostgreSQL descartável sem rede.

Em seguida, o fluxo foi exercitado na interface de uma cópia descartável do commit `490e478` em 390 × 844. A sessão de lojista começou sem perfil. O link de entrada preservou o destino até **Dados da loja** após a confirmação simulada. A interface salvou uma imagem escolhida na galeria e abriu o anúncio publicado com a foto carregada. O admin local aplicou Slim em cortesia por 14 dias. Um comprador fictício publicou um pedido privado de Móveis em Corrente. A loja abriu o pedido pelo aviso recebido no sino e enviou uma proposta de R$ 1.500,50 ligada ao anúncio. O comprador viu a proposta na própria conta. O banco registrou um anúncio ativo com uma foto, um aviso de pedido novo para a loja e uma proposta ligada ao anúncio.

Foram simulados o login, o Turnstile, o transporte do código e o serviço de armazenamento de imagens. O formulário, o upload do arquivo ao serviço local, as ações do aplicativo e as regras do PostgreSQL foram exercitados. Ficam pendentes o aparelho físico e as integrações reais. Os convites permanecem suspensos.
