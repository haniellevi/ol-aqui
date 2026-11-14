# Mercado da Região · Auditoria de público-alvo para decisões de interface

Data da pesquisa: 14/11/2026. Escopo: somente leitura do projeto e fontes públicas. Nenhum código foi alterado.

## Antes de ler: o que não existe

- **Não há pesquisa com usuários reais** (nenhuma entrevista, teste de uso ou questionário com moradores de Corrente ou Formosa do Rio Preto).
- **Não há números de uso do site** (visitas, cadastros, anúncios, tempo de tela, abandono). O piloto ainda não começou.
- **Não há depoimentos nem casos.** `docs/MARCA.md` confirma isso.
- O teste da "dona Maria" e o teste de corredor com 5 pessoas (`docs/USABILIDADE.md`) são planos, não resultados.

Por isso, quase tudo abaixo vem de dado público nacional ou estadual. Quando o dado é de Corrente ou Formosa, isso está dito.

Legenda: **[FATO]** tem fonte e URL. **[INFERÊNCIA]** é raciocínio meu a partir dos fatos. **[LACUNA]** não achei dado confiável.

---

## 1. Quem é esse público (em fatos)

### População e idade

- **Formosa do Rio Preto (BA): 25.899 habitantes (Censo 2022).** [FATO] Fonte: IBGE, página da cidade, https://www.ibge.gov.br/cidades-e-estados/ba/formosa-do-rio-preto.html (número confirmado em busca; a página em si não foi aberta).
- **Corrente (PI): 27.278 habitantes (Censo 2022), segundo site terceiro.** [FATO com ressalva] Fonte: Ceps Brasil, https://cepsbrasil.com.br/pi/corrente/ibge. A página do IBGE (https://www.ibge.gov.br/cidades-e-estados/pi/corrente.html) deu erro 403 ao ser lida. **Confirmar no IBGE antes de usar em material.**
- **Idade de Corrente e Formosa: [LACUNA].** Nenhuma fonte achada traz pirâmide etária ou idade mediana dos dois municípios. A tabela oficial está em https://biblioteca.ibge.gov.br/visualizacao/periodicos/3102/cd_2022_populacao_idade_sexo_pi.pdf (tabela estadual, não municipal).
- **Piauí (nível estadual):** população 3.271.199 (Censo 2022); 65 anos ou mais: 10,7%; 0 a 14 anos: 20,8% (em 2010 eram 26,6%). [FATO] Fonte: IBGE, mesma tabela estadual acima (valores lidos em resumo de busca).
- **Leitura para o projeto:** o público de 50+ é grande o bastante para pesar nas decisões de tamanho. [INFERÊNCIA] Não dá para dizer quantos são em Corrente.

### Escolaridade

- **Analfabetismo no Brasil (15 anos ou mais), Censo 2022: 7,0%.** [FATO] Fonte: IBGE, https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-denoticias/40098-censo-2022-taxa-de-analfabetismo-cai-de-9-6-para-7-0-em-12-anos-mas-desifualdades-persistem
- **Piauí tem a maior taxa entre os estados, segundo reportagem sobre o Censo 2022.** [FATO com ressalva] Fonte: Correio Braziliense, mai/2024, https://www.correiobraziliense.com.br/brasil/2024/05/6859463-ibge-piaui-e-o-estado-com-maior-taxa-de-analfabetismo-entre-maiores-de-15-anos.html. O percentual exato do Piauí não foi confirmado.
- **Analfabetismo nacional em 2024: 5,3%; em 2025: 4,9%.** [FATO] Fonte: PNAD Contínua Educação, via notícias de busca (não abri o relatório). Nordeste: 11% em 2024 e 10,6% em 2025.
- **Escolaridade e renda de Corrente e Formosa: [LACUNA].** Não achei dado municipal.
- **Leitura para o projeto:** [INFERÊNCIA] Os dados de analfabetismo indicam que parte do público lê devagar ou pouco. Isso bate com o que `docs/USABILIDADE.md` já diz, mas não há número que prove o tamanho do grupo.

### Renda

- **Renda média de Corrente e Formosa: [LACUNA].**
- **Classes DE (renda mais baixa): 86% dos usuários de internet acessam só pelo celular.** [FATO] Fonte: TIC Domicílios 2024, Cetic.br, resumo de notícia (MobileTime), https://www.mobiletime.com.br/?p=807296. Número não conferido no PDF original.

### Acesso à internet e tipo de conexão

