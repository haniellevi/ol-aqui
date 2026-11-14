# 04 · Tipografia e bibliotecas de interface

Data: 14/11/2026. Projeto: Mercado da Região (worktree `design-system`).
Escopo: só pesquisa. Nenhum pacote instalado, nenhum código alterado, nenhum commit.

Legenda: **FATO** = medido ou documentado (com fonte). **OPINIÃO** = juízo meu, com o motivo.

---

## Resumo para o dono

- **Tipografia:** a pergunta é se a Poppins fica. Ela é legível e tem arquivo pequeno, mas é a mais larga do grupo e **não tem números de largura fixa** (tnum), o que desalinha preços em R$ nas listas.
- **Minha recomendação:** **Figtree** como família única. Tem números alinhados, arquivo pequeno e tom caloroso. Escolha final é sua, vendo as 3 opções lado a lado.
- **Bibliotecas:** não adicionar nada grande. Carrossel, zoom e transições já resolvidos com CSS ou com o que já existe. O único acréscimo que vale considerar é o **Toast do Base UI** (já vem no pacote que o projeto tem) para avisos.
- **Gaveta:** manter o **Drawer** do shadcn (agora em Base UI, não mais Vaul). A "Folha" própria vira casca em volta dele.
- **Travar o padrão:** a combinação mais simples é **regras nativas do ESLint** mais um **script de grep** para cor solta e tamanho `text-[Npx]`. O plugin de Tailwind mais usado hoje exige ESLint 9; o projeto está no ESLint 8.57.1.

---

## PARTE A · Tipografia

### A1. Método e fontes

- Lista de partida: as 14 fontes pedidas (Poppins, Inter, Nunito Sans, Source Sans 3, Figtree, Plus Jakarta Sans, Atkinson Hyperlegible, Atkinson Hyperlegible Next, Lexend, Public Sans, DM Sans, Manrope, Be Vietnam Pro, Mulish, Rubik).
- **FATO:** metadados (variável ou não, pesos, subconjuntos) vieram da API pública do Fontsource: `https://api.fontsource.org/v1/fonts/<id>`.
- **FATO:** métricas (altura-x, altura de maiúscula, largura média, presença da feature `tnum` no GSUB) foram lidas direto dos arquivos TTF oficiais no repositório `https://github.com/google/fonts` (pasta `ofl/`), com um leitor de tabelas OpenType escrito só para esta medição (sem instalar nada). Fonte: `https://raw.githubusercontent.com/google/fonts/main/ofl/<fonte>/`.
- **FATO:** tamanho do arquivo woff2 do subconjunto `latin` veio dos arquivos estáticos do Fontsource no CDN `cdn.jsdelivr.net/fontsource/fonts/...` (requisição HEAD, campo Content-Length). **Não é o arquivo exato que o `next/font` baixa do Google.** Ordem de grandeza é a mesma; o número exato na Vercel eu não medi.
- **FATO:** todas as 14 têm o subconjunto `latin` com as letras do português (ã, õ, ç, á, é, í, ó, ú, â, ê, ô, à). Verificado nas faixas Unicode do Fontsource (`U+0000-00FF` incluído em todas). Acentos: passam em todas.

### A2. Corte: quem fica e quem sai

