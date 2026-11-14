# Auditoria de concorrentes: interface e visual (celular)

Data da medição: 14/11/2026. Escopo: só interface e visual. Sem login, sem conta, sem formulário enviado, sem cookies aceitos (o banner da OLX e o do Mercado Livre ficaram na tela).

Legenda usada no texto:
- **[FATO]**: visto ou medido na página, com a URL.
- **[INFERÊNCIA]**: conclusão minha a partir dos fatos. Pode estar errada.
- **[FONTE SECUNDÁRIA]**: veio de artigo, norma ou documento público, não da página em si.
- **[NÃO MEDIDO]**: não consegui medir ou não olhei. Não chutei número.

## 0. Como foi medido

- Navegador de teste (Playwright) com a largura de celular pedida (375 px). Em várias páginas o navegador reportou largura útil de 360 px. Por isso os números abaixo valem para celular de 360 a 375 px.
- Tamanhos de letra e de área de toque foram lidos por `getComputedStyle` e `getBoundingClientRect` em cada página. Só conta o que está visível.
- Contagem de "áreas de toque abaixo de 44 px" é automática. Inclui links de texto, que o padrão WCAG deixa de fora. Use como sinal, não como prova.
- Desktop: [NÃO MEDIDO]. Foi prioridade o celular.
- Fluxo de anunciar, vitrine/loja dos concorrentes e estados de carregamento: [NÃO MEDIDO].
- Um anúncio por site. Amostra pequena. Não é um estudo estatístico.

## 1. Mercado da Região (referência do projeto)

Páginas: https://mercadodaregiao.com.br/ e https://mercadodaregiao.com.br/c/celulares-e-telefonia

- [FATO] Fonte: Poppins. Corpo de texto em 13 px, peso 400, altura de linha 19,5 px. Cor do texto `rgb(52,43,59)`. Fundo `rgb(247,248,250)`.
- [FATO] Tamanhos de letra encontrados na home: 13 px (139 elementos), 12 px (46), 15 px (27), 11 px (5), 14 px (1).
- [FATO] Títulos de seção: "Anúncios em Corrente e região" 15 px / 600, cor beringela `rgb(75,18,72)`. "LOJAS DESTAQUE DA REGIÃO" 12 px / 600 em caixa alta. "Categorias" 11 px / 600.
- [FATO] Barra inferior fixa de 56 px com 5 itens: Início | Buscar | Anunciar | Radar | Conta.
- [FATO] Cabeçalho com logo (imagem de 76 x 28 px) e busca "O que você procura?" com botão "Buscar" de 66 x 48 px.
- [FATO] Chips de categoria com 48 px de altura (Todas, Veículos, Imóveis). Seletor de cidade "Corrente" com 48 px.
- [FATO] Botões "Começar", "Agora não", "Ver todas" e "Anunciar agora" com 40 px de altura. Links do rodapé com 40 px.
- [FATO] Na home, 10 áreas de toque estão abaixo de 44 px (os botões de 40 px e os links do rodapé).
- [FATO] Sem rolagem lateral: `scrollWidth` igual a `clientWidth` (360).
- [FATO] `meta viewport` = `width=device-width, initial-scale=1`. Zoom não é bloqueado.
- [FATO] Estado vazio na home: "Nenhum anúncio em Corrente e região" e "Seu anúncio pode ser o primeiro" (13 px / 600, beringela). Na categoria: "Nenhum resultado para 'Celulares e telefonia'" com texto sugerindo o Radar.
- [FATO] Console da home: 0 erros e 1 aviso.
- [NÃO MEDIDO] Card de anúncio e página do anúncio: o site não tinha anúncio no ar na hora da medição. A anatomia do card abaixo vem do DESIGN.md, não de medição.
- [FATO DO DESIGN.md, não medido] Card: foto 4:3, preço 16 px, título 14 px em até 2 linhas, metadados 13 px, duas colunas no celular. Controles: 40 px no toque, com `tamanho="toque"` disponível em 44 px. Campos em 13 px, e 16 px só no iPhone.

## 2. OLX Brasil

Páginas: https://www.olx.com.br/ , https://www.olx.com.br/celulares e um anúncio em https://df.olx.com.br/distrito-federal-e-regiao/celulares/s24-ultra-preto-256gb-1552955379

