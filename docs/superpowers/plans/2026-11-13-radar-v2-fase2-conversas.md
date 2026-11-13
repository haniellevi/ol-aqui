# Radar v2 · Fase 2 (Conversas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente conversa com a loja dentro do site: pelo botão "Conversar" em todo anúncio (2b) e, no Radar, a conversa abre sozinha quando a loja manda proposta, com os anúncios como cartões (2a). Ícone "Conversas" com bolinha de não lidas, aviso fixo, contra golpe (aviso, Bloquear, Denunciar, telefone escondido até o cliente mostrar).

**Architecture:** Como no Radar, as regras ficam no banco (tabelas com RLS ligada e sem policies; tudo por funções `SECURITY DEFINER`). Existe **uma conversa por par cliente ↔ loja**; anúncios e propostas entram nela como mensagens do tipo cartão. O Radar não é editado: um gatilho novo em `radar_propostas` abre a conversa e põe o cartão. O site lê por server actions e atualiza por consulta periódica (sem realtime).

**Tech Stack:** Next 15.5 + React 19, Clerk, Supabase (RLS, pg_cron), Tailwind 4 (tokens em `src/app/globals.css`), lucide-react. Testes: SQL em `supabase/testes/*.sql` (rodados por `npm run test:db`; nesta máquina com o Postgres embutido + shim, ver memória "Testes do banco sem Docker") e Node em `tests/*.test.cjs` (`npm test`).

**Spec:** `docs/designs/radar-v2.md` (seções "Chat Conversas (fase 2)" e "Modo fácil") + decisões do Raniel de 13/11/2026 (abaixo).

## Decisões do Raniel (13/11/2026)

| Tema | Decisão |
|---|---|
| Quem conversa | logado **e** celular confirmado (`whatsapp_confirmado()`) |
| Onde tem "Conversar" | todo anúncio `ativo`, de loja ou PF |
| Quem começa | só o cliente (botão Conversar); no Radar, a **proposta** abre a conversa |
| Lado da loja | dono e gerentes (`pode_mexer_vitrine`); mensagem sai com o nome da loja |
| Telefone | cliente toca "Mostrar meu WhatsApp"; só aquela loja passa a ver; não volta atrás |
| Foto | não nesta versão |
| Filtro | palavra proibida (`moderacao.palavras_bloqueadas`) recusa; link ou telefone passa com alerta de golpe |
| Spam | 20 conversas novas por dia por cliente (`conversas.novas_por_dia`); 60 mensagens por hora por pessoa (`conversas.mensagens_por_hora`); 1.000 letras por mensagem |
| Bloquear | o par inteiro (cliente ↔ loja); pode desbloquear; loja bloqueada pelo cliente também não manda proposta nos pedidos dele |
| Denunciar | vai para a fila de denúncias e já bloqueia |
| Admin | só lê conversa **denunciada**; cada leitura vai para `logs_atividade` |
| Apagar | ninguém apaga nem edita mensagem |
| Aviso de mensagem nova | só a bolinha no ícone Conversas; nada no sino |
| Ícone | no topo, ao lado do sino (celular e computador); barra de baixo não muda |
| Guarda | conversa sem mensagem há 180 dias é apagada (`conversas.guarda_dias`), exceto com denúncia aberta |
| Política | texto pronto no PR; o Raniel publica no painel quando ligar |
| Ligar | chave `conversas.ativa` = `false`; só liga com "sim" do Raniel |
| IA (fase 3) | só o gancho: coluna `ia_lida_em` nas mensagens, ninguém lê agora |

## Global Constraints

