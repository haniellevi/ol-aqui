# Meu plano: assinatura e pagamentos

Escopo: plano atual, limites, períodos, renovação, troca, Pix, cartão, retomada e histórico, preservando a identidade OL-AKI. O ambiente financeiro configurado permanece sandbox. Nenhuma cobrança real foi criada.

## Correções

- Uma reserva persistente no banco antecede a criação da cobrança. Requisições simultâneas fazem no máximo um POST por pagamento. Timeout ou resposta perdida preservam a reserva; uma nova tentativa procura a cobrança pela referência e confere cliente, valor e forma antes de reutilizá-la. A referência do Asaas não é tratada como garantia de idempotência.
- Uma recusa explícita permite corrigir os dados. Se o resultado de um envio permanece desconhecido, não se cria outra cobrança: a tela orienta retomar ou procurar suporte. Uma reserva sem cobrança localizada exige conciliação antes de ser liberada manualmente.
- O preço apresentado é conferido na mesma transação que cria o pedido. Mudança de catálogo desfaz também eventuais cancelamentos dessa transação. Cobranças antigas usam o preço salvo e continuam acessíveis mesmo quando o plano sai do catálogo.
- Falhas de rede liberam os controles e permitem recuperação. CPF/CNPJ solicitado pelo servidor mantém o ID do pedido. A confirmação periódica não reinicia a cada renderização. A recuperação da página recarrega os dados do servidor.
- Plano atual selecionado por padrão, preços com centavos, vencimentos sem mudança de dia pelo fuso, períodos explícitos e aviso de ausência de renovação automática. Histórico paginado e links de pagamento limitados aos domínios HTTPS do Asaas.
- Falha de leitura não aparece como ausência de assinatura ou histórico. Dados de outra conta continuam protegidos por sessão e RLS. O fallback da cópia do Pix só informa sucesso se a cópia for aceita pelo navegador.

## Validação

179 testes Node passaram, incluindo concorrência, resposta perdida, reconciliação divergente, falhas de persistência, proprietário, preço, login, retomada, datas e URL externa. TypeScript e build de produção passaram. Lint sem erros, com 10 avisos preexistentes em demonstrações.

PostgreSQL isolado executou todas as migrações e a suíte de regressão. `260_meu_plano.sql` cobre preço alterado, rollback, pedido repetido, RLS, privilégios de serviço, ambiente e confirmação repetida. Quatro conexões simultâneas obtêm uma única reserva. Os testes de cotas de anúncios e propostas e repetição do Radar também passaram.

Interface real das páginas, componentes e ações exercitada no navegador em 320 x 740, 390 x 844 e 1440 x 1000. Autenticação, banco e fronteira de cobrança foram substituídos por fixtures locais. O núcleo de integração foi testado separadamente com serviços simulados. O harness foi removido antes do build final.

Casos: selecionar período com desconto; manter centavos; falha e retomada com um único pedido; documento obrigatório e entrada vazia recusada; Pix e troca para cartão; aviso de pagamento ainda pendente; confirmação; cobrança acessível sem catálogo; paginação; indisponibilidade de leitura e recuperação. Sem transbordamento horizontal nas larguras verificadas. O checkout externo não foi aberto nem recebeu CPF ou cartão real. A cópia exibiu sucesso, mas a leitura do clipboard pela ferramenta não confirmou o conteúdo, portanto não serve como prova de transferência ao aplicativo bancário.

Capturas `meu-plano-celular.png` e `meu-plano-computador.png` na pasta de artefatos do chat, com dados fictícios identificados. A confirmação real do Asaas e o recebimento de webhook financeiro não foram exercitados nesta validação.

## Publicação

Migração aditiva `20261110002950_cobranca_sem_duplicidade` aplicada e privilégios conferidos: RLS ativo, usuários sem acesso à reserva, serviço autorizado, visitante sem acesso à criação de pedido. Nenhum pagamento foi criado na verificação. Conferir privilégios em produção, build, preview, commit da implantação e alias `ol-aqui.vercel.app`. A tabela de reservas usa RLS sem política para usuários comuns de propósito; somente o serviço pode operá-la. Os avisos genéricos preexistentes de funções SECURITY DEFINER no advisor não foram alterados fora deste escopo.

Documentação de referência: [Asaas, duplicidade após retry](https://docs.asaas.com/docs/duplicate-charge-after-retry-without-idempotency) e [consulta de cobranças](https://docs.asaas.com/reference/list-payments).

## Confirmação do celular

Requisito adicional identificado durante esta entrega: não concluir cadastro ou troca de contato sem comprovar a posse do celular. O painel do Clerk está em desenvolvimento, permite até 20 SMS por mês e bloqueia o Brasil (Tier C) até liberação pelo suporte. O usuário preferiu avaliar outro provedor. Foram apresentadas Twilio Verify, Infobip 2FA e Zenvia; escolha e contratação ainda pendentes. Esta entrega de cobrança não ativa nem alega confirmação obrigatória de celular.

## Roteiro reutilizável

1. Validar propriedade, preço e repetição no servidor e no banco isolado.
2. Simular falha antes e depois do envio, sem liberar nova cobrança de resultado desconhecido.
3. Exercitar escolha, retomada e histórico em celular e computador.
4. Remover fixtures; executar testes, TypeScript, lint e build.
5. Aplicar a migração aditiva, publicar o commit validado e conferir a implantação de produção.
