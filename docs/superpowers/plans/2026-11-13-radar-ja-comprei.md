# Radar · IA do "já comprei" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando o cliente escreve numa conversa algo como "já comprei", a IA percebe e mostra só para ele uma faixa "Posso tirar o pedido do Radar?"; o pedido só sai do ar se ele confirmar.

**Architecture:** Depois que o cliente envia a mensagem, o servidor (fora da resposta, com `after()` do Next) roda um filtro de palavras; só se passar, pede ao banco o "candidato" (mensagem do cliente + pedido aberto daquela conversa), reserva no livro-caixa da IA do Radar (`radar_ia_uso`, parte nova `ja_comprei`) e pergunta ao JEV. Se o JEV disser "já resolveu", o banco grava uma pergunta pendente por pedido. A tela da conversa mostra a faixa; "Sim, pode tirar" abre a folha que já existe ("Com quem você resolveu?"); "Não, ainda preciso" grava a recusa e nunca mais pergunta para aquele pedido.

**Tech Stack:** Next 15.5 (server actions, `after` de `next/server`), Supabase (funções `security definer`), TypeSafe JEV (`src/lib/radar-ia/jev.ts`). Testes: `tests/*.test.cjs` (`npm test`) e `supabase/testes/*.sql` (`npm run test:db`, Postgres embutido + shim).

**Spec:** `docs/designs/radar-v2.md` (seção "Chat Conversas": "A IA lê só esse chat; ao perceber 'já comprei', pergunta ao cliente se pode tirar o pedido; só tira com a confirmação.") + decisões abaixo.

## Decisões do Raniel (13/11/2026)

| Tema | Decisão |
|---|---|
| O que a IA lê | Só mensagens **do cliente**, em conversa com proposta de um pedido **dele ainda aberto** no Radar |
| Filtro | Só vai para a IA mensagem com palavra de compra ("comprei", "achei", "consegui", "resolvi"…); o resto nunca sai do site |
| Quando | Na hora em que o cliente envia, sem atrasar o envio |
| Qual IA | JEV (julga); sem Gemini |
| Onde pergunta | Faixa na própria conversa, só para o cliente; a loja não vê |
| Texto | "Parece que você já resolveu “{pedido}”." / "Posso tirar o pedido do Radar?" / [Sim, pode tirar] [Não, ainda preciso] |
| Se sim | Abre a folha que já existe "Com quem você resolveu?" (lojas que mandaram oferta + "Outro lugar") e depois 👍/👎 |
| Se não | Faixa some e a IA nunca mais pergunta sobre aquele pedido |
| Custo | Dentro do teto atual do Radar (R$ 30/mês) e dos 20 usos por dia por pessoa |
| Ligar | Chave própria `radar_ia.ja_comprei_ativa` = `false`; política nova no PR, publicada pelo Raniel em `/admin/textos` antes de ligar |

## Global Constraints

- Ramo `claude/radar-ia-ja-comprei-f85f8c` a partir de `origin/main` (a9f8796). PR para `main` com `gh` como haniellevi. Sem merge, sem migração em produção, sem ligar a chave.
- Migração nova única: `supabase/migrations/20261122010000_radar_ja_comprei.sql`. Nunca editar migração antiga. Teste SQL: `supabase/testes/810_radar_ja_comprei.sql`, registrado em `automatizados.py` com `PASS:` próprio, logo depois do `790_radar_ia.sql`.
- Funções novas: `security definer`, `set search_path = public, extensions`, `revoke all ... from public, anon, authenticated`; as de servidor exigem `service_role` (mesmo `if` de `radar_ia_reservar`) e só `grant ... to service_role`; as da tela `grant ... to authenticated`.
- Config (grupo `radar`, `where not exists` como em `20261121010000`): `radar_ia.ja_comprei_ativa` = `false`, descrição "IA do Radar: percebe \"já comprei\" na conversa e pergunta ao cliente se pode tirar o pedido".
- `radar_ia_uso.parte` passa a aceitar `'ja_comprei'` (drop + add do check, nome do constraint pelo catálogo). `radar_ia_reservar` e `radar_ia_estado` recriadas (`create or replace`, mesmo corpo) aceitando/devolvendo `ja_comprei`; `ja_comprei` usa provedor `typesafe`, modelo `jev-latest`.
- Para o JEV vão só: título do pedido (até 120 letras) e o texto da mensagem (até 300), com link e sequência de 8+ dígitos trocados por `[removido]`. Nada de nome, telefone, loja ou outras mensagens. Custo gravado: `CUSTO_JEV_USD` (US$ 0,0002).
- O que fica guardado: só a pergunta pendente/recusada por pedido (tabela `conversa_ja_comprei`) e `conversa_mensagens.ia_lida_em`; nada da resposta da IA além disso.
- JEV com chance `ja_resolveu` ≥ 0,7 = perguntar. Falha, demora (3 s), sem reserva: nada acontece, sem aviso.
- Copy exata (acima, tabela "Texto"). Modo fácil: botões `min-h-12` (`tamanho="grande"`), corpo `text-facil`, nenhum ícone sem texto. Componentes de `src/components/ui/`. Rodar `ui-consistency:finding-patterns` antes da Task 3.
- Fim de cada tarefa: `npm test`, `npm run typecheck`, `npm run lint` (em worktree: `node_modules/.bin/eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx src`); tarefas com SQL também `npm run test:db`.

