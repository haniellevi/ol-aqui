# Etapa 4 · Radar completo (nota para o desenvolvedor)

Comprador pede → lojas propõem → comprador escolhe. Base: TELAS-E-FLUXOS.md (T26–T30, F4, F5),
PRODUTO-CONTAS-ANUNCIOS-ROBO.md (Radar) e as decisões do Raniel: teste grátis tem 3 propostas,
comprador escolhe "WhatsApp na hora" ou "propostas com prazo", e só pede com o celular confirmado por código.

Migração: `supabase/migrations/20261108020000_radar_completo.sql` · Testes: `supabase/testes/90_radar_completo.sql`
Tipos: `src/lib/tipos-radar.ts` · Leituras: `src/lib/dados/radar.ts` · Ações: `src/app/radar/actions.ts`

## 1. Banco

### Tabelas
| Tabela | O que muda |
|---|---|
| `radar_pedidos` | novas colunas: `categoria_id` (categoria da tabela; o enum antigo `categoria` passa a ser preenchido pelo banco a partir dela), `preco_min_centavos`, `prazo_horas` (opção escolhida), `origem` (`site`/`aki`), `fechado_em`, `fechado_motivo` (`resolvido`, `cancelado`, `prazo`, `moderacao`), `moderado_motivo` |
| `radar_propostas` | novas colunas: `status` (`ativa`/`oculta`), `moderado_motivo`, `atualizado_em`, `escolhida_em` |
| `notificacoes` (nova) | aviso dentro do app: `usuario_id`, `tipo`, `titulo`, `texto`, `link` (sempre caminho interno), `canal` (`app` hoje; `whatsapp`/`push`/`email` ficam para a fase 2), `chave` (evita aviso repetido), `lida_em`, `enviada_em`, `dados` |

RLS: `notificacoes` só a dona lê e apaga; ninguém insere pela API (só funções SECURITY DEFINER).
`radar_propostas` continua sem INSERT/UPDATE pela API; o comprador deixa de ver proposta `oculta`.

### Funções (todas com `search_path = public, extensions`)
| Função | Quem chama | O que faz |
|---|---|---|
| `criar_pedido_radar(...)` | comprador (site e Aki) | confere login, celular confirmado (`whatsapp_confirmado()`), título, modo, prazo da lista da configuração e cria o pedido |
| gatilho `radar_1_validar` | todo INSERT/UPDATE de pedido | região = a do perfil, cidade tem que ser da região (grava o nome certo), categoria ativa, faixa de preço coerente, limite por dia e de pedidos abertos, prazo nunca maior que a maior opção |
| gatilho `proteger_radar_v4` | UPDATE de pedido | o comprador não muda prazo, validade, contador nem reabre pedido fechado |
| `fechar_pedido_radar(id, motivo)` | comprador | "Já resolvi" (`atendido`) ou "Cancelar" (`encerrado`) |
| `propor_radar(...)` | loja | manda ou edita a proposta (anúncio dela no ar ou foto + preço + mensagem); WhatsApp do comprador só no modo "Podem me chamar" |
| `revelar_contato_radar(...)` | (antigo) | continua igual por fora; por dentro usa a mesma regra de `propor_radar` |
| `escolher_proposta(id)` | comprador | marca a escolhida, avisa a loja e devolve o WhatsApp da loja (o link wa.me é montado no servidor) |
| `radar_pedido(id)` | logado | um pedido com o mesmo bloqueio do feed (detalhes e nome só com plano com Radar ou para o próprio comprador) |
| `propostas_do_pedido(id)` | comprador/admin | lista para comparar (loja, selo, preço, foto ou anúncio, mensagem) — sem contato |
| `meus_pedidos_radar()`, `minhas_propostas_radar()` | comprador / loja | abas da tela /radar |
| `marcar_notificacoes_lidas(ids)` | dona | marca como lidas (todas quando `ids` é nulo) |
| `moderar_radar(tipo, id, acao, motivo)` | admin | ocultar / devolver / remover pedido ou proposta, com motivo; tudo cai em `logs_atividade` |
| `radar_avisar_prazos()` | rotina | aviso "prazo acabou" com o resumo ("6 propostas, a menor R$ 1.850") e encerra pedidos vencidos |
| `expirar_rotina()` | pg_cron | a versão que existia é renomeada para `expirar_rotina_base()`; a nova chama `radar_avisar_prazos()` e depois a base (assim não apaga o que outra etapa pôs na rotina) |
| `pode_enviar_foto(nome)` | Storage | ganha a pasta `<usuario>/radar-<pedido>/<arquivo>` (loja com Radar, pedido aberto de outra pessoa, da mesma região, até `radar.fotos_max_pasta` arquivos) |

Gatilhos de aviso: proposta nova → comprador; pedido novo (ou liberado pela moderação) → lojas da região
com anúncio no ar da mesma categoria-mãe (sem categoria: todas as lojas da região), com teto por loja por dia;
proposta escolhida → loja; prazo acabou → comprador (pela rotina).

