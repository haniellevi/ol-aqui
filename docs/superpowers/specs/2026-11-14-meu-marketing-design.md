# Meu Marketing do lojista

O usuário autorizou concluir e publicar a área. Ela reaproveita Minha loja, métricas, busca regional e o fluxo de anúncios.

## Entrega

- Entrada Meu Marketing na loja selecionada, acessível ao dono e aos ajudantes autorizados.
- Até três anúncios públicos ativos com foto, classificados por contatos, favoritos, visitas e qualidade do cadastro nos últimos 30 dias. Explicar os motivos sem prometer vendas.
- Download de artes PNG para feed (1080 × 1350) e stories (1080 × 1920), com a foto real, preço atual, nome/logo da loja e marca/link do Mercado. Reaproveitar ImageResponse. Downloads privados, com autenticação e acesso à loja conferidos a cada chamada.
- Oportunidades para cadastrar produtos, usando buscas somadas dos últimos 30 dias e pedidos abertos do Radar, limitados à região e ao nicho da loja. Excluir produtos já anunciados e não revelar compradores. Contagens de buscas nunca são chamadas de pessoas.
- Poucos dados aparecem como sinais iniciais. Zero dados, nicho indefinido e falhas têm mensagens e ações próprias.
- Cadastrar produto abre um rascunho com termo e categoria sugeridos, na mesma loja. Reutiliza limites, idempotência e etapas atuais. Publicação depende da revisão normal.
- Link para desempenho e dicas existentes. Não criar novas cobranças, créditos ou disparos de mensagens.

## Decisões de implementação

Usar classificação transparente por regras sobre dados existentes. Isso entrega recomendações verificáveis sem custo de modelo ou geração de imagem artificial. O módulo aparece para lojas ativas, aproveitando as permissões existentes, sem depender de habilitar a nova vitrine em outras regiões.

Os modelos prontos e o conceito da página seguem docs/gestao/ASSISTENTE-LOJISTA.md. O sistema de créditos e a importação de encartes pertencem a outras entregas.

## Aceite

Isolamento entre lojas e contas, exclusão de anúncios fora do ar, demanda da região/nicho corretos, títulos sem caracteres especiais interpretados como busca, fotos confiáveis e sem SSRF, imagens baixáveis nos dois tamanhos, rascunho na loja confirmada, testes e build verdes, PR integrado e produção conferida.
