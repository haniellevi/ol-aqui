# Resultados para lançamento, MVP D/E

Entrada existente `/admin`, só administrador. Layout/menu, Produtos, Relatórios, Visitas, CRM e tarefas Hoje foram reutilizados. Endereços antigos com período mensal/anual/região continuam no histórico; `/admin?visao=historico` abre o mesmo componente anterior. Não há novo painel paralelo, acesso de equipe ou exportação pessoal.

## Fontes e leitura

RPC `admin_lancamento(p_de date,p_ate date) -> jsonb`: `e_admin()` obrigatório, EXECUTE revogado de PUBLIC/anon, concedido a authenticated. Função estável, search_path vazio, timezone Fortaleza; sem tabela nova ou escrita. Chama `admin_medicao_resumo` da Onda A com a mesma janela civil. Máximo 366 dias entre datas (367 dias inclusivos), igual ao limite existente do parser. Fonte indisponível/malformada resulta em aviso, nunca zero. Período anterior falhando não esconde o atual.

| Indicador | Fonte e granularidade | Janela / limitação |
|---|---|---|
| Páginas, navegadores, sessões | `admin_medicao_resumo`, visitas consentida_v1 | Intervalo civil Fortaleza, fim exclusivo; navegador não é pessoa, sessão é por aba. |
| Origem de página | visitas consentida_v1, allowlist de origem | Mesmo período do resumo; desconhecida vira direto, sem nomes livres. Sem campanha atribuída. |
| Lojas ativas / sem anúncio no ar | vitrines tipo loja ativas, existência de anúncio ativo | Fotografia atual global, sem variação temporal. Acesso à ajuda via tarefas Hoje, que têm critérios configuráveis próprios. |
| Anúncios no ar e oferta por categoria/cidade | anúncios ativos em vitrines ativas, categorias/cidades do catálogo | Fotografia atual. Até 20 combinações de menor oferta; cidades fora do catálogo agrupadas sem expor texto. Categoria com zero anúncio não aparece. |
| Lojas com oferta na coorte | lojas ativas hoje, criadas no período há pelo menos 48h | Numerador: existência de anúncio ativo hoje; denominador: lojas da mesma coorte elegível. Não é primeira publicação em 48h; exclusões/suspensões alteram a população observável. |
| Radar maduro com proposta ativa | pedidos criados no período há pelo menos 24h, status aberto/atendido/encerrado | Numerador: pedido com pelo menos uma proposta ativa hoje. Não mede primeira resposta em 24h, nem inclui análise/recusa. Retiradas/ocultas não contam como ativas. |
| Publicados | linhas sobreviventes de anúncios por publicado_em | Timestamp disponível, sem reconstruir publicações apagadas ou histórico de republicações. |
| Contatos observados | soma cliques_whatsapp em anuncios_numeros_dia | Somente anúncios, série existente, sem misturar lojas. Não é conversa/venda; sem comparação de série potencialmente mista. |
| Vendas declaradas | anúncios por vendido_em com vendido_pelo_olaki=true | Declaração do vendedor, sem prova financeira. Não há divisão por cliques ou taxa de venda nesta visão. |
| Resgates | voucher_atribuicoes por resgatado_em | Fatos persistidos, sem evento de clique ou código exposto. |
| Recebimentos confirmados | recebimentos_olaki existente, status pago/ambiente producao | Receita da empresa pela data do pagamento; sandbox e ambiente desconhecido fora. Histórico financeiro permite conferir os desconhecidos. Não é receita das lojas. |
| Procura sem resultado | buscas_faixas_dia consentida_v1, categoria/região | Soma das faixas válidas. Cada grupo exige >=5 sem resultado e >=5 com resultado, ou nenhuma com resultado. Até 20 grupos por volume sem resultado, sem texto livre. |
| Frescor | gerado_em da consulta e máximo global de visita consentida | Não é prova de ingestão saudável ou ausência de visitantes. |

Para demanda, a supressão é uma precaução de apresentação, não uma promessa de anonimização contra consultas repetidas. Não expõe contagem de grupos suprimidos, termos ou identidades. Não calcular taxa global da lista truncada. Sem linhas pode significar ausência ou supressão; base zero de coorte significa sem denominador e não recebe taxa.

Comparação somente entre períodos de mesma duração já encerrados. Dia atual ou futuro deixa a comparação indisponível. Tráfego também exige duas janelas integralmente posteriores ao dia de corte de metricas_marcos e a mesma marca. Não somar coortes ou concatenar legado. Estoque atual não recebe variação. As contagens não são combinadas em um funil de sessões nem uma conversão comercial não observável.

Sem histórico adequado, estão indisponíveis: primeira publicação em 48h, tempo até primeira proposta, funil por sessão entre superfícies, retenção, latência/ingestão e custos de campanha. O MVP usa ações/fatos observáveis e caminhos existentes de aprofundamento; não cria rastreador para preencher lacunas.

## Preparação GA4, sem ativação

`configuracaoGa4(id,ambiente)` valida sintaxe conservadora G- com letras maiúsculas/números e ambiente conhecido, retornando sempre `habilitado=false`. Isso não comprova existência ou propriedade do ID. Interface é rascunho local efêmero, sem gravação, credencial, tag, GTM ou transporte padrão; não é uma configuração ativa por ambiente. Meta aparece como módulo futuro desligado. `DESTINOS` de A continua falso.

`criarSimuladorGa4(transporteSintetico)` só admite ambiente `simulacao`, estatística aceita, ID sintaticamente válido e ocorrência UUID ainda não tentada. Revalida envelope estrito de A e neutraliza rota. Deduplicação é em memória por instância, sem fila, retry ou persistência; mesmo transporte que lança exceção não recebe segunda tentativa da ocorrência. Não é integrado aos coletores e não possui implementação fetch/gtag/dataLayer. Em homologação/produção não chama nem transporte injetado.

Modelo de simulação: page_view usa nome conhecido do GA4 com route_model neutro, source e cohort; search_completed/store_view/contact_intent/catalog_share são eventos customizados. view_item e view_item_list internos viram catalog_item_view/catalog_list_view customizados, pois não temos o payload de ecommerce obrigatório apropriado. Faixa de resultados é result_band; nenhum search_term, item ID, slug, URL bruta, usuário, cupom ou contato é enviado. Não se promete compatibilidade com relatórios de ecommerce reais. Referências oficiais: [eventos recomendados](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) e [consentimento](https://developers.google.com/tag-platform/security/guides/consent).

Gerador existente de link/QR usa `linkComOrigem` com HTTPS, destinos fechados e código ativo também presente na allowlist de A. Campo livre de campanha foi retirado, sem apagar histórico. Campanha/mídia/conteúdo/termo livres não têm atribuição. QR continua gerado no navegador pela dependência já existente. Origens personalizadas fora da allowlist permanecem sem link atribuído até aprovação de catálogo.

## Decisões ainda necessárias

Propriedade/stream e domínio reais, IDs de marketing, consentimento e política ativa, retenção/rotina de limpeza, catálogo de campanhas e eventual integração externa exigem decisão/homologação posterior. Nenhum evento ou script externo foi habilitado. Banco permanece a fonte dos fatos independentemente de GA4/Meta. Validação de sessão Next/Clerk real, Android/TalkBack e piloto continuam fora do ensaio sintético.