- [FATO] Fonte: Roboto. Corpo de 16 px, peso 400, altura de linha 24 px. Texto `rgb(26,29,35)` sobre fundo branco.
- [FATO] Tamanhos de letra na home: 12 px (290 elementos), 16 px (265), 18 px (199), 14 px (73), 24 px (3), 32 px (1).
- [FATO] Listagem /celulares em 360 px: um anúncio por linha, em formato de lista horizontal. Card de 328 x 200 px. Foto de 124 x 170 px à esquerda.
- [FATO] Dentro do card, de cima para baixo: título em 18 px / 600 (1 ou 2 linhas), preço em 18 px / 600 (ex.: "R$ 6.450"), uma linha de condição ("Frete grátis", "Até 10x sem juros"), local ("Boa Vista, Liberdade") e data ("Hoje, 20:22"). Botão de favorito. Botão "Enviar mensagem" em alguns cards.
- [FATO] Preço e título têm o mesmo tamanho e peso. O preço não é maior que o título.
- [FATO] Barra inferior fixa de 60 px: Início | Buscar | Anunciar | Chat | Menu.
- [FATO] Anúncio (S24 Ultra): título em 20 px / 600. Galeria de 375 x 375 px (quadrada).
- [FATO] Botão "Chat" fixo no rodapé do anúncio, 48 px de altura, 343 px de largura (quase largura total).
- [FATO] Banner de cookies ocupa 276 px na parte de baixo. Não aceitei nem recusei.
- [FATO] Medição de toque na home: 358 áreas, 222 abaixo de 44 px (conta automática; inclui links de texto e itens escondidos).
- [FATO] Tamanhos de toque visíveis: ícones de cabeçalho 48 x 48 px; campo de busca 48 px; linhas de menu 52 px; itens da barra inferior 44 x 59 px.
- [FATO] Cores: fundo branco, cinzas `rgb(245,246,247)`. Roxo `rgb(110,10,214)` e laranja `rgb(242,128,0)` aparecem em poucos elementos. Não confirmei qual é a cor de ação principal.
- [FATO] Preço e local no card e a data "Hoje, 20:22" aparecem em texto de apoio, dentro do próprio card.
- [NÃO MEDIDO] Preço no anúncio, vendedor, vitrine/loja, fluxo de anunciar, estados de carregamento e vazio.

## 3. Mercado Livre

Páginas: https://www.mercadolivre.com.br/ , https://lista.mercadolivre.com.br/celular e um produto em https://produto.mercadolivre.com.br/MLB-5529921045

- [FATO] Fonte: "Proxima Nova" (com Arial como reserva). Corpo de 14 px, peso 400, texto preto.
- [FATO] Tamanhos de letra na home: 14 px (259 elementos), 12 px (103), 20 px (19), 11 px (7), 16 px (13), 18 px (6), 22 px (2), 28 px (1). Alguns valores fracionados (ex.: 18,72 px) aparecem nos cards.
- [FATO] Cabeçalho amarelo `rgb(255,241,89)`, 48 px de altura.
- [FATO] Cor de ação: azul `rgb(52,131,250)`, usado no botão "Perguntar" do produto (328 x 48 px). Verde `rgb(0,166,80)` aparece em poucos elementos.
- [FATO] `meta viewport` = `width=device-width, initial-scale=1.0, maximum-scale=5.0`. O zoom é limitado a 5 vezes.
- [FATO] Listagem /celular: card de 240 px de largura, foto quadrada de 240 x 240 px, card com 467 px de altura. Título em 18,72 px / 400, em até 2 linhas.
- [FATO] Na listagem, a página mediu `scrollWidth` 920 com `clientWidth` 360, ou seja, rolagem lateral naquele momento. A causa não investiguei.
- [FATO] Barra inferior fixa: não encontrei no celular (só o banner de cookies fixo, de 102 px).
- [FATO] Produto: título em 16 px / 400, cor preto a 90%. Preço em 16 px (leitura parcial, o seletor pode ter pegado outro elemento). Galeria de 360 x 319 px (não quadrada).
- [FATO] Botão "Perguntar" de 328 x 48 px, no fluxo da página (não fixo no rodapé).
- [FATO] Medição de toque na listagem: 164 áreas, 118 abaixo de 44 px (muitos são links de texto de 17 px de altura).
- [NÃO MEDIDO] Vendedor, selos de confiança (não achei pelo seletor), vitrine/loja, fluxo de anunciar, estados de carregamento e vazio.
- [FONTE SECUNDÁRIA] O design system público do Mercado Livre se chama Andes. Não achei na busca os tokens de fonte (tamanhos e pesos). Um guia de terceiros cita o Andes no Figma, sem valores. Não confirmei o uso de Proxima Nova no Andes.

