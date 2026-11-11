# Auditor operacional Brainstormer

Lente: `egm-codebase-details`. Modo: `BRAINSTORM`. Data de referência: 2026-11-09, America/Sao_Paulo. Status: parecer local concluído, com validação operacional de produção pendente. Recomendações propostas, ainda não aprovadas.

Critério de sucesso desta revisão: apontar lacunas que dificultem medir ou acompanhar o piloto, demonstrar cada uma no código atual e propor a menor ação com aceite verificável.

O princípio aplicado é separar o que o sistema registrou, o que o participante relatou e o que o operador confirmou. Uma oferta persistida, um link aberto e uma venda confirmada exigem evidências diferentes.

## Base e limites

Inspecionei o conteúdo local no HEAD `2f00c55df54cad2a4a687e4641a821566c800630`. A hipótese informa o HEAD inicial `af2d3bf62bed537b7481f3653d6cf9a292a50a65`; por isso as conclusões abaixo usam as definições atuais e a sequência cumulativa de migrações. A migração de moderação de aluguel foi lida no estado atual. O status observado mostrava `docs/brainstorm-piloto-2026-11-09/` e `supabase/.temp/` não versionados, sem a modificação anterior de SQL indicada na hipótese. Não alterei código nem esses arquivos preexistentes.

A persona real foi lida integralmente antes da hipótese. Seu recorte de BRAINSTORM determina avaliar telemetria, rastreabilidade e diagnóstico operacional. Nenhum padrão externo foi fornecido. Não consultei memória, conversas, `concepts_brief.md`, o relatório antigo de riscos nem pareceres das outras lentes. Não executei testes, build, banco, navegador ou serviços externos. A única escrita desta revisão é este parecer.

Todas as fontes obrigatórias selecionadas na hipótese foram acessadas. A consulta extra a `AGENTS.md` na raiz retornou arquivo inexistente; as instruções recebidas no contexto permanecem aplicáveis. Isso não impede a leitura das fontes obrigatórias. As pesquisas de símbolos em todo o conjunto de migrações serviram para localizar redefinições posteriores; não equivalem a uma auditoria integral de todas as migrações.

## Resultado

Não encontrei, nesta lente e por leitura estática, um Blocker de código comprovado que impeça todo piloto acompanhado. Há lacunas Major que precisam de um controle proporcional antes de confiar nos resultados. A principal é que o relatório chamado Funil não mede o fluxo do Radar, e os registros existentes não distinguem negócio relatado, confirmação pelas duas partes e ajuda manual.

É possível começar com acompanhamento manual identificado por pedido e proposta. Não há necessidade demonstrada de instalar uma plataforma de analytics ou tracing distribuído para esse recorte.

### OD-01. Major: o Radar não tem um relatório que responda à hipótese do piloto

**Dimensão:** observabilidade do produto e confiabilidade da medição.

**Código comprovado.** O catálogo de relatórios contém `funil`, `anuncios`, `conversao`, `receita` e `aki`; o funil consulta eventos e vendas de anúncios. As tabelas do Radar já guardam datas de criação, proposta escolhida e encerramento, portanto existe matéria-prima reutilizável. A escolha marca `escolhida` antes de devolver o contato, e o encerramento `resolvido` é uma declaração do comprador. Esses estados não comprovam conversa nem negócio entre as partes.

**Evidência:** [catálogo de relatórios, linhas 19 a 26](/home/raniel-linux/workspace/OLAQUI/src/lib/admin/relatorios.ts:19); [SQL do funil, linhas 505 a 529](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:505); [datas e identificação de pedidos e propostas, linhas 296 a 327](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107000000_olaki_inicial.sql:296); [encerramento declarado pelo comprador, linhas 464 a 493](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:464); [escolha e entrega do contato, linhas 209 a 214](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:209).

**Consequência para o piloto.** Contar ofertas escolhidas ou pedidos resolvidos como vendas pode justificar expansão sem evidência de atendimento útil. Também fica difícil saber se uma negociação dependeu de intervenção da equipe e se a pessoa retornou espontaneamente. A existência de uma planilha externa com esses dados não foi verificada; a lacuna demonstrada é do produto e de seu relatório.

**Prioridade justificada.** Major antes de avaliar o piloto, pois compromete diretamente os três resultados esperados. Não exige impedir negociações nem desenvolver um painel novo.

**Menor ação proposta.** Criar um registro restrito do piloto, com identificador do participante e do pedido/proposta, origem real ou teste, modo do Radar, horário do pedido, primeira proposta, resposta considerada útil pelo comprador, oferta escolhida, contato relatado, negócio relatado por cada parte, confirmação ou divergência, ajuda da equipe e retorno espontâneo. Reutilizar datas e IDs existentes; registrar manualmente somente o que ocorre fora do site. Definir responsável e janela de observação antes dos convites.