Fonte principal: **TIC Domicílios 2024, Cetic.br** (dados de 2024, publicados em 2025).

| Recorte | Só celular (% dos usuários de internet) | Fonte |
|---|---|---|
| Brasil | 60% | Resumo executivo, https://cetic.br/media/docs/publicacoes/2/20250512115624/tic_domicilios_2024_resumo_executivo.pdf (lido em busca) |
| Área urbana | 57% | Tabela C16A, https://cetic.br/en/tics/domicilios/2024/individuos/C16A/ (lida) |
| Área rural | 82% | Mesma tabela |
| Nordeste | 75% | Mesma tabela |

- **[FATO]** A tabela C16A foi lida. A ligação dos números às linhas foi inferida pela ordem dos cabeçalhos, porque a página não traz a tabela com alinhamento claro. Vale conferir no PDF.
- **[INFERÊNCIA]** No recorte do público (zona rural do Piauí e do Matopiba), é razoável supor que o celular é o único aparelho e que o pacote de dados é o principal gargalo. Isso não é medido para Corrente.

**Conexão no interior do Piauí (4G e rural):**
- **Piauí, sinal 4G em setores rurais: 23,3% (Anatel, 2020).** [FATO, dado antigo] Fonte: relatório da Anatel de dez/2020, citado em busca. Não abri o original.
- **Mais de 50 localidades rurais do Piauí ganharam 4G nos últimos três anos.** [FATO] Fonte: Brasil 61, https://brasil61.com/n/expansao-do-4g-no-campo-piaui-soma-mais-de-50-localidades-conectadas-mcom260407
- **611 localidades do Piauí sem 4G e sem previsão de atendimento.** [FATO com ressalva] Fonte: O Povo, ago/2026, com base em estudo da Anatel. A reportagem traz também 78,75% sem definir o que mede. **Usar só o número de 611 localidades, com a ressalva.**
- **Dado de nível municipal de cobertura 4G em Corrente ou Formosa: [LACUNA].** O painel de infraestrutura da Anatel permite consultar por município, mas não consegui extrair os números.

### Uso de celular, WhatsApp e Facebook

- **92% dos usuários de internet enviaram mensagens instantâneas em 2024.** [FATO] Fonte: TIC Domicílios 2024, resumo executivo (URL acima). Esse número inclui todos os apps de mensagem, não só o WhatsApp.
- **WhatsApp e Facebook, uso por indivíduo, Brasil e Nordeste: [LACUNA].** A tabela C5 do Cetic.br não carregou na busca. Consultar https://cetic.br/en/tics/domicilios/2024/individuos/C5/
- **[INFERÊNCIA]** O WhatsApp é o canal de mensagem dominante no Brasil. Isso é consistente com o que `PRODUCT.md` afirma sobre o público, mas não há número próprio para a região.

---

## 2. Aparelhos

### Sistema operacional

- **Android no Brasil (somente celular): 77,6% em julho de 2026; 79% em junho de 2026; iOS: 21% a 22%.** [FATO] Fonte: StatCounter, https://gs.statcounter.com/os-market-share/mobile/brazil. Esses números mudam mês a mês.
- **Atenção:** a série que mistura desktop e celular dá Android em torno de 36%. Não usar esse número.
- **Android de entrada: [LACUNA].** Não achei dado de participação de aparelhos de entrada no Brasil.

### Tamanhos de tela

- **Resoluções mais comuns no celular no Brasil (StatCounter):** em junho e julho de 2026, a primeira posição é 375×812 ou 414×896. **360×800 não aparece entre as seis primeiras.** [FATO] Fonte: https://gs.statcounter.com/screen-resolution-stats/mobile/brazil
- **Ressalva:** são resoluções de tela física, não viewport CSS. O StatCounter não mede a largura que o site recebe.
- **[INFERÊNCIA]** Aparelhos de entrada muitas vezes têm tela de 360 px de largura em CSS. A tela 360 deve continuar sendo o teste mínimo. Mas o pico de uso está em 375 e 414. Testar pelo menos em 360, 375, 390 e 412.

### Memória, desempenho e peso de página

- **Aparelho de entrada: memória e processador típicos: [LACUNA].** Não achei número confiável com fonte.
- **Peso de página e número de arquivos de fonte que um celular carrega sem atraso: [LACUNA] em fonte.** Não achei estudo com número por peso.
- **Requisito de desempenho que consta no projeto:** página do anúncio abrindo em até 3 segundos no 3G (`docs/USABILIDADE.md`, meta do piloto).

