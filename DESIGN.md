---
name: Mercado da Região
description: Shopping digital e classificados regionais, com o Radar de Negócios. "aqui a sua cidade aparece."
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
  vitrine:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 1.6vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  titulo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  preco:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  secao:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  titulo-card:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.45
  corpo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  rotulo:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.45
  legenda:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  campo: "8px"
  card: "10px"
  folha: "20px"
  cheio: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  controle: "40px"
  controle-pequeno: "32px"
  toque: "44px"
components:
  button-primary:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.fundo}"
  button-whatsapp:
    backgroundColor: "{colors.verde-escuro}"
    textColor: "{colors.cartao}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.perigo}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.perigo-fundo}"
  button-text:
    textColor: "{colors.laranja-escuro}"
    typography: "{typography.rotulo}"
    height: "40px"
  button-small:
    typography: "{typography.legenda}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.texto}"
    typography: "{typography.corpo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "40px"
  chip-active:
    backgroundColor: "{colors.selecao}"
    textColor: "{colors.beringela}"
  card-anuncio:
    backgroundColor: "{colors.cartao}"
    rounded: "{rounded.card}"
    padding: "10px"
  nav-bottom:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.texto-suave}"
    typography: "{typography.legenda}"
    height: "56px"
  nav-bottom-active:
    textColor: "{colors.beringela}"
  header:
    backgroundColor: "{colors.cartao}"
    height: "52px"
---

# Design System: Mercado da Região

## Overview

**Creative North Star: "A feira da cidade"**

O Mercado da Região deve parecer a feira da cidade: tudo perto, conhecido e direto. Cada anúncio é uma barraca organizada, com a foto do produto de verdade, o preço à vista e o vendedor a um toque, no WhatsApp. O logo diz isso sozinho: o "M" de Mercado segura o pin laranja da Região, e a cidade aparece no mapa. Nada de vitrine de shopping nacional, nada de brilho de startup.

A interface é compacta e calma. Uma família de letra só (Poppins), duas cores da marca (beringela e laranja), cartões brancos sobre um fundo cinza bem claro e frio. A hierarquia vem do tamanho, do peso e do espaço, não de enfeite. Cada tela tem um botão principal laranja; o resto fica em beringela, borda ou texto. O cabeçalho e a barra de baixo flutuam como um material translúcido, e o conteúdo passa desfocado por baixo. O movimento só responde ao toque: o botão encolhe um pouco na hora em que o dedo encosta.

O sistema é feito para o celular de entrada, de 360 px, no sol e com internet fraca. A escala foi compactada de propósito em 10/11/2026 para tirar o peso das telas; contraste forte e ícone com palavra seguram a leitura.

**Key Characteristics:**
- Beringela para marca, títulos e texto de ação; laranja para o único botão principal, o pin do logo e o "+ Anunciar".
- Fundo frio `fundo` com cartões brancos; bege e laranja-claro saíram da interface.
- Poppins em três pesos (400, 600, 700), com letras mais juntas nos títulos e um pouco abertas nas legendas.
- Escala compacta: texto de 13 px, controles de 40 px no toque e 36 px com mouse.
- Cabeçalho e barra de baixo translúcidos com desfoque, sólidos quando o celular pede menos transparência.
- Componentes shadcn/ui ligados aos mesmos tokens: um componente novo já nasce com as cores da marca.

## Colors

Duas cores de marca sobre neutros frios levemente arroxeados, com verde reservado ao WhatsApp e ao sucesso.

### Primary
- **Beringela Vinho** (`beringela`): a voz da marca. "Mercado" e o M do logo, títulos, texto dos botões laranja, ícones, chip selecionado e navegação ativa. Puxa para o vinho de propósito, para não lembrar o roxo violeta do concorrente.

### Secondary
- **Laranja Pin** (`laranja`): o pin e "da Região" no logo, o botão principal e o "+ Anunciar" da barra de baixo. Com texto, sempre beringela por cima (4,95:1).
- **Laranja Tijolo** (`laranja-escuro`): o laranja que lê sobre branco. Links dentro de frase, botão de texto, anel de foco (`ring`), cursor dos campos.

