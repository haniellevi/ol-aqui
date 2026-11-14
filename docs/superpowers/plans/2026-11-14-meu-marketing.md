# Meu Marketing Implementation Plan

**Goal:** Publicar Meu Marketing com recomendações para criativos, artes baixáveis e oportunidades regionais que iniciam cadastro.

**Architecture:** RPC autenticada com agregados de 30 dias, página server-side e imagens privadas via next/og. Reutilizar painel, seletor de loja e criação idempotente de rascunho.

**Tech Stack:** Next.js 15, React 19, Supabase/PostgreSQL e testes node:test existentes.

**Spec:** docs/superpowers/specs/2026-11-14-meu-marketing-design.md

## Global Constraints

- Só a loja autorizada e selecionada. Nenhuma identidade de comprador.
- Artes com foto real, sem custo de IA ou novo sistema de créditos.
- As sugestões preparam rascunhos para revisão.

## Review Focus

- Ajudante revogado, loja trocada e outra conta não podem obter consultas ou artes.
- Contagem de buscas não representa usuários únicos.
- Demanda de outra região/nicho e produto já ativo não viram sugestão.
- Fotos externas, redirecionamentos e URLs privadas não podem induzir SSRF.
- Falha de RPC, base vazia e lojas sem nicho precisam ser distinguidas.

### Task 1: Consulta regional e ranking

- [ ] Implementar meu_marketing_loja(p_vitrine uuid) com autorização, ranking e oportunidades.
- [ ] Testar com PostgreSQL isolado incluindo isolamento e entradas antigas sem categoria.

### Task 2: Tela, navegação e cadastro

- [ ] Criar tipos e leitura validada em src/lib/dados/marketing-loja.ts.
- [ ] Integrar Meu Marketing à Minha loja e à criação de rascunho com sugestão.
- [ ] Testar estados vazios/falhas e manutenção da loja selecionada.

### Task 3: Artes

- [ ] Implementar download privado de feed/stories com foto confiável e legenda copiável.
- [ ] Testar acesso, formatos, fotos ausentes e falhas.

### Task 4: Entrega

- [ ] Revisão independente, testes completos e build.
- [ ] Aplicar migração, publicar PR, integrar após checks e verificar produção.
