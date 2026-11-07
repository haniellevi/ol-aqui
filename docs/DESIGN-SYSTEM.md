# OLAKI · Sistema visual (design system) · 07/11/2026

Tudo aqui sai do logo escolhido (opção 1, pin no "i", e opção 2, balão "ol"): **azul-marinho "ol" + laranja forte "aki"**, letra redonda e geométrica.
Objetivo: o app parecer **simples, confiável e da região**, legível no sol, num celular barato, por quem lê pouco.

> Regra que vale para o visual também: textos de botões e avisos que mudam com o negócio (preços, nomes de planos, chamadas da home) vêm do painel (tela 12 "Página inicial e textos"). Cores e componentes ficam no código, porque não mudam com o negócio.

---

## 1. Cores

### Cores da marca

| Nome | Cor | Onde usa |
|---|---|---|
| `marinho` | `#1B2A4A` | Texto principal, cabeçalho, ícones, fundo escuro |
| `laranja` | `#FF6A13` | Botão principal, preço em destaque sobre fundo escuro, pin, etiquetas |
| `laranja-escuro` | `#C2410C` | Links e textos laranja sobre fundo branco |
| `laranja-claro` | `#FFF4EC` | Fundo de faixas (Radar, dicas do Aki), chip selecionado |
| `verde` | `#12A150` | Só ícones e selos (cor do logo opção 3) |
| `verde-escuro` | `#0E7A3D` | Botão "Chamar no WhatsApp", mensagens de sucesso |

### Cores de apoio

| Nome | Cor | Uso |
|---|---|---|
| `fundo` | `#F5F6F8` | Fundo das telas (cinza bem claro, cansa menos que branco puro no sol) |
| `cartao` | `#FFFFFF` | Cards, folhas, formulários |
| `texto` | `#1B2A4A` | Texto (o próprio marinho) |
| `texto-suave` | `#475569` | Cidade, "há 2 dias", legendas |
| `borda` | `#E2E8F0` | Bordas e divisórias |
| `perigo` | `#B91C1C` | Erros, denunciar, apagar |
| `aviso` | `#B45309` sobre `#FFFBEB` | "Em análise", plano vencendo |
| `patrocinado` | `#1B2A4A` sobre `#FFE4D1` | Etiqueta "Patrocinado" |

### Contraste (conferido, regra WCAG AA = mínimo 4,5:1 para texto)

| Combinação | Contraste | Pode? |
|---|---|---|
| Marinho sobre branco | 14,2 : 1 | Sim |
| **Branco sobre laranja #FF6A13** | **2,9 : 1** | **Não** (reprova até para texto grande) |
| Marinho sobre laranja | 5,0 : 1 | Sim |
| Branco sobre laranja-escuro #C2410C | 5,2 : 1 | Sim |
| Branco sobre verde #12A150 | 3,4 : 1 | Só ícone, nunca texto |
| Branco sobre verde-escuro #0E7A3D | 5,4 : 1 | Sim |
| Texto-suave #475569 sobre branco | 7,6 : 1 | Sim |

**Decisão de design:** o botão principal é **laranja com texto marinho em negrito**. Fica com a cara do logo, passa no contraste e destaca no sol. Onde precisar de texto branco (ex.: botão em fundo escuro), usa o `laranja-escuro`.

### Modo escuro
Fase 2. Os tokens já nascem com nome de função (`fundo`, `cartao`, `texto`) para que o modo escuro seja só trocar valores. Base: fundo `#0F172A`, cartão `#1B2A4A`, laranja como está (6,2 : 1 sobre o fundo escuro).

---

## 2. Letras (tipografia)

- **Fonte:** **Poppins** (gratuita, Google Fonts, carregada pelo `next/font`, sem custo e sem depender de servidor externo). É a mesma família do logo.
- Pesos usados: 400 (texto), 600 (títulos e botões), 700 (preço). Só três, para baixar menos dados.
- Se a internet estiver ruim, o texto aparece na fonte do celular e troca depois (`display: swap`); nunca fica tela em branco esperando a fonte.