| Fonte | Decisão | Motivo (FATO, com número) |
|---|---|---|
| **Poppins** | Fica (controle) | Já é a atual. Sem `tnum`. Mais larga: 33,8 caracteres por linha de 288px a 16px (medido). |
| **Figtree** | Fica | Variável, pesos 300–900. `tnum` presente. 34 KB para 400+600+700. 39,2 caracteres por linha. |
| **Atkinson Hyperlegible Next** | Fica | Variável, pesos 200–800. `tnum` presente. 37,5 KB para 400+600+700. Desenhada para baixa visão. |
| **Plus Jakarta Sans** | Fica | Variável, 200–800. `tnum` presente. 36 KB para 400+600+700. 36,7 caracteres por linha. |
| **Manrope** | Fica | Variável, 200–800. `tnum` presente. 42 KB para 400+600+700. |
| **Public Sans** | Fica | Variável, 100–900. `tnum` presente. 44 KB para 400+600+700. Tom neutro, de órgão público. |
| **Inter** | Fica (referência) | Variável com eixo óptico. `tnum` presente. 72 KB só nos 3 pesos estáticos medidos. Muito usada em app e startup. |
| Atkinson Hyperlegible (original) | Sai | Só tem 400 e 700 (FATO, Fontsource). Título em 600 ficaria simulado. A versão Next cobre o caso. |
| Be Vietnam Pro | Sai | Sem `tnum`. 65 KB nos 3 pesos. Largura parecida com a Poppins (34,9 caracteres por linha). |
| Rubik | Sai | Tem `tnum`, mas pesa 57 KB nos 3 pesos (FATO). Cantos arredondados que puxam para "brinquedo" (OPINIÃO). |
| Lexend | Sai | Sem `tnum`. A mais larga da lista depois da Poppins (35,2 caracteres por linha). |
| Source Sans 3 | Sai | Sem `tnum` (só `pnum`, FATO). 47 KB nos 3 pesos. |
| DM Sans | Sai | Sem `tnum`. |
| Nunito Sans | Sai | Sem `tnum`. Cantos arredondados (OPINIÃO na parte do tom). |
| Mulish | Sai | Sem `tnum`. |

**Corte final: 7 candidatas.** Poppins, Figtree, Atkinson Hyperlegible Next, Plus Jakarta Sans, Manrope, Public Sans, Inter.

### A3. Medidas das finalistas (FATO)

Altura-x e altura de maiúscula são proporções sobre o tamanho do corpo (medidas no OS/2). Largura é a média do texto de amostra "Vendo cama de casal quase nova, com colchão, em ótimo estado, retirada na loja" em 16px, usando a instância padrão da fonte (para variáveis, a instância Regular; a largura de negrito pode ser um pouco maior).

| Fonte | Altura-x | Altura maiúscula | Caracteres em 288px a 16px | "Vendo cama de casal quase nova" a 18px | `tnum` | Pesos disponíveis (Fontsource) | Arquivo latin 400+600+700 |
|---|---|---|---|---|---|---|---|
| Poppins | 0,548 | 0,698 | 33,8 | 345 px | não | 100–900 (estáticos) | 23,7 KB |
| Figtree | 0,500 | 0,700 | 39,2 | 264 px | sim | 300–900 (variável) | 34,3 KB |
| Atkinson Hyperlegible Next | 0,496 | 0,668 | 39,2 | 264 px | sim | 200–800 (variável) | 37,5 KB |
| Plus Jakarta Sans | 0,536 | 0,745 | 36,7 | 282 px | sim | 200–800 (variável) | 36,2 KB |
| Manrope | 0,540 | 0,720 | 39,3 | 265 px | sim | 200–800 (variável) | 42,5 KB |
| Public Sans | 0,517 | 0,723 | 38,5 | 271 px | sim | 100–900 (variável) | 43,8 KB |
| Inter | 0,546 | 0,728 | 36,4 | 286 px | sim | 100–900 (variável) | 72,5 KB (estáticos) |

Obs.: "Vendo cama de casal quase nova" a 18px cabe em 1 linha de 288px em todas, exceto a Poppins (345 px, quebra em 2 linhas). Para título de anúncio em 2 linhas, todas cabem.

Medida extra: "Mercado da Região" na logo em 28px:

| Fonte | Largura em 28px |
|---|---|
| Figtree | 239 px |
| Atkinson Hyperlegible Next | 238 px |
| Manrope | 240 px |
| Public Sans | 246 px |
| Inter | 257 px |
| Plus Jakarta Sans | 259 px |
| Poppins | 275 px |

Preço "R$ 1.250,00" a 16px: entre 81 e 93 px em todas. **Número com `tnum`** fica com a mesma largura em cada dígito; sem ele, "1" é mais estreito e a coluna de preço treme.

**FATO sobre a Poppins:** `tnum` ausente (confirmado no GSUB do TTF). Os números da Poppins são proporcionais.

**FATO sobre a altura-x:** Poppins 0,548 e Inter 0,546 são quase iguais. A diferença de "tamanho visual" entre elas é pequena. A Poppins parece maior por ser mais larga e mais redonda, não por ter x-height maior (OPINIÃO baseada nesses números).