- Worktree `.claude/worktrees/radar-fase2-conversas-0ef1c3`, ramo `claude/radar-fase2-conversas-0ef1c3`, a partir de `main` (1d1abe0).
- Migrações novas: `20261120050000_conversas_base.sql`, `20261120051000_conversas_radar_seguranca.sql` (timestamps escolhidos para não colidir com a fase 3, que roda em paralelo). Nunca editar migração antiga.
- **Não editar** `src/app/radar/*` nem `src/components/radar/*` (a fase 3 mexe lá). Exceção única: nenhuma. O cartão de proposta da conversa linka para `/radar/pedido/<id>`, que já existe.
- Toda função nova: `security definer`, `set search_path = public, extensions`, `revoke all ... from public, anon`, `grant execute ... to authenticated` (rotina: só `service_role`).
- Toda FK para `perfis(id)` com `on update cascade` (troca de ID do Clerk, `20261119010000`).
- Configs no grupo `conversas` com `on conflict do nothing`: `conversas.ativa` = `false`, `conversas.novas_por_dia` = `20`, `conversas.mensagens_por_hora` = `60`, `conversas.guarda_dias` = `180`. Ler com `config_inteiro(chave, padrão, mínimo, máximo)` e `config(...)`.
- Com `conversas.ativa = false` toda função de escrita recusa com `P0001` "As conversas ainda não estão ligadas." e o gatilho do Radar não faz nada; leituras devolvem vazio.
- Erros em pt-BR simples, `errcode` + `detail = 'campo:<nome>'` quando é de campo, no estilo de `propor_radar`.
- Copy exata: aviso fixo **"O Mercado da Região acompanha esta conversa para sua segurança e para saber se você já resolveu."**; alerta **"Nunca pague adiantado sem ver o produto."**; botões **"Conversar"**, **"Conversas"**, **"Mostrar meu WhatsApp"**, **"Bloquear"**, **"Desbloquear"**, **"Denunciar"**, **"Enviar"**; vazio **"Nenhuma conversa ainda."**; mensagem do sistema ao mostrar o WhatsApp: **"O cliente mostrou o WhatsApp para a loja."**
- Modo fácil: botões `min-h-12`, corpo `text-lg`, nenhum ícone sem texto visível (exceção: o ícone do topo segue o padrão do sino, com `aria-label` e rótulo "Conversas" visível a partir de `sm`).
- Componentes só de `src/components/ui/` (botao, campo, chip, vazio, folha, confirmar); nunca branco sobre laranja (DESIGN.md). Nenhum campo oculto `name="id"` em `<form action>` (`tests/form-campo-id.test.cjs`).
- Testes SQL novos: `supabase/testes/790_conversas_base.sql`, `800_conversas_radar_seguranca.sql`, registrados em `automatizados.py` com uma linha `PASS:` própria, estilo `pg_temp.confere` (ver `770_cortesia_lancamento.sql`).
- No fim: `npm test`, `npm run typecheck`, `npm run lint` (em worktree: `node_modules/.bin/eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx src`) e `npm run test:db` passam.

## Review Focus

1. Gerente cuja ajuda foi revogada abre `/conversas/<id>` de link antigo → não vê nada ("Conversa não encontrada."). Teste em Task 1.
2. Loja dona do anúncio toca "Conversar" no próprio anúncio, ou o cliente bloqueado tenta de novo → recusa clara, nenhuma conversa criada. Teste em Task 1 e Task 2.
3. Proposta editada (UPDATE em `radar_propostas`) não cria segundo cartão nem segunda conversa; proposta nova da mesma loja para outro pedido do mesmo cliente entra na **mesma** conversa. Teste em Task 2.
4. Conversa de 200 dias **com denúncia aberta** não é apagada pela rotina; sem denúncia, é. Teste em Task 2.
5. Loja que vê a conversa antes do "Mostrar meu WhatsApp" não recebe o número em nenhuma leitura (`conversa_detalhe`, `minhas_conversas`, mensagens). Teste em Task 1.

---

### Task 1: Banco — conversas, mensagens, leitura e envio

