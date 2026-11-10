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

Superfícies usam `fundo` ou `cartao`. Seleções, navegação ativa e ícones de apoio usam `selecao`, com texto beringela. O bege foi retirado da interface; não usar `laranja-claro`. Manter as cores semânticas de aviso, erro, sucesso e patrocínio, além das cores escolhidas para as capas das lojas.

Texto laranja-escuro sobre `selecao` não atinge o contraste de 4,5:1 para texto pequeno; nessa combinação, usar beringela.

### Modo escuro

Fase 2. Os tokens já nascem com nome de função (`fundo`, `cartao`, `texto`) para que o modo escuro seja só trocar valores. Base: fundo `#1E1020`, cartão `#2E1530`, laranja como está (6,4 : 1 sobre o fundo escuro).

---

## 2. Letras (tipografia)

- **Fonte:** **Poppins** (gratuita, Google Fonts, carregada pelo `next/font`, sem custo e sem depender de servidor externo). É a mesma família do logo.
- Pesos usados: 400 (texto), 600 (títulos e botões), 700 (preço). Só três, para baixar menos dados.
- Se a internet estiver ruim, o texto aparece na fonte do celular e troca depois (`display: swap`); nunca fica tela em branco esperando a fonte.

| Nome | Tamanho / altura da linha | Peso | Uso |
|---|---|---|---|
| `preco` | 24 / 30 | 700 | Preço na página do anúncio; exceção à escala compacta |
| `titulo-1` | 20 / 26 | 600 | Título da tela (`text-titulo`) |
| `titulo-2` | 18 / 25 | 600 | Seções (`text-xl`) |
| `titulo-3` | 16 / 24 | 600 | Títulos de cards e grupos (`text-lg`) |
| `corpo` | 15 / 22,5 | 400 | Texto normal (`text-base`) |
| `card-preco` | 16 / 20 | 700 | Preço no card de anúncio |
| `card-titulo` | 14 / 20 | 400 | Título no card de anúncio, até 2 linhas |
| `legenda` | 13 / 18 | 400 | Cidade, data e metadados |
| `botao` | 14 / 20 | 600 | Botões públicos e administrativos |
| `rotulo` | 14 / 20 | 600 | Rótulos de campos |
| `campo` | 16 / 24 | 400 | Campos no celular e com toque |
| `campo-mouse` | 14 / 21 | 400 | Campos com mouse e largura mínima de 768 px |
| `painel-corpo` | 14 / 21 | 400 | Corpo do painel administrativo |

Campos mantêm 16 px no celular e no toque para evitar o zoom automático do iPhone. A redução para 14 px depende de largura mínima de 768 px e `pointer: fine`. Campos com tamanho específico, como preço, podem preservar sua escala.

Respeitar o tamanho de letra que a pessoa escolheu no celular (usar `rem`, nunca travar zoom). Muita gente da região usa letra grande.

---

## 3. Régua de tamanhos, espaços, cantos e sombras

> **Plano de design de 10/11/2026.** O Raniel achou botões grandes, textos enormes e falta de harmonia. A revisão das telas mostrou que a letra já estava boa; o peso vinha de botões esticados na largura toda no computador, cards com até seis botões empilhados e três alturas de controle misturadas (44, 48 e 56 px). A régua abaixo vale para o app inteiro. Nada de tamanho escrito à mão (`text-[13px]`, `h-12`): use os nomes da régua.

| Peça | Celular / toque | Computador (mouse, a partir de 768 px) | Como usar no código |
|---|---|---|---|
| Texto normal | 14 px | 14 px | `text-base` |
| Texto de apoio, botões e rótulos | 13 px | 13 px | `text-sm`, `text-rotulo` |
| Legenda (cidade, data) | 12 px | 12 px | `text-legenda` |
| Título da tela | 18 px | 20 px | `text-titulo` (muda sozinho no computador) |
| Título de seção | 15 px | 15 px | `text-lg font-semibold` |
| Preço e destaque | 16 a 20 px | 16 a 20 px | `text-xl`, `text-2xl` |
| Botão normal | 40 px | 36 px | `<Botao>` |
| Botão pequeno | 32 px | 28 px | `<Botao tamanho="pequeno">`: ações dentro de cards, listas e tabelas |
| Campo e lista de escolha | 40 px | 36 px | `<Campo>`, `<Seletor>`; `select` solto já recebe a altura pelo CSS base |
| Letra dentro de campo | 14 px (16 px só no iPhone) | 14 px | automático no `globals.css` |
| Barra de busca | 44 px | 40 px | `CampoBusca` |
| Cabeçalho | 52 px | 56 px | `CabecalhoPublico` |
| Barra de baixo | 56 px | não aparece | `BarraInferior` |
| Botão do Aki | 40 px | 40 px | `BalaoAki` |

