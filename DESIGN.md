---
name: Mercado da Região
description: Shopping digital e classificados regionais, com o Radar de Negócios. "aqui a sua cidade aparece."
colors:
  beringela: "#4b1248"
  laranja: "#ff6a13"
  laranja-escuro: "#b84010"
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
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 1.6vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  preco-anuncio:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  titulo:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  secao:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  preco-card:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
  titulo-card:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.35
  corpo:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  botao:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.45
  rotulo:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
  legenda:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
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
  toque: "44px"
  acao-principal: "48px"
  controle-mouse: "36px"
components:
  button-primary:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.beringela}"
    typography: "{typography.botao}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.botao}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "44px"
  button-whatsapp:
    backgroundColor: "{colors.verde-escuro}"
    textColor: "{colors.cartao}"
    typography: "{typography.botao}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.perigo}"
    typography: "{typography.botao}"
    rounded: "{rounded.campo}"
    padding: "0 16px"
    height: "44px"
  button-text:
    textColor: "{colors.laranja-escuro}"
    typography: "{typography.botao}"
    height: "44px"
  input:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.texto}"
    typography: "{typography.corpo}"
    rounded: "{rounded.campo}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.cartao}"
    textColor: "{colors.beringela}"
    typography: "{typography.botao}"
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

> **Este é o único documento que manda no visual.** Versão de 14/11/2026.
> Marca e tom de voz: [docs/MARCA.md](docs/MARCA.md). Regras de uso para gente leiga: [docs/USABILIDADE.md](docs/USABILIDADE.md). Produto e público: [PRODUCT.md](PRODUCT.md).
> Se outro documento disser um número diferente (tamanho, cor, altura), **vale o que está aqui**.
> As pesquisas que sustentam cada decisão estão em [docs/design-system/pesquisa/](docs/design-system/pesquisa/). As versões antigas estão em [docs/design-system/historico/](docs/design-system/historico/).

## 0. Estado: decidido, ainda não aplicado

As decisões abaixo foram tomadas pelo Raniel em 14/11/2026. **O código ainda está na versão anterior.** Enquanto a migração não termina:

| Assunto | Regra (este documento) | No código hoje |
|---|---|---|
| Fonte | Figtree 400/600/700 | Poppins 400/600/700 (`src/app/layout.tsx`) |
| Texto normal | 14 px | 13 px (`--text-base`) |
| Menor letra permitida | 12 px | 11 px (legenda, preço e meta do card) |
| Preço no card | 16 px, peso 700 | 11 px (`card-anuncio.tsx`) |
| Área de toque | 44 px; ação principal 48 px | 40 px (`--spacing-controle`) |
| Laranja-escuro | `#b84010` | `#c2410c` |
| Nome do logo | Uma linha, tudo beringela, Figtree Bold | Duas linhas, "da Região" em laranja, Poppins Bold |

**Tela nova ou tela mexida segue este documento.** Tela antiga muda nas ondas da seção 11. Não misture: ao mexer numa tela, leve a tela inteira para a regra nova.

## 1. Para quem e com que cara

**Público que decide o visual:** o comprador da região no celular. Android de entrada, tela de 360 a 412 px, internet fraca, muitas vezes no sol, de 16 a 70 anos, vive no WhatsApp. Teste de referência: a dona Maria, 62 anos, com o celular do neto. Lojista e painel admin seguem as mesmas regras, com densidade maior só onde este documento permite.

**Tom: vizinho de confiança.** Caloroso, simples e sério, como o comércio conhecido da cidade. Sem cara de startup, sem cara de encarte de promoção.

**Norte criativo: "A feira da cidade".** Cada anúncio é uma barraca organizada: foto de verdade, preço à vista e o vendedor a um toque, no WhatsApp.

**Só modo claro.** Não criar valores de modo escuro.

Características:
- Beringela para marca, títulos e texto de ação; laranja para o único botão principal e para o pin do logo.
- Fundo frio `fundo` com cartões brancos.
- Uma família de letra (Figtree), três pesos.
- Hierarquia por tamanho, peso e espaço, nunca por enfeite.
- Peças do shadcn/ui (sobre Base UI) ligadas aos tokens da marca.

## 2. Cores

Os tokens ficam em `src/app/globals.css` (`@theme`). Nunca escreva cor em hexadecimal num componente.

