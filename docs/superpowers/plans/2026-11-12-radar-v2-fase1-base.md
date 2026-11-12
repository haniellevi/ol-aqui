# Radar v2 · Fase 1 (Base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O pedido do Radar passa a ter área (região toda ou várias cidades), visibilidade (só lojas / todo mundo), até 5 lojas, prazo de 15 dias com lembrete e até 2 extensões, "Com quem resolveu" + 👍/👎, "Eu sei onde tem", regra nova de quem atende (verificada + paga, ou cortesia do admin) e aviso de pedido novo só para o Full.

**Architecture:** As regras ficam no banco (Supabase/Postgres, funções `SECURITY DEFINER` e gatilhos), como no Radar atual; o site só chama RPCs por server actions. Três migrações novas (quem atende, pedido novo, prazo/resolução/indicação) e ajustes nas telas existentes de `src/app/radar` e `src/components/radar`. Nada de chat, IA nem WhatsApp nesta fase.

**Tech Stack:** Next 15.5 + React 19, Clerk, Supabase (RLS, pg_cron), Tailwind 4 (tokens em `src/app/globals.css`), lucide-react. Testes: SQL em `supabase/testes/*.sql` (rodados por `npm run test:db`, que usa Docker) e Node em `tests/*.test.cjs` (`npm test`).

**Spec:** `docs/designs/radar-v2.md` (decisões). Base atual: `docs/etapa4/radar.md`.

## Global Constraints

