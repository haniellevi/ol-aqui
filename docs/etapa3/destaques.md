# Etapa 3 · Destaques pagos + cobrança Asaas + tela 10 do painel

Nota para quem desenvolve. Base: `PRODUTO-CONTAS-ANUNCIOS-ROBO.md` seção 6, `PAINEL-ADMIN.md` tela 10.
Regra de ouro mantida: preço, dias, vagas, créditos e prazos ficam em tabela/configuração, editáveis no painel,
e toda mudança cai em `logs_atividade` pelos gatilhos de log.

## 1. Banco (migração `20261107030000_destaques.sql`)

### Tabelas novas (todas com RLS)

| Tabela | Para quê | Quem lê | Quem escreve |
|---|---|---|---|
| `destaque_tipos` | Os 4 tipos (`subir`, `busca`, `home`, `loja`): nome, descrição curta, preço (centavos), dias, vagas por região (vazio = sem limite), alvo (`anuncio`/`loja`), ativo, ordem | todos (só ativos; admin vê todos) | só admin (UPDATE). Não dá para criar nem apagar tipo: o comportamento de cada um está no código |
| `destaque_creditos_plano` | Créditos grátis por mês, por plano e tipo (ex.: Full ganha 4 Subir) | todos | só admin |
| `destaques` | Cada destaque comprado, de crédito ou cortesia: tipo, anúncio ou vitrine, região, quem pediu, origem (`pago`/`credito`/`cortesia`), pagamento, status (`aguardando_pagamento`/`ativo`/`encerrado`/`cancelado`), início, fim, reserva | dono da vitrine e admin | ninguém direto: só funções SECURITY DEFINER |

Coluna nova `anuncios.subido_em` (protegida: só o sistema grava). Valores de partida:
`busca` usa o preço e os dias que estavam em `destaque.preco_centavos` / `destaque.dias` (essas duas configurações
saem, para não existir dois lugares com o mesmo preço).

### Configurações novas (`configuracoes`, editáveis na tela 10 e em Configurações)

| Chave | Padrão | O que faz |
|---|---|---|
| `destaque.reserva_minutos` | 30 | Minutos que a vaga (home/loja) fica guardada esperando o pagamento |
| `destaque.cancelar_pendente_horas` | 48 | Depois disso a rotina diária cancela o pedido que não foi pago |
| `destaque.subir_intervalo_horas` | 24 | Tempo mínimo entre dois "Subir" do mesmo anúncio |
| `destaque.subir_resultado_dias` | 7 | Janela em que o resultado do "Subir" é medido |
| `cobranca.vencimento_dias` | 1 | Dias até vencer a cobrança no Asaas |
| `asaas.ambiente` (já existia) | `"sandbox"` | `sandbox` ou `producao` |

### Funções

| Função | Quem chama | O que garante |
|---|---|---|
| `opcoes_destaque(anuncio_id)` | vendedor | Tipos ativos com preço, dias, vagas livres na região e créditos que sobram este mês |
| `contratar_destaque(tipo, anuncio_id, usar_credito)` | vendedor | Confere dono, anúncio no ar, loja ativa, intervalo do Subir, vagas (trava `pg_advisory_xact_lock` por tipo+região), créditos (trava por vitrine+tipo). Crédito/preço zero: ativa na hora. Pago: cria `pagamentos` (tipo `destaque`) + destaque `aguardando_pagamento` com `reservado_ate`. Pedido repetido devolve o mesmo pedido pendente |
| `ativar_destaque(id)` | interna | Subir: `subido_em = now()`. Busca: estende `destaque_ate` (busca e listas continuam usando essa coluna, com rodízio justo). Home/Loja: início/fim (somando se já tiver um ativo) |
| `confirmar_pagamento(cobranca, payload)` | webhook (service_role) | Mesma assinatura. Idempotente (só age quando o pagamento ainda não estava pago). Tipo `destaque` com destaque ligado → ativa; sem destaque ligado (cobrança antiga) → comportamento antigo com os dias do tipo `busca` |
| `cancelar_pagamento(cobranca, status, payload)` | webhook (service_role) | Vencido/apagado → cancela o pedido pendente. Estorno → cancela o destaque ativo (e devolve o tempo de `destaque_ate`). Idempotente |
| `registrar_cobranca_asaas(pagamento, cobranca, link, forma)` | servidor (service_role) | Grava os ids do Asaas no pagamento |
| `conceder_destaque_cortesia(...)` / `cancelar_destaque(...)` | admin | Cortesia ativa na hora, respeita vagas (a não ser que o admin marque "passar das vagas"); fica no log |
| `resultados_destaques(anuncio_id, todos, limite)` | vendedor / admin | Visualizações e cliques no WhatsApp de `eventos_anuncio` dentro da janela do destaque. Vendedor vê só os seus; admin vê todos com `todos = true` |
| `destaques_home(regiao, limite)` | público | Carrossel "Destaques perto de você": tipo `home` ativo na região, anúncio no ar, rodízio justo que muda a cada hora |
| `lojas_em_destaque(regiao, limite)` | público | Bloco "Lojas em destaque": tipo `loja` ativo na região |
| `expirar_destaques()` | rotina diária | Encerra destaques vencidos e cancela pedidos não pagos antigos. `expirar_rotina()` passa a chamar esta função |

