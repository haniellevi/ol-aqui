# Clareza das telas e Radar com lista de procuras ("desejos")

* **Author:** Raniel Levi Lemos Lima
* **Date:** 2026-11-09

## Overview

**Resposta curta:** o conceito, como está escrito, não deve ser construído agora. Os sete revisores chegaram, por caminhos separados, à mesma conclusão em três pontos:

1. **A parte 1 (clareza e visual) é a certa, mas ainda é um chute.** Não existe registro de onde os testadores travaram. O teste de 5 pessoas já está escrito em `docs/USABILIDADE.md:80-87` e não há documento mostrando que foi feito.
2. **A parte 2 (desejo) contradiz a parte 1.** Ela põe um terceiro jeito de "guardar" ao lado de Favoritos e de "Pedir no Radar", num site que os testadores já não entendem.
3. **A parte 3 (lojista vê desejos) não tem valor com zero usuários** e serve ao público que você mesmo colocou por último.

**O que já existe e cobre boa parte da ideia** (conferido no código):

- Uma pessoa já pode ter vários pedidos no Radar ao mesmo tempo (até 10) e já tem a lista "Meus pedidos".
- O lojista já tem a lista "Pedidos na região" e já recebe aviso dentro do site a cada pedido novo.
- Favoritos está pronto de ponta a ponta.
- Já existe um link que abre o formulário do Radar preenchido (`linkPedirRadar` em `src/lib/rotas.ts:44-51`). Ele só não é usado na página de um anúncio no ar.

**O que é realmente novo:** um item criado com um toque, que dura bastante, nasce de um anúncio e não entrega o telefone do comprador.

**Caminho recomendado:** primeiro observar 5 pessoas usando o site, depois corrigir palavras e estrutura, depois colocar um link "procuro algo parecido" que reaproveita o Radar atual. Só construir a lista de desejos de verdade se esse passo mostrar uso.

### Situação dos revisores

| Revisor | Situação |
| --- | --- |
| `egm-design` | concluído |
| `egm-codebase-details` | concluído |
| `egm-zoom-out` | concluído |
| `egm-comprehension` | concluído |
| `egm-implementation-readiness` | concluído |
| `egm-structural` | concluído |
| `egm-inventive-catalyst` | concluído |

**Limites desta análise.** Ninguém abriu o site numa tela, rodou testes ou consultou o banco de produção. Tudo vem da leitura de código, migrações e documentos. As afirmações sobre "como parece" e "por que o testador se confunde" são leitura de especialista, não observação de usuário real. Nenhum revisor leu todos os arquivos; as telas de loja e os formulários dos 6 passos do anúncio foram os menos lidos.

## Analysis

Gravidade: **Bloqueio** = impede começar. **Importante** = precisa ser resolvido no desenho. **Detalhe** = ajuste pequeno.

### Bloqueios

**B1. O problema da parte 1 não foi medido.** (5 revisores)
- Não há notas de sessão com testadores em `docs/`. Todos os QAs usaram emulação no computador, não celular real (`docs/QA-RADAR-2026-11-09.md:23`).
- "Minimalista e premium" e "não entendem" não são critérios que se possa testar.
- Não há referência visual escolhida.
- Hipótese a conferir: parte do "estranho" pode ser o site vazio. O bloco principal da home diz "Seu anúncio pode ser o primeiro" (`src/app/(publico)/page.tsx:166-169`).
- O que destrava: rodar o teste de `docs/USABILIDADE.md:82-87` com 15 a 20 anúncios de exemplo, anotar a tela e a palavra onde cada pessoa parou, e escolher 2 ou 3 sites que você considera "premium" e 1 que você rejeita.

**B2. "Desejo" vai ser lido como "favorito".** (5 revisores)
- "Lista de desejos" em lojas online conhecidas é uma lista de produtos salvos. O coração hoje já diz "Salvar nos favoritos" (`src/app/(publico)/anuncio/[idslug]/barra-contato.tsx:100`).
- O comprador já encontra Buscar, Favoritos, Radar e Aki. O documento de produto ainda promete um quarto conceito, "Buscas salvas com alerta" (`docs/PRODUTO-CONTAS-ANUNCIOS-ROBO.md:45`, `docs/TELAS-E-FLUXOS.md:120`), que não foi construído.
- O card do anúncio tem lugar para um botão só (`src/components/anuncio/card-anuncio.tsx:14-15`). Num celular, o card tem cerca de 160 px de largura (estimativa); dois botões de toque cobririam a foto.
- Regra do próprio projeto: uma meta por tela, um botão principal (`docs/USABILIDADE.md:14-15`).

