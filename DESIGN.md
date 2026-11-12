---
name: Mercado da Região
description: Shopping digital e classificados regionais, com o Radar de Negócios. "olha aqui o que você procura".
colors:
  beringela: "#4b1248"
  laranja: "#ff6a13"
  laranja-escuro: "#c2410c"
  verde: "#12a150"
  verde-escuro: "#0e7a3d"
  fundo: "#f7f8fa"
  cartao: "#ffffff"
  texto: "#342b3b"
  texto-suave: "#5e5266"
  borda: "#e6e0e9"
  borda-campo: "#968b9e"
  selecao: "#f0eaf5"
  perigo: "#b91c1c"
  perigo-fundo: "#fef2f2"
  aviso: "#b45309"
  aviso-fundo: "#fffbeb"
  sucesso-fundo: "#ecf8f1"
  patrocinado-fundo: "#ffe4d1"
  coracao: "#e11d48"
typography:
  preco:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  titulo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  secao:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  titulo-card:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  corpo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  campo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  rotulo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.45
  legenda:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  campo: "8px"
  card: "10px"
  marca: "12px"
  folha: "20px"
  cheio: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  toque: "44px"
components:
  button-primary:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.fundo}"
  button-whatsapp:
    backgroundColor: "{colors.verde-escuro}"
    textColor: "{colors.cartao}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.perigo}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.perigo-fundo}"
  button-text:
    textColor: "{colors.laranja-escuro}"
    typography: "{typography.rotulo}"
    padding: "0 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.texto}"
    typography: "{typography.campo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.selecao}"
    textColor: "{colors.beringela}"
  card-anuncio:
    backgroundColor: "{colors.cartao}"
    rounded: "{rounded.card}"
    padding: "10px"
  marca-selo:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.beringela}"
    rounded: "{rounded.marca}"
    size: "36px"
  nav-bottom:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.texto-suave}"
    height: "64px"
  nav-bottom-active:
    textColor: "{colors.beringela}"
---

# Design System: Mercado da Região

## Overview

**Creative North Star: "A feira da cidade"**

O Mercado da Região deve parecer a feira da cidade: tudo perto, conhecido e direto. Cada anúncio é uma barraca organizada, com a foto do produto de verdade, o preço à vista e o vendedor a um toque, no WhatsApp. Nada de vitrine de shopping nacional, nada de brilho de startup. Quem abre tem que reconhecer o comércio da própria cidade e saber na hora o que fazer.

A interface é compacta e calma. Uma família de letra só (Poppins), duas cores da marca (beringela e laranja), superfícies brancas sobre um fundo cinza bem claro e frio. A hierarquia vem do tamanho, do peso e do espaço, não de enfeite. Cada tela tem um botão principal laranja; o resto fica em beringela, borda ou texto. O movimento só responde ao toque.

O sistema é feito para o pior caso: celular Android de entrada, 360 px de largura, sol do meio-dia, internet fraca e quem lê devagar. Contraste forte, áreas de toque generosas e texto escrito ao lado de cada ícone importante.

**Key Characteristics:**
- Beringela para marca, títulos e texto de ação; laranja para o único botão principal e o selo da marca.
- Fundo frio `fundo` com cartões brancos; bege e laranja-claro saíram da interface.
- Poppins em três pesos (400, 600, 700); preço é o único texto em 700 fora do logo.
- Controles de 44 px no toque e 40 px com mouse a partir de 768 px.
- Profundidade mínima: borda discreta e duas sombras com tom de beringela.
- Navegação de baixo com cinco itens e o "+ Anunciar" laranja no meio.

## Colors

Duas cores de marca sobre neutros frios levemente arroxeados, com verde reservado ao WhatsApp e ao sucesso.

### Primary
- **Beringela Vinho** (`beringela`): a voz da marca. Títulos, nome da marca, texto dos botões laranja, ícones, chip selecionado e navegação ativa. Puxa para o vinho de propósito, para não lembrar o roxo violeta do OLX.

### Secondary
- **Laranja Feira** (`laranja`): o botão principal, o "+ Anunciar" da barra de baixo, o selo "M" da marca e as etiquetas. Sempre com texto beringela por cima (4,95:1).
- **Laranja Tijolo** (`laranja-escuro`): o laranja que lê sobre branco. Links dentro de frase, botão de texto, borda e anel de foco, cursor dos campos.

### Tertiary
- **Verde Conversa** (`verde-escuro`): só o botão "Chamar no WhatsApp" e mensagens de sucesso, com texto branco.
- **Verde Selo** (`verde`): só ícones e selos; nunca como fundo de texto (3,4:1 com branco).

