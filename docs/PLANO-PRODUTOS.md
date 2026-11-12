# Plano: reestruturação dos produtos (anúncios)

Decidido com o Raniel em 11/11/2026 (rodadas de perguntas do /grill-me).
Marca: **Mercado da Região** (não usar mais "OLAKI" em textos novos).

Objetivo: todo produto do site segue um padrão. Tem categoria certa, nome fixo
(slug), campos padronizados, histórico de quem mexeu e números medidos. Assim,
as buscas e os cadastros viram dados úteis para o vendedor, para a região e
para o admin.

## O que já existe (não refazer)

| Assunto | Hoje | Onde |
|---|---|---|
| Rascunho | Cada passo do cadastro salva. Dá para continuar em Meus anúncios › "Continuar rascunho". Máximo de 20. | `src/app/(conta)/anunciar/actions.ts`, `src/components/conta/acoes-anuncio.tsx` |
| Excluir anúncio | "Mover para lixeira" com confirmação. Lixeira de 30 dias, com restauração. | `mover_anuncio_lixeira`, migrations `20261109190459`, `20261111011000` |
| Lixeira de loja e conta | Lixeira de 30 dias em cascata (conta › loja › anúncios). Purga por rotina. | `20261111011000_*` |
| Equipe | Papéis: administrador, moderador, financeiro, suporte, franqueado (preso à região). | `public.equipe`, `meu_papel()`, `tem_papel()` |
| Gerente de loja | O dono convida pelo WhatsApp (até 20). O convite aceito é o vínculo. As ações passam por RPC. | `convites_gerente_loja`, `src/app/convite-loja` |
| Categorias | 2 níveis (`pai_id`), `slug` único, `campos` jsonb, faixa de preço. 10 grandes e cerca de 40 subs. | `20261107020000_categorias_e_anuncios.sql` |
| IA de categorias | Sugere uma categoria **existente** para anúncios de loja. O dono confirma em "Revise suas categorias". Desligada. | `20261111040000_categorizacao_ia.sql` |
| Números | `eventos_anuncio` (visualização, WhatsApp, compartilhar), `eventos_loja`, `buscas_termos`, `robo_buscas_vazias`, `visitas`. | várias |

**O que falta:**
- sugerir categoria nova;
- 3º nível de categoria;
- o admin editar ou excluir qualquer anúncio;
- super admin;
- equipe do Mercado da Região como ajudante;
- slug guardado no anúncio;
- aparições na busca e tempo até vender;
- histórico visível ao dono;
- "Descartar rascunho" dentro do cadastro.

## Decisões

### Categorias
1. **Árvore com 3 níveis**: Grande › Sub › Tipo.
   - O anúncio fica sempre no nível mais fundo que existir.
   - Busca e filtros entendem os 3 níveis: escolher "Pet" mostra tudo que está abaixo.
2. **Base da árvore**: as 23 categorias grandes da OLX e as subcategorias dela, com nomes simples. Também mantém o que é forte na região:
   - Agro: Grãos, Gado e animais, Sementes e insumos;
   - Serviços locais: pedreiro, eletricista, fretes, diaristas, aulas;
   - Empregos.
   - A árvore lida na OLX está no Anexo A.
3. **O 3º nível é o tipo de produto.** Exemplo: Pet › Produtos para pets › Ração. O animal, a marca e o tamanho viram **campos** e filtros.
4. **Campos por categoria**:
   - 2 ou 3 obrigatórios por categoria, o resto opcional;
   - listas de opções sempre que possível, para os filtros funcionarem.
5. **Sugerir categoria**:
   - Na busca de categoria do cadastro, quando nada bate, aparece "Sugerir a categoria "Ração"".
   - O vendedor escolhe a categoria mais próxima da lista, e o anúncio **vai ao ar nela**.
   - A sugestão fica guardada (texto, categoria próxima, quem, quando).
6. **Aprovação só do super admin**, numa tela que junta sugestões parecidas (sem acento, singular e plural, erros de digitação). O que ele pode fazer:
   - **aprovar**: a categoria é criada no lugar sugerido;
   - **aprovar com outro nome ou lugar**;
   - **juntar** com uma categoria que já existe;
   - **recusar**: o anúncio fica onde está.
   - Depois de aprovar ou juntar, os anúncios ligados à sugestão **mudam sozinhos** e cada vendedor recebe um aviso no sino.
