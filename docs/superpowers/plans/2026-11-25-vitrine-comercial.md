# Vitrine comercial Implementation Plan

**Goal:** Dois produtos completos na primeira dobra 360×680, primeiro card até 290 px, desktop até 340 px.
**Architecture:** Manter página pública, dados, cards e contatos existentes. Compactar apenas a apresentação da vitrine e isolar CSS pela presença da barra comercial.
**Tech Stack:** Next/React, Tailwind e componentes oficiais existentes.
**Spec:** scratch/item30-plano-integrado.md e Item 32.

## Restrições e revisão
Sem publicação, serviço externo, dados reais, migração ou mudança de métricas. Preservar prévia, paginação, favoritos e URL compartilhável. Verificar nome longo, ausência de contatos, erro, vazio, carregamento e navegação por teclado. Execução individual já determinada pelo despacho.

## Tarefa 1: Topo e navegação
- [x] Acrescentar regressões em tests/loja.test.cjs para saída de descoberta, informações progressivas e isolamento da barra.
- [x] Executar testes e observar falha.
- [x] Compactar page.tsx: retorno na faixa, identidade legível, seções e ordenação em uma faixa rolável, compartilhamento nos detalhes, sem alterar dados ou filtros.
- [x] Adicionar modo compacto optativo em BannerLoja, preservando todas as prévias existentes.
- [x] Isolar CSS da barra comercial e criar loading.tsx com Skeleton.
- [x] Executar regressões e commit.

## Tarefa 2: Prova comparável
- [x] Reusar render-v27.cjs e fixture sintética local, capturar antes/depois em Chromium sob mesma fonte, viewport e dados.
- [x] Medir 320/360/390/1280, primeira oferta, barras, overflow e chips; verificar detalhes, foco e saídas.
- [x] Executar lint, typecheck, design:conferir e npm test; registrar limitações e evidências no relatório Item 32.
- [x] Commit final limpo.

## Evidência final

1.046 testes passaram; lint/tipos passaram; conferidor sem erros (33 avisos antigos). Primeiro card 261 px em 360×680, nome longo 283 px, desktop 280 px. Relatório e 36 cenários em `/home/raniel-linux/.orca/bots/bot-mercado-regiao/scratch/item32-vitrine-relatorio.md`. Revisão individual, conforme despacho sem auxiliares; validação física e integração autenticada permanecem fora da comprovação local.
