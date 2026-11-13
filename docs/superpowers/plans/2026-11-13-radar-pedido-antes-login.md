# Radar: pedir antes do login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem não tem conta abre `/radar/pedir`, escreve o pedido inteiro e só no fim entra (ou cria conta e confirma o celular). Depois volta ao resumo do pedido já preenchido e publica com um toque.

**Architecture:** O middleware libera só `/radar/pedir`. Sem login, a página mostra o mesmo `FormPedido` com a região do visitante (`regiaoAtual()`), sem IA e sem campo de WhatsApp. No último passo, o botão guarda um rascunho no aparelho (localStorage, 2 horas) e manda para `/entrar?redirect_url=/radar/pedir?retomar=1`. O caminho de conta nova (`/completar-perfil`) já confirma o celular e os termos. Com login e `?retomar=1`, o formulário lê o rascunho, abre no passo 4 (resumo) e espera o toque em "Publicar pedido". Nada é publicado sozinho.

**Tech Stack:** Next.js App Router, Clerk (`clerkMiddleware`, `auth()`), React client component, testes `node --test tests/*.test.cjs` com `tests/carregar.cjs`.

**Spec:** `docs/designs/crescimento-radar-lojista.md` (decisão 9). Base: `main` c764047.

## Global Constraints

- Textos em português do Brasil, linguagem simples (Modo fácil, `docs/designs/radar-v2.md`).
- Sem mudança de banco, nenhuma migração. `criarPedido` e `criar_pedido_radar_site` não mudam: publicar continua exigindo login e celular.
- A IA do pedido nunca roda sem login (`iaNoPedido=false`), para estranhos não gastarem o teto.
- O rascunho guarda só o que a pessoa digitou no pedido. Nunca guarda telefone, nome ou dados da conta.
- Validade do rascunho: 2 horas (`VALIDADE_RASCUNHO_MS = 2 * 60 * 60 * 1000`). Chave: `"mr-radar-rascunho"`.
- O endereço de volta é fixo, `/radar/pedir?retomar=1`. Nunca usar um endereço vindo de parâmetro.
- As outras rotas `/radar/*` continuam exigindo login.

## Review Focus

1. **Rascunho velho, corrompido ou de outra versão no localStorage** → é ignorado, e o formulário abre vazio no passo 1 sem erro. (Task 1, testes `rascunhoValido`)
2. **Cidades do rascunho fora da região da conta** (o visitante escolheu outra cidade, mas a conta nova nasce em `corrente-pi`) → elas são descartadas, o pedido vai para "Toda a região" e aparece o aviso. (Task 3, teste `cidadesDoRascunho`)
3. **localStorage bloqueado** (aba anônima, Safari restrito) → o botão ainda leva ao login. Na volta, o formulário abre vazio com o aviso "Não achamos o pedido que você começou. Escreva de novo, é rápido." (Task 3)
4. **Pessoa já logada abre `?retomar=1` sem rascunho** → formulário normal, sem aviso de erro. (Task 3)
5. **Toque duplo em "Entrar para publicar"** → um só redirecionamento, e o rascunho é gravado uma vez. A trava `trava.current` já existente cobre isso. (Task 3)

---

### Task 1: Rascunho do pedido no aparelho

**Files:**
- Create: `src/lib/rascunho-radar.ts`
- Test: `tests/radar-rascunho.test.cjs`

**Interfaces:**
- Produces:
  - `type RascunhoPedido = { titulo: string; detalhes: string; categoriaId: string | null; precoMin: string; precoMax: string; cidadesIds: string[]; visibilidade: Visibilidade; modo: ModoContato; prazoHoras: number | null }`
  - `rascunhoValido(v: unknown, agora: number): RascunhoPedido | null` (função pura; o valor gravado é `{ v: 1, em: number, dados: RascunhoPedido }`)
  - `guardarRascunho(dados: RascunhoPedido): void`, `lerRascunho(): RascunhoPedido | null`, `limparRascunho(): void` (todas com try/catch, como `src/lib/salvar-pendente.ts`)
  - `VALIDADE_RASCUNHO_MS`, `LINK_RETOMAR_PEDIDO = "/radar/pedir?retomar=1"`

