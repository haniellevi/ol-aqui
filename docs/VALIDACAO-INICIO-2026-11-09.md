# Validação da página inicial

Alteração: [PR 23](https://github.com/haniellevi/ol-aqui/pull/23). Destino: https://ol-aqui.vercel.app.

## Comportamento

- Apresentação regional visível, busca GET com rótulo acessível e categorias em grade responsiva, sem esconder opções na rolagem horizontal.
- Estado sem anúncios com uma ação para anunciar, sem repetir o botão do Radar.
- Radar e busca sem resultados explicam que as lojas podem enviar propostas e o comprador escolhe com quem conversar.
- Logotipo Mercado da Região, cores, Poppins, destaques e controle editorial do painel preservados.

## Verificação antes da publicação

- `npm test`: 31 testes aprovados, incluindo seis novos cenários da página inicial: busca/categorias, estado vazio, anúncios/paginação, painel, região ausente e falha de consulta.
- `npm run test:db`: testes de fluxo, RLS, concorrência e migração de texto aprovados em PostgreSQL isolado, sem rede ou credenciais externas.
- Uma repetição revelou uma corrida na inicialização do próprio teste: o `pg_isready` aceitava o servidor temporário por socket. A espera agora usa TCP no loopback do contêiner, disponível no servidor definitivo, e falha explicitamente se o tempo se esgotar.
- `npm run typecheck`: aprovado. `npm run lint`: nenhum erro; dez avisos preexistentes no kit de demonstração. Arquivos alterados sem avisos.
- Build local concluído após fornecer ao processo a chave pública do Clerk já disponível no site. O ambiente local não contém as demais configurações da Vercel; a execução integrada foi conferida no preview.
- Preview da versão de aplicação `a2d3454cfc7049ae620317b859f792b6aba01f6e`: build da Vercel concluído e navegação verificada em `ol-aqui-edt2gj8wi-raniel-levis-projects.vercel.app`.
- Layout conferido em 320, 390, 768 e 1280 px, sem conteúdo horizontal excedente. Categorias com alvos maiores que 48 px nos tamanhos medidos.
- Busca por `geladeira` usando Tab/Enter, categoria Veículos, Todas as categorias, Anunciar agora e Pedir no Radar verificados. Os acessos protegidos preservam os destinos na entrada; a busca preserva `q=geladeira` no pedido.
- O catálogo estava vazio. Cards, paginação e ordem/visibilidade dos blocos foram cobertos pelos testes automatizados, sem criar anúncios fictícios em produção.

## Conteúdo e limites

A migração `20261109165907_texto_radar_inicio.sql` foi aplicada ao projeto Supabase `ncrbqqdgweuqpsppxwti` e o texto foi relido. Ela altera somente o valor original exato, preserva personalizações e pode ser repetida sem sobrescrevê-las.

Esta rodada valida a página inicial e seus destinos. Não repete cadastro completo, envio de propostas ou contato com pessoas. A configuração de produção do Clerk continua sendo a pendência descrita em `VALIDACAO-CADASTRO-CONTATO-2026-11-09.md`.
