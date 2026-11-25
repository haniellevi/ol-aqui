# Integração A/B/C Implementation Plan

> Execução individual autorizada no despacho Item 34. Sem delegação ou nova aprovação.

**Goal:** Congelar candidata local com A, B e C, com procedência e validação conjunta reproduzível.

**Architecture:** A permanece como ancestral. Cherry-pick com `-x` dos dois commits B e dois C, todos sobre V27, sem mesclar novamente A. Corrigir somente regressões demonstradas por testes.

**Tech Stack:** aplicação existente, Node test, PostgreSQL Docker isolado e fixtures React locais.

**Spec:** despacho Item 34, docs/MEDICAO.md, docs/ativacao-lojistas.md após integração.

## Global Constraints

Sem produção, push, PR, deploy, serviços remotos ou novas dependências. Nenhum rastreio em conta/convite/cupom/conversa. GA4/Meta desligados. Preservar componentes, tokens, fluxo C e gates A.

## Review Focus

Consentimento sem escolha deve continuar acessível junto da barra comercial. Retirada deve bloquear navegação subsequente. Desktop deve hidratar detalhes. Cupom apenas preenche. Vitrine deve manter duas ofertas completas e uma barra mobile.

### Task 1: Procedência e integração

- [x] Registrar SHAs integrais, merge-base e arquivos sobrepostos antes do cherry-pick.
- [x] Executar suíte de A como referência; aplicar B e C em ordem, com `-x`.
- [x] Ler contratos integrados e conferir que coletores e fatos de negócio não se duplicaram.

### Task 2: Validação conjunta e ajustes comprovados

- [x] Executar suíte completa, lint, typecheck, conferidor e diff check.
- [x] Executar banco completo no Docker sem rede e contrato final 910 sobre todas as migrações.
- [x] Reutilizar fixtures reais B/C e compor consentimento A, medindo 320/360/390/1280, escolha, retirada e navegação local.
- [x] Para qualquer regressão: registrar falha, escrever teste que a demonstra, corrigir mínimo e repetir verificações afetadas.

### Task 3: Congelamento

- [x] Registrar inventário de arquivos/migrações, origem/destino de commits, evidências, interfaces Admin D/E e limites reais no relatório externo solicitado.
- [x] Commitar somente integração/ajustes e registrar SHA final com árvore limpa.