**Aceite verificável.** Um conjunto fictício com pedido sem resposta, contato sem negócio, negócio relatado por apenas uma parte, negócio confirmado pelas duas e retorno após ajuda deve produzir cinco classificações distintas. Nenhum `escolhida=true` ou `fechado_motivo='resolvido'` poderá, sozinho, entrar em “negócio confirmado”. O resumo deve mostrar contagens, denominadores e casos ainda sem resposta, sem transformá-los em fracassos ou sucessos.

**Contra-argumento.** Em um grupo pequeno, o responsável pode lembrar de todas as conversas. Ainda assim, a memória não preserva horários, divergências nem a diferença entre ajuda e iniciativa. Um registro manual com poucos campos atende ao recorte; automatizar tudo pode esperar.

### OD-02. Major: o percentual de cliques é descrito como pessoas que conversaram

**Dimensão:** semântica das métricas e confiabilidade do relatório.

**Código comprovado.** A página mostra “% de quem viu chamou no WhatsApp”. O SQL divide contagens independentes de eventos no intervalo, sem formar uma coorte de pessoas que viram e depois clicaram. A deduplicação funciona por anúncio, tipo, hash diário e janela configurável; não produz pessoas únicas no período. O clique é registrado ao tocar no link, antes de qualquer confirmação de conversa. O acompanhamento de vendas usa outra população, anúncios marcados como vendidos no período.

**Evidência:** [texto e percentual do funil, linhas 140 a 169](/home/raniel-linux/workspace/OLAQUI/src/app/admin/relatorios/page.tsx:140); [contagens independentes, linhas 515 a 529](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:515); [janela e deduplicação por tipo, linhas 1309 a 1320](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107020000_categorias_e_anuncios.sql:1309); [registro no clique do link, linhas 76 a 86](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/barra-contato.tsx:76).

**Consequência para o piloto.** O operador pode comunicar conversão de pessoas ou conversas que o sistema não mediu. Mudanças de intervalo e repetição de visitas alteram a razão, mesmo sem mudança real na qualidade das negociações. Isso é uma discrepância comprovada de interpretação; não há evidência de que alguém já tomou uma decisão errada a partir dela.

**Prioridade justificada.** Major por atingir o relatório usado para avaliar resultado. A correção mínima é editorial e operacional, sem ampliar coleta de dados pessoais.

**Menor ação proposta.** Descrever a razão como “cliques registrados por visualização registrada”, explicar a janela de deduplicação e manter vendas relatadas em bloco separado. Para o piloto, usar o registro de OD-01 como fonte de contato e confirmação. Registrar a regra de contagem junto de cada resumo exportado.

**Aceite verificável.** Repetir visitas fora da janela, clicar sem enviar mensagem e marcar vendido um anúncio visto em outro período não poderá gerar texto que afirme pessoas únicas, conversa ou conversão sequencial. Tela e resumo do piloto devem manter essas distinções. Um cálculo de conversão por participante, se criado depois, precisará de coorte e janela próprias.

**Contra-argumento.** Razões de eventos são úteis para observar tendência. Isso permanece válido se forem rotuladas como eventos; não sustenta a frase atual sobre quem viu e chamou.

### OD-03. Major: falhas técnicas importantes perdem o contexto necessário ao suporte

**Dimensão:** rastreabilidade de tentativas e diagnóstico operacional.

**Código comprovado.** O OTP mantém um estado útil de envio (`pendente`, `enviado`, `incerto`, `falha`) e um ID de desafio. Entretanto, falha de CAPTCHA, timeout, sessão Evolution fechada, rejeição HTTP e exceção de configuração são reduzidos a booleanos ou estados gerais. Nas ações, falhas de reserva e confirmação do banco viram mensagens gerais, sem registrar código de erro ou referência de suporte. A leitura de relatórios também devolve `null` sem preservar a causa. O registro de eventos de anúncio retorna `false` tanto para falha quanto para situações legítimas como deduplicação. Há logs de alterações no banco e um `console.error` no webhook Clerk; portanto não se trata de ausência total de logs. Esses registros não cobrem de modo uniforme tentativas que falharam antes de persistir.

**Evidência:** [validação e envio do OTP, linhas 33 a 62](/home/raniel-linux/workspace/OLAQUI/src/lib/whatsapp/servico.ts:33); [ações de OTP, linhas 16 a 31 e 39 a 46](/home/raniel-linux/workspace/OLAQUI/src/app/confirmar-celular/actions.ts:16); [leitura dos relatórios, linhas 110 a 117](/home/raniel-linux/workspace/OLAQUI/src/lib/admin/relatorios.ts:110); [falha de registro de evento, linhas 22 a 40](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/actions.ts:22); [log de alterações, linhas 431 a 456](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107000000_olaki_inicial.sql:431); [erro do webhook Clerk, linhas 35 a 37](/home/raniel-linux/workspace/OLAQUI/src/app/api/webhooks/clerk/route.ts:35).

