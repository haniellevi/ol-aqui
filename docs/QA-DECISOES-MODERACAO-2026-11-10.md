# Decisões de moderação: verificação de 10/11/2026

## Problema e correção

A recusa do anúncio fictício enviava ID e motivo sem o campo da decisão. O servidor respondia com “Ação inválida”. A mesma dependência do botão existia nos pedidos, denúncias e Radar. Decisões ausentes de pedidos e denúncias ainda podiam ser interpretadas como recusa ou denúncia não procedente.

Cada botão agora recebe uma Server Action vinculada à decisão. As ações rejeitam decisões desconhecidas antes de chamar o banco. O Radar também valida tipo, UUID, motivo e confirmação da remoção. A fila não mostra “Tudo em dia” quando uma consulta falha; o histórico da IA esclarece que inclui análises de anúncios já revisados.

## Evidências

- Reprodução em produção: clique em Recusar gerou POST sem decisão e retorno “Ação inválida”. Nenhuma alteração foi feita nessa tentativa.
- Componente real em aplicação Next.js isolada: Aprovar, Recusar e Congelar enviaram a ação e o motivo corretos. Congelar também foi acionado pelo teclado. Todos os botões ficaram desabilitados durante a gravação e somente a ação escolhida mostrou “Salvando...”. O ensaio isolado não acessou o banco.
- Prévia `c097732`, deployment `dpl_EKutaDui9onPNTeTubT6u6CDJ4LD`: acesso autenticado ao painel, dimensões 1440 × 1000 e 390 × 844, sem transbordamento horizontal.
- Recusa do anúncio fictício “Casa Teste Titulo”, com motivo “Teste concluído, sem oferta comercial.”, concluída pela prévia. O anúncio saiu da fila sem ser publicado. Consulta posterior: zero anúncios e pedidos em análise e zero denúncias abertas.
- Ocultar no Radar sem motivo retornou a validação esperada, preservando o pedido de teste. Não houve remoção definitiva nem teste de aprovação de anúncio em produção.
- Aki em produção: o modelo configurado `deepseek/deepseek-v4.1-flash-1017` passou nos testes de conversa com ferramenta e identificação da foto laranja. Os dois registros têm erro nulo. Configurações e permissões foram preservadas.
- Moderação por IA: duas análises sem erro do mesmo anúncio fictício, ambas mantidas para revisão manual. São registros históricos, não duas pendências distintas.
- Cron: as últimas execuções consultadas dos quatro jobs estavam bem-sucedidas; expiração às 03:15 UTC, planos e Radar às 03:20 UTC, moderação às 03:21 UTC.

Após integrar `origin/main` (`f8b0568`, preparação do piloto), passaram 230 testes Node, TypeScript, lint (zero erros e dez avisos anteriores) e build. A auditoria das dependências de produção retornou zero vulnerabilidades conhecidas. A suíte SQL isolada passou nas regras e concorrência; o cenário que exige pg_cron foi explicitamente ignorado pelo contêiner sem essa extensão. Os jobs reais foram conferidos separadamente, por leitura.

O primeiro build local falhou por ausência da chave pública Clerk. Repetido com a chave pública já servida pelo site, terminou com saída zero. Nenhuma credencial secreta foi inserida no código ou neste relatório.

## Limites e próximos passos

O teste móvel foi feito em dimensões de celular no Chromium, sem aparelho físico. Não se mediu a precisão estatística da IA nem se repetiram todos os percursos reais do produto nesta correção.

A consulta atual confirmou Clerk de desenvolvimento, canais públicos de suporte vazios e documentos ativos com campos por preencher. Domínio e identidade de produção, operador/contatos e documentos, além da demonstração de backup/restauração, continuam no roteiro de preparação do piloto. Nenhum convite foi enviado. A publicação desta correção não declara esses requisitos concluídos.