**O que isso exige (INFERÊNCIA, sem número de fonte):**
- Carregar só 2 pesos da fonte (400 e 700), em formato web comprimido, com só o conjunto de letras do português. Evitar pesos extras (300, 500, 800).
- Foto do anúncio pequena e com tamanho definido na tela, para o navegador não baixar a imagem grande antes.
- Não usar biblioteca de animação para tela de entrada.
- Definir um orçamento de peso por tela (por exemplo, "página inicial abaixo de X KB") e medir num aparelho de entrada real ou com limitação de CPU e rede no navegador. O orçamento X precisa ser definido pelo time; não há fonte para o valor.

---

## 3. Visão e idade

### Tamanho de texto

- **Texto de corpo: 16 px é o piso usado pela própria equipe** (`PRODUCT.md`, `docs/USABILIDADE.md`). [FATO, decisão interna]
- **Estudo sobre idosos e tamanho de fonte:** um resumo de busca cita Hou et al., 2022, *Frontiers in Psychology*: idosos preferem fonte maior, e a legibilidade cai depois de um tamanho crítico. https://www.frontiersin.org/articles/10.3389/fpsyg.2022.931646/full. **Não consegui abrir o artigo (erro 500); o número de tamanho crítico não foi confirmado.**
- **Recomendação de 18 a 20 px para público mais velho:** aparece em blogs e guias de design (PowerMapper, Toptal e outros). [FATO com ressalva] Não é norma; vem de fontes secundárias. Uma fonte oficial do NLM/HHS citada em busca não abriu para confirmação.
- **Nielsen Norman Group: [LACUNA].** Não achei página do NN/g com tamanho mínimo para idosos. Citação de NN/g em blog é secundária e não foi usada.

### Contraste e leitura ao sol

- **Texto normal: contraste mínimo 4,5:1; texto grande: 3:1.** [FATO] Texto grande é 18 pt (cerca de 24 px) ou 14 pt em negrito (cerca de 18,5 px). Fonte: W3C, WCAG 2.2, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (lido).
- **Leitura ao sol e brilho baixo: [LACUNA].** Não achei estudo com número de contraste para leitura ao sol em celular. Só a regra geral do WCAG.
- **[INFERÊNCIA]** Como o sol reduz o contraste percebido, é prudente exceder o mínimo de 4,5:1 no texto de corpo e evitar cinza claro, como já diz `PRODUCT.md`. Um alvo de 7:1 para texto de corpo é uma escolha de projeto, não uma exigência encontrada.

### Altura de linha, peso e texto fino

- **Espaçamento de texto (WCAG 1.4.12): [LACUNA] nesta busca.** Não li a página do critério. Vale usar entrelinha de pelo menos 1,5 em texto corrido.
- **Peso fino e texto claro: [INFERÊNCIA].** Peso 300 e cinza claro perdem contraste na tela e no sol. Por isso o critério de fonte abaixo pede peso regular ou mais forte.

### Área de toque

| Referência | Valor | Status | Fonte |
|---|---|---|---|
| WCAG 2.2, 2.5.8 (AA) | 24×24 px, ou espaço suficiente | FATO | W3C, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (lido em busca) |
| WCAG 2.2, 2.5.5 (AAA) | 44×44 px | FATO | W3C, https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html (lido) |
| Android (Material) | 48×48 dp, com 8 dp entre alvos. Recomendação, cerca de 7 a 10 mm | FATO | Google, https://support.google.com/accessibility/android/answer/7101858?hl=en (lido) |
| Apple HIG | 44×44 pt, com 8 pt de espaço | FATO com ressalva | Fontes secundárias. A página da Apple não foi aberta: https://developer.apple.com/design/human-interface-guidelines |

**O que vale para dedos de pessoas mais velhas:** [INFERÊNCIA] Não achei estudo que meça o erro de toque por idade. Como o toque pode ser mais impreciso e a visão menor, o alvo mínimo prático é o de 44 px. Os 24 px do WCAG AA são um piso de conformidade, não uma meta de uso.

---

## 4. Baixo letramento digital

Não achei estudo brasileiro com números sobre letramento digital de comerciantes e moradores da região. Os pontos abaixo são inferências a partir do público descrito e de regras já aceitas no projeto.

