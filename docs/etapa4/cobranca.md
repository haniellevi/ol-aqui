# Etapa 4 · Cobrança de planos e anúncio avulso (Asaas) + telas 5 e 6 do painel

Nota para quem desenvolve. Base: `PAINEL-ADMIN.md` telas 2, 5 e 6, as regras do topo de
`20261107010100_painel_admin.sql` (planos, teste grátis, PF com poucos itens + avulso pago, `pagamentos`,
`confirmar_pagamento`) e a integração com o Asaas que os destaques já fizeram (`docs/etapa3/destaques.md`).
Regra de ouro mantida: preço, períodos, descontos, prazos e limites vêm de `planos` e `configuracoes`,
editáveis no painel, e toda mudança cai em `logs_atividade`.

**Nada novo de Asaas:** o mesmo cliente (`src/lib/asaas.ts`), o mesmo webhook (`/api/asaas/webhook`), o mesmo
id de cliente (`vitrines_lojas.gateway_cliente_id`), `registrar_cobranca_asaas`, `marcar_consulta_asaas`
(limite de perguntas) e `cancelar_pagamento`. O CPF/CNPJ vai só para o Asaas, nunca é guardado.
Sem `ASAAS_API_KEY` tudo mostra "Pagamento em breve" e o painel continua dando cortesia e trocando plano.

## 1. Banco (migração `20261108010000_cobranca_planos.sql`)

### Colunas novas

| Onde | Coluna | Para quê |
|---|---|---|
| `pagamentos` | `meses` | Quantos períodos do plano a cobrança paga (1 = mensal) |
| `pagamentos` | `regra` | Como o pagamento foi aplicado: `inicio`, `renovacao`, `troca_agora`, `proximo_periodo`, `renovacao_proximo` |
| `pagamentos` | `concedido_de`, `concedido_ate` | Janela que o pagamento deu (plano ou anúncio avulso). Base da devolução |
| `pagamentos` | `plano_anterior`, `expira_anterior` | Como estava o plano antes (devolução volta para cá) |
| `pagamentos` | `observacao` | Nota do sistema para a equipe (ex.: "pago com a loja suspensa") |
| `pagamentos` | `criado_por` | Quem pediu a cobrança |
| `vitrines_lojas` | `plano_proximo`, `plano_proximo_ate`, `plano_proximo_pagamento_id` | Plano menor já pago que começa quando o período atual acaba |

As colunas novas da vitrine são protegidas pelo gatilho `vitrines_3_proteger_assinatura` (só o sistema/admin
grava; o dono não forja). Elas **não têm chave estrangeira** de propósito: uma segunda ligação
vitrines_lojas↔pagamentos/planos deixaria ambíguo o `select` com tabela embutida da API (ex.:
`pagamentos?select=vitrines_lojas(nome)`, usado no painel de destaques). Plano marcado que sumiu da tabela é desmarcado. `pagamentos` continua sem INSERT/UPDATE para o usuário (só leitura do dono e do admin).

### Tabela nova

| Tabela | Para quê | Quem lê | Quem escreve |
|---|---|---|---|
| `vitrines_acoes_admin` | Cada ação do painel numa loja (cortesia, trocar plano, suspender, reativar, dar/tirar selo) com o **motivo** | só admin | só `admin_acao_loja` (SECURITY DEFINER). Gatilho de log |

`perfis_verificacoes` já existia (documento/selfie/CNPJ): ganha gatilho de log e a função `admin_analisar_verificacao`.
O envio de documentos pelo usuário e o bucket privado `verificacoes` **ainda não existem** (fica para depois): a tela 5
lista as verificações pendentes que houver e o admin aprova ou recusa com motivo.

### Configurações novas (Configurações > Planos e avulsos / Cobrança; todas com exceção por região)

| Chave | Padrão | O que faz |
|---|---|---|
| `assinatura.periodos` | `[{"meses": 1, "desconto_percentual": 0}]` | Períodos que a loja pode pagar de uma vez. Trimestral/anual só aparecem se o admin adicionar, ex.: `{"meses": 3, "desconto_percentual": 10}` |
| `assinatura.aviso_vencimento_dias` | 7 | Dias antes do vencimento em que "Meu plano" mostra o aviso de renovar |
| `cobranca.pendentes_max` | 5 | Cobranças de plano e avulso esperando pagamento por vendedor ao mesmo tempo |
| `cobranca.cancelar_pendente_horas` | 72 | A rotina diária cancela cobrança de plano/avulso não paga depois disso (se o Pix antigo for pago, vale assim mesmo) |
| `avulso.publico` | `"pf"` | Quem pode pagar anúncio avulso: `pf` (só pessoa física) ou `todos` |
| `avulso.preco_centavos`, `avulso.dias` (já existiam) | 990 / 30 | Preço e dias do avulso. Preço 0 = avulso desligado |

