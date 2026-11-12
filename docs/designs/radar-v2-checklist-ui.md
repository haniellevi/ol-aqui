# Radar v2 · checklist de tela (Task 7)

Pedido em 4 passos (`/radar/pedir`) e "Meu pedido" (`/radar/pedido/[id]`) contra **formulário passo a passo e
detalhe do Radar** (o tipo foi decidido pelas rotas `src/app/radar/*` e pelo assistente do anúncio,
`src/components/anunciar/cabecalho-passo.tsx`, que é o único outro formulário em passos do projeto).
Referência: `src/components/radar/form-pedido.tsx` (escolhida: é o formulário que a página `pedir` importa e o
mais recente do Radar). Família: 6 telas/componentes do Radar com formulário ou detalhe
(`form-pedido`, `folha-propor`, `acoes-pedido`, `propostas-recebidas`, `pedido/[id]/page`, `[id]/page`) de 12
candidatos em `src/app/radar` + `src/components/radar` (fora: `actions.ts`, `util.ts`, `validacao.ts`,
`loading`, `layout`, `atualizar-radar`). Lido em 12/11/2026.

- [ ] Volta ao topo — link `-ml-2 inline-flex min-h-10 … text-base font-semibold text-laranja-escuro` com
      `ChevronLeft` + texto — 3 de 3 páginas do Radar (busca `ChevronLeft` em `src/app/radar`).
- [ ] Título da página — `h1 font-semibold text-beringela` (o desenho dos 4 de 6 h1 do Radar), em
      `text-facil-titulo` (24px, Modo fácil, decisão do controlador na revisão); a pergunta de cada passo é
      `h2 text-3xl` (20px), sempre maior que o corpo (uma pergunta por tela, Global Constraints).
- [ ] Indicador de passo — "Passo N de 4 · Nome" em `text-sm font-semibold text-texto-suave` + barrinhas
      `h-1.5 rounded-full bg-laranja | bg-borda` e `aria-current="step"` — o mecanismo e os valores de
      `CabecalhoPasso` (peça do anunciar, 7 páginas); não reutilizável aqui (preso às rotas do anúncio), então
      escrito do mesmo jeito dentro de `form-pedido`.
- [ ] Campos — `Campo` de `src/components/ui/campo` (rótulo visível, `erro` embaixo, `opcional`) — 2 de 2
      formulários do Radar; categoria pelo `Seletor` atual.
- [ ] Cartão de escolha (área, quem vê, modo de contato) — `<label>` com `<input type="radio" class="sr-only">`,
      `rounded-card border p-4`, marcado `border-laranja-escuro bg-selecao`, foco `focus-within:outline-3
      outline-laranja-escuro`, bolinha `bg-laranja-escuro text-white` — maioria, 3 de 4 cartões de escolha do
      projeto (`escolher-plano`, `form-detalhes`, `escolha-categoria`) contra o `CartaoModo` (`button
      aria-pressed`) da referência; o brief pede `radio` com rótulo.
- [ ] Cidades — `Chip` de `src/components/ui/chip` (botão com `aria-pressed` e ✓ quando marcado) — a peça
      compartilhada, já usada pela referência para cidade e prazo.
- [ ] Botões — `Botao` de `src/components/ui/botao`, um só laranja por tela (DESIGN.md "Um Laranja"),
      `larguraTotal`, `tamanho="grande"` (48px e 18px em qualquer tela, sem o `.olaki-controle`); `Chip`,
      `Campo` e `Seletor` também com `tamanho="grande"` — peça compartilhada, 12 arquivos do Radar; 48px é o
      Modo fácil (`docs/designs/radar-v2.md`).
- [ ] Folha — `Folha/FolhaContent/FolhaHeader/FolhaTitle` de `src/components/ui/folha` (gaveta no celular,
      janela no computador) para "Já resolvi" — a peça compartilhada, como `folha-propor`.
- [ ] Erros — de campo: `erro` do `Campo` ou `<p role="alert" class="text-sm font-semibold text-perigo">`;
      geral: `Alert variant="destructive" role="alert"`; foco vai para o campo — 3 de 3 componentes com erro
      (`form-pedido`, `folha-propor`, `propostas-recebidas`). Erro do servidor com `campo` volta ao passo dele.
- [ ] Cartões de conteúdo — `rounded-card bg-cartao p-4 shadow-1`; aviso/destaque `rounded-card bg-fundo p-4`
      — 3 de 3 telas de detalhe.
- [ ] Texto e cor pelo tema (`text-beringela`, `text-texto-suave`, `text-laranja-escuro` em link); nunca
      branco sobre `laranja`; corpo das telas tocadas em `text-facil` (18px, token novo em `globals.css`).
- [ ] Não copiado da referência: o `CartaoModo` com `button aria-pressed` (vira rádio), o rótulo de grupo em
      `text-base`, o único botão "Pedir no Radar" (vira Voltar/Continuar + "Publicar pedido").

**Tamanho (decidido na revisão da Task 7a):** no tema `text-lg` = 14px. Para o corpo de 18px do Modo fácil
foram criados `--text-facil` (18px) e `--text-facil-titulo` (24px) em `src/app/globals.css` (e no `cn`,
`src/lib/utils.ts`), e as variantes aditivas `tamanho="grande"` em `Botao`, `Chip`, `Campo` e `Seletor`.
