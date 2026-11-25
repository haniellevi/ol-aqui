# Correções após revisão do Item 34

Execução individual, com receiving-code-review, TDD e verification-before-completion.

- [x] Reproduzir em SQL UTC o limite civil de busca e resumo direto, controlar somente o relógio no teste e corrigir a candidata 35000 ainda não publicada. Preservar todas as migrações V27.
- [x] Montar anúncio/loja antes do coletor global, exercitando as ações reais com fronteiras locais; corrigir identidade consentida síncrona antes do despacho. Sem identidade antes do aceite, retroenvio, fila ou repetição automática.
- [x] Testar expiração de 30 minutos sem pageview, leitura longa, revisita, falha e cópia do armazenamento; rotular fluxo de pageviews compartilhável entre abas, sem alegar isolamento.
- [x] Explicitar cobertura textual/Referer, atribuição congelada, séries mistas/cascata e marco SQL distinto do rollout real na UI e contratos. Rollout não confirmado impede comparação de tráfego.
- [x] Repetir suíte completa, banco legado/final 910/911, fixture hidratada com ações locais, consentimento e geometria B; lint/tipos/conferidor/diff. Congelar SHA e relatório, incluindo rollback conservador e limites reais.

Sem ambiente remoto, dados reais, credenciais, tags/eventos externos, push ou publicação. Não reclassificar nem apagar histórico.
