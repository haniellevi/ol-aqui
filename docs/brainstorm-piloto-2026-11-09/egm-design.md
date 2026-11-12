# Parecer egm-design: arquitetura e operação do piloto

Lente: **Crítico de arquitetura Brainstormer**. Modo: **BRAINSTORM**. Status: **revisão estática concluída no recorte; produção não verificada; sugestões ainda não aprovadas**.

Critério de sucesso da revisão: identificar dependências, limites e falhas capazes de interromper as negociações ou distorcer o aprendizado do piloto, com evidência atual e uma resposta proporcional ao grupo pequeno.

O princípio aplicável é reduzir a quantidade de serviços necessários para concluir a primeira negociação e tornar visíveis as falhas dos serviços indispensáveis. O volume proposto abaixo não justifica uma reescrita, uma fila geral ou troca de infraestrutura. A entrada dos participantes e a percepção dos avisos merecem atenção antes de qualquer investimento em escala.

Inspecionei o HEAD `2f00c55df54cad2a4a687e4641a821566c800630`, confirmado no início e no fim da leitura de código. A hipótese registra o HEAD inicial `af2d3bf62bed537b7481f3653d6cf9a292a50a65`; o parecer usa o conteúdo atual. Na leitura, o Git mostrava apenas `docs/brainstorm-piloto-2026-11-09/` e `supabase/.temp/` como não versionados. A migração de moderação de aluguel foi lida em seu conteúdo atual e estava sem alteração local indicada pelo Git.

Tenho alta confiança nas constatações delimitadas ao código abaixo. Os relatos de QA são históricos, inclusive o teste real de WhatsApp. Não fiz build, testes, consulta ao banco, acesso a produção, consulta de preços ou chamadas a serviços externos. Não li memória, conversas, `concepts_brief.md`, a revisão antiga de riscos ou pareceres de outras lentes. A única escrita desta revisão é este arquivo.

Não encontrei um **Blocker arquitetural comprovado que exija reconstruir o produto** para o piloto. Os itens D1 a D3 são condições operacionais a verificar antes de convidar o primeiro lote. D4 e D5 condicionam o uso do Aki; manter esse recurso desligado permite testar a negociação pelo fluxo convencional enquanto essas questões são resolvidas.

**D1. Major: a entrada depende de uma única sessão de WhatsApp, com cota compartilhada por todo o site.**

Dimensão: disponibilidade, cotas e custo operacional. A confirmação é exigida no banco para criar vitrine, pedido, proposta e publicar anúncio, conforme `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:3-30`. O envio exige autenticação, Turnstile, Supabase e Evolution, nessa sequência, em `src/app/confirmar-celular/actions.ts:12-27`. A configuração usa uma URL e uma instância, e o adaptador recusa envio quando a sessão não está `open`, em `src/lib/whatsapp/servico.ts:10-23,46-62`. O Compose descreve uma API, um Postgres e um Redis no mesmo serviço dedicado, em `infra/whatsapp/compose.yaml:1-13,46-71`.

A reserva atômica limita a cinco solicitações por pessoa ou número e cem no total em 24 horas, com intervalo de um minuto, em `supabase/migrations/20261110012622_confirmacao_whatsapp.sql:39-56`. Ela acontece antes do envio. Falhas do provedor também consomem as cotas. Uma sessão desconectada pode, portanto, impedir novas entradas e gastar tentativas enquanto participantes insistem. Vinte pessoas usando as cinco tentativas permitidas consumiriam as cem reservas globais, sem margem para suporte. Esse é um cenário aritmético de limite, não uma previsão de uso.

O efeito no piloto é confundir incapacidade de concluir o cadastro com desinteresse pela proposta. A prioridade é Major porque a dependência está no caminho obrigatório da primeira negociação. Não há evidência nesta revisão de que o serviço esteja indisponível agora.

A menor ação é usar o roteiro de recuperação já existente, nomear quem pode reparar a sessão e organizar lotes de entrada. Como parâmetro inicial de experimento, sugiro no máximo dez novos participantes por dia, reservando capacidade para erros e suporte. Antes de cada lote, conferir a capacidade restante das últimas 24 horas e testar entrega com conta autorizada. Interromper novos convites diante de falha repetida, preservando a exigência de código. Não é necessário contratar um segundo provedor para começar.