- Trabalhar na worktree `.claude/worktrees/radar-v2`, ramo `claude/radar-v2`, a partir de `origin/main` (7cff6de).
- Migrações novas: `20261117010000_radar_quem_atende.sql`, `20261117020000_radar_pedido_area.sql`, `20261117030000_radar_prazo_resolucao.sql`. Nunca editar migração antiga; redefinir função com `create or replace` (ou `drop` + `create` quando a assinatura muda) e repetir `revoke`/`grant`.
- Toda função nova: `security definer`, `set search_path = public, extensions`, `revoke ... from public, anon`, `grant execute ... to authenticated` (ou só `service_role` para rotina).
- Limites e textos ficam em `configuracoes` (grupo `radar`) com `on conflict do nothing`; nunca sobrescrever valor que o admin já mudou (use `update ... where valor = '<padrão antigo>'::jsonb`).
- Mensagens de erro em pt-BR simples, com `errcode` e `detail = 'campo:<nome>'` quando é de campo, como nas funções atuais.
- Testes SQL novos: `supabase/testes/600_radar_quem_atende.sql`, `610_radar_area_visibilidade.sql`, `620_radar_aviso_full.sql`, `630_radar_prazo.sql`, `640_radar_resolver_indicar.sql`, cada um registrado em `supabase/testes/automatizados.py` com uma linha `PASS:` própria, no mesmo estilo dos existentes (`pg_temp.confere` / `pg_temp.recusa`, ver `350_radar_arquivo.sql`).
- Copy (exata): botão de entrada **"Estou procurando…"**; frase **"Diga o que precisa. As lojas da região te respondem."**; área **"Toda a região"** / **"Escolher cidades"**; visibilidade **"Só lojas"** (ajuda: "Só lojas verificadas da região veem seu pedido.") / **"Todo mundo"** (ajuda: "Qualquer pessoa da região vê e pode te indicar onde tem."); **"Ainda preciso"**, **"Já resolvi"**, **"Pedir de novo"**, **"Eu sei onde tem"**, **"Com quem você resolveu?"**, **"Outro lugar"**, **"Como foi?"**.
- Modo fácil em todas as telas tocadas: botões com `min-h-12` (48px), texto do corpo `text-lg` (18px), uma pergunta por tela no formulário de pedido, nenhum ícone sem texto visível ao lado.
- Componentes só de `src/components/ui/` (botao, campo, chip, vazio); sem shadcn; nunca branco sobre laranja (DESIGN.md).
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:db` passam no fim de cada tarefa.

## Review Focus

1. Loja com `vitrines_lojas.cidade` escrita diferente da tabela `cidades` (acento, maiúscula, espaço) num pedido com cidades marcadas → deve casar ignorando acento/maiúscula/espaço; se não casar com nenhuma cidade, a loja fica fora (não vê nem é avisada). Teste em Task 2.
2. Pedido antigo (criado antes da migração) → passa a valer `visibilidade = 'lojas'`, área = região toda, `extensoes = 0`; continua aparecendo e aceitando oferta das lojas que atendem. Teste em Task 2.
3. Cortesia vencida (`ate` no passado) ou loja Full que caiu para Slim → para de ver pedidos "Só lojas", de propor e de ser avisada na hora, sem precisar de rotina. Testes em Task 1 e Task 3.
4. "Ainda preciso" em pedido fechado, vencido, de outra pessoa ou já estendido 2 vezes → recusado com mensagem clara; o botão nem aparece na tela. Teste em Task 4.
5. Pedido "Só lojas" aberto por link direto (`/radar/<id>`) por quem não atende → não mostra título nem detalhes, mostra "Este pedido é só para lojas verificadas." e os planos. Teste em Task 2 (função `radar_pedido`) e Task 7 (tela).

---

### Task 1: Quem atende o Radar (verificada + paga, ou cortesia) e aviso só Full

**Files:**
- Create: `supabase/migrations/20261117010000_radar_quem_atende.sql`
- Test: `supabase/testes/600_radar_quem_atende.sql`
- Modify: `supabase/testes/automatizados.py` (registrar o teste)

**Interfaces:**
- Produces:
  - `planos.aviso_radar_na_hora boolean not null default false` (seed: `full` = true).
  - tabela `radar_cortesias (vitrine_id uuid primary key references vitrines_lojas on delete cascade, ate timestamptz not null, motivo text check (char_length(motivo) between 3 and 300), criado_por text not null, criado_em timestamptz default now())`; RLS ligada, sem policies (só funções).
  - `radar_cortesia_ativa(p_vitrine uuid) returns boolean` (stable).
  - `pode_atender_radar(uid text default usuario_id()) returns boolean`: verdadeiro se a vitrine do `uid` está `ativa` e (cortesia ativa) **ou** (verificada **e** plano pago). Verificada = `tipo = 'loja'` e `selo_loja_verificada`; ou `tipo = 'pf'` e `perfis.selo_negociador_certificado` e `perfis.verificacao_pf_em is not null`. Plano pago = `plano_efetivo(v)`: `acesso_radar` e `not e_teste` e `preco_centavos > 0`.
  - `recebe_aviso_radar_na_hora(uid text) returns boolean`: cortesia ativa, ou (`pode_atender_radar(uid)` e `plano_efetivo(v).aviso_radar_na_hora`).
  - `tem_plano_pago(uid)` redefinida para `return pode_atender_radar(uid)` (mantém todos os chamadores atuais: feed, `propor_radar`, `pode_enviar_foto`); comentário dizendo que o nome é histórico.
  - `propostas_restantes(uid)` devolve `null` (ilimitado) quando há cortesia ativa.
  - admin: `dar_cortesia_radar(p_vitrine uuid, p_ate date, p_motivo text) returns void` e `tirar_cortesia_radar(p_vitrine uuid) returns void`; exigem `e_admin()` (senão `42501`); `p_ate` precisa ser futura e no máximo 365 dias (`23514`, `campo:ate`); `ate` grava fim do dia em `America/Fortaleza`; registram em `logs_atividade` como os gatilhos atuais.

- [ ] **Step 1: Escrever `600_radar_quem_atende.sql` com estes casos (cada um um `pg_temp.confere`)**
  - loja verificada + Full → `pode_atender_radar` true, `recebe_aviso_radar_na_hora` true.
  - loja verificada + Slim → atende true, aviso na hora false.
  - loja **não** verificada + Full → atende false; `propor_radar` recusa com `42501`.
  - loja em `teste` (verificada) → atende false.
  - PF com `selo_negociador_certificado` + `verificacao_pf_em` + Slim → atende true; PF sem `verificacao_pf_em` → false.
  - loja sem plano pago com cortesia até amanhã → atende true, aviso true, `propostas_restantes` null.
  - mesma loja com `ate` ontem (update direto como postgres) → atende false (Review Focus 3).
  - `dar_cortesia_radar` por não admin → `42501`; com data passada → `23514`; com 400 dias → `23514`.
  - `tirar_cortesia_radar` → atende volta a false.
- [ ] **Step 2: Registrar no `automatizados.py` e rodar `npm run test:db`** — Expected: FAIL (função `pode_atender_radar` não existe).
- [ ] **Step 3: Escrever a migração** com as interfaces acima e a coluna nova em `planos` (`update planos set aviso_radar_na_hora = true where codigo = 'full'`).
- [ ] **Step 4: Rodar `npm run test:db`** — Expected: `PASS:` do 600 e todos os testes antigos do Radar (90, 200, 330, 340, 350) ainda passando. Se algum teste antigo usa loja sem selo para propor, ajustar **o dado do teste** (dar o selo), nunca a regra, e anotar no commit.
- [ ] **Step 5: Commit** `feat(radar): quem atende = verificada e paga ou cortesia; aviso na hora só Full`

### Task 2: Pedido com área, visibilidade e até 5 lojas

**Files:**
- Create: `supabase/migrations/20261117020000_radar_pedido_area.sql`
- Test: `supabase/testes/610_radar_area_visibilidade.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces:**
- Consumes: `pode_atender_radar(uid)` (Task 1).
- Produces:
  - colunas em `radar_pedidos`: `visibilidade text not null default 'lojas' check (visibilidade in ('lojas','todos'))`, `cidades_ids uuid[]` (null = região toda; no máximo 20 itens).
  - gatilho `radar_validar_pedido` redefinido: se `cidades_ids` não é null, toda cidade precisa ser `ativa` e da mesma `microrregiao_id` (senão `23514`, `campo:cidades`, "Escolha cidades da sua região."); remove repetidas; grava `cidade` = nomes separados por ", " (até 120 letras, termina em "…" se cortar); se null, grava `cidade = 'Toda a região'`. O gatilho passa a disparar também em `update of cidades_ids`.
  - `proteger_radar_v4` redefinida: comprador não muda `visibilidade` nem `cidades_ids` depois de criado.
  - `radar_pedido_na_area(p_pedido radar_pedidos, p_vitrine vitrines_lojas) returns boolean` (immutable-ish/stable): mesma região e (`cidades_ids` null ou existe cidade em `cidades_ids` cujo `sem_acento(lower(btrim(nome)))` = `sem_acento(lower(btrim(v.cidade)))`).
  - `radar_pode_ver_pedido(p_pedido radar_pedidos, uid text) returns boolean`: comprador; admin; `visibilidade = 'todos'` e mesma região do perfil; ou `pode_atender_radar(uid)` e `radar_pedido_na_area` com a vitrine do uid.
  - `radar_feed_regional`, `radar_feed` e `radar_pedido` redefinidas com o filtro `radar_pode_ver_pedido` e duas colunas novas no retorno: `visibilidade text`, `area_texto text` (= `cidade`). `radar_pedido` de pedido que o uid não pode ver devolve uma linha só com `id`, `visibilidade = 'lojas'` e `bloqueado = true` (coluna nova), sem título/detalhes.
  - `criar_pedido_radar_site` recriada (drop da assinatura antiga + create) com dois parâmetros novos **no fim e com padrão**: `p_cidades_ids uuid[] default null`, `p_visibilidade text default 'lojas'`; `p_cidade` passa a ser opcional (`default null`) e é ignorado quando `p_cidades_ids` vem. `criar_pedido_radar` (usada pelo Merc) ganha os mesmos dois parâmetros com padrão.
  - config `radar.max_propostas_padrao`: `update configuracoes set valor = '5' where chave = 'radar.max_propostas_padrao' and valor = '10'::jsonb`.