- **Ícone sem palavra confunde.** [INFERÊNCIA] `docs/USABILIDADE.md` (regra 5) já limita ícones sem texto a lupa, coração, X e seta. Manter.
- **Vocabulário do dia a dia.** [INFERÊNCIA] `docs/USABILIDADE.md` (regra 4) já tem a tabela de palavras. Manter e testar com as cinco pessoas do teste de corredor.
- **Número de opções por tela.** [LACUNA] Não achei número com fonte. Recomendação de projeto: no máximo uma ação principal visível e até duas ações por cartão (já é o que `DESIGN.md` diz).
- **Padrões que o público já conhece (do WhatsApp):** [INFERÊNCIA] lista de conversas com foto e última mensagem; botão de envio verde ou laranja fixo; áudio grande como ação; resposta por botão. Copiar: foto em destaque, texto curto, um botão de contato sempre visível, nome da pessoa ou da loja no topo.
- **Padrões do Facebook Marketplace e OLX que eles já conhecem:** [INFERÊNCIA] grade de cartões com foto e preço, filtros por categoria e cidade, botão de chamada no próprio anúncio. Copiar a grade e o preço em destaque, não as abas nem a busca avançada.

---

## 5. Critérios de fonte (sem escolher a fonte)

Estes são os critérios e os pesos para avaliar qualquer candidata. A escolha da fonte é uma decisão separada, feita depois com teste em aparelho real.

| # | Critério | Peso | Por que (base) |
|---|---|---|---|
| 1 | Altura-x alta (letras minúsculas grandes para o mesmo corpo) | 25% | Leitura em tamanho pequeno e em tela com brilho alto. Inferência |
| 2 | Distinção entre I, l, 1, O e 0, inclusive em números de preço | 15% | Confusão de caracteres é causa comum de erro de preço. Inferência |
| 3 | Acentos do português bem desenhados (ã, ç, é, ô, ê, â) em tamanho 16 px | 15% | Texto em português; acento fraco atrapalha a leitura. Inferência |
| 4 | Números de preço claros (1 e 7, 3 e 8, 5 e 6 bem separados) | 10% | Preço é a informação mais procurada. Inferência |
| 5 | Peso regular firme (400) e negrito 700; sem peso 300 | 10% | Contraste e leitura ao sol, ver seção 3. Inferência |
| 6 | Formas abertas (a, e, c, s com contra-forma ampla) | 10% | Leitura para quem lê devagar. Inferência |
| 7 | Licença para uso na web e peso do arquivo por peso de fonte | 10% | Pesos e arquivo afetam o carregamento no 3G. Inferência; sem número de referência |
| 8 | Carregamento consistente em Android (fonte servida pelo site, não depende do aparelho) | 5% | Evita fallback para fonte do sistema em aparelho antigo. Inferência |
| | **Total** | **100%** | |

**Como pontuar:** nota de 1 a 5 em cada critério, multiplicada pelo peso. Uma candidata que tire 2 em altura-x ou em distinção de I/l/1 não deve ser usada, qualquer que seja a nota total.

---

## 6. Veredito: tamanho de texto e área de toque

**A briga interna:** `PRODUCT.md` e `docs/USABILIDADE.md` pedem texto mínimo de 16 px e toque de 48 px. `DESIGN.md` (escala compacta de 10/11/2026) usa corpo de 13 px, legenda de 11 px e controle de 40 px no toque (36 px com mouse).

**Veredito:** o `DESIGN.md` compacto está errado para o celular do público, e a regra de `PRODUCT.md` está certa no essencial. A área de toque de 40 px fica abaixo do mínimo de 44 px, mesmo do critério AAA do WCAG (fato). O corpo de 13 px é menor que o piso que a própria equipe escreveu.

### Valores recomendados

| Uso | Mínimo | Recomendado | Confiança | Base |
|---|---|---|---|---|
| Texto de corpo (descrição, texto de tela) | 16 px | 16 px | Média-alta | Decisão interna + tamanho de fonte para idosos (fontes secundárias) |
| Título do anúncio | 16 px | 17 a 18 px | Média | Inferência |
| Texto secundário (cidade, data, "há 2 dias") | 14 px | 14 px | Média | Inferência |
| Legenda e nome da barra de baixo | 13 px | 13 px, nunca 11 px | Média | Inferência. 11 px é baixo demais para o público |
| Preço | 18 px em negrito | 20 px em negrito | Média | Inferência; preço é a informação principal |
| Campo de digitação | 16 px | 16 px | Alta | Evita zoom automático do iPhone (já em `DESIGN.md`); Android sem efeito, mas mantém padrão |
| Área de toque (mínimo absoluto) | 44 px | 44 px | Alta | WCAG 2.5.5 AAA e Apple |
| Ação principal (botão laranja, Anunciar, Chamar no WhatsApp) | 48 px | 48 px | Alta | Recomendação Android |
| Espaço entre alvos | 8 px | 8 px | Alta | Google |
| Contraste de texto | 4,5:1 | 7:1 no corpo | Alta para 4,5:1; média para 7:1 | WCAG; 7:1 é escolha de projeto |