### Funções

| Função | Quem chama | O que garante |
|---|---|---|
| `opcoes_assinatura()` | vendedor | Planos à venda para o tipo dele (`publico` = todos/pj para loja, todos/pf para PF), em cada período de `assinatura.periodos`, com valor, regra, início e fim **antes de pagar** |
| `minha_assinatura()` | vendedor | Situação (teste, ativa, vencida, suspensa, grátis, sem plano), vencimento, plano marcado para depois, aviso de renovar |
| `pedir_assinatura(plano, meses)` | vendedor | Confere loja não suspensa, plano ativo e pago, período permitido, troca já marcada, limite de pendentes. Cria `pagamentos` (`assinatura`). Pedido igual pendente é devolvido; outras cobranças de plano pendentes são canceladas (o servidor apaga no Asaas) |
| `pedir_anuncio_avulso(anuncio)` | vendedor | Dono, `avulso.publico`, anúncio rascunho/pausado/expirado e **completo** (categoria, título, cidade, fotos, campos obrigatórios), sem vaga grátis sobrando, preço > 0. Cria `pagamentos` (`anuncio_avulso`) |
| `confirmar_pagamento` (mesma assinatura) | webhook / consulta | Idempotente. `destaque`: igual a antes. `assinatura`: `aplicar_assinatura`. `anuncio_avulso`: `aplicar_anuncio_avulso` |
| `cancelar_pagamento` (mesma assinatura) | webhook | `vencido`/`cancelado`: igual a antes. `estornado`: destaque igual a antes; plano e avulso desfazem só o que aquele pagamento deu |
| `expirar_rotina()` (mesma) | agendador | Igual a antes + liga o plano marcado para depois, tira do ar avulso vencido que não cabe no plano, cancela cobrança velha de plano/avulso |
| `plano_efetivo(v)` (mesma) | interna | Igual a antes + se o período atual acabou e tem `plano_proximo` pago, ele já vale (sem esperar a rotina) |
| `admin_lojas(...)` | admin | Lista da tela 5 com plano, vencimento, anúncios no ar, propostas do Radar no mês, situação |
| `admin_acao_loja(vitrine, acao, motivo, dias, plano)` | admin | Cortesia de dias, trocar plano, suspender, reativar, dar/tirar selo. Motivo obrigatório, grava em `vitrines_acoes_admin` e no log |
| `admin_resumo_pagamentos(...)` | admin | Totais da tela 6 por status e tipo, com os mesmos filtros da lista |
| `admin_analisar_verificacao(id, aprovar, motivo)` | admin | Aprova ou recusa com motivo |

Todas SECURITY DEFINER com `search_path = public, extensions`, conferem `usuario_id()`/`e_admin()` e só
`authenticated` executa (as internas e as do webhook: só `service_role`). Bloco de endurecimento no fim, igual ao das outras migrações.

## 2. Regras de plano (como cada uma é garantida)

- **Uma cobrança por período.** Não usamos assinatura do Asaas na v1. Cada pagamento é uma cobrança avulsa de
  `preço × meses × (1 − desconto)`. Na renovação a loja abre "Meu plano" e paga o próximo período (o aviso aparece
  `assinatura.aviso_vencimento_dias` antes).
- **Na confirmação** (`aplicar_assinatura`), a regra é calculada de novo com a situação daquele momento:
  - sem plano pago valendo (teste, grátis, vencido): `inicio` → plano novo de agora até agora + dias;
  - mesmo plano: `renovacao` → soma a partir de `max(agora, vencimento atual)`;
  - plano maior (preço por dia maior ou igual): `troca_agora` → **cobra o período inteiro e começa agora**; os dias
    que faltavam do plano anterior não passam para o novo. A tela mostra isso antes de pagar;
  - plano menor: `proximo_periodo` → o plano atual continua até o fim e o menor começa depois (`plano_proximo`);
  - pagar de novo o plano já marcado para depois: `renovacao_proximo` (soma no fim dele).
  - Com troca marcada, outro plano diferente é recusado antes de pagar ("fale com o suporte"). Se mesmo assim chegar
    dinheiro, nada muda e o pagamento vai para "Devoluções a fazer".
