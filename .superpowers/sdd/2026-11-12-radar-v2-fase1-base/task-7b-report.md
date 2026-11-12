# Task 7b — relatório

**Status:** DONE_WITH_CONCERNS · commit `a723495` (ramo `claude/radar-v2`, sem push).

## O que foi feito
- `/radar/[id]`: `pedido.bloqueado` é tratado ANTES do redirect de comprador e de qualquer lógica de proposta:
  "Este pedido é só para lojas verificadas." + bloco de planos (sem título/detalhes). Quem não atende
  (`acesso.temAcesso` false) num pedido `todos` vê o pedido e o botão "Eu sei onde tem" (`FolhaIndicar`), sem "Mandar oferta"
  e sem a linha "Ao propor, você chama o comprador". Quem atende vê como antes. "X propostas restantes" só chega a quem tem acesso
  (`acessoRadar` já devolve 0 sem acesso). Página no Modo fácil (`text-facil`, h1 `text-facil-titulo`, botões `tamanho="grande"`);
  mostra `area_texto` e o selo.
- `folha-indicar.tsx`: busca pela action nova `buscarParaIndicar` (usa `buscarAnuncios`, a mesma busca do site, região da pessoa,
  8 resultados, exige login), lista foto/título/preço/loja, "Indicar este" → `indicarAnuncio`. Erros P0001 do banco
  ("Use "Mandar oferta"…" / "Indique um anúncio de outra pessoa.") já chegam em português pelo `traduzirErro`.
  Tela de "Indicação enviada" depois.
- `selo-visibilidade.tsx` ("Todo mundo"/"Só lojas", ícone + texto) e `area_texto` no feed (`radar-de-negocios`, `page.tsx` do /radar) e em `listas-radar`.
- Admin: `cortesia-radar.tsx` (data "Até", motivo, "Dar cortesia"/"Mudar a data"/"Tirar cortesia") + seção "Cortesia do Radar" na ficha
  (só `admin`, loja não em montagem/arquivada/excluída), mostra cortesia ativa e até quando. Leitor: `src/lib/admin/cortesia-radar.ts`
  (`server-only`, `supabaseAdmin()` porque `radar_cortesias` tem RLS sem política; chamado só após `exigirTela("lojas")` e só se `admin`).

## Verificação
- Render estático + Chrome headless (fora do sandbox). Harness: `/tmp/claude-1000/-home-raniel-linux--claude-spares-spare-cgg2Fr/e57eb533-e0b7-4295-b474-02fc43d1b5c6/scratchpad/render/render7b.cjs`
  (rodar com `NODE_PATH=$PWD/node_modules`). Prints em `.../scratchpad/render/out7b/`: `id-bloqueado-375`, `id-indicar-375`, `id-indicar-1280`,
  `id-atende-375`, `folha-indicar-375`, `folha-indicar-erro-375`, `feed-375`, `lista-meus-375`, `admin-sem-900`, `admin-ativa-900`.
- Conferido no HTML: bloqueado não contém o título; "indicar" não contém "Propor"/"Mandar oferta"/"restantes".
- `npm run typecheck` ok; ESLint 0 erros (10 avisos antigos de `components/demo/kit`); `npm test` 457 testes, 447 ok, 10 falhas antigas (156–165).
- Novo teste: `buscarParaIndicar` (sem login, termo curto, repasse só do necessário, falha).
- Não feito: `ui-consistency:verifying` (exige agente separado; regra de não despachar), teste com leitor de tela, folha de verdade (render usa substituto), `npm run test:db` (sem mudança de banco).

## Pontos de atenção
1. `radar_pedido` só libera `detalhes` e nome do comprador a quem atende (`acesso`), inclusive em pedido `todos`: quem vai indicar vê só o título, a faixa de preço e "Detalhes só para quem tem plano com Radar." (texto pouco coerente para quem só quer ajudar). Corrigir exige mudar o banco (mostrar detalhes em `todos`) — decisão do produto.
2. `meus_pedidos_radar` e `minhas_propostas_radar` não devolvem `area_texto`/`visibilidade`: em `listas-radar` os campos são opcionais e só aparecem quando o banco os mandar (hoje: cai na cidade). O feed da região já mostra tudo.
3. Bloco de planos reusa o título "Este cliente já quer comprar" também no pedido bloqueado.
4. A busca para indicar usa a região do visitante (cookie/perfil) da busca do site; pode listar anúncios da própria pessoa, que o banco recusa com mensagem.
5. Selo é o `Badge` do projeto (12px) — texto sempre visível, mas menor que o corpo de 18px.

---

# Fix round 1

Migração nova `supabase/migrations/20261117035000_radar_ajustes_tela.sql` (create or replace de `radar_feed`, `radar_pedido`, `indicar_anuncio_radar`; drop+create de `meus_pedidos_radar`; grants repetidos).
- R1: `detalhes` de pedido "todos" visível a qualquer pessoa logada da região em `radar_pedido` e `radar_feed` (e por isso `radar_feed_regional`); nome do comprador continua só para quem atende. `radar/page.tsx` repassa detalhes de "todos". Teste 330 atualizado (esperava null).
- R2: `indicar_anuncio_radar` recusa quem atende: "Você pode mandar oferta neste pedido." (P0001). Testes em 640 (dono com anúncio próprio, e quem atende com anúncio de outra pessoa).
- R3: tela usa `status = 'aberto'` e `expira_em` futuro (não `situacao`); teste cobre prazo das propostas vencido (ainda indica) e pedido encerrado (não).
- 1: cartão do feed para "todos" + sem acesso + não comprador: detalhes à mostra, sem overlay de assinante, sem linha do comprador, botão "Eu sei onde tem" que abre a página do pedido.
- 2: `buscarParaIndicar(pedidoId, termo)` confere o pedido via `radar_pedido` (some se bloqueado/inexistente) e busca na região do pedido (= região da pessoa, única que vê o pedido; slug lido de `microrregioes`). Teste atualizado.
- 3: `meus_pedidos_radar` devolve `visibilidade` e `area_texto`; campos obrigatórios em `tipos-radar.ts`. Teste 640 confere.
- 4: texto do admin e comentário: "Libera tudo do Radar…". 5: alinhado a R3. 6: `Planos` com prop `titulo`; bloqueado usa "Quer ver pedidos como este?".
- 7: testes de render de `/radar/[id]` em tests/radar.test.cjs (bloqueado, "todos" sem acesso, prazo vencido, encerrado).
Verificação: typecheck ok; ESLint 0 erros (10 avisos antigos); npm test 459 (449 ok, 10 antigas 156-165); test:db: todos os PASS (64), inclusive 330 e 640.
Pendente/atenção: comentário em `admin/lojas/actions.ts:171` ainda diz "sem plano Full"; "Ver planos" secundário e tamanho do Badge ficaram parados como combinado.
