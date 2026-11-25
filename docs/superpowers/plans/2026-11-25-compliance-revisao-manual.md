# Liberação com revisão manual Implementation Plan

**Goal:** registrar liberação jurídica mantendo preservação operacional até decisão posterior.
**Architecture:** reutilizar `admin_gestao_eventos` como estado persistente auditável. Preservar os marcadores existentes enquanto a revisão estiver pendente, cobrindo as rotas antigas de limpeza e referências.
**Tech Stack:** PostgreSQL, Next.js, peças oficiais existentes.
**Spec:** Item 26, decisão e825 e docs/PLANO-GESTAO-EXCLUSAO.md.

## Restrições e execução

Somente local e dados sintéticos, sem publicação, descarte novo ou mudança de papéis. Execução individual autorizada no despacho; a revisão independente cabe ao coordenador.

## Review Focus

Prazo vencido, referências compartilhadas, mídia, retry e concorrência devem preservar a prova. Liberação jurídica não conclui revisão operacional.

### Banco

- [x] Teste funcional deve falhar pela ausência da RPC antes da implementação.
- [x] Criar migração 20261203034000 após conferir colisões. RPCs exigem administrador e consulta válida; bloquear item antes de gravar liberação idempotente com motivo na trilha existente.
- [x] Manter marcadores de preservação e impedir alteração comercial ou mídia de item excluído/congelado em revisão pendente.
- [x] Testar prazo vencido e vigente, item ativo, pedido com proposta, rollback e concorrência em PostgreSQL sem rede.

### Admin

- [x] Testar action antes da implementação, com fronteiras externas simuladas.
- [x] Integrar fila à consulta Compliance, com motivo, autor, instante, confirmação e feedback.
- [x] Registrar revisões adicionais sem concluir nem purgar. O destino posterior ainda requer decisão explícita de produto.
- [x] Validar em 360 px e executar lint, tipos, conferidor, banco e aplicação.

### Entrega

- [x] Documentar preflight, semântica e reversão conservadora; commit local limpo e relatório no scratch solicitado.

## Verificação e desvios

Revisão funcional posterior: corrigir episódios de retenção usando o ID existente da auditoria, permitir congelamento legítimo de ativo após liberação e conferir episódio no envio. A migração nova 20261203034100 sucede a candidata original; não altera migrações anteriores. Fortalecer motivo/instante e última revisão, separar as fixtures de concorrência e esclarecer marcadores legados e confirmação. Isolar o cenário sintético 898 em commit próprio, preservando asserções e código WhatsApp, e executar novamente a suíte integral sem omitir esse cenário.

A action foi observada falhando antes de existir; os testes de banco inicialmente revelaram incompatibilidade da fixture com a lixeira existente, corrigida no ensaio. A suíte completa foi executada e falhou em `898_radar_ciclo_whatsapp.sql`, na asserção de janela de envio; um controle com runner e migrações V26, sem esta implementação, reproduziu a mesma falha. A execução complementar das demais suítes mantém esse salto explícito no log, sem alterar o runner versionado para ignorar testes. Capturas Orca falharam por ausência de frame; Chromium local gerou as capturas sanitizadas.