**Confiança geral:** alta para o piso de toque (44 px) e para o contraste (4,5:1). Média para os tamanhos de texto, porque a base é decisão interna e fontes secundárias. Baixa para leitura ao sol: não achei número.

### O que se perde

- **Densidade de anúncios por tela.** Com corpo de 16 px e controle de 48 px, cada cartão fica mais alto, e a tela mostra menos anúncios de uma vez. Não medi quanto. Isso precisa ser medido com um protótipo nas larguras 360 e 375.
- **Compatibilidade com a escala compacta de 4ª passada.** Trocar 13 px por 16 px no corpo muda todos os componentes que usam `text-base`, `text-sm` e os controles de 40 px.
- **Mais rolagem para ver a mesma oferta.** Isso é o custo real. A lista continua em duas colunas no celular, mas cada coluna tem texto maior.

**Como resolver sem perder tudo:** usar 16 px no corpo e 48 px só na ação principal de cada tela. Manter 44 px nos demais controles. Usar 14 px no texto secundário, e não 11 px. A densidade cai pouco, porque o que mais pesa no cartão é a foto.

---

## 7. Dez regras de interface derivadas do público

Cada regra tem a evidência. Quando a evidência é fraca, está escrito.

1. **Texto de corpo com 16 px, nada menor que 13 px na tela.** Evidência: decisão interna (`PRODUCT.md`), tamanho de fonte para idosos (fonte secundária, Hou et al., 2022, não lido por completo). Confiança média-alta.
2. **Toda ação tocável tem 44 px no mínimo; a ação principal tem 48 px; e há 8 px entre alvos.** Evidência: WCAG 2.5.5 (lido), Google Material (lido). Confiança alta.
3. **Texto com contraste de pelo menos 4,5:1, e nada de cinza claro.** Evidência: WCAG 1.4.3 (lido), `PRODUCT.md` (leitura ao sol). Confiança alta para o número; baixa para o efeito no sol.
4. **Ícone sempre com palavra, exceto lupa, coração, X e voltar.** Evidência: `docs/USABILIDADE.md`, regra 5. Inferência sobre baixo letramento. Confiança média.
5. **Uma ação principal por tela, com nome que diz o que acontece.** Evidência: `docs/USABILIDADE.md`, regra 2. Inferência. Confiança média.
6. **Preço em destaque, negrito, 20 px, sempre com "R$" e número de fácil leitura.** Evidência: `PRODUCT.md` (compra por preço). Inferência sobre legibilidade de números. Confiança média.
7. **Página leve: carregar só 2 pesos de fonte e fotos reduzidas antes de chegar ao celular.** Evidência: 82% da área rural usa só celular (Cetic.br, lido); 60% do Brasil só celular (resumo). Número de KB: [LACUNA]. Confiança média no princípio, baixa no número.
8. **Ver, buscar e chamar no WhatsApp sem pedir conta.** Evidência: `docs/USABILIDADE.md`, regra 9; 92% dos usuários de internet mandam mensagem (Cetic.br). Inferência sobre o peso disso. Confiança média-alta.
9. **Sempre uma saída: tela vazia, erro ou busca sem resultado oferece caminho.** Evidência: `docs/USABILIDADE.md`, regra 10. Inferência sobre baixo letramento. Confiança média.
10. **O texto cresce com a letra que a pessoa escolheu no celular, e o zoom nunca é travado.** Evidência: WCAG 1.4.4 (zoom de 200%, citado no `docs/USABILIDADE.md`; não lido nesta busca); `DESIGN.md` já prevê. Confiança média-alta.

---

## Lacunas e próximos passos