**Consequência para o piloto.** Diante de “não recebi o código” ou “não consegui pedir”, o responsável pode não distinguir limite legítimo, contato incorreto, indisponibilidade de provedor e falha do banco. A confirmação de WhatsApp é obrigatória para pedidos, propostas e criação de vitrine na migração atual, aumentando o impacto operacional desse ponto. Não verifiquei os logs ou recursos de observabilidade configurados externamente na Vercel, Supabase ou VPS.

**Prioridade justificada.** Major para onboarding acompanhado e recuperação de incidentes. Não exige stack nova de observabilidade.

**Menor ação proposta.** Usar logs estruturados no servidor já existente para falhas inesperadas, com operação, etapa, referência da tentativa, ID do pedido ou desafio quando houver, duração e código de erro seguro. Distinguir recusas esperadas das falhas técnicas. Oferecer uma referência curta ao suporte e documentar onde consultar cada dependência. Não registrar OTP, HMAC, telefone completo, token, cabeçalhos de autorização ou payloads integrais de participantes.

**Aceite verificável.** Em validação isolada futura, simular sessão Evolution fechada, timeout após envio e falha de RPC. O responsável deve localizar a etapa e a mesma referência sem consultar o código recebido nem pedir que o participante repita operações às cegas. Repetição legítima de evento deve ser distinguível de falha de persistência. O tempo-alvo para localizar a causa deverá ser escolhido para o piloto; este parecer não inventa uma escala de plantão.

**Contra-argumento.** Um piloto pequeno permite perguntar diretamente ao participante e olhar o painel do provedor. Isso ajuda a resolver um caso, mas não recupera uma falha transitória nem a distingue de uma rejeição esperada. Um pequeno número de logs em fronteiras críticas oferece o benefício sem implantação de tracing distribuído.

### OD-04. Major: o carimbo de resumo enviado não comprova que um aviso foi criado

**Dimensão:** confiabilidade dos estados operacionais e diagnóstico de notificações.

**Código comprovado.** `radar_avisar_prazos()` chama `radar_aviso()` com `perform`, ignora seu booleano e sempre preenche `resumo_enviado_em` e incrementa `feitos`. `radar_aviso()` pode retornar `false` por configuração ou modelo desligado; `notificar()` também pode retornar `false` por preferência, duplicidade ou determinadas violações do banco. Depois do carimbo, a seleção exclui o pedido de novas tentativas. Isso não demonstra um incidente atual, mas impede tratar carimbo e contador como prova de aviso criado ou visto.

**Evidência:** [seleção, retorno ignorado e carimbo, linhas 994 a 1008](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:994); [configuração e modelo desligado, linhas 315 a 333](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:315); [preferência, duplicidade e falhas tratadas, linhas 170 a 185](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:170); [comentário que define o carimbo como envio, linhas 299 a 304](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010100_painel_admin.sql:299).

**Consequência para o piloto.** A equipe pode interpretar “resumo enviado” como comprador informado e atribuir silêncio a desinteresse. A informação também não representa entrega por WhatsApp: o canal ativo das mensagens automáticas permanece `notificacao`, separado do OTP Evolution.

**Prioridade justificada.** Major porque o objetivo exige respostas úteis e retorno dos participantes; saber se o aviso foi criado faz parte desse diagnóstico.

**Menor ação proposta.** No piloto, reconciliar os pedidos vencidos com a existência da chave `prazo_acabou:<pedido>` em `notificacoes` e com as preferências/modelos aplicáveis. Descrever o carimbo atual como processamento do prazo. Se houver alteração de código, distinguir aviso criado, já existente, suprimido por preferência/configuração e falha técnica; repetir somente falhas transitórias comprovadas, preservando a deduplicação e a vontade do participante.

**Aceite verificável.** Com aviso ligado, a rotina deve permitir comprovar a linha correspondente; com preferência desligada, o caso deve aparecer como suprimido e não como enviado. Uma falha técnica simulada deverá ser identificada separadamente. Uma segunda execução não poderá criar duplicata nem burlar preferência. A marca de leitura, quando usada, deverá continuar separada da criação do aviso.

**Contra-argumento.** Suprimir o aviso pode ser correto e evita interromper a operação principal. A recomendação preserva esse comportamento; corrige a evidência disponível ao operador e impede inferência indevida de entrega.

### OD-05. Major: ativação e funcionamento contínuo das dependências ainda precisam de evidência do ambiente do piloto