7. **Troca dos anúncios atuais**:
   - Uma tabela de troca liga cada categoria antiga a uma nova, e os anúncios mudam sozinhos.
   - Quando a troca é duvidosa, o anúncio entra em "Revise suas categorias" para o dono confirmar.
   - Sem IA, custo zero.

### Slug e números
8. **Slug fixo com código curto**, por exemplo `/anuncio/racao-golden-15kg-a7k2`.
   - É gerado ao publicar e guardado no anúncio.
   - Editar o título não muda o endereço.
   - O endereço antigo (`/anuncio/<uuid>-<titulo>`) leva ao novo (redirecionamento 301).
   - Padrão de nomes do sistema: slug só com letras minúsculas, sem acento, palavras separadas por hífen, até 60 letras. Vale para anúncio, loja e categoria.
9. **Medir em cada produto**:
   - vistas, cliques no WhatsApp, favoritos e compartilhamentos;
   - aparições na busca e nas listas, com a posição;
   - termos de busca que levaram até o produto;
   - tempo até vender, pausar ou excluir.
   - Os números são sempre somados por dia, sem guardar quem é a pessoa (mesmo cuidado de `eventos_loja`: só um resumo embaralhado do visitante).
10. **Quem vê os números**:
    - o dono vê os dos próprios produtos;
    - o ajudante vê os da loja em que trabalha;
    - o super admin vê tudo, somado por categoria, região e produto.

### Cargos, ajudantes e exclusão
11. **Super admin**: um papel novo `super_admin`, acima de `administrador`.
    - Começa só com a conta do Raniel e pode ser passado depois.
    - Só ele pode:
      - aprovar categorias;
      - "Apagar de vez agora";
      - criar loja para transferir;
      - editar qualquer anúncio.
12. **Ajudante pelo convite de gerente que já existe**, ampliado:
    - o convidado pode ser um funcionário do dono ou alguém da **equipe Mercado da Região**, que aparece com a marca "Equipe Mercado da Região";
    - o gerente comum mexe só na loja que o convidou;
    - um admin da equipe pode estar em **várias lojas**, mas trabalha em **uma de cada vez**: escolhe a loja num seletor "Trabalhando na loja X" e só mexe nela. Não há edição em várias lojas de uma vez.
13. **Permissões do ajudante**:
    - pode criar, editar, pausar e mandar anúncios para a lixeira, e editar os dados da loja;
    - não pode excluir a loja, mudar o plano nem ver pagamentos.
14. **Histórico visível ao dono**, por exemplo: "Editado por Ana (Equipe Mercado da Região) em 12/11". Aparece na loja e em cada anúncio.
15. **Super admin cria e transfere**: monta a loja e os produtos e manda um convite para o dono assumir. Quando o dono aceita, tudo passa a ser dele, e o super admin vira ajudante se o dono quiser.
16. **Excluir**:
    - "Descartar rascunho" em todos os passos do cadastro e "Excluir anúncio" no fim da edição. Os dois com alerta e lixeira de 30 dias.
    - Só o super admin tem "Apagar de vez agora", com alerta forte e o nome do item digitado. Vale para anúncio, loja e usuário, e fica registrado.

## Etapas (nesta ordem)

Cada etapa vira um PR próprio, com testes do banco (`supabase/testes`) e da tela (`tests/*.test.cjs`). Migrações só entram em produção depois que o código estiver no ar, com o "sim" do Raniel.

### Etapa P1 — Árvore de 3 níveis e campos
- Migração:
  - permitir o 3º nível (`pai_id` de uma sub; trava para no máximo 3 níveis);
  - coluna `nivel` calculada;
  - função `categoria_e_descendentes(id)` para a busca.
- Carga da árvore nova (OLX + regional), com `campos` por categoria (2 ou 3 obrigatórios).
- Tabela `categorias_troca (antiga_id, nova_id, certa boolean)` e rotina que move os anúncios. Os duvidosos (`certa=false`) vão para "Revise suas categorias".
- Telas:
  - escolha de categoria em 3 passos, com a busca entendendo os 3 níveis;
  - filtros da busca por nível e por campo.
- **A conferir antes**: subcategorias de Moda, Câmeras, Música, Serviços e Empregos e os campos de cada categoria. A OLX não mostrou isso ao robô, então a proposta será montada por nós e revisada pelo Raniel antes de carregar.