## 4. Facebook Marketplace

Página: https://www.facebook.com/marketplace/

- [FATO] A página pública abre sem login, mas mostra só uma prévia. Botão "Entrar" no topo. Conteúdo localizado em dólar e cidades dos EUA (San Francisco), não do Brasil.
- [FATO] Fonte: Helvetica, 12 px no corpo. Fundo `rgb(242,244,247)`.
- [NÃO MEDIDO] Card, anúncio, anunciar e navegação inferior, porque o conteúdo completo exige login. Não tentei contornar.
- [FONTE SECUNDÁRIA] Pratt Institute, crítica de design do app iOS (2026): https://ixd.prattsi.org/2026/09/design-critique-facebook-marketplace-ios-app-2/ . Só li o começo do texto. Trata da busca e da navegação do comprador.
- [FONTE SECUNDÁRIA] Reportagem sobre mudança de busca para grade mais visual: https://en.ammonnews.net/print.php?id=87341 (notícia, sem medida).
- [FONTE SECUNDÁRIA] Guia de UX de marketplace (Rigby): https://rigbyjs.com/blog/marketplace-ux . Diz que a rolagem infinita reduz cliques, mas dificulta voltar ao ponto em que a pessoa estava e comparar itens.

## 5. Tabela comparativa lado a lado (celular)

| Item | OLX | Mercado Livre | Mercado da Região |
|---|---|---|---|
| Fonte | Roboto | Proxima Nova (Arial reserva) | Poppins |
| Corpo base | 16 px | 14 px | 13 px |
| Legenda mais comum | 12 px | 12 px | 13 px (12 px também) |
| Menor texto usado | 12 px (contagem alta) | 8 a 9 px (poucos casos) | 11 px (5 casos) |
| Título do card | 18 px / 600, até 2 linhas | 18,72 px / 400, até 2 linhas | 14 px / 600 (spec, não medido) |
| Preço no card | 18 px / 600, igual ao título | não medido com segurança | 16 px / 700 (spec, não medido) |
| Card na listagem | 1 por linha, horizontal (328 x 200) | cards de 240 px, foto quadrada | 2 colunas no celular (spec) |
| Foto do card | 124 x 170 (retrato) | 240 x 240 (quadrada) | 4:3 (spec) |
| Local e data no card | sim, em texto de apoio | não medido | spec: metadados 13 px |
| Barra inferior | 60 px, 5 itens (Início, Buscar, Anunciar, Chat, Menu) | não há no celular (medido) | 56 px, 5 itens (Início, Buscar, Anunciar, Radar, Conta) |
| Botão de contato | "Chat" fixo no rodapé do anúncio, 48 px | "Perguntar" no fluxo, 48 px, não fixo | WhatsApp (não medido na prática) |
| Cor de ação | roxo (pouco uso medido) | azul #3483FA | laranja, texto beringela |
| Cor de marca | roxo / laranja | amarelo #FFF159 no cabeçalho | beringela #4B1248 |
| Fundo da página | branco, cinzas #F5F6F7 | branco | cinza frio #F7F8FA |
| Área de toque mais comum | 48 px (ícones, busca) | 48 px (ícones, botão) | 40 px (botões), 48 px (chips) |
| Áreas abaixo de 44 px (automático) | 222 de 358 | 118 de 164 | 10 de 24 |
| Rolagem lateral | não (360) | sim (920) na listagem | não (360) |
| Zoom | liberado | limitado a 5x | liberado |
| Banner de cookies | sim, 276 px no rodapé | sim, 102 px no rodapé | não visto |
| Estado vazio | não medido | não medido | sim, texto e ajuda para anunciar |
| Desktop | não medido | não medido | não medido |

