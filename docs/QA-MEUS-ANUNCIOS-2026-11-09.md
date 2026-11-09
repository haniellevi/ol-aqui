# Meus anúncios: gestão e lixeira

Base: `4ce5c2a20f59dbda397ca302727e37c1f7fec201`.

## Resultado

Meus anúncios abre em Todos, separa a lixeira e mostra todas as situações. Computadores usam abas e cartões em duas colunas; celulares usam um seletor compacto. Mantidos destaque, pagamento pendente, fixação na loja, métricas, motivos de moderação e links de anúncios públicos.

Editar e salvar/sair retorna à situação do anúncio e confirma o salvamento. Pausar, vender e mover para a lixeira pedem confirmação com foco inicial em Cancelar. Erros liberam nova tentativa. Ações usam bloqueio imediato contra toque duplicado, validação de sessão, proprietário e retorno do banco. Avisos acompanham a navegação para a aba correspondente.

A lixeira guarda fotos e histórico. Restauração preserva rascunho, vendido, em análise e bloqueado; ativo, pausado e vencido voltam pausados. Publicar novamente exige as validações existentes de campos, plano, categoria e moderação. Restaurar rascunho respeita sua cota. Criação e restauração serializam a cota por vitrine. Prazos e pagamentos não são cancelados ou prolongados por essas ações.

O banco impede edição/publicação direta de itens na lixeira e exclusão definitiva pelo papel authenticated. As RPCs exigem proprietário autenticado. Metadados de venda são preservados. A página pública e o fluxo de edição recusam itens excluídos.

## Verificação realizada

- `npm test`: 96 testes aprovados. Novos casos cobrem sessão, propriedade, entradas inválidas, retorno nulo, rede, repetição, invalidação das páginas e destinos por situação.
- `npm run test:db`: todas as verificações aprovadas em PostgreSQL 17 descartável. Casos novos verificam lixeira/restauração em todos os estados, fotos e venda preservadas, cota, isolamento entre usuários, invisibilidade pública, bloqueio de acesso anônimo e de exclusão definitiva. Suites existentes de publicação, busca, contato e concorrência continuam aprovadas.
- TypeScript e build de produção concluídos. ESLint sem erros, com os 10 avisos anteriores em componentes de demonstração.
- Navegador Chromium em 390 × 844, 320 × 740 e 1440 × 1000. Pausar, reativar, falha e nova tentativa, marcar vendido, mover/restaurar vendido, restaurar anúncio anteriormente ativo como pausado, editar/salvar/sair, filtros, lixeira vazia e mover/restaurar rascunho verificados. Sem estouro horizontal nos tamanhos consultados. Confirmações recebem foco em Cancelar.
- A revisão de 320 px motivou o seletor compacto. A edição mostrou a necessidade de incluir o identificador salvo no retorno, corrigida e retestada.

Os testes de interface usam páginas, componentes e ações reais, com fronteiras de autenticação/banco temporariamente substituídas por fixtures locais. Nenhum anúncio comercial ou cobrança foi criado ou alterado em produção. Os arquivos temporários foram removidos e middleware, layouts e cliente Supabase restaurados antes do build. Testes em dimensões móveis não equivalem a ensaio em aparelho físico.

## Banco remoto e publicação

Migrações aplicadas ao projeto OLAKI `ncrbqqdgweuqpsppxwti`: `20261109190451_status_lixeira` e `20261109190459_lixeira_anuncios`. Pós-verificação confirmou as duas colunas, ausência de DELETE para authenticated, ausência de EXECUTE da restauração para anon e presença para authenticated. Não havia anúncios no banco na inspeção anterior à migração.

A validação de disponibilidade da prévia e da produção na Vercel é feita após o envio desta versão. O acesso à página privada em produção exige sessão Clerk; os fluxos com alterações foram exercitados no ambiente isolado descrito acima.