**FATO sobre I/l/1 e O/0:** o TTF tem glifo para todos (verificado). **Não medi se as formas se distinguem.** Fonte sobre a Atkinson: a Braille Institute diz que a fonte separa l, I e 1 com desenho próprio (`https://www.dezeen.com/2020/09/11/atkinson-hyperlegible-typeface-applied-design-works/` e `https://github.com/googlefonts/atkinson-hyperlegible`). Para as outras, não achei dado oficial; isso precisa de teste visual.

### A4. Pontuação (pesos explícitos)

Critérios e pesos (somam 100):
- Legibilidade em tamanho pequeno em tela de baixa densidade: **25**
- Economia de largura (quantos caracteres cabem): **15**
- Números e preço (tnum): **15**
- Peso de arquivo: **15**
- Personalidade e tom "vizinho de confiança": **15**
- Acentos pt-BR: **10**
- Flexibilidade de pesos: **5**

Nota de 0 a 10 por critério. Nota final = soma de (nota × peso / 10).
**Os valores das notas são OPINIÃO**, derivados dos números medidos acima. O que é FATO: a presença de `tnum`, os tamanhos e a largura. Acentos: todas 10 (FATO).

| Critério (peso) | Poppins | Figtree | Atkinson Next | Plus Jakarta | Manrope | Public Sans | Inter |
|---|---|---|---|---|---|---|---|
| Legibilidade pequena (25) | 6 | 8 | 9 | 8 | 7 | 7 | 9 |
| Economia de largura (15) | 3 | 7 | 7 | 6 | 7 | 7 | 6 |
| Números / preço (15) | 3 | 9 | 9 | 9 | 9 | 9 | 10 |
| Peso de arquivo (15) | 9 | 9 | 9 | 9 | 9 | 8 | 6 |
| Personalidade / tom (15) | 7 | 8 | 6 | 5 | 6 | 5 | 3 |
| Acentos pt-BR (10) | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| Flexibilidade de pesos (5) | 6 | 8 | 9 | 8 | 8 | 9 | 9 |
| **Total (100)** | **61,0** | **83,5** | **83,5** | **76,0** | **78,0** | **75,5** | **74,5** |

Leitura da tabela:
- **Figtree e Atkinson Next empatam em 83,5.** Desempate é gosto: Figtree é mais quente; Atkinson é mais funcional.
- Poppins fica em último por número sem `tnum` e largura. **Isso é FATO medido**: os dois critérios juntos valem 30 dos 100 pontos.
- Inter pontua bem em números e legibilidade, mas cai no tom (3). É a "cara de app" que você quer evitar.
- Os números de personalidade e tom são OPINIÃO.

### A5. Uma família ou par? (OPINIÃO)

Recomendo **uma família só**. Motivos:
- Um par (título + texto) pesa mais no celular de entrada: dois arquivos, duas faces para baixar.
- Hoje o projeto carrega só uma (Poppins em 400, 600, 700).
- Com uma família variável (Figtree, Atkinson Next) dá para usar peso 500 e 800 sem novo arquivo, se precisar.

Par só faria sentido se a Poppins virasse título e a Figtree fosse texto. Esse é um cenário "Opção 1 + números" e não recomendo agora.

### A6. As 3 opções para você escolher

#### Opção 1: Manter Poppins com ajustes

- **Família:** Poppins.
- **Pesos a carregar:** 400, 600, 700 (já carregados hoje, `src/app/layout.tsx:6-10`).
- **Ajustes:**
  - Título de anúncio em no máximo 2 linhas, com tamanho menor (ver escala).
  - Preço em negrito 700, alinhado à direita nos cards (não corrige o desalinhamento de dígitos, só suaviza).
  - Corpo de 16px no celular.
- **Escala de tamanhos, celular:**

| Papel | Variante corpo 16px | Variante corpo 14px |
|---|---|---|
| Legenda | 13px / 1,4 | 12px / 1,4 |
| Rótulo | 14px / 1,4 | 13px / 1,4 |
| Corpo | **16px / 1,5** | 14px / 1,5 |
| Destaque | 18px / 1,4 | 16px / 1,4 |
| Título de card | 18px / 1,3 | 17px / 1,3 |
| Título de seção | 22px / 1,25 | 20px / 1,25 |
| Título de página | 26px / 1,2 | 24px / 1,2 |
| Vitrine (hero) | 24–32px (clamp) / 1,15 | 22–30px / 1,15 |

