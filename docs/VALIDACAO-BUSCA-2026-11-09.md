# Validação da busca e filtros, 09/11/2026

## Escopo

Busca geral e listas de categorias, mantendo logo, cores, tipografia e componentes Mercado da Região. Sem alteração de schema ou dados de produção.

- Nova busca preserva cidade, categoria, preços, ordenação e valores múltiplos.
- Filtros ativos podem ser removidos individualmente. Limpar preserva o texto pesquisado; alterações reiniciam a paginação.
- Categoria selecionada atualiza os campos específicos. Trocar de tipo preserva filtros gerais e remove atributos da categoria anterior.
- Preços e limites numéricos inválidos recebem mensagens de correção no cliente e no servidor. A consulta não é executada com filtros inválidos.
- Painel nativo com fundo inativo, foco inicial explícito, atalhos por seção, fechamento por Esc e retorno ao acionador.
- Sugestões sem resultados priorizam a categoria original antes de outras categorias e regiões.

## Testes automatizados

- 45 testes Node aprovados, incluindo preservação de parâmetros repetidos, remoção de filtros, validação, argumentos da consulta e recomendações.
- TypeScript aprovado.
- ESLint sem erros. Permanecem 10 avisos anteriores em componentes de demonstração; arquivos de busca sem avisos.
- Build local aprovado e prévia Vercel READY para `bbb1a9cfcf530b99d15d1cd924bb3a387989a2e8`, deployment `dpl_2QURfxBG7ieJHActqDXUzoiPqwLg`.
- `npm run test:db` aprovado no PostgreSQL descartável: combinações de texto/categoria/cidade/preço/atributos, categoria pai, ordenação, offset/total, isolamento regional e exclusão de anúncio pausado. Suítes existentes de RLS e concorrência também aprovadas.

## Conferência no navegador

Chromium do navegador integrado, em larguras de 320 e 390 px e desktop 1280 x 900. Trata-se de simulação de viewport, sem aparelho físico.

- Aplicação conjunta de Carros, Corrente, preço, marca, câmbio Manual e Automático e ordenação; texto alterado para Fiat mantendo os parâmetros.
- Remoção de cidade e categoria; remoção da categoria limpa seus atributos. Limpar filtros mantém o termo.
- Preço não numérico e faixa invertida bloqueiam envio e levam o foco ao campo com erro. URL com faixa invertida mostra orientação de correção.
- Abertura pelos atalhos, foco na seção pedida, fechamento por Esc e pelo botão, restauração do foco ao acionador e descarte de edições não aplicadas ao reabrir.
- Foco inicial em Fechar filtros e Tab para Categoria, com diálogo modal e fundo inativo.
- Busca dentro de Carros e mudança para Motos preservaram termo Honda, cidade e preço máximo.
- Sem transbordamento horizontal observado. Painel rolável mantém os botões de ação acessíveis no celular.
- Nenhum erro de console capturado na prévia final durante os cenários verificados.
- Painel também renderizado por CSS com scripts desabilitados. O envio sem JavaScript não foi exercitado pelo navegador, pois o mecanismo de locators depende de execução de scripts; o formulário usa GET nativo. Scripts restaurados após o teste.

## Limite da evidência

O catálogo público consultado está vazio. Resultados preenchidos, ordenação e paginação foram verificados com registros sintéticos no banco local e testes de componentes. Nenhum anúncio de teste foi criado na produção.

## Repetição antes de futuras publicações

Executar `node --test tests/*.test.cjs`, `npm run typecheck`, `npm run lint`, `npm run test:db` e build. Conferir em prévia uma busca combinada, troca do texto, remoção individual, valor inválido, abertura/fechamento e uma mudança de subcategoria. Depois do deploy, confirmar o SHA de produção e abrir a busca no domínio público.