## Review Focus

1. **Loja escreve "o cliente já comprei comigo"** ou mensagem do cliente numa conversa só de anúncio (sem pedido) → a IA não lê (candidato nulo). Teste SQL Task 1.
2. **Chave desligada, teto do mês, 21º uso do dia** → o `fetch` do JEV nunca é chamado. Teste SQL Task 1 (reserva nula) e Node Task 2.
3. **"Não, ainda preciso" e depois outro "comprei"** → nenhuma faixa nova para aquele pedido; um pedido novo da mesma loja pode perguntar de novo. Teste SQL Task 1.
4. **Toca "Sim, pode tirar" e fecha a folha sem escolher** → pedido continua aberto e a faixa continua lá. Garantido por desenho (o "Sim" não grava nada; só `resolver_pedido_radar` fecha); teste SQL Task 1 confere que a faixa só some com pedido fechado ou recusa.
5. **Mensagem com telefone ou link** ("comprei, me liga 89 99999-0000") → o número não vai para o JEV. Teste Node Task 2 (corpo do `fetch`).

---

### Task 1: Banco — chave, candidato, pergunta pendente e recusa

**Files:**
- Create: `supabase/migrations/20261122010000_radar_ja_comprei.sql`
- Test: `supabase/testes/810_radar_ja_comprei.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces (Produces):**
- tabela `conversa_ja_comprei (pedido_id uuid primary key references radar_pedidos on delete cascade, conversa_id uuid not null references conversas on delete cascade, mensagem_id uuid references conversa_mensagens on delete set null, estado text not null check (estado in ('perguntando','nao')), criado_em timestamptz not null default now(), respondido_em timestamptz)`; RLS ligada, sem policy, sem grant.
- `ja_comprei_candidato(p_mensagem uuid) returns jsonb` (service_role): `{mensagem_id, usuario_id, texto, pedido_id, pedido_titulo}` ou `null`. Nulo quando: `radar_ia_estado()->>'ja_comprei'` não é true; conversas desligadas; mensagem não é `tipo='texto'` e `lado='cliente'`; `ia_lida_em` já preenchido; nenhum cartão `proposta` na conversa cujo pedido seja do `cliente_id` da conversa, `status='aberto'`, `expira_em > now()` e sem linha em `conversa_ja_comprei`. Havendo vários, o pedido do cartão de proposta mais recente.
- `ja_comprei_registrar(p_mensagem uuid, p_pedido uuid, p_resolveu boolean) returns boolean` (service_role): marca `ia_lida_em = now()` na mensagem; se `p_resolveu`, insere `('perguntando')` com `on conflict do nothing` só se o pedido ainda passa nas regras do candidato; devolve se inseriu.
- `ja_comprei_pendente(p_conversa uuid) returns table (pedido_id uuid, pedido_titulo text)` (authenticated): 0 ou 1 linha; só com `conversa_papel = 'cliente'`, conversas ligadas, linha `perguntando` e pedido ainda `aberto`.
- `recusar_ja_comprei(p_pedido uuid) returns void` (authenticated): só o comprador (`42501` "Pedido não encontrado."); `perguntando` → `nao`, `respondido_em = now()`; repetido não muda nada.

- [ ] **Step 1: Escrever `810_radar_ja_comprei.sql`** (estilo `pg_temp.confere`/`recusa` do `790_radar_ia.sql`; cliente C, loja L com proposta no pedido P de C, `conversas.ativa`, `radar_ia.ativa` e `radar_ia.ja_comprei_ativa` ligadas):
  - mensagem "já comprei" de C → candidato com `pedido_id = P` e `texto`; com `ja_comprei_ativa=false` → nulo; mensagem da loja → nulo; mensagem de C numa conversa só de anúncio → nulo; P fechado (`fechar_pedido_radar`) → nulo.
  - `radar_ia_reservar(C, 'ja_comprei')` devolve id com `provedor='typesafe'`; com `usos_por_dia=1` a 2ª é nula.
  - `ja_comprei_registrar(m, P, false)` → `ia_lida_em` preenchido e candidato da mesma mensagem nulo; `registrar(m2, P, true)` → `ja_comprei_pendente(conversa)` para C traz P; para o dono da L → 0 linhas.
  - `recusar_ja_comprei(P)` pela loja → `42501`; por C → pendente vazio; nova mensagem "comprei" de C → candidato nulo (Review Focus 3); proposta da L num pedido novo P2 de C → candidato com P2.
  - pendente some quando P é resolvido por `resolver_pedido_radar` (Review Focus 4); `authenticated` chamando `ja_comprei_candidato` → `42501`.
- [ ] **Step 2: Registrar em `automatizados.py` e rodar** `npm run test:db` — Expected: FAIL (`ja_comprei_candidato` não existe).
- [ ] **Step 3: Escrever a migração** com as interfaces e os itens de banco do Global Constraints.
- [ ] **Step 4: Rodar** `npm run test:db` — Expected: `PASS:` do 810 e os antigos (790 IA, 790/800 conversas, Radar 90).
- [ ] **Step 5: Commit** `feat(radar-ia): banco do "já comprei" (candidato, pergunta pendente e recusa), desligado`

### Task 2: Servidor — filtro, JEV e gancho no envio

**Files:**
- Create: `src/lib/radar-ia/ja-comprei.ts`, `src/components/conversas/palavras-compra.ts` (puro, usado também no navegador)
- Modify: `src/lib/radar-ia/uso.ts` (`ParteIA` + `ja_comprei`; `EstadoIA`/`DESLIGADA`), `src/app/(conta)/conversas/actions.ts` (`enviarMensagem` agenda com `after`; ações `jaCompreiRecusar`)
- Test: `tests/radar-ja-comprei.test.cjs`

**Interfaces:**
- Consumes: RPCs da Task 1; `comReserva`, `perguntarJev`, `CUSTO_JEV_USD`.
- Produces:
  - `temPalavraDeCompra(texto: string): boolean` — sem acento e minúsculo; casa `\b(comprei|compramos|achei|consegui|resolvi|resolvido|peguei|fechei|fechamos|adquiri|ganhei|ja tenho|nao preciso mais)\b`.
  - `mascararParaIA(texto: string): string` — troca `https?://\S+`, `www\.\S+`, e-mail e 8+ dígitos (ignorando espaço, ponto, traço, parênteses) por `[removido]`; corta em 300.
  - `verificarJaComprei(mensagemId: string): Promise<boolean>` em `ja-comprei.ts` — candidato → `comReserva(usuario_id, "ja_comprei", …)` com `perguntarJev({ estado: { pedido, mensagem }, instrucao, criterios: { ja_resolveu, ainda_procura } })` → `ja_comprei_registrar(mensagem, pedido, chance ≥ 0.7)`. Sem candidato ou sem reserva: `false`, sem `fetch`. Sem resposta do JEV: não registra (pode tentar na próxima mensagem).
  - `enviarMensagem`: depois do `ok`, se `temPalavraDeCompra(texto)`, `after(() => verificarJaComprei(id))` (erro engolido).
  - `jaCompreiRecusar(conversaId: string, pedidoId: string): Promise<Resultado<null>>` — login, `ehUuid` nos dois, RPC `recusar_ja_comprei`, `revalidatePath(linkConversa(conversaId))`.
