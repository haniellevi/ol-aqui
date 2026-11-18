# Cupons de acesso ao plano Promocional

## Direção definida por Raniel em 18/11/2026

O projeto ainda não foi lançado e não tem pagamentos realizados. Raniel corrigiu o modelo anterior e pediu a criação do sistema de cupons promocionais. O administrador master escolhe o código, a quantidade de dias de acesso contada desde a ativação e as permissões do plano Promocional. Qualquer conta autenticada pode ativar um código válido, independentemente do plano atual.

## Funcionamento

- O painel oferece a configuração de um plano Promocional comum aos cupons. Reutiliza os recursos já controlados por plano, com caixas para habilitar/desabilitar e campos de limite para anúncios, Radar, propostas e avisos do Radar, fachada, seções e produtos fixados.
- A configuração inicial copia os recursos do Full vigente no banco. Depois o master pode alterá-los no painel.
- Cada código define uma duração em dias, ativo/inativo e, opcionalmente, uma data limite para novas ativações. A data limite do código é diferente do vencimento do acesso concedido.
- Os novos códigos ficam disponíveis para o master distribuir. O site oferece o campo para digitar o cupom e não revela a lista de campanhas a todos os usuários.
- A ativação começa imediatamente e vence exatamente após a quantidade configurada de dias corridos. Um código pode ser usado uma vez por conta.
- A ativação fica vinculada à conta, incluindo contas sem loja e vendedores individuais. Os direitos comuns, como limite de anúncios e Radar, usam os recursos promocionais durante a vigência. Recursos próprios de loja ficam disponíveis quando a conta cria ou converte sua vitrine em loja, sem conversão automática pelo cupom. Ajudar em outra loja não transfere o benefício para essa loja.
- A loja ou vitrine conserva seu plano de origem. Durante o acesso promocional, os recursos efetivos vêm do plano Promocional. Depois do vencimento, o plano de origem volta a ser avaliado pelas regras existentes.
- Ativar outro código válido cria outro período contado da nova ativação. Se os períodos se sobrepõem, o acesso dura até o último vencimento, sem encurtar um benefício já ativo. Não se somam dias nem se reinicia o prazo ao repetir o mesmo código.
- Alterar as permissões do plano Promocional atualiza os recursos dos acessos promocionais vigentes. Alterar a duração de um código afeta apenas ativações futuras.
- Desativar um código impede novas ativações e conserva os prazos já concedidos.
- A configuração promocional concede direitos de uso, sem gerar cobrança ou registro de pagamento no Asaas.
- Exigências de cadastro, segurança, moderação e verificação dos recursos continuam aplicadas.
- No vencimento, os anúncios excedentes são pausados pela rotina existente, preservando os produtos. Uma nova liberação permite reativá-los pelas ações existentes.

## Administração e apresentação

O master configura o plano e cria/edita códigos no painel de Planos e preços. Novos códigos nascem ativos e podem ser desativados na edição. A tela explica que os recursos são comuns a todos os códigos e que cada código tem sua duração. As permissões só podem ser alteradas pelo master, inclusive por chamadas diretas ao banco.

Qualquer usuário autenticado encontra o campo de cupom em Meu plano, mesmo sem loja. A tela apresenta o plano Promocional vigente, a data da ativação, o vencimento e o uso disponível. Contas com restrições continuam vendo o prazo concedido, sem que o cupom remova a restrição. Erros de código inválido, fora da validade, desativado ou já usado têm mensagens próprias. Os formulários seguem DESIGN.md e os componentes existentes.

## Compatibilidade

As campanhas, atribuições e datas antigas ficam preservadas. Reservas pendentes anteriores conservam a elegibilidade após o fim ou a desativação da campanha; seu novo resgate ativa o Promocional imediatamente pela duração vigente do código. O código LANCAMENTO2026 passa a ter duração configurável em dias para novas ativações, inicialmente 90 dias. Períodos já ativados conservam suas datas. O modelo anterior de promoção geral em massa e o planejamento de saldo monetário foram substituídos pelo pedido mais recente.

## Verificação

- Ativação por conta sem vitrine, por pessoa física, loja gratuita e loja Full.
- Duração exata a partir da ativação, sem dependência da data de criação da conta.
- Bloqueio de resgate duplicado e concorrente, de código vencido ou desativado e de usuário sem sessão.
- Alteração das permissões refletida nas restrições reais de uso e protegida contra operadores sem acesso master.
- Retorno ao plano anterior no vencimento, com pausa dos excedentes e conservação dos produtos.
- Compatibilidade dos períodos e campanhas existentes.
- Testes de banco e ações, lint, tipos, conferidor de design e verificação em 360 px.

## Escolhas de implementação comunicadas ao usuário

Um plano Promocional comum aos cupons, em vez de um conjunto de permissões por código. Cada código mantém duração própria. A sobreposição de períodos usa o maior vencimento. A alteração de permissões afeta acessos vigentes. Essas escolhas seguem a configuração singular do plano pedida pelo usuário e evitam perda de dias ao ativar outro código.

## Estado

Escopo corrigido pela instrução direta de Raniel para criar este sistema. Execução no worktree codex/contas-promocionais.
