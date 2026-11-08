# Etapa 5 · Painel: Regiões e cidades (tela 7) e Categorias e campos (tela 9)

Nota para quem desenvolve. Base: `PAINEL-ADMIN.md` telas 7 e 9, `PRODUTO-CONTAS-ANUNCIOS-ROBO.md` seção 3
(categorias em tabela) e as tabelas que já existem: `microrregioes` e `cidades` (`20261107010100_painel_admin.sql`)
e `categorias` com `campos` em JSON (`20261107020000_categorias_e_anuncios.sql`).
Regra de ouro mantida: nada fica no código. Cidades, regiões, categorias, campos e limites de preço ficam nas
tabelas, o painel edita e **toda mudança cai em `logs_atividade`** (gatilhos `registrar_log`).

Migração: `supabase/migrations/20261108040000_regioes_categorias.sql` · Testes: `supabase/testes/96_regioes_categorias.sql`
Tipos: `src/lib/tipos-cadastros.ts` · Leituras do painel: `src/lib/admin/cadastros.ts` ·
Conferência dos campos (TypeScript, a mesma regra do banco): `src/lib/admin/campos-categoria.ts`
Telas: `src/app/admin/regioes/*` e `src/app/admin/categorias/*` (menu: "Regiões" e "Categ." em `nav-admin.tsx`) · Rotas: `LINK_ADMIN_REGIOES`, `LINK_ADMIN_CATEGORIAS` em `src/lib/rotas.ts`.

## 1. O que já existia (e continua igual)

- `categorias`: árvore de 2 níveis (`pai_id`), `ordem`, `ativa`, `icone`, `campos` (lista JSON), `preco_min_centavos`,
  `preco_max_centavos`, `tipo_legado`. `validar_campos_categoria()` já recusa tipo desconhecido, lista sem opções,
  chave repetida. `validar_categoria()` já recusa 3º nível. Log já existe (`log_categorias`).
- O cadastro de anúncio (`/anunciar/*`), a busca (`buscar_anuncios`, `src/components/busca/parametros.ts`) e o robô
  leem as categorias **na hora** (páginas dinâmicas, sem cache entre requisições). A moderação
  (`filtro_moderacao`) lê `preco_min_centavos`/`preco_max_centavos` da categoria do anúncio direto da tabela.
  Ou seja: o que o painel salva já vale no próximo acesso. As ações chamam `revalidatePath("/", "layout")` por garantia.
- `cidades`: `microrregiao_id`, `nome`, `uf`, `ativa`. Os seletores públicos (perfil, passo "Local", busca, Radar,
  loja) já usam só `ativa = true` (`listarCidades`). O Radar já recusa cidade inativa.
- Anúncios, lojas, perfis e pedidos guardam a cidade **pelo nome** (texto). Por isso cidade em uso não muda de nome
  nem é apagada: o histórico continuaria apontando para o nome antigo.

## 2. Banco: o que a migração acrescenta

### Regiões e cidades

| Peça | Tipo | Regra |
|---|---|---|
| `uso_cidade(regiao, nome)` | função (só admin/servidor) | Conta anúncios (qualquer status), lojas/vendedores, pessoas e pedidos do Radar daquela cidade na região (comparação sem acento) |
| `validar_cidade()` → gatilho `cidades_validar` | BEFORE INSERT/UPDATE em `cidades` | Nome 2 a 80 letras (espaços limpos); UF uma das 27 siglas (maiúscula); a mesma cidade (nome sem acento + UF) não pode estar em **duas** regiões; não troca de região; cidade em uso não muda de nome nem UF; a cidade-sede não pode ser desativada |
| `impedir_apagar_cidade()` → gatilho `cidades_impedir_apagar` | BEFORE DELETE | Recusa apagar cidade com anúncios, lojas, pessoas ou pedidos ("desative para sumir das listas e manter o histórico") e a cidade-sede |
| `log_cidades` | AFTER INSERT/UPDATE/DELETE | Histórico (não existia) |
| `validar_microrregiao()` → gatilho `microrregioes_validar` | BEFORE INSERT/UPDATE | Nome 2 a 80 letras; `slug` não muda depois de criado (o código e os links usam, ex.: região-piloto `corrente-pi`); sede precisa ser uma cidade **ativa** da região (grava o nome do jeito certo). Região ainda sem cidade aceita a sede escrita (a função de criar já cria as duas juntas) |
| `impedir_apagar_regiao()` → gatilho `microrregioes_impedir_apagar` | BEFORE DELETE | Recusa apagar região com pessoas, lojas, anúncios, pedidos ou pagamentos; diz o que tem |
| `admin_regioes()` | SECURITY DEFINER, só admin | Lista as regiões com sede, cidades (total e ativas), lojas, vendedores pessoa física, anúncios no ar e pessoas |
| `admin_cidades(regiao)` | SECURITY DEFINER, só admin | Cidades da região com o uso de cada uma (para mostrar "Remover" só quando pode) |
| `admin_criar_regiao(nome, slug, sede, uf)` | SECURITY DEFINER, só admin | Cria a região e a cidade-sede juntas (tudo ou nada) |