| Nome | Tamanho / altura da linha | Peso | Uso |
|---|---|---|---|
| `preco` | 24 / 30 | 700 | Preço na página do anúncio |
| `titulo-1` | 22 / 28 | 600 | Título da tela |
| `titulo-2` | 18 / 24 | 600 | Seções ("Perto de você") |
| `corpo` | **16 / 24** | 400 | Texto normal. **Nunca menor que 16** em campo de formulário (evita o zoom automático do iPhone) |
| `card-preco` | 18 / 24 | 700 | Preço no card |
| `card-titulo` | 15 / 20 | 400 | Título no card (até 2 linhas) |
| `legenda` | 13 / 18 | 400 | Cidade, data. Mínimo absoluto do app |
| `botao` | 16 / 20 | 600 | Todos os botões |

Respeitar o tamanho de letra que a pessoa escolheu no celular (usar `rem`, nunca travar zoom). Muita gente da região usa letra grande.

---

## 3. Espaços, cantos e sombras

- **Espaçamento em múltiplos de 4:** 4, 8, 12, 16, 24, 32, 48. Margem lateral das telas: **16**.
- **Cantos arredondados:** 8 (campos, chips), 12 (cards, botões), 20 (folhas que sobem de baixo), cheio (selos e avatar). Combina com o ícone do app.
- **Sombras:** só duas. `sombra-1` em cards (bem leve) e `sombra-2` em barra de baixo e folhas. Sombra pesada pesa no celular fraco.
- **Área de toque:** **mínimo 48 × 48 px** em tudo que se toca (o padrão é 44; usamos 48 porque o público tem mais dedo grosso, celular com tela trincada e uso em pé, na rua).

---

## 4. Ícones e imagens

- Ícones: **lucide-react** (já está no projeto), traço 2px, sempre **com texto embaixo ou ao lado** nos menus. Ícone sozinho só em coisas universais (fechar, voltar, coração de favorito, lupa).
- Ícones das categorias: desenho simples em círculo laranja-claro com ícone marinho (trator, moto, casa, boi...). Arte própria, nunca copiada de outro app.
- Fotos dos anúncios: proporção 4:3 no card, cortadas no centro; carregadas em WebP pequeno primeiro (ver ARQUITETURA.md, "Imagens").
- Mascote/Aki: um balão de conversa laranja com dois olhinhos, derivado do logo opção 2. Simples o bastante para ficar bom em 24px.

---

## 5. Componentes

Base técnica: Tailwind + lucide-react com os tokens abaixo (é o que o app já usa). O shadcn/ui pode entrar depois para folhas, diálogos e menus, sem pagar licença. Cada componente tem estado normal, apertado, desativado, carregando e erro.

### Botões
| Tipo | Visual | Quando |
|---|---|---|
| **Principal** | Laranja, texto marinho negrito, altura 52, largura cheia no celular | Uma vez por tela: "Publicar", "Continuar", "Entrar" |
| **WhatsApp** | Verde-escuro, texto branco, ícone de conversa, altura 52 | Só para chamar o vendedor ou o comprador |
| **Secundário** | Borda marinho, fundo branco | "Salvar rascunho", "Compartilhar" |
| **Texto** | Só o texto em laranja-escuro | "Pular", "Ver todos" |
| **Perigo** | Texto vermelho, confirmação antes | "Excluir anúncio", "Denunciar" |

Carregando: o botão mostra uma bolinha girando **e** o texto muda ("Publicando..."), e não deixa tocar duas vezes (evita anúncio duplicado com internet lenta).

### Card de anúncio
Foto 4:3 · preço grande · título em até 2 linhas · cidade e "há 2 dias" · coração de favorito no canto da foto · selo da loja se tiver · etiqueta **"Patrocinado"** quando for destaque pago.
Duas colunas no celular, 4 a 5 no computador. Card inteiro é tocável.