Aceite verificável: responsável e acesso de recuperação definidos; verificação de entrega e consumo único na versão destinada ao piloto; teste controlado de indisponibilidade com mensagem compreensível; recuperação seguida de nova confirmação; contagem das reservas das últimas 24 horas registrada sem guardar código ou telefone em relatório público. Esses testes são propostos, não executados nesta revisão.

Contra-argumento: `docs/QA-WHATSAPP-2026-11-09.md:23-29` relata entrega real e sessão preservada após reinício, e `infra/whatsapp/README.md:30-41` já ensina recuperação. Isso demonstra trabalho existente e reduz o risco, mas não define disponibilidade de um operador durante o lote nem comprova a condição atual. A recomendação deixa de exigir trabalho adicional quando essas condições estiverem demonstradas.

**D2. Major: a infraestrutura de confirmação não avisa lojas ou compradores fora do site.**

Dimensão: dependências e retorno dos participantes. O código mantém somente `notificacao` em `CANAIS_ATIVOS`, em `src/lib/tipos-relatorios.ts:40-41`. `mensagem_aviso` e `radar_aviso` selecionam esse canal, em `supabase/migrations/20261108060000_mensagens_relatorios.sql:283-339`. O formulário administrativo informa que nada é enviado pelos demais canais, em `src/app/admin/mensagens/form-modelo.tsx:138-144`. A Evolution envia texto de código de confirmação em `src/lib/whatsapp/servico.ts:54-61`; não constitui um despachante de avisos comerciais.

O sino consulta o resumo a cada 60 segundos somente enquanto a página está visível, com atualizações adicionais ao focar a janela, em `src/components/conta/sino-avisos.tsx:19-43`. Assim, pedido criado e proposta recebida não garantem que a outra parte perceba a oportunidade fora de sua visita ao site. Um lojista sem resposta pode nunca ter visto o pedido. A prioridade é Major porque isso afeta diretamente a medida de respostas úteis e retorno espontâneo.

A menor ação é combinar previamente horários de consulta com as lojas e definir uma janela de observação antes de ajuda manual. No registro do piloto, separar aviso disponível no site, participante que acessou, resposta recebida e intervenção da equipe. Caso se proponha contato manual fora do site, obter a autorização apropriada para esse contato; este parecer não autoriza nem executa mensagens. Não há necessidade demonstrada de implementar push, WhatsApp comercial ou e-mail automático nesta rodada.

Aceite verificável: loja e comprador convidados reconhecem onde consultar os avisos; um pedido e uma proposta de ensaio aparecem para os destinatários corretos; atualização do sino é observada com a página visível; o registro do experimento distingue retorno espontâneo de retorno após ajuda e nunca considera o código de confirmação como aviso de pedido.

Contra-argumento: o piloto será acompanhado, então o operador pode destravar cada caso. Isso permite aprender sobre a negociação, desde que a ajuda seja registrada. Se toda volta ao produto depender da equipe, a rodada não demonstra retorno espontâneo. O acompanhamento reduz a necessidade de novos canais, mas preserva a necessidade dessa distinção.

**D3. Major: as rotinas de prazo existem, mas aplicar as migrações não comprova que estão agendadas.**

Dimensão: dependências operacionais e estado do banco. `radar_avisar_prazos()` gera os resumos e encerra pedidos em `supabase/migrations/20261108020000_radar_completo.sql:984-1014`. A criação de seu job de dez minutos só ocorre se `pg_cron` já existir no momento da migração, em `:1016-1024`. O job de avisos de planos tem a mesma condição em `supabase/migrations/20261108060000_mensagens_relatorios.sql:466-472`. O agendamento diário de `expirar_rotina()` aparece como instrução em comentário em `supabase/migrations/20261107000000_olaki_inicial.sql:644`; não encontrei criação executável desse job nas migrações pesquisadas.

