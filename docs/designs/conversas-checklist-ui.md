# Conversas · checklist de tela (Task 4)

Telas: `/conversas` (lista), `/conversas/[id]` (conversa), ícone "Conversas" no topo, botão "Conversar" na barra
do anúncio, `/admin/conversas/[id]`. Tipo: **lista e detalhe da área da conta** (rotas em `src/app/(conta)`).
Referência (escolhida, nível 7): `src/app/(conta)/minha-conta/notificacoes/page.tsx` — é a lista pessoal mais
parecida (linhas com não lido, contagem, vazio). Valores e Modo fácil vêm do checklist já feito do Radar
(`docs/designs/radar-v2-checklist-ui.md`), não contados de novo. Lido em 13/11/2026.

Árvore da conversa:
```
PaginaConta larga                         main
  TopoConta (voltar "Conversas", h1 = nome do outro lado)
    MenuSeguranca                         Bloquear/Desbloquear (Botao secundário) + Denunciar (Folha)
  Aviso tipo="info" (fixo, sticky)        aviso de acompanhamento + "Nunca pague adiantado…"
  ol de mensagens                         balões (texto), CartaoMensagem (anúncio/proposta), sistema
  form de envio                           Textarea + Botao primário "Enviar" (tamanho grande)
    Mostrar meu WhatsApp (cliente) | Chamar no WhatsApp (loja, número liberado)
```

- [ ] Contêiner e topo — `PaginaConta` + `TopoConta` de `src/components/conta/topo-conta` (h1 `text-titulo
      font-semibold text-beringela`, voltar 40px) — a referência e as telas da conta. Lista: voltar = Minha
      conta; conversa: voltar = `/conversas`, texto "Conversas".
- [ ] Linha da lista — o desenho de `LinhaAviso` (`flex min-h-14 … hover:bg-fundo`, não lida `bg-selecao/40` +
      título `font-semibold text-beringela`, `tempoRelativo` em `<time>`, `ChevronRight`), mas como **Link** (a
      linha só navega), dentro de `ul rounded-card border border-borda bg-cartao` com `border-b last:border-b-0`.
      Contador de não lidas com número escrito ("2 novas"), nunca só a bolinha.
- [ ] Vazio — `Vazio` de `src/components/ui/vazio` com ícone e "Nenhuma conversa ainda." + texto explicando o
      botão Conversar — a peça compartilhada, como a referência.
- [ ] Ícone do topo — o mesmo comportamento de `SinoAvisos` (busca a cada 60 s, ao focar e no evento próprio,
      `aria-label` com o número, bolinha `bg-laranja-escuro text-white text-legenda`); rótulo "Conversas"
      visível a partir de `sm` (nenhum ícone sem texto, Modo fácil); só com login e com `conversas.ativa`.
- [ ] Botões — `Botao` / `classesBotao` de `src/components/ui/botao`; na conversa `tamanho="grande"` (48px,
      `text-facil`); um só laranja por tela ("Enviar"); WhatsApp na variante `whatsapp`; Bloquear em
      `secundario`, Denunciar em `perigo`. Na barra do anúncio "Conversar" é `secundario` ao lado do WhatsApp
      (`min-w-0 flex-1 px-3`, como o botão do WhatsApp), ícone `MessageSquare` + texto.
- [ ] Avisos — `Aviso` de `src/components/conta/aviso` (`info` para o aviso fixo; `atencao` para o alerta de
      golpe embaixo da mensagem marcada; `erro` para falha de carregar/enviar).
- [ ] Denunciar — `Folha` com motivos em `<label>` + `input type="radio"` (classe `OPCAO` do
      `denunciar.tsx` do anúncio), `Textarea` opcional e `Botao variante="perigo" larguraTotal` "Enviar
      denúncia" — o mesmo desenho da denúncia de anúncio (única outra denúncia do projeto). Motivos da tabela
      `denuncias` (lista em `components/conversas/validacao.ts`).
- [ ] Confirmação — `useConfirmar` + `JanelaConfirmar` de `src/components/ui/confirmar` montada na página da
      conversa (fora do admin ela não está no layout) para "Mostrar meu WhatsApp" e "Bloquear".
- [ ] Cartões de conteúdo (anúncio/proposta na conversa) — `rounded-card bg-cartao p-4 shadow-1`, foto 64px
      `rounded-campo object-cover`, preço por `preco()` de `@/lib/formato`, link "Ver anúncio"/"Ver pedido" em
      `text-laranja-escuro underline` — como os cartões das telas de detalhe do Radar.
- [ ] Balões — do próprio lado `bg-selecao` alinhado à direita, do outro `bg-cartao border border-borda` à
      esquerda, `rounded-card px-4 py-3 text-facil`, hora em `text-legenda text-texto-suave`; sistema centralizado
      `text-sm text-texto-suave`. Peça nova (nenhum chat no projeto): só cores e raios do tema.
- [ ] Erros — de envio em `<p role="alert" class="text-sm font-semibold text-perigo">` embaixo do campo; sem
      `name="id"` em campo oculto de `<form action>` (o envio é por chamada direta da ação, sem `<form action>`).
- [ ] Texto e cor pelo tema (`text-beringela`, `text-texto-suave`, `text-laranja-escuro` em link); nunca branco
      sobre `laranja`; corpo da conversa em `text-facil`.

**Não copiado da referência:** a coluna de preferências e os chips de filtro (não há preferências nem filtro nas
conversas), o botão "Atualizar" (a conversa se atualiza sozinha a cada 10 s).

**Custo:** 14 arquivos do projeto abertos, ~12 buscas; lidos deste plugin: `finding-patterns`. Contagens herdadas
do checklist do Radar (não recontadas).