**Files:**
- Create: `supabase/migrations/20261120050000_conversas_base.sql`
- Test: `supabase/testes/790_conversas_base.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces (Produces):**
- tabela `conversas (id uuid pk default gen_random_uuid(), cliente_id text not null references perfis(id) on update cascade on delete cascade, vitrine_id uuid not null references vitrines_lojas(id) on delete cascade, origem text not null check (origem in ('anuncio','radar')), whatsapp_liberado_em timestamptz, criado_em timestamptz not null default now(), ultima_msg_em timestamptz not null default now(), cliente_lido_em timestamptz, loja_lido_em timestamptz, unique (cliente_id, vitrine_id))`; índices por `cliente_id, ultima_msg_em desc` e `vitrine_id, ultima_msg_em desc`.
- tabela `conversa_mensagens (id uuid pk, conversa_id uuid not null references conversas on delete cascade, autor_id text references perfis(id) on update cascade on delete set null, lado text not null check (lado in ('cliente','loja','sistema')), tipo text not null check (tipo in ('texto','anuncio','proposta','sistema')), texto text check (char_length(texto) <= 1000), anuncio_id uuid references anuncios on delete set null, pedido_id uuid references radar_pedidos on delete set null, proposta_id uuid references radar_propostas on delete set null, alerta_golpe boolean not null default false, ia_lida_em timestamptz, criado_em timestamptz not null default now())`; índice `(conversa_id, criado_em)`.
- tabela `conversa_bloqueios (cliente_id text references perfis(id) on update cascade on delete cascade, vitrine_id uuid references vitrines_lojas on delete cascade, por text check (por in ('cliente','loja')), criado_em timestamptz default now(), primary key (cliente_id, vitrine_id, por))`.
- As três com RLS ligada e **sem** policy; sem grant para `anon`/`authenticated`.
- `conversas_ligadas() returns boolean` (stable).
- `conversa_papel(p_conversa uuid, uid text default usuario_id()) returns text`: `'cliente'`, `'loja'` (via `pode_mexer_vitrine`) ou `null`.
- `conversa_bloqueada(p_cliente text, p_vitrine uuid) returns boolean`: existe linha em `conversa_bloqueios` para o par (qualquer `por`).
- `abrir_conversa_anuncio(p_anuncio uuid) returns uuid`: ligada; logado (`28000`); `whatsapp_confirmado()` (`42501`, "Confirme seu celular para conversar."); anúncio `ativo` (`P0002`, "Este anúncio não está mais no ar."); quem chama não pode `pode_mexer_vitrine` do anúncio (`P0001`, "Este anúncio é seu."); par bloqueado (`42501`, "Não é possível conversar com esta loja."); se a conversa do par existe, reusa; se não, conta conversas criadas pelo cliente nas últimas 24h contra `conversas.novas_por_dia` (`P0001`, "Você abriu muitas conversas hoje. Tente amanhã."); insere cartão `tipo='anuncio'` com `lado='cliente'` só se o último cartão de anúncio da conversa não for o mesmo anúncio. Devolve o id.
- `enviar_mensagem(p_conversa uuid, p_texto text) returns uuid`: ligada; papel não nulo (`P0002`, "Conversa não encontrada."); par bloqueado (`42501`, "Esta conversa está bloqueada."); texto `btrim` com 1..1000 letras (`23514`, `campo:texto`); palavra proibida igual a `propor_radar` (`P0001`, `campo:texto`); mensagens do autor na última hora ≥ `conversas.mensagens_por_hora` (`P0001`, "Muitas mensagens seguidas. Espere um pouco."); `alerta_golpe = conversa_texto_suspeito(texto)`; atualiza `ultima_msg_em` e o `*_lido_em` de quem enviou.
- `conversa_texto_suspeito(p_texto text) returns boolean` (immutable): link (`https?://`, `www.`, `\.com`, `wa\.me`) **ou** 8+ dígitos depois de tirar espaço, ponto, traço e parênteses.
- `minhas_conversas() returns table (id uuid, papel text, outro_nome text, vitrine_id uuid, ultima_texto text, ultima_em timestamptz, nao_lidas integer, bloqueada boolean)`: todas onde a pessoa é cliente ou cuida da loja; `outro_nome` = nome da loja (cliente vê) ou `mensagem_primeiro_nome(cliente)` (loja vê); `ultima_texto` = texto da última mensagem ou "Anúncio: <título>" / "Proposta: <título do pedido>"; ordem `ultima_em desc`, limite 100.
- `conversa_detalhe(p_conversa uuid) returns table (id uuid, papel text, outro_nome text, loja_slug text, whatsapp_cliente text, whatsapp_liberado boolean, eu_bloqueei boolean, fui_bloqueado boolean)`: `whatsapp_cliente` só quando `papel='loja'` e `whatsapp_liberado_em is not null`; sem papel → nenhuma linha.
- `conversa_mensagens_de(p_conversa uuid, p_depois timestamptz default null) returns table (id uuid, lado text, tipo text, texto text, alerta_golpe boolean, criado_em timestamptz, anuncio_id uuid, anuncio_titulo text, anuncio_preco_centavos integer, anuncio_foto text, anuncio_link text, pedido_id uuid, pedido_titulo text, proposta_preco_centavos integer)`: só com papel; `p_depois` traz só as mais novas; no máximo as 200 últimas, em ordem de `criado_em`. `anuncio_link` igual ao que o site usa para anúncio (`/anuncio/<id>-<slug>`, conferir em `src/lib/rotas.ts`).
- `marcar_conversa_lida(p_conversa uuid) returns void` e `conversas_nao_lidas() returns integer` (conversas com mensagem do **outro lado** depois do meu `*_lido_em`; máx. 99).
- `mostrar_meu_whatsapp(p_conversa uuid) returns void`: só papel `cliente` (`42501`); grava `whatsapp_liberado_em` uma vez; insere mensagem `tipo='sistema'` com a copy do Global Constraints.

