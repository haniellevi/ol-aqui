# Vitrine, planos e destaques controlados pelo admin

Autor: Raniel Levi Lemos Lima. Registro: 10/11/2026.

Estado: diagnóstico verificado e proposta de produto para a preparação do piloto. Os números propostos abaixo ainda não foram aplicados. Esta rodada não alterou código da aplicação, planos, cobranças ou configurações em produção.

Critério de sucesso: quem chega entende o que está à venda na região; quem paga entende qual benefício contratou; o administrador consegue configurar apresentação, benefícios e publicidade por escolhas visuais, sem códigos ou JSON.

Princípio: a vitrine precisa ajudar o comprador a encontrar uma oferta. A publicidade financia e destaca essa oferta sem comprometer a busca, e os planos dão recursos ao vendedor.

## O que foi confirmado

A captura enviada corresponde à página inicial da vitrine. O espaço de anúncios aparece vazio e a chamada do Radar vem antes dos anúncios recentes. A rota de entrada comum retorna à home; login iniciado por uma ação deve preservar esse destino. Há uma passagem pela confirmação de celular que ainda precisa preservar a intenção anterior.

O código da home não escolhe o catálogo pelo plano do visitante. No banco consultado nesta rodada, os blocos estão nesta ordem: destaques de produtos, lojas destacadas, Radar, lojas da região e anúncios recentes. Os blocos pagos vazios não aparecem.

| Formato existente | Configuração consultada no banco | O que significa |
| --- | --- | --- |
| Vitrine da página inicial | 8 vagas por região, duração de 7 dias | Capacidade comercial configurada para anúncios em destaque |
| Loja em destaque | 6 vagas por região, duração de 7 dias | Capacidade comercial configurada para lojas |
| Destaque na busca | Sem limite de vagas, duração de 7 dias | Prioridade na busca, categoria e também na grade recente da home |
| Subir | Sem limite de vagas, ação única | Atualiza a posição na ordenação por recentes; não cria um espaço visual próprio |

As consultas dos carrosséis carregam até 12 itens por padrão. Isso é diferente de vagas vendidas e de cards visíveis ao mesmo tempo, que dependem da largura da tela. A ordem dos carrosséis muda por hora; a dos patrocinados na busca muda por dia. Esse rodízio não mede nem garante igualdade de impressões.

Os planos consultados têm estes benefícios configurados:

| Plano | Anúncios | Radar do vendedor | Recursos da loja | Créditos por mês |
| --- | --- | --- | --- | --- |
| Grátis PF | Até 3 | Sem propostas | Sem fachada, seções ou fixados adicionais | Nenhum |
| Teste grátis | Até 10 | Até 3 propostas | Sem fachada, seções ou fixados adicionais | Nenhum |
| Slim | Até 10 | Propostas sem limite configurado | Fachada, 3 seções e 3 produtos fixados | 2 usos de Subir |
| Full | Sem limite configurado | Propostas sem limite configurado | Fachada, 10 seções e 6 produtos fixados | 4 usos de Subir |

Esses limites são os valores observados, não uma recomendação de preços ou promessa de desempenho. Produtos fixados ficam na página da própria loja; não representam vagas compradas na home. O plano pago não destaca automaticamente todos os anúncios.

## Entrada recomendada

Manter uma vitrine regional comum para visitantes, contas gratuitas e contas pagas. Não exigir cadastro só para olhar o catálogo. Após uma entrada comum, mostrar a vitrine; após login solicitado por Anunciar, Favoritar ou outra ação, concluir a ação original. O painel do vendedor fica acessível por Minha conta.

Proposta de ordem para a home:

1. Cidade/região, busca e categorias, com cabeçalho compacto no celular.
2. Uma faixa curta de produtos patrocinados, apenas quando houver campanhas válidas.
3. Feed de anúncios da região, com foto, preço, local e acesso ao vendedor.
4. Lojas destacadas e lojas da região.
5. Chamada do Radar, também disponível no menu e nos estados sem resultado de busca.

O primeiro conteúdo deve ser uma oferta real. A faixa paga não pode empurrar o catálogo comum para depois de várias telas; no celular, ela ocupa somente uma linha. Se não houver patrocínios, o feed sobe automaticamente. Sem anúncios disponíveis, mostrar o estado vazio com opções de buscar em outra região e pedir no Radar, sem inserir ofertas fictícias.

O maior limite do screenshot é a falta de oferta visível. Alterar a hierarquia melhora a entrada, mas a chegada dos compradores também depende de anúncios reais, atuais e aprovados dos lojistas participantes.

## Quantidade e apresentação propostas

Manter três lugares de publicidade e o impulso Subir já existente, evitando criar vários banners novos no piloto.