- **Altura de linha:** corpo 1,5; títulos 1,25.
- **Como carregar (já está pronto):**

```ts
import { Poppins } from "next/font/google";
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-poppins", display: "swap" });
```

- **Nome "Mercado da Região" em Poppins:** 275 px em 28px (FATO). Cabe numa linha de 288px (celular de 320px com 16px de margem), mas com pouca folga. Não consegui renderizar a imagem; a largura é medida, o desenho é OPINIÃO.

#### Opção 2: Figtree (família única) — recomendada

- **Família:** Figtree (variável, `wght` 300–900). Licença OFL, Google Fonts.
- **Pesos a carregar:** 400, 600, 700. Com a variável, 500 e 800 saem sem arquivo novo.
- **Escala de tamanhos, celular:**

| Papel | Variante corpo 16px | Variante corpo 14px |
|---|---|---|
| Legenda | 13px / 1,4 | 12px / 1,4 |
| Rótulo | 14px / 1,4 | 13px / 1,4 |
| Corpo | **16px / 1,5** | 14px / 1,5 |
| Destaque | 18px / 1,4 | 16px / 1,4 |
| Título de card | 18px / 1,3 | 17px / 1,3 |
| Título de seção | 22px / 1,25 | 20px / 1,25 |
| Título de página | 26px / 1,2 | 24px / 1,2 |
| Vitrine (hero) | 24–32px (clamp) / 1,15 | 22–30px / 1,15 |

- **Altura de linha:** corpo 1,5; títulos 1,25.
- **Como carregar com `next/font`:**

```ts
import { Figtree } from "next/font/google";
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-figtree", display: "swap" });
// em <html className={figtree.variable}>
// globals.css: --font-sans: var(--font-figtree), system-ui, sans-serif;
// layout.tsx: trocar fontFamily do Clerk para "var(--font-figtree), system-ui, sans-serif"
```

- **Nome "Mercado da Região" em Figtree:** 239 px em 28px (FATO). Cabe numa linha de 288px com folga razoável.
- **Números:** `tnum` presente, preço fica alinhado.

#### Opção 3: Atkinson Hyperlegible Next (família única)

- **Família:** Atkinson Hyperlegible Next (variável, 200–800). Desenhada para baixa visão pela Braille Institute.
- **Pesos a carregar:** 400, 600, 700.
- **Escala de tamanhos, celular:** igual à Opção 2 (mesmos papéis e tamanhos).
- **Altura de linha:** corpo 1,5; títulos 1,25.
- **Como carregar com `next/font`:** o nome da exportação segue o padrão do Google (`Atkinson_Hyperlegible_Next`). **Não confirmei o nome exato na documentação do Next.js; conferir antes de usar.**

```ts
import { Atkinson_Hyperlegible_Next } from "next/font/google";
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-atkinson", display: "swap" });
```

- **Nome "Mercado da Região" nela:** 238 px em 28px (FATO). Quase igual à Figtree.
- **Vantagem:** é a opção com maior legibilidade medida (nota 9 em legibilidade pequena, OPINIÃO), `tnum` presente.
- **Risco:** o desenho é funcional e pode parecer frio para a marca "vizinho de confiança" (OPINIÃO).

### A7. Recomendação

**Recomendo a Opção 2 (Figtree).** Motivos:
1. Números com `tnum`, arquivo pequeno (34 KB para 3 pesos), variável: menos peso para o celular fraco (FATO).
2. Tom mais caloroso que a Atkinson e menos "app" que a Inter (OPINIÃO).
3. Largura igual à Atkinson e mais estreita que a Poppins, cabe mais texto por linha (FATO).

**Quando eu escolheria a Atkinson (Opção 3):** se o público for majoritariamente de idade alta e o tom "vizinho" puder ser dado pela cor e pelas palavras, e não pela fonte.

**Quando eu manteria a Poppins (Opção 1):** se a marca já estiver muito reconhecida na Poppins e a troca não compensar. O custo é o preço sem alinhamento e a largura maior.