- [ ] **Step 1: Testes** (mocks como em `tests/radar-ia.test.cjs`): palavras ("Já comprei, obrigado" true; "Comprei!" true; "tem azul?" false; "você comprou?" false); `mascararParaIA("comprei, me liga (89) 99999-0000 www.x.com")` sem dígitos nem `www`; candidato nulo → `fetch` não chamado; reserva nula → `fetch` não chamado; JEV `ja_resolveu: 0.9` → `ja_comprei_registrar` com `p_resolveu: true` e corpo do `fetch` sem o telefone (Review Focus 5); `0.5` → `p_resolveu: false`; JEV erro → registrar não chamado; `enviarMensagem` com "tem azul?" não agenda `after`; `jaCompreiRecusar` sem login ou id inválido não chama RPC.
- [ ] **Step 2: `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npm test && npm run typecheck`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(radar-ia): JEV percebe "já comprei" depois do envio, com filtro de palavras`

### Task 3: Tela — faixa na conversa do cliente

**Files:**
- Create: `src/components/conversas/faixa-ja-comprei.tsx`
- Modify: `src/lib/dados/conversas.ts` (`jaCompreiPendente(conversaId): Promise<{ pedido_id: string; pedido_titulo: string } | null>`), `src/app/(conta)/conversas/[id]/page.tsx`, `src/components/radar/folha-resolver.tsx` (props opcionais `rotulo` e `aoAbrir`, padrão igual a hoje), `src/components/conversas/conversa-aberta.tsx` (cliente que envia texto com `temPalavraDeCompra` → `router.refresh()` 4 s depois)
- Test: `tests/radar-ja-comprei.test.cjs` (form sem `name="id"` já coberto por `tests/form-campo-id.test.cjs`)

**Interfaces:**
- Consumes: Task 1 (`ja_comprei_pendente`), Task 2 (`jaCompreiRecusar`, `temPalavraDeCompra`), `propostasDoPedido` de `src/lib/dados/radar.ts`, `FolhaResolver`.
- Produces: `FaixaJaComprei({ conversaId, pedidoId, pedidoTitulo, lojas: LojaComProposta[] })` — cartão com a copy exata; "Sim, pode tirar" = `FolhaResolver` com `rotulo="Sim, pode tirar"`; "Não, ainda preciso" = botão secundário que chama `jaCompreiRecusar` e esconde a faixa; erro em `Alert`. A página só monta quando `papel === "cliente"` e há pendente, entre o aviso fixo e as mensagens.
- [ ] **Step 1: `ui-consistency:finding-patterns`** sobre a página da conversa e `folha-resolver.tsx`; checklist em `docs/designs/ja-comprei-checklist-ui.md`.
- [ ] **Step 2: Implementar** seguindo o checklist.
- [ ] **Step 3: Ver a tela** (render estático com dados de exemplo) em 375 px e desktop; `ui-consistency:verifying`.
- [ ] **Step 4: `npm run lint && npm run typecheck && npm test`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(conversas): faixa "Posso tirar o pedido do Radar?" para o cliente`

### Task 4: Política, documentação e PR

**Files:**
- Modify: `docs/designs/conversas-politica-privacidade.md` (parágrafo "Inteligência artificial" novo), `docs/radar-ia.md` (item 5 "Já comprei", chave, como ligar), `docs/designs/radar-v2.md` ("Falta" vira "Feito, desligado")

- [ ] **Step 1: Texto da política** (substitui o parágrafo atual de IA nas Conversas; diz só o que o código faz): só mensagens do cliente, só em conversa com pedido aberto no Radar, só as que têm palavra de compra; vão o texto da mensagem (sem links e números) e o título do pedido para a TypeSafe; para quê; o que fica guardado (que a mensagem foi lida e a pergunta pendente/recusada); a loja não vê; nada sai do ar sem o cliente confirmar.
- [ ] **Step 2: `npm run lint && npm run typecheck && npm test && npm run test:db`** — Expected: PASS.
- [ ] **Step 3: Commit** `docs(radar-ia): política e como ligar o "já comprei"`
- [ ] **Step 4: PR para `main`** (skill `pr`, pt-BR): o que muda, migração, chave desligada, passos para ligar (merge → migração com ensaio → publicar a política → ligar `radar_ia.ja_comprei_ativa`), tudo com "sim" do Raniel.
