# Plano de crescimento — app rápido, ganha-ganha e comércio da região

Data: 11/11/2026. Origem: rodada de perguntas e respostas com o Raniel.
Estado do código conferido na `origin/main` (marca "Mercado da Região").

## Objetivo

Fortalecer o comércio da região inteira. O app tem que ser útil todo dia
para quem compra (achar, economizar, descobrir a cidade) e dar retorno
medido para quem vende (clientes vindos do app). Visual limpo e minimalista,
sem poluição de anúncios, com abertura em até 1 segundo no celular.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Área inicial | Corrente (PI) e cidades vizinhas (microrregião) |
| Quem espalha primeiro | Lojistas: link e QR no balcão e no Instagram |
| Formato | App pelo site (PWA), instalável, com notificações |
| Velocidade | Telas principais abrem em até 1 s no 4G; da 2ª vez, na hora |
| Rodapé do celular | Início · Perto · Radar · Cupons · Eu (busca fixa no topo) |
| Perto de mim | Lista por distância; o mapa só carrega ao tocar |
| Anúncios externos | Sem Google Ads: os espaços viram destaques pagos de lojas locais |
| Notificações | No máximo 1 por dia, só úteis, a pessoa escolhe os tipos |
| Cupons | O lojista cria e paga o desconto; uso por QR com confirmação do lojista |
| Lojista indica lojista | 1 mês de plano grátis para os dois, após a loja nova publicar anúncios |
| Cliente indica amigos | Níveis ("Vizinho", "Embaixador de Corrente") liberam cupons melhores |
| Extras | Seguir lojas, vagas de emprego locais, agenda de eventos |
| Guia da região | A equipe cadastra os primeiros 20–30 lugares; depois a comunidade sugere |
| 1º uso do JEV | Busca que entende a intenção e ordena por relevância e distância |
| Sorteio mensal | Só depois da autorização do governo (ver Etapa 5) |
| Testes | Equipe interna (risco anotado abaixo) |

## Regras de design para o celular (checar em toda tela)

1. Ações principais ao alcance do polegar (metade de baixo da tela).
2. Área de toque de pelo menos 44 × 44 px; texto de pelo menos 16 px.
3. Uma ação principal por tela; o resto vira link ou menu.
4. Resposta visual a todo toque em até 100 ms (estado de carregando ou esqueleto).
5. Nada de pop-up na entrada; pedir localização e notificação só no momento em que fizer sentido, explicando o porquê.
6. Funciona com internet fraca: telas guardadas, imagens leves (AVIF/WebP), carregamento só do que está na tela.
7. Movimento curto e com versão para quem pede "reduzir movimento".
8. Contraste de texto WCAG AA; textos em linguagem simples.
9. Patrocinado sempre com etiqueta "Patrocinado"; nunca na página do anúncio, cupom, sorteio ou mapa.
10. Medir antes de publicar: Lighthouse em celular ≥ 90 em desempenho e LCP ≤ 1,5 s nas telas Início, Busca, Perto, Cupons e Loja.

## Etapas

### Etapa 0 — Arrumar a base (antes de programar)
- Pasta local está no branch antigo `codex/visual-compacto-aki`, com arquivos não salvos e atrás da `main`. Salvar ou guardar esses arquivos e trabalhar a partir da `main`.
- Home hoje aparece com 0 anúncios: cadastrar conteúdo real de lojas de Corrente.
- Medir velocidade atual no celular (nunca foi medida) para ter o ponto de partida.

**Pronto quando:** branch novo saindo da `main` e números de velocidade anotados.

#### Resultado da medição (11/11/2026, Lighthouse 12.8.2, modo celular, site publicado)

| Tela | Desempenho | LCP | 1º conteúdo | Bloqueio (TBT) | Peso |
|---|---|---|---|---|---|
| Início `/` | 82 | 4,0 s | 2,1 s | 140 ms | 1.647 KB |
| Busca `/busca` | 82 | 4,0 s | 2,0 s | 150 ms | 732 KB |
| Lojas `/lojas` | 83 | 4,0 s | 2,0 s | 120 ms | 1.644 KB |
| Categorias | 81 | 4,1 s | 2,0 s | 200 ms | 729 KB |
| Loja `/loja/multi` | 84 | 3,9 s | 1,9 s | 130 ms | 714 KB |
| Radar `/radar` | 85 | 3,9 s | 1,8 s | 160 ms | 723 KB |

Acessibilidade 100 em todas. Layout não pula (CLS 0). Meta: desempenho ≥ 90 e LCP ≤ 1,5 s → **ainda longe**.