**Pendência honesta:** nada disso foi visto renderizado na tela. Antes de decidir, vale fazer um teste visual com o nome da marca, um título de anúncio em 2 linhas e um preço, nas 3 fontes, num celular de 360px. Não fiz esse teste.

---

## PARTE B · Bibliotecas

### B1. Tabela: entra ou fica de fora (para ESTE projeto)

Projeto é web (Next.js). Bibliotecas nativas ficam fora por isso.

| Biblioteca | Decisão | Motivo |
|---|---|---|
| shadcn/ui | **Entra (já está)** | `components.json` com estilo `base-nova` (linha 3). É a base. |
| DaisyUI | Fica de fora | Cria classes próprias de componente em cima do Tailwind. Briga com os tokens e com o Base UI. |
| Flowbite | Fica de fora | Mesmo problema do DaisyUI, com JavaScript próprio. Duplicaria o que o shadcn já dá. |
| MUI | Fica de fora | Motor de estilo próprio (Emotion), peso grande, visual Material. Briga com Tailwind v4. |
| Ant Design | Fica de fora | Peso grande, visual próprio, mesma briga de estilo. |
| Chakra UI | Fica de fora | Sistema de estilo próprio (props). Não combina com Tailwind v4 neste projeto. |
| Radix | Fica de fora | O shadcn saiu do Radix para o Base UI neste estilo. Adicionar Radix duplicaria primitivos. |
| Headless UI | Fica de fora | Outro conjunto de primitivos. Duplica o Base UI. |
| React Aria | Fica de fora | Acessibilidade muito boa, mas duplica o Base UI. Só reavaliar se o Base UI falhar em algo. |
| Tamagui | Fica de fora | Para app nativo e web. Este projeto é só web. |
| React Native Paper | Fica de fora | Só app nativo. |
| gluestack | Fica de fora | Só app nativo e web multiplataforma. |

### B2. Estado atual: shadcn, Base UI, React 19, Tailwind v4 (FATO, com fontes)

- **Base UI** é o motor do estilo `base-nova` (`components.json:3`). Versão no projeto: `@base-ui/react` ^1.9.0 (`package.json`). Versão mais nova no npm hoje: 1.9.0 (consulta ao registro). Peer: React 17, 18 e 19 (`https://registry.npmjs.org/@base-ui/react`).
- **Drawer** do shadcn agora usa Base UI, **não mais Vaul**. Migração: remover `vaul` e usar `@base-ui/react`. Props exclusivas do Vaul (`handleOnly`, `repositionInputs`, `shouldScaleBackground`) não existem no Base UI (`https://ui.shadcn.com/docs/components/base/drawer`).
- **React 19 e Tailwind v4:** o shadcn diz que todos os componentes foram atualizados para Tailwind v4 e React 19 (changelog de fevereiro de 2025, `https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4`).
- **Toast foi descontinuado** no shadcn em favor do **Sonner** (`https://ui.shadcn.com/docs/components/aria/toast`).
- **Pegadinhas:**
  1. Props do Vaul não têm equivalente direto no Base UI (ver acima).
  2. Formulário dentro de gaveta: o Base UI tem `Drawer.VirtualKeyboardProvider` para o teclado do celular não cobrir o campo (`https://base-ui.com/react/components/drawer`). **Só relevante se a gaveta tiver campo de texto.**
  3. Versões de documentação mais antigas do Base UI usavam o nome de pacote `@base-ui-components/react`. Usar `@base-ui/react`, que é o que o projeto tem.
- **Não confirmei** o status "stable v1" do Base UI com fonte oficial; as páginas que achei eram de terceiros. A versão 1.9.0 está no registro npm (FATO), e isso basta para o projeto.

### B3. Necessidades descobertas: uma solução por necessidade

Regra: zero dependência quando CSS resolve.