**B3. Guardar o desejo como pedido do Radar entrega o telefone do comprador.** (4 revisores)
- O modo padrão é "Podem me chamar no WhatsApp". Nele, a loja que faz proposta recebe o número na hora (`supabase/migrations/20261110014434_whatsapp_obrigatorio.sql:160-168`).
- O outro modo esconde o número, mas exige prazo de no máximo 168 horas.
- Nenhum dos dois serve para um desejo de longa duração em que "o cliente libera o contato". Essa suposição não se sustenta com o código atual.

**B4. "A loja vê só item + cidade" já não é verdade hoje.** (4 revisores)
- Qualquer pessoa logada na região, mesmo sem loja, vê título, cidade, faixa de preço e urgência de todo pedido aberto (`supabase/migrations/20261109032907_seguranca_fluxo_radar.sql:14-34`).
- Quem tem plano com Radar, incluindo o teste grátis de 30 dias, vê também os detalhes e o primeiro nome do comprador.
- Conclusão: a lista de desejos deve ser desenhada como se fosse pública. Em cidade pequena, item + cidade + primeiro nome + horário pode identificar a pessoa. Isso toca a LGPD (lei de proteção de dados).

**B5. Desejo de um toque bate nas regras que o Radar já aplica.** (5 revisores)
- Máximo de 10 pedidos abertos e 10 por dia (`supabase/migrations/20261108020000_radar_completo.sql:16-17`, `315-336`). "Muitos itens" estoura no 11º.
- Pedido vence em 15 dias (`supabase/migrations/20261107000000_olaki_inicial.sql:310`).
- Exige WhatsApp confirmado por código, em três camadas. Favoritar não exige. Então "um toque" vira login mais código.
- Cada pedido novo avisa até 200 lojas. Cada loja recebe no máximo 2 avisos por comprador por dia; o resto some sem aviso.
- Título do pedido precisa de 8 a 120 letras; título de anúncio aceita 5. Um anúncio "Moto" não vira pedido.

**B6. A tela `/radar` são três telas no mesmo endereço, e o comprador vê a vitrine de venda para lojista.** (3 revisores)
- Quem não é lojista também recebe a aba "Pedidos na região" (`src/app/radar/page.tsx:60`) e encontra "Exclusivo para lojistas assinantes" e "Desbloquear e Propor Produto" (`src/components/radar/radar-de-negocios.tsx:113`, `219`, `250`).
- Quem publicou um anúncio como pessoa comum cai direto nessa lista de lojista.
- Colocar desejos em cima disso herda a confusão.

**B7. Arranque a frio.** (4 revisores)
- Sem compradores e sem lojas, uma lista para lojista consultar não vale nada. O próprio projeto chama isso de risco número 1, "ovo e galinha" (`docs/LEIA-ME.md:31`).
- Desejo velho, que a pessoa já não quer, estraga a lista para o lojista.

### Importantes

**Palavras e fluxo (leitura do código, não de usuários)**
- "Radar" ocupa um dos 5 lugares da barra principal sem explicação (`src/components/ui/barra-inferior.tsx:16`). Para muita gente, radar é o de multa.
- "Meus pedidos" e "Pedir no Radar" soam como compra feita, igual a aplicativos de entrega. Quem não comprou nada lê "Você ainda não pediu nada" (`src/components/radar/listas-radar.tsx:20`).
- A mesma coisa tem três nomes: "ofertas", "propostas" e "contatos" (`src/components/radar/explicacao-radar.tsx:7-8`).
- Para anunciar pela primeira vez, a pessoa passa por cerca de 5 telas antes da primeira foto: login só com logo, código de WhatsApp, termos com o título "Falta só um passo", "Como você quer vender?" e uma introdução. No total, cerca de 12 telas até publicar (contagem de um revisor).
- A introdução promete 3 passos; o cabeçalho mostra "Passo N de 6" (`src/app/(conta)/anunciar/page.tsx:76-78`, `src/components/anunciar/cabecalho-passo.tsx:54`).
- A busca vazia oferece 4 ações, duas com nomes inventados (`src/components/busca/vazio-busca.tsx:29-41`).
- A marca aparece com grafias diferentes: "OLAKI" e "OL-AKI".

