# GA4 e Meta: preparação, sem ativação

Item 36, candidata local. Não há conexão com conta, SDK, tag, GTM, pixel de imagem, preconnect, noscript ou transporte de rede. Nenhum evento foi enviado. Banco e relatórios internos continuam sendo fontes dos fatos.

## Contrato entregue

`externos.ts` define `AmbienteExterno` (local, homologacao, producao), `DestinoExterno` (ga4, meta) e configuração tipada por ambiente. `CONFIGURACOES_EXTERNAS` é versionada, congelada e mantém `solicitarHomologacao=false`, sem IDs, nos três ambientes. `habilitado` é sempre false; `DESTINOS` permanece false. Não há leitura de .env ou segredos; ambiente é explícito, nunca inferido de host/NODE_ENV.

| Estado | Significado |
| --- | --- |
| não configurado | Nenhum ID em ambiente conhecido. |
| inválido | Ambiente desconhecido ou formato conservador rejeitado. |
| desativado | Formato aceito e preparação desligada. |
| pronto para homologar | Formato aceito e preparação solicitada; envio bloqueado. |

Measurement ID GA4 aceita G- com letras maiúsculas/números; Pixel ID Meta aceita número positivo conservador. São identificadores públicos, nunca tokens ou API secrets. Sintaxe não comprova conta, propriedade, existência, domínio ou autorização. Admin é rascunho efêmero, sem gravação ou conexão; mudar ID/ambiente desliga a preparação correspondente. Não é editor da configuração ativa.

`criarEnsaioExterno` valida ocorrência, configuração atual, envelope de `eventoPermitido`, superfície externa e preferência atual, adaptando um DTO ao transporte injetado. Somente local admite transporte, sem implementação padrão. Homologação e produção negam inclusive transporte injetado. Retorno true significa término do transporte sintético sem exceção, nunca ingestão vendor. Uma função arbitrária injetada poderia fazer rede: esta API é ferramenta de ensaio, não sandbox contra código do chamador. O produto não injeta transporte e não conecta o ensaio aos coletores.

Somente `/`, `/lojas`, `/categorias` exatos são admitidos. Query/hash são recusados antes da neutralização. Conta, convite, cupom, conversa, Radar, anúncio, loja com slug, categoria dinâmica e busca ficam bloqueados. Campos extras, faixa de busca, URL/referrer, título, termos livres, IDs de usuário/produto/loja, contato, coordenadas e códigos não passam. Nenhum UTM é acrescentado; gerador e allowlist existentes permanecem intactos, catálogo de campanhas segue decisão posterior.

| Evento | GA4 | Meta | Semântica |
| --- | --- | --- | --- |
| page_view | page_view | PageView, trackSingle | Página pública neutra. |
| contact_intent | contact_intent customizado | ContactIntent, trackSingleCustom | Ação explícita de contato na superfície aprovada, sem destino ou identificação. |

Parâmetros: `route_model`, `source=interno`, `cohort=consentida_v1`. DTO inclui ID do destino, ocorrência UUID e marcador `ensaio_sem_sdk`; Meta inclui eventID igual à ocorrência. Nenhum Lead/generate_lead é mapeado, pois as superfícies aprovadas não comprovam lead qualificado; não há novo gatilho artificial. Intenção não prova conversa ou venda. Não há Purchase ou receita fictícia. Simulador GA4 legado continua isolado, sem uso externo.

Deduplicação própria por ocorrência acontece antes dos gates, inclusive em recusa. Navegação é marcada antes de tentar transporte: falha não recebe retry; rerender da mesma página não repete, A→B→A permite três tentativas. Memória por instância/destino e vida da navegação, sem persistência, filas, retries ou garantia entre abas/reloads. Não se promete deduplicação universal vendor, especialmente GA4. Integração futura deve manter uma instância por destino e usar ocorrência da ação real, nunca ID de pessoa.

GA4 exige estatística; Meta exige marketing independentemente. Preferência é função de leitura atual por tentativa, com falha fechada. Futuro chamador deve usar o gate existente, nunca snapshot congelado. Retirada interrompe novos despachos; transporte já aceito pode terminar. Recusas são consumidas, sem retroenvio após aceite; instância não é apagada ao retirar/reaceitar. Não existe fila SDK.

## Operação futura, com nova autorização