| Lugar | Proposta inicial de apresentação | Capacidade comercial |
| --- | --- | --- |
| Produtos na home | Uma faixa; alvo de 4 cards por vista no desktop e 2 no celular, adaptando a telas menores | Manter inicialmente as 8 vagas por região; os demais cards ficam acessíveis no carrossel |
| Lojas em destaque | Uma faixa compacta de lojas, com nome, imagem e acesso à loja | Manter inicialmente as 6 vagas por região |
| Busca, categorias e feed recente da home | No máximo 2 posições patrocinadas em cada conjunto de até 24 resultados; sem repetir o mesmo anúncio na parte comum daquele conjunto | O limite de exibição é uma regra nova. A capacidade comercial precisa ser finita e definida antes de ampliar a venda desse formato |
| Subir anúncio | Ação única que atualiza a posição entre os recentes | Não ocupa uma vaga de banner ou de carrossel |

Para a busca, usar posições predefinidas e identificadas como Patrocinado. Região, categoria, texto pesquisado e filtros continuam valendo. A lista comum respeita a ordenação escolhida pelo comprador. Abaixo de 24 resultados, a quantidade patrocinada deve cair proporcionalmente, mantendo espaço para resultados comuns; não preencher uma busca sem correspondências com publicidade irrelevante. Aplicar o mesmo limite ao feed recente da home, que hoje também recebe o formato Destaque na busca, mantendo a ordenação comum por recentes no restante da grade. O carrossel de produtos continua sendo uma contratação separada. A regra exata de composição e paginação deve ser especificada antes da implementação, incluindo o caso em que só existem correspondências patrocinadas.

O destaque visual usa posição, etiqueta Patrocinado e uma borda/fundo discreto padronizado. Evitar cards gigantes, animações insistentes e pop-ups. O pagamento não concede o selo de loja verificada. Preservar contraste, leitura de preço, foco de teclado e identificação textual do patrocínio.

Todos os planos continuam vendo as mesmas ofertas. Para vender, o plano determina limites e ferramentas; a campanha determina qual anúncio ou loja ganha exposição e por quanto tempo. Manter os créditos atuais de Subir como ponto de partida. Incluir créditos de home, busca ou loja em um plano exige compatibilizar a promessa com as vagas disponíveis. Crédito não pode ser apresentado como vaga imediatamente garantida.

## Admin por escolhas visuais

Reaproveitar as telas e os dados existentes, organizando as opções conforme a tarefa do administrador. Não criar um construtor genérico de publicidade.

| Área | Escolhas que o administrador faz | Controle recomendado |
| --- | --- | --- |
| Página inicial | Ordem das seções | Cartões com botões Subir e Descer, já existentes para blocos |
| Página inicial | Mostrar Radar e seções opcionais | Chave ligado/desligado com explicação curta |
| Página inicial | Densidade dos cards e posição do Radar | Botões de escolha entre layouts prontos, acompanhados de prévia |
| Planos | Público, recursos da loja e acesso ao Radar | Selects, caixas de seleção e chaves |
| Planos | Limites de anúncios, propostas, seções e créditos | Opções predefinidas e botões +/−; opção Sem limite explícita quando permitida |
| Destaques | Local, duração, quantidade exibida, vagas e limite por anunciante | Selects e botões +/− com limites validados |
| Destaques | Formato visual | Opções ilustradas de estilos aprovados, sem digitar cores ou classes |
| Campanhas | Anúncio ou loja que receberá destaque | Seletor pesquisável com foto, título, dono e região, sem colar UUID ou link |
| Campanhas | Data, duração e cortesia | Calendário, select e botão de escolha |
| Abrangência | Configuração geral ou exceção regional suportada | Select de região e indicação de quando o valor geral está sendo usado |
| Preços | Valor em reais | Valor formatado em R$ com ajustes por botões, preservando os valores existentes; sem cálculo de centavos |

Nome, descrição e outros textos livres continuam editáveis. Para as regras e escolhas enumeradas acima, digitação não deve ser obrigatória. A busca dentro de um seletor apenas filtra registros existentes e não exige memorizar códigos.

Mostrar uma prévia local para Celular e Computador antes de salvar, e um resumo legível: local da exposição, duração, vagas disponíveis, quantidade por vista e regra de rodízio. O administrador precisa enxergar o que o comprador verá, não apenas uma lista de parâmetros.

Hoje já existem selects para alguns campos, chaves de ativação, preços em reais nas telas comerciais e botões de reordenação da home. Ainda faltam a composição visual do conjunto e controles específicos para limites de exposição. A página genérica de configurações ainda aceita listas, mapas e JSON; essas estruturas devem ficar escondidas das tarefas comerciais usuais.

Alterações de preço, duração e disponibilidade precisam informar o efeito sobre novas contratações e campanhas em andamento. Não esconder um espaço com campanhas ativas nem reduzir sua exposição prometida silenciosamente. Desligar novas vendas deve ser uma escolha diferente de interromper a veiculação de algo já contratado.

## Pontos fracos que mudam a prioridade