### Tertiary
- **Verde Conversa** (`verde-escuro`): só o botão "Chamar no WhatsApp" e mensagens de sucesso, com texto branco.
- **Verde Selo** (`verde`): só ícones e selos; nunca fundo de texto (3,4:1 com branco).

### Neutral
- **Cinza Manhã** (`fundo`): fundo das telas e hover dos botões claros.
- **Papel** (`cartao`): cartões, folhas, formulários e a base das barras translúcidas.
- **Tinta Ameixa** (`texto`): corpo de texto.
- **Ameixa Suave** (`texto-suave`): cidade, "há 2 dias", legendas, item inativo da navegação (7,3:1 sobre branco).
- **Linha Lavanda** (`borda`): bordas de cartão e divisórias (`border` no shadcn).
- **Contorno de Campo** (`borda-campo`): campos, chips e controles (`input` no shadcn; 3:1 sobre branco).
- **Lavanda Seleção** (`selecao`): navegação ativa, chip selecionado, círculo dos ícones de categoria, selo padrão e a etiqueta "Exemplo".
- **Estados:** `perigo` sobre `perigo-fundo` (5,9:1), `verde-escuro` sobre `sucesso-fundo` (5,0:1), `aviso` sobre `aviso-fundo`, beringela sobre `patrocinado-fundo` na etiqueta "Patrocinado".

### Named Rules
**The Laranja Calado Rule.** Texto branco nunca vai sobre o laranja (2,9:1). Sobre laranja, o texto é beringela. Onde precisar de branco, o fundo é `laranja-escuro` ou beringela.

**The Um Laranja Rule.** Um botão laranja por tela. Dois laranjas brigando é erro, não destaque.

**The Lavanda Calada Rule.** Sobre `selecao`, o texto é beringela; laranja-escuro ali não passa 4,5:1 em letra pequena.

## Typography

**Display Font:** Poppins (com system-ui, sans-serif), carregada pelo `next/font` com `display: swap`
**Body Font:** Poppins (mesma família)

**Character:** uma geométrica redonda e amigável, a mesma do logo. Uma família só baixa menos dados e deixa a tela com cara de cartaz de comércio local, não de jornal.

### Hierarchy
- **Vitrine** (700, 22 px no celular até 32 px no computador, 1,15): só o título do Início (`text-vitrine`).
- **Título da tela** (600, 16 px no celular e 18 px a partir de 768 px, 1,25): `text-titulo`.
- **Preço** (700, 16 a 20 px): `text-xl` no card, `text-2xl` na página do anúncio.
- **Seção** (600, 15 px, 1,35): títulos de seção (`text-xl` / `text-lg font-semibold`).
- **Título de card** (600, 14 px, 1,45): `text-lg`.
- **Corpo** (400, 13 px, 1,5): texto normal (`text-base`). Campos usam 13 px; no iPhone sobem para 16 px para o Safari não dar zoom.
- **Rótulo** (600, 12 px, 1,45): rótulos, texto de apoio e botões (`text-sm`, `text-rotulo`).
- **Legenda** (400, 11 px, 1,4, letras um pouco abertas): cidade, data, metadados, nomes da barra de baixo e texto dos botões pequenos.

### Named Rules
**The Três Pesos Rule.** Só 400, 600 e 700. O peso 700 é do preço, da vitrine e do logo; título e botão usam 600; valor de formulário e `<dd>` ficam em 400.

**The Régua Rule.** Nada de tamanho escrito à mão (`text-[13px]`, `h-12`): use os nomes da régua do `globals.css`.

**The Zoom Livre Rule.** Tamanhos em rem e zoom nunca travado. Muita gente da região usa letra grande no celular, e a tela tem que crescer junto.

## Layout