O repasse do franqueado (`microrregioes.repasse_percentual`) **não é editado** nesta etapa: a tela mostra o campo
vazio e travado com a explicação "a definir" (decisão de franquia ainda não tomada, PAINEL-ADMIN.md tela 7).

### Categorias

| Peça | Tipo | Regra |
|---|---|---|
| `conferir_categoria()` → gatilho `categorias_validar_2` | BEFORE INSERT/UPDATE (roda depois do `categorias_validar` que já existe) | Nome 2 a 60 letras (limpo); `slug` único com mensagem clara e **fixo depois de criado** (links `/c/...` não quebram); categoria principal (sem mãe) não tem campos nem preço (quem recebe anúncio é a subcategoria); subcategoria com anúncios não vira categoria principal; limites extras dos campos (abaixo) |
| Limites dos campos | dentro de `conferir_categoria()` | No máximo `categorias.campos_max` campos e `categorias.opcoes_max` opções por lista (configurações, grupo "anuncios"); opção de até 60 letras e sem repetir (sem acento/maiúscula); unidade até 12 letras; chave não pode ser `<outra>_min`/`<outra>_max` de um campo número (o filtro da busca usa `c_<chave>_min`) |
| `impedir_apagar_categoria()` → gatilho `categorias_impedir_apagar` | BEFORE DELETE | Recusa apagar categoria com anúncios (qualquer status), pedidos no Radar ou subcategorias ("esconda em vez de apagar") |
| `categoria_disponivel(id)` | função | Categoria ativa **e** com a mãe ativa |
| `exigir_categoria_disponivel()` → gatilhos `anuncios_1_validar_mae` (OF categoria_id, status) e `radar_1_validar_mae` (OF categoria_id) | BEFORE INSERT/UPDATE | Ao **escolher** a categoria (inserção ou troca) a categoria e a mãe precisam estar visíveis; rascunho que vai ao ar pela 1ª vez também (é anúncio novo entrando). Anúncio que já esteve no ar continua como está (pausado volta normalmente). Passa direto só servidor (service_role), admin e `olaki.sistema` (pagamento confirmado). Não usa `acesso_sistema()` de propósito: dentro de `publicar_anuncio` (SECURITY DEFINER) o usuário do banco é o dono da função |
| `admin_categorias()` | SECURITY DEFINER, só admin | Todas as categorias (inclusive escondidas) com anúncios no ar, total de anúncios, pedidos no Radar e subcategorias |
| `admin_mover_categoria(id, direcao)` | SECURITY DEFINER, só admin | Sobe/desce entre as irmãs (renumera 10, 20, 30... e troca com a vizinha), com trava |
| Política `categorias leitura` | troca | Passa a ler **todas** (inclusive escondidas): o vendedor que já tem anúncio numa categoria escondida continua vendo os campos dela ao editar. O cadastro e a busca continuam filtrando `ativa = true` no código |

Configurações novas (grupo `anuncios`, editáveis em Configurações, com exceção por região se quiser):
`categorias.campos_max` = 20 e `categorias.opcoes_max` = 60.

Hardening no fim da migração (mesmo bloco das anteriores): `search_path` fixo, gatilhos fora da API, funções do
painel sem `public`/`anon` (só `authenticated`, e por dentro conferem `e_admin()`).

