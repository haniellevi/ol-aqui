# Regras para qualquer IA que mexa neste projeto

Projeto: **Mercado da Região** (classificados regionais). Dono: Raniel, que não é técnico. Fale em português simples.

## Antes de criar ou mudar qualquer coisa que o usuário vê

1. **Leia o [`DESIGN.md`](DESIGN.md) inteiro.** Ele é o único documento que manda no visual. Se outro arquivo disser um número diferente, vale o `DESIGN.md`.
2. Leia [`docs/USABILIDADE.md`](docs/USABILIDADE.md) (12 regras e o checklist) e, para textos, [`docs/MARCA.md`](docs/MARCA.md).
3. Procure a peça pronta na seção 9 do `DESIGN.md` antes de escrever uma nova.

## Proibições

- Nunca escreva cor em hexadecimal, `rgb()` ou classe arbitrária (`bg-[#...]`) em componente. Use os tokens (`bg-laranja`, `text-beringela`, `bg-primary`...).
- Nunca escreva tamanho à mão (`text-[13px]`, `h-[42px]`). Use a régua.
- Nunca use letra abaixo de 12 px nem alvo de toque abaixo de 44 px.
- Nunca use texto branco sobre laranja, nem laranja `#ff6a13` como cor de letra.
- Nunca crie um card de anúncio fora de `<CardAnuncio />`, uma busca fora de `<CampoBusca />`, uma lista de categorias fora de `<FaixaCategorias />`, uma tela vazia fora de `<Vazio />`.
- Nunca coloque na mesma tela duas buscas, duas listas de categorias, dois blocos de lojas ou dois botões laranja.
- Nunca escreva "Carregando…" solto: use `Skeleton` / `carregando.tsx`.
- Nunca use `window.confirm`: use `useConfirmar`.
- Nunca instale biblioteca de interface (Radix, MUI, DaisyUI, Embla, Sonner, framer-motion etc.) sem o "sim" do Raniel no chat.
- Nunca crie modo escuro, animação de entrada ou outro pacote de ícones além do Lucide.
- Estilo novo entra na peça do shadcn (`src/components/ui/`), nunca na casca em português.

## Ao terminar uma tela

- Rode `npm run lint`, `npm run typecheck` e, quando existir, `npm run design:conferir` (especificado em [`docs/design-system/CONFERIDOR.md`](docs/design-system/CONFERIDOR.md)).
- Confira o checklist do fim do `docs/USABILIDADE.md` numa tela de 360 px.
- Se precisar fugir de uma regra, pare e pergunte. Se a regra mudar, mude primeiro o `DESIGN.md`, depois o código.

## Outras regras do projeto

- Preços, limites, categorias, nomes de planos e textos de negócio vêm do painel admin, nunca fixos no código (`PRODUCT.md`).
- Nomes internos antigos (`olaki-*`, repositório `ol-aqui`) ficam como estão (`docs/MARCA.md`, seção 7).
- Não publicar, não fazer push ou merge, não mexer em produção nem em banco remoto sem o "sim" do Raniel.
