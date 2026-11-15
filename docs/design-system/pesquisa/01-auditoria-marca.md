# Auditoria de marca (visual) · Mercado da Região · 14/11/2026

Escopo: só o visual. Site no ar: https://mercadodaregiao.com.br (cópia de leitura da worktree `design-system`, sem alteração de código).
Como foi feito: navegador da prévia (Claude_Browser), celular em 375 px e computador em 1024 px (largura da área de teste). Leitura de DESIGN.md, PRODUCT.md, docs/DESIGN-SYSTEM.md, docs/MARCA.md, docs/USABILIDADE.md, src/app/globals.css, src/app/layout.tsx e public/logo/*.svg. Contraste calculado pela fórmula WCAG a partir dos hex.

Legenda: **[FATO]** = visto na tela, medido no navegador ou lido no arquivo (com caminho e linha). **[INFERÊNCIA]** = minha leitura, não medida.

Limites desta auditoria:
- O site no ar **não tem nenhum anúncio** (início, busca, categoria e loja mostram "nenhum anúncio"). Por isso **não consegui abrir uma página de anúncio real**. Os tamanhos do card e do preço foram lidos no código, não no site.
- Não testei com pessoas. Nada aqui substitui o teste de corredor de docs/USABILIDADE.md.
- Não abri /categorias em desktop nem as páginas de conta, Radar e painel.

---

## 1. Retrato atual da marca (10 linhas)

1. [FATO] No primeiro olhar, o cabeçalho tem o M com pin e "Mercado da Região" pequeno (logo de 28 px de altura no celular, 32 px no computador).
2. [FATO] A tela é cinza-frio com cartões brancos, como o guia pede (`fundo` e `cartao`).
3. [FATO] O que mais chama atenção no celular são blocos sólidos: um card beringela "Estou procurando…" e um card laranja inteiro "Anunciar", além da faixa verde "Quer ajuda para dar o próximo passo?" com botão verde.
4. [FATO] Quase tudo que aparece está vazio: "Seu anúncio pode ser o primeiro", lojas com quadrado branco no lugar da foto, "0 anúncios no ar" na loja. A primeira impressão é de site novo sem movimento.
5. [INFERÊNCIA] Isso passa mais "ferramenta de cadastro com vitrine vazia" do que "vizinho de confiança". O tom de voz está no texto ("Achou? Chama no WhatsApp"), mas o visual ainda não o sustenta.
6. [FATO] O texto é pequeno: corpo 13 px, título de seção 15 px, rótulos e legendas de 11 a 12 px (medido na home, celular).
7. [FATO] Não há foto, rosto ou elemento local (mapa, cidade, feira) no primeiro olhar. O nome da cidade aparece só no seletor do cabeçalho e no título "Anúncios em Corrente e região".
8. [FATO] A cor da marca aparece pouco: beringela em títulos e laranja no botão de busca e no card de anunciar. O verde aparece mais do que o laranja na loja.
9. [INFERÊNCIA] Para o "vizinho de confiança" funcionar, faltam três coisas visíveis: foto real, nome e cidade da loja em destaque, e preço grande. Hoje o preço (quando existir) sai com 11 px (ver seção 5).
10. [FATO] A frase "aqui a sua cidade aparece." existe, mas só no rodapé, em 13 px cinza.

---

## 2. Coerência: site no ar contra documentos, e documentos entre si

### 2.1 Contradições entre os documentos (com arquivo e linha)

| Assunto | Documento A | Documento B (e C) | Situação real |
|---|---|---|---|
| Tamanho do corpo | DESIGN.md:56-58 e :226 → **13 px** | DESIGN-SYSTEM.md:80 → **15 px**; :102 → **14 px**; :137 (4ª passada) → **13 px**; :228-230 → **15 px** (exemplo de tokens); :275 → "base pública usa 15 px" | Site 13 px. globals.css:38 = 13 px. Docs antigos não foram atualizados. |
| Texto mínimo / legenda | USABILIDADE.md:36 → **16 px** mínimo e **13 px** de legenda | DESIGN.md:66-69 → legenda **11 px**; DESIGN-SYSTEM.md:83 → 13 px; :104 → 12 px; :137 → 11 px | Site: legenda 11 px. Conflito já admitido em PRODUCT.md:81. |
| Alvo de toque | USABILIDADE.md:39 e :107 → **48 px** | DESIGN.md:177 → **40 px** (toque) e 36 px (mouse); DESIGN-SYSTEM.md:109 → 40/36; :158 → **44/40** | Site: botões de 40 px de altura (medido). |
| Botão pequeno | DESIGN.md:267 → 32 px (toque) / 28 px (mouse), texto 11 px | DESIGN-SYSTEM.md:158 → "pequeno: 36/32 px" | Conflito interno em DESIGN-SYSTEM.md:111 (32/28) contra :158 (36/32). |
| Título da tela | DESIGN.md:222 e frontmatter :33 → **16 px** (18 px no computador) | DESIGN-SYSTEM.md:77 → 20 px; :105 → 18/20 px; :236 (tokens) → 20 px; :137 → 16/18 px | Código: globals.css:57 e :112-115 → 16/18 px. |
| Preço no card | DESIGN.md:223 → "text-xl no card" (15 px) | DESIGN-SYSTEM.md:81 → 16 px | Código: card-anuncio.tsx:73 → **text-xs = 11 px** no celular. |
| Preço na página do anúncio | DESIGN.md:223 → "text-2xl" (18 px) | DESIGN-SYSTEM.md:76 → 24 px | Código: conteudo-anuncio.tsx:129 → **text-titulo = 16 px**. |
| Título de card | DESIGN.md:49-53 e :225 → 14 px, peso 600 | DESIGN-SYSTEM.md:82 → 14 px, peso **400** | Código: card-anuncio.tsx:65 → **12 px** no celular (text-sm), 16 px no computador. |
| Título da vitrine | DESIGN.md:221 → só o h1 do Início, 22 px | DESIGN-SYSTEM.md:106 → idem | Código: src/app/(publico)/page.tsx:202 → h1 com text-xl (**15 px**). |
| Espaço entre blocos | DESIGN.md:239 → **20 px** (gap-5) | DESIGN-SYSTEM.md:127 → **24 px** (celular) e 32 px (computador); :322 → gap-5 | Conflito interno. |
| Largura das páginas | DESIGN.md:241 e DESIGN-SYSTEM.md:322 → três larguras (max-w-md / xl / 6xl) | DESIGN-SYSTEM.md:128 → **640 / 1000 / 1150 px** | Conflito. |
| Campos | DESIGN.md:289 → 13 px (16 px no iPhone) | DESIGN-SYSTEM.md:86 → **16 px**; :113 → **14 px**; :288 → seletor 44 px e 16 px | Código: globals.css:105 → 13 px; layout.tsx:59 (Clerk) → 16 px no md. |
| Chip selecionado | DESIGN.md:280 → borda **beringela** | DESIGN-SYSTEM.md:184 → borda **laranja-escuro** | Conflito direto de cor. |
| Selo "Loja verificada" | DESIGN.md:191 → "selo sempre com texto" | USABILIDADE.md:58 → "com nome" | Código: card-anuncio.tsx:92 mostra só o ícone no celular (`md:hidden`, sem palavra). |
| Logo: laranja sobre branco | DESIGN.md:190 → laranja-escuro é "o laranja que lê sobre branco"; DESIGN.md:207 → Laranja Calado | public/logo/mercado-da-regiao-marca.svg → "da Região" em **#FF6A13** sobre branco | O logo contradiz a regra de cor do próprio sistema (ver seção 4). |
| Altura do cabeçalho | DESIGN.md:158 → 52 px | DESIGN-SYSTEM.md:115 → 52 px (celular) e 56 px | Site: 48 px no celular (medido, globals.css:257-260 `min-height: 3rem`). |
| Contraste do laranja-escuro | DESIGN-SYSTEM.md:54 → 4,7:1 sobre o fundo | Cálculo: **4,87:1** | Pequena imprecisão de documento; não muda decisão. |
| Quem usa 700 | DESIGN.md:231 → 700 só para preço, vitrine e logo | Site: "Estou procurando…" e "Anunciar" (card) em 700 (medido) | Desvio pequeno. |

Conflito já admitido pelo próprio time: PRODUCT.md:81 ("Conflito em aberto", 16 px / 48 px contra 13 px / 40 px).

### 2.2 Onde o site no ar diverge do que os documentos mandam

- [FATO] Botões: 40 px de altura, não 44 nem 48 (medido, Início: "Começar", "Agora não", "Ver todas", "Anunciar agora").
- [FATO] Dois blocos laranja sólidos no início (busca + card "Anunciar") e um botão verde ("Começar"). O guia quer **um** botão laranja por tela (DESIGN.md:209 "Um Laranja Rule").
- [FATO] Três botões de WhatsApp na loja ao mesmo tempo: "Chamar no WhatsApp" (topo), "Perguntar no WhatsApp" (vazio) e uma barra fixa embaixo com "WhatsApp".
- [FATO] Selo de loja verificada só como ícone no card compacto do celular (card-anuncio.tsx:92).
- [FATO] Cabeçalho do celular: 48 px (documento diz 52). Regra em globals.css:255-260 (`min-height: 3rem`).
- [FATO] Estado vazio em quase todas as telas. Pelo guia, "Tela vazia" tem saída (DESIGN.md:314), e o site cumpre isso (botões "Pedir no Radar", "Perguntar ao Merc"). O problema é a quantidade de vazio, não a saída.
- [FATO] Imagens de loja: a loja mostra um quadrado branco no lugar da logo e uma faixa cinza no lugar da capa (page da loja). Não é imagem de banco; é falta de imagem.

---

## 3. Cores

### 3.1 Tabela de contraste (WCAG 2.x; texto normal precisa de 4,5:1; gráfico e contorno de campo, 3:1)

| Par | Onde aparece | Contraste | Resultado |
|---|---|---|---|
| beringela #4B1248 / branco #FFFFFF | títulos, textos de marca | 14,20 | Passa |
| texto #342B3B / branco | corpo de texto | 13,51 | Passa |
| texto #342B3B / fundo #F7F8FA | corpo na tela cinza | 12,71 | Passa |
| texto-suave #5E5266 / branco | cidade, legendas | 7,31 | Passa |
| texto-suave / fundo #F7F8FA | legenda na tela cinza | 6,87 | Passa |
| texto-suave / selecao #F0EAF5 | chip e categoria | 6,19 | Passa |
| beringela / laranja #FF6A13 | botão principal "Buscar", "Anunciar", "Pedir no Radar" | **4,95** | Passa (justo) |
| branco / laranja #FF6A13 | (proibido pelo guia) | 2,87 | Reprova. Não apareceu no site medido. |
| laranja #FF6A13 / branco | "da Região" no logo | 2,87 | Reprova para texto. O logo tem exceção de logotipo na WCAG, mas o guia proíbe. |
| laranja #FF6A13 / fundo #F7F8FA | pin do logo sobre fundo cinza | 2,70 | Abaixo de 3:1 para gráfico. Pin é parte do logo. |
| laranja-escuro #C2410C / branco | "Ver todas", links, texto de ação | 5,18 | Passa |
| laranja-escuro / fundo | idem sobre cinza | 4,87 | Passa |
| **laranja-escuro #C2410C / selecao #F0EAF5** | ação sobre fundo lavanda | **4,39** | **Reprova** para texto pequeno. DESIGN.md:211 já proíbe. Ver proposta A. |
| branco / laranja-escuro #C2410C | botão de fundo laranja-escuro | 5,18 | Passa |
| branco / verde-escuro #0E7A3D | "Começar", "Chamar no WhatsApp" | 5,43 | Passa |
| verde-escuro / sucesso-fundo #ECF8F1 | "Quer ajuda…" (faixa verde) | 4,98 | Passa |
| verde-escuro / selecao | — | 4,60 | Passa (só se usado) |
| branco / verde #12A150 | (verde-selo) | 3,37 | Reprova para texto. Passa como ícone (3:1). Guia já diz "só ícone" (DESIGN.md:194). |
| perigo #B91C1C / branco | erro | 6,47 | Passa |
| perigo / perigo-fundo | caixa de erro | 5,91 | Passa |
| aviso #B45309 / branco | "Em análise" | 5,02 | Passa |
| aviso / aviso-fundo #FFFBEB | aviso | 4,84 | Passa |
| beringela / patrocinado-fundo #FFE4D1 | selo "Patrocinado" | 11,67 | Passa |
| coração #E11D48 / branco | ícone de favorito | 4,70 | Passa |
| borda-campo #968B9E / branco | contorno de campo | 3,24 | Passa (3:1). |
| borda #E6E0E9 / branco | divisória decorativa | 1,30 | Não serve de contorno de campo. Decorativa, OK. |

Resumo: o sistema passa em quase tudo. Reprovam o laranja como texto (logo), o laranja-escuro sobre lavanda e o verde como texto.

### 3.2 Ajustes mínimos propostos (decisão do dono)

- **A. laranja-escuro `#C2410C` para `#B84010`.** Passa: 4,71 sobre selecao, 5,23 sobre fundo, 5,56 sobre branco. Mantém a família laranja. Muda links, "Ver todas", anel de foco e cursor. Mexe no token usado em todo o site, então é uma decisão e não uma troca silenciosa.
- **B. "da Região" no logo.** Duas opções, a escolher:
  - B1: manter laranja `#FF6A13` (identidade, quem conhece o OLAKI reconhece). Aceitar o 2,87:1 e compensar com tamanho mínimo maior (seção 4).
  - B2: usar só o texto "da Região" em `#C2410C` (5,18:1 sobre branco), mantendo o pin em `#FF6A13`. Muda a cor do nome; o guia (MARCA.md, seção 2) proíbe trocar cor, então é mudança de marca.
- **C. Chip selecionado.** Escolher uma borda só: beringela (DESIGN.md) ou laranja-escuro (DESIGN-SYSTEM.md). Não mexe no contraste, só na regra.
- **D. Verde-selo `#12A150`.** Não mudar. Usar só como ícone, como o guia já diz.

---

## 4. Logo (public/logo, avaliado a 24 a 32 px de altura)

Medidas (FATO, do arquivo SVG e do navegador):
- `mercado-da-regiao-marca.svg`: viewBox 409 × 150. No cabeçalho do celular ele aparece com **76 × 28 px** (medido).
- A letra mais alta do nome tem cerca de **38 de 150 unidades** de altura (no próprio SVG, de y=36 a y=74; o trecho do caminho foi lido das coordenadas, não de uma renderização). Isso dá **7,1 px** de altura de letra a 28 px de logo, e **6,1 px** a 24 px.
- `mercado-da-regiao-linha.svg`: viewBox 623 × 98. A mesma medida dá cerca de 38 de 98 unidades. A 24 px de altura da logo, a letra fica com **9,3 px**, e a logo ocupa 153 px de largura.
- Traço do M: 23 unidades. A 28 px, o traço tem 4,3 px (bom). O círculo branco do pin tem raio 7,2 de 150 unidades; a 24 px ele vira um ponto de cerca de 2 px e some.

Problemas concretos (FATO, medidos ou lidos):
1. **Nome pequeno demais no cabeçalho.** Com a logo de 28 px, o nome tem 7 px de letra. É pouco para quem lê no sol ou com vista cansada. Os dois textos "Mercado" e "da Região" empilhados encolhem as duas linhas juntas.
2. **Símbolo domina, nome sobra.** O M com pin ocupa a altura toda; o nome ocupa o lado. A proporção parece boa no papel e fraca em 28 px.
3. **"da Região" em laranja sobre branco (2,87:1).** O nome perde força justamente na parte que diz "da região".
4. **Versão de uma linha é mais legível** no mesmo espaço (9,3 px contra 7,1 px de letra), mas fica mais larga (153 px a 24 px de altura). Cabe no celular, mas ocupa a barra.
5. **Pin some em 24 px** (círculo de 2 px). Em tamanho pequeno, o símbolo perde o detalhe que o diferencia.
6. **Cor do pin** (`#FF6A13`) sobre cabeçalho branco tem 2,87:1. Como parte do logo, é aceitável, mas com o nome também laranja, o conjunto fica claro demais.

O que alternativas de nome escrito deveriam resolver (proposta para teste, não medida em pessoas):
- Nome em uma linha, com letra de pelo menos 9 px de altura de caixa alta em 24 px de logo (versão `linha` já chega perto).
- Nome de uma palavra só em destaque ("Mercado") com "da Região" menor, se o nome completo não couber em 24 px.
- Versão só com símbolo + "Mercado da Região" em caixa de 13 px ao lado, no cabeçalho do celular.
- Contraste do nome com cor escura (beringela ou texto) e o laranja só no pin.

Tamanho mínimo: MARCA.md:43 e DESIGN.md:300 dizem 24 px. Pelos números acima, 24 px é pouco para o nome. Sugerir 32 px no cabeçalho do celular (`marca`) ou usar `linha` a 24 px.

---

## 5. Tipografia em uso (medida no celular, Início e busca; computador, Início)

Celular (375 px), Início, medido por computed style:

| Elemento | Tamanho | Peso | Altura de linha | Comentário |
|---|---|---|---|---|
| Texto corrido (corpo) | 13 px | 400 | 19,5 px | Abaixo dos 16 px de USABILIDADE.md:36. |
| Título de seção (h1 "Anúncios em Corrente e região") | 15 px | 600 | 20,25 px | Bom. |
| Título de bloco (h2 "Mais recentes…") | 14 px | 600 | 20,3 px | Bom. |
| Título em caixa alta ("LOJAS DESTAQUE DA REGIÃO") | 12 px | 600 | 17,4 px | Caixa alta em 12 px é difícil de ler. |
| Botões ("Começar", "Buscar", "Anunciar agora") | 12 px | 600 | 20 px | Pequeno para o botão principal. |
| Rótulo do card "Estou procurando…" | 12 px | 700 | 16 px | Altura de linha apertada (16 px para duas linhas). |
| Texto do card "Não achou o que queria?" | 11 px | 400 | 16 px | Pequeno, branco sobre beringela (14,2:1, passa). |
| Nome da loja no bloco de lojas | 11 px | 500 | 16 px | Pequeno. |
| Itens da barra de baixo | 11 px ou 12 px (depende da página) | 600 | 16 px | Ícone 20 px. |

Computador (1024 px), Início, medido:
- Corpo e títulos de categoria: 15 px. Botões: 12 px. Título "Anunciar" no cabeçalho: 13 px, peso 700. Cabeçalho 56 px, logo 32 px.

Lido no código (sem anúncio no ar, não medido no site):
- card-anuncio.tsx:73 → **preço em 11 px** no celular (`text-xs`), peso 600 (o guia pede 700).
- card-anuncio.tsx:65 → **título em 12 px** no celular (`text-sm`); compacto: 13 px.
- card-anuncio.tsx:78 → metadados (cidade, data) em 11 px (compacto).
- card-anuncio.tsx:65, 73, 78 → tamanhos escritos à mão (`text-[16px]`, `max-md:text-[11px]`), contra a regra da régua (DESIGN.md:233).
- conteudo-anuncio.tsx:129 → preço da página do anúncio em 16 px, peso 700 (guia pede 18 px).

Onde fica pequeno demais (conclusão):
- Preço, a informação que mais decide a compra, sai com 11 px no card. Isso é o problema mais sério desta seção.
- Legenda e metadado em 11 px em todo o site.
- Botões em 12 px com 40 px de altura.

Sobre a fonte (INFERÊNCIA, não testada):
- Poppins é larga e geométrica. Em 11 a 13 px ela ocupa espaço e pode ficar cansativa. Para testar com o time, existem fontes gratuitas no Google Fonts pensadas para leitura: Atkinson Hyperlegible (feita para baixa visão), Nunito Sans e Source Sans 3. Antes de trocar, medir com o teste de corredor.

---

## 6. Sinais de confiança e conversão

- **Selo de verificado.** No card, só ícone de escudo no celular, sem palavra (card-anuncio.tsx:92, `md:hidden`; sr-only em :104). O guia pede selo com nome (DESIGN.md:191, USABILIDADE.md:58). Na loja medida não há selo nenhum.
- **WhatsApp.** Bem colocado: botão verde largo e "Chamar no WhatsApp" no topo da loja (FATO). Problema: em uma tela aparecem três chamadas de WhatsApp ao mesmo tempo (topo, vazio, barra fixa). O guia quer um caminho claro: "do anúncio ao WhatsApp em poucos toques" (PRODUCT.md:68).
- **Preço.** Presente no código, mas em 11 px no card. Não há "a combinar" visto no site porque não há anúncio (não medido).
- **Cidade.** Aparece no seletor do cabeçalho ("Corrente") e na loja ("Nova Corrente, Corrente"). Bom. No card, em 11 px.
- **Loja.** "No Mercado da Região desde novembro de 2026" (FATO). Bom sinal de tempo de casa, mas sem foto nem logo a loja parece vazia.
- **Patrocinado.** Selo "Patrocinado" com beringela sobre patrocinado-fundo (11,67:1), escrito. Bom. No celular compacto o selo some e aparece como texto pequeno na linha da cidade (card-anuncio.tsx:60 e :91). Confirmar no site com anúncio pago.
- **Hierarquia do primeiro olhar.** O card laranja "Anunciar" é grande e forte, e está certo. O que compete com ele é o card beringela e o botão de busca laranja (dois laranjas e um beringela sólidos no mesmo ponto).

---

## 7. Lista priorizada (o que o design system precisa decidir ou corrigir)

Ordem por impacto na compra e no entendimento. Cada item tem evidência.

1. **Preço e título do card de anúncio.** Preço em 11 px, título em 12 px (card-anuncio.tsx:65, 73). Subir o preço para 15 a 16 px em peso 700, e o título para 14 px (regra do DESIGN.md:223 e :225). Evidência: seção 5.
2. **Escala de texto única.** Corpo 13 px (site, DESIGN.md) contra 15 px e 14 px (DESIGN-SYSTEM.md:80, :102) e 16 px (USABILIDADE.md:36). Escolher uma escala (com o piso de legenda) e apagar os números antigos dos três documentos. Evidência: tabela 2.1.
3. **Alvo de toque.** 40 px no site, 44 px (DESIGN-SYSTEM.md:158), 48 px (USABILIDADE.md:39). Decidir 44 px como piso e aplicar aos botões. Evidência: medição de 10 elementos abaixo de 44 px, todos botões de 40 px.
4. **Nome da marca no cabeçalho.** Com 7 px de letra a 28 px de logo, o nome é pequeno. Testar versão `linha` a 24 px (9,3 px de letra) e marca a 32 px. Decidir nome escrito com as alternativas da seção 4.
5. **Laranja-escuro sobre lavanda (4,39:1).** Trocar `#C2410C` por `#B84010` (4,71:1). Evidência: seção 3.1, proposta A.
6. **"da Região" laranja no logo (2,87:1).** Decidir B1 (manter, aceitar tamanho maior) ou B2 (texto em `#C2410C`). Evidência: seção 3.1 e 3.2.
7. **Um botão laranja por tela.** Início tem busca laranja e card "Anunciar" laranja, mais "Começar" verde. Decidir qual é o principal. Evidência: seção 2.2, DESIGN.md:209.
8. **Selo de verificado com palavra.** Trocar o ícone solo do card compacto (card-anuncio.tsx:92) por ícone + "Loja verificada". Evidência: seção 6, DESIGN.md:191.
9. **Loja com cara de vazio.** Logo branca e capa cinza. Criar fallback com a inicial da loja em beringela e capa com a cor da marca, para o site não parecer abandonado. Evidência: página da loja (FATO).
10. **Três chamadas de WhatsApp na loja.** Decidir uma chamada fixa (barra de baixo) e uma no conteúdo. Evidência: seção 6.
11. **Chip selecionado: borda beringela ou laranja-escuro.** Escolher uma regra e atualizar DESIGN.md:280 ou DESIGN-SYSTEM.md:184. Evidência: seção 2.1.
12. **Fonte.** Poppins é a atual, mas o teste de corredor (5 pessoas, USABILIDADE.md) deve comparar com 1 ou 2 fontes gratuitas (Atkinson Hyperlegible, Nunito Sans) em 13 e 16 px, antes de trocar. Evidência: seção 5 (inferência).

Itens menores que entram nos acima: tamanhos escritos à mão no código (card-anuncio.tsx:65, 73, 78; contra DESIGN.md:233); altura do cabeçalho (48 px no site, 52 px no documento); botão "Merc" de 92 × 40 px no computador parece cobrir o link "Privacidade" no rodapé (1024 px, FATO visual, a confirmar).

---

## Apêndice: o que foi visto (URLs e telas)

- https://mercadodaregiao.com.br/ (Início, celular 375 px e computador 1024 px)
- https://mercadodaregiao.com.br/busca?q=moto (resultado vazio, "Pedir no Radar" laranja, "Perguntar ao Merc" secundário)
- https://mercadodaregiao.com.br/busca (vazio)
- https://mercadodaregiao.com.br/c/veiculos (categoria vazia, chip "Tudo" selecionado)
- https://mercadodaregiao.com.br/categorias (lista de categorias com "Subcategorias")
- https://mercadodaregiao.com.br/loja/igreja-filadelfia-corrente (loja com 0 anúncios; 3 botões de WhatsApp)
- Página de anúncio: não aberta (nenhum anúncio no ar). Lida no código: conteudo-anuncio.tsx.
- Logos: public/logo/*.svg (todos, lidos pelo código e pelas medidas do viewBox)