### Barra de baixo (navegação principal, sempre visível no celular)
**Início · Buscar · [+ Anunciar] · Radar · Conta.** O "+ Anunciar" é um botão laranja maior no meio. Cinco itens com ícone **e** nome.

### Outros componentes
- **Campo de busca** grande no topo ("O que você procura?"), com microfone (busca por voz do próprio celular) e botão do Aki.
- **Chips de filtro** roláveis (cidade, preço, categoria), com contador "Filtros (3)".
- **Folha que sobe de baixo** (bottom sheet) para filtros, escolher cidade e confirmar ações. Mais fácil com uma mão que janela no meio da tela.
- **Seletor de cidade** com as cidades da região e "Perto de mim".
- **Campo de código** (6 caixinhas, preenche sozinho com o código que chega no celular).
- **Campo de preço** com teclado numérico, já formatado "R$ 8.500".
- **Escolha por botões grandes** (segmentado) no lugar de lista suspensa: estado do produto, câmbio, ano.
- **Barra de passos** do cadastro de anúncio: "Passo 2 de 6" com barrinha.
- **Selos:** Loja Verificada (verde, ícone de escudo), Destaque, Novo. Selo sempre com texto, nunca só cor.
- **Aviso na tela** (toast) embaixo, some em 4s, com "Desfazer" quando der.
- **Tela vazia** sempre com uma saída: "Nenhuma moto até R$ 5 mil aqui. **Pedir no Radar** · **Perguntar ao Aki**".
- **Esqueleto de carregamento** (caixas cinzas piscando) em vez de tela em branco.
- **Balão do Aki** flutuante no canto, acima da barra de baixo.
- **Cartão do vendedor:** foto, nome, selo, "no OLAKI desde 2026", cidade, tempo de resposta.

---

## 6. Tokens para o desenvolvedor (Tailwind v4)

Fica em `src/app/globals.css` (a base do app já tem marinho e laranja; o resto entra junto). Os nomes viram classes como `bg-laranja`, `text-marinho`, `rounded-card`.

```css
@import "tailwindcss";

@theme {
  --color-marinho: #1B2A4A;
  --color-laranja: #FF6A13;
  --color-laranja-escuro: #C2410C;
  --color-laranja-claro: #FFF4EC;
  --color-verde: #12A150;
  --color-verde-escuro: #0E7A3D;
  --color-fundo: #F5F6F8;
  --color-cartao: #FFFFFF;
  --color-texto: #1B2A4A;
  --color-texto-suave: #475569;
  --color-borda: #E2E8F0;
  --color-perigo: #B91C1C;
  --color-aviso: #B45309;
  --color-aviso-fundo: #FFFBEB;
  --color-patrocinado-fundo: #FFE4D1;

  --font-sans: var(--font-poppins), system-ui, sans-serif;

  --radius-campo: 0.5rem;
  --radius-card: 0.75rem;
  --radius-folha: 1.25rem;

  --shadow-1: 0 1px 2px rgb(27 42 74 / 0.08);
  --shadow-2: 0 -2px 12px rgb(27 42 74 / 0.12);

  --spacing-toque: 3rem; /* 48px, área mínima de toque */
}
```

Se o shadcn/ui entrar, apontar as variáveis dele para estes tokens: `--primary` = laranja, `--primary-foreground` = marinho, `--destructive` = perigo, `--ring` = laranja-escuro, `--radius` = 0.75rem.

---

## 7. Faça e não faça

| Faça | Não faça |
|---|---|
| Um botão principal por tela | Dois botões laranja brigando |
| Ícone + palavra | Ícone sozinho para coisa importante |
| Preço sempre visível e grande | Esconder preço atrás de "consulte" sem opção "a combinar" clara |
| "Patrocinado" sempre escrito | Destaque pago disfarçado de normal |
| Texto branco só em fundo escuro | Texto branco sobre o laranja do logo |
| Fotos reais do produto | Imagens de banco de imagens na home |