## 6. A. Resumo da tabela

Os três concorrentes têm uma base comum: busca no topo, categorias, cards com foto, preço e título, e um botão principal forte. O Mercado da Região segue o mesmo caminho, com um desvio importante: a letra e os botões são menores que os dos líderes.

## 7. B. Padrões que os três compartilham (Lei de Jakob)

Estes são os padrões que o usuário já conhece. Vale copiar.

1. **Foto primeiro, depois preço e título no card.** [FATO] Os três mostram isso. [INFERÊNCIA] A pessoa escaneia a foto antes de ler.
2. **Busca no topo da página inicial.** [FATO] OLX, ML e MdR têm campo de busca logo abaixo do cabeçalho.
3. **Barra inferior com "Anunciar" no meio.** [FATO] OLX e MdR têm "Anunciar" no terceiro dos cinco itens, com "Início" na primeira posição e "Buscar" na segunda. [INFERÊNCIA] É a ordem que o usuário já espera.
4. **Ação de contato em destaque na página do anúncio.** [FATO] OLX fixa o botão "Chat" no rodapé. ML põe "Perguntar" logo abaixo da galeria. MdR usa WhatsApp.
5. **Botões principais de 48 px nos líderes.** [FATO] OLX e ML usam 48 px para ícones e ações principais.
6. **Local e data no card.** [FATO] OLX mostra. [INFERÊNCIA] Ajuda a pessoa a decidir se vale a pena falar com o vendedor.
7. **Cards em lista ou grade com o mesmo ritmo (foto, preço, título).** [FATO] Cada um escolheu uma variante, mas a ordem é a mesma.

## 8. C. Onde um site regional para público do interior, celular simples e internet fraca deve FAZER DIFERENTE

[INFERÊNCIA] Esta seção é minha opinião a partir dos dados. Não há medida de público do interior nesta pesquisa.

1. **Não diminuir a letra abaixo do que os líderes usam.** O Mercado da Região usa 13 px de corpo. OLX usa 16 px e ML 14 px. Para celular simples e pessoas que usam letra grande, 13 px é o menor da turma. Eu subiria o corpo para pelo menos 14 px.
2. **Botões de toque de 44 px no mínimo, 48 px no que é principal.** O MdR tem 40 px de botão. O padrão WCAG AAA é 44 px. Os líderes usam 48 px nos ícones. Por isso a briga "16/48 contra 13/40" tem resposta: o 40 px fica abaixo dos dois líderes e do WCAG.
3. **Contato por WhatsApp, não por chat interno.** OLX e ML têm chat dentro do app. O MdR depende de WhatsApp, que o usuário já tem no celular. Isso é diferença de propósito, não de estilo. Garantir que o botão de WhatsApp fique visível sem rolar.
4. **Cabeçalho e barra sólidos, sem desfoque como padrão.** O DESIGN.md usa vidro (desfoque sobre 74% de cartão). Os líderes medidos usam fundo sólido (branco ou amarelo). [INFERÊNCIA] Desfoque custa processamento em celular de entrada. Trocar por fundo sólido como padrão e deixar o vidro como detalhe.
5. **Pouco banner e pouca sobreposição.** OLX e ML têm banner de cookies de 100 a 276 px no rodapé. Num celular pequeno e com internet fraca, isso come a tela. O MdR não mostrou banner. Manter assim, ou usar um aviso curto.
6. **Foto mais leve.** [NÃO MEDIDO] Não medi peso de imagem nem tempo de carregamento. [INFERÊNCIA] Foto redimensionada e com carregamento preguiçoso é mais importante aqui do que nos líderes, que têm equipe de infraestrutura maior.
7. **Paginação em vez de rolagem infinita.** [FONTE SECUNDÁRIA] Rigby diz que rolagem infinita dificulta voltar ao ponto. [INFERÊNCIA] Para quem quer comparar e voltar no sinal fraco, páginas com botão "ver mais" são mais previsíveis.
8. **Estado vazio com ação.** O MdR já faz bem: "Nenhum anúncio... Seu anúncio pode ser o primeiro". Os líderes não medidos. Manter.
9. **Zoom liberado.** MdR não bloqueia zoom. ML limita a 5x. Manter liberado, porque o público pode usar letra grande.