A rotina diária materializa trocas de plano, trata anúncios excedentes, expira destaques e cancela cobranças antigas, em `supabase/migrations/20261108010000_cobranca_planos.sql:899-947`. A versão posterior chama essa base e os prazos do Radar, em `supabase/migrations/20261108020000_radar_completo.sql:1026-1036`. Portanto, conferir apenas que a função existe deixa uma dependência relevante sem prova.

O efeito possível é faltar o resumo esperado ou permanecer estado materializado antigo. Não afirmo que pedidos vencidos continuem aceitando propostas: o feed atual verifica os horários, em `supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:30-34`, e a proposta verifica expiração e prazo em `supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:64-68`. Essas proteções reduzem o impacto, mas não entregam o aviso pendente. Major é a prioridade para verificar a operação antes de avaliar a experiência com prazo.

A menor ação é conferir no ambiente do piloto os jobs, sua cadência e as últimas execuções. Se um agendamento faltar, propor apenas o agendamento ausente após confirmar o estado atual. Não criar um segundo agendador redundante sem necessidade.

Aceite verificável: evidência dos jobs previstos e de suas últimas execuções bem-sucedidas; um pedido de ensaio que atravessa o prazo recebe um único resumo na janela de dez minutos mais tolerância operacional acordada; repetição da rotina não duplica o aviso; um caso de expiração de plano ou destaque atinge o estado previsto em ambiente autorizado. A existência de job em produção permanece não verificada neste parecer.

Contra-argumento: o banco pode já ter sido configurado manualmente e a tela calcula parte dos estados pelo relógio. Nesse caso basta evidenciar a configuração e o comportamento, sem mudar código. A recomendação é uma verificação específica de dependências, não uma alegação de falha atual do Supabase.

**D4. Major se o Aki for ligado: o orçamento é uma reserva estimada, sem teto de entrada correspondente.**

Dimensão: custo, cotas e economia de tokens. A proteção existente é relevante: `robo_reservar` usa trava por pessoa e trava global e grava o custo estimado antes da chamada, em `supabase/migrations/20261107031000_robo_aki.sql:306-337`. Isso evita tratar o orçamento como uma leitura isolada sujeita a corrida. Contudo, a estimativa usa `robo.reserva_tokens_entrada` como quantidade fixa por volta, em `:266-286`; o painel permite inclusive zero, em `src/app/admin/robo/actions.ts:308-319`.

O motor limita quantidade de mensagens e caracteres, mas não demonstra que o contexto final cabe na quantidade de tokens reservada: monta histórico, ferramentas e seus resultados em `src/lib/aki/motor.ts:157-175,225-251,307-345`. O custo final substitui a reserva, em `supabase/migrations/20261107031000_robo_aki.sql:432-443,487-497`, sem uma nova autorização financeira antes do excesso. Além disso, a reserva utiliza preço de entrada comum, enquanto o cálculo final admite preço distinto de escrita de cache. O adaptador pede cache em `src/lib/aki/provedores/anthropic.ts:57-66`. Não foi demonstrado um estouro em execução; está comprovada a diferença entre estimativa configurável e teto garantido.

O efeito no piloto é interpretar o orçamento do painel como garantia de fatura máxima e descobrir depois que a estimativa era insuficiente ou que o catálogo de preços divergia do provedor. Os valores e nomes da semente são dados do repositório, sem validação de existência, disponibilidade ou tarifa atual nesta revisão. A prioridade é Major apenas para ativar IA com promessa de custo limitado; o fluxo principal pode ser validado sem esse recurso.

A menor ação é manter o Aki fora da primeira rodada ou ativá-lo em uma subamostra com orçamento explícito, preços conferidos no provedor e limite externo de gasto quando disponível. Se o teto do painel precisar ser uma garantia técnica, vincular a admissão ao contexto efetivo e à tarifa conservadora, incluindo cache e imagens, reservando antes de cada rodada adicional. Isso pode ser adiado enquanto o Aki permanecer desligado.

Aceite verificável: estado real ligado/desligado documentado; se ligado, tabela de modelo e preço reconciliada com o serviço; casos de histórico longo, foto e ferramentas respeitam uma relação demonstrável entre reserva e custo; a tentativa que ultrapassa o saldo é recusada antes de chamar o provedor. Não basta um teste com pergunta curta.