| Token | Valor | Uso |
|---|---|---|
| `beringela` | `#4b1248` | Marca, nome do logo, títulos, texto sobre laranja, ícones, navegação ativa |
| `laranja` | `#ff6a13` | Fundo do botão principal, pin do logo, "+ Anunciar". **Nunca como cor de texto** |
| `laranja-escuro` | `#b84010` | Links, botão de texto, anel de foco, cursor dos campos |
| `verde-escuro` | `#0e7a3d` | Só o botão "Chamar no WhatsApp" e mensagens de sucesso, com texto branco |
| `verde` | `#12a150` | Só ícones e selos; nunca fundo de texto |
| `fundo` | `#f7f8fa` | Fundo das telas |
| `cartao` | `#ffffff` | Cartões, folhas, formulários |
| `texto` | `#342b3b` | Corpo de texto |
| `texto-suave` | `#5e5266` | Cidade, data, legendas, item inativo |
| `borda` | `#e6e0e9` | Bordas de cartão e divisórias |
| `borda-campo` | `#968b9e` | Contorno de campos, chips e controles |
| `selecao` | `#f0eaf5` | Chip selecionado, navegação ativa, círculo de ícone de categoria |
| `perigo` / `perigo-fundo` | `#b91c1c` / `#fef2f2` | Erros, apagar, denunciar |
| `aviso` / `aviso-fundo` | `#b45309` / `#fffbeb` | "Em análise", plano vencendo |
| `sucesso-fundo` | `#ecf8f1` | Caixa de sucesso, com texto `verde-escuro` |
| `patrocinado-fundo` | `#ffe4d1` | Etiqueta "Patrocinado", com texto beringela |
| `coracao` | `#e11d48` | Coração de favorito salvo |

### Contraste conferido (mínimo 4,5:1 para texto)

| Par | Contraste | Pode? |
|---|---|---|
| Beringela sobre laranja | 4,95 | Sim |
| Branco sobre laranja | 2,87 | **Não** |
| Laranja como texto sobre branco | 2,87 | **Não** |
| Laranja-escuro sobre branco | 5,56 | Sim |
| Laranja-escuro sobre `fundo` | 5,23 | Sim |
| Laranja-escuro sobre `selecao` | 4,71 | Sim |
| Branco sobre verde-escuro | 5,43 | Sim |
| Branco sobre verde | 3,37 | Só ícone |
| Texto-suave sobre branco | 7,31 | Sim |

### Regras com nome
- **Laranja Calado.** Sobre laranja, o texto é beringela. Branco sobre laranja é proibido.
- **Laranja não escreve.** O laranja `#ff6a13` nunca é cor de letra. Texto laranja é sempre `laranja-escuro`.
- **Um Laranja.** Um botão laranja por tela. A caixa de busca não é laranja.
- **Verde é do WhatsApp.** Verde não vira cor de destaque, de preço nem de promoção.
- Proibido: roxo violeta vivo, bege, `laranja-claro` como superfície.

## 3. Letras

**Família única: Figtree** (Google Fonts, gratuita), carregada por `next/font/google` com os pesos 400, 600 e 700 e `display: "swap"`. Motivos (pesquisa 04): é mais estreita que a Poppins, tem números alinhados para preço, o arquivo é pequeno e o desenho é caloroso.

```ts
import { Figtree } from "next/font/google";
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-figtree", display: "swap" });
```

### Régua de tamanhos (celular e computador)

| Papel | Tamanho | Peso | Classe |
|---|---|---|---|
| Vitrine (só o h1 do Início) | 22 a 32 px | 700 | `text-vitrine` |
| Preço na página do anúncio | 24 px | 700 | `text-3xl` |
| Título da tela | 18 px (20 px a partir de 768 px) | 600 | `text-titulo` |
| Título de seção | 16 px | 600 | `text-lg font-semibold` |
| Preço no card | 16 px | 700 | `text-lg font-bold` |
| Título no card (até 2 linhas) | 14 px | 400 | `text-base` |
| Texto normal | 14 px | 400 | `text-base` |
| Botão | 14 px | 600 | `text-base font-semibold` |
| Rótulo e texto de apoio | 13 px | 600 / 400 | `text-sm`, `text-rotulo` |
| Legenda (cidade, data, barra de baixo) | 12 px | 400 | `text-legenda` |
| Letra dentro de campo | 16 px no toque, 14 px com mouse | 400 | automático no `globals.css` |