### Configurações novas (grupo "Radar de Negócios" no painel; toda mudança vai para o log)
| Chave | Padrão | Uso |
|---|---|---|
| `radar.pedidos_por_dia` | 10 | pedidos que um comprador pode fazer por dia |
| `radar.pedidos_abertos_max` | 10 | pedidos abertos (ou em análise) ao mesmo tempo |
| `radar.prazos_horas` | (já existia) `[24, 72, 168]` | opções do modo "propostas aqui até" |
| `radar.proposta_mensagem_max` | 300 | letras da mensagem da loja |
| `radar.fotos_max_pasta` | 5 | fotos que uma loja guarda por pedido |
| `radar.avisos_ligados` | os 4 tipos | desligar um aviso é tirar o nome da lista |
| `radar.avisos_lojas_por_dia` | 10 | teto de avisos "pedido novo" por loja por dia |
| `radar.avisos_lojas_max_por_pedido` | 200 | teto de lojas avisadas por pedido |
| `radar.aviso.<tipo>.titulo` / `.texto` | textos simples | textos dos avisos, com `{pedido}`, `{loja}`, `{cidade}`, `{preco}`, `{total}`, `{menor}` |

Teste grátis = 3 propostas: vem de `planos.propostas_radar_mes` do plano de teste (já existia). Preço dos
planos mostrados para quem não tem Radar: tabela `planos` (`acesso_radar = true`).

## 2. Telas
| Rota | Quem | O que tem |
|---|---|---|
| `/radar` | todos | visitante: explicação em 3 passos + "Pedir no Radar". Logado: abas **Meus pedidos** (comprador), **Pedidos na região** e **Minhas propostas** (loja). A aba de região é a tela que o Raniel redesenhou (mesmo visual) |
| `/radar/pedir` | logado | o que procura (vem de `?q=` da busca vazia), categoria (opcional), faixa de preço, cidade da região, "Podem me chamar no WhatsApp" ou "Quero receber propostas aqui até <data>" com os prazos do painel. Sem celular confirmado: cartão "Confirme seu celular" (o Clerk é a fonte; o servidor sincroniza antes de conferir) |
| `/radar/pedido/[id]` | dono do pedido | "Pedido no ar!" logo depois de criar, propostas para comparar (menor preço / mais novas), "Chamar no WhatsApp" por proposta, "Já resolvi", "Cancelar pedido", resumo quando o prazo acaba |
| `/radar/[id]` | loja | o pedido + folha **Propor** (anúncio no ar ou foto, preço, mensagem). Sem plano/propostas: planos da tabela e link `LINK_PLANOS?origem=radar` |
| `/minha-conta/notificacoes` | logado | avisos do app; número de não lidas em Minha conta |
| `/admin/moderacao` | admin | seção "Radar" com pedidos e propostas recentes: ocultar, devolver, remover, sempre com motivo |
| `/admin` | admin | número novo "Pedidos com proposta (mês)" |

## 3. Como cada regra é garantida
- **Celular confirmado:** `criar_pedido_radar` exige `whatsapp_confirmado()`; a policy de INSERT direto também. O servidor chama `sincronizarPerfil(currentUser())` antes (Clerk = verdade).
- **Limites do comprador:** gatilho `radar_1_validar` (vale para a função e para INSERT direto pela API).
- **Moderação:** o mesmo `filtro_moderacao()` dos anúncios segura o pedido (`em_analise`); a mensagem da proposta com palavra proibida é recusada na hora.
- **1 proposta por loja por pedido:** `unique (pedido_id, vitrine_id)`; editar é permitido até o prazo (modo prazo) ou enquanto o pedido está aberto (modo WhatsApp).
- **Não propor no próprio pedido, região, plano, propostas restantes, máximo por pedido:** dentro de `propor_radar` (mesma ordem e mensagens de antes).
- **WhatsApp:** o do comprador só sai de `propor_radar` no modo "Podem me chamar" e com número confirmado; o da loja só sai de `escolher_proposta` para o dono do pedido.
- **Avisos:** só funções SECURITY DEFINER inserem em `notificacoes`; a pessoa só lê e marca as suas.
- **Admin:** `moderar_radar` exige `e_admin()`; pedidos e propostas têm gatilho de log em toda mudança.

## 4. Decisões tomadas (o que estava aberto)
- Limites padrão 10/dia e 10 abertos: folgados para o piloto e acima do que os testes antigos usam; o Raniel ajusta no painel.
- Mensagem com palavra proibida é recusada (não fica em análise): a loja corrige na hora e o comprador não espera.
- No modo "Podem me chamar" a proposta pode ir sem foto/anúncio (a loja chama no WhatsApp); no modo prazo pede preço e anúncio ou foto (o comprador compara).
- "Remover" apaga de vez (o log guarda a cópia); "Ocultar" pode ser desfeito com "Devolver".
- Aviso de pedido novo vai também para loja sem plano com Radar (ela vê só o título e os planos): é o gancho de venda.