Contra-argumento: os limites de saída, número de voltas e tempo já restringem o consumo, e uma reserva generosa pode ser suficiente para a carga normal. Concordo que isso evita exigir um sistema complexo para vinte pessoas. Não sustenta, porém, a afirmação de teto financeiro rígido. Caso o usuário aceite um orçamento estimado com margem e Aki opcional, a implementação adicional deixa de ser pré-requisito do piloto.

**D5. Major se o Aki for parte do teste: uma interrupção pode prender saldo e perder o vínculo da resposta.**

Dimensão: disponibilidade, custo e recuperação de falhas. A API declara `maxDuration = 60`, em `src/app/api/aki/route.ts:14-16`. A reserva ocorre em `src/lib/aki/motor.ts:193-207`; várias leituras de contexto vêm depois, em `:210-242`, e só então começa o temporizador de 55 segundos, em `:271-274`. A gravação final está depois do ciclo de IA, em `:379-413`. Portanto, a duração do contexto e da gravação não está coberta por esse temporizador interno. O comportamento real do ambiente de execução não foi medido.

Se houver exceção antes do bloco da conversa ou encerramento da execução antes de gravar, a reserva permanece `em andamento`. O próprio tratamento de falha na gravação preserva a reserva e emite `fim` com `mensagemId` potencialmente nulo, em `:387-413`. `robo_checar` soma todas as reservas do mês, e `robo_painel` também as soma como custo, em `supabase/migrations/20261107031000_robo_aki.sql:283-285,612-623`. Não encontrei reconciliação de reservas antigas nos pontos de chamada e migrações pesquisados.

Com os valores da semente, uma reserva seria R$ 3,63: seis voltas, 20 mil tokens de entrada e 1.500 de saída por volta, preços e câmbio da semente. Vinte e sete reservas interrompidas somariam R$ 98,01 e impediriam outra reserva de R$ 3,63 dentro do orçamento semeado de R$ 100. É um exemplo de aritmética do código, não custo medido ou preço atual. O sistema pode parar de responder mesmo que o provedor tenha gasto muito menos, e uma resposta já exibida pode ficar sem registro para retomar ou avaliar.

A menor ação para o piloto é não depender do Aki para concluir a negociação, observar reservas antigas separadamente do custo confirmado e definir conciliação manual responsável, preservando o limite quando o consumo real for incerto. Se houver uso relevante, iniciar o prazo total antes das leituras e reservar margem para persistência; envolver o percurso posterior à reserva em encerramento consistente. Não liberar automaticamente toda reserva antiga como se nada tivesse sido gasto.

Aceite verificável: atraso de contexto, desconexão do cliente, falha do provedor e falha de gravação deixam estado identificável; a interface não promete histórico salvo quando não existe; reservas sem fechamento são distinguíveis de custo confirmado e reconciliáveis; consultas lentas não eliminam a margem de persistência da execução. Esses cenários devem ser exercitados com serviços simulados antes de eventual ativação ampliada.

Contra-argumento: preservar a reserva é a escolha conservadora para não permitir gasto sem registro, e há captura de uso parcial no adaptador. Essa proteção deve permanecer. O risco está na disponibilidade e na leitura do custo como final, especialmente após falhas repetidas. Com o Aki desligado, o achado é adiável.

**D6. Nit no piloto pequeno: limites de foto não equivalem a um orçamento total de armazenamento.**

Dimensão: armazenamento, transferência e manutenção. Há redução no navegador em `src/lib/fotos.ts:15-39`, máximo de fotos anexadas em `src/lib/dados/fotos.ts:26-49` e cota por pasta na versão atual de `pode_enviar_foto`, em `supabase/migrations/20261108020000_radar_completo.sql:1106-1157`. Não procede dizer que o Storage está sem limites.