> **2ª passada (10/11/2026, mesmo dia):** a primeira redução (48 para 44 px) quase não se notava, e o Raniel continuou vendo tudo grande. A escala inteira desceu um degrau (texto 15 para 14, legenda 13 para 12, título 20 para 18, controles 44 para 40) e a letra dos campos, que ficava em 16 px ao lado de texto de 14, passou a 14 px. O 16 px ficou só no iPhone (`@supports (-webkit-touch-callout: none)`), onde evita o zoom automático do Safari. A tabela da seção 2 traz os nomes; os tamanhos que valem são os desta régua.

- **Largura do botão:** `larguraTotal` ocupa a largura toda só no celular; do tablet para cima o botão para em 320 px (`sm:max-w-xs`). Em telas centralizadas, centralize o grupo de botões (`items-center`).
- **Um botão laranja por tela.** O resto é secundário (borda) ou texto.
- **Card com no máximo duas ações à vista**, em botões pequenos; as outras vão para o menu "Mais" (ex.: `AcoesAnuncio` em Meus anúncios: Vendi/Reativar/Continuar + Editar + Mais).
- **Espaçamento em múltiplos de 4:** 4, 8, 12, 16, 24, 32. Margem lateral das telas: **16**. Entre blocos: 24 no celular e 32 no computador. Dentro de card: 12 no celular e 16 no computador.
- **Largura de página:** formulários até 640 px, conta e listas até 1000 px, busca e início até 1150 px.
- **Cantos arredondados:** 8 (campos, chips, botões), 10 (cards), 20 (folhas que sobem de baixo), cheio (selos, avatar e o seletor de cidade do cabeçalho).
- **Sombras:** preferir borda discreta; `sombra-1` nos cards públicos que precisam de separação e `sombra-2` em folhas, menus e barras fixas.
- **Toque:** nada tocável abaixo de 32 px no celular (botão pequeno). Ações só com ícone mantêm pelo menos 40 × 40 px. Linhas de listas podem ser maiores conforme o conteúdo; não cortar texto para cumprir uma altura fixa.

---

**3ª passada (10/11/2026):** botões só de ícone (fechar, sino, setas da galeria, coração) têm 40px; ícone de status 40px; linhas de lista 48 a 56px; foto da loja 72px no topo da vitrine. Barras fixas ficam a 3,5rem do fim (altura da barra de baixo). O painel admin usa a mesma escala de letra do app, com campos e botões de 36px no mouse.

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
| **Principal** | Laranja, texto beringela, 44 px no toque e 40 px com mouse (pequeno: 36/32 px) | Uma vez por tela: "Publicar", "Continuar", "Entrar" |
| **WhatsApp** | Verde-escuro, texto branco, ícone de conversa, mesma altura dos demais botões | Só para chamar o vendedor ou o comprador |
| **Secundário** | Borda beringela, fundo branco | "Salvar rascunho", "Compartilhar" |
| **Texto** | Só o texto em laranja-escuro | "Pular", "Ver todos" |
| **Perigo** | Texto vermelho, confirmação antes | "Excluir anúncio", "Denunciar" |

Carregando: o botão mostra uma bolinha girando **e** o texto muda ("Publicando..."), e não deixa tocar duas vezes (evita anúncio duplicado com internet lenta).

### Card de anúncio

Foto 4:3, preço de 16 px, título de 14 px em até 2 linhas e metadados de 13 px. Preenchimento de 10 px. Coração de favorito no canto da foto, selo da loja quando existir e etiqueta **"Patrocinado"** para destaque pago.
Duas colunas no celular, 4 a 5 no computador. Card inteiro é tocável.

### Notificações e atendimento

