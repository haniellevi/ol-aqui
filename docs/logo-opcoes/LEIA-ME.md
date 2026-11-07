# Opções do logo (07/11/2026)

Motivo: no logo atual (`public/logo/olaki-opcao1-pin.svg`) o "ol" fino parece "oi".
Raniel pediu caixa alta ou uma fonte em que o L seja inconfundível.

Quatro opções, todas com o mesmo pin e as mesmas cores (beringela #4B1248 no "ol", laranja #FF6A13 no "aki"):

- `opcao-A-caixa-alta-poppins.svg` — OLAKI em caixa alta, Poppins Bold, pin sobre o I.
- `opcao-B-minusculo-atkinson.svg` — olaki minúsculo, Atkinson Hyperlegible Bold (l com rabinho).
- `opcao-C-minusculo-ubuntu.svg` — olaki minúsculo, Ubuntu Bold (l com curva).
- `opcao-D-minusculo-poppins-bold.svg` — olaki minúsculo, Poppins Bold (l grosso como as outras letras).

Falta, depois da escolha: versão para fundo escuro, ícone do app (`olaki-icone-app.svg`, `src/app/icon.svg`),
a tagline "olha aqui o que você procura" e atualizar `docs/DESIGN-SYSTEM.md`.

Para gerar de novo: `npm i opentype.js@1.3.4`, baixar as fontes `.ttf` (Poppins-Bold, AtkinsonHyperlegible-Bold,
Ubuntu-Bold, do repositório google/fonts) numa pasta `../fonts-logo/` e rodar `node gerar-opcoes.mjs`.

## Decisão (07/11/2026)

Raniel escolheu a **opção A** (OLAKI em caixa alta, Poppins Bold) e, para o ícone do app, **"AKI" com o pin**
(ele rejeitou "O" + "I", que se lê "OI"). O conjunto final está em `opcao-A-final/` (gerador: `gerar-final-opcao-A.mjs`)
e foi aplicado em `public/logo/`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/opengraph-image.png`
e `public/icone-192.png` / `public/icone-512.png`. Os arquivos antigos foram para `_lixeira/logo-2026-11-07/` (fora do git).
Alternativas de ícone guardadas: só o "O" (`icone-O.svg`, pasta `O/`) e "O" com o pin dentro (`icone-v2-O-pin.svg`, pasta `v2-O-pin/`).
Falta: atualizar a seção de logo do `docs/DESIGN-SYSTEM.md` (ainda descreve o logo minúsculo com o pin no "i").