1. A busca coloca todos os patrocinados antes dos demais. Ela pode preencher a primeira página com publicidade e contrariar a ordenação por preço dentro do grupo patrocinado. O limite e a composição da lista precisam ser corrigidos antes de usar esse formato de forma relevante no piloto.
2. O admin permite elevar vagas até 1.000 enquanto a interface carrega 12 por carrossel. A tela deve impedir configurações incompatíveis ou explicar e implementar o rodízio contratado. Não vender presença em toda visita quando a entrega é rotativa.
3. O teto de vagas tem exceções: cortesia pode ultrapassá-lo e há um caminho de pagamento tardio com reserva vencida que requer revisão. A disponibilidade precisa ser respeitada também em concorrência, reenvio de pagamento e cortesia. Pagamento sem vaga exige tratamento explícito, sem criar uma campanha invisível.
4. O relatório atual agrega visitas e cliques ocorridos na vigência, inclusive orgânicos. Não chamar esse total de resultado gerado pelo anúncio pago ou de vendas concluídas. Para atribuição paga, registrar o local de exposição e o clique correspondente; negócios reais precisam de confirmação separada.
5. A confirmação de celular pode perder o destino de uma ação iniciada dentro da conta. O teste de retorno deve cobrir esse caminho, além do login comum.

## Ordem de desenvolvimento

Primeiro, colocar ofertas no centro da entrada e preservar o retorno após autenticação. Em seguida, organizar os controles existentes do admin por tarefa e acrescentar escolhas de apresentação com prévia. Depois, implementar limites coerentes de exposição e capacidade, incluindo a concorrência de reservas e pagamentos. Concluir com ensaio do fluxo de uma campanha, teste móvel e verificação de acesso por perfis diferentes.

O piloto acompanhado pode validar exposição usando cortesias administradas, sem tornar a contratação paga uma condição para testar demanda e resposta das lojas. A venda efetiva de destaque precisa da capacidade, descrição da entrega e tratamento de pagamento tardio resolvidos. Essa é uma proposta de operação, não uma ativação ou alteração de cobrança.

Domínio, identificação pública e contatos ficam para o final do desenvolvimento, conforme solicitado, e devem estar preenchidos antes dos convites externos.

## Verificação de aceite

- Visitante, conta grátis e conta paga encontram a mesma oferta regional, respeitadas as diferenças de ação e permissões.
- Entrar normalmente abre a vitrine; entrar para concluir uma ação retorna a essa ação, inclusive após confirmação do celular.
- Produtos aparecem antes da chamada ampla do Radar, e blocos vazios não ocupam espaço.
- Toda presença patrocinada tem identificação; assinatura paga e selo de verificação permanecem conceitos distintos.
- O administrador configura regras com seletores e botões, consegue escolher o alvo visualmente e antever o resultado no celular.
- Quantidade exibida, capacidade vendida e limite por anunciante têm rótulos distintos e validação consistente no servidor.
- Busca conserva filtros, ordenação da parte comum e paginação sem duplicar anúncios nem omitir resultados por causa da inserção paga. O feed recente também respeita o limite de inserções patrocinadas e ordena os demais itens por recentes.
- Esgotamento de vagas, pagamento tardio, cortesia e mudança de configuração não geram venda sem entrega ou interrupção silenciosa de campanha vigente.

## Base da análise

Código local observado na branch `codex/refino-conta-painel`, HEAD `29350ba`, com alterações de interface em andamento. Esses arquivos foram apenas lidos nesta rodada; a análise não afirma que todas as alterações locais estão publicadas. Configurações, planos e créditos foram conferidos por SELECT no projeto Supabase `ncrbqqdgweuqpsppxwti` em 10/11/2026.

- [Entrada e destino do login](/home/raniel-linux/workspace/OLAQUI/src/app/entrar/[[...entrar]]/page.tsx:16).
- [Composição da home](/home/raniel-linux/workspace/OLAQUI/src/app/(publico)/page.tsx:45) e [ordem dos blocos](/home/raniel-linux/workspace/OLAQUI/src/lib/dados/paginas.ts:145).
- [Formulário de planos](/home/raniel-linux/workspace/OLAQUI/src/app/admin/planos/form-plano.tsx:1), [formulários de destaques](/home/raniel-linux/workspace/OLAQUI/src/app/admin/destaques/formularios.tsx:24) e [reordenação da home](/home/raniel-linux/workspace/OLAQUI/src/app/admin/textos/forms.tsx:245).
- [Tipos e vagas](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107030500_destaques.sql:15), [rodízio dos carrosséis](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107030500_destaques.sql:931) e [ordenação da busca](/home/raniel-linux/workspace/OLAQUI/supabase/migrations/20261107030500_destaques.sql:1103).
- [Apresentação do patrocínio](/home/raniel-linux/workspace/OLAQUI/src/components/anuncio/card-anuncio.tsx:23).

Participaram duas inspeções técnicas independentes, de entrada/vitrine e de espaços pagos. Esta extensão do diagnóstico não passou por uma nova rodada formal das sete lentes EGM.