### Neutral
- **Cinza Manhã** (`fundo`): fundo das telas e hover dos botões claros.
- **Papel** (`cartao`): cartões, folhas, formulários, barra de baixo.
- **Tinta Ameixa** (`texto`): corpo de texto.
- **Ameixa Suave** (`texto-suave`): cidade, "há 2 dias", legendas, item inativo da navegação (7,3:1 sobre branco).
- **Linha Lavanda** (`borda`): bordas de cartão e divisórias.
- **Contorno de Campo** (`borda-campo`): campos, chips e controles (3:1 sobre branco).
- **Lavanda Seleção** (`selecao`): navegação ativa, chip selecionado, círculo dos ícones de categoria, aviso não lido.
- **Estados:** `perigo` sobre `perigo-fundo` (5,9:1), `verde-escuro` sobre `sucesso-fundo` (5,0:1), `aviso` sobre `aviso-fundo`, beringela sobre `patrocinado-fundo` na etiqueta "Patrocinado".

### Named Rules
**The Laranja Calado Rule.** Texto branco nunca vai sobre o laranja (2,9:1, reprova até em letra grande). Sobre laranja, o texto é beringela. Onde precisar de branco, o fundo é `laranja-escuro` ou beringela.

**The Um Laranja Rule.** Um botão laranja por tela. Dois laranjas brigando é erro, não destaque.

**The Lavanda Calada Rule.** Sobre `selecao`, o texto é beringela; laranja-escuro ali não passa 4,5:1 em letra pequena.

## Typography

**Display Font:** Poppins (com system-ui, sans-serif), carregada pelo `next/font` com `display: swap`
**Body Font:** Poppins (mesma família)

**Character:** uma geométrica redonda e amigável, a mesma do nome da marca. Uma família só baixa menos dados e deixa a tela com cara de cartaz de comércio local, não de jornal.

### Hierarchy
- **Preço** (700, 24 px / 30): preço na página do anúncio. No card, 16 px em 700.
- **Título** (600, 20 px, 1,3): título da tela (`text-titulo`).
- **Seção** (600, 18 px, 1,4): títulos de seção (`text-xl`). No painel admin, título de seção único em 18 px semibold beringela.
- **Título de card** (600, 16 px, 1,5): grupos e cartões (`text-lg`).
- **Corpo** (400, 15 px, 1,5): texto normal do site público (`text-base`). O painel usa 14 px.
- **Campo** (400, 16 px, 1,5): o valor digitado nos campos com toque. Com mouse a partir de 768 px, 14 px.
- **Rótulo** (600, 14 px, 1,45): rótulos de campo, botões e chips.
- **Legenda** (400, 13 px, 1,4): cidade, data, metadados, nomes da barra de baixo. Nada menor que isso.

### Named Rules
**The Três Pesos Rule.** Só 400, 600 e 700. O peso 700 é do preço e da marca; título e botão usam 600; valor de formulário e `<dd>` ficam em 400.

**The Zoom Livre Rule.** Tamanhos em rem e zoom nunca travado. Muita gente da região usa letra grande no celular, e a tela tem que crescer junto.

## Layout

Celular primeiro, uma coluna em 360 px, com margem lateral de 16 px. Espaçamento em múltiplos de 4 (4, 8, 12, 16, 24, 32, 48). Cards de anúncio em duas colunas no celular e 4 a 5 no computador; o card inteiro é tocável.

No celular, a navegação fica numa barra fixa embaixo (64 px mais a área segura do iPhone) e as páginas reservam esse espaço no rodapé. A partir de 768 px (`md`) a barra some e Minha conta passa a duas colunas. Grades do painel respondem à largura do próprio cartão: quatro colunas só com 48 rem disponíveis, e indicadores em quatro colunas só a partir de 1280 px. Tabelas largas rolam dentro da própria região.

Ações importantes ficam na metade de baixo, ao alcance do polegar. Escolhas curtas usam chips e botões segmentados no lugar de lista suspensa; filtros, cidade e confirmações sobem numa folha de baixo.

## Elevation & Depth

Quase plano. A profundidade vem de cartão branco sobre fundo cinza e de borda discreta; a sombra é exceção e sempre tingida de beringela, nunca preta.

### Shadow Vocabulary
- **Sombra rasa** (`box-shadow: 0 1px 2px rgb(75 18 72 / 0.08)`): cards públicos de anúncio que precisam se separar do fundo.
- **Sombra de base** (`box-shadow: 0 -2px 12px rgb(75 18 72 / 0.12)`): barra de baixo, folhas que sobem e o "+ Anunciar" flutuante.

### Named Rules
**The Borda Antes Rule.** Primeiro tente separar com `borda` ou com o contraste fundo/cartão. Sombra só nos dois casos acima.

## Shapes

Cantos suaves e consistentes, iguais ao selo da marca. Campos, botões e chips em 8 px; cartões em 10 px; o selo "M" da marca em 12 px; folhas que sobem de baixo em 20 px no topo; selos e avatar redondos por inteiro. Fotos de anúncio em 4:3, cortadas no centro. Ícones de categoria num círculo `selecao` com o desenho em beringela.