**Dimensão:** prontidão operacional e recuperação.

**Código comprovado.** As migrações agendam o Radar e os avisos de plano somente quando `pg_cron` já existe. A documentação orienta agendamento manual se ele for ligado depois. O envio de OTP consulta a sessão Evolution a cada solicitação e falha se ela não estiver `open`; a aplicação atual torna WhatsApp confirmado obrigatório. Isso estabelece dependências concretas, sem provar que estejam quebradas.

**QA histórico.** O documento de WhatsApp registra recebimento real, confirmação e recuperação após reinício. O QA do Radar declara uso de fixtures nas fronteiras e não realização de negociações comerciais. Esses registros reduzem incerteza sobre implementação, mas não demonstram saúde atual do alias, jobs, webhook e sessão usados pelos convidados. O QA de cadastro mais recente também informa que o Clerk permanece na instância de desenvolvimento.

**Evidência:** [agendamento condicional do Radar, linhas 1017 a 1024](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql:1017); [agendamento condicional de planos, linhas 466 a 471](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:466); [procedimento manual documentado, linhas 69 a 76](/home/raniel-linux/workspace/OLAQUI/docs/etapa4/radar.md:69); [dependência de sessão aberta, linhas 46 a 52](/home/raniel-linux/workspace/OLAQUI/src/lib/whatsapp/servico.ts:46); [obrigatoriedade no banco, linhas 3 a 30](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:3); [limites do QA Radar, linhas 21 a 27](/home/raniel-linux/workspace/OLAQUI/docs/QA-RADAR-2026-11-09.md:21); [estado de Clerk relatado, linha 51](/home/raniel-linux/workspace/OLAQUI/docs/QA-CADASTRO-INICIO-2026-11-09.md:51).

**Consequência para o piloto.** Um job ausente ou uma sessão caída pode afetar prazo, avisos ou onboarding enquanto as páginas continuam acessíveis. Não há evidência nesta revisão para afirmar que isso ocorreu. A lacuna é de comprovação e acompanhamento no ambiente concreto.

**Prioridade justificada.** Major como critério de abertura operacional. Se uma dependência obrigatória falhar na verificação futura, a abertura correspondente fica bloqueada até recuperação; não classifico a falta de consulta externa como bug comprovado.

**Menor ação proposta.** Definir uma pessoa responsável por sessão/janelas do piloto e registrar um ensaio com duas contas convidadas no alias correto: cadastro e confirmação, criação de pedido, proposta, escolha e acesso ao contato. Conferir existência, último resultado e atraso dos jobs aplicáveis, evento recente de Clerk e estado Evolution. Estabelecer onde a pessoa procura falhas e como pausar novos convites. Durante um grupo pequeno, uma conferência antes de cada janela acompanhada pode substituir monitoramento automatizado contínuo. O ensaio e eventuais mensagens dependem de autorização própria; não foram executados aqui.

**Aceite verificável.** Registrar alias, revisão publicada, migrações efetivas, horário da verificação, responsável, resultado de cada etapa e evidência de execução recente dos jobs. Para um pedido de prazo controlado, confirmar o processamento e a linha de notificação de acordo com OD-04. Confirmar em dispositivo realmente usado no piloto o recebimento do código e o acesso ao WhatsApp, sem inferir envio de mensagem a partir da abertura do link. Um procedimento curto deve permitir reconhecer sessão fechada e interromper novos cadastros assistidos até a recuperação.

**Contra-argumento.** O QA histórico já mostra um teste real de WhatsApp e uma publicação. Isso é evidência útil, mas não cobre a janela atual nem o caminho comercial completo. O ensaio proposto é restrito às dependências da jornada do piloto, sem repetir toda a suíte nem exigir operação 24 horas.

### OD-06. Nit no piloto sem cobrança: receita e conversão não separam sandbox

**Dimensão:** confiabilidade de relatórios financeiros.

**Código comprovado.** `relatorio_receita()` soma todos os pagamentos pagos do período e `relatorio_conversao_teste()` considera qualquer assinatura paga da loja. Nenhuma consulta filtra ambiente. O ambiente da criação da cobrança é preservado em `asaas_criacoes`, mas os relatórios não usam essa informação. O documento de Meu plano relata sandbox e ausência de cobrança real naquela validação. Não foi verificada a existência de pagamentos sandbox confirmados no banco atual.

**Evidência:** [consultas de conversão e receita, linhas 568 a 595](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql:568); [ambiente da reserva, linhas 2 a 20](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110002950_cobranca_sem_duplicidade.sql:2); [confirmação de cobrança encontrada, linhas 146 a 148](/home/raniel-linux/workspace/OLAQUI/src/lib/cobranca-pagamento.ts:146); [leitura do ambiente, linhas 42 a 48](/home/raniel-linux/workspace/OLAQUI/src/lib/asaas.ts:42); [QA Meu plano](/home/raniel-linux/workspace/OLAQUI/docs/QA-MEU-PLANO-2026-11-09.md:3).

