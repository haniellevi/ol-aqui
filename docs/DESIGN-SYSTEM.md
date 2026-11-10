# OLAKI · Sistema visual (design system) · 10/11/2026

Tudo aqui sai do logo oficial, **OLAKI em caixa alta** (opção A, decidida pelo Raniel em 07/11/2026): Poppins Bold, **"OL" em roxo beringela + "AKI" em laranja forte**, com o pin laranja sobre o I. O logo anterior, em minúsculas ("ol" fino + "aki"), saiu porque "ol" se confundia com "oi". Arquivos: `public/logo/olaki-opcao1-pin.svg` (fundo claro, com a tagline "olha aqui o que você procura"), `public/logo/olaki-opcao1-pin-fundo-escuro.svg` (fundo escuro), `public/logo/olaki-icone-app.svg` (ícone: "AKI" branco com o pin beringela num quadrado laranja arredondado; nunca "O" + "I", que se lê "OI") e `src/app/icon.svg` (ícone do site, cópia idêntica). Em tamanho pequeno (cabeçalho do site e do painel, até uns 60 px de altura) usa `public/logo/olaki-marca.svg`, o mesmo logo sem a tagline, porque a tagline fica ilegível nesse tamanho. Alternativas e o gerador ficam em `docs/logo-opcoes/`.

> **Atualizado em 07/11/2026:** o Raniel trocou o azul-marinho pelo **roxo beringela `#4B1248`**, para provocar o OLX sem copiar o roxo violeta dele (`#6E0AD6`). O beringela puxa para o vinho, é outra família de cor. Não usar nenhum roxo violeta vivo no app.
Objetivo: o app parecer **simples, confiável e da região**, legível no sol, num celular barato, por quem lê pouco.

> Regra que vale para o visual também: textos de botões e avisos que mudam com o negócio (preços, nomes de planos, chamadas da home) vêm do painel (tela 12 "Página inicial e textos"). Cores e componentes ficam no código, porque não mudam com o negócio.

---

## 1. Cores

### Cores da marca

| Nome | Cor | Onde usa |
|---|---|---|
| `beringela` | `#4B1248` | Títulos, marca, ícones, fundo escuro |
| `laranja` | `#FF6A13` | Botão principal, preço em destaque sobre fundo escuro, pin, etiquetas |
| `laranja-escuro` | `#C2410C` | Links e textos laranja sobre fundo branco |
| `laranja-claro` | `#FFF4EC` | Apoio pontual em avisos e conteúdo promocional |
| `verde` | `#12A150` | Só ícones e selos |
| `verde-escuro` | `#0E7A3D` | Botão "Chamar no WhatsApp", mensagens de sucesso |

### Cores de apoio

| Nome | Cor | Uso |
|---|---|---|
| `fundo` | `#F7F8FA` | Fundo neutro e frio das telas |
| `cartao` | `#FFFFFF` | Cards, folhas, formulários |
| `texto` | `#342B3B` | Corpo de texto; títulos usam beringela |
| `texto-suave` | `#5E5266` | Cidade, "há 2 dias", legendas |
| `borda` | `#E6E0E9` | Bordas de cartões e divisórias |
| `borda-campo` | `#968B9E` | Campos e controles; contraste mínimo de 3:1 sobre branco |
| `selecao` | `#F0EAF5` | Navegação ativa, chips e ícones de apoio |
| `perigo` | `#B91C1C` | Erros, denunciar, apagar |
| `aviso` | `#B45309` sobre `#FFFBEB` | "Em análise", plano vencendo |
| `patrocinado` | `#4B1248` sobre `#FFE4D1` | Etiqueta "Patrocinado" |
| `perigo-fundo` | `#FEF2F2` (texto `perigo` por cima, 5,9 : 1) | Caixa de erro, confirmação de apagar |
| `sucesso-fundo` | `#ECF8F1` (texto `verde-escuro` por cima, 5,0 : 1) | Caixa de sucesso ("Salvo", "Publicado") |

### Contraste (conferido, regra WCAG AA = mínimo 4,5:1 para texto)