Celular primeiro, uma coluna em 360 px, com margem lateral de 16 px. Espaçamento em múltiplos de 4 (4, 8, 12, 16, 20, 24, 32). Entre blocos da página, 20 px (`gap-5`); dentro de card, 12 px no celular e 16 px no computador. Cards de anúncio em duas colunas no celular e 4 a 5 no computador; o card inteiro é tocável.

Só três larguras de página: `max-w-md` (entrar e telas de uma ação), `max-w-xl` (formulários e leitura) e `max-w-6xl` (vitrines e listas). Botão com largura total só no celular; do tablet para cima ele para em 320 px.

No celular, a navegação fica numa barra fixa embaixo (56 px mais a área segura do iPhone). A partir de 768 px (`md`) a barra some, o cabeçalho passa de 52 para 56 px e Minha conta vira duas colunas. No painel, grades respondem à largura do próprio cartão, indicadores só passam a quatro colunas em 1280 px e tabelas largas rolam dentro da própria região. Card com no máximo duas ações à vista; o resto vai para o menu "Mais".

## Elevation & Depth

Quase plano. A profundidade vem de cartão branco sobre fundo cinza, de borda discreta e do material translúcido das barras. A sombra é exceção e sempre tingida de beringela, nunca preta.

### Shadow Vocabulary
- **Sombra rasa** (`box-shadow: 0 1px 2px rgb(75 18 72 / 0.08)`): cards públicos de anúncio.
- **Sombra de base** (`box-shadow: 0 -2px 12px rgb(75 18 72 / 0.12)`): folhas, menus e o "+ Anunciar" da barra de baixo.
- **Fio de luz** (`box-shadow: 0 0 0 0.5px rgb(75 18 72 / 0.12)`): contorno do material translúcido (`.olaki-material`), no lugar da linha divisória dura.

### Named Rules
**The Borda Antes Rule.** Primeiro separe com `borda` ou com o contraste fundo/cartão. Sombra só nos casos acima.

**The Material Honesto Rule.** O desfoque (`blur(20px) saturate(180%)` sobre 74% de cartão) só vale para o que flutua sobre o conteúdo: cabeçalho, barra de baixo e barra de contato. Com `prefers-reduced-transparency` ou `prefers-contrast` ele vira sólido.

## Shapes

Cantos suaves e consistentes. Campos, botões e chips em 8 px; cartões em 10 px; folhas que sobem de baixo em 20 px no topo; selos, avatar e o seletor de cidade do cabeçalho redondos por inteiro. Fotos de anúncio em 4:3, cortadas no centro. Ícones de categoria num círculo `selecao` com o desenho em beringela. As pernas do M do logo têm pontas redondas; os botões não imitam isso.

## Components

### Buttons
Diretos e firmes, com o texto dizendo o que acontece ("Publicar anúncio", nunca "OK").
- **Shape:** cantos suaves (8 px). Normal: 40 px no toque e 36 px com mouse, texto de 12 px em 600. Pequeno (ações dentro de cards, listas e tabelas): 32 px no toque e 28 px com mouse, texto de 11 px.
- **Principal:** fundo laranja, texto beringela. Um por tela.
- **WhatsApp:** fundo verde-escuro, texto branco, ícone de conversa. Só para chamar vendedor ou comprador.
- **Secundário:** borda beringela, fundo branco; hover em `fundo`. No painel admin, a ação padrão é a variante `discreto` (fundo `selecao`, texto beringela).
- **Perigo:** borda e texto `perigo` sobre branco; hover em `perigo-fundo`; sempre com confirmação (`useConfirmar`, nunca `window.confirm`).
- **Texto:** laranja-escuro, sublinha no hover. Só para "Pular", "Ver todos".
- **Hover / Focus / Pressão:** hover clareia 5%; foco por teclado com contorno de 3 px laranja-escuro afastado 2 px; ao encostar o dedo o botão encolhe para 97% em 100 ms (`olaki-acao`), sem movimento com `prefers-reduced-motion`.
- **Carregando:** bolinha girando, texto troca ("Publicando...") e o botão trava para não duplicar anúncio.