**Consequência para o piloto.** Se testes financeiros forem confirmados na mesma base e usados no resumo, poderão ser interpretados como receita ou disposição real a pagar. É risco condicional, não contaminação observada.

**Prioridade justificada.** Nit e adiável se cobrança e validação financeira ficarem fora deste piloto. Passa a Major antes de usar receita ou conversão em decisão comercial.

**Menor ação proposta.** Declarar os relatórios financeiros fora da avaliação inicial. Caso sejam utilizados, separar ambiente e registros de teste, preservando a identificação da origem; não apagar histórico para “limpar” indicadores. Tratar linhas sem origem conhecida como pendentes de classificação.

**Aceite verificável.** Um pagamento fictício confirmado em sandbox não pode compor receita real nem conversão paga do piloto. O total apresentado deve conciliar com pagamentos identificados como produção, mantendo sandbox e desconhecidos explícitos.

**Contra-argumento.** Se a base nunca recebeu pagamentos de teste confirmados, não há erro numérico atual. Nesse caso, basta deixar explícito o recorte e não desenvolver filtros financeiros antes de existir essa necessidade.

## O que já existe e deve ser reutilizado

O código atual preserva identificação de pedido e repetição segura por `chave_envio` ([migração, linhas 160 a 184](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:160)), datas de criação/encerramento/escolha e logs de alterações. Leituras essenciais do Radar lançam erro quando a consulta falha, e a tela de relatórios diferencia falha de ausência de dados ([Radar, linhas 68 a 103](/home/raniel-linux/workspace/OLAQUI/src/lib/dados/radar.ts:68); [relatórios, linhas 75 a 76](/home/raniel-linux/workspace/OLAQUI/src/app/admin/relatorios/page.tsx:75)).

A exportação CSV verifica administração e falha com resposta 503 quando o relatório está indisponível, além de tratar células que poderiam ser interpretadas como fórmulas ([rota, linhas 23 a 50](/home/raniel-linux/workspace/OLAQUI/src/app/admin/relatorios/csv/route.ts:23)). O OTP tem armazenamento persistente, controle de tentativas e estados incertos; não há necessidade de inventar outro identificador de desafio. A leitura demonstra essas estruturas, mas não certifica a configuração de produção.

O histórico de notificações recebeu correção específica de leitura e de texto sobre oferta escolhida. A migração atual deixou de prometer que a escolha enviou uma mensagem ([migração, linhas 18 a 31](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109195657_notificacoes_confiaveis.sql:18)). A recomendação OD-01 respeita essa evolução e não trata a falha textual antiga como vigente.

## Controle mínimo sugerido

| Pergunta do piloto | Evidência mínima | Limite de interpretação |
|---|---|---|
| O convidado conseguiu entrar e negociar? | Participante identificado, etapa alcançada, tentativa com hora e motivo de interrupção | Cadastro concluído não comprova resposta comercial |
| As lojas responderam? | Pedido e primeira proposta persistida, com data, modo e loja | Tempo até proposta não mede qualidade |
| A resposta foi útil? | Avaliação explícita do comprador e motivo curto | Quantidade de propostas não substitui utilidade |
| Houve contato? | Relato do participante associado ao pedido/proposta | Clique, link devolvido e oferta escolhida têm classificação própria |
| Houve negócio? | Relato de cada parte; confirmação, divergência ou pendência | “Resolvido” pode ter ocorrido por outro canal |
| O participante voltou? | Nova ação com data e motivo do retorno | Separar retorno espontâneo de convite ou ajuda da equipe |
| O serviço falhou? | Referência, etapa, horário e motivo técnico seguro | Falha de medição não deve ser apresentada como zero demanda |

Os campos devem ser acessíveis somente à equipe que acompanha o piloto. Não é necessário copiar conversas, códigos ou contatos pessoais para uma planilha analítica. Definir tamanho do grupo, duração e metas quantitativas exige decisão do responsável; este parecer não atribui números já aprovados.

Recomendo fechar OD-01 com registro manual e OD-05 com ensaio do ambiente antes dos convites, corrigir a interpretação de OD-02 e assegurar diagnóstico mínimo de OD-03. OD-04 entra na conferência dos pedidos com prazo. OD-06 pode esperar enquanto cobrança não fizer parte do aprendizado pretendido.

## Registro de leituras

A lista abaixo distingue leitura integral, leitura de trechos e busca de símbolos. Os hashes identificam o conteúdo local consultado; não comprovam implantação. A cobertura dos trechos está descrita na coluna de leitura. As referências de linhas dos achados foram obtidas no conteúdo efetivamente aberto.