- [ ] **Step 1: Escrever `610_radar_area_visibilidade.sql`**
  - pedido com `cidades_ids` de 2 cidades da região → `cidade = 'Corrente, Gilbués'` (use 2 cidades ativas do seed); com cidade de outra região → `23514`.
  - pedido sem cidades → `cidade = 'Toda a região'`.
  - loja atendente com `cidade = ' corrente '` vê pedido de Corrente; loja com `cidade = 'Parnaguá'` não vê (Review Focus 1).
  - pedido `lojas`: usuário comum da região não vê no `radar_feed_regional`; `radar_pedido(id)` devolve `bloqueado = true` sem título (Review Focus 5). Pedido `todos`: usuário comum vê.
  - pedido antigo inserido sem `visibilidade` → `'lojas'` e loja atendente vê e propõe (Review Focus 2).
  - comprador tenta `update radar_pedidos set visibilidade='todos'` → valor não muda.
  - pedido novo recebe `max_propostas = 5`; 6ª loja atendente → `propor_radar` recusa (`P0001`).
- [ ] **Step 2: Registrar e rodar `npm run test:db`** — Expected: FAIL (coluna `visibilidade` não existe).
- [ ] **Step 3: Escrever a migração.**
- [ ] **Step 4: Rodar `npm run test:db`** — Expected: PASS 600, 610 e antigos.
- [ ] **Step 5: Commit** `feat(radar): pedido com várias cidades, visibilidade e até 5 lojas`