| Combinação | Contraste | Pode? |
|---|---|---|
| Beringela sobre branco | 14,2 : 1 | Sim |
| **Branco sobre laranja #FF6A13** | **2,9 : 1** | **Não** (reprova até para texto grande) |
| Beringela sobre laranja | 4,95 : 1 | Sim |
| Branco sobre laranja-escuro #C2410C | 5,2 : 1 | Sim |
| Branco sobre verde #12A150 | 3,4 : 1 | Só ícone, nunca texto |
| Branco sobre verde-escuro #0E7A3D | 5,4 : 1 | Sim |
| Texto-suave #5E5266 sobre branco | 7,3 : 1 | Sim |
| Laranja-escuro #C2410C sobre o fundo | 4,7 : 1 | Sim |

**Decisão de design:** o botão principal é **laranja com texto beringela em negrito**. Fica com a cara do logo, passa no contraste e destaca no sol. Onde precisar de texto branco (ex.: botão em fundo escuro), usa o `laranja-escuro`.

### Modo escuro
Fase 2. Os tokens já nascem com nome de função (`fundo`, `cartao`, `texto`) para que o modo escuro seja só trocar valores. Base: fundo `#1E1020`, cartão `#2E1530`, laranja como está (6,4 : 1 sobre o fundo escuro).

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
| `corpo` | **16 / 24** | 400 | Texto normal. Campos públicos e de toque com **16** (evita o zoom automático do iPhone) |
| `card-preco` | 18 / 24 | 700 | Preço no card |
| `card-titulo` | 15 / 20 | 400 | Título no card (até 2 linhas) |
| `legenda` | 13 / 18 | 400 | Cidade, data. Mínimo absoluto do app |
| `botao` | 15 / 20 | 600 | Botões públicos e de toque |
| `rotulo` | 14 / 20 | 600 | Rótulos de campos |
| `painel-corpo` | 14 / 21 | 400 | Corpo do painel administrativo |
| `painel-campo` | 14 / 20 | 400 | Valor do campo no painel, somente com mouse e largura mínima de 768 px |

Respeitar o tamanho de letra que a pessoa escolheu no celular (usar `rem`, nunca travar zoom). Muita gente da região usa letra grande.

---

## 3. Espaços, cantos e sombras

- **Espaçamento em múltiplos de 4:** 4, 8, 12, 16, 24, 32, 48. Margem lateral das telas: **16**.
- **Cantos arredondados:** 8 (campos, chips, botões), 12 (cards), 20 (folhas que sobem de baixo), cheio (selos e avatar). Combina com o ícone do app.
- **Sombras:** só duas. `sombra-1` em cards públicos (bem leve); painel usa borda sem sombra e `sombra-2` em barra de baixo e folhas. Sombra pesada pesa no celular fraco.
- **Área de toque:** **mínimo 48 × 48 px** em tudo que se toca (o padrão é 44; usamos 48 porque o público tem mais dedo grosso, celular com tela trincada e uso em pé, na rua). No painel com mouse e largura mínima de 768 px, controles e itens do menu podem usar 44 px; com toque, permanecem em 48 px.

---

## 4. Ícones e imagens

- Ícones: **lucide-react** (já está no projeto), traço 2px, sempre **com texto embaixo ou ao lado** nos menus. Ícone sozinho só em coisas universais (fechar, voltar, coração de favorito, lupa).
- Ícones das categorias: desenho simples em círculo `selecao` com ícone beringela (trator, moto, casa, boi...). Arte própria, nunca copiada de outro app.
- Fotos dos anúncios: proporção 4:3 no card, cortadas no centro; carregadas em WebP pequeno primeiro (ver ARQUITETURA.md, "Imagens").
- Mascote/Aki: um balão de conversa laranja com dois olhinhos (é só o robô, não substitui o logo). Simples o bastante para ficar bom em 24px.

---

## 5. Componentes

Base técnica: Tailwind + lucide-react com os tokens abaixo (é o que o app já usa). O shadcn/ui pode entrar depois para folhas, diálogos e menus, sem pagar licença. Cada componente tem estado normal, apertado, desativado, carregando e erro.