Notificações ficam em uma lista de linhas compactas, com título de 14 px, texto de apoio e horário de 13 px. A linha inteira abre o aviso; não repetir uma chamada visível “Abrir aviso”. Avisos não lidos usam seleção lavanda suave e indicação de estado acessível. Erros aparecem junto à ação.

Preferências usam uma lista branca com nome e estado Ligado/Desligado. Explicações ficam recolhidas em “Sobre estes avisos”, com `details` e `summary` nativos. No atendimento, manter o campo e as ações próximos; informações complementares ficam recolhidas. O envio precisa mostrar andamento, confirmação ou erro.

### Barra de baixo (navegação principal, sempre visível no celular)

**Início · Buscar · [+ Anunciar] · Radar · Conta.** O "+ Anunciar" é um botão laranja maior no meio. Cinco itens com ícone **e** nome.

### Outros componentes

- **Campo de busca** no topo ("O que você procura?"), com microfone (busca por voz do próprio celular) e botão do Aki.
- **Chips de filtro** roláveis (cidade, preço, categoria), com contador "Filtros (3)". Chip selecionado: fundo `selecao`, borda `laranja-escuro` e um ✓ (a borda laranja comum tem só 2,9 : 1 sobre branco e o estado não pode depender só da cor). Foco de campo: borda `laranja-escuro`.
- **Folha que sobe de baixo** (bottom sheet) para filtros, escolher cidade e confirmar ações. Mais fácil com uma mão que janela no meio da tela.
- **Seletor de cidade** com as cidades da região e "Perto de mim".
- **Campo de código** (6 caixinhas, preenche sozinho com o código que chega no celular).
- **Campo de preço** com teclado numérico, já formatado "R$ 8.500".
- **Escolha por botões segmentados**, com a mesma escala dos demais controles, no lugar de lista suspensa: estado do produto, câmbio, ano.
- **Barra de passos** do cadastro de anúncio: "Passo 2 de 6" com barrinha.
- **Selos:** Loja Verificada (verde, ícone de escudo), Destaque, Novo. Selo sempre com texto, nunca só cor.
- **Aviso na tela** (toast) embaixo, some em 4s, com "Desfazer" quando der.
- **Tela vazia** sempre com uma saída: "Nenhuma moto até R$ 5 mil aqui. **Pedir no Radar** · **Perguntar ao Aki**".
- **Esqueleto de carregamento** (caixas cinzas piscando) em vez de tela em branco.
- **Balão do Aki** flutuante no canto, acima da barra de baixo.
- **Cartão do vendedor:** foto, nome, selo, "no OLAKI desde 2026", cidade, tempo de resposta.

---

## 6. Tokens para o desenvolvedor (Tailwind v4)

A fonte dos tokens é `src/app/globals.css`. Os nomes geram classes como `bg-laranja`, `text-beringela` e `rounded-card`. Atualizar essa base e os componentes compartilhados antes de criar exceções por tela.

```css
@import "tailwindcss";

@theme {
  --color-beringela: #4b1248;
  --color-laranja: #ff6a13;
  --color-laranja-escuro: #c2410c;
  --color-verde: #12a150;
  --color-verde-escuro: #0e7a3d;
  --color-fundo: #f7f8fa;
  --color-cartao: #ffffff;
  --color-texto: #342b3b;
  --color-texto-suave: #5e5266;
  --color-borda: #e6e0e9;
  --color-borda-campo: #968b9e;
  --color-selecao: #f0eaf5;
  --color-perigo: #b91c1c;
  --color-aviso: #b45309;
  --color-aviso-fundo: #fffbeb;
  --color-patrocinado-fundo: #ffe4d1;
  --color-perigo-fundo: #fef2f2; /* perigo sobre ele: 5,9:1 */
  --color-sucesso-fundo: #ecf8f1; /* verde-escuro sobre ele: 5,0:1 */

  --font-sans: var(--font-poppins), system-ui, sans-serif;
  --text-base: 0.9375rem;
  --text-base--line-height: 1.5;
  --text-lg: 1rem;
  --text-lg--line-height: 1.5;
  --text-xl: 1.125rem;
  --text-xl--line-height: 1.4;
  --text-2xl: 1.375rem;
  --text-2xl--line-height: 1.3;
  --text-titulo: 1.25rem;
  --text-titulo--line-height: 1.3;
  --text-rotulo: 0.875rem;
  --text-rotulo--line-height: 1.45;
  --text-legenda: 0.8125rem;
  --text-legenda--line-height: 1.4;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  --radius-campo: 0.5rem;
  --radius-card: 0.625rem;
  --radius-folha: 1.25rem;

  --shadow-1: 0 1px 2px rgb(75 18 72 / 0.08);
  --shadow-2: 0 -2px 12px rgb(75 18 72 / 0.12);

  --spacing-toque: 2.75rem; /* 44px, área mínima de toque */
}
```