Entretanto, o limite de bytes do bucket é copiado de `fotos.tamanho_max_bytes` durante a migração, em `supabase/migrations/20261107020000_categorias_e_anuncios.sql:1379-1393`. Salvar essa configuração depois altera a tabela e revalida páginas, sem sincronizar o bucket, em `src/app/admin/configuracoes/actions.ts:9-23`. A lixeira conserva fotos e libera espaço na contagem de rascunhos, em `supabase/migrations/20261109190459_lixeira_anuncios.sql:1-11,100-122`. Repetir criação e descarte pode aumentar o total guardado mesmo que cada pasta respeite sua cota. Não medi volume ou desperdício real.

A consequência é estimar capacidade pelo número de anúncios ativos ou acreditar que diminuir um campo no painel já reduziu o limite efetivo de arquivo. Nit é adequado para grupo convidado e catálogo pequeno; a prioridade aumenta se o uso de mídia crescer ou houver abertura pública ampla.

A menor ação é conferir o limite real do bucket e seu uso antes da rodada, registrar volume ao encerrá-la e informar que o ajuste de bytes exige operação no bucket. Estimar também imagens de lixeira e versões trocadas. Não apagar a lixeira automaticamente nem construir coleta de lixo sem decisão de retenção.

Aceite verificável: limite do bucket corresponde ao valor divulgado; uma tentativa acima dele falha em teste autorizado; tamanho e quantidade total de objetos, incluindo descartados, ficam conhecidos; troca ou remoção mantém fotos ainda referenciadas. A proteção de referências já está em `src/lib/dados/fotos.ts:62-72` e deve ser preservada.

Contra-argumento: fotos comprimidas e poucos participantes podem consumir pouco espaço, e conservar a lixeira protege recuperação. Isso justifica monitoramento simples em vez de nova infraestrutura. A recomendação mantém a recuperação e evita confundir limite por arquivo com limite acumulado.

**Envelope sugerido para discutir o experimento, sem aprovação implícita**

Sugiro uma rodada de 14 dias, com cinco lojas e quinze compradores, em lotes de até dez novas confirmações por dia, depois de verificar o D1. Esses números são parâmetros de teste. Segmentos, pessoas, responsáveis e orçamento continuam indefinidos. Se a equipe não conseguir acompanhar esse volume, deve reduzi-lo.

| Recurso | Estimativa derivada ou parâmetro proposto | Limite da conclusão |
|---|---|---|
| Consulta do sino | Vinte páginas visíveis geram cerca de `20 / 60 = 0,33` consulta por segundo em média, mais montagem, foco e eventos. | Pode haver rajada de vinte consultas sincronizadas. Isso não mede consultas internas, navegação nem capacidade do banco. Não há evidência que justifique substituir o polling para esse grupo. |
| Confirmar telefone | Até cem reservas globais por janela móvel de 24 horas; cinco por conta ou destinatário. | São limites do código, sem inspeção do contador atual. O lote proposto exige considerar capacidade já consumida. |
| Catálogo inicial | Cinco lojas com cinco anúncios e quatro fotos por anúncio representam cem fotos. A 300 KiB por foto, hipótese de planejamento, são cerca de 29,3 MiB; no limite semeado de 5 MiB, seriam 500 MiB. | Não inclui logos, banners, Radar, lixeira, versões trocadas ou tráfego de leitura. O tamanho médio real deve ser medido. |
| Serviço de confirmação | O Compose limita API, Postgres e Redis a 768, 256 e 96 MiB, respectivamente, e 0,50, 0,25 e 0,10 CPU. | Esses são tetos declarados, sem medição atual da VPS. O consumo histórico de aproximadamente 250 MiB vem do QA e não é garantia de capacidade. |
| Aki | Desligado na primeira rodada é a alternativa de menor dependência. A semente prevê orçamento e limites por pessoa; sua ativação real é desconhecida. | Negociação, busca e formulário do Radar devem continuar úteis sem IA. Não assumir economia comprovada ou preços atuais a partir da semente. |
| Cobrança | A integração existe; o QA selecionado registra sandbox e ausência de cobrança real. | Ver `docs/QA-MEU-PLANO-2026-11-09.md:3,24`. Este parecer não aprova cobrança, não atesta configuração atual e não transforma o piloto de negociação em teste financeiro. |

