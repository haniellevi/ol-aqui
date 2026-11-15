# Conferidor do design system · especificação

**Estado: programado em 14/11/2026 (onda 0).** Comando: `npm run design:conferir`. Script: `scripts/conferir-design.mjs`. Dívidas: `scripts/conferir-design.divida.json` (35 ocorrências em 17 itens no dia em que nasceu). A lista só diminui: `npm run design:conferir -- --registrar` recusa item novo ou número maior.

Objetivo: acusar sozinho quando alguém (pessoa ou IA) foge do `DESIGN.md`, sem instalar pacote novo.

## Por que script próprio

- `eslint-plugin-tailwindcss` 4.x exige ESLint 9; o projeto usa 8.57.
- `eslint-plugin-better-tailwindcss` exige Tailwind 4.1.17 ou mais; o projeto usa 4.1.13.
- Um script de busca em texto e as regras nativas do ESLint 8 resolvem sem dependência (pesquisa 04).

## Parte 1 · script `scripts/conferir-design.mjs`

Comandos a criar no `package.json`: `design:conferir` (falha com código 1 se achar erro) e inclusão no fluxo junto de `lint`.

Varre `src/**/*.{ts,tsx,css}` e acusa, com arquivo e linha:

| Regra | O que procura | Exceções permitidas |
|---|---|---|
| Cor solta | `#rgb`, `#rrggbb`, `rgb(`, `hsl(` fora de `globals.css` | `src/app/layout.tsx` (tema do Clerk e viewport), rotas de imagem (`opengraph-image`, `icon`, criativos de marketing), `src/components/demo/`, `manifest`, arquivos de logo |
| Classe de cor arbitrária | `bg-[#`, `text-[#`, `border-[#`, `text-[rgb`, `bg-[color-mix` | nenhuma |
| Paleta padrão do Tailwind | `(bg|text|border|ring)-(gray|slate|zinc|red|green|blue|purple|orange|yellow)-\d+` | nenhuma |
| Tamanho à mão | `text-[\d+px]`, `h-[\d+px]`, `min-h-[\d+px]` | `src/components/demo/` |
| Letra abaixo do piso | qualquer `text-[Npx]` com N < 12; `font-size` menor que `0.75rem` em CSS | nenhuma |
| Branco sobre laranja | `bg-laranja` e `text-white` na mesma lista de classes | nenhuma |
| Laranja como letra | `text-laranja` (sem `-escuro`) | nenhuma |
| "Carregando" solto | texto `Carregando…` ou `Carregando...` em JSX fora de `carregando.tsx` | texto de botão em andamento ("Publicando…") |
| Confirmação nativa | `window.confirm(`, `confirm(` | nenhuma |
| Modo escuro | classes `dark:` | peças vindas do shadcn em `src/components/ui/` |

Exceções ficam numa lista no topo do script, cada uma com o motivo. Não aceitar comentário do tipo "ignorar esta linha".

Situação medida em 14/11/2026 (pesquisa 04): 61 cores soltas em 20 arquivos e 5 tamanhos à mão no `card-anuncio.tsx`. Para não travar o trabalho no primeiro dia, o script começa com uma **lista de dívidas** (arquivos já conhecidos): neles só avisa; em arquivo novo ou fora da lista, falha. A lista só pode diminuir.

## Parte 2 · regras nativas do ESLint 8 (`.eslintrc.json`) — ligadas

Bibliotecas proibidas e `confirm`/`alert` dão **erro**. Tabela, divisória e lista de escolha escritas à mão dão **aviso** (eram 62 no dia em que a regra entrou; somem nas ondas 1 a 5).

- `no-restricted-imports`: proibir `@radix-ui/*`, `@headlessui/*`, `@mui/*`, `antd`, `@chakra-ui/*`, `daisyui`, `flowbite*`, `embla-carousel*`, `sonner`, `framer-motion`, `motion`, e qualquer pacote de ícones que não seja `lucide-react`.
- `no-restricted-syntax` (aviso): `<table>`, `<hr>` e `<select>` escritos à mão fora de `src/components/ui/`, apontando para `Table`, `Separator` e `NativeSelect`.
- `no-restricted-globals`: `confirm`, `alert`.

## Parte 3 · revisão por agente

Depois de cada tarefa de tela, rodar a skill `ui-ux-reviewer` (já em `.claude/skills/`) com o checklist do `docs/USABILIDADE.md` numa tela de 360 px: uma busca, uma lista de categorias, um bloco de lojas, um botão laranja, toque de 44 px, preço como texto mais forte do card.

## Pronto quando

- `npm run design:conferir` existe, passa na `main` e falha num arquivo de teste com cada erro da tabela.
- As regras do ESLint estão ativas e `npm run lint` passa.
- O `AGENTS.md` cita o comando (já cita).