**Possíveis defeitos nos dois caminhos prioritários (lidos no código, não reproduzidos)**
- Depois de confirmar o WhatsApp, a pessoa que tocou em "Anunciar" cai em "editar meus dados", não no formulário (`src/app/(conta)/layout.tsx:20`, `src/app/confirmar-celular/page.tsx:19`).
- Favoritar não pede WhatsApp, mas o link "Ver meus favoritos" leva a uma área que pede.
- O cartão borrado do Radar mostra um telefone falso "(89) 9••••-••••" (`src/components/radar/radar-de-negocios.tsx:214`).
- "Salvar e sair" na revisão do anúncio é um link que não salva nada (`src/components/anunciar/cabecalho-passo.tsx:47-49`).

**Visual: por que pode parecer "estranho"**
- As cores, cantos e sombras estão disciplinados. O problema não é bagunça de cores soltas.
- Não há sistema de tipografia (regra única de tamanhos de letra). Os títulos de página têm 5 estilos diferentes. Há 132 tamanhos de letra escritos à mão em 51 arquivos (contagem do revisor de estrutura).
- A home usa cores lilás próprias, fora do padrão (`src/app/(publico)/inicio.module.css:1-13`). O fundo muda quando se sai da home. Isso contraria `docs/DESIGN-SYSTEM.md:5` e `:29`, que dizem para não usar violeta vivo.
- Todo texto é roxo. Uma página de anúncio junta roxo, laranja, verde, pêssego e âmbar.
- A regra "um botão principal por tela" é quebrada na home (4 botões laranja) e na lista do Radar.
- Tudo é uma caixa branca sobre fundo cinza, em 5 variações. Isso lembra painel administrativo.
- No celular, a página do anúncio tem cabeçalho fixo, barra de contato fixa, barra inferior e o balão do Aki, um sobre o outro.
- A primeira tela da home tem texto e ícones, sem foto de produto.
- O Radar tem botões e etiquetas feitos à mão, fora dos componentes padrão. Uma reforma visual vai deixar essas partes para trás se isso não for corrigido antes.
- "Premium" costuma puxar imagem, animação e fontes. O projeto tem limite de peso (`docs/ARQUITETURA.md:98`) e proíbe animação pesada (`docs/USABILIDADE.md:47`). Esses limites precisam valer.

**Modelo de dados e migração**
- Marcar o desejo dentro do favorito não serve: o favorito some quando o anúncio é apagado, justo quando a pessoa ainda procura.
- Mexer na tabela `radar_pedidos` obrigaria a reescrever mais de uma dezena de funções que já foram trocadas três vezes em três dias.
- Tabela nova e separada é a única opção só de acréscimo, que pode ser desligada sem desfazer nada. Em troca, exige regras próprias de acesso, limites, exportação de dados e exclusão de conta.
- O desejo precisa guardar uma cópia do essencial (categoria, faixa de preço, cidade) e não depender do anúncio. Sem foto.
- Não existe banco de testes separado; as migrações são aplicadas direto no único projeto de produção. Não existem migrações de volta.
- Risco de dados hoje é baixo: os QAs registram zero favoritos e poucas notificações em produção. A quantidade de pedidos do Radar em produção não está documentada.
- Incerto: nenhum documento confirma que `20261109032907_seguranca_fluxo_radar` e `20261110002950_cobranca_sem_duplicidade` estão aplicadas em produção. Se a primeira faltar, criar pedido no Radar falha. Sua memória de projeto também cita `20261107020000` e `fotos.origem` como pendentes. Precisa conferir.

**Concorrência entre lojas**
- Um desejo criado no anúncio da loja A vira oportunidade para a loja B. Loja pagante pode ver isso como a plataforma entregando o cliente dela ao concorrente. Não mostrar o anúncio de origem.
- Sinal fraco: se o anúncio existe, o comprador já pode chamar no WhatsApp. Um desejo num anúncio no ar tende a significar "esse não, esse preço não, ou agora não".

