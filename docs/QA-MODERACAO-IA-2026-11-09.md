# Validação da moderação por IA

Data: 9/11/2026, horário de Brasília.

## Antes da publicação

- 196 testes Node passaram. A suíte específica foi repetida após o ajuste final do parser, com cinco testes aprovados.
- Typecheck passou; lint sem erros, mantendo dez avisos preexistentes nos componentes de demonstração.
- A suíte de banco isolado passou, incluindo as novas verificações de reserva, idempotência, versão alterada, congelamento, denúncia, contato revogado, custo ausente, orçamento, sigilo e quatro workers concorrentes disputando orçamento para uma única chamada.
- A Vercel compilou a prévia `a7f81f5060093953f7bf4268f41287b827ebc05a`, deployment `dpl_HFXf7WXF9E4uniuvetX3g7NMBogN`.
- As migrações foram aplicadas com a automação desligada. O agendamento ficou suspenso durante a chamada controlada à prévia.

## Provedor real

A chamada autenticada ao endpoint da prévia executou uma análise do anúncio fictício já retido. Resultado HTTP 200, uma análise concluída, estado `manual`; o anúncio continuou `em_analise` e não foi publicado. Motivo registrado: “Anúncio identificado como teste, sem publicação automática.” A regra local conserva esse resultado mesmo que o modelo tente aprovar um anúncio identificado como teste.

O provedor retornou JSON estruturado válido e custo conhecido: 1.501 tokens de entrada, 57 de saída, custo registrado de 0,3804 centavo de real, usando a cotação configurada. Esse custo refere-se apenas a esta chamada, não representa uma estimativa universal por anúncio. Não houve erro registrado no livro-caixa.

A mesma rota sem o token exclusivo retornou HTTP 401. O token não está no repositório nem neste relatório.

Esta prova verifica a integração real, leitura de foto, formato de resposta, orçamento e retenção do teste. As aprovações, corridas e falhas foram exercitadas com respostas controladas nos testes automatizados. Não equivale a uma medição estatística da precisão do modelo em milhares de anúncios.

## Operação após o deploy

Ativar `moderacao.ia_ativa` e o job `olaki-moderacao-ia` somente depois de confirmar o deployment de produção. Conferir a execução agendada e ausência de nova cobrança para uma versão já analisada. Em falha, desligar a configuração e manter a fila manual. O funcionamento e os limites estão em `MODERACAO-IA.md`.