| Arquivo | Leitura efetiva | SHA-256 abreviado |
|---|---|---|
| [codebase_details.md](/home/raniel-linux/.codex/plugins/cache/egm/egm/0.1.1/agents/codebase_details.md) | Integral; persona real, BRAINSTORM: Telemetry & Tracing e Operational Debuggability | `d80db07e449b57b3` |
| [docs/brainstorm-piloto-2026-11-09/hipotese.md](/home/raniel-linux/workspace/OLAQUI/docs/brainstorm-piloto-2026-11-09/hipotese.md) | Integral; recorte autorizado e fontes selecionadas | `300e8605e1052ff2` |
| [README.md](/home/raniel-linux/workspace/OLAQUI/README.md) | Integral; orientação, stack e lista histórica de migrações | `eefff69f2382183b` |
| [package.json](/home/raniel-linux/workspace/OLAQUI/package.json) | Integral; dependências e comandos, sem execução | `1b49959e46284d49` |
| [docs/CORRECOES-FLUXO-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/CORRECOES-FLUXO-2026-11-09.md) | Integral; registro histórico de correções | `85a98209cf498811` |
| [docs/QA-RADAR-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-RADAR-2026-11-09.md) | Integral; limites de fixtures e publicação | `4adf95b28cf27d60` |
| [docs/QA-WHATSAPP-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-WHATSAPP-2026-11-09.md) | Integral; teste real histórico e infraestrutura | `79269508ee0cc14e` |
| [docs/QA-MEU-PLANO-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-MEU-PLANO-2026-11-09.md) | Integral; sandbox e limites da validação financeira | `66b5265a9eb8c317` |
| [docs/etapa5/relatorios.md](/home/raniel-linux/workspace/OLAQUI/docs/etapa5/relatorios.md) | Integral; desenho documentado dos relatórios e mensagens | `610fed3364604f3b` |
| [docs/etapa4/paginas.md](/home/raniel-linux/workspace/OLAQUI/docs/etapa4/paginas.md) | Integral; páginas de erro, ajuda e orientação operacional | `fa04d3fac0bd3f0c` |
| [docs/etapa4/radar.md](/home/raniel-linux/workspace/OLAQUI/docs/etapa4/radar.md) | Trecho 65 a 80; agendamentos | `d986bcf48125df7e` |
| [docs/ARQUITETURA.md](/home/raniel-linux/workspace/OLAQUI/docs/ARQUITETURA.md) | Trecho 157 a 183; descrição histórica de tarefas e dependências | `5cfe6e400de22c12` |
| [docs/QA-CADASTRO-INICIO-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-CADASTRO-INICIO-2026-11-09.md) | Trecho 45 a 51; limites e operação relatados | `ff6345af45fe4f86` |
| [src/lib/admin/relatorios.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/admin/relatorios.ts) | Integral; catálogo, consultas e tratamento de falhas | `51c2639d57df75af` |
| [src/app/admin/relatorios/page.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/admin/relatorios/page.tsx) | Trechos de preparação, funil e conversão; linhas 1 a 178 e 210 a 262 | `46c3062f2639d61a` |
| [src/app/admin/relatorios/csv/route.ts](/home/raniel-linux/workspace/OLAQUI/src/app/admin/relatorios/csv/route.ts) | Integral; autenticação, exportação e falhas | `762cc27aac22c2da` |
| [src/lib/tipos-relatorios.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/tipos-relatorios.ts) | Trecho 1 a 90; canais ativos e contrato dos relatórios | `eb390b7b18e0b3ec` |
| [src/app/radar/actions.ts](/home/raniel-linux/workspace/OLAQUI/src/app/radar/actions.ts) | Integral; pedido, proposta, escolha e encerramento | `f398c555622fbe9b` |
| [src/lib/dados/radar.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/dados/radar.ts) | Trecho 1 a 150; leituras essenciais e tratamento de erro | `1f1fdc442c391323` |
| [src/app/(publico)/anuncio/[idslug]/actions.ts](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/actions.ts) | Trecho 1 a 60; registrarEvento | `d97c723dd21831ed` |
| [src/app/(publico)/anuncio/[idslug]/barra-contato.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/barra-contato.tsx) | Trecho 42 a 95; clique no contato | `8bb6507f3379a0e4` |
| [src/app/(publico)/anuncio/[idslug]/registrar-visita.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/registrar-visita.tsx) | Integral; registro ao montar a página | `0e1fc34885cc3876` |
| [src/lib/whatsapp/servico.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/whatsapp/servico.ts) | Integral; configuração, CAPTCHA e envio | `8b4f3529de927ef4` |
| [src/app/confirmar-celular/actions.ts](/home/raniel-linux/workspace/OLAQUI/src/app/confirmar-celular/actions.ts) | Integral; reserva, estado do envio e confirmação | `a28791cc7e775bf2` |
| [src/app/api/asaas/webhook/route.ts](/home/raniel-linux/workspace/OLAQUI/src/app/api/asaas/webhook/route.ts) | Integral; recebimento e erros de webhook | `47227b1a37561513` |
| [src/app/api/webhooks/clerk/route.ts](/home/raniel-linux/workspace/OLAQUI/src/app/api/webhooks/clerk/route.ts) | Integral; sincronização, exclusão e log | `7537a3ee45bd56ac` |
| [src/app/error.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/error.tsx) | Integral; referência de erro apenas no console do cliente | `d6bdab6de871a507` |
| [src/lib/cobranca-pagamento.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/cobranca-pagamento.ts) | Trecho 88 a 175 e busca de símbolos; reserva e reconciliação | `0471eeba8dc3090f` |
| [src/lib/asaas.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/asaas.ts) | Trecho 1 a 76 e busca de símbolos; seleção de ambiente | `7c826150883e7ff3` |
| [supabase/migrations/20261107000000_olaki_inicial.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107000000_olaki_inicial.sql) | Trechos 296 a 348 e 426 a 476; tabelas e logs, com busca cumulativa | `9a36fcbc7a03e125` |
| [supabase/migrations/20261107010100_painel_admin.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010100_painel_admin.sql) | Trechos 228 a 260 e 292 a 313; pagamentos, modos e carimbo do resumo | `5565d1c6c7ffad49` |
| [supabase/migrations/20261107020000_categorias_e_anuncios.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107020000_categorias_e_anuncios.sql) | Trecho 1255 a 1345; eventos e deduplicação, com busca cumulativa | `da1270235dd3df68` |
| [supabase/migrations/20261108010000_cobranca_planos.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108010000_cobranca_planos.sql) | Trechos 30 a 48 e 819 a 850; pagamentos, com busca cumulativa | `bee97c9cb1dea1da` |
| [supabase/migrations/20261108020000_radar_completo.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108020000_radar_completo.sql) | Trechos 30 a 65, 150 a 191, 464 a 502 e 876 a 1040; Radar e notificações | `568b33b506a890b5` |
| [supabase/migrations/20261108060000_mensagens_relatorios.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108060000_mensagens_relatorios.sql) | Trechos 265 a 343 e 416 a 620; avisos, jobs e relatórios | `e823e2d5e43b237b` |
| [supabase/migrations/20261109032907_seguranca_fluxo_radar.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109032907_seguranca_fluxo_radar.sql) | Trecho 160 a 187; idempotência, com busca cumulativa | `3c7896c8c4c5cd70` |
| [supabase/migrations/20261109195657_notificacoes_confiaveis.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109195657_notificacoes_confiaveis.sql) | Integral; leitura de avisos e correção de texto | `2ba668ac439ec13e` |
| [supabase/migrations/20261110002950_cobranca_sem_duplicidade.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110002950_cobranca_sem_duplicidade.sql) | Integral; ambiente de reserva e preço | `4e65415c1a2aae18` |
| [supabase/migrations/20261110012622_confirmacao_whatsapp.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110012622_confirmacao_whatsapp.sql) | Integral; desafios, cotas, retenção e confirmação | `b1a96362202fe9d2` |
| [supabase/migrations/20261110014434_whatsapp_obrigatorio.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110014434_whatsapp_obrigatorio.sql) | Integral; confirmação, proposta e escolha atuais | `d526e6624a79e9df` |
| [supabase/migrations/20261110020853_moderacao_aluguel.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261110020853_moderacao_aluguel.sql) | Integral; última migração local, sem redefinição de métricas | `93b24e49bd8f2087` |

