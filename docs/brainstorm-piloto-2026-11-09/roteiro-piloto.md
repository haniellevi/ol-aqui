# Roteiro reutilizável do piloto acompanhado

Status: proposta para revisão. Nenhum convite, envio de mensagem, alteração de plano ou publicação foi executado por esta análise.

## Recorte a preencher antes de convidar

| Decisão | Registro |
| --- | --- |
| Responsável pela operação e substituto | A definir |
| Cidade/área atendida | A definir pela oferta e pela capacidade de acompanhar; a documentação histórica sugere Corrente e região |
| Segmentos iniciais | Escolher onde já existem lojas com itens/serviços disponíveis e compradores com necessidade atual |
| Lojas e horário de resposta combinado | A definir; cada loja deve indicar uma pessoa responsável |
| Compradores convidados | Necessidades reais e participação voluntária, sem criar pedidos fictícios para aumentar movimento |
| Endereço e versão do piloto | Registrar URL, commit, migrações aplicadas e data da validação |
| Canal humano de ajuda | Preencher as configurações existentes e testar o acesso pelo celular |
| Regra comercial | Explicar gratuidade/cortesia, duração e o que acontece depois; não prometer cobranças que não foram validadas |
| Cotas para testar repetição | Conferir anúncios e propostas disponíveis para cada loja durante toda a janela; extensão do teste não deve ser presumida como reposição de propostas |
| Horário de acompanhamento | A definir conforme disponibilidade real da equipe |
| Prazo de resposta útil combinado | Registrar antes de contar resultados e medir também o tempo corrido |
| Limite de gasto e de tempo da equipe | A definir, incluindo suporte, verificação de telefone, armazenamento e serviços ativos |

Como ponto de partida para discussão, um grupo de cinco lojas e quinze compradores, em uma área e até dois segmentos, por duas a três semanas. Esses números são parâmetros propostos de um experimento acompanhado, não previsão de demanda nem amostra suficiente para provar viabilidade econômica. Reduzir o grupo se a equipe não conseguir acompanhar todos os casos.

## Liberação dos convites

Cada item deve ter responsável, evidência e situação. Marcar como concluído somente depois da execução.

| Condição | Evidência exigida | Situação inicial |
| --- | --- | --- |
| Autenticação de produção e vínculos | Domínio controlado, Clerk de produção, integrações e tratamento das contas/dados existentes validados; nenhum vínculo presumido apenas por e-mail/telefone | Pendente; navegador publicado advertiu uso de chaves de desenvolvimento |
| Ajuda humana acessível | Contato abre pelo site e uma solicitação de teste autorizada recebe atendimento | Pendente; ajuda publicada sem contato na inspeção |
| Identificação e textos públicos | Termos e privacidade identificam o responsável real e canais aplicáveis, sem campos por preencher; versão e aceite coerentes | Pendente; placeholders confirmados nas páginas publicadas |
| Oferta inicial real | Cada loja confirma itens/serviços disponíveis, preços/condições e área de atendimento | Pendente; a home consultada exibiu estado vazio |
| Acesso e cotas do lote | Lojas conseguem responder às demandas e repetir o uso dentro das cotas definidas; concessões têm prazo e motivo registrado | Configuração de produção ainda não conferida |
| Cadastro e recuperação | Conta de comprador e conta de loja conseguem entrar, verificar telefone e recuperar acesso pelo procedimento previsto | Há QA histórico parcial; ensaio conjunto pendente |
| Negociação completa | Buscar, pedir, receber resposta, comparar, escolher contato, encerrar; testar modo privado e direto, sem enviar mensagens comerciais não autorizadas | Testes locais passaram; ensaio comprador-loja no ambiente alvo pendente |
| Aparelhos e acessibilidade | Repetir a jornada nos aparelhos usados pelos convidados, conferir teclado/foco, mensagens de erro e ida/volta do WhatsApp | Pendente; larguras simuladas e leitura de código não substituem esse ensaio |
| Exportação e exclusão de dados | Download distingue erro de ausência de dados; procedimento de exclusão é verificável com e sem registros financeiros, com conteúdo e retenção definidos | Falhas estáticas identificadas; correção e ensaio específicos pendentes |
| Anunciar e corrigir | Criar, retomar rascunho, publicar, editar, pausar, marcar vendido e tratar retenção por moderação | Há QA histórico real e testes locais; conferir na versão escolhida |
| Dependências de imagens | Alertas de segurança triados e corrigidos ou mitigados com evidência, com regressão de fotos | Pendente |
| Operação de verificação | Entrega do código, cota, falha, reconexão e responsável pelo serviço definidos | Há QA histórico de envio real; prontidão operacional a confirmar |
| Banco e rotinas | Migrações conferidas, expiração/agendamentos observados, backup e recuperação verificáveis | Não verificados no banco publicado nesta análise |
| Coleta de resultados | Uma linha de caso acompanhada do início ao encerramento, com intervenção manual identificada | Modelo abaixo pronto; uso pendente |

Uma falha no fluxo de pagamento pode ser adiada se a experiência oferecida aos convidados não depender de cobrança. Uma falha de contato, autorização, integridade de dados, confirmação de telefone ou processamento de uploads expostos precisa ser resolvida ou efetivamente contida antes de abrir o fluxo afetado.