### Task 3: Aviso de pedido novo só para Full (e cortesia), dentro da área

**Files:**
- Modify: `supabase/migrations/20261117020000_radar_pedido_area.sql` (mesma migração da Task 2, seção nova no fim)
- Test: `supabase/testes/620_radar_aviso_full.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces:**
- Consumes: `recebe_aviso_radar_na_hora(uid)` (Task 1), `radar_pedido_na_area` (Task 2).
- Produces: `radar_avisar_pedido_novo()` redefinida: troca o bloco de plano (`not p.e_teste and p.preco_centavos > 0 and p.acesso_radar and ... propostas_restantes`) por `public.recebe_aviso_radar_na_hora(v.dono_id)` e acrescenta `public.radar_pedido_na_area(new, v)`. Mantém nicho, preferências, tetos por dia/comprador e chave anti-duplicata exatamente como hoje (`20261110130100_radar_avisos_nicho.sql`).

- [ ] **Step 1: Escrever `620_radar_aviso_full.sql`**: num pedido novo de Corrente com nicho X, recebem aviso: Full verificada de Corrente com anúncio no nicho; cortesia de Corrente com anúncio no nicho. **Não** recebem: Slim verificada (Corrente, nicho X); Full de Parnaguá; Full sem anúncio no nicho. Depois de a Full cair para Slim (troca do plano), pedido novo não avisa mais (Review Focus 3). O teste `340_radar_avisos_nicho.sql` antigo: se esperava aviso para Slim, ajustar o dado para Full e anotar no commit.
- [ ] **Step 2: Rodar `npm run test:db`** — Expected: FAIL no caso Slim.
- [ ] **Step 3: Redefinir a função.**
- [ ] **Step 4: Rodar `npm run test:db`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(radar): aviso de pedido novo só Full e cortesia, na área do pedido`

### Task 4: Prazo de 15 dias, lembrete 2 dias antes e "Ainda preciso" (até 2 vezes)