**1. Carrossel de categorias e galeria de fotos**
- **Recomendação:** **CSS puro com `scroll-snap`.** Sem Embla.
- **Já existe no projeto:** `src/app/(anuncio-publico)/anuncio/[idslug]/galeria.tsx:101` usa `snap-x snap-mandatory overflow-x-auto`. Funciona sem JavaScript. `src/app/(publico)/inicio.module.css:58-67` tem o mesmo padrão para as categorias.
- **Peso:** zero.
- **Alternativa:** Embla via `embla-carousel-react` (shadcn Carousel). Versão 8.6.0, 49 KB descompactado (FATO, registro npm), peer React até 19.
- **Por que não Embla:** celular fraco, a galeria já funciona com CSS e o shadcn Carousel traz o Embla como dependência extra (FATO) sem ganho para este caso (OPINIÃO).

**2. Avisos rápidos (toast)**
- **Recomendação:** **Toast do Base UI** (`Toast.Provider`, `toastManager.add`). Já vem no `@base-ui/react` que o projeto tem: **zero pacote novo**.
- Docs: `https://base-ui.com/react/components/toast`. Tem limite de avisos (padrão 3), tempo de sumir (padrão 5 s), prioridade `low`/`high` para leitor de tela.
- **Alternativa:** Sonner (shadcn). Versão 2.0.8. Peer React 18 e 19. Um pacote a mais e um tema a alinhar (OPINIÃO: não precisa).
- **Estado atual:** o projeto não tem toast. `src/components/paginas/aviso-sem-internet.tsx` é aviso fixo, não toast. (FATO, grep.)

**3. Gaveta inferior**
- Hoje existem: **Folha** (`src/components/ui/folha.tsx`), **Drawer** (`src/components/ui/drawer.tsx`, Base UI) e **Sheet** (`src/components/ui/sheet.tsx`, Base UI Dialog).
- **Fato:** a Folha **já usa o Drawer** no celular e o Dialog no computador (`src/components/ui/folha.tsx:8-9`).
- **Fato:** o Sheet só é usado pelo `sidebar.tsx`.
- **Recomendação:** **manter o Drawer** como gaveta oficial. A Folha vira uma casca fina em volta dele, com a mesma API para não quebrar os 7 arquivos que a usam. Sheet fica como está (interno do sidebar).
- **Não usar Vaul.** É a dependência antiga do shadcn.

**4. Formulários e validação**
- Hoje: `Campo` próprio (`src/components/ui/campo.tsx`) com erro escrito embaixo, e validação feita à mão.
- **Recomendação:** **não instalar nada agora.** Manter `Campo` e validação manual.
- **Alternativa se a validação crescer:** React Hook Form 7.92 (1,6 MB descompactado no registro) e Zod 4.6.7 (6 MB descompactado). Tamanho descompactado não é o que chega ao celular; o arquivo que vai para o navegador eu não medi.

**5. Zoom de imagem na galeria**
- **Já existe:** `galeria.tsx:142` usa `<dialog>` nativo para a foto em tela cheia, com fechamento por tecla e botão.
- **Recomendação:** manter. Zero dependência.

**6. Animação**
- **Já existe:** `tw-animate-css` (`src/app/globals.css:2`) e regras de `prefers-reduced-motion` (`globals.css:141` e `:148`).
- **Recomendação:** **só CSS.** Base UI expõe `data-starting-style` e `data-ending-style` para transição de entrada e saída (`https://base-ui.com/react/components/toast`).
- **Não usar** `motion` (14.14.0, 994 KB descompactado) ou `framer-motion`. Não há caso que justifique.

**7. Ícones de categoria (Lucide)**
- **Já mapeados:** `src/components/ui/icone-categoria.tsx:11-19` usa 39 ícones Lucide (carro, moto, caminhão, trator, trigo, casa, prédio, loja, sofá, etc.).
- **Confirmado em Lucide** (FATO, lucide.dev): `tractor`. Também `wheat` e `sprout` aparecem como nomes de ícone Lucide (fontes de terceiros; confirmar no lucide.dev).
- **Lacunas:**
  - **Animais:** só `paw-print` está no mapa. Não encontrei `cow`, `horse`, `dog` ou `cat` confirmados no Lucide. Uma fonte diz que o Lucide não tem ícone de pecuária (`https://www.shadcn.io/icons/tag/livestock?library=lucide-lab`, resultado de busca).
  - **Imóveis:** `house` e `building-2` cobrem.
