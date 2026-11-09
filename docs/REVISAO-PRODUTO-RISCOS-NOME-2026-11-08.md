> Atualização de 09/11/2026: esta revisão foi feita sobre uma cópia local desatualizada. A reconciliação com `origin/main` (`6052f1d`) confirmou que Radar, cobrança, avisos, páginas legais e administração já tinham implementações mais novas. Os apontamentos abaixo são históricos e não descrevem integralmente a versão publicada. Consulte `CORRECOES-FLUXO-2026-11-09.md` para o escopo corrigido e os testes atuais.

**Revisão do OLAKI: produto, riscos e nome**

Data de referência: 08/11/2026. Prioridade confirmada pelo Raniel: encontrar produtos e serviços próximos e publicar necessidades para receber ofertas da região.

Critério de sucesso desta revisão: relacionar melhorias à proposta do produto, distinguir evidências de hipóteses e organizar uma sequência verificável de execução. Base: documentos, código e migrações locais; checagens de TypeScript e lint; pesquisa preliminar de nomes e documentação oficial. Não houve auditoria do ambiente de produção, teste com usuários nem execução das migrações em banco.

**A promessa que deve organizar o produto**

“Encontre o que precisa por perto ou receba ofertas de quem vende na sua região.”

A busca e os pedidos devem formar um único percurso. Quem procura uma geladeira vê os anúncios disponíveis; se não encontrar algo adequado, transforma a busca em pedido, informa orçamento e prazo e compara respostas. O catálogo também fornece produtos que as lojas podem anexar às propostas.

O princípio é reduzir o tempo entre uma necessidade e uma resposta útil. Isso exige oferta atualizada, vendedores que respondam e controle do comprador sobre o contato. A marca, a navegação e a cobrança precisam sustentar essa experiência.

**Como eu desenharia a experiência**

| Momento | Melhoria proposta | Critério de aceitação |
|---|---|---|
| Entrada | Cidade visível, busca central e duas ações claras: procurar e publicar um pedido. | Pessoa consegue explicar as duas possibilidades sem ajuda. |
| Busca | Categoria, preço e região preservados ao transformar a busca em pedido. Oferecer ampliar a área quando faltar oferta. | Não redigitar informação já fornecida; expansão geográfica sempre explícita. |
| Pedido | Perguntar o que procura, localização, orçamento opcional e prazo. Foto de referência opcional. | Pedido pode ser criado sem exigir que o usuário saiba o nome técnico do produto. |
| Respostas | Comparar preço, condição, disponibilidade, retirada/entrega, custo adicional e validade. Serviços precisam de unidade de cobrança e escopo. | Comprador entende o total e as diferenças relevantes entre ofertas. |
| Contato | Propostas dentro da plataforma como padrão. WhatsApp direto como escolha explicada do comprador. | Número só é liberado no momento escolhido; existe bloquear e denunciar. |
| Encerramento | Encontrou, desistiu, resolveu fora ou continua procurando. Impedir novas abordagens após encerrar. | Lojistas deixam de gastar tempo com necessidades vencidas. |
| Vendedor | Anexar anúncio existente, confirmar estoque e receber avisos por categoria e área atendida. | Uma resposta útil pode ser enviada sem recadastrar produto. |
| Confiança | Explicar o que cada selo verificou e quando. | Confirmação de telefone ou CNPJ não é apresentada como garantia de boa negociação. |

Na interface do comprador, testaria “Pedir ofertas” e “Meus pedidos”. “Radar” pode permanecer como nome da ferramenta do lojista, acompanhado de “Pedidos da região”. Isso é uma hipótese de clareza, a validar com pessoas do piloto.

**Falhas e lacunas encontradas no código**

P0: corrigir antes de uma abertura pública do fluxo afetado. P1: necessário para um piloto confiável. P2: evolução após o fluxo principal funcionar. As observações abaixo se referem ao repositório examinado, não comprovam o estado do banco publicado.