**Files:**
- Create: `supabase/migrations/20261117030000_radar_prazo_resolucao.sql`
- Test: `supabase/testes/630_radar_prazo.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces:**
- Produces:
  - colunas em `radar_pedidos`: `extensoes smallint not null default 0 check (extensoes between 0 and 10)`, `lembrete_em timestamptz`.
  - configs: `radar.extensoes_max` = `2`, `radar.lembrete_dias` = `2`, `radar.aviso.vai_vencer.titulo` = `"Seu pedido vence em 2 dias"`, `radar.aviso.vai_vencer.texto` = `"Você achou “{pedido}”? Se ainda precisa, toque em Ainda preciso e ele fica mais 15 dias."`; `radar.avisos_ligados` e `radar.avisos_escolha` ganham `vai_vencer` (update que acrescenta ao array só se ainda não tiver).
  - `estender_pedido_radar(p_id uuid) returns timestamptz` (nova `expira_em`): só o comprador (`42501`); pedido `aberto` e `expira_em > now()` (senão `P0002`, "Este pedido não está mais aberto."); `extensoes < radar.extensoes_max` (senão `P0001`, "Este pedido já foi estendido 2 vezes. Toque em Pedir de novo."). Soma `radar.dias_pedido` dias a `expira_em`, `extensoes + 1`, `lembrete_em = null`, e no modo `propostas_prazo` estende `propostas_ate` pelo mesmo tanto. Usa `set_config('olaki.sistema','1',true)` para passar pelo `proteger_radar_v4`, como `radar_propor` faz com o contador.
  - `radar_lembrar_vencimento() returns integer` (só `service_role`): para pedidos `aberto`, `lembrete_em is null` e `expira_em` entre `now()` e `now() + radar.lembrete_dias`, chama `radar_aviso(comprador, 'vai_vencer', regiao, {pedido}, '/radar/pedido/<id>', 'vai_vencer:<id>:<extensoes>')` e grava `lembrete_em = now()`. Devolve quantos avisou.
  - cron `olaki-radar-lembretes` `'5 * * * *'` → `select public.radar_lembrar_vencimento()`, agendado como em `20261111030000_favoritos_radar.sql:69` (só se o pg_cron existir).
  - `meus_pedidos_radar(p_arquivo boolean)` e `radar_pedido` devolvem também `extensoes` e `pode_estender boolean` (= dono, aberto, não vencido, `extensoes < max`, e faltam ≤ `lembrete_dias`).

- [ ] **Step 1: Escrever `630_radar_prazo.sql`**: pedido vencendo em 1 dia → `radar_lembrar_vencimento()` = 1 e cria 1 notificação `vai_vencer`; rodar de novo → 0. `estender_pedido_radar` pelo dono → `expira_em` +15 dias, `extensoes = 1`; segunda vez → 2; terceira → `P0001`. Por outra pessoa → `42501`. Pedido `atendido` → `P0002`. Pedido vencido → `P0002` (Review Focus 4). Depois de estender, lembrete volta a ser possível (chave com `extensoes` diferente).
- [ ] **Step 2: Rodar** — Expected: FAIL.
- [ ] **Step 3: Escrever a migração (seção prazo).**
- [ ] **Step 4: Rodar** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(radar): lembrete 2 dias antes e Ainda preciso até 2 vezes`

### Task 5: "Com quem você resolveu?" + 👍/👎 e "Eu sei onde tem"

