# Kit comercial e produtividade Implementation Plan

**Goal:** oferecer kit manual da loja, busca no catálogo variado, oferta real no diretório e criação revisável em série.
**Architecture:** preservar componentes oficiais e autorização existente. Novas leituras SQL aditivas para filtrar antes da paginação; kit usa identidade da loja atual, QR local e impressão do navegador.
**Tech Stack:** Next/React/TypeScript, Postgres, qrcode já instalado.
**Spec:** despacho Item 35 e scratch/item30-plano-integrado.md.

## Constraints
Sem rede externa, métricas/consentimento/admin intocados; nenhuma publicação ou envio. Tokens e regras de plano atuais.
## Review Focus
Nome/logo ausentes; catálogo paginado; anúncio de terceiro; plano sem vaga; falha ao gerar QR.

### 1. Kit (prioridade)
- [x] RED em tests/kit-comercial.test.cjs: link canônico, fallback de nome/logo, QR decodificável e arte sem telefone.
- [x] Implementar src/components/marketing/kit-loja.tsx e integrar antes das recomendações.
- [x] GREEN; capturar preview sintético com identidade e sem identidade.
### 2. Catálogo
- [x] RED: busca com acentos e sem resultados; filtro antes de paginação; contagem pública e oferta ordenada.
- [x] Migração 35300 aditiva e UI pública com CampoBusca só >=8 itens, saída e chips preservados.
- [x] GREEN e banco isolado.
### 3. Cadastro em série
- [x] RED: novo rascunho somente para anúncio próprio, sem IDs/fotos/localização/status copiados e plano preservado.
- [x] Reutilizar novoRascunho e revisão existente, ação explícita no editor.
- [x] GREEN; manter prévia 4:3 e cabeçalho atual.
### 4. Indicadores e verificação
- [x] Reutilizar indicadores atuais, esclarecer séries/consentimento e venda declarada.
- [x] Suíte completa, lint, tipos, design checker e detector; fixtures 320/360/390/1280, pares e medidas.
- [x] Commit local e relatório com limites e pontos de integração.
