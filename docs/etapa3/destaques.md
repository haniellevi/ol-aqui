# Etapa 3 · Destaques pagos + cobrança Asaas + tela 10 do painel

Nota para quem desenvolve. Base: `PRODUTO-CONTAS-ANUNCIOS-ROBO.md` seção 6, `PAINEL-ADMIN.md` tela 10.
Regra de ouro mantida: preço, dias, vagas, créditos e prazos ficam em tabela/configuração, editáveis no painel,
e toda mudança cai em `logs_atividade` pelos gatilhos de log.

## 1. Banco (migração `20261107030500_destaques.sql`)

### Tabelas novas (todas com RLS)

| Tabela | Para quê | Quem lê | Quem escreve |
|---|---|---|---|
| `destaque_tipos` | Os 4 tipos (`subir`, `busca`, `home`, `loja`): nome, descrição curta, preço (centavos), dias, vagas por região (vazio = sem limite), alvo (`anuncio`/`loja`), ativo, ordem | todos (só ativos; admin vê todos) | só admin (UPDATE). Não dá para criar nem apagar tipo: o comportamento de cada um está no código |
| `destaque_creditos_plano` | Créditos grátis por mês, por plano e tipo (ex.: Full ganha 4 Subir) | todos | só admin |
| `destaque_precos_regiao` | Exceção de preço e/ou dias de um tipo numa região (vazio = usa o do tipo) | todos | só admin |
| `asaas_consultas` | Última vez que o servidor perguntou ao Asaas sobre um pagamento (limite de perguntas; sem log) | ninguém | só `marcar_consulta_asaas` |
| `destaques` | Cada destaque comprado, de crédito ou cortesia: tipo, anúncio ou vitrine, região, quem pediu, origem (`pago`/`credito`/`cortesia`), pagamento, status (`aguardando_pagamento`/`ativo`/`encerrado`/`cancelado`), início, fim, reserva | dono da vitrine e admin | ninguém direto: só funções SECURITY DEFINER |

Coluna nova `anuncios.subido_em` (protegida: só o sistema grava). Colunas novas em `destaques`: `renovacoes`
(quantas vezes a reserva vencida foi guardada de novo) e `cancelado_pela_equipe`. Coluna nova `pagamentos.devolver_motivo`
(dinheiro que chegou sem dar para ligar o destaque: a equipe devolve no Asaas). Valores de partida:
`busca` usa o preço e os dias globais que estavam em `destaque.preco_centavos` / `destaque.dias`; as exceções por região
dessas duas configurações viram linhas de `destaque_precos_regiao` do tipo `busca`. As duas configurações saem,
para não existir dois lugares com o mesmo preço.

### Configurações novas (`configuracoes`, editáveis na tela 10 e em Configurações)

| Chave | Padrão | O que faz |
|---|---|---|
| `destaque.reserva_minutos` | 30 | Minutos que a vaga (home/loja) fica guardada esperando o pagamento |
| `destaque.cancelar_pendente_horas` | 48 | Depois disso a rotina diária cancela o pedido que não foi pago |
| `destaque.subir_intervalo_horas` | 24 | Tempo mínimo entre dois "Subir" do mesmo anúncio |
| `destaque.subir_resultado_dias` | 7 | Janela em que o resultado do "Subir" é medido |
| `destaque.pendentes_max` | 10 | Pedidos esperando pagamento por vendedor ao mesmo tempo (conta pedido recente ou com reserva valendo) |
| `destaque.reserva_renovacoes_max` | 1 | Quantas vezes a reserva vencida de um pedido não pago pode ser guardada de novo |
| `destaque.reservas_max_por_vendedor` | 2 | Vagas guardadas (home/loja) esperando pagamento por vendedor, por tipo, ao mesmo tempo |
| `cobranca.vencimento_dias` | 1 | Dias até vencer a cobrança no Asaas |
| `cobranca.consulta_intervalo_segundos` | 15 | Intervalo mínimo entre duas perguntas do servidor ao Asaas sobre a mesma cobrança |
| `asaas.ambiente` (já existia) | `"sandbox"` | `sandbox` ou `producao` |