- **Status existentes respeitados:** `ativa`, `inadimplente`, `suspensa`. A loja suspensa não consegue pedir cobrança;
  se um Pix antigo for pago, o período é somado mas a loja **continua suspensa** e o pagamento ganha uma observação.
  "Vencida/atrasada" é calculada (plano pago com vencimento no passado), sem mudar o status: assim a vitrine não some
  do site; a rotina diária que já existia pausa os anúncios quando o limite vira 0.
- **Devolução / contestação no cartão** (`estornado`): o plano volta para como estava antes daquele pagamento
  (termina na data paga anterior). Se outro pagamento veio depois, só tira o tempo que faltava daquele.
- **Lembrete de renovação:** não existe tabela de notificações na base. "Meu plano" mostra o aviso na tela.
  O lembrete por WhatsApp/notificação fica para a etapa das mensagens automáticas (tela 13): usar
  `assinatura.aviso_vencimento_dias` e `minha_assinatura()`.

## 3. Anúncio avulso (pessoa física)

- Onde aparece: no Revisar, quando o limite barra (`P0001` do gatilho de limite, mostrado pelo `BotaoPublicar`), o
  aviso ganha **"Pagar anúncio avulso"**; e na tela de limite antes do passo 1 ("Fazer um anúncio avulso" começa um
  rascunho e, no fim, oferece o pagamento).
- Tela `/anunciar/avulso?id=<anuncio>`: preço e dias do painel (por região), Pix (QR + copia e cola + espera) ou cartão.
- **Escolha (a mais clara e segura):** o pagamento confirmado **publica sozinho**. Só chega no pagamento quem tocou em
  Publicar com o anúncio completo (o banco confere antes de cobrar). Se algo impedir na hora (moderação, campo que
  mudou), o anúncio fica com `pago_ate` e a pessoa só toca em Publicar: o gatilho de limite deixa passar.
- Devolução: tira de `pago_ate` o tempo que aquele pagamento deu. Se `pago_ate` era o único motivo de estar no ar
  (não cabe no plano grátis), o anúncio vai para **pausado** (nunca é apagado).
- Avulso vencido: a rotina diária passa o anúncio para **expirado** se ele não couber no plano; a pessoa pode pagar de novo.

## 4. Telas e rotas

| Rota | O que é |
|---|---|
| `/minha-conta/plano` | Plano atual, aviso de renovar, troca marcada, planos com período (chips), preço e regra antes de pagar, Pix/cartão, espera e sucesso. `?plano=` pré-escolhe; `?p=<pagamento>` retoma |
| `/anunciar/avulso?id=` | Pagamento do anúncio avulso |
| `/admin/pagamentos` | Tela 6: filtros (status, tipo, região, período), totais, link da fatura do Asaas, copiar link ("reenviar" pelo WhatsApp fica para a fase 2), devoluções a fazer, exportar CSV |
| `/admin/pagamentos/csv` | Rota do servidor, só admin (confere `e_admin` com o token do admin; RLS também barra), `;` e BOM para abrir no Excel, protegido contra fórmula em célula |
| `/admin/lojas` | Tela 5: lista de lojas e vendedores com plano, vencimento, anúncios no ar, propostas usadas, situação; ações com motivo; verificações pendentes |

Código: `src/lib/cobranca-pagamento.ts` (núcleo comum de cobrança no Asaas, usado também pelos destaques:
`cobranca-destaque.ts` só chama o núcleo), `src/lib/dados/cobranca.ts`, `src/app/(conta)/pagar/actions.ts`,
`src/components/cobranca/*` (fluxo de pagamento, escolher plano, avulso), `src/lib/admin/pagamentos.ts` (filtros
da tela 6, usados pela lista e pelo CSV), `src/app/admin/lojas/*`, `src/app/admin/pagamentos/*`, tipos em
`src/lib/tipos-cobranca.ts`. Testes do banco: `supabase/testes/80_cobranca_planos.sql`.

Fica para depois: reenviar o link pelo WhatsApp (fase 2; hoje é "Copiar link"), envio de documentos e bucket
privado `verificacoes`, lembrete de renovação por mensagem (tela 13).
