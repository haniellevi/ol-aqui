# Etapa 4 · Radar completo (nota para o desenvolvedor)

Comprador pede → lojas propõem → comprador escolhe. Base: TELAS-E-FLUXOS.md (T26–T30, F4, F5),
PRODUTO-CONTAS-ANUNCIOS-ROBO.md (Radar) e as decisões do Raniel: teste grátis tem 3 propostas,
comprador escolhe "WhatsApp na hora" ou "propostas com prazo", e só pede com o celular confirmado por código (enquanto o SMS do login não funciona, `radar.exigir_celular_confirmado = false` deixa pedir com o WhatsApp digitado, e a loja recebe esse número).

Migração: `supabase/migrations/20261108020000_radar_completo.sql` · Testes: `supabase/testes/90_radar_completo.sql`
Tipos: `src/lib/tipos-radar.ts` · Leituras: `src/lib/dados/radar.ts` · Ações: `src/app/radar/actions.ts`

## 1. Banco

### Tabelas
| Tabela | O que muda |
|---|---|
| `radar_pedidos` | novas colunas: `categoria_id` (categoria da tabela; o enum antigo `categoria` passa a ser preenchido pelo banco a partir dela), `preco_min_centavos`, `prazo_horas` (opção escolhida), `origem` (`site`/`aki`), `fechado_em`, `fechado_motivo` (`resolvido`, `cancelado`, `prazo`, `moderacao`), `moderado_motivo` |
| `radar_propostas` | novas colunas: `status` (`ativa`/`oculta`), `moderado_motivo`, `atualizado_em`, `escolhida_em` |
| `preferencias_avisos` (nova) | o que cada pessoa quer receber: `usuario_id`, `tipo`, `canal` (`app` hoje), `ligado`. Sem linha = ligado. Só a dona lê; grava só por `salvar_preferencia_aviso` |
| `notificacoes` (nova) | aviso dentro do app: `usuario_id`, `tipo`, `titulo`, `texto`, `link` (sempre caminho interno), `canal` (`app` hoje; `whatsapp`/`push`/`email` ficam para a fase 2), `chave` (evita aviso repetido), `lida_em`, `enviada_em`, `dados` |

RLS: `notificacoes` só a dona lê e apaga; ninguém insere pela API (só funções SECURITY DEFINER).
`radar_propostas` continua sem INSERT/UPDATE pela API; o comprador deixa de ver proposta `oculta`.
`radar_propostas.criado_ip` (Marco Civil) não sai pela API: a leitura é por coluna (todas menos `criado_ip`), só o servidor
(service_role) lê o IP. Coluna nova nessa tabela precisa entrar no `grant select (...)`.

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
| `salvar_preferencia_aviso(tipo, ligado)` | dona | liga ou desliga um aviso para ela (só os tipos de `radar.avisos_escolha`); `notificar()` respeita |
| `moderar_radar(tipo, id, acao, motivo)` | admin | ocultar / devolver / remover pedido ou proposta, com motivo; tudo cai em `logs_atividade` |
| `radar_avisar_prazos()` | pg_cron a cada 10 min | aviso "prazo acabou" com o resumo ("6 propostas, a menor R$ 1.850") e encerra pedidos vencidos |
| `expirar_rotina()` | pg_cron | a versão que existia é renomeada para `expirar_rotina_base()`; a nova chama `radar_avisar_prazos()` e depois a base (assim não apaga o que outra etapa pôs na rotina) |
| `pode_enviar_foto(nome)` | Storage | ganha a pasta `<usuario>/radar-<pedido>/<arquivo>` (loja com Radar, pedido aberto de outra pessoa, da mesma região, até `radar.fotos_max_pasta` arquivos) |

Gatilhos de aviso: proposta nova → comprador; pedido novo (ou liberado pela moderação) → lojas da região
com anúncio no ar da mesma categoria-mãe (sem categoria: todas as lojas da região), com teto por loja por dia
(só contam avisos de pedidos ainda abertos: pedido cancelado não gasta o teto) e teto por loja por comprador por dia
(uma conta sozinha não lota o aviso de todas as lojas);
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
| `radar.avisos_lojas_por_dia` | 10 | teto de avisos "pedido novo" por loja por dia (só pedidos ainda abertos) |
| `radar.avisos_lojas_por_comprador_dia` | 2 | teto de avisos "pedido novo" que uma loja recebe do mesmo comprador por dia |
| `radar.avisos_escolha` | os 4 tipos | avisos que cada pessoa pode ligar/desligar em Minha conta > Notificações |
| `radar.avisos_lojas_max_por_pedido` | 200 | teto de lojas avisadas por pedido |
| `radar.aviso.<tipo>.titulo` / `.texto` | textos simples | textos dos avisos, com `{pedido}`, `{loja}`, `{cidade}`, `{preco}`, `{total}`, `{menor}` |