### Chips
- **Style:** borda `borda-campo`, fundo branco, texto beringela de 12 px em 600, 40 px de altura.
- **State:** selecionado com fundo `selecao`, borda beringela e um ✓; o estado nunca depende só da cor.

### Cards / Containers
- **Corner Style:** 10 px.
- **Background:** `cartao` sobre `fundo`.
- **Shadow Strategy:** sombra rasa nos cards públicos.
- **Card de anúncio:** foto 4:3, coração de favorito no canto da foto, preço em 700, título em até 2 linhas, metadados em legenda, preenchimento de 10 px. Encolhe para 98% ao toque (`olaki-toque`). No máximo um selo por card; "Patrocinado" escrito.

### Inputs / Fields
- **Style:** uma caixa só (`classesCampo`): borda `borda-campo`, fundo branco, cantos de 8 px, 40 px de altura, texto de 13 px (16 px no iPhone).
- **Focus:** borda laranja-escuro com anel de 2 px laranja-escuro a 30%.
- **Error / Disabled:** borda `perigo` por `aria-invalid` e a mensagem escrita embaixo, nunca só a borda vermelha. Desativado em `fundo` com 70% de opacidade.
- **Lista de escolha:** `select` nativo, para abrir a lista do próprio celular.

### Navigation
- **Barra de baixo (celular):** Início · Buscar · [+ Anunciar] · Radar · Conta, sobre o material translúcido. Ícone de 20 px com o nome embaixo em legenda e 600. Item inativo em `texto-suave`, ativo em beringela com traço mais grosso e nome sublinhado. O "+ Anunciar" é um quadrado laranja de 40 px que sobe 16 px acima da barra.
- **Cabeçalho:** material translúcido, logo "Mercado da Região" (28 a 32 px de altura) à esquerda, seletor de cidade redondo e Entrar/Conta.
- **Painel admin:** barra lateral que recolhe para só ícones (Ctrl+B).

### Logo
O "M" de Mercado segurando o pin laranja, com "Mercado" em beringela e "da Região" em laranja, em Poppins Bold. Versões para fundo claro e escuro, marca sem frase para o cabeçalho, símbolo sozinho e ícone do app (M branco com pin laranja no quadrado beringela). Tamanho mínimo da marca: 24 px de altura; abaixo disso, só o símbolo. Arquivos em `public/logo/`, regras em `docs/MARCA.md`. Franquia: nome da cidade embaixo, em maiúsculas espaçadas, separado por um fio.

### Merc
O ajudante é um balão de conversa laranja com dois olhinhos, flutuando no canto acima da barra de baixo (botão de 40 px). É o mascote, não o logo.

## Do's and Don'ts

### Do:
- **Do** usar um único botão laranja com texto beringela por tela.
- **Do** escrever o nome ao lado de todo ícone importante; ícone sozinho só para lupa, coração, X e voltar.
- **Do** usar os nomes da régua (`text-base`, `min-h-10`, `rounded-campo`) e as peças do shadcn ligadas aos tokens.
- **Do** mostrar o preço sempre, com "a combinar" claro quando não houver valor.
- **Do** escrever "Patrocinado" em anúncio pago e "Exemplo" em quadro ilustrativo.
- **Do** usar fotos reais do produto anunciado.
- **Do** dar uma saída em toda tela vazia ("Pedir no Radar", "Perguntar ao Merc").

### Don't:
- **Don't** colocar texto branco sobre o laranja `#ff6a13`.
- **Don't** usar roxo violeta vivo; o roxo da marca é só o beringela.
- **Don't** esticar, inclinar, recolorir, sombrear ou tirar o pin do logo.
- **Don't** voltar com bege ou `laranja-claro` como superfície.
- **Don't** usar negrito fora de título, valor-chave, preço e botão.
- **Don't** mostrar mais de duas ações à vista num card.
- **Don't** usar imagem de banco de imagens na home.
- **Don't** criar animação de entrada, movimento contínuo ou vídeo tocando sozinho.