| Prioridade | Evidência | Consequência e correção proposta |
|---|---|---|
| P0 | [radar_feed](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010200_endurecimento_advisor.sql:14) executa como `security definer` e não restringe a região. O filtro fica na [página](/home/raniel-linux/workspace/OLAQUI/src/app/radar/page.tsx:33). | Uma chamada direta por usuário autenticado pode listar pedidos de outras regiões; com acesso ao Radar, pode receber detalhes e primeiro nome. O telefone continua protegido por outra função. Impor a regra territorial dentro da função e testar dois usuários de regiões distintas. A [documentação do Supabase](https://supabase.com/docs/guides/database/functions) explica por que essas funções precisam verificar acesso explicitamente. |
| P0 | [Sincronização de perfil](/home/raniel-linux/workspace/OLAQUI/src/lib/perfil.ts:56) não verifica o `error` retornado pelos updates. O webhook pode terminar com sucesso. | Uma falha de gravação pode manter número ou confirmação antigos sem disparar nova tentativa. Validar os retornos e testar falha de banco durante troca e remoção de telefone. |
| P0 para divulgar o Radar | A [home](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/page.tsx:104) oferece “Pedir no Radar”, mas a rota abre o feed do lojista. Não foi encontrado fluxo para criar/acompanhar pedidos ou escolher propostas. | A promessa central não se completa. Construir o percurso comprador, inclusive o reaproveitamento de `?pedido=` da busca vazia. |
| P1 | [Trocar cidade](/home/raniel-linux/workspace/OLAQUI/src/components/ui/cabecalho-publico.tsx:12) aponta para `/?cidade=escolher`; a home não implementa a seleção. | O visitante não consegue executar uma ação fundamental ao posicionamento local. Implementar seleção persistente, usando identificador de cidade e UF para evitar homônimos na expansão. |
| P1 | [Busca](/home/raniel-linux/workspace/OLAQUI/src/lib/dados/anuncios.ts:46) converte erro em lista vazia. Outras leituras seguem padrão semelhante. | Indisponibilidade parece falta de anúncios. Distinguir erro, vazio e sucesso, com nova tentativa e registro técnico sem dados sensíveis. |
| P1 | [Controle de propostas](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010200_endurecimento_advisor.sql:46) trava o pedido, mas consulta a cota da loja sem travar a loja. O [limite de anúncios](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010100_painel_admin.sql:205) também usa contagem sem serializar por vitrine. | Há risco de ultrapassar cotas com requisições simultâneas a registros distintos. Validar em teste concorrente e garantir atomicidade por loja. Não reproduzido nesta revisão. |
| P1 | [Plano](/home/raniel-linux/workspace/OLAQUI/src/app/(conta)/minha-conta/plano/page.tsx:18) e notificações estão “Em breve”; não foi encontrada rota de webhook do Asaas nem envio do resumo de propostas. | O sistema ainda não fecha cobrança e entrega de avisos. Não anunciar como disponível o que depende dessas integrações. Validar duplicação, atraso, estorno e reconciliação antes de cobrar. |
| P1 | [Categorias do Radar](/home/raniel-linux/workspace/OLAQUI/src/components/radar/radar-de-negocios.tsx:12) continuam fixas em quatro valores, enquanto os anúncios têm categorias em tabela. | Agro, serviços e demais segmentos podem perder precisão ao relacionar pedidos a anúncios. Unificar o vocabulário e permitir mapeamento da estrutura antiga. |
| P1 | [Exportação de dados](/home/raniel-linux/workspace/OLAQUI/src/app/(conta)/minha-conta/privacidade/baixar/route.ts:22) checa apenas o erro do perfil e substitui falhas de outras consultas por listas vazias. | Pode entregar arquivo incompleto como se estivesse completo. Validar todas as consultas, paginação e propostas recebidas, além das enviadas. |
| P1 | [Logs](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107000000_olaki_inicial.sql:431) guardam estados anteriores e posteriores dos registros. A exclusão/anonimização do perfil não remove automaticamente esses conteúdos históricos. | É necessário definir retenção, acesso e tratamento de dados pessoais nos logs, inclusive em pedidos e textos livres. Retenção justificada pode ser necessária; excluir indiscriminadamente também seria inadequado. |
| P1 | Não foram encontradas páginas públicas de termos e política nem fluxo que grave aceite, embora existam campos no banco. | Publicar documentos aplicáveis ao funcionamento real, tornar o suporte acessível e registrar os aceites pertinentes com versão. |
| P1 | A [rotina de expiração](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107000000_olaki_inicial.sql:645) pausa anúncios quando o limite fica em zero; não resolve genericamente redução para limite positivo. O agendamento aparece como instrução. | Validar redução de plano, vencimento de anúncio avulso, efeito de rotinas atrasadas e agendamento no ambiente. Definir quais anúncios permanecem ativos e avisar o vendedor. |
| P1 | Os [roteiros SQL](/home/raniel-linux/workspace/OLAQUI/supabase/testes/30_seguranca.sql:1) desativam interrupção por erro e apresentam resultados para inspeção. | O script terminar não prova que as regras passaram. Transformar casos críticos em verificações automáticas com resultado esperado e falha inequívoca. |
| P2 | Remoção de fotos e rascunhos tolera falhas de limpeza do Storage. Não foi encontrada rotina de reconciliação de arquivos órfãos. | Prever limpeza com novas tentativas, preservando arquivos ainda referenciados. Testar perda de conexão durante upload e gravação do rascunho. |

**O que pode prejudicar o negócio mesmo com o código funcionando**

| Risco | Efeito provável | Resposta recomendada |
|---|---|---|
| Abrir muitas cidades e categorias de uma vez | Oferta dispersa e buscas sem resposta. | Concentrar o piloto em uma área e poucos segmentos escolhidos pela capacidade real de atrair vendedores e atender pedidos. |
| Pedido sem resposta | Comprador perde a razão para voltar. | Acompanhar pedidos sem resposta, avisar vendedores relevantes e assumir atendimento manual no piloto quando necessário, com transparência. |
| Ofertas em excesso ou genéricas | Spam, comparação difícil e abandono. | Começar com limite pequeno de respostas úteis, ajustável conforme dados do piloto; solicitar consentimento antes de abrir contato. |
| Estoque e preço desatualizados | Usuário encontra algo que já não existe. | Exibir última confirmação, permitir pausa fácil e pedir reconfirmação periódica adequada à categoria. |
| Mensalidade antes de demonstrar resultado | Lojista paga pela expectativa e pode cancelar. | Começar com oferta comercial simples e mensurar contatos qualificados e negócios relatados antes de sofisticar planos. |
| Cobrar por contato ruim | Incentivo a disputar contatos, reclamações sobre créditos e pedidos fictícios. | Definir pedido válido, resposta útil e política para duplicidade, spam e pedidos já encerrados antes de cobrar por contato. |
| Destaques dominarem a busca | Menor relevância e perda de confiança do comprador. | Limitar espaço patrocinado, identificar publicidade e preservar ordenações compreensíveis, especialmente menor preço. |
| Denúncias coordenadas | Concorrentes podem tirar anúncios legítimos do ar. | Manter revisão, possibilidade de recurso, registro de motivos e controles contra múltiplas contas abusivas. |
| Selos amplos demais | Comprador interpreta verificação como garantia de segurança. | Exibir exatamente “telefone confirmado”, “dados da empresa conferidos” ou o procedimento realmente realizado. |
| Serviços tratados como objetos | Preço, prazo e área atendida ficam ambíguos. | Usar campos próprios para serviço, incluindo escopo e unidade de cobrança; permitir orçamento sujeito a visita quando necessário. |
| Dependência do WhatsApp | Conversa sai do site e resultado fica desconhecido. | Guardar proposta e escolha no produto, medir clique separadamente de venda e pedir confirmação opcional do resultado. |
| Expansão e franquia precoces | Crescem suporte, permissões, conflitos territoriais e exceções comerciais. | Validar operação e repetição de resultado na primeira área antes de replicar. |

A disputa por atenção já inclui produtos semelhantes. A página do [AcheiPerto](https://acheiperto.com.br/) apresenta classificados locais de produtos e serviços; a descrição do [Vurby na App Store](https://apps.apple.com/br/app/vurby/id6819752147) inclui publicar o que se procura. Essas páginas confirmam propostas anunciadas, não tração, receita ou qualidade. A hipótese de diferenciação deve ser qualidade da cobertura local e das respostas, sem depender de alegação de exclusividade do Radar.

**Privacidade e operação precisam de critérios próprios**

Telefone verificado comprova acesso ao número naquele momento; não comprova honestidade, disponibilidade de WhatsApp ou permanência da titularidade. Planejar recuperação de conta, troca de número, bloqueio e comunicação de incidentes.

Separar auditoria de alterações de registros de acesso. O [art. 15 do Marco Civil](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm) prevê guarda de registros de acesso para provedores enquadrados em suas condições. A existência de triggers de INSERT/UPDATE/DELETE não demonstra, por si só, atendimento a essa obrigação. A política concreta de retenção, exceções e atendimento a solicitações precisa de revisão jurídica e validação da infraestrutura real.

Também testar restauração de backup, indisponibilidade dos fornecedores, limite de gastos, abuso de SMS, armazenamento e fila de moderação. Modelos e custos de IA citados nos documentos permanecem estimativas não validadas nesta revisão. Medir custo por solicitação útil antes de transformar estimativas em orçamento.

**Sequência recomendada**

1. Corrigir isolamento regional, sincronização de telefone e tratamento de erros. Validar permissões e cotas com testes automatizados em ambiente descartável.
2. Fechar um percurso inteiro: escolher cidade, buscar, criar pedido, receber proposta, escolher vendedor, abrir contato e encerrar. Completar também anúncio, edição, pausa e marcação de vendido.
3. Operar piloto acompanhado, com vendedores reais e pedidos reais. Garantir revisão de denúncias, canal de ajuda e acompanhamento dos pedidos sem resposta.
4. Medir resposta útil, tempo de resposta, escolha de vendedor, retorno do comprador e interesse do lojista em renovar. Só então calibrar mensalidade, destaques e limites.
5. Acrescentar IA, alertas mais elaborados e novas regiões conforme um gargalo observado. Um assistente pode ajudar a preencher e buscar, mas depende de catálogo e fluxos confiáveis.

Como ponto de partida de experimento, usar uma cidade ou um pequeno conjunto contíguo, dois ou três segmentos e um grupo de lojistas que se comprometa a responder. Esses números delimitam o piloto; não são previsão de demanda nem garantia de resultado.

| Métrica | Definição útil |
|---|---|
| Atendimento da demanda | Pedidos válidos com pelo menos uma resposta útil dentro do prazo / pedidos válidos criados. |
| Velocidade | Mediana e percentil 90 do tempo até a primeira resposta útil, junto com a proporção ainda sem resposta. |
| Qualidade | Respostas compatíveis com localização, disponibilidade, orçamento e necessidade; registrar incompatibilidades. |
| Avanço da negociação | Escolhas de proposta e contatos iniciados, separados de vendas relatadas. |
| Retorno | Compradores que voltam a buscar ou pedir e vendedores que voltam a responder, por grupo de entrada. |
| Viabilidade | Receita por lojista menos custos variáveis de aquisição, suporte, mensagens, infraestrutura e IA atribuíveis ao atendimento. |

Evitar somar visualizações como se fossem compradores, tratar clique no WhatsApp como venda ou usar números de teste como prova comercial.

**Nomes alinhados às duas prioridades**

Avaliação editorial, ainda sem pesquisa com público nem liberação de marca/domínio.

| Nome | O que comunica | Limitação | Uso sugerido |
|---|---|---|---|
| **QueroDaqui** | Intenção de compra e ligação com a região. | Pode sugerir produtos fabricados localmente; o complemento deve explicar que inclui vendedores e serviços da região. | Primeiro candidato a testar para a combinação busca + pedidos. |
| **TemDaqui** | Descoberta da oferta local. | A possibilidade de pedir ofertas precisa aparecer na mensagem de apoio. | Alternativa se o catálogo for a principal porta de entrada. |
| **DaquiTem** | Variedade e proximidade em tom popular. | A construção é menos natural e exige teste de fala e lembrança. | Candidato secundário. |
| **PertoTem** | Proximidade explícita e oferta. | Sonoridade menos fluida; sem descrição, pode parecer guia de estabelecimentos. | Candidato secundário. |
| **OLAKI** | Nome curto associado à ideia de chamar atenção para algo. | Proximidade e pedidos dependem do complemento; a grafia com K merece teste de ditado. | Referência para verificar se a troca realmente melhora compreensão e lembrança. |

Minha primeira aposta é **QueroDaqui**, com a mensagem: “Encontre por perto ou peça ofertas à sua região.” Na home, desenvolver: “Procure produtos e serviços ou conte o que precisa para receber propostas de vendedores da região.” O slogan é proposta criativa, não alegação de disponibilidade atual do fluxo.

Descartaria “AcheiPerto” e “Negócio Daqui” desta seleção porque encontrei uso comercial nos sites [AcheiPerto](https://acheiperto.com.br/) e [Negócio Daqui](https://www.negociodaqui.com.br/). A pesquisa preliminar dos demais nomes não confirma exclusividade. Antes de investir, verificar grafias semelhantes, sonoridade, classes aplicáveis, domínio e perfis sociais; o [guia do INPI](https://www.gov.br/inpi/pt-br/assuntos/marcas) orienta a busca prévia.

Teste sugerido: apresentar OLAKI, QueroDaqui e TemDaqui separadamente e em ordem alternada a compradores e lojistas do piloto. Pedir que expliquem o serviço, escrevam o nome após ouvi-lo e tentem lembrá-lo mais tarde. Comparar resultados antes de mostrar logos. Se houver troca, preservar URLs e links compartilhados com redirecionamento, além de atualizar login, metadados e mensagens.

**Lista reutilizável antes de cada abertura ou ampliação**

- [ ] Comprador completa busca, pedido, comparação, contato e encerramento no celular sem orientação.
- [ ] Vendedor publica, responde, corrige preço, pausa e marca vendido sem perder dados.
- [ ] Contas de regiões e proprietários distintos não recebem dados indevidos por chamadas diretas.
- [ ] Requisições simultâneas respeitam cotas e não duplicam cobranças ou propostas.
- [ ] Troca/remoção de telefone com falha temporária de banco não deixa confirmação desatualizada sem nova tentativa.
- [ ] Upload interrompido, sessão vencida e conexão lenta têm recuperação compreensível.
- [ ] Falha de leitura aparece como indisponibilidade; busca vazia só aparece após consulta bem-sucedida.
- [ ] Cobrança repetida, atrasada, estornada e sem webhook tem comportamento definido e verificável.
- [ ] Dados exportados são completos ou o processo informa falha; exclusão considera arquivos e retenção justificada.
- [ ] Denúncias, suporte, termos, privacidade e explicação dos selos estão acessíveis.
- [ ] Rotinas agendadas e restauração de backup foram verificadas no ambiente correspondente.
- [ ] Métricas distinguem visita, contato, proposta e negócio relatado.

**Verificação realizada nesta revisão**

`npm run typecheck` passou. `npm run lint` terminou com código zero e avisos em componentes da demonstração, além de avisos sobre `next lint` e detecção da raiz do workspace. Não foi feito build nem teste de navegador.

Os testes SQL não foram executados: o inicializador atual contém `drop database if exists olaki`, e seria necessário isolá-lo antes de usar com segurança. Os riscos de concorrência e os cenários de integração foram identificados por inspeção, sem reprodução em ambiente publicado. Nenhum código de execução, configuração externa, marca ou domínio foi alterado por esta revisão.