Teste grátis = 3 propostas: vem de `planos.propostas_radar_mes` do plano de teste (já existia). Preço dos
planos mostrados para quem não tem Radar: tabela `planos` (`acesso_radar = true`).

### Rotinas agendadas (pg_cron, como service_role/postgres)
| Nome | Quando | Comando |
|---|---|---|
| `olaki-radar-prazos` | a cada 10 min (`*/10 * * * *`) | `select public.radar_avisar_prazos()` — o aviso "prazo acabou" sai no máximo 10 min depois do prazo |
| `olaki-expirar` | todo dia 03:15 (`15 3 * * *`) | `select public.expirar_rotina()` — o resto da limpeza (também chama `radar_avisar_prazos()`) |

A migração agenda `olaki-radar-prazos` sozinha quando o pg_cron está ligado. Se o pg_cron for ligado depois, rodar no SQL do Supabase:
`select cron.schedule('olaki-radar-prazos', '*/10 * * * *', 'select public.radar_avisar_prazos()');`

## 2. Telas
| Rota | Quem | O que tem |
|---|---|---|
| `/radar` | todos | visitante: explicação em 3 passos + "Pedir no Radar". Logado: abas **Meus pedidos** (comprador), **Pedidos na região** e **Minhas propostas** (loja). A aba de região é a tela que o Raniel redesenhou (mesmo visual) |
| `/radar/pedir` | logado | o que procura (vem de `?q=` da busca vazia), categoria (opcional), faixa de preço, cidade da região, "Podem me chamar no WhatsApp" ou "Quero receber propostas aqui até <data>" com os prazos do painel. Sem celular confirmado: cartão "Confirme seu celular" (o Clerk é a fonte; o servidor sincroniza antes de conferir); se o painel não exige o código, o formulário pede "Seu WhatsApp" (DDD + número), que o servidor grava no perfil com a chave secreta sem nunca trocar um número confirmado |
| `/radar/pedido/[id]` | dono do pedido | "Pedido no ar!" logo depois de criar, propostas para comparar (menor preço / mais novas), "Chamar no WhatsApp" por proposta, "Já resolvi", "Cancelar pedido", resumo quando o prazo acaba |
| `/radar/[id]` | loja | o pedido + folha **Propor** (anúncio no ar ou foto, preço, mensagem). No modo "Podem me chamar", quem já propôs tem "Chamar no WhatsApp de novo". Proposta escolhida pelo comprador não muda mais. Sem plano/propostas: planos da tabela e link `LINK_PLANOS?origem=radar` |
| `/minha-conta/notificacoes` | logado | avisos do app; número de não lidas em Minha conta; "O que você quer receber" (liga/desliga cada aviso; WhatsApp e e-mail em breve) |
| `/admin/moderacao` | admin | seção "Radar" com pedidos e propostas recentes: ocultar, devolver, remover, sempre com motivo. Remover só com a caixa "Sim, remover de vez" marcada |
| `/admin` | admin | número novo "Pedidos com proposta (mês)" |

## 3. Como cada regra é garantida
- **Celular confirmado:** `criar_pedido_radar` exige `whatsapp_confirmado()`; a policy de INSERT direto também. O servidor chama `sincronizarPerfil(currentUser())` antes (Clerk = verdade).
- **Limites do comprador:** gatilho `radar_1_validar` (vale para a função e para INSERT direto pela API). Uma trava por comprador (`pg_advisory_xact_lock`) faz pedidos mandados ao mesmo tempo entrarem um de cada vez. Pedido com prazo de propostas acabado não segura vaga de "pedido aberto".
- **Propostas do plano (teste grátis = 3):** `radar_propor` trava a linha da loja (`for update`) antes de contar: duas propostas ao mesmo tempo não passam do plano.
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