O custo da rodada deve ser registrado como soma de hospedagem e funções, banco, Storage e transferência, autenticação, parcela de VPS, IA e horas de operação. Não há informação suficiente para preencher valores monetários dos contratos. A menor planilha de controle precisa apenas de plano vigente, consumo inicial, limite ou orçamento aceito, responsável e consumo final de cada serviço usado. Essa apuração não exige migrar de fornecedor.

**Fontes efetivamente lidas e limites de cobertura**

O padrão desta lente foi somente a persona real `/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/design_critic.md`, lida integralmente antes da hipótese. Trechos identificadores: `Cost & Quota Economics`, `Architectural Bottlenecks`, `Mitigation Requirement`. SHA-256: `cee6294735ce2bd4fea19245852b6eb07cbe8ede7e72a4bfc829f586e4a39d0f`. A proibição de alterar produto foi mantida; a autorização específica do parecer permitiu somente este arquivo. Nenhum padrão externo foi fornecido ou consultado.

Hipótese lida integralmente: `docs/brainstorm-piloto-2026-11-09/hipotese.md`, identificada por `piloto pequeno, com compradores e lojistas convidados`. SHA-256: `300e8605e1052ff279df5340c464d15ee868c781a111b0782e6d28c5cccaea48`.

Todos os oito arquivos de orientação selecionados foram lidos integralmente:

| Arquivo | Identificador observado |
|---|---|
| `README.md` | `Nenhum preço, limite ou regra fica no código` |
| `package.json` | `next: 15.5.29`, `test:db: python3 supabase/testes/automatizados.py` |
| `docs/CORRECOES-FLUXO-2026-11-09.md` | `Base reconciliada com origin/main em 6052f1d` |
| `docs/QA-RADAR-2026-11-09.md` | `substituindo temporariamente apenas as fronteiras` |
| `docs/QA-WHATSAPP-2026-11-09.md` | `uma solicitação, um consumo e uma confirmação persistida` |
| `docs/QA-MEU-PLANO-2026-11-09.md` | `O ambiente financeiro configurado permanece sandbox` |
| `docs/etapa5/relatorios.md` | `Buscas não são medidas` |
| `docs/etapa4/paginas.md` | `Sem service worker` |

Leituras adicionais de implementação, com cobertura explícita. Faixas indicam leitura do corpo, e não validação por execução:

| Arquivo | Cobertura e identificador |
|---|---|
| `src/lib/whatsapp/servico.ts` | Integral, `configuracaoWhatsapp`, `validarTurnstile`, `enviarCodigo`. |
| `src/app/confirmar-celular/actions.ts` | Integral, reserva antes de `enviarCodigo`. |
| `infra/whatsapp/README.md` | Integral, `Uma sessão pode desconectar`. |
| `infra/whatsapp/compose.yaml` | Integral, `mem_limit`, `connection_limit=5`, imagens fixadas por digest. |
| `src/app/api/aki/route.ts` | Integral, `maxDuration = 60`. |
| `src/lib/aki/motor.ts` | Integral, reserva, contexto, tempo de 55 segundos e gravação final. SHA-256 `37e132c2a45f86ae0c6a55ea8c0b82daf8a22773552c05e4452da29086c66d55`. |
| `src/lib/aki/provedores/anthropic.ts` | 48-100, `cache_control` e chamada ao provedor. |
| `src/lib/aki/provedores/base.ts` | 84-143, `estimarEntrada`, `usoAposFalha`. |
| `src/lib/supabase/server.ts` | Integral, token Clerk no cliente Supabase. |
| `src/middleware.ts` | Integral, rotas protegidas e middleware Clerk. |
| `src/components/conta/sino-avisos.tsx` | Integral, visibilidade e intervalo. |
| `src/app/api/notificacoes/resumo/route.ts` | Integral, contagem autenticada e erro 503. |
| `src/lib/dados/radar.ts` | 1-90 e 150-185, acesso, regras e contagem. |
| `src/lib/dados/fotos.ts` | Integral, envio assinado e referências antes de apagar. |
| `src/lib/fotos.ts` | Integral, redução e timeout de envio. |
| `src/app/api/webhooks/clerk/route.ts` | Integral, estado atual do usuário e exclusão de arquivos. |
| `src/lib/perfil.ts` | Integral, preservação da confirmação externa. |
| `src/app/admin/robo/actions.ts` | 285-324, limites e reserva configurável. |
| `src/app/admin/mensagens/form-modelo.tsx` | 1-75 e 138-163, canal ativo e aviso de não envio. |
| `src/lib/tipos-relatorios.ts` | 35-45, `CANAIS_ATIVOS`. |
| `src/app/admin/configuracoes/actions.ts` | Integral, atualização de tabela sem chamada ao Storage. |
| `src/app/(publico)/page.tsx` | 35-75, carregamento inicial em paralelo e destaques. |
| `src/lib/dados/anuncios.ts` | 100-122, consulta de vitrine limitada. |
| `src/lib/asaas.ts` | 1-83, ambientes e timeout. |
| `src/lib/cobranca-pagamento.ts` | 100-169, reserva e reconciliação antes de repetir criação. |