Causas, da maior para a menor:
1. **Login (Clerk) em modo de desenvolvimento no site publicado.** Todo visitante novo passa por 2 redirecionamentos de "handshake" (`dev-browser-missing`), cerca de **1,9 s perdidos** antes de ver qualquer coisa. Correção: instância de produção do Clerk, que exige domínio próprio (não funciona em `vercel.app`). Decisão do Raniel: qual domínio usar.
2. **Telas sem cache** (`no-store`): cada visita é montada do zero no servidor. Deixar em cache as partes públicas (home, lojas, categorias) e carregar o login só onde precisa.
3. **Imagens sem otimização:** uma imagem de loja/anúncio de **925 KB** na home e na lista de lojas. Ganho estimado de ~900 KB servindo em WebP/AVIF e no tamanho certo.
4. **Script do login em todas as telas:** ~350 KB de JavaScript do Clerk carregados até para quem só olha. ~214 KB de JavaScript sem uso.
5. Menores: texto pequeno demais em algum ponto (legibilidade), cookies de terceiros (Clerk). `/busca` e `/radar` estão fora do Google (`noindex`) — conferir se é de propósito.

#### Correções rápidas feitas (branch `claude/plano-crescimento`)
- Fotos dos cards de anúncio e logos das lojas passam pelo otimizador de imagens do Next/Vercel (AVIF/WebP, no tamanho da tela, cache de 31 dias). Só fotos do Storage do projeto; outros endereços vão como estão (`src/lib/imagem.ts`).
- Custo: o otimizador da Vercel é grátis até o limite mensal do plano; acima disso, cobra por uso. Acompanhar no painel da Vercel no primeiro mês.
- Scripts próprios do site já são leves (103–141 KB por tela no build). O peso vem do Clerk (~350 KB), que só sai das telas públicas junto com o login de produção (precisa do domínio).
- `robots.txt` e `sitemap.xml` já existem (`src/app/robots.ts`, `src/app/sitemap.ts`).
- Falta: medir de novo depois de publicar.

#### Ficam para a rodada do domínio
- Clerk de produção (tira ~1,9 s de redirecionamentos).
- Carregar o login só nas telas que precisam.
- Cidade no endereço (`/corrente-pi/...`) para guardar telas públicas em cache.

### Etapa 1 — App rápido, instalável e busca com JEV
- Service worker: guardar telas principais e funcionar sem internet no básico (o manifest já existe em `src/app/manifest.ts`).
- Rodapé com 5 abas (Início · Perto · Radar · Cupons · Eu). Cupons e Perto podem começar como telas simples até as etapas 2 e 4.
- Busca com JEV:
  - Teste antes de ligar: medir custo e tempo de resposta do `jev-latest` com 50 buscas reais da região; comparar com a busca atual.
  - Uso: o banco traz os candidatos (texto, categoria, cidade); o JEV dá a nota de relevância (Score) e a ordem final mistura relevância e distância.
  - Se o JEV demorar ou falhar, cai na busca atual sem a pessoa perceber.
  - Chave só no servidor.

**Pronto quando:** app instala no Android e iPhone, abre em até 1 s no 4G e a busca com JEV ganha da atual no teste.

### Etapa 2 — Cupons com QR e seguir lojas
- Lojista cria cupom: desconto, validade, limite por pessoa e total.
- Cliente pega o cupom e mostra o QR no balcão; o lojista toca "usado" no app. Um uso por QR.
- Painel do lojista: cupons pegos, usados e estimativa de clientes trazidos pelo app.
- Seguir loja: cliente recebe cupons e novidades das lojas que segue.
- Push com limite de 1 por dia e preferências por tipo (Radar, cupom de loja seguida, sorteio, eventos).

**Pronto quando:** um lojista de Corrente cria um cupom e um cliente usa no balcão com confirmação.

### Etapa 3 — Indicação
- Lojista: link e QR próprios. Loja indicada que publica anúncios → 1 mês de plano grátis para as duas.
- Cliente: link próprio; amigos que entram e usam o app sobem o nível dele. Cada nível libera cupons mais fortes (os lojistas marcam cupons como "só para nível X").
- Regras contra fraude: só conta conta com telefone verificado e uso real; limite de indicações por dia.

**Pronto quando:** uma indicação de lojista gera os dois meses grátis sem trabalho manual.

### Etapa 4 — Perto de mim, guia, vagas e eventos
- Perto: lista por distância usando a lat/lng que as lojas já gravam; mapa leve só ao tocar.
- Guia da região: lugares, pontos turísticos, o que fazer, cadastrados pela equipe.
- Agenda de eventos e vagas de emprego postadas pelas lojas.
- Depois: comunidade sugere lugares e eventos; o JEV classifica e separa spam e repetidos para a equipe aprovar.