### Funções

| Função | Quem chama | O que garante |
|---|---|---|
| `opcoes_destaque(anuncio_id)` | vendedor | Tipos ativos com preço, dias, vagas livres na região e créditos que sobram este mês |
| `contratar_destaque(tipo, anuncio_id, usar_credito)` | vendedor | Confere dono, anúncio no ar, loja ativa, intervalo do Subir, vagas (trava `pg_advisory_xact_lock` por tipo+região), créditos (trava por vitrine+tipo). Crédito/preço zero: ativa na hora. Pago: cria `pagamentos` (tipo `destaque`) + destaque `aguardando_pagamento` com `reservado_ate`. Pedido repetido devolve o mesmo pedido pendente |
| `ativar_destaque_pago(id)` | interna (de `confirmar_pagamento`) | Liga o pedido pago, menos se a equipe cancelou, se o anúncio/loja não está no ar, ou se o pedido já tinha sido cancelado (vencido) e as vagas estão cheias: aí fica cancelado e o pagamento é marcado `devolver_motivo` |
| `marcar_consulta_asaas(pagamento)` | servidor (service_role) | `true` no máximo uma vez a cada `cobranca.consulta_intervalo_segundos` por pagamento: o servidor só pergunta ao Asaas quando recebe `true` |
| `ativar_destaque(id)` | interna (só pedido `aguardando_pagamento`) | Subir: `subido_em = now()`. Busca: estende `destaque_ate` (busca e listas continuam usando essa coluna, com rodízio justo). Home/Loja: início/fim (somando se já tiver um ativo) |
| `confirmar_pagamento(cobranca, payload)` | webhook (service_role) | Mesma assinatura. Idempotente (só age quando o pagamento ainda não estava pago). Tipo `destaque` com destaque ligado → ativa; sem destaque ligado (cobrança antiga) → comportamento antigo com os dias do tipo `busca` |
| `cancelar_pagamento(cobranca, status, payload)` | webhook (service_role) | Vencido/apagado → cancela o pedido pendente. Estorno → cancela o destaque ativo (e devolve o tempo de `destaque_ate`). Idempotente |
| `registrar_cobranca_asaas(pagamento, cobranca, link, forma)` | servidor (service_role) | Grava os ids do Asaas no pagamento pendente. Nunca troca uma cobrança já gravada por outra (devolve `false`; o servidor apaga a cobrança a mais no Asaas), para nenhum Pix pago ficar sem dono |
| `conceder_destaque_cortesia(...)` / `cancelar_destaque(...)` | admin | Cortesia ativa na hora, respeita vagas (a não ser que o admin marque "passar das vagas"); fica no log |
| `resultados_destaques(anuncio_id, todos, limite)` | vendedor / admin | Visualizações e cliques no WhatsApp de `eventos_anuncio` dentro da janela do destaque. Vendedor vê só os seus; admin vê todos com `todos = true` |
| `destaques_home(regiao, limite)` | público | Carrossel "Destaques perto de você": tipo `home` ativo na região, anúncio no ar, rodízio justo que muda a cada hora |
| `lojas_em_destaque(regiao, limite)` | público | Bloco "Lojas em destaque": tipo `loja` ativo na região |
| `expirar_destaques()` | rotina diária | Encerra destaques vencidos e cancela pedidos não pagos antigos. `expirar_rotina()` passa a chamar esta função |

`buscar_anuncios` foi recriada com a mesma assinatura e as mesmas colunas: a ordem "recentes"/"relevância"
usa `greatest(publicado_em, subido_em)`. Destaque na busca continua igual (primeiro, em rodízio diário).