Migrações examinadas cumulativamente nos símbolos relevantes:

| Arquivo | Cobertura e identificador |
|---|---|
| `20261107000000_olaki_inicial.sql` | 636-655, agendamento de expiração aparece no comentário. |
| `20261107020000_categorias_e_anuncios.sql` | 44-59 e 1330-1415, configuração e bucket. |
| `20261107031000_robo_aki.sql` | 20-84, 153-159, 221-337, 374-530 e 586-676, orçamento, reserva, fechamento e painel. SHA-256 `d0c747de5d6bf9d81968116e956ebcc54723ed7c595cc69dd6cd82a699b396fe`. |
| `20261108010000_cobranca_planos.sql` | 890-950, `expirar_rotina`. |
| `20261108020000_radar_completo.sql` | 135-215, 798-869, 920-1045 e 1103-1162, notificações, estado por prazo, jobs e Storage. Índices em 131-134 também conferidos por busca. SHA-256 `568b33b506a890b51dae300241ef815c995a257933471e5f8ceee1d80c04fdd1`. |
| `20261108060000_mensagens_relatorios.sql` | 255-348 e 416-478, canal usado e rotina de planos. |
| `20261109032907_seguranca_fluxo_radar.sql` | 1-155, feed regional, escolha e limite concorrente de anúncios. A escolha posterior foi conferida na migração de WhatsApp obrigatório. |
| `20261109190459_lixeira_anuncios.sql` | 1-122, lixeira e limite de rascunhos. |
| `20261110012622_confirmacao_whatsapp.sql` | Integral, cotas e consumo transacional. SHA-256 `b1a96362202fe9d20a2e8d49f08d54b5a4c9a528baed2aa8aae8e26b64b142e0`. |
| `20261110014434_whatsapp_obrigatorio.sql` | Integral, quatro gatilhos, proposta e escolha. SHA-256 `d526e6624a79e9dfb04311a8c5eb71ca7470b12b229e3180e95ba254781b384c`. |
| `20261110020853_moderacao_aluguel.sql` | Integral, `Evita retenção de aluguel pelo piso de venda`. SHA-256 `93b24e49bd8f20871365433fe430157cbf38f1346e5a35da2aa3090c2d077c6a`. |

Os nomes da última tabela são relativos a `supabase/migrations/`. Buscas de símbolos abrangeram todas as migrações e os diretórios de implementação pertinentes para identificar substituições posteriores; isso não equivale a auditoria integral de todos os arquivos. Houve buscas adicionais, sem leitura integral, em arquivos de cobrança, ferramentas do Aki, dados de vitrines e formulários. `scripts/` e `.github/` não existiam no repositório consultado; nenhum arquivo obrigatório de leitura ficou inacessível. Não foram lidos valores de segredos.

A revisão fica limitada ao desenho e à implementação estática. Quotas contratadas, estado de Clerk, saldo das cotas OTP, agendamento efetivo, recursos livres da VPS, limites reais do bucket, configuração de IA, entrega atual e restauração de dados permanecem não verificados. Recomendo o piloto acompanhado com lotes pequenos, verificando D1 a D3 e mantendo o Aki opcional, para que a rodada avalie negociação e resposta das lojas com o menor número de dependências adicionais.