## Registro mínimo por necessidade real

Usar identificadores internos em um arquivo privado ou ferramenta já disponível. Não colocar telefone, documentos, códigos de acesso ou conteúdo integral de conversa neste repositório.

| Campo | O que registrar |
| --- | --- |
| ID do caso, ID do participante e grupo de entrada | Permitir acompanhar o mesmo caso e reconhecer retorno sem depender de nome/telefone |
| Cidade, segmento e data/hora de início | Contextualizar a disponibilidade de oferta |
| Origem | Busca, anúncio ou pedido no Radar |
| Necessidade e prazo | Resumo curto; não copiar conversas particulares |
| Oferta disponível no início | Sim, não ou desconhecida; loja que confirmou disponibilidade |
| Primeira resposta recebida | Data/hora e loja; diferenciar automática, genérica e útil |
| Resposta útil | Atende à necessidade, localização e disponibilidade, com preço/condições suficientemente claros para continuar |
| Intervenção da equipe | Nenhuma, lembrete, ajuda para preencher, recrutamento de oferta ou resolução técnica; registrar momento e minutos gastos |
| Contato iniciado | Relato/ação de contato; clique isolado permanece registrado como clique |
| Resultado | Negociação em andamento, concluída, desistência, resolvida fora, sem resposta ou desconhecido |
| Confirmação | Relato de uma parte, confirmação de ambas ou sem confirmação; nunca tratar silêncio como venda |
| Retorno | Data e ação significativa posterior; distinguir consulta a resposta existente de uma nova necessidade |
| Como voltou | Espontaneamente, após aviso automático ou após contato humano; não presumir origem se não houver informação |
| Fricção | Etapa, erro observado, impacto e responsável pelo próximo passo |

## Rotina da operação

No início de cada período de acompanhamento, verificar pedidos abertos sem resposta, disponibilidade das lojas, casos de cadastro travados e denúncias. Usar a fila e os painéis existentes, complementados pelo registro do piloto.

Se for necessário avisar alguém fora do site, a equipe deve combinar previamente o canal e registrar a intervenção. O consentimento para receber um código de acesso não deve ser interpretado como autorização automática para alertas comerciais. Este roteiro não autoriza o agente a enviar mensagens.

Ao encerrar um caso, pedir uma confirmação breve do resultado quando apropriado, sem exigir conteúdo privado da conversa. Registrar incerteza quando só uma parte responder. Confirmar que a loja pausou ou atualizou itens que deixaram de estar disponíveis.

Em cada revisão, resolver primeiro os bloqueios repetidos e pedidos abandonados. Evitar redesenhar telas inteiras sem observar qual etapa falhou. Manter uma fila curta com problema, evidência, responsável, ação e critério de aceite.

## Métricas e leitura dos resultados

| Pergunta | Medida | Cuidado |
| --- | --- | --- |
| As pessoas conseguem completar o percurso? | Casos concluídos na etapa esperada / casos que a iniciaram; apresentar também numerador e denominador | Separar teste fictício, caso real e caso assistido |
| As lojas respondem? | Pedidos válidos com resposta útil dentro do prazo combinado / pedidos válidos que já completaram essa janela | Pedido ainda dentro do prazo não deve ser contado como falha; incluir os que ficaram sem resposta |
| Quanto demora? | Tempo até a primeira resposta útil, junto com quantidade ainda sem resposta | Não calcular rapidez apenas sobre os casos que deram certo |
| A negociação avança? | Respostas úteis, contatos relatados e negócios confirmados, em etapas separadas | Não inferir venda a partir de clique ou escolha de proposta |
| As pessoas voltam? | Participantes com uma nova ação significativa em outro dia / participantes com tempo de observação suficiente | Separar retorno espontâneo, aviso e ajuda; ciclo de compra de imóvel difere do de itens recorrentes |
| O produto reduz trabalho manual? | Minutos de atendimento por caso e proporção de casos que precisaram de intervenção | Acompanhamento intenso valida operação assistida; autonomia exige observação separada |
| O custo cabe? | Despesas reais e tempo da equipe / casos atendidos, com custos fixos e variáveis separados | Cortesia não valida disposição para pagar |

## Decisão ao fim de cada janela

**Abrir um grupo seguinte:** o percurso funciona na versão publicada, há resposta útil repetida por diferentes lojas, existem negócios confirmados e a equipe consegue acompanhar sem acumular casos. Registrar quais pessoas voltaram e em qual contexto. Um caso isolado é um sinal inicial, insuficiente para justificar expansão regional.

**Continuar com o mesmo grupo:** há demanda, mas ainda não houve tempo ou quantidade suficiente de necessidades para avaliar retorno; ou os resultados dependem de lembretes constantes. Ajustar uma hipótese por vez e preservar a comparação entre períodos.

**Interromper novos convites e corrigir:** falha de acesso/segurança, dados incorretos, contato exposto fora da escolha do comprador, ausência persistente de oferta/resposta ou atendimento acima da capacidade disponível. Quem já participa precisa continuar tendo suporte.

Recomendação inicial: validar a operação e a utilidade com esse grupo acompanhado. Testar preço e disposição para pagar em uma etapa explícita posterior, sem interpretar uso gratuito como validação comercial completa.