**Files:**
- Modify: `supabase/migrations/20261117030000_radar_prazo_resolucao.sql`
- Test: `supabase/testes/640_radar_resolver_indicar.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces:**
- Produces:
  - colunas em `radar_pedidos`: `resolvido_proposta_id uuid references radar_propostas(id) on delete set null`, `resolvido_fora boolean`, `avaliacao smallint check (avaliacao in (-1, 1))`.
  - `resolver_pedido_radar(p_id uuid, p_proposta_id uuid default null, p_fora boolean default false) returns void`: só o comprador; fecha como hoje (`status = 'atendido'`, `fechado_motivo = 'resolvido'`, `fechado_em = now()`); `p_proposta_id` precisa ser proposta `ativa` desse pedido (`23514`, `campo:proposta`); `p_fora` e `p_proposta_id` não podem vir juntos.
  - `avaliar_pedido_radar(p_id uuid, p_avaliacao smallint) returns void`: só o comprador, só pedido `atendido` com `resolvido_proposta_id` não nulo, valor -1 ou 1; pode trocar a nota.
  - `fechar_pedido_radar(id, 'resolvido')` continua funcionando (sem loja).
  - tabela `radar_indicacoes (id uuid pk default gen_random_uuid(), pedido_id uuid references radar_pedidos on delete cascade, autor_id text not null, anuncio_id uuid references anuncios on delete cascade, criado_em timestamptz default now(), unique (pedido_id, anuncio_id))`; RLS: o comprador do pedido e o autor leem; ninguém insere pela API.
  - `indicar_anuncio_radar(p_pedido uuid, p_anuncio uuid) returns uuid`: logado e com conta na mesma região; pedido `aberto`, não vencido, `visibilidade = 'todos'` (senão `42501`, "Este pedido é só para lojas."); não é o comprador; anúncio `ativo` da mesma região e **não** é de vitrine do autor (`P0001`, "Use 'Mandar oferta' para os seus anúncios." quando o autor atende; "Indique um anúncio de outra pessoa." quando não); limite `radar.indicacoes_por_dia` = `10` por autor (`P0001`); repetido devolve o id existente. Avisa o comprador com tipo `indicacao` (configs `radar.aviso.indicacao.titulo` = `"Alguém sabe onde tem"`, `.texto` = `"Indicaram um anúncio para “{pedido}”. Toque para ver."`, chave `indicacao:<pedido>:<anuncio>`).
  - `indicacoes_do_pedido(p_pedido uuid)` (só comprador/admin): `anuncio_id, titulo, preco_centavos, foto, vitrine_nome, criado_em`, sem dados do autor.

- [ ] **Step 1: Escrever `640_radar_resolver_indicar.sql`** com: resolver com proposta → `resolvido_proposta_id` gravado; com proposta de outro pedido → `23514`; com `p_fora` → `resolvido_fora`; avaliar 1 e depois -1 → fica -1; avaliar pedido resolvido fora → recusa; indicar em pedido `lojas` → `42501`; indicar anúncio próprio → `P0001`; indicação repetida devolve o mesmo id e só 1 aviso; 11ª indicação no dia → `P0001`; comprador vê a indicação em `indicacoes_do_pedido` sem o `autor_id`.
- [ ] **Step 2: Rodar** — Expected: FAIL.
- [ ] **Step 3: Escrever a seção na migração.**
- [ ] **Step 4: Rodar** — Expected: PASS em todos (600–640 e antigos).
- [ ] **Step 5: Commit** `feat(radar): com quem resolveu, nota e Eu sei onde tem`

### Task 6: Ações do site, validação e tipos

**Files:**
- Modify: `src/components/radar/validacao.ts`, `src/lib/tipos-radar.ts`, `src/app/radar/actions.ts`, `src/lib/dados/radar.ts`, `src/app/admin/lojas/actions.ts`
- Test: `tests/radar.test.cjs`

**Interfaces:**
- Consumes: RPCs das Tasks 1–5.
- Produces:
  - `EntradaPedido` ganha `cidadesIds?: string[]` (0–20 UUIDs; vazio = região toda) e `visibilidade: "lojas" | "todos"`; `cidade` deixa de ser obrigatória. `validarPedido` recusa `cidadesIds` com item não-UUID ou mais de 20 (`campo: "cidades"`) e visibilidade fora das duas (`campo: "visibilidade"`).
  - `criarPedido` passa `p_cidades_ids` (null se vazio) e `p_visibilidade`.
  - novas actions em `src/app/radar/actions.ts`: `estenderPedido(id: string): Promise<Resultado<{ expiraEm: string }>>`, `resolverPedido(id: string, propostaId: string | null, fora: boolean): Promise<Resultado<null>>`, `avaliarPedido(id: string, nota: 1 | -1): Promise<Resultado<null>>`, `indicarAnuncio(pedidoId: string, anuncioId: string): Promise<Resultado<{ id: string }>>` — mesmo padrão de `fecharPedido` (auth, validação de UUID, `revalidatePath`).
  - em `src/app/admin/lojas/actions.ts`: `darCortesiaRadar(vitrineId: string, ate: string, motivo: string)` e `tirarCortesiaRadar(vitrineId: string)`.
  - tipos em `tipos-radar.ts`: `Visibilidade`, campos `visibilidade`, `area_texto`, `bloqueado`, `extensoes`, `pode_estender`, `resolvido_proposta_id`, `avaliacao`; `IndicacaoRadar`.

- [ ] **Step 1: Testes em `tests/radar.test.cjs`**: `validarPedido` aceita `cidadesIds: []` sem `cidade`; recusa 21 cidades e `'x'` (`campo === 'cidades'`); recusa `visibilidade: 'privado'`; `criarPedido` chama `criar_pedido_radar_site` com `p_cidades_ids: null` quando a lista é vazia e com o array quando não; `estenderPedido('x')` recusa sem chamar RPC; `resolverPedido(id, propostaId, true)` recusa sem chamar RPC; `indicarAnuncio` chama `indicar_anuncio_radar` com `{p_pedido, p_anuncio}`.
- [ ] **Step 2: `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npm test && npm run typecheck && npm run lint`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(radar): ações de área, visibilidade, estender, resolver e indicar`

### Task 7: Telas (formulário passo a passo, meu pedido, pedido da loja, feed, admin)