## 9. D. Tamanho mínimo de letra e de área de toque (números medidos e de referência)

### Dados medidos nas páginas

| Medida | OLX | ML | MdR | Fonte |
|---|---|---|---|---|
| Corpo base | 16 px | 14 px | 13 px | getComputedStyle no body |
| Legenda mais comum | 12 px | 12 px | 12 e 13 px | contagem de elementos com texto |
| Menor texto | 12 px | 8 a 9 px (poucos) | 11 px (5) | contagem de elementos |
| Botão de ação principal | 48 px | 48 px | 40 px | getBoundingClientRect |
| Ícones de cabeçalho | 48 x 48 | 48 x 48 | não medido | getBoundingClientRect |
| Barra inferior | 60 px | não há | 56 px | getBoundingClientRect |

### Referências públicas (fonte secundária, checadas)

- [FONTE SECUNDÁRIA, verificada] **WCAG 2.5.5 (AAA):** área de toque de pelo menos 44 x 44 px CSS. Página: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
- [FONTE SECUNDÁRIA, verificada] **WCAG 2.5.8 (AA, versão 2.2):** pelo menos 24 x 24 px CSS, ou espaçamento de 24 px. Página: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- [FONTE SECUNDÁRIA, verificada] **Android (Google):** toque de pelo menos 48 dp para toque. Página: https://developer.android.com/guide/topics/ui/accessibility/apps . A mesma página diz que texto menor que 18 sp precisa de contraste de 4,5:1.
- [FONTE SECUNDÁRIA, NÃO CONFIRMADA] **Apple HIG:** 44 pt de toque mínimo e 17 pt de texto padrão. A página da Apple abriu só com o título. Os números vêm do meu conhecimento e não foram confirmados. Não usar como base sem conferir.

### Conclusão para a briga 16 px/48 px contra 13 px/40 px

- [FATO] Os dois líderes medidos usam 48 px nos controles principais. Nenhum deles usa 40 px como padrão.
- [FATO] O corpo do OLX é 16 px e o do ML é 14 px. Nenhum dos dois usa 13 px.
- [FATO] WCAG AAA pede 44 px. Android pede 48 dp.
- [INFERÊNCIA] Recomendo: toque mínimo de 44 px em tudo que é tocável, 48 px no que é principal e na barra inferior. Corpo de 14 px no mínimo, 16 px onde couber. Legenda de 12 px como piso. Nada abaixo de 12 px para informação útil.
- [INFERÊNCIA] Isso não é um "vence um lado". Os líderes usam 48 px nos controles, mas o texto de corpo do ML está em 14 px. Escolha equilibrada: 16 px para texto principal, 14 px para texto de apoio, 12 px para legenda, 44 px ou 48 px para toque.

## 10. E. Dez recomendações concretas para o design system

Cada item tem a evidência. Ordem por prioridade.

