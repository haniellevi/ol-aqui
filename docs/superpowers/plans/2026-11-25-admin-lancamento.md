# Admin de lançamento e preparação GA4 Implementation Plan

**Goal:** Tornar Resultados a entrada de decisão comercial, sem duplicar fontes, e preparar GA4 sem possibilidade de envio real.
**Architecture:** Reusar Resultados e suas telas especializadas. RPC administrativa agregada, sem novos dados coletados; resumo consentido existente em leitura separada. Adaptador GA4 apenas de simulação com transporte injetado e configuração sempre desligada.
**Tech Stack:** Next/React, componentes e tokens existentes, PostgreSQL e Node test.
**Spec:** Item 34 D/E, docs/MEDICAO.md e docs/INTEGRACAO-ABC-ADMIN.md.

## Restrições

Sem produção, push, dependências novas, credenciais ou eventos externos. Preservar A/B/C. Sem termos livres, códigos ou dados pessoais nos agregados/exportações. Datas Fortaleza; recortes globais explícitos. Nenhuma purga.

## Tarefas individuais

- [x] Escrever testes de agregação/autorização, períodos, bases zero e supressão; observar falha sem a RPC, criar migração 20261203035200 e verificar em PostgreSQL descartável sem rede.
- [x] Escrever testes de configuração, gate, sanitização, deduplicação e links neutros; observar falha, implementar simulação sem qualquer transporte real e ajustar gerador existente.
- [x] Escrever testes de leitura e apresentação para vazio/erro/coorte/período e acesso; observar falha, evoluir Resultados preservando histórico e telas especializadas.
- [x] Renderizar fixtures reais 320/360/390/1280, revisar visualmente, repetir regressões A/B/C e hidratação local. Não alegar sessão real.
- [x] Rodar suíte completa, banco legado/final 910 e D/E, lint, tipos, conferidor e diff check; documentar fontes, granularidade, limitações e decisões pendentes, congelar SHA limpo.

## Critérios específicos

Demanda por categoria/região só mostra células com pelo menos cinco observações em cada parcela não nula; sem texto livre. Oferta é fotografia atual. Coorte de lojas exclui criações com menos de 48h e conta oferta atual, sem prometer conversão histórica. Radar usa pedidos criados há pelo menos 24h e proposta ativa hoje, com denominador explícito. Comparação de tráfego só após corte nas duas janelas; estoque não recebe variação temporal. Falha de fonte mostra indisponibilidade.