**Files:**
- Create: `src/components/radar/botao-falar.tsx`, `src/components/radar/escolher-area.tsx`, `src/components/radar/escolher-visibilidade.tsx`, `src/components/radar/folha-resolver.tsx`, `src/components/radar/folha-indicar.tsx`, `src/app/admin/lojas/[id]/cortesia-radar.tsx`
- Modify: `src/components/radar/form-pedido.tsx`, `src/app/radar/pedir/page.tsx`, `src/components/radar/acoes-pedido.tsx`, `src/app/radar/pedido/[id]/page.tsx`, `src/app/radar/[id]/page.tsx`, `src/components/radar/radar-de-negocios.tsx`, `src/components/radar/listas-radar.tsx`, `src/app/admin/lojas/[id]/page.tsx`

**Interfaces:**
- Consumes: actions e tipos da Task 6.
- Produces (componentes):
  - `BotaoFalar({ onTexto }: { onTexto: (t: string) => void })`: usa `window.SpeechRecognition ?? window.webkitSpeechRecognition` com `lang = "pt-BR"`; **não renderiza nada** se o navegador não tem; rótulo "Falar em vez de digitar" com ícone `Mic`; enquanto ouve: "Ouvindo… toque para parar".
  - `EscolherArea({ cidades, valor, onChange })` com `valor: string[]` (vazio = região toda): dois cartões grandes "Toda a região" / "Escolher cidades"; o segundo abre chips (`chip.tsx`) multi-seleção; voltar a "Toda a região" limpa a lista.
  - `EscolherVisibilidade({ valor, onChange })`: dois cartões grandes com os textos de ajuda do Global Constraints; "Só lojas" marcado por padrão.
  - `FolhaResolver({ pedidoId, propostas })`: passo 1 "Com quem você resolveu?" (um botão por loja com proposta + "Outro lugar"); passo 2, só se escolheu loja: "Como foi?" 👍 "Foi bom" / 👎 "Não foi bom" (texto sempre ao lado do emoji) e "Pular".
  - `FolhaIndicar({ pedidoId })`: campo de busca que usa a busca de anúncios já existente da região (mesma fonte da página de busca), lista com foto/título/preço, botão "Indicar este".

- [ ] **Step 1: Rodar `ui-consistency:finding-patterns`** sobre `src/app/radar/*` e `src/components/radar/*` e salvar o checklist em `docs/designs/radar-v2-checklist-ui.md`; as telas abaixo seguem esse checklist.
- [ ] **Step 2: Formulário em 4 telas** (`form-pedido.tsx`), com barra "Passo N de 4" e botões "Voltar"/"Continuar" de 48px: 1) "O que você está procurando?" (título + detalhes + `BotaoFalar` + faixa de preço opcional + categoria opcional); 2) "Onde?" (`EscolherArea`); 3) "Quem pode ver?" (`EscolherVisibilidade`); 4) "Como as lojas falam com você?" (modos atuais com os textos atuais) + resumo do pedido e botão "Publicar pedido". O texto de `?q=` continua preenchendo o passo 1. Erro de campo devolvido pelo servidor leva de volta ao passo daquele campo.
- [ ] **Step 3: Meu pedido** (`acoes-pedido.tsx`, `pedido/[id]/page.tsx`): mostra a área e quem vê; "Vence em N dias"; se `pode_estender`, cartão de destaque "Você achou o que procurava?" com "Ainda preciso" e "Já resolvi"; "Já resolvi" abre `FolhaResolver`; pedido fechado ou com `extensoes` no máximo e vencendo mostra "Pedir de novo" (`linkPedirRadar(titulo, ...)` já existente); lista "Indicações" quando houver (`indicacoes_do_pedido`).
- [ ] **Step 4: Pedido para a loja e para o público** (`[id]/page.tsx`): `bloqueado` → "Este pedido é só para lojas verificadas." + planos (Review Focus 5); quem não atende num pedido `todos` vê o pedido e o botão "Eu sei onde tem" (`FolhaIndicar`), sem "Mandar oferta"; quem atende vê como hoje. Feed (`radar-de-negocios.tsx`, `listas-radar.tsx`): mostra `area_texto` e um selo "Todo mundo" / "Só lojas" com texto.
- [ ] **Step 5: Admin** (`admin/lojas/[id]`): seção "Cortesia do Radar" com data "Até", motivo e botões "Dar cortesia"/"Tirar cortesia"; mostra a cortesia ativa e até quando.
- [ ] **Step 6: Verificar no navegador** (preview local ou render estático, como na memória "worktree sem chaves"): os 4 passos no celular (375px) e no desktop; teclado e leitor de tela nos cartões (são `radio` com rótulo); `BotaoFalar` some no Firefox. Rodar `ui-consistency:verifying` contra o checklist do Step 1.
- [ ] **Step 7: `npm run lint && npm run typecheck && npm test`** — Expected: PASS.
- [ ] **Step 8: Commit** `feat(radar): pedido em 4 passos, área, quem vê, estender, resolver, indicar e cortesia no admin`