- **Alternativa para as lacunas:** Lucide Lab tem ícones de pecuária (fonte de busca, não verifiquei a lista). Outra saída é desenhar 2 ou 3 SVG com traço de 2px, igual ao Lucide, sem biblioteca nova.
- **Ação antes de decidir:** listar os nomes no `lucide.dev/icons` e buscar "cow", "horse", "dog", "cat".
- **Versão:** o projeto usa `lucide-react` 0.544.0 (`package.json`). A mais nova no registro é 1.73.0 (FATO). Não recomendo subir agora.

### B4. Peças duplicadas: quem fica, quem sai, quantos arquivos usam hoje

Contagem feita com `grep -rln` nas importações (`from "@/components/ui/<nome>"`): número de arquivos que importam a peça.

Peças shadcn presentes em `src/components/ui/` (FATO, listagem): alert-dialog, alert, avatar, badge, button, card, checkbox, dialog, drawer, dropdown-menu, empty, field, input, label, native-select, radio-group, select, separator, sheet, sidebar, skeleton, switch, table, tabs, textarea, toggle, toggle-group, tooltip. Além destas, há peças próprias (botao, campo, chip, confirmar, carregando, vazio, folha, cabecalho-publico, barra-inferior, campo-arquivo, icone-categoria, menu-cidades e outras).

| Função | Peça oficial (shadcn) | Peça a aposentar | Arquivos que usam hoje |
|---|---|---|---|
| Botão | `button.tsx` (4 arquivos) | `botao.tsx` | **botao: 188** arquivos; button: 4 |
| Campo de texto | `field.tsx` (0 uso) + `input.tsx` (16) | `campo.tsx` (28) | campo: **28**; input: 16; field: **0** |
| Tela vazia | `empty.tsx` (1, dentro de `vazio.tsx`) | `vazio.tsx` (54) | vazio: **54** (vazio é casca em volta de empty) |
| Carregando | `skeleton.tsx` (3) | `carregando.tsx` (4) | carregando: 4 (é casca em volta de skeleton) |
| Confirmação | `alert-dialog.tsx` (5) | `confirmar.tsx` (13) | confirmar: **13** (é casca em volta de alert-dialog) |
| Gaveta | `drawer.tsx` (1, via folha) | `folha.tsx` (7) | folha: **7** arquivos |
| Seletor | `select.tsx` (0 uso) | `native-select.tsx` (3) | native-select: 3; select: **0** |
| Chip / selo | `badge.tsx` (36) | `chip.tsx` (26) | **Não são duplicados**: chip é filtro clicável, badge é rótulo. Manter os dois. |

**Pontos que pedem sua decisão** (a regra "shadcn vira oficial" esbarra no volume):
1. **Botão:** trocar 188 arquivos é grande. Alternativa: `botao.tsx` vira casca em volta de `button.tsx` (sem trocar imports). Recomendo a casca (OPINIÃO: custo baixo, mesma API).
2. **Campo:** `field.tsx` não é usado. Ou ele vira oficial (trocar 28 arquivos) ou `campo.tsx` continua e `field.tsx` sai. Recomendo `campo.tsx` continuar, porque é o que o projeto usa (OPINIÃO).
3. **Seletor:** `select.tsx` tem 0 uso e `native-select.tsx` tem 3. O seletor nativo abre a lista do próprio celular (`native-select.tsx:4`). **Para celular de entrada, o nativo costuma ser mais confiável** (OPINIÃO; não achei fonte que meça isso). Decisão sua.

### B5. Como travar o padrão (opções reais)

**FATO sobre o estado do projeto:**
- ESLint **8.57.1** (`package.json`). Config `.eslintrc.json` com `next/core-web-vitals` e `next/typescript`.
- Tailwind **4.1.13** (`package.json`).
- Nenhum plugin de Tailwind instalado.

**Opções:**

