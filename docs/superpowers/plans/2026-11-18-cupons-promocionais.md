# Cupons promocionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Permitir que o master configure os recursos do plano Promocional e crie cupons com duração em dias a partir da ativação para qualquer conta.

**Architecture:** Reutilizar planos, campanhas e atribuições existentes. O benefício é vinculado ao dono da conta e consultado pelo cálculo central de plano efetivo, com RPC própria para apresentação de contas sem loja. O plano Promocional não é vendido e não gera pagamentos.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Postgres e os componentes existentes.

**Spec:** docs/superpowers/specs/2026-11-18-contas-promocionais-design.md

## Global Constraints

- Usar DESIGN.md, docs/USABILIDADE.md e docs/MARCA.md.
- Reutilizar os recursos já controlados por plano. Os direitos ficam protegidos no banco.
- Somente master altera plano Promocional e campanhas.
- Qualquer conta autenticada pode ativar, mesmo sem vitrine.
- A duração começa na ativação. Repetir um código não reinicia nem duplica o período.
- Preservar datas de concessões existentes, produtos e pagamentos.
- Não criar cobranças para a promoção.

## Review Focus

- Conta sem loja pode ativar e levar o acesso para uma vitrine criada depois.
- Ajuda em loja alheia não usa o benefício da conta do ajudante.
- Alteração de duração não recalcula acessos já ativados.
- Código desativado e prazo para novas ativações não encerram concessões anteriores.
- Chamadas concorrentes e permissões de administrador comum não burlam a proteção.

### Task 1: Direitos e cupons no banco

**Files:** nova migração supabase/migrations/20261202130000_cupons_promocionais.sql, novo teste supabase/testes/895_cupons_promocionais.sql, integração no runner supabase/testes/automatizados.py.

**Interfaces:** adicionar `duracao_dias` a voucher_campanhas; `meu_promocional()` retorna codigo, ativado_em, vence_em; `meus_vouchers()` conserva o formato atual e ganha duração; `resgatar_voucher(text)` retorna vencimento; criação/admin configuração recebem duração e prazo opcional. Manter wrappers das assinaturas antigas com proteção master. O plano `promocional` usa as colunas de direitos de `planos` e o cálculo de `plano_efetivo` consulta os períodos da conta.

- [x] Escrever testes de ativação, permissões e duração com casos do Review Focus.
- [x] Implementar migração e conferir falha antes de aplicá-la e sucesso depois, no banco local isolado.
- [x] Verificar concorrência, vencimento e direitos de publicação/Radar/vitrine.
- [x] Commit do núcleo e testes.

### Task 2: Administração e uso do cupom

**Files:** src/app/admin/planos/{page.tsx,vouchers.tsx,voucher-actions.ts,form-plano.tsx,actions.ts}; src/app/(conta)/minha-conta/plano/{page.tsx,voucher.tsx,voucher-actions.ts}; src/components/conta/resumo-plano.ts; tipos e leituras de conta necessárias; página pública de planos; testes correspondentes.

**Interfaces:** consumir RPCs da Task 1. Formulário de cupom recebe código, duracao_dias, prazo opcional e ativo. Configuração promocional reutiliza recursos de FormPlano com caixas e limites, sem expor o plano para pagamento. Meu plano usa `meu_promocional` mesmo sem vitrine.

- [x] Testar normalização, duração, mensagens e proteção master nas ações.
- [x] Implementar formulários e apresentação dos prazos, inclusive sem loja.
- [x] Remover a promessa fixa de três meses das novas ativações e evitar oferecer o plano Promocional como compra.
- [x] Rodar testes, lint, typecheck e design:conferir.
- [x] Commit da interface.

### Task 3: Revisão, publicação e teste normal

- [ ] Fazer revisão independente de segurança e comportamento no diff completo.
- [ ] Aplicar a migração autorizada e publicar a versão verificada.
- [ ] Criar cupom temporário pelo admin, ativar por uma conta de teste, validar recursos/datas e limpar os registros.
- [ ] Informar resultado e qualquer limite concreto de validação.