**Pronto quando:** 20–30 lugares do guia, eventos do mês e as lojas aparecem por distância.

### Etapa 5 — Sorteio mensal com números da sorte
Só lançar com autorização. Passos:
1. Advogado e pedido de autorização de promoção comercial (Lei 5.768/71) ao Ministério da Fazenda (Secretaria de Prêmios e Apostas). Esses pedidos costumam usar o resultado da Loteria Federal como forma de sorteio — confirmar com o advogado.
2. Ajustar as regras abaixo ao que for autorizado.

Regras propostas pelo Raniel:

| Quem | Números no mês |
|---|---|
| Usuário que entrou no app ao menos 1 vez no mês | 1 |
| Lojista ativo | 2 |
| Dono de loja com anúncio ativo | 3 |
| Quem fez pedido no Radar | 3 |
| Pessoa física que anunciou um produto | 5 |
| Plano mais barato (na renovação) | 20 |
| Plano maior (na renovação) | 30 |

- Lista zera após cada sorteio. Fecha no dia 1 às 7h; sorteio no dia 1 às 12h, ao vivo, gravado e postado nas redes.
- Prêmio inicial R$ 500, valor definido pelo Raniel a cada mês, pago por PIX.
- Cada pessoa vê em destaque, com animação leve, quantos números tem e as regras completas.
- Lista pública só leitura, atualizada todo dia, com **número + código anônimo**, nunca nome ou telefone (LGPD).

Melhorias sugeridas:
- Teto de números por pessoa por mês.
- Termos: quem participa (idade, região), contas falsas, prazo para retirar o prêmio, o que acontece se o ganhador não responder, impostos.
- JEV confere fraude (contas falsas, padrões de indicação em massa) antes de fechar a lista; casos duvidosos vão para revisão humana.

**Pronto quando:** autorização em mãos, termos publicados e um sorteio de teste interno feito.

## Usos do JEV (em ordem)

1. Busca que entende (Etapa 1).
2. Radar: mandar cada pedido só às lojas que vendem aquilo.
3. Antifraude de indicações, cupons e números da sorte.
4. Moderar sugestões da comunidade (guia, eventos, vagas).
5. Feed "Para você": ordenar cupons e promoções pelo interesse de cada um.

Regra geral: o JEV só escolhe entre opções que o sistema oferece; resultados com pouca confiança vão para pessoa ou para a regra antiga. Calibrar limites com dados da região.

## Riscos

- **Testes só com a equipe:** quem fez o app não vê onde o leigo trava. Sugestão: 2–3 lojistas de Corrente testando cada etapa no próprio celular.
- **Sorteio sem autorização** = multa e prêmio apreendido. Não anunciar valor antes da autorização.
- **App vazio no começo:** sem lojas e cupons reais, as abas novas parecem abandonadas. Cada etapa só vai ao ar com conteúdo real.
- **Custo do JEV** ainda não medido.

## Próximo passo

Etapa 0: arrumar a pasta local a partir da `main` e medir a velocidade atual no celular.

## Fotos e edição de anúncios (decidido em 11/11/2026)

Já corrigido no PR #103: foto inteira (sem cortar) no card, fundo branco no card e na galeria, botões alinhados na tela "anúncio no ar".

| Tema | Decisão |
|---|---|
| Editar anúncio | Etapas tocáveis no topo (Fotos · Título · Preço · Categoria...). Ao editar, vai direto; no anúncio novo, só libera etapas já preenchidas |
| Formato da foto | Quadrada 1:1 em todo o site (card, loja, galeria). Dica no envio: "foto quadrada, 1080 × 1080, produto no centro, fundo claro" |
| IA nas fotos | Ajusta para 1:1, limpa o fundo e melhora a foto. Preço fixo com cota mensal no plano mais caro + pacote extra |
| Teste grátis | Todo lojista trata 3 fotos de graça; depois só no plano mais caro |

Falta para fechar a cota: medir o custo real por foto do modelo de imagem já usado pelo Merc (`gpt-image-2` / `gpt-image-1.5`, `src/lib/aki/lojista.ts`) com 10 fotos reais. Regra para a cota: custo da cota ≤ 20% do valor do plano. Exemplo só de conta: se cada foto custar R$ 0,25 e o plano for R$ 79, cabem até ~60 fotos/mês.

Pendente de decisão: ajustes para o app ficar mais enxuto no celular (filtros numa linha só, menos espaço vazio, Merc só com ícone, janela do Merc menor; botões com 44 px).