- [ ] **Step 1: Write the failing tests** em `tests/radar-rascunho.test.cjs`, carregando `src/lib/rascunho-radar.ts` com `carregar`:
  - `rascunho: aceita o formato certo dentro de 2 horas`: `rascunhoValido({ v: 1, em: 1000, dados: BOM }, 1000 + 2*3600_000 - 1)` deepEqual `BOM`.
  - `rascunho: vencido, versão errada, nulo ou texto vira null`: `em` mais 2 h + 1 ms → `null`; `v: 2` → `null`; `null` → `null`; `"x"` → `null`.
  - `rascunho: corta e limpa campos`: título com 300 caracteres volta com 120; detalhes com 2000 voltam com 1000; `cidadesIds` com 25 ids e um id não-uuid volta só com uuids, no máximo 20; `visibilidade: "outra"` → `"lojas"`; `modo: "x"` → `"whatsapp_direto"`; `prazoHoras: "24"` → `null`; `categoriaId: "abc"` → `null`.
  - `rascunho: título vazio vira null` (um rascunho sem o que procura não vale).
- [ ] **Step 2:** Run `node --test tests/radar-rascunho.test.cjs` → FAIL (arquivo não existe).
- [ ] **Step 3: Implement** `src/lib/rascunho-radar.ts`. Use `ehUuid` de `@/lib/formato` e os tipos de `@/lib/tipos-radar`. Sem `"use client"`, porque só o formulário chama o módulo.
- [ ] **Step 4:** Run `node --test tests/radar-rascunho.test.cjs` → PASS.
- [ ] **Step 5: Commit** `feat(radar): rascunho do pedido guardado no aparelho`

### Task 2: Liberar `/radar/pedir` sem login

**Files:**
- Modify: `src/middleware.ts:7-20`
- Modify: `src/app/radar/pedir/page.tsx`

**Interfaces:**
- Consumes: `regiaoAtual()`, `listarCidades()`, `listarCategorias()`, `regrasRadar()` (já existentes).
- Produces: `FormPedido` passa a receber a prop `anonimo?: boolean` (implementada na Task 3; nesta task a página já a envia).

- [ ] **Step 1:** Em `middleware.ts`, crie `const pedidoAberto = createRouteMatcher(["/radar/pedir"])` e troque a condição por `if (exigeLogin(req) && !pedidoAberto(req)) await auth.protect();`. Atualize o comentário do topo: "Radar (menos a explicação e o 'Estou procurando…')".
- [ ] **Step 2:** Em `page.tsx`, comece por `const { userId } = await auth();`. Sem `userId`, use a região `await regiaoAtual()`. Se ela vier `null`, mostre o `Vazio` "Algo deu errado". Se vier, renderize `<Formulario microrregiaoId={regiao.id} … pedirWhatsapp={false} whatsappInicial="" anonimo />`. O caminho com login fica igual ao de hoje (`garantirPerfil`, `currentUser`, `sincronizarPerfil`…).
- [ ] **Step 3:** Em `Formulario`, aceite `anonimo` e `retomar` e passe ao `FormPedido`. Com `anonimo`, `iaNoPedido={false}`. `retomar` vem de `searchParams.retomar === "1"` e só vale com login.
- [ ] **Step 4: Verificar** com o servidor de dev (`preview_start`):
  - sem login, `GET /radar/pedir` → 200 e o formulário no passo 1;
  - sem login, `GET /radar/pedido/<uuid qualquer>` → redireciona para `/entrar`;
  - `npx tsc --noEmit` sem erro novo.
- [ ] **Step 5: Commit** `feat(radar): "Estou procurando…" abre sem login`

### Task 3: Formulário guarda, manda entrar e retoma

**Files:**
- Modify: `src/components/radar/form-pedido.tsx`
- Modify: `src/components/radar/passos-pedido.ts` (nova função pura)
- Test: `tests/radar.test.cjs` (acrescentar)

**Interfaces:**
- Consumes: Task 1 (`guardarRascunho`, `lerRascunho`, `limparRascunho`, `LINK_RETOMAR_PEDIDO`, `RascunhoPedido`).
- Produces:
  - `cidadesDoRascunho(ids: string[], validas: string[]): { ids: string[]; perdeu: boolean }` em `passos-pedido.ts`
  - props novas do `FormPedido`: `anonimo?: boolean`, `retomar?: boolean`