### Task 8: Textos e portas de entrada (sem a home)

**Files:**
- Modify: `src/components/radar/explicacao-radar.tsx`, `src/app/(publico)/page.tsx` (só o bloco de busca vazia), `src/lib/aki/ferramentas.ts` (`preparar_pedido_radar`), `src/app/(publico)/planos/page.tsx`
- Create: `supabase/migrations/20261117040000_radar_textos.sql` (textos do bloco `radar` em `home_blocos` e dos avisos, com `update ... where` texto ainda for o padrão antigo)

**Interfaces:**
- Consumes: nada novo.

- [ ] **Step 1: Explicação do Radar** em 3 passos com ícone + texto: "1. Diga o que precisa" / "2. As lojas da região te respondem" / "3. Você escolhe com quem falar"; título "Estou procurando…" e a frase do Global Constraints.
- [ ] **Step 2: Busca sem resultado**: "Não achou? Diga o que procura e as lojas da região te respondem." com botão "Estou procurando…" (texto da busca já preenchido, link atual `linkPedirRadar`).
- [ ] **Step 3: Merc**: a descrição da ferramenta `preparar_pedido_radar` passa a oferecer "Quer que eu peça para as lojas?" e o link gerado leva para o passo 1 já preenchido (visibilidade e área ficam nos padrões).
- [ ] **Step 4: Página de planos**: no Full, a linha "Aviso na hora de pedido novo no Radar"; no Slim, "Vê e responde pedidos do Radar" (sem aviso na hora); nota "Para responder no Radar, a loja precisa ser verificada."
- [ ] **Step 5: `npm run lint && npm run typecheck && npm test && npm run test:db`** — Expected: PASS.
- [ ] **Step 6: Commit** `feat(radar): textos novos e portas de entrada`

### Task 9 (esperar o ramo da home de 3 colunas ir para a main): faixa "Estou procurando…" no topo da home

**Files:**
- Modify: o componente de busca/topo da home **depois** do merge de `feat/home-3-colunas-main` (conferir o caminho na main nesse dia).

- [ ] **Step 1:** Confirmar com o Raniel que a home nova está na main.
- [ ] **Step 2:** Faixa curta logo abaixo da busca: botão "Estou procurando…" de 48px que leva a `/radar/pedir`; no visitante, leva ao login e volta para o pedido.
- [ ] **Step 3:** Verificar no celular e no desktop; `npm run lint && npm run typecheck`.
- [ ] **Step 4: Commit** `feat(home): faixa Estou procurando no topo`

### Task 10: Entrega

- [ ] **Step 1:** Abrir PR para `main` com `gh` logado como haniellevi; descrição em pt-BR com o que muda para o cliente, para a loja e para o admin; lista das 4 migrações e o aviso: **lojas sem selo de verificação e lojas no teste grátis deixam de responder no Radar; Slim deixa de receber aviso na hora** (decisão do Raniel); termina com a linha de atribuição.
- [ ] **Step 2:** Depois do merge e com o "sim" do Raniel, aplicar as migrações em produção pelo editor SQL do Supabase (como na memória "Vitrine com IA em produção") e conferir o cron `olaki-radar-lembretes`.
- [ ] **Step 3:** Teste real no site com um pedido de teste (criar, estender, resolver) e mover o pedido para o arquivo.