Se o shadcn/ui entrar, apontar as variáveis dele para estes tokens: `--primary` = laranja, `--primary-foreground` = beringela, `--destructive` = perigo, `--ring` = laranja-escuro, `--radius` = 0.625rem.

---

## 7. Faça e não faça

| Faça | Não faça |
|---|---|
| Um botão principal por tela | Dois botões laranja brigando |
| Ícone + palavra | Ícone sozinho para coisa importante |
| Preço sempre visível e com hierarquia | Esconder preço atrás de "consulte" sem opção "a combinar" clara |
| "Patrocinado" sempre escrito | Destaque pago disfarçado de normal |
| Texto branco só em fundo escuro | Texto branco sobre o laranja do logo |
| Fotos reais do produto | Imagens de banco de imagens na home |


## 8. Refinamento do sistema, 10/11/2026

Direção: preservar a marca OL-AKI com telas mais compactas e menos informação simultânea. Poppins continua a família única; a hierarquia vem do tamanho, peso e espaço. Usar peso normal nos valores dos formulários.

O painel acompanha os títulos de 20, 18 e 16 px, com corpo de 14 px e metadados de 13 px. A base pública usa 15 px. Os tamanhos são definidos em rem nos tokens globais e em `src/app/admin/painel.css`. O menu lateral tem rolagem própria e permite que nomes longos quebrem linha.

Em Destaques, Planos, ações de Lojas e modelos do Aki, a grade responde à largura interna do cartão: quatro colunas somente a partir de 48 rem disponíveis; abaixo disso usa duas, com nome e descrição ocupando a largura inteira. Descrições de tipos e planos usam textarea para mostrar o conteúdo sem cortar. A tabela de créditos mantém rolagem horizontal dentro da própria região, incluindo os rótulos para leitores de tela. Atalhos levam às seis seções principais. Informações técnicas da integração e prazos avançados usam detalhes expansíveis nativos, preservando os controles e o acesso por teclado.

Movimento tem função de resposta à pressão: `olaki-acao` desloca 1 px em 120 ms, apenas durante o clique. O foco por teclado não se move; `prefers-reduced-motion` elimina esse deslocamento. Cores transitam em 150 ms. Não há animação de entrada nem movimento contínuo novo.

As ações, permissões, campos enviados, preços, regras de pagamento e configurações continuam sob as mesmas funções de servidor. Qualquer revisão futura deve conferir primeiro que cada função antiga continua acessível.


## 9. Conta, Radar e demais telas operacionais

A página Minha conta usa duas colunas a partir de 768 px, com identificação e início de venda à esquerda e navegação à direita. No celular conserva a sequência completa em uma coluna. Nomes de pessoas e lojas podem quebrar linha; não truncar a identificação principal.

`TopoConta` e `CabecalhoPasso` usam título de 20 px em rem. Pedidos e propostas usam corpo de 15 px, com descrições compactas de 14 px quando necessário. Datas, selos e metadados usam 13 px. `Seletor` acompanha Campo: altura de 44 px e texto de 16 px no toque, com 40 px e 14 px para mouse em telas a partir de 768 px. Filtros do Radar reutilizam Chip com seleção lavanda, marca de seleção e foco. Ações de card crescem quando o texto precisa de mais linhas.

No painel, datas e filtros começam em uma coluna quando o cartão é estreito. Indicadores só passam a quatro colunas em telas de 1280 px. Tabelas roláveis têm região nomeada, foco por teclado e rolagem local. Abas administrativas mostram a possibilidade de rolar no celular e quebram linha no desktop. Campos de configuração têm nome acessível e ajuda associada; descrições longas e prévias admitem quebra. O editor de campos adapta os controles numéricos e de ordenação à largura do próprio cartão.