### Vagas limitadas sem bloquear para sempre
Ocupa vaga: destaque `ativo` com `fim > now()` ou `aguardando_pagamento` com `reservado_ate > now()`, e só se o anúncio
(ou a loja) está no ar. Conta-se por alvo (o mesmo anúncio/loja renovando não ocupa outra vaga). Reserva vencida não ocupa nada.
- Pedir de novo o mesmo pedido **não estica** a reserva que ainda vale. A reserva vencida é guardada de novo no máximo
  `destaque.reserva_renovacoes_max` vezes; depois o pedido continua pagável, mas sem segurar vaga.
- Cada vendedor guarda no máximo `destaque.reservas_max_por_vendedor` vagas de um tipo ao mesmo tempo.
- Dinheiro que chega com o pedido ainda esperando (mesmo com a reserva vencida): liga assim mesmo (a cobrança era válida);
  pode passar uma vaga do limite por alguns dias.
- Dinheiro que chega depois do pedido cancelado: cancelado pela equipe → nunca liga; vencido/não pago a tempo → liga só
  se tiver vaga e o anúncio estiver no ar. Quando não liga, o pagamento entra em "Pagos sem destaque: devolver o dinheiro"
  na tela 10 e a pessoa vê que a equipe vai devolver.
- Para o Pix antigo não ser pago por engano, o servidor apaga a cobrança no Asaas quando o admin cancela um pedido,
  quando chega o aviso de vencida e quando a pessoa abre um pedido cancelado.

## 2. Asaas

- `src/lib/asaas.ts` (só servidor, `fetch`, sem dependência nova). Variáveis: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`.
  Ambiente em `asaas.ambiente`: `sandbox` → `https://api-sandbox.asaas.com/v3`, `producao` → `https://api.asaas.com/v3`.
- Cliente Asaas: o CPF/CNPJ é pedido na tela, conferido (dígitos verificadores), enviado ao Asaas e **nunca guardado**.
  Guardamos só o id do cliente em `vitrines_lojas.gateway_cliente_id` como `ambiente:cus_...` (trocar de ambiente pede o CPF de novo).