### Regras com nome
- **Piso 12.** Nenhuma letra abaixo de 12 px, em lugar nenhum.
- **Preço manda.** O preço é sempre o texto mais forte do card: peso 700, beringela, nunca menor que o título. Use `tabular-nums` em todo preço e número em coluna.
- **Três Pesos.** Só 400, 600 e 700. O 700 é do preço, da vitrine e do logo.
- **Régua.** Nada de tamanho escrito à mão (`text-[13px]`, `h-12`). Use os nomes da régua.
- **Zoom Livre.** Tamanhos em rem e zoom nunca travado.
- **Modo fácil do Radar** continua com corpo de 18 px e título de 24 px.

## 4. Toque e alturas

| Peça | Altura | Observação |
|---|---|---|
| Qualquer coisa tocável | mínimo 44 × 44 px | Vale para ícone, chip, link de lista, coração, fechar |
| Ação principal da tela e WhatsApp | 48 px | Uma por tela |
| Botão, campo, chip, seletor | 44 px | 36 px só com mouse, a partir de 768 px |
| Ação pequena em card, lista ou tabela | 36 px de altura visível | A área tocável continua com 44 px |
| Barra de busca | 44 px | |
| Cabeçalho | 52 px (56 px a partir de 768 px) | |
| Barra de baixo | 56 px + área segura | |
| Espaço entre dois alvos de toque | mínimo 8 px | |

Rótulo longo quebra linha e o botão cresce; nunca cortar o texto para caber.

## 5. Espaço, cantos e sombra

- Espaçamento em múltiplos de 4: 4, 8, 12, 16, 20, 24, 32. Margem lateral da tela: 16. Entre blocos da página: 20 (`gap-5`). Dentro de card: 10 a 12 no celular, 16 no computador.
- Larguras de página: `max-w-md` (entrar, uma ação), `max-w-xl` (formulário e leitura), `max-w-6xl` (vitrines e listas).
- Botão de largura total só no celular; do tablet para cima para em 320 px.
- Cantos: 8 px (campos, botões, chips), 10 px (cards), 20 px (topo das folhas), cheio (selos, avatar, seletor de cidade).
- **Borda Antes.** Separe com `borda` ou com fundo/cartão. Sombra só em: card público (`shadow-1`), folhas, menus e o "+ Anunciar" (`shadow-2`). Sombra sempre tingida de beringela.
- Cabeçalho, barra de baixo e barra de contato usam `.olaki-material` (translúcido). Viram sólidos com `prefers-reduced-transparency` ou `prefers-contrast`.

## 6. Logo

- **Símbolo:** o M beringela segurando o pin laranja. Não muda.
- **Nome escrito:** "Mercado da Região" em **uma linha, tudo beringela**, Figtree Bold. Em fundo escuro, tudo branco. O laranja fica só no pin.
- No cabeçalho do celular: símbolo com 30 px de altura e nome com 17 px.
- Abaixo de 24 px de altura, só o símbolo.
- Não esticar, inclinar, recolorir, sombrear nem tirar o pin.
- Demais regras (área livre, franquia por cidade, grafia): [docs/MARCA.md](docs/MARCA.md).

## 7. Ícones e imagens

- **Lucide** (`lucide-react`), traço 2. Único pacote de ícones.
- Ícone sempre com palavra. Sozinho só: lupa, coração, X e voltar.
- Categorias: círculo `selecao` com ícone beringela. Faltando ícone no Lucide (animais), desenhar no mesmo traço; não trazer outro pacote.
- Foto de anúncio: 4:3, cortada no centro, sempre real. Nada de banco de imagens na home.
- Quadro ilustrativo leva a etiqueta "Exemplo".

## 8. Bibliotecas

| Camada | Escolha | Regra |
|---|---|---|
| Estilo | Tailwind CSS 4 (`@theme` no `globals.css`) | Sem `tailwind.config` |
| Peças base | shadcn/ui, estilo `base-nova`, sobre Base UI | Peça nova: `npx shadcn@latest add <nome>`, depois ajustar altura, letra e cor à régua |
| Ícones | Lucide | Um pacote só |
| Carrossel e galeria | CSS `scroll-snap` | Sem Embla |
| Aviso rápido (toast) | Toast do Base UI | Sem pacote novo |
| Folha que sobe | `Drawer` (Base UI), pela casca `Folha` | Sem Vaul |
| Animação | CSS e `tw-animate-css` | Sem biblioteca de movimento |
| Formulário | Peças `Field`/`Input` e validação no servidor | React Hook Form + Zod só se um formulário ficar complexo |

