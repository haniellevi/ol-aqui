# Verificação de lojas, Radar e estatísticas do OL-AQUI

Revisão de produto e do código local no commit `9471147`. A verificação da configuração publicada e o levantamento de conflitos reais ficam para a preparação da implantação. As regras abaixo identificadas como propostas são decisões de produto para o piloto.

Critério de sucesso. A pessoa sabe com quem está negociando, o vendedor encontra pedidos que pode atender e o admin distingue atividade, atendimento e dinheiro efetivamente movimentado.

## Lojas e contatos

| Item | O que existe | Regra proposta |
| --- | --- | --- |
| Nome da loja | O endereço da vitrine é único. Duas lojas ainda podem usar o mesmo nome com endereços diferentes. | Unicidade global do nome comercial completo, aplicada no banco ao cadastrar e editar. Normalizar maiúsculas, acentos, pontuação e espaços. Nomes parecidos vão para revisão. Filiais usam um complemento visível, como unidade ou cidade, que as distingue. |
| Link | O endereço `/loja/...` tem índice único. O Instagram cadastrado passa por validação de formato. | Conferir se o link interno abre a loja certa. Para site ou rede social informado pela loja, conferir se abre e se pertence à empresa. Preservar o endereço interno compartilhado durante o piloto. |
| WhatsApp | A conta pode confirmar o número por código. A vitrine pode informar outro telefone comercial, que o Radar prioriza. | Um número canônico pertence a uma única conta. Se a loja usar o mesmo número da própria conta, reaproveitar a confirmação. Se informar outro, confirmar esse número antes de publicar ou liberar contato pelo Radar. |
| Selo | A equipe pode aprovar evidências e conceder o selo em ações separadas. | Vincular o selo a uma revisão do responsável, nome comercial, dados cadastrais aplicáveis, cidade, WhatsApp e links informados. Mudança em dado relevante reabre a conferência daquele item. |

Aplicar a exclusividade do telefone com restrição no banco e uma operação atômica de vínculo, incluindo confirmação por código, sincronização da identidade, edição de loja e operação administrativa. Quando houver conflito, encaminhar a recuperação ou transferência com comprovação de controle. Antes de ativar a regra em bases existentes, inventariar nomes e números em conflito e resolver cada caso com evidência. Tratar nome ocupado, link ocupado e telefone vinculado com mensagens diferentes.

Reaproveitar **Admin → Lojas**. A fila mostra a situação de cada item e o dado público que será exibido. O operador usa **Aprovar**, **Pedir correção** e **Recusar**, com motivos selecionáveis e histórico de decisões. Evidências de identidade ficam acessíveis somente à equipe autorizada.

Fontes locais. [Link único e cadastro de loja](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107020000_categorias_e_anuncios.sql:303), [confirmação do WhatsApp](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110012622_confirmacao_whatsapp.sql:59), [telefone entregue pelo Radar](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:201) e [selo e verificação administrativa](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108050000_equipe_compliance.sql:587).

## Radar para quem vende

**Três propostas disponíveis** é a quantidade de novas ofertas que o vendedor ainda pode enviar. No plano de teste configurado no projeto, o contador soma propostas desde a criação da vitrine, durante o teste. Para outros planos com limite mensal, o contador considera o início do mês. A edição permitida de uma proposta já enviada aproveita a mesma oferta. O teto de propostas que um pedido pode receber é outra regra. A interface pode dizer **Você ainda pode enviar 3 ofertas neste teste.** [Regra da cota](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010100_painel_admin.sql:178) e [envio e edição](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:111).

O comprador publica em **Pedir no Radar**. O vendedor vê pedidos, escolhe quais consegue atender e envia uma oferta. A aba **Pedidos na região** já funciona como feed separado da vitrine. O código busca até 40 pedidos recentes da microrregião e filtra por categoria principal depois de carregá-los. Um nicho com poucos pedidos pode parecer vazio se seus pedidos estiverem fora desse recorte. O número mostrado como compradores no topo do feed é a contagem da amostra de pedidos. [Consulta do feed](/home/raniel-linux/workspace/OLAQUI/src/app/radar/page.tsx:88) e [filtro e contador](/home/raniel-linux/workspace/OLAQUI/src/components/radar/radar-de-negocios.tsx:77).

Já há avisos dentro do aplicativo. Um pedido aberto pode avisar lojas ativas da microrregião com anúncio ativo na mesma categoria principal. Sem categoria, a seleção se amplia. O código prioriza acesso ao Radar, aplica preferências e tetos e considera vitrines do tipo loja. O filtro atual opera na categoria principal. [Seleção de destinatários](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:914).

**Proposta para o piloto.** Manter a aba como **Pedidos de clientes** com filtros de região, cidade, categoria, subcategoria e busca por item, aplicados antes da paginação. Acrescentar **Do meu nicho**, com categorias, subcategorias e produtos ativos selecionados no perfil do vendedor. Um pedido publicado gera aviso no app a lojistas e vendedores com plano pago elegível ou cortesia do piloto, desde que possam atender à região e haja correspondência. Mostrar o motivo do aviso, por exemplo **Pedido de bicicleta na sua região**. Usar a mesma checagem de elegibilidade no aviso e no botão de enviar oferta, considerando plano, saldo e disponibilidade do pedido. Deduplicar avisos por pedido e vendedor, com controle de volume e preferências. Pedidos amplos continuam no feed e podem ter avisos gerais optativos. O admin escolhe elegibilidade, canais e limites por seletores e chaves.