### Botões
| Tipo | Visual | Quando |
|---|---|---|
| **Principal** | Laranja, texto beringela negrito, altura 52, largura cheia no celular | Uma vez por tela: "Publicar", "Continuar", "Entrar" |
| **WhatsApp** | Verde-escuro, texto branco, ícone de conversa, altura 52 | Só para chamar o vendedor ou o comprador |
| **Secundário** | Borda beringela, fundo branco | "Salvar rascunho", "Compartilhar" |
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
- **Chips de filtro** roláveis (cidade, preço, categoria), com contador "Filtros (3)". Chip selecionado: fundo `selecao`, borda `laranja-escuro` e um ✓ (a borda laranja comum tem só 2,9 : 1 sobre branco e o estado não pode depender só da cor). Foco de campo: borda `laranja-escuro`.
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

Fica em `src/app/globals.css` (a base do app tinha `--color-marinho`; trocar o nome para `--color-beringela` e as classes `*-marinho` para `*-beringela`). Os nomes viram classes como `bg-laranja`, `text-beringela`, `rounded-card`.

```css
@import "tailwindcss";

@theme {
  --color-beringela: #4B1248;
  --color-laranja: #FF6A13;
  --color-laranja-escuro: #C2410C;
  --color-laranja-claro: #FFF4EC;
  --color-verde: #12A150;
  --color-verde-escuro: #0E7A3D;
  --color-fundo: #F7F8FA;
  --color-cartao: #FFFFFF;
  --color-texto: #342B3B;
  --color-texto-suave: #5E5266;
  --color-borda: #E6E0E9;
  --color-borda-campo: #968B9E;
  --color-selecao: #F0EAF5;
  --color-perigo: #B91C1C;
  --color-aviso: #B45309;
  --color-aviso-fundo: #FFFBEB;
  --color-patrocinado-fundo: #FFE4D1;
  --color-perigo-fundo: #FEF2F2;
  --color-sucesso-fundo: #ECF8F1;

  --font-sans: var(--font-poppins), system-ui, sans-serif;
  --text-titulo: 1.375rem;
  --text-titulo--line-height: 1.3;
  --text-rotulo: 0.875rem;
  --text-rotulo--line-height: 1.45;
  --text-legenda: 0.8125rem;
  --text-legenda--line-height: 1.4;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  --radius-campo: 0.5rem;
  --radius-card: 0.75rem;
  --radius-folha: 1.25rem;

  --shadow-1: 0 1px 2px rgb(75 18 72 / 0.08);
  --shadow-2: 0 -2px 12px rgb(75 18 72 / 0.12);

  --spacing-toque: 3rem; /* 48px, área mínima de toque */
}
```

Se o shadcn/ui entrar, apontar as variáveis dele para estes tokens: `--primary` = laranja, `--primary-foreground` = beringela, `--destructive` = perigo, `--ring` = laranja-escuro, `--radius` = 0.75rem.

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


## 8. Refinamento do sistema, 10/11/2026

Direção: preservar a marca OL-AKI e melhorar a operação. Dials: DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 6. Poppins continua a família única; a hierarquia vem do tamanho, peso e espaço, sem usar negrito em todo valor de formulário.

O painel tem título de 22 px, seções de 18 px, títulos de cartão de 16 px, corpo de 14 px e metadados de 13 px. Esses tamanhos são definidos em rem. A escala fica em `src/app/admin/painel.css`, sem reduzir a base de leitura pública. O menu lateral tem rolagem própria e permite que nomes longos quebrem linha.

Em Destaques, a grade responde à largura interna do cartão: quatro colunas somente a partir de 48 rem disponíveis; abaixo disso usa duas, com nome e descrição ocupando a largura inteira. Descrições usam textarea para mostrar o conteúdo sem cortar. Atalhos levam às seis seções principais. Informações técnicas da integração e prazos avançados usam detalhes expansíveis nativos, preservando os controles e o acesso por teclado.

Movimento tem função de resposta à pressão: `olaki-acao` desloca 1 px em 120 ms, apenas durante o clique. O foco por teclado não se move; `prefers-reduced-motion` elimina esse deslocamento. Cores transitam em 150 ms. Não há animação de entrada nem movimento contínuo novo.

As ações, permissões, campos enviados, preços, regras de pagamento e configurações continuam sob as mesmas funções de servidor. Qualquer revisão futura deve conferir primeiro que cada função antiga continua acessível.