- [ ] **Step 1: Escrever `790_conversas_base.sql`** (cliente C com celular confirmado, cliente S sem, loja L dono D com gerente G aceito, anúncio A da loja L, anúncio B de PF P; `conversas.ativa` ligada no começo):
  - com `conversas.ativa=false` → `abrir_conversa_anuncio` recusa `P0001`.
  - C abre por A → id; abre de novo → mesmo id e continua 1 cartão; abre por outro anúncio da L → mesmo id, 2 cartões.
  - S abre → `42501`; D abre no próprio A → `P0001` (Review Focus 2); anúncio pausado → `P0002`.
  - com `conversas.novas_por_dia=2`, a 3ª conversa nova de C no dia → `P0001`; reabrir a 1ª continua ok.
  - C envia "oi" → `minhas_conversas()` de D e de G mostram `nao_lidas=1`; `conversas_nao_lidas()` de D = 1; depois de `marcar_conversa_lida` por G → 0 também para D (o lido é por lado: dono e gerentes compartilham `loja_lido_em`).
  - texto vazio e 1.001 letras → `23514`; palavra da lista `moderacao.palavras_bloqueadas` → `P0001`; "me chama 89 99999-0000" → `alerta_golpe=true`; "tem azul?" → false.
  - com `conversas.mensagens_por_hora=3`, 4ª mensagem → `P0001`.
  - pessoa de fora chama `conversa_mensagens_de` → 0 linhas; `enviar_mensagem` → `P0002`.
  - G tem a ajuda revogada (`revogar_gerente_loja`) → `conversa_detalhe` vazio e `minhas_conversas` sem a conversa (Review Focus 1).
  - antes de mostrar, `conversa_detalhe` para D tem `whatsapp_cliente is null` e nenhuma coluna de `minhas_conversas`/`conversa_mensagens_de` contém o número de C (Review Focus 5); D chama `mostrar_meu_whatsapp` → `42501`; C chama → D passa a ver o número; 1 mensagem `sistema`.
  - `select` direto em `conversas` como `authenticated` → erro de permissão.
- [ ] **Step 2: Registrar no `automatizados.py` e rodar `npm run test:db`** — Expected: FAIL (`abrir_conversa_anuncio` não existe).
- [ ] **Step 3: Escrever a migração** com as interfaces acima e as 4 configs.
- [ ] **Step 4: Rodar `npm run test:db`** — Expected: `PASS:` do 790 e todos os antigos (inclusive 780, que confere `on update cascade` nas FKs para `perfis`).
- [ ] **Step 5: Commit** `feat(conversas): banco das conversas cliente-loja com envio, leitura e limites`

### Task 2: Banco — Radar, bloquear, denunciar, admin e limpeza

**Files:**
- Create: `supabase/migrations/20261120051000_conversas_radar_seguranca.sql`
- Test: `supabase/testes/800_conversas_radar_seguranca.sql`
- Modify: `supabase/testes/automatizados.py`