1. **Área de toque mínima de 44 px em todo elemento tocável.** Evidência: WCAG 2.5.5 AAA (verificado). O MdR tem 10 áreas abaixo de 44 px só na home (botões de 40 px). Ação: subir `Botao` padrão de 40 px para 44 px no celular, ou usar `tamanho="toque"` como padrão no mobile.
2. **48 px para ação principal, ícones e itens da barra inferior.** Evidência: OLX e ML medidos com 48 px; Android pede 48 dp (verificado). Ação: "Anunciar", "Chat" e ícones de cabeçalho em 48 px.
3. **Texto de corpo base de 14 px, 16 px no texto principal de detalhe.** Evidência: OLX 16 px e ML 14 px (medidos). O MdR usa 13 px, o menor dos três. Ação: subir o corpo para 14 px e o título do anúncio para 18 a 20 px.
4. **Piso de 12 px para texto útil.** Evidência: os três usam 12 px como legenda comum; MdR tem 5 textos de 11 px. Ação: legenda (cidade, data) em 12 px; nada abaixo disso.
5. **Barra inferior de 56 a 60 px, 5 itens, "Anunciar" no centro.** Evidência: OLX (60 px) e MdR (56 px) usam a mesma ordem medida. Ação: manter o MdR nessa forma. O item "Radar" pode ficar no lugar de "Chat" sem quebrar a convenção.
6. **Botão de contato fixo no rodapé da página do anúncio.** Evidência: OLX fixa "Chat" com 48 px e largura quase total (medido). ML não fixa (medido). Ação: "Chamar no WhatsApp" fixo no rodapé do anúncio, 48 px, acima da barra inferior.
7. **Card com foto, preço, título (até 2 linhas), cidade e data.** Evidência: OLX mostra todos nessa ordem (medido). Ação: manter a ordem e deixar cidade e data em 12 px.
8. **Preço forte, mas não gigante.** Evidência: OLX usa o mesmo tamanho para preço e título (18 px / 600). ML usa 18,72 px no título. Ação: preço em peso 700 e mesmo tamanho do título, sem passar de 18 px no card. (Isso corrige a ideia de preço em 16 px pequeno.)
9. **Foto do anúncio quadrada (1:1) na página, 4:3 no card, como alternativa a testar.** Evidência: ML (240 x 240) e OLX (375 x 375) usam quadrada no anúncio (medido). O DESIGN.md diz 4:3 no card. Ação: decidir com teste de tela. [INFERÊNCIA] Quadrada ocupa a largura inteira sem cortar o produto.
10. **Cabeçalho sólido, banner de cookies curto, zoom liberado.** Evidência: ML e OLX usam fundo sólido (medido). OLX e ML têm banner de 102 a 276 px (medido). MdR não bloqueia zoom (medido). Ação: fundo sólido como padrão e vidro só como detalhe; banner curto; zoom liberado (já está no MdR).

## 11. Limites e pendências

- Desktop não medido em nenhum site.
- Facebook Marketplace: sem medida de card, anúncio e navegação, porque exige login. Não tentei contornar.
- Vitrine/loja, fluxo de anunciar, selos de confiança, estados de carregamento: não medido nos concorrentes.
- Design system da OLX: encontrei o nome "Nexus" em um artigo do Medium (https://medium.com/olx-group-careers/nexus-design-system-what-why-and-how-1cddac9b6cef). A busca só trouxe o título, não o conteúdo. Não li a lista de componentes.
- Andes (ML): não achei tokens de fonte nem de cor pela busca.
- Anúncio do MdR: não medido, porque não havia anúncio no ar.
- Não medi peso de imagens nem tempo de carregamento de nenhum site.
- Pedido ao dono: se quiser, eu meço o MdR com um anúncio de teste no ar (sem alterar nada), ou um segundo anúncio dos concorrentes para checar o card.

## 12. Fontes usadas

- https://mercadodaregiao.com.br/ (home)
- https://mercadodaregiao.com.br/c/celulares-e-telefonia (categoria vazia)
- https://www.olx.com.br/ (home)
- https://www.olx.com.br/celulares (listagem)
- https://df.olx.com.br/distrito-federal-e-regiao/celulares/s24-ultra-preto-256gb-1552955379 (anúncio)
- https://www.mercadolivre.com.br/ (home)
- https://lista.mercadolivre.com.br/celular (listagem)
- https://www.mercadolivre.com.br/celular-tcl-p80-256gb-50mp-816gb-ram-683-amoled-15k-120hz-octa-core-5g-5000-mah-dourado/p/MLB81615480 (produto)
- https://www.facebook.com/marketplace/ (página pública com login)
- https://www.w3.org/WAI/WCAG21/Understanding/target-size.html (verificado)
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (verificado)
- https://developer.android.com/guide/topics/ui/accessibility/apps (verificado)
- https://developer.apple.com/design/human-interface-guidelines/layout (só o título abriu; não confirmado)
- https://ixd.prattsi.org/2026/09/design-critique-facebook-marketplace-ios-app-2/ (fonte secundária, só início lido)
- https://rigbyjs.com/blog/marketplace-ux (fonte secundária)
- Arquivos do projeto lidos: `DESIGN.md` e `docs/DESIGN-SYSTEM.md` (pasta do worktree design-system).