`buscar_anuncios` foi recriada com a mesma assinatura e as mesmas colunas: a ordem "recentes"/"relevância"
usa `greatest(publicado_em, subido_em)`. Destaque na busca continua igual (primeiro, em rodízio diário).

### Vagas limitadas sem bloquear para sempre
Ocupa vaga: destaque `ativo` com `fim > now()` ou `aguardando_pagamento` com `reservado_ate > now()`.
Conta-se por alvo (o mesmo anúncio/loja renovando não ocupa outra vaga). Reserva vencida não ocupa nada.
Se o dinheiro chegar depois da reserva vencer, o destaque é ativado assim mesmo (quem pagou nunca fica sem o que pagou);
nesse caso pode passar uma vaga do limite por alguns dias.

## 2. Asaas

- `src/lib/asaas.ts` (só servidor, `fetch`, sem dependência nova). Variáveis: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`.
  Ambiente em `asaas.ambiente`: `sandbox` → `https://api-sandbox.asaas.com/v3`, `producao` → `https://api.asaas.com/v3`.
- Cliente Asaas: o CPF/CNPJ é pedido na tela, conferido (dígitos verificadores), enviado ao Asaas e **nunca guardado**.
  Guardamos só o id do cliente em `vitrines_lojas.gateway_cliente_id` como `ambiente:cus_...` (trocar de ambiente pede o CPF de novo).
- Cobrança `PIX` (QR + copia e cola na tela) ou `CREDIT_CARD` (abre a fatura do Asaas, `invoiceUrl`).
- Webhook `src/app/api/asaas/webhook/route.ts`: confere o cabeçalho `asaas-access-token` em tempo constante;
  `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `confirmar_pagamento`; `PAYMENT_OVERDUE`/`PAYMENT_DELETED`/`PAYMENT_REFUNDED` → `cancelar_pagamento`.
  Sempre responde 200 rápido quando o token confere (o banco ignora aviso repetido).
- Sem `ASAAS_API_KEY`: a tela mostra "Pagamento em breve" e só créditos do plano funcionam (cortesia continua pelo painel).
- A tela de espera do Pix pergunta a cada 5 s; o servidor também confere o status direto no Asaas (se o webhook atrasar, ativa igual).

## 3. Telas

| Rota | O que tem |
|---|---|
| `/destacar/[anuncioId]` | Escolher o tipo (cartões com preço, dias, o que faz, "Você tem 2 Subir grátis este mês", vagas), confirmar, pagar com Pix (QR, copiar, "aguardando pagamento", sucesso) ou cartão (fatura do Asaas). `?d=<destaque>` retoma um pagamento |
| `/destacar/loja` | O mesmo para "Loja em destaque" |
| Minha conta > Meus anúncios | Botão "Destacar" nos anúncios no ar + "Seu destaque teve X visualizações e Y cliques no WhatsApp" |
| Minha conta > Minha loja | Cartão "Destacar minha loja" com o resultado |
| `/anunciar/pronto` | Botão "Destacar" |
| Início | Carrossel "Destaques perto de você" (tipo home) e bloco "Lojas em destaque" (tipo loja), sempre com "Patrocinado" |
| `/admin/destaques` (tela 10) | Tipos (preço, dias, vagas, ativo, ordem), créditos por plano, configurações dos destaques, destaques ativos com resultado, cortesia, pagamentos esperando, situação do Asaas |

Link para o robô Aki: `linkDestacar(anuncioId)` em `src/lib/rotas.ts` e `gerarLinkDestaque()` em `src/lib/dados/destaques.ts`
(confere se o anúncio é da pessoa e devolve o endereço completo).

## 4. Como cada regra é garantida

- **Nada fixo no código:** preço/dias/vagas/ativo/ordem em `destaque_tipos`; créditos em `destaque_creditos_plano`; prazos em `configuracoes`.
- **Log:** gatilhos `registrar_log` em `destaque_tipos`, `destaque_creditos_plano` e `destaques`.
- **Ninguém forja pagamento ou ativação:** `destaques` sem INSERT/UPDATE/DELETE para usuários; `pagamentos` só pelo servidor;
  `confirmar_pagamento`, `cancelar_pagamento`, `registrar_cobranca_asaas` e `expirar_destaques` só para `service_role`; `subido_em` e `destaque_ate` protegidos por gatilho.
- **Patrocinado:** todo lugar pago (busca, carrossel da home, lojas em destaque) mostra a etiqueta.
- **Resultado só do próprio vendedor:** `resultados_destaques` filtra por `dono_id = usuario_id()`; admin precisa pedir `todos`.