- [ ] **Step 1: Write the failing test** em `tests/radar.test.cjs`, com o nome `cidadesDoRascunho: fica só com as da região e avisa se perdeu`:
  - `(["a","b"], ["a","c"])` → `{ ids: ["a"], perdeu: true }`;
  - `(["a"], ["a"])` → `{ ids: ["a"], perdeu: false }`;
  - `([], ["a"])` → `{ ids: [], perdeu: false }`.
- [ ] **Step 2:** Run `node --test tests/radar.test.cjs` → FAIL.
- [ ] **Step 3:** Implemente `cidadesDoRascunho` e rode o teste → PASS.
- [ ] **Step 4: Sem login (`anonimo`)** em `form-pedido.tsx`:
  - No passo 4, o botão diz **"Entrar para publicar"** (ícone `LogIn` de lucide-react). Logo abaixo, `<p className="text-center text-facil text-texto-suave">` com o texto: **"Falta só entrar com seu celular. Seu pedido fica guardado."** Esse texto toma o lugar da linha "Você pode ter até N pedidos".
  - `enviar()` com `anonimo`: aplica as mesmas validações de hoje (`erroDoPasso(4…)` e prazo). Depois `guardarRascunho({...})` com os campos de `entrada()`, menos `chaveEnvio` e `whatsapp`, e `router.push("/entrar?redirect_url=" + encodeURIComponent(LINK_RETOMAR_PEDIDO))`. Não chama `criarPedido`.
- [ ] **Step 5: Retomar (`retomar`, com login):**
  - Num `useEffect` de montagem, `lerRascunho()`.
  - Se houver rascunho: preenche os estados, filtra as cidades com `cidadesDoRascunho(r.cidadesIds, idsValidos)` e chama `irPara(4)`. Mostra `<Alert variant="success" role="status">` com o texto **"Pronto, você entrou. Confira seu pedido e toque em Publicar."** Se `perdeu`, acrescenta: **"Algumas cidades ficam fora da sua região e saíram do pedido."**
  - Se não houver rascunho: `<Alert variant="warning" role="status">` com o texto **"Não achamos o pedido que você começou. Escreva de novo, é rápido."** Só aparece com `retomar`.
  - Depois de `criarPedido` dar `ok`, chama `limparRascunho()` antes do `router.push`. Não limpe ao ler, para que recarregar a página não apague o pedido.
- [ ] **Step 6: Verificar no navegador** (sem chaves reais: login de teste do Clerk de desenvolvimento, se o `.env.local` tiver; senão, verifique só a parte sem login e registre no relatório o que não foi provado):
  - sem login, preencha os 4 passos → "Entrar para publicar" → chega em `/entrar?redirect_url=%2Fradar%2Fpedir%3Fretomar%3D1`, e o localStorage tem `mr-radar-rascunho`;
  - com login, abra `/radar/pedir?retomar=1` com o rascunho → passo 4 com o resumo certo e o aviso verde;
  - com login, `?retomar=1` sem rascunho → aviso amarelo, passo 1;
  - `npm test` todo PASS; `npx tsc --noEmit` e `npx eslint --no-eslintrc -c .eslintrc.json src/components/radar src/app/radar src/lib/rascunho-radar.ts` sem erro.
- [ ] **Step 7: Commit** `feat(radar): pedido escrito antes do login volta pronto para publicar`

### Task 4: Atualizar a documentação do Radar

**Files:**
- Modify: `docs/designs/radar-v2.md`, na seção de quem pode pedir (troque "só com login" pela regra nova)
- Modify: `docs/designs/crescimento-radar-lojista.md`, para marcar a etapa 1 como feita e citar o PR

- [ ] **Step 1:** Edite os dois arquivos.
- [ ] **Step 2: Commit** `docs(radar): pedido antes do login`

---

## Fora deste plano (etapas seguintes, cada uma com plano próprio)

Cartaz com QR, "Vou procurar", total de contatos para o lojista grátis, cortesia no primeiro anúncio e WhatsApp oficial. A ordem está em `docs/designs/crescimento-radar-lojista.md`.