- Cobrança `PIX` (QR + copia e cola na tela) ou `CREDIT_CARD` (abre a fatura do Asaas, `invoiceUrl`).
- Webhook `src/app/api/asaas/webhook/route.ts`: confere o cabeçalho `asaas-access-token` em tempo constante;
  `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `confirmar_pagamento`; `PAYMENT_OVERDUE` (vencido) e `PAYMENT_DELETED` (cancelado)
  → `cancelar_pagamento`; dinheiro que volta (`PAYMENT_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_REQUESTED`,
  `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_RECEIVED_IN_CASH_UNDONE`) → `cancelar_pagamento(..., 'estornado')`, que desliga o destaque.
  Se a contestação for ganha, o destaque não volta sozinho: a equipe dá uma cortesia.
  Sempre responde 200 rápido quando o token confere (o banco ignora aviso repetido).
- Sem `ASAAS_API_KEY`: a tela mostra "Pagamento em breve" e só créditos do plano funcionam (cortesia continua pelo painel).
- A tela de espera do Pix pergunta a cada 5 s; o servidor também confere o status direto no Asaas (se o webhook atrasar, ativa igual),
  mas no máximo uma vez a cada `cobranca.consulta_intervalo_segundos` por pagamento, decidido no banco (`marcar_consulta_asaas`),
  seja o que for que a tela peça. O QR do Pix fica guardado na memória do servidor por 10 minutos.

## 3. Telas

| Rota | O que tem |
|---|---|
| `/destacar/[anuncioId]` | Escolher o tipo (cartões com preço, dias, o que faz, "Você tem 2 Subir grátis este mês", vagas), confirmar, pagar com Pix (QR, copiar, "aguardando pagamento", sucesso) ou cartão (fatura do Asaas). Ao gerar a cobrança, o endereço ganha `?d=<destaque>`, que retoma o pagamento; Meus anúncios mostra "Pagamento pendente" com "Continuar o pagamento" |
| `/destacar/loja` | O mesmo para "Loja em destaque" (Minha loja mostra "Continuar o pagamento" quando há pedido pendente) |
| Minha conta > Meus anúncios | Botão "Destacar" nos anúncios no ar + "Seu destaque teve X visualizações e Y cliques no WhatsApp" |
| Minha conta > Minha loja | Cartão "Destacar minha loja" com o resultado |
| `/anunciar/pronto` | Botão "Destacar" |
| Início | Carrossel "Destaques perto de você" (só tipo home da região) e bloco "Lojas em destaque" (tipo loja), sempre com "Patrocinado". O "Destaque na busca" continua no topo da grade "Mais recentes" com "Patrocinado", igual à busca |
| `/admin/destaques` (tela 10) | Tipos (preço, dias, vagas, ativo, ordem), preço e dias por região, créditos por plano, configurações dos destaques, destaques ativos com resultado, cortesia, pagamentos esperando (com "Cancelar pedido", que também apaga a cobrança no Asaas), pagos sem destaque para devolver, situação do Asaas |

Link para o robô Aki: `linkDestacar(anuncioId)` em `src/lib/rotas.ts` e `gerarLinkDestaque()` em `src/lib/dados/destaques.ts`
(confere se o anúncio é da pessoa e devolve o endereço completo).

## 4. Como cada regra é garantida

- **Nada fixo no código:** preço/dias/vagas/ativo/ordem em `destaque_tipos` (preço/dias por região em `destaque_precos_regiao`); créditos em `destaque_creditos_plano`; prazos em `configuracoes`.
- **Log:** gatilhos `registrar_log` em `destaque_tipos`, `destaque_precos_regiao`, `destaque_creditos_plano` e `destaques`.
- **Ninguém forja pagamento ou ativação:** `destaques` sem INSERT/UPDATE/DELETE para usuários; `pagamentos` só pelo servidor;
  `confirmar_pagamento`, `cancelar_pagamento`, `registrar_cobranca_asaas` e `expirar_destaques` só para `service_role`; `subido_em` e `destaque_ate` protegidos por gatilho.
- **Patrocinado:** todo lugar pago (busca, carrossel da home, lojas em destaque) mostra a etiqueta.
- **Resultado só do próprio vendedor:** `resultados_destaques` filtra por `dono_id = usuario_id()`; admin precisa pedir `todos`.

## 5. Arquivos

- Banco: `supabase/migrations/20261107030500_destaques.sql`; testes: `supabase/testes/50_destaques.sql`.
- Tipos: `src/lib/tipos-destaques.ts`. CPF/CNPJ (dígitos e máscara): `src/lib/cpf-cnpj.ts`.
- Asaas: `src/lib/asaas.ts` (cliente HTTP) e `src/lib/cobranca-destaque.ts` (cobrar um pedido, conferir a situação, saber se precisa do CPF).
- Leituras: `src/lib/dados/destaques.ts` (opções, pedido, resultados, carrossel, lojas em destaque, `gerarLinkDestaque`).
- Ações do vendedor: `src/app/(conta)/destacar/actions.ts`; telas: `src/app/(conta)/destacar/[anuncioId]/page.tsx`, `src/app/(conta)/destacar/loja/page.tsx`,
  componentes em `src/components/destaques/`.
- Webhook: `src/app/api/asaas/webhook/route.ts`. Painel: `src/app/admin/destaques/` (+ item "Destaques" no menu do painel).

## 6. Como ligar em produção

1. Na Vercel: `ASAAS_API_KEY` (chave do Asaas) e `ASAAS_WEBHOOK_TOKEN` (um texto longo inventado).
2. No Asaas: Integrações > Webhooks > URL `https://SEU-SITE/api/asaas/webhook`, mesmo token, eventos de cobrança
   (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_REFUND_IN_PROGRESS,
   PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_RECEIVED_IN_CASH_UNDONE).
3. No painel: Destaques > `asaas.ambiente` = `producao` quando for valer (começa em `sandbox`).
4. Rotina diária (pg_cron) continua `select public.expirar_rotina()`: ela já chama `expirar_destaques()`.