**Avisos e custo**
- Avisos hoje são só dentro do site. WhatsApp, e-mail e push não enviam nada. Lojista só fica sabendo se abrir o site.
- O WhatsApp atual usa Evolution API numa VPS alugada, só para códigos. Um revisor inferiu que é integração não oficial. Mandar avisos em volume por esse número arrisca bloqueio, e esse número é a porta do cadastro.
- Sem custo fixo novo é possível se for só banco de dados, avisos no site e sem IA para comparar itens. A busca por semelhança já existe no banco sem custo extra.
- Custos fixos que chegam no lançamento, com ou sem esta ideia, segundo `docs/ARQUITETURA.md:207-219`: Vercel Pro e Supabase Pro. A VPS já é custo fixo hoje.

**Pendências que este trabalho empurraria**
- Login ainda na instância de desenvolvimento do Clerk; produção exige domínio próprio, e o nome da marca não está fechado (`docs/VALIDACAO-CADASTRO-CONTATO-2026-11-09.md:38-44`). Reforma visual antes do nome pode ser refeita.
- Cobrança em modo de teste; pagamento real nunca foi exercitado (`docs/QA-MEU-PLANO-2026-11-09.md`).
- Fila de moderação manual sem rotina definida.
- Nenhum teste em Android real.
- A pasta `docs/brainstorm-piloto-2026-11-09/` foi aberta hoje e está sem aprovação. Este conceito é uma segunda frente aberta antes de fechar a primeira.
- Documentos desatualizados que enganam quem for programar: `README.md`, `docs/DESIGN-SYSTEM.md`, `docs/etapa4/radar.md`.

**Medição**
- Não há ferramenta de erros nem de análise instalada. Só se registram visita, clique no WhatsApp e compartilhamento. Sem registrar desejo criado, visto e contato feito, não dá para saber depois se "o lojista achou cliente".

### Detalhes
- "Perfil do Radar" confunde com "perfil" de dados da conta. Chamar de lista.
- "Destaques perto de você" parece "melhores", mas é pago; "Destacar" não avisa que custa.
- Rota de demonstração `src/app/demo/radar/page.tsx` ainda existe e carrega 10 avisos de lint.
- Código morto do antigo campo de WhatsApp digitado (`src/lib/dados/radar.ts:47-50`).
- Função antiga `revelar_contato_radar` ainda pode ser chamada por usuário logado.
- Cor do tema diferente em `src/app/layout.tsx:22` (laranja) e `src/app/manifest.ts:12` (roxo).

### Onde os revisores discordam

- **Tabela nova ou nenhuma tabela.** Um revisor defende só o link para o pedido preenchido, sem tabela. Quatro defendem tabela pequena e separada. Proposta deste resumo: link primeiro, tabela só se houver uso.
- **Lojista vê pessoas ou só totais.** Dois defendem só totais ("7 pessoas procuram sofá até R$ 800"). Contra: lojista paga por contato com nome, não por estatística, e com poucos usuários o total mínimo não mostra nada. Não há dado para decidir; perguntar a lojistas reais.
- **A palavra do botão.** "Me avise" foi sugerida por dois e rejeitada por um (pode ser lida como alerta de queda de preço). "Procuro algo assim" e "Quero ofertas de parecidos" são as candidatas. Decidir com as palavras dos testadores.
- **Botão no card.** O pedido original é um botão na vitrine. Quatro revisores dizem para manter só o coração no card e oferecer a procura depois de salvar ou na página do anúncio.

## Goals vs. Non-Goals

**Metas**
- Descobrir, com 5 pessoas reais, onde elas travam e que palavras usam.
- O comprador entende na primeira tela o que o site faz e onde tocar.
- A pessoa comum publica um anúncio sem se perder. Alvo já escrito: menos de 2 minutos (`docs/USABILIDADE.md:92-96`).
- Um vocabulário único: uma palavra para cada coisa (anúncio, loja, procura, oferta, salvar).
- O comprador consegue dizer "procuro algo assim" a partir de um anúncio, sem expor o telefone sem querer.
- Nenhum custo fixo novo.