| Opção | Funciona com ESLint 8? | Funciona com Tailwind 4.1.13? | Observação |
|---|---|---|---|
| `eslint-plugin-tailwindcss` 4.4.0 | **Não.** Peer é ESLint 9 ou 10 | Sim (peer ^4.0.0) | Exigiria subir o ESLint. Mudança grande. |
| `eslint-plugin-better-tailwindcss` 4.11.0 | Sim (peer ESLint 7–10) | **Não exatamente**: peer pede ^4.1.17 e o projeto está em 4.1.13 | Precisa subir o Tailwind antes. Também lista oxlint como peer; verificar se é opcional antes de instalar. Pacote de ~1,7 MB descompactado. |
| Regras nativas do ESLint: `no-restricted-syntax` e `no-restricted-imports` | Sim | Não depende de plugin | **Zero pacote.** Serve para proibir import de `@base-ui/react` fora de `src/components/ui/` e para barrar cor literal em JSX. |
| Script próprio com grep | Sim | Sim | **Zero pacote.** Serve para cor solta (hex) e `text-[Npx]`. |

**Fatos encontrados pelo grep:**
- **Hex fora de `globals.css`:** 61 ocorrências em 20 arquivos. Muitos são **exceções legítimas**: `src/lib/cor-logo.ts`, `src/lib/aki/fundo-foto.ts`, `src/lib/loja-ia/modelo-capa.ts`, `src/app/manifest.ts`, `src/app/layout.tsx` (tema do Clerk e `themeColor`), e a pasta `src/components/demo/kit/`. Precisa de lista de exceções.
- **`text-[Npx]`:** 5 ocorrências, todas em `src/components/anuncio/card-anuncio.tsx` linhas 65, 73 e 78 (tamanhos 18px, 16px, 13px, 15px e 11px). Isso burla a escala do projeto.

**Recomendação (mais simples que funciona):**
1. **Agora, sem instalar nada:** um script `scripts/conferir-design.mjs` que faz grep por hex solto e `text-[Npx]` fora de uma lista de exceções. Roda à mão ou em `npm run`. Custo: uma tarde.
2. **Depois, quando o padrão estiver fechado:** regras `no-restricted-syntax` e `no-restricted-imports` no `.eslintrc.json`, para barrar importação das peças a aposentar. Zero pacote.
3. **Só se for necessário:** `eslint-plugin-better-tailwindcss`, depois de subir o Tailwind para 4.1.17 ou mais. Não recomendo `eslint-plugin-tailwindcss` enquanto o projeto estiver no ESLint 8.

---

## Fontes (URLs)

- Fontsource (metadados): https://api.fontsource.org/v1/fonts/poppins (e mesmo padrão para as outras)
- Repositório oficial das fontes: https://github.com/google/fonts (pasta `ofl/`)
- Métricas medidas: TTF em https://raw.githubusercontent.com/google/fonts/main/ofl/
- Atkinson Hyperlegible (Braille Institute): https://github.com/googlefonts/atkinson-hyperlegible ; https://www.dezeen.com/2020/09/11/atkinson-hyperlegible-typeface-applied-design-works/
- shadcn Drawer (Base UI, sem Vaul): https://ui.shadcn.com/docs/components/base/drawer
- shadcn Tailwind v4 e React 19: https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4
- shadcn Toast descontinuado: https://ui.shadcn.com/docs/components/aria/toast
- shadcn Sonner: https://ui.shadcn.com/docs/components/radix/sonner
- Base UI Drawer: https://base-ui.com/react/components/drawer
- Base UI Toast: https://base-ui.com/react/components/toast
- Registro npm (versões, peers, tamanhos): https://registry.npmjs.org/<pacote>
- eslint-plugin-tailwindcss (v4 exige ESLint 9+): https://registry.npmjs.org/eslint-plugin-tailwindcss
- eslint-plugin-better-tailwindcss: https://registry.npmjs.org/eslint-plugin-better-tailwindcss
- Lucide: https://lucide.dev/icons/tractor

## Não medido / pendências

- Tamanho exato que o `next/font` serve no Google (usei o Fontsource como aproximação).
- Renderização visual do nome da marca nas fontes (só largura medida).
- Distinção de I/l/1 e O/0 em todas as fontes exceto a Atkinson (fonte de terceiros).
- Lista completa de ícones Lucide para cow, horse, dog e cat (não confirmei).
- Nome exato da exportação `Atkinson_Hyperlegible_Next` no `next/font` (conferir na doc do Next.js).
- Tamanho final que o Toast ou o Sonner somam ao pacote enviado ao navegador (medi só o tamanho descompactado do registro).
- Estado "stable v1" do Base UI com fonte oficial.