**Interfaces:**
- Consumes: tudo da Task 1.
- Produces:
  - gatilho `conversas_proposta_radar` **after insert** em `radar_propostas` (função `conversas_ao_propor()`): se ligada, abre/reusa a conversa (`cliente_id` = comprador do pedido, `vitrine_id` da proposta, `origem='radar'`, sem contar no limite diário) e insere mensagem `tipo='proposta'`, `lado='loja'`, `texto` = mensagem da proposta, `anuncio_id`, `pedido_id`, `proposta_id`. Não dispara em UPDATE.
  - gatilho `conversas_bloqueio_proposta` **before insert** em `radar_propostas`: se o comprador bloqueou a loja (`por='cliente'`), recusa `42501` "Este cliente não recebe propostas da sua loja." (vale mesmo com conversas desligadas, porque só existe bloqueio se já estiveram ligadas).
  - `bloquear_conversa(p_conversa uuid, p_bloquear boolean) returns void`: papel obrigatório; grava/apaga a linha com `por` = papel de quem chama.
  - `denuncias.alvo_tipo` ganha `'conversa'` (drop + add do check, mesmo nome do constraint atual — descobrir pelo catálogo como em `20261119010000`).
  - `denunciar_conversa(p_conversa uuid, p_motivo text, p_detalhes text default null) returns uuid`: papel obrigatório; motivo da lista atual de `denuncias`; insere (repetida devolve a existente pelo `unique`) e chama `bloquear_conversa(p_conversa, true)`.
  - `admin_ler_conversa(p_conversa uuid) returns table (...)` = mesmas colunas de `conversa_mensagens_de` + `autor_nome text`: exige `e_admin()` (`42501`) **e** denúncia `alvo_tipo='conversa'` dessa conversa (`42501`, "Só dá para ler conversa denunciada."); grava em `logs_atividade` (`tabela='conversas'`, `acao='LEITURA_ADMIN'`, `registro_id` = conversa, autor = admin) a cada chamada.
  - `conversas_limpar() returns integer` (só `service_role`): apaga conversas com `ultima_msg_em < now() - conversas.guarda_dias` sem denúncia `aberta`; devolve quantas. Cron `olaki-conversas-limpar` `'40 3 * * *'`, agendado como `olaki-radar-lembretes` (só se pg_cron existir).

- [ ] **Step 1: Escrever `800_conversas_radar_seguranca.sql`**:
  - loja atendente propõe no pedido de C → 1 conversa `origem='radar'` com 1 mensagem `proposta` com `pedido_id`; `propor_radar` de novo (edição) → continua 1 mensagem; mesma loja propõe em outro pedido de C → mesma conversa, 2 cartões (Review Focus 3).
  - com conversas desligadas, proposta não cria conversa.
  - C bloqueia → D não envia (`42501`); `abrir_conversa_anuncio` de C também recusa; nova proposta da loja em pedido de C → `42501`; C desbloqueia → volta a enviar.
  - D denuncia com motivo `golpe` → 1 linha em `denuncias` `alvo_tipo='conversa'` e par bloqueado; denunciar de novo → mesmo id.
  - admin lê conversa não denunciada → `42501`; denunciada → mensagens + 1 linha em `logs_atividade`; não admin → `42501`.
  - conversa com `ultima_msg_em` há 200 dias sem denúncia → apagada (com mensagens); com denúncia `aberta` → fica (Review Focus 4); conversa de 10 dias → fica; `conversas_limpar` por `authenticated` → sem permissão.
- [ ] **Step 2: Registrar e rodar `npm run test:db`** — Expected: FAIL.
- [ ] **Step 3: Escrever a migração.**
- [ ] **Step 4: Rodar `npm run test:db`** — Expected: PASS 790, 800 e antigos (Radar 90, 600–640 inalterados).
- [ ] **Step 5: Commit** `feat(conversas): proposta do Radar abre conversa; bloquear, denunciar, leitura do admin e limpeza em 180 dias`

### Task 3: Ações do site, leituras e tipos

**Files:**
- Create: `src/lib/tipos-conversas.ts`, `src/lib/dados/conversas.ts`, `src/app/(conta)/conversas/actions.ts`, `src/components/conversas/validacao.ts`, `src/app/api/conversas/resumo/route.ts`
- Modify: `src/lib/rotas.ts` (`LINK_CONVERSAS = "/conversas"`, `linkConversa(id)`)
- Test: `tests/conversas.test.cjs`