**Fora do escopo agora**
- Tabela de desejos, botão de desejo no card e página "perfil do Radar".
- Tela para lojista navegar por desejos e qualquer aviso de desejo.
- Reforma visual completa antes das sessões de teste e da decisão do nome.
- Avisos por WhatsApp, e-mail ou push.
- IA para comparar desejo com anúncio.
- Planos ou preços novos ligados a desejos.
- Novas regiões.

## Alternatives Weighed

| Opção | O que é | A favor | Contra |
| --- | --- | --- | --- |
| A. Só palavras | Trocar "Radar/pedido/proposta" do lado do comprador pelas palavras dos testadores; uma frase na home | Sem mudança no banco; ataca a causa mais provável da confusão | Não entrega nada novo; as palavras certas ainda são hipótese |
| B. Link "procuro algo parecido" | Na página do anúncio, abre o formulário do Radar já preenchido | Quase sem código; reaproveita limites, moderação e contato | Não é um toque; mantém prazo de 15 dias e limite de 10; título curto e outra região falham |
| C. Um coração e uma pergunta depois | Após salvar: "Quer receber ofertas de parecidos?" | Um botão só; nenhum conceito novo no card | Fácil de não ver; você pediu um botão visível |
| D. Item "quieto" com alerta ao comprador | Tabela nova e privada; avisa o comprador quando surgir anúncio parecido; ele chama o vendedor | Tem valor com 1 comprador e 1 vendedor; ninguém libera contato; sem spam | Aviso só dentro do site, alcance fraco; trabalho novo de banco, LGPD e testes |
| E. Lojista vê só totais | Painel "o que procuram na sua cidade", com mínimo de pessoas | Protege o comprador | Vazio com poucos usuários; pode não valer um plano |
| F. Conceito como escrito | Lojista vê cada desejo e aborda o cliente | É o que foi pedido | Maior custo e risco: tabela de ofertas, limites, bloqueio, moderação, textos de privacidade |
| G. Desejo como pedido do Radar | Reusar `radar_pedidos` | Parece mais curto | Rejeitada: entrega telefone, estoura limites, enche lojas de avisos |
| H. Marcar no favorito | Uma marca no favorito | Simples | Rejeitada: some quando o anúncio é apagado |

**Saídas inventivas para os conflitos principais**
- **Conceito novo x confusão:** não criar substantivo. O Radar do comprador vira "coisas que procuro", com dois estados: guardado (só eu sou avisado) e recebendo ofertas (o pedido de hoje).
- **Demanda x privacidade:** inverter. A loja não navega por pessoas; ela responde "Tenho isso" apontando um anúncio dela. O sistema avisa quem procura, e o comprador decide chamar. Nenhum contato é liberado.
- **Lista precisa de gente x zero usuários:** valor para um comprador sozinho (alerta), mais a busca vazia como fonte de demanda. Contra: contar buscas do site foi adiado por custo de banco (`docs/etapa5/relatorios.md:102`).
- **Minimalista x premium:** premium vem de consistência, letra, espaço e foto, não de enfeite. Gastar a "criatividade" em um único elemento de assinatura. Contra: pode parecer truque.
- **Sem referência visual:** fazer 2 ou 3 versões estáticas da home e da página do anúncio e deixar você e os testadores reagirem.

**Outras ferramentas úteis, cada uma com seu melhor contra-argumento**
1. Catálogo de exemplo e roteiro para cadastrar as primeiras 10 lojas. Contra: não escala e esconde a dificuldade real de anunciar.
2. Compartilhar anúncio no WhatsApp com boa imagem de prévia. Contra: leva o tráfego para fora do site.
3. "Ainda disponível?" com um toque e "vendido" fácil. Contra: cobrar o vendedor pode fazê-lo desistir.
4. Painel simples de funil no admin (visitas, cliques no WhatsApp, anúncio iniciado x publicado). Contra: números de 20 pessoas são ruído.
5. "Ver parecidos" em anúncio vendido ou fora do ar. Contra: volta vazio com pouco estoque.
6. QR code impresso e link curto por loja. Contra: ajuda a loja, que é a última prioridade.
7. "Conseguiu falar com o vendedor?" na visita seguinte. Contra: incomoda e só aparece dentro do site.
8. Aviso de queda de preço em favoritos. Contra: só dentro do site, alcance baixo.