## Radar para quem compra

**Meus pedidos** já mostra as ofertas, com preço, mensagem e foto ou anúncio, e permite abrir o WhatsApp da loja por proposta. No modo de propostas, o comprador escolhe com quem falar e seu telefone fica reservado. No modo de contato direto, o comprador autoriza a loja a acessar seu WhatsApp confirmado após enviar oferta válida. O botão do WhatsApp registra a escolha da proposta. [Comparação das ofertas](/home/raniel-linux/workspace/OLAQUI/src/components/radar/propostas-recebidas.tsx:148) e [regra de contato](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:171).

Hoje o comprador pode marcar **Já resolvi** ou **Cancelar pedido**. Acrescentar **Arquivar** aos pedidos encerrados, com aba própria e histórico. Para um pedido aberto, oferecer **Encerrar e arquivar** com a consequência explícita de parar de receber ofertas. Arquivamento e resultado do pedido ficam registrados separadamente. [Ações atuais](/home/raniel-linux/workspace/OLAQUI/src/components/radar/acoes-pedido.tsx:37).

O bate-papo humano é uma entrega nova. Definir uma conversa privada por pedido e loja, aberta pelo comprador a partir de uma proposta. Participantes autorizados recebem avisos, podem bloquear e denunciar. Manter o WhatsApp confirmado como escolha ao lado de **Conversar aqui**. O piloto pode ensaiar a jornada de proposta, contato e resolução pelo fluxo existente enquanto o chat é desenvolvido em etapa própria.

## Estatísticas e valor dos negócios

A receita da empresa reúne planos e demais ganhos do projeto. A estatística regional representa a **movimentação aproximada das propostas** entre usuários. Acompanhar negócios fechados continua útil para o piloto e constitui um terceiro indicador de resultado.

| Indicador no admin | Evidência atual | Medição proposta |
| --- | --- | --- |
| Anúncios | Resumo de ativos e relatório por cidade/categoria. | Total, ativos agora e publicados no período, com os rótulos separados. |
| Usuários | O resumo atual conta vitrines. | Usuários cadastrados, novos no período, compradores e vendedores. Contar perfis distintos e separar equipe e contas de teste identificadas. |
| Radar | Pedidos abertos, ofertas no mês, pedidos com oferta e propostas escolhidas. | Pedidos válidos, compradores únicos com resposta, pedidos resolvidos, tempo para primeira oferta e negócios confirmados. Calcular taxas na mesma população e janela. |
| Receita do OL-AQUI | Valores pagos em planos, anúncios avulsos e destaques, por mês e região. | Consolidar mês, ano e histórico, com teste separado de produção e tratamento de estornos e registros cuja origem precise ser conciliada. |
| Movimentação aproximada das propostas | O Radar já registra preço em centavos quando informado. | Somar valores ofertados por região, mês, ano e histórico. Cada proposta entra uma vez pelo seu identificador. Várias ofertas para o mesmo pedido representam atividade de negociação. Mostrar propostas sem preço separadamente. |
| Negócios fechados | O vendedor pode marcar um anúncio como vendido e indicar se vendeu pelo OL-AQUI. Essa ação registra data e atribuição declarada. | Medir desfechos à parte, com distinção entre declaração de uma parte e confirmação das duas. |

Corrigir dois rótulos do resumo atual. **Propostas por pedido** deve usar ofertas e pedidos da mesma janela, pois hoje divide propostas do mês por pedidos abertos no momento. **Propostas escolhidas** pode indicar **Contato solicitado**. A função registra a abertura do contato, enquanto conversa, resolução e fechamento são eventos distintos.

Exibir filtros **Região**, **Mês**, **Ano** e **Histórico**. Para o indicador regional, usar a região do pedido e a data em que a proposta foi enviada. Usar o último preço válido de cada proposta no recorte e explicitar o critério para edições. Uma proposta sem preço conta como atividade e fica fora da soma em reais. A receita da empresa usa as cobranças do OL-AQUI. A quantidade de negócios fechados usa os desfechos confirmados ou declarados.

Fontes locais. [Resumo do admin](/home/raniel-linux/workspace/OLAQUI/src/app/admin/page.tsx:18), [registro de vendido](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107020000_categorias_e_anuncios.sql:1004), [relatório de anúncios](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:533) e [receita mensal](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:581).

## Prioridade de entrega

1. **Integridade antes dos convites.** Conferir cadastro e links, impedir duplicidade de nome e WhatsApp no banco, vincular o selo à verificação e ensaiar o contato comercial real. Conferir os conflitos da base antes da migração.
2. **Radar e medição desde o primeiro pedido.** Explicar o saldo, melhorar filtros e avisos, testar proposta e WhatsApp, separar encerramento de arquivo e registrar respostas e desfechos. Garantir cota suficiente para os vendedores do piloto repetirem o fluxo.
3. **Movimentação e receita no admin.** Apresentar ofertas por região, mês, ano e histórico e consolidar a receita da empresa em cartões próprios. Medir fechamento em indicador separado. O bate-papo entra em etapa própria, preservando a opção de WhatsApp.