**Não entram:** Radix, DaisyUI, Flowbite, MUI, Ant Design, Chakra, Headless UI, React Aria, Embla, Sonner, framer-motion, bibliotecas de aplicativo nativo. Qualquer dependência nova de interface precisa do "sim" do Raniel.

## 9. Peças oficiais

**Regra: a peça do shadcn é a oficial.** A peça com nome em português continua existindo como **casca fina** em volta dela (mesma API, zero estilo próprio), para não reescrever centenas de arquivos de uma vez. Estilo novo entra na peça do shadcn, nunca na casca.

### Peças base (`src/components/ui/`)

| Função | Oficial (shadcn) | Casca em português | Não fazer |
|---|---|---|---|
| Botão | `button.tsx` | `botao.tsx` (`Botao`) | `<button className="...">` com estilo à mão |
| Campo de texto | `field.tsx` + `input.tsx` + `textarea.tsx` | `campo.tsx` (`Campo`) | Borda e foco próprios num `<input>` |
| Lista de escolha | `native-select.tsx` | `Seletor` (`src/components/conta/seletor.tsx`) | `select.tsx` em tela pública (o nativo abre a lista do celular) |
| Selo e etiqueta | `badge.tsx` | `vitrine/selos.tsx` (`SeloLoja`) | `<span className="rounded-full bg-...">` |
| Chip de filtro | `toggle.tsx` / `toggle-group.tsx` | `chip.tsx` (`Chip`) | Estado só por cor: selecionado leva ✓ |
| Cartão | `card.tsx` | `Cartao` do admin | `<div>` com borda e sombra à mão |
| Carregando | `skeleton.tsx` | `carregando.tsx` (`CarregandoGrade`, `CarregandoLista`) | Texto "Carregando…" |
| Tela vazia | `empty.tsx` | `vazio.tsx` (`Vazio`) | Tela vazia sem saída |
| Aviso | `alert.tsx` | `Aviso` do admin | Caixa colorida à mão |
| Janela | `dialog.tsx` | — | Janela sem `DialogTitle` |
| Confirmação | `alert-dialog.tsx` | `confirmar.tsx` (`useConfirmar`) | `window.confirm` |
| Folha que sobe | `drawer.tsx` | `folha.tsx` (`Folha`) | `sheet.tsx` em tela nova |
| Menu "Mais" | `dropdown-menu.tsx` | — | Mais de duas ações à vista num card |
| Abas, tabela, divisória, dica | `tabs`, `table`, `separator`, `tooltip` | — | `<table>` ou `<hr>` à mão |

### Peças do negócio (uma por função, sempre reutilizar)

| Função | Peça | Arquivo |
|---|---|---|
| Card de anúncio | `CardAnuncio` | `src/components/anuncio/card-anuncio.tsx` |
| Grade de anúncios | `GradeAnuncios` | `src/components/anuncio/grade-anuncios.tsx` |
| Busca | `CampoBusca` | `src/components/busca/campo-busca.tsx` |
| Faixa de categorias | `FaixaCategorias` | `src/components/categorias/faixa-categorias.tsx` |
| Lojas em destaque | `LojasDaRegiao` | `src/components/vitrine/lojas-da-regiao.tsx` |
| Cartão do vendedor | `CartaoVendedor` | `src/components/vitrine/cartao-vendedor.tsx` |
| Galeria de fotos | `Galeria` | `src/app/(anuncio-publico)/anuncio/[idslug]/galeria.tsx` |
| Barra de contato (WhatsApp) | `BarraContato` | `src/app/(anuncio-publico)/anuncio/[idslug]/barra-contato.tsx` |
| Cabeçalho | `CabecalhoPublico` | `src/components/ui/cabecalho-publico.tsx` |
| Barra de baixo | `BarraInferior` | `src/components/ui/barra-inferior.tsx` |
| Rodapé | `RodapeInicio` | `src/components/paginas/rodape-inicio.tsx` |

Página para ver as peças: `/admin/pecas`.

### Como cada peça do negócio deve ser