### Cadastro de anúncio (o que mudou no código público)

- `src/lib/dados/categorias.ts` ganhou `categoriaDoAnuncio(id)`: a categoria de um anúncio que já está nela,
  mesmo escondida (lê direto da tabela, que agora é legível). `categoriaPorId` continua só com as visíveis.
- Passo "Detalhes" e `salvarDetalhes`: rascunho usa só categoria visível (escondida → volta para escolher
  categoria); anúncio fora do rascunho usa `categoriaDoAnuncio` (os campos continuam aparecendo e salvando).
- `salvarCategoria`: anúncio fora do rascunho que continua na mesma categoria (mesmo escondida) segue sem erro.
- Busca, filtros e moderação não mudaram: já leem a tabela na hora.

## 3. Telas

### Tela 7 · `/admin/regioes`
- Lista de regiões (cartões): nome, sede, cidades ativas/total, lojas, anúncios no ar, pessoas. Botão "Abrir".
- "Nova região": nome, cidade-sede e estado. O endereço interno (slug) sai do nome.
- `/admin/regioes/[id]`: renomear; escolher a sede (só cidades ativas); repasse do franqueado travado ("a definir");
  lista de cidades com estado, uso, botão **Desativar/Ativar** (some/volta nas listas públicas, histórico fica)
  e **Remover** (só aparece sem uso; com uso, explica e oferece desativar); "Adicionar cidade" com nome e estado
  (qualquer um dos 27, uma região pode misturar PI e BA); "Apagar região" só quando vazia.

### Tela 9 · `/admin/categorias`
- Árvore: categorias principais com as subcategorias embaixo, ícone, contagem de anúncios, etiqueta "Escondida",
  botões Subir/Descer (48px) e "Editar".
- "Nova categoria": nome, mãe (ou "categoria principal") e ícone. O slug sai do nome.
- `/admin/categorias/[id]`: nome, ícone (grade com os ícones de `icone-categoria.tsx`), mãe (mover), visível no
  cadastro (esconder), preço mínimo e máximo usados pela moderação e o editor de campos (só subcategoria): nome,
  tipo (texto, número, lista, sim/não), obrigatório, vira filtro na busca, opções da lista (uma por linha),
  unidade, mínimo e máximo. A chave do campo sai do nome na criação e não muda depois (os dados dos anúncios
  ficam guardados por ela). "Apagar" só sem uso.

Cada botão de ação mostra bolinha girando + texto mudando ("Salvando...") e não deixa enviar duas vezes.
Mensagens do banco chegam em português (`traduzirErro`).

## 4. Como cada regra do pedido é garantida

| Regra | Onde |
|---|---|
| Só admin mexe | RLS `e_admin()` nas tabelas + `exigirAdmin()` nas ações + funções do painel conferem `e_admin()` |
| Região mistura estados | `cidades.uf` livre entre as 27 siglas; nada amarra a região a um estado |
| Cidade inativa some das listas mas guarda o histórico | `ativa = false`; seletores já filtram; anúncios/lojas mantêm o texto da cidade |
| Nunca apagar cidade/região com anúncios ou lojas | gatilhos BEFORE DELETE com mensagem clara (vale até para quem chamar a API direto) |
| Esconder categoria com anúncios mantém os anúncios | `ativa = false` não toca nos anúncios; busca e página do anúncio continuam; cadastro esconde |
| Nunca apagar categoria em uso | gatilho BEFORE DELETE |
| Campos válidos para o cadastro e a busca | `validar_campos_categoria` (já existia) + `conferir_categoria` (novo) no banco; a mesma conferência em TypeScript antes de enviar, para dar a mensagem certa no painel |
| Slugs únicos | `unique` + mensagem própria no gatilho; slug fixo depois de criado |
| Tudo no histórico | `log_categorias`, `log_microrregioes` (já existiam) e `log_cidades` (novo) |
| Páginas públicas pegam a mudança | leituras dinâmicas + `revalidatePath("/", "layout")` em cada ação |
| Moderação usa o preço novo | `filtro_moderacao` já lê a categoria; teste [n] no 96 confirma |