Buscas temáticas adicionais, sem leitura integral e sem uso como prova isolada de comportamento. Os pequenos identificadores abaixo vieram dos resultados efetivamente lidos:

| Arquivo | Trecho ou símbolo encontrado |
|---|---|
| [supabase/migrations/20261107010200_endurecimento_advisor.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107010200_endurecimento_advisor.sql) | `revelar_contato_radar` |
| [supabase/migrations/20261107030000_radar_celular_sem_codigo.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107030000_radar_celular_sem_codigo.sql) | `whatsapp_confirmado e revelar_contato_radar, substituídos no fluxo atual` |
| [supabase/migrations/20261107030500_destaques.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107030500_destaques.sql) | `eventos_anuncio e expirar_rotina` |
| [supabase/migrations/20261107031000_robo_aki.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107031000_robo_aki.sql) | `tratamento de exceções` |
| [supabase/migrations/20261107040000_vitrine_completa.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107040000_vitrine_completa.sql) | `contato e texto de plano` |
| [supabase/migrations/20261108030000_paginas_e_textos.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108030000_paginas_e_textos.sql) | `logs, contato e documentação semeada` |
| [supabase/migrations/20261108040000_regioes_categorias.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261108040000_regioes_categorias.sql) | `tratamento de exceções e pagamentos` |
| [supabase/migrations/20261109190459_lixeira_anuncios.sql](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261109190459_lixeira_anuncios.sql) | `vendido_em e preservação de estado` |
| [src/app/(publico)/anuncio/[idslug]/compartilhar.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/compartilhar.tsx) | `registrarEvento compartilhar` |
| [src/app/(publico)/anuncio/[idslug]/conteudo-anuncio.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/anuncio/[idslug]/conteudo-anuncio.tsx) | `importação do componente de compartilhamento` |
| [src/app/(conta)/minha-conta/dados/actions.ts](/home/raniel-linux/workspace/OLAQUI/src/app/(conta)/minha-conta/dados/actions.ts) | `tratamento de erro e orientação de confirmação` |
| [src/app/(conta)/anunciar/pronto/page.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/(conta)/anunciar/pronto/page.tsx) | `link de compartilhamento` |
| [src/components/anunciar/form-loja.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/anunciar/form-loja.tsx) | `link de compartilhamento` |
| [src/components/vitrine/copiar-link-loja.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/vitrine/copiar-link-loja.tsx) | `feedback de cópia` |
| [src/components/vitrine/cabecalho-vitrine.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/vitrine/cabecalho-vitrine.tsx) | `comentário dos botões de contato` |
| [src/lib/formato.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/formato.ts) | `endereço de compartilhamento` |
| [src/lib/tipos.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/tipos.ts) | `TipoEvento` |
| [src/lib/perfil.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/perfil.ts) | `sincronizarPerfil` |
| [src/lib/supabase/admin.ts](/home/raniel-linux/workspace/OLAQUI/src/lib/supabase/admin.ts) | `comentário de utilização de serviço` |
| [src/app/radar/pedir/page.tsx](/home/raniel-linux/workspace/OLAQUI/src/app/radar/pedir/page.tsx) | `sincronização do perfil` |
| [src/components/conta/foto-perfil.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/conta/foto-perfil.tsx) | `sincronização e tratamento de estado` |
| [src/components/busca/folha-filtros.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/busca/folha-filtros.tsx) | `sincronização da navegação` |
| [src/components/demo/kit/util.ts](/home/raniel-linux/workspace/OLAQUI/src/components/demo/kit/util.ts) | `console.warn de demonstração` |
| [src/components/demo/kit/act.ts](/home/raniel-linux/workspace/OLAQUI/src/components/demo/kit/act.ts) | `console.error de demonstração` |
| [src/components/demo/kit/stage.tsx](/home/raniel-linux/workspace/OLAQUI/src/components/demo/kit/stage.tsx) | `console.error de demonstração` |
| [src/components/demo/kit/clock.ts](/home/raniel-linux/workspace/OLAQUI/src/components/demo/kit/clock.ts) | `console.error de demonstração` |
| [docs/etapa3/destaques.md](/home/raniel-linux/workspace/OLAQUI/docs/etapa3/destaques.md) | `rotina diária` |
| [docs/QA-CRIAR-PUBLICAR-ANUNCIO-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-CRIAR-PUBLICAR-ANUNCIO-2026-11-09.md) | `identificador reutilizável` |
| [docs/PAINEL-ADMIN.md](/home/raniel-linux/workspace/OLAQUI/docs/PAINEL-ADMIN.md) | `rotinas de prazo` |
| [docs/QA-NOTIFICACOES-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-NOTIFICACOES-2026-11-09.md) | `contagem e atualização de avisos` |
| [docs/QA-MINHA-CONTA-2026-11-09.md](/home/raniel-linux/workspace/OLAQUI/docs/QA-MINHA-CONTA-2026-11-09.md) | `sincronização do perfil` |

Também foram pesquisadas redefinições dos símbolos relevantes no conjunto ordenado de `supabase/migrations`, inclusive nas migrações posteriores às de relatórios e Radar. Arquivos sem ocorrência foram apenas parte do universo da busca, sem alegação de leitura integral. O diretório `.github` e o arquivo `vercel.json` não estavam presentes nas consultas extras; nenhuma conclusão depende de supor seu conteúdo.

Verificação final desta entrega: seis achados com prioridade, consequência, evidência, ação mínima, aceite e contra-argumento; separação explícita entre implementação, QA histórico, hipótese e produção não verificada; fontes selecionadas lidas; ausência de alterações de código ou execução externa.