**Lacunas que impedem decidir com segurança:**
- Idade e renda de Corrente e Formosa (IBGE, nível municipal).
- Número de usuários de WhatsApp e Facebook no Piauí e no Nordeste rural (Cetic.br, tabela C5).
- Participação de aparelhos de entrada no Brasil.
- Peso de página e de fonte que um celular de entrada carrega sem atraso.
- Leitura ao sol com número de contraste.
- Estudo de tamanho mínimo para idosos no Brasil.
- Diretrizes do GOV.BR Design System (a busca não achou valor de corpo; o endereço oficial é https://www.gov.br/ds).

**Próximos passos concretos:**
1. Conferir no IBGE a população de Corrente (27.278 é de site terceiro) e baixar a tabela municipal de idade.
2. Abrir o PDF do TIC Domicílios 2024 (resumo e tabela C5) e anotar o WhatsApp no Nordeste rural.
3. Fazer um protótipo com 16 px no corpo e 48 px na ação principal, e medir quantos anúncios cabem na tela de 360 px.
4. Rodar o teste de corredor de `docs/USABILIDADE.md` com as cinco pessoas e comparar a versão 13 px com a versão 16 px. Esse é o único teste que responde a pergunta do público de verdade.
5. Só depois, aplicar os critérios da seção 5 para escolher a fonte.

---

## Fontes consultadas

- IBGE, Censo 2022, Formosa do Rio Preto: https://www.ibge.gov.br/cidades-e-estados/ba/formosa-do-rio-preto.html
- IBGE, Corrente (PI): https://www.ibge.gov.br/cidades-e-estados/pi/corrente.html (erro 403; não lido)
- Ceps Brasil, Corrente e Formosa (dados do IBGE, site terceiro): https://cepsbrasil.com.br/pi/corrente/ibge e https://cepsbrasil.com.br/ba/formosa-do-rio-preto/ibge
- IBGE, população por idade e sexo, Piauí: https://biblioteca.ibge.gov.br/visualizacao/periodicos/3102/cd_2022_populacao_idade_sexo_pi.pdf
- IBGE, analfabetismo Censo 2022: https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-denoticias/40098-censo-2022-taxa-de-analfabetismo-cai-de-9-6-para-7-0-em-12-anos-mas-desifualdades-persistem
- Correio Braziliense, Piauí e analfabetismo: https://www.correiobraziliense.com.br/brasil/2024/05/6859463-ibge-piaui-e-o-estado-com-maior-taxa-de-analfabetismo-entre-maiores-de-15-anos.html
- Cetic.br, TIC Domicílios 2024, resumo executivo: https://cetic.br/media/docs/publicacoes/2/20250512115624/tic_domicilios_2024_resumo_executivo.pdf
- Cetic.br, TIC Domicílios 2024, tabela C16A (lida): https://cetic.br/en/tics/domicilios/2024/individuos/C16A/
- Cetic.br, TIC Domicílios 2024, tabela C5 (não carregou): https://cetic.br/en/tics/domicilios/2024/individuos/C5/
- MobileTime, resumo de TIC 2024: https://www.mobiletime.com.br/?p=807296
- Brasil 61, expansão do 4G no Piauí: https://brasil61.com/n/expansao-do-4g-no-campo-piaui-soma-mais-de-50-localidades-conectadas-mcom260407
- O Povo, cobertura 4G (ago/2026): https://mais.opovo.com.br/jornal/reportagem/2026/08/01/cobertura-4g-chega-a-9414-da-populacao-cearense-mas-308-localidades-nao-tem-expectativa-de-ter-sinal.html (contém a referência a estudo da Anatel sobre o Piauí; ler com cuidado)
- StatCounter, sistema operacional móvel Brasil: https://gs.statcounter.com/os-market-share/mobile/brazil
- StatCounter, resolução de tela móvel Brasil: https://gs.statcounter.com/screen-resolution-stats/mobile/brazil
- W3C, WCAG 2.2, contraste (1.4.3, lido): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, WCAG 2.2, alvo de toque mínimo (2.5.8, por busca): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C, WCAG 2.2, alvo de toque aprimorado (2.5.5, lido): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Google, Android, tamanho do alvo de toque (lido): https://support.google.com/accessibility/android/answer/7101858?hl=en
- Hou et al., 2022, *Frontiers in Psychology* (não lido, erro 500 e resumo de busca): https://www.frontiersin.org/articles/10.3389/fpsyg.2022.931646/full
- Apple HIG, alvo de toque (por fonte secundária, não lido): https://developer.apple.com/design/human-interface-guidelines
- Projeto: `PRODUCT.md`, `DESIGN.md`, `docs/USABILIDADE.md`, `docs/MARCA.md`, `docs/preparacao-piloto/liberacao.md`