**Interfaces:**
- Consumes: RPCs das Tasks 1–2.
- Produces:
  - tipos `PapelConversa = "cliente" | "loja"`, `ResumoConversa`, `DetalheConversa`, `MensagemConversa` (campos = colunas das RPCs, snake_case como em `tipos-radar.ts`).
  - `validarMensagem(texto: unknown): { campo: "texto"; mensagem: string } | null` (1..1000 depois de `trim`).
  - `src/lib/dados/conversas.ts`: `conversasLigadas(): Promise<boolean>`, `minhasConversas(): Promise<ResumoConversa[]>`, `detalheConversa(id: string): Promise<DetalheConversa | null>`.
  - actions (padrão `Resultado<T>` de `@/lib/tipos`, auth antes de tudo, `ehUuid`, `traduzirErro`): `abrirConversaAnuncio(anuncioId: string): Promise<Resultado<{ id: string }>>`, `enviarMensagem(conversaId: string, texto: string): Promise<Resultado<{ id: string }>>`, `mensagensDepois(conversaId: string, depois: string | null): Promise<Resultado<MensagemConversa[]>>`, `marcarLida(conversaId: string)`, `mostrarMeuWhatsapp(conversaId: string)`, `bloquear(conversaId: string, bloquear: boolean)`, `denunciar(conversaId: string, motivo: string, detalhes: string | null)` — as quatro últimas `Promise<Resultado<null>>` e com `revalidatePath(linkConversa(id))`.
  - `GET /api/conversas/resumo` → `{ naoLidas: number }` (mesmo formato e cache `no-store` de `/api/notificacoes/resumo`; 0 quando desligada ou sem login).
- [ ] **Step 1: Testes em `tests/conversas.test.cjs`** (mocks no estilo `ambiente()` de `tests/radar.test.cjs`): sem login, toda action devolve `ok:false` sem chamar RPC; id `'x'` recusa sem RPC; `enviarMensagem(id, '   ')` e 1.001 letras → `campo:'texto'` sem RPC; `enviarMensagem` chama `enviar_mensagem` com `{p_conversa, p_texto}` já com `trim`; `denunciar(id,'spam',null)` (motivo fora da lista) recusa sem RPC; `abrirConversaAnuncio` devolve o id do RPC e recusa resposta não-UUID.
- [ ] **Step 2: `npm test`** — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npm test && npm run typecheck`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(conversas): ações, leituras e contagem de não lidas`

### Task 4: Telas — ícone, lista, conversa e botão "Conversar"

**Files:**
- Create: `src/components/conversas/icone-conversas.tsx`, `src/components/conversas/lista-conversas.tsx`, `src/components/conversas/conversa-aberta.tsx`, `src/components/conversas/cartao-mensagem.tsx`, `src/components/conversas/menu-seguranca.tsx`, `src/components/conversas/botao-conversar.tsx`, `src/app/(conta)/conversas/page.tsx`, `src/app/(conta)/conversas/[id]/page.tsx`, `docs/designs/conversas-checklist-ui.md`
- Modify: `src/components/ui/cabecalho-publico.tsx` (ícone ao lado de `<SinoAvisos />`, só se `conversasLigadas()`), `src/app/(publico)/anuncio/[idslug]/barra-contato.tsx` e onde ela é montada (prop `conversar: boolean`)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `IconeConversas()`: cópia do comportamento de `SinoAvisos` (consulta a cada 60 s, ao focar e no evento `olaki:conversas`), ícone `MessageSquare`, `aria-label` "Conversas: N não lidas", rótulo "Conversas" visível a partir de `sm`, bolinha igual à do sino.
  - `/conversas`: título "Conversas"; `ListaConversas` com nome, última mensagem (1 linha), hora, bolinha de não lidas e selo "Bloqueada" com texto; vazio com `vazio.tsx` e "Nenhuma conversa ainda.".
  - `/conversas/[id]`: `notFound()` se `detalheConversa` é null. Topo fixo com nome, link para a loja (cliente) e `MenuSeguranca` (Bloquear/Desbloquear com `confirmar.tsx`; Denunciar em `folha.tsx` com os motivos da tabela e detalhes opcionais). Abaixo do topo, a faixa fixa com o aviso de acompanhamento e o alerta "Nunca pague adiantado sem ver o produto.". Mensagens (`CartaoMensagem`: texto em balão por lado; `anuncio` com foto, título, preço e "Ver anúncio"; `proposta` com título do pedido, preço e "Ver pedido" → `/radar/pedido/<id>` só para o cliente; `sistema` centralizada; `alerta_golpe` mostra o alerta embaixo do balão). Campo de texto + "Enviar" (`min-h-12`); para o cliente, "Mostrar meu WhatsApp" com `confirmar.tsx` ("A loja vai ver seu número. Não dá para esconder depois."); para a loja com número liberado, "Chamar no WhatsApp" (link wa.me montado no servidor, como no Radar). Bloqueada: campo some e aparece "Conversa bloqueada.". `ConversaAberta` chama `mensagensDepois` a cada 10 s com a aba visível e `marcarLida` ao abrir e ao receber, disparando `olaki:conversas`.
  - `BotaoConversar({ anuncioId, logado, entrarHref })`: botão secundário "Conversar" com `MessageCircle` ao lado do WhatsApp na barra do anúncio; sem login vai para `entrarHref`; com login chama `abrirConversaAnuncio` e navega para `linkConversa(id)`; erro aparece no aviso que a barra já tem. Não aparece para o dono do anúncio nem com conversas desligadas.
