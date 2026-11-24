# Piloto fechado do Radar em Corrente e região

O Item 11 aprovou no e448 a preparação do piloto fechado de 30 dias descrito no e444. A equipe convida lojas e compradores da microrregião. Cada pessoa escolhe os avisos que quer receber em **Minha conta > Notificações**. Convite, preferência e chave geral são condições independentes. O período começa depois do teste controlado e da autorização de início. O dono aprovou as duas escolhas abaixo no Item 15, evento e468, e autorizou a implementação local.

| Evento | Quem recebe o aviso por WhatsApp |
| --- | --- |
| Pedido novo publicado ou aprovado | Dono de vitrine elegível na área e nicho do pedido, com direito a aviso imediato pelo plano ou cortesia. |
| Proposta nova | Comprador dono do pedido aberto, para proposta ativa de outra conta. |
| Proposta escolhida | Dono da vitrine da proposta escolhida, quando pedido e proposta seguem aptos ao aviso. |

O servidor confere participante, conta, microrregião do pedido e vigência na entrada na fila e imediatamente antes de enviar. Seguem valendo telefone confirmado, consentimento por tipo, sino, modelos, restrições regionais, cotas e regras próprias de cada aviso. O sino, o contato manual entre comprador e loja, a publicação e a escolha de propostas continuam com suas regras. A fila agenda avisos entre 8h e 20h no horário de Fortaleza, com até cinco mensagens por rodada, pausa entre tentativas e até três tentativas para falha definida. A seleção da rodada usa a janela. Uma rodada colhida perto das 20h pode terminar depois. O fim da participação e da rodada do piloto é conferido no envio. Resultado incerto permanece para investigação, sem repetição automática.

SAIR interrompe os três tipos existentes e mantém a confirmação diária para número reconhecido, inclusive fora do grupo, durante pausa ou após o encerramento. Uma nova habilitação só libera eventos posteriores. Um aviso enfileirado com a versão anterior da autorização é bloqueado mesmo que tenha sido gravado depois de SAIR. VOLTAR e SIM dependem de participação vigente no piloto, telefone confirmado, sino compatível e aceite anterior para o tipo que a pessoa tinha ativo antes de SAIR. Perguntas automáticas já enfileiradas perdem validade quando a participação termina ou o piloto é pausado. A pessoa pode continuar pedindo orientação por VOLTAR.

A retirada confirmada antes da última leitura no banco bloqueia a tentativa. Depois dessa leitura, a chamada à Evolution pode já estar liberada. O registro no provedor e a entrega no aparelho são verificados separadamente.

## Escolhas aprovadas no Item 15

1. **Alcance e prazo.** Recomendo restringir os três avisos em todo o serviço aos convidados de Corrente e região durante o piloto e suspender os envios ao fim dos 30 dias até nova decisão. Uma restrição só na microrregião manteria os avisos legados nas demais regiões. Uma volta expressa ao legado pode reabrir avisos futuros a contas elegíveis de qualquer região com preferência ativa.
2. **Aceites antigos sem prova.** Recomendo confirmação por tipo para entrar no piloto e prova de aceite para VOLTAR ou SIM desde a implantação da migração, inclusive no legado e fora da coorte. Quem tinha um aceite legítimo antigo sem prova e ainda está ativo em legado continua apto a receber até a transição. Se enviar SAIR ou estiver com o tipo desligado, terá de ligar esse aviso no site. A preferência e o histórico ficam guardados.

Antes do primeiro dia, a equipe confirma grupo, modelos, tratamento das mensagens na política de privacidade e coleta de agregados. O teste controlado deve provar os três avisos no aparelho, o webhook de saída, VOLTAR e a exclusão de uma conta com preferência ativa fora do grupo. Nas semanas seguintes, acompanhar fila, falhas, saídas e atividade do Radar. Fechar o período sem reabrir automaticamente o alcance. Preservar consentimentos e históricos conforme as regras de retenção. A proposta técnica para transição, opt-ins antigos e permissões está no [plano de implementação](2026-11-23-radar-piloto-fechado.md).

## Evidências

- Item 11, eventos e444 e e448. [Texto publicado no e444](</home/raniel-linux/.orca/bots/bot-mercado-regiao/scratch/item11-revisao-piloto.md>).
- Auditoria de 23/11. O Worker de produção estava na versão 22, com o código da release `4c53de6`, contendo #209 e #210, Workers Paid ativo e acesso recuperado após correção de credenciais. O ciclo completo estava instalado no Supabase e a chave geral e os três modelos estavam ativos. A amostra encontrou dois opt-ins de pedido novo, zero dos dois tipos de proposta, zero contas elegíveis e zero itens pendentes ou enviando. Havia um registro histórico de pedido novo com sucesso no provedor. Essa leitura não comprova entrega no aparelho nem delimita o público futuro. [Proposta e auditoria da fila](</home/raniel-linux/workspace/.orca-worktrees/OLAQUI/OLAQUI/mr-producao-mobile-radar/docs/qa/item-11/PILOTO-RADAR.md>) · [Relatório de produção](</home/raniel-linux/workspace/.orca-worktrees/OLAQUI/OLAQUI/mr-producao-mobile-radar/docs/qa/item-11/RELATORIO.md>).
- A worktree de planejamento parte de `f1855b3`. A comparação com `4c53de6` confirmou o mesmo SQL e os mesmos pontos de entrada do Radar listados no plano. A próxima implantação deve sair da base de release vigente para levar junto as mudanças de infraestrutura específicas da produção.
- [Revisão independente do Item 15](</home/raniel-linux/.orca/bots/bot-mercado-regiao/scratch/radar-piloto-fechado-builder-check-task_b10daf1b5b09.md>). As decisões técnicas de concorrência, validade das perguntas, privilégios e reversão estão no plano.
