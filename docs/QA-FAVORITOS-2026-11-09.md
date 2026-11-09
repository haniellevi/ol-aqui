# Favoritos: implementação e validação

Data: 09/11/2026. Base: `866128d5812bc4db51d07ac978d6db8060963d6c`.

## Resultado

- Lista privada com contagem, ordenação estável por data e ID e páginas de 24 itens, substituindo o corte silencioso de 200.
- Cards OL-AKI com abertura do anúncio, data em que foi salvo e remoção separada do link. Estados disponível, vendido e fora do ar.
- Anúncios indisponíveis permanecem removíveis sem expor título, foto ou vendedor privados. Vendidos continuam abrindo com a indicação de venda e sem contato para compra.
- Salvar e remover usam identidade da sessão, validam os parâmetros, impedem cliques repetidos, confirmam o estado no banco e invalidam lista e detalhe. O coração acompanha o estado atualizado ao voltar ao anúncio.
- Falha de leitura não aparece como lista vazia. Erros de alteração preservam o estado anterior e permitem tentar novamente. Estado desconhecido no detalhe bloqueia a alteração e oferece nova consulta.

## Testes automatizados

| Verificação | Resultado |
| --- | --- |
| `npm test` | 143 testes passaram, incluindo 14 casos de Favoritos. |
| `npm run test:db` | Suíte PostgreSQL completa passou, incluindo isolamento entre contas, anúncios privados, repetição, contagem e concorrência dos fluxos anteriores. |
| `npm run typecheck` | Passou. |
| `npm run lint` | Zero erros; 10 avisos preexistentes em componentes de demonstração. |
| `npm run build` | Passou; `/minha-conta/favoritos` permanece dinâmica. |
| `git diff --check` | Passou. |

Os testes de dados e ações cobrem autenticação, UUID, booleano, proprietário, paginação acima de 200 itens, resposta malformada, falta de contagem, falhas de rede, verificação posterior à escrita, duplicação idempotente e invalidação de cache. A renderização cobre estados vazio/erro, paginação, links e favoritos indisponíveis.

## Navegador

Interface real e Server Actions exercitadas localmente com autenticação e transporte de dados substituídos por fixtures descartáveis. Os arquivos temporários foram removidos e as fontes reais restauradas antes dos testes finais e da publicação.

Computador: 1440 × 1000. Celular emulado: 320 × 740 e 390 × 844. Não houve rolagem horizontal nas larguras móveis verificadas.

1. Lista com 25 favoritos, segunda página e remoção do último item, retornando à primeira página com 24.
2. Falha ao remover mantém o item e mostra erro; nova tentativa confirma a remoção.
3. Falha de consulta mostra erro; o link Tentar novamente recupera a lista depois de restabelecido o transporte, inclusive no mesmo endereço com `pagina=1`.
4. Abrir um anúncio vendido preserva a indicação de venda e não oferece contato para compra.
5. Abrir anúncio ativo, remover, salvar novamente e abrir a lista. Falhas de salvar e remover revertem o coração; nova tentativa funciona.
6. Remover pela lista e voltar ao anúncio atualiza o coração para não salvo.
7. Falha de consulta no detalhe mostra Favorito indisponível e impede alteração até a recuperação.
8. Trocar a identidade fictícia apresenta exclusivamente a lista da outra conta.
9. Remover o último favorito mostra a lista vazia; Encontrar anúncios abre a busca. Abrir um resultado, salvar e acessar Favoritos completa o circuito.
10. Remover um anúncio fora do ar funciona sem abrir ou revelar o anúncio privado.

Capturas: `favoritos-desktop-teste.png` e `favoritos-celular-teste.png` na pasta de visualizações desta sessão. Dados e imagens dessas capturas são fictícios.

## Banco de produção

Migração `20261109205931_favoritos_visiveis.sql` aplicada ao projeto OLAKI (`ncrbqqdgweuqpsppxwti`). A política de INSERT exige anúncio ativo e loja ativa, além do proprietário autenticado. As políticas de SELECT e DELETE continuam restritas ao próprio usuário.

O teste de loja suspensa falhava antes da correção e passou com a migração. A aplicação remota foi confirmada por `pg_policies` e pelo histórico de migrações. Contagem de favoritos antes/depois: 0/0. A migração não altera registros.

## Limites e publicação

Os fluxos autenticados foram testados em ambiente isolado, com regras reais de banco verificadas separadamente no PostgreSQL. Isso não equivale a uma sessão Clerk autenticada em produção. O navegador de produção estava desconectado; o teste público deve verificar o redirecionamento para login com retorno a Favoritos. Nenhuma conta, anúncio ou favorito real foi alterado nos ensaios; nenhuma mensagem foi enviada.

Publicação condicionada ao preview da Vercel pronto no SHA do commit e à confirmação do deployment de produção após o merge.