### Etapa P2 — Sugerir categoria
- Tabela `categorias_sugeridas`:
  - texto e texto normalizado;
  - categoria próxima, anúncio, autor e estado (pendente, aprovada, juntada, recusada);
  - categoria final e quem decidiu.
- Botão "Sugerir categoria" na escolha de categoria do cadastro.
- Tela do admin "Categorias sugeridas", agrupada por texto normalizado, com aprovar, aprovar com outro nome ou lugar, juntar e recusar. A decisão move os anúncios e avisa no sino.

### Etapa P3 — Slug e padrão de nomes
- Coluna `anuncios.slug` (única), gerada ao publicar: título normalizado + 4 letras.
- Rota nova e redirecionamento 301 do formato antigo.
- Função única de slug no banco e no código, usada por anúncio, loja e categoria.

### Etapa P4 — Métricas do produto
- `eventos_anuncio` ganha: `favoritar`, `aparicao` (com posição e página), `termo` (palavra que levou ao produto).
- Tabela diária somada `anuncios_numeros_dia`.
- Tempo até sair calculado de `publicado_em` até vendido, pausado ou excluído.
- Telas:
  - números por produto para o dono, junto ao "Desempenho da loja";
  - painel do super admin por categoria, região e produto.

### Etapa P5 — Super admin, ajudantes e histórico
- Papel `super_admin` em `equipe`, com `e_super_admin()`. Ações exclusivas: aprovar categoria, apagar de vez, editar qualquer anúncio, criar e transferir loja.
- Convite de gerente ampliado:
  - marca "Equipe Mercado da Região" quando quem aceita é da equipe;
  - seletor "Trabalhando na loja X" para quem está em várias lojas;
  - toda ação de ajudante passa a loja escolhida e o banco confere o vínculo.
- Tabela `historico_alteracoes (alvo, alvo_id, quem, papel, acao, quando)` e linha "Editado por…" no anúncio e na loja.
- Admin: editar e excluir qualquer anúncio. "Apagar de vez agora" com o nome digitado.
- Criar loja e transferir: a loja nasce com dono provisório e um convite de posse que o dono aceita.