## Key Decisions & Staging for Next Steps

**Decisões já tomadas pelo dono (09/11/2026)**
- Favorito e desejo são coisas diferentes: favorito é anúncio salvo; desejo é item do perfil da pessoa no Radar.
- Seguir o **caminho curto**: primeiro consertar a clareza e testar o link "procuro algo parecido" (opção B) com o Radar que já existe. O perfil de desejos, o botão no card e a tela de desejos para lojista ficam adiados e só entram se houver uso (etapa 8).
- Relato dos testadores, dado pelo dono: travaram no botão de anunciar e não entenderam o que é o Radar. Falta saber se travaram antes de tocar no botão ou nas telas seguintes. Ainda não há registro escrito das sessões.

**Decisões que ainda só você pode tomar**
1. Vai rodar o teste de 5 pessoas antes de qualquer reforma? Sem ele, a parte 1 é chute.
2. O nome está fechado? Se não, até quando?
3. Quais 2 ou 3 sites são "premium" para você, e qual você rejeita?
4. Aceita que, na primeira versão, o lojista não aborde o comprador (o comprador é quem chama)?
5. Aceita que o lojista veja só totais, e não pessoas, no início?
6. Aceita que um "procuro" feito no anúncio da loja A apareça como demanda para a loja B?
7. Favoritos e procuras ficam no mesmo lugar com duas abas, ou o Radar segue como aba separada?
8. "Procura" e "busca salva com alerta" viram uma coisa só?
9. Criar uma procura exige WhatsApp confirmado, ou basta estar logado?
10. Quanto dura uma procura antes de perguntar "ainda procura?" e quantas por pessoa?
11. Confirmar: sem WhatsApp, sem IA e sem serviço pago neste escopo.

**Ordem proposta** (cada etapa entrega algo sozinha)

| Etapa | O que fazer | Como saber que deu certo |
| --- | --- | --- |
| 0. Base | Rodar testes, typecheck, lint e build na `main`; comparar as 25 migrações do repositório com produção; atualizar documentos desatualizados | Nota datada com os resultados e nenhuma diferença nas migrações |
| 1. Evidência | 15 a 20 anúncios de exemplo e o teste de 5 pessoas; primeira pergunta: "Para que serve este site?" | Tabela com pessoa, tarefa, conseguiu ou não, tempo, tela e palavra onde parou |
| 2. Nome e domínio | Fechar o nome | Domínio registrado, Clerk de produção destravado |
| 3. Palavras e estrutura | Vocabulário único; tirar a aba de lojista de quem não é lojista; corrigir o destino após confirmar WhatsApp; alinhar "3 passos" e "6 passos" | Os mesmos testes repetidos sem os travamentos da etapa 1 |
| 4. Direção visual | Regra única de letras, texto quase preto, um botão laranja por tela, dois tipos de superfície; 2 ou 3 versões de home e anúncio para você escolher | Você aprova no seu celular; peso dentro do limite de `docs/ARQUITETURA.md:98` |
| 5. Link "procuro algo parecido" | Na página do anúncio, com a palavra escolhida nos testes, e coração no card | Passada manual em celular real; testes existentes verdes |
| 6. Bloqueios de lançamento | Clerk de produção, pagamento real, rotina de moderação, remover a rota de demonstração | Cada item conferido |
| 7. Piloto pequeno | Pedidos colhidos à mão com 5 a 10 lojas e 20 compradores | Meta já escrita: mais de 60% dos pedidos com pelo menos uma proposta (`docs/USABILIDADE.md:96`) |
| 8. Só se houver uso | Tabela de procuras privada, alerta ao comprador, depois painel de totais para lojista | Testes de banco provando que outra conta não lê, que nenhum campo identifica a pessoa e que a exclusão de conta apaga tudo |

**Regra de parada:** se os testadores não souberem explicar, com as próprias palavras, a diferença entre salvar e procurar, entregar só o coração no card e adiar a mudança do Radar.

**Se as lojas não responderem pedidos explícitos no piloto, não vão garimpar desejos passivos.** Nesse caso a parte 3 não deve ser construída.