1. Obter do responsável propriedade GA4/stream web de teste próprios, Measurement ID, domínio/origem de teste e acesso mínimo ao DebugView. Para Meta, obter Business Portfolio/dataset com Pixel ID próprio de teste e acesso ao Events Manager/Test Events. Confirmar propriedade/permissões nas contas, separadamente do formato. Não confundir Measurement ID com Property ID nem Pixel ID com token CAPI. Definir política publicada, responsáveis, retenção e exclusão antes da ativação. Não usar IDs reais em fixtures.
2. Configurar GA4 em modo básico, bloqueando tags até estatística aceita. analytics_storage acompanha estatística; ad_storage, ad_user_data e ad_personalization ficam denied nesta frente, sem publicidade Google. Desligar enhanced measurement no stream, incluindo histórico de navegação, busca, cliques externos e formulários; usar send_page_view=false, allow_google_signals=false e allow_ad_personalization_signals=false. Sem User-ID, user-provided data ou coleta publicitária. Revisar snippet e enhanced measurement separadamente. Não habilitar modo avançado com pings sem consentimento.
3. Meta: desligar automatic advanced matching/eventos automáticos no Events Manager, remover regras anteriores de Event Setup Tool, sem matching manual, parceiro, gateway ou CAPI. Documentação oficial instrui `fbq('set', 'autoConfig', false, pixelId)` antes de init para modo manual. Destino específico trackSingle/trackSingleCustom e eventID da ocorrência, se futura implementação for aprovada. grant/revoke não substitui bloqueio do carregamento antes da escolha. Não copiar PageView automático/noscript do snippet padrão.
4. Implementar transporte real apenas em revisão separada após provar controle de payloads implícitos. Converter DTO para gtag/fbq não garante privacidade: SDKs leem URL, referrer, título/metadados, cookies e histórico fora do envelope, e configuração vendor pode reativar automação. Uma tag pública pode continuar viva ao navegar para conta ou anúncio pessoal. Exigir origem isolada de teste, URLs/referrers limpos, ausência de dados pessoais no DOM e corte do ciclo de vida antes da rota privada. Não reescrever URL de usuário ou contornar privacidade para viabilizar coleta. Sem garantia demonstrável, manter produção inativa. CAPI e Ads cost API estão fora desta onda.
5. Somente no futuro ambiente autorizado: usar Tag Assistant e DebugView do stream correto, debug apenas em teste, inspecionando rede além do painel. Meta usa Test Events do Pixel de teste com nomes/parâmetros/eventID conferidos. Exercitar ausência, recusa, só estatística, só marketing, ambos, retirada durante requisição, reaceite sem retroenvio, rerender, A→B→A, storage indisponível e falha sem retry. Sem dados pessoais ou compra fictícia; eventos sintéticos devem ser identificados como ensaio no ambiente de teste, sem campanha. Visualização no painel não comprova ausência de dados implícitos.
6. Registrar zero chamadas/preconnect/noscript antes da escolha, consentimentos independentes, interrupção após retirada, rotas proibidas durante toda a sessão e payloads reais completos, inclusive headers/requisições de configuração. Esta versão não tem botão de ativação: nova autorização, revisão e evidências são necessárias antes de alterar DESTINOS ou trava de ambiente. Reversão mantém flags false, impede carregamento/despachos e descarta instâncias com segurança; requisições já aceitas podem terminar. Não apagar fatos internos nem reinterpretar séries como vendas.

## Fontes oficiais consultadas em 25/11/2026

Google: [modo básico](https://developers.google.com/tag-platform/security/concepts/consent-mode), [consentimento](https://developers.google.com/tag-platform/security/guides/consent), [pageviews manuais](https://developers.google.com/analytics/devguides/collection/ga4/views), [configuração](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [privacidade](https://developers.google.com/tag-platform/security/guides/privacy). Context7 foi consultado para Tag Platform.

Meta: [modo manual e destinos individuais](https://developers.facebook.com/documentation/meta-pixel/advanced), [consentimento e dados recebidos](https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr). A documentação explicita headers, localização/referrer da página e informações de botões, fundamento para manter SDK e produção inativos. O [template oficial](https://github.com/meta/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl) contém opções automáticas/CAPI que exigem revisão; não foi instalado.

Não há prova nesta entrega de conta real, DebugView, Tag Assistant, Test Events, configuração vendor, coleta externa ou campanha.