- [ ] **Step 1: Rodar `ui-consistency:finding-patterns`** sobre `src/app/(conta)/minha-conta/notificacoes`, `src/components/conta/sino-avisos.tsx` e a barra do anúncio; salvar o checklist em `docs/designs/conversas-checklist-ui.md`.
- [ ] **Step 2: Implementar os componentes e páginas** seguindo o checklist e o Global Constraints.
- [ ] **Step 3: `npm test`** — Expected: PASS, inclusive `tests/form-campo-id.test.cjs`.
- [ ] **Step 4: Ver as telas** (render estático com dados de exemplo, como na memória "Worktree: ESLint duplo e preview sem app") em 375 px e no desktop: lista, conversa do cliente, conversa da loja com número liberado, bloqueada, alerta de golpe, barra do anúncio com "Conversar". Rodar `ui-consistency:verifying` contra o checklist.
- [ ] **Step 5: `npm run lint && npm run typecheck && npm test`** — Expected: PASS.
- [ ] **Step 6: Commit** `feat(conversas): ícone Conversas, lista, conversa com cartões e botão Conversar`

### Task 5: Admin, política e entrega

**Files:**
- Create: `src/app/admin/conversas/[id]/page.tsx`, `docs/designs/conversas-politica-privacidade.md`
- Modify: `src/app/admin/moderacao/page.tsx` (denúncia `alvo_tipo='conversa'` mostra o link "Ler conversa"), `docs/designs/radar-v2.md` (seção Conversas: "fase 2 feita, ver plano 2026-11-13")

- [ ] **Step 1: Página do admin** `/admin/conversas/[id]`: chama `admin_ler_conversa`; aviso "Esta leitura fica registrada."; mensagens com nome do autor e lado; erro `42501` → "Só dá para ler conversa denunciada.".
- [ ] **Step 2: Texto da política** em `conversas-politica-privacidade.md`: o que guarda (mensagens, cartões, quem bloqueou), por quanto tempo (180 dias sem mensagem; denunciada fica até a decisão), quem lê (as duas partes; a equipe só com denúncia, com registro), WhatsApp do cliente só depois de ele mostrar, IA lerá na fase 3 (não agora).
- [ ] **Step 3: `npm run lint && npm run typecheck && npm test && npm run test:db`** — Expected: PASS.
- [ ] **Step 4: Commit** `feat(conversas): leitura do admin em denúncia e texto da política`
- [ ] **Step 5: PR para `main`** com `gh` logado como haniellevi, corpo em pt-BR pela skill `pr`: o que muda para cliente, loja e admin; as 2 migrações; a chave `conversas.ativa` desligada; o cron `olaki-conversas-limpar`; passos para ligar (aplicar migrações, publicar política, ligar a chave, teste com conta de teste) — tudo só com "sim" do Raniel.
