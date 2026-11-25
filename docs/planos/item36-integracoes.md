# Item 36: preparação local GA4 e Meta

Objetivo: validar configurações e ensaiar adaptadores externos com transporte injetado, sem rede ou ativação real.

Arquitetura: conservar DESTINOS desligado e o simulador legado; acrescentar configuração pura por ambiente, envelope externo restrito e despachante somente de ensaio. Admin mantém rascunho efêmero, sem persistência ou acesso a segredos.

Restrições: sem SDK, scripts, banco, propriedades reais, eventos externos, campanha, tokens ou alterações de superfícies da Onda F. Sintaxe não comprova conta. Somente /, /lojas e /categorias, sem query/hash; intenções não viram Lead ou venda.

- [x] Configuração em src/lib/metricas/externos.ts: testes RED/GREEN em tests/metricas-externos.test.cjs para ausência, formato, ambiente, flags e estados. `configuracaoExterna(destino, ambiente, entrada)` retorna ID validado, status e habilitado=false; `CONFIGURACOES_EXTERNAS` define os três ambientes desligados.
- [x] Adaptadores e ensaio no mesmo módulo: testes RED/GREEN para consentimentos independentes, retirada, ocorrência e navegação, bloqueio de rota/payload, falha sem retry, produção inativa. `criarEnsaioExterno({configuracao,preferencia,transporte})` lê gates na tentativa, sanitiza com eventoPermitido e despacha o DTO específico; não possui transporte padrão. Nenhum evento recusado é recuperado após aceite.
- [x] Admin em src/app/admin/preparacao-ga4.tsx: acrescentar Pixel ID, ambiente local e estados dos dois destinos. Testar render e interação hidratada com fixtures locais em 320/360/390/1280, incluindo fonte do painel indisponível. Preservar peças existentes e régua.
- [x] Documentar operação futura em docs/INTEGRACOES-MEDICAO.md e atualizar MEDICAO/ADMIN-LANCAMENTO. Rodar npm test, lint, typecheck, design:conferir, detector e git diff --check; registrar evidências e SHA limpo no relatório externo ao repositório, commit local sem publicação.

Verificação: testes com IDs e ocorrências fictícios, transporte em memória; nenhuma credencial ou dado real. Roteiro futuro exige domínio/rotas limpas, propriedade/dataset autorizados, consentimento básico, automação desligada, inspeção de payload e homologação antes de implementar transporte real.