## Components

### Buttons
Diretos e firmes, com o texto dizendo o que acontece ("Publicar anúncio", nunca "OK").
- **Shape:** cantos suaves (8 px), altura de 44 px no toque e 40 px com mouse, texto de 14 px em 600, ícone lucide de 16 px antes do texto.
- **Principal:** fundo laranja, texto beringela. Um por tela.
- **WhatsApp:** fundo verde-escuro, texto branco, ícone de conversa. Só para chamar vendedor ou comprador.
- **Secundário:** borda beringela, fundo branco; hover em `fundo`. No painel admin, a variante `discreto` (fundo `selecao`, texto beringela) é a ação padrão.
- **Perigo:** borda e texto `perigo` sobre branco; hover em `perigo-fundo`; sempre com confirmação.
- **Texto:** laranja-escuro, sublinha no hover. Só para "Pular", "Ver todos".
- **Hover / Focus:** hover clareia 5%; foco por teclado com contorno de 3 px laranja-escuro afastado 2 px. Ao apertar, desce 1 px em 120 ms (`olaki-acao`), sem movimento com `prefers-reduced-motion`.
- **Carregando:** bolinha girando, texto troca ("Publicando...") e o botão trava para não duplicar anúncio.

### Chips
- **Style:** borda `borda-campo`, fundo branco, texto beringela de 14 px em 600, 44 px de altura.
- **State:** selecionado com fundo `selecao`, borda beringela e um ✓; o estado nunca depende só da cor. Com link usa `aria-current`, como botão usa `aria-pressed`.

### Cards / Containers
- **Corner Style:** 10 px.
- **Background:** `cartao` sobre `fundo`.
- **Shadow Strategy:** sombra rasa nos cards públicos; na vitrine, anel de 1 px `borda` no lugar.
- **Card de anúncio:** foto 4:3, coração de favorito no canto da foto, preço 16 px em 700, título 14 px em até 2 linhas, metadados de 13 px, preenchimento de 10 px. Etiqueta "Patrocinado" escrita em todo destaque pago.

### Inputs / Fields
- **Style:** borda `borda-campo`, fundo branco, cantos de 8 px, 44 px de altura, texto de 16 px no toque.
- **Focus:** borda laranja-escuro com anel de 2 px laranja-escuro a 30%.
- **Error / Disabled:** borda `perigo` e a mensagem escrita embaixo em 14 px e 600 (`role="alert"`), nunca só a borda vermelha. Desativado em `fundo` com 70% de opacidade.
- **Rótulo:** sempre visível acima, 14 px em 600; "(opcional)" em `texto-suave`.

### Navigation
- **Barra de baixo (celular):** Início · Buscar · [+ Anunciar] · Radar · Conta. Ícone de 24 px com o nome embaixo em 13 px e 600. Item inativo em `texto-suave`, ativo em beringela com traço mais grosso e nome sublinhado. O "+ Anunciar" é um quadrado laranja de 48 px que sobe 20 px acima da barra.
- **Cabeçalho público:** marca à esquerda e cidade atual com seta para trocar.

### Marca
O logo do Mercado da Região é o **selo "M"**: um quadrado laranja de 36 px com cantos de 12 px e a letra "M" em beringela, 700, seguido do nome em duas linhas ("Mercado" em 15 px e 700, "da Região" em 13 px e 600), tudo em beringela. Vale para o cabeçalho e é a base para o ícone do app e a imagem de compartilhamento.

## Do's and Don'ts

### Do:
- **Do** usar um único botão laranja com texto beringela por tela.
- **Do** escrever o nome ao lado de todo ícone importante; ícone sozinho só para lupa, coração, X e voltar.
- **Do** manter 44 px de área de toque no celular e 8 px de espaço entre alvos vizinhos.
- **Do** mostrar o preço sempre, com "a combinar" claro quando não houver valor.
- **Do** escrever "Patrocinado" em todo anúncio pago.
- **Do** usar fotos reais do produto anunciado.
- **Do** dar uma saída em toda tela vazia ("Pedir no Radar", "Perguntar ao Aki").

### Don't:
- **Don't** colocar texto branco sobre o laranja `#ff6a13`.
- **Don't** usar roxo violeta vivo (como o `#6E0AD6` do OLX); o roxo da marca é só o beringela.
- **Don't** voltar com bege ou `laranja-claro` como superfície.
- **Don't** usar negrito fora de título, valor-chave, preço e botão.
- **Don't** usar imagem de banco de imagens na home.
- **Don't** criar animação de entrada, movimento contínuo ou vídeo tocando sozinho.
- **Don't** usar o logo antigo OLAKI em tela nova.