- **`CardAnuncio`:** foto 4:3; coração no canto da foto (alvo de 44 px); **preço 16 px em 700**; título 14 px em até 2 linhas; cidade e data em 12 px `texto-suave`; no máximo um selo; "Patrocinado" escrito; card inteiro tocável. Duas colunas no celular, 4 a 5 no computador.
- **`CampoBusca`:** uma só por tela, 44 px, texto "O que você procura?". Fundo branco com `borda-campo`; não é laranja.
- **`FaixaCategorias`:** uma só lista de categorias por tela, rolável na horizontal com `scroll-snap`, ícone com nome, estado ativo em `selecao` com texto beringela.
- **Filtros rápidos:** uma linha rolável de `Chip` logo abaixo da busca.
- **`LojasDaRegiao`:** um só bloco de lojas por tela, com logo redondo, nome, selo "Loja verificada" **com a palavra escrita**, quantidade de anúncios e acesso à vitrine.
- **`BarraContato`:** fixa no rodapé da página do anúncio, **um** botão "Chamar no WhatsApp" de 48 px. Uma chamada de WhatsApp por tela.
- **`BarraInferior`:** Início · Buscar · [+ Anunciar] · Radar · Conta. Ícone com nome em 12 px. Some a partir de 768 px.
- **Tela vazia:** `Vazio` com uma frase e uma saída ("Pedir no Radar", "Anunciar").
- **Carregando:** esqueleto no formato final da tela.

## 10. Movimento

Só resposta ao toque: o botão encolhe para 97% em 100 ms (`olaki-acao`), o card para 98% (`olaki-toque`). Cores transitam em 150 ms. Sem animação de entrada, sem movimento contínuo, sem vídeo tocando sozinho. Tudo desligado com `prefers-reduced-motion`.

## 11. Ordem da migração

Cada onda é uma tarefa própria, pequena e testável. Nunca "refazer o site inteiro".

0. **Base:** trocar a fonte para Figtree, atualizar os tokens do `globals.css` (régua nova, `laranja-escuro`, toque 44/48), transformar `Botao`, `Campo`, `Vazio`, `Folha` e `confirmar` em cascas das peças do shadcn, gerar os arquivos do logo novo (`docs/marca/gerar-logos.mjs`, `public/logo/`, ícones e imagem de compartilhar) e construir o conferidor ([docs/design-system/CONFERIDOR.md](docs/design-system/CONFERIDOR.md)).
1. **Casca do site:** cabeçalho, busca única, barra de baixo, rodapé.
2. **Início e listagens:** uma faixa de categorias, chips de filtro, `GradeAnuncios` com o card novo, um bloco de lojas.
3. **Anúncio e conversão:** página do anúncio, galeria, barra de contato fixa.
4. **Área logada:** anunciar, meus anúncios, minha loja, conta.
5. **Painel admin.**

## 12. Faça e não faça

**Faça**
- Um botão laranja com texto beringela por tela.
- Nome ao lado de todo ícone importante.
- Preço sempre visível; sem valor, escrever "a combinar".
- "Patrocinado" escrito em anúncio pago; "Exemplo" em quadro ilustrativo.
- "Loja verificada" escrito, não só o ícone.
- Uma saída em toda tela vazia.
- Reutilizar as peças da seção 9 e citar o nome delas ao pedir uma tela.

**Não faça**
- Cor em hexadecimal ou tamanho à mão num componente.
- Letra abaixo de 12 px ou alvo de toque abaixo de 44 px.
- Texto branco sobre laranja; laranja como cor de letra.
- Duas buscas, duas listas de categorias ou dois blocos de lojas na mesma tela.
- Card de anúncio fora de `CardAnuncio`.
- Mais de uma chamada de WhatsApp por tela; mais de duas ações à vista num card.
- Negrito fora de título, preço, valor-chave e botão.
- Biblioteca nova de interface sem o "sim" do Raniel.
- Modo escuro, animação de entrada, imagem de banco de imagens.

## 13. Limites conhecidos

- Não há pesquisa com usuários reais nem números de uso. As decisões vêm de fontes públicas e da comparação com OLX e Mercado Livre (o Facebook Marketplace exige login e não foi medido).
- O tamanho de 14 px foi escolha do Raniel entre três opções; a pesquisa de público recomendava 16 px. **Validar com as cinco pessoas do teste de corredor** (docs/USABILIDADE.md), em especial as de mais de 50 anos. Se travarem na leitura, subir a régua um degrau.
- Custo medido da letra maior num celular de 360 px: 3,6 anúncios visíveis sem rolar (eram 3,9 no compacto; seriam 3,3 com 16 px).
- `.impeccable/design.json` e `.tastemaker/style-lock.md` ainda refletem a versão anterior e precisam ser regenerados na onda 0.