**Divisão do P5 (decidida em 13/11/2026):**
- **P5a** — papel `super_admin` (coluna `perfis.e_super_admin`, ligada só pelo banco), histórico (`historico_alteracoes`, linha "Última mudança" e página "Histórico" no anúncio e na loja), lixeira de anúncio pela equipe com motivo e aviso ao dono, "Apagar de vez agora" só do super admin e só para o que já está na lixeira (conta, loja e anúncio). Aprovar categoria passa a ser só do super admin.
- **P5b** — ajudantes (gerente cria, edita, pausa e manda anúncios para a lixeira; nome e WhatsApp da loja só o dono), marca "Equipe Mercado da Região", seletor de loja e **super admin edita o anúncio dos outros na mesma tela do vendedor** (mesma base dos ajudantes).
  - Decidido em 13/11/2026: seletor "Trabalhando na loja X" no topo da área do vendedor; ajudante cria e publica (conta no plano da loja e passa pela mesma moderação); também cuida de Seções próprias, Produtos no topo e vê Desempenho; não mexe em Destacar, plano, pagamento nem em apagar a loja; todos os ajudantes têm as mesmas permissões; mudanças do ajudante só vão para o histórico (sem sino). Super admin: botão "Editar anúncio" no painel, motivo digitado uma vez ao abrir, vale por 2 horas, dono recebe 1 aviso no sino com o motivo.
  - Entrega em 2 PRs: **P5b-1** (ajudante nos anúncios, seletor de loja, selo da equipe) e **P5b-2** (ajudante nos dados da loja, seções, topo e desempenho; super admin edita anúncio dos outros).
  - P5b-2 dividido em **P5b-2a** (super admin edita anúncio dos outros; PR #113, no ar) e **P5b-2b** (ajudante na Minha loja).
  - Decidido em 12/11/2026 para a P5b-2b: o ajudante também troca capa (foto ou modelo), logo, cidade e bairro; não usa o que gasta IA do dono (capa feita pelo Merc, "Melhorar com IA" e revisão de categorias pela IA). A Minha loja segue a loja escolhida no seletor; nome e WhatsApp aparecem só para leitura.
- **P5c** — criar loja e transferir para o dono.
  - Decidido em 12/11/2026:
    - a loja montada fica **escondida** (estado "montagem") até o dono aceitar; só a equipe vê;
    - só aceita quem **ainda não vende** no site; quem já tem loja vê o aviso "fale com a equipe";
    - o **teste grátis começa no aceite**;
    - no aceite, o dono escolhe se a equipe continua como ajudante (caixa **desmarcada**);
    - os produtos que a equipe marcou como prontos **vão ao ar sozinhos** no aceite, com as conferências de sempre; o que falhar fica como rascunho.
  - Como funciona:
    - Painel › Lojas › "Montar loja para um dono" (só super admin): nome, endereço, região e cidade.
    - A loja nasce com um dono provisório técnico e sem WhatsApp. O super admin cuida dela pelo seletor, como ajudante. Publicar ali deixa o produto "pronto".
    - Na ficha da loja: "Cuidar da loja", "Cadastrar produto" e o convite (WhatsApp do dono, vale 7 dias, um por vez, com botão "Enviar pelo WhatsApp").
    - O dono abre `/receber-loja`, confirma o WhatsApp e aceita. A loja ganha o WhatsApp dele e vai ao ar.
    - O servidor leva as fotos para a pasta do dono e publica os prontos. Se falhar, a Minha loja mostra "Terminar de receber a loja".
    - Suspender e reativar uma loja em montagem a devolve para a montagem: ela nunca vai ao ar sem dono.

### Etapa P6 — Excluir dentro do cadastro
- "Descartar rascunho" em todos os passos de `/anunciar`, e "Excluir anúncio" no fim da edição, com o mesmo diálogo de `acoes-anuncio.tsx`.
- Decidido com o Raniel em 12/11/2026:
  - o botão fica no fim da página, em texto vermelho, embaixo do formulário (fora da barra fixa do "Continuar");
  - depois de confirmar, a pessoa vai para Meus anúncios › Lixeira, com o aviso "Anúncio movido para a lixeira" e o botão Restaurar.
- Como funciona: `src/components/anunciar/descartar-anuncio.tsx`. Usa `descartarAnuncio`: a mesma regra do menu "Mais" (`mover_anuncio_lixeira`) e, depois, passa o seletor para a loja do anúncio, para a aba Lixeira abrir na loja certa; sem mudança no banco.
  - Rascunho: "Descartar rascunho" nos 6 passos.
  - Anúncio publicado (editando): "Excluir anúncio" só no último passo (Revisar), com o aviso de pagamento quando há avulso pago, destaque no ar ou destaque esperando pagamento (mesmo critério de Meus anúncios).
  - Super admin editando anúncio de outra pessoa não vê o botão: usa a lixeira do painel, que avisa o dono.
  - Dono e ajudante podem descartar (a função do banco confere quem cuida da loja).

### Categorias, Etapa 2 — IA sugere a categoria ao anunciar
- Teste de 12/11/2026 com 80 títulos (50 fáceis e 30 difíceis):
  - JEV (TypeSafe) acertou 78 de 80 na 1ª opção. Gemini Decisions acertou 80 de 80.
  - Os dois acertaram 80 de 80 entre as 3 primeiras opções.
  - O JEV foi mais rápido e mais barato. O Raniel escolheu o JEV como principal.
- Como funciona:
  - Em `/anunciar/categoria`, 0,5 s depois que a pessoa para de digitar em "O que você está anunciando?", o servidor pergunta ao JEV.
  - Até 3 categorias finais (com chance de 5% ou mais) vão para o topo da lista "categorias parecidas", sem repetir a busca local.
  - Se a busca local não acha nada, "Sugerir a categoria" e Outros › Diversos continuam aparecendo.
- O que vai para a IA:
  - só o texto digitado (até 90 letras);
  - as categorias finais com o caminho;
  - uma dica para Serviços e Empregos;
  - as palavras de exemplo da P1 (`src/lib/categorias-palavras.ts`).
- Arquivos: `src/lib/sugestao-categoria-ia.ts` e a ação `categoriasSugeridasIA`.
- Limites:
  - só com login;
  - 30 pedidos por minuto por pessoa e 300 no total, em cada servidor;
  - a lista de categorias fica guardada por 5 min em cada servidor (categoria nova entra na IA em até 5 min);
  - prazo de 2,5 s;
  - liga com `TYPESAFE_API_KEY`. Sem a chave, ou com qualquer falha, fica só a busca local, sem aviso.
- Falta:
  - guardar o que a IA sugeriu e o que a pessoa escolheu;
  - um painel no admin mostrando onde a IA erra;
  - Gemini como reserva, se o JEV ficar fora do ar.

## Riscos e pontos em aberto
- **Troca da árvore** mexe em todos os anúncios. Antes de rodar em produção:
  - fazer uma cópia da tabela;
  - rodar primeiro em teste;
  - conferir quantos ficaram "duvidosos".
- **Links antigos**: anúncios compartilhados no WhatsApp precisam continuar abrindo (redirecionamento 301 na P3).
- **Super admin** é poder total. Ele precisa de registro de cada ação e de confirmação forte. A conta precisa de verificação em duas etapas no Clerk.
- **LGPD**: as métricas guardam números somados, nunca quem viu. Os termos de busca são guardados sem ligação com a pessoa.
- **Rename da marca**: textos novos usam "Mercado da Região". A troca do nome no resto do site é outra tarefa.

## Anexo A — Árvore da OLX (lida em 11/11/2026)
Lida nas páginas de categoria do olx.com.br, pelo navegador do Raniel, sem login.
Os campos de cada categoria não foram lidos.

- Imóveis: Padrão, Sítio/fazenda/chácara, Terrenos/sítios/fazendas, Imóvel novo, Outros
- Autos: Autopeças, Carros/vans/utilitários, Caminhões, Motos, Ônibus, Barcos e aeronaves
- Celulares e Telefonia: Acessórios de celular, Peças de celular, Smartwatches, Telefonia fixa, Acessórios de smartwatch
- Casa, Decoração e Utensílios: Decoração, Utensílios de cozinha, Iluminação, Área externa, Jardinagem e plantas, Cama/mesa/banho, Banheiro e limpeza, Segurança residencial, Casa inteligente
- Móveis: Camas e colchões, Guarda-roupa, Racks e painéis, Mesas, Escrivaninhas e penteadeiras, Bancos e cadeiras, Sofás e poltronas, Organização
- Eletro: Fogões e fornos, Geladeiras e freezers, Portáteis de cozinha e limpeza, Lavadoras e secadoras, Portáteis de cuidados pessoais, Ventiladores e climatizadores, Ar-condicionado
- Materiais de Construção: Ferramentas de pintura, Ferramentas de construção, Elétrica e hidráulica, Torneiras/duchas/vasos, Cubas e pias, Portas e janelas, Alvenaria, Pisos e revestimentos, Fundação e estrutura
- Informática: Computadores, Notebooks, Monitores, Armazenamento, Memória RAM, Placas de vídeo, Tablets e leitores, Periféricos, Peças de hardware, Rede, Processadores
- Games: Jogos, Consoles, Acessórios
- TVs e vídeo: TVs, Streaming, Acessórios para TV, DVD/Blu-ray, Projetores
- Áudio: Fones, Microfones e gravadores, Aparelhos de som, Equipamentos de som
- Comércio: Equipamentos para comércio, Gastronomia e hotelaria, Equipamentos médicos, Uniformes e EPIs
- Escritório: Cadeiras, Móveis, Papelaria, Itens para escritório
- Esportes e Fitness: Roupas esportivas, Academia, Calçados esportivos, Esportes sobre rodas, Aquáticos, Ciclismo, Quadra, Acampamento
- Artigos infantis: Roupas infantis, Calçados infantis, Roupas de bebê, Calçados de bebê, Brinquedos e jogos, Maternidade, Móveis infantis
- Animais de estimação: Acessórios para pets (3º nível por animal), Gatos, Cachorros, Roedores, Outros animais
- Agro e indústria: Animais para agropecuária, Apicultura, Máquinas industriais, Peças de tratores, Tratores e máquinas agrícolas, Máquinas pesadas, Outros
- Festas e Casamentos: Convites, Decoração, Balões, Topos de bolo, Lembrancinhas, Noivas e noivos, Outros
- Câmeras e Drones, Moda e beleza, Música e hobbies, Serviços, Vagas de emprego: subcategorias não lidas.
