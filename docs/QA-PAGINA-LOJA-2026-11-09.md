# Página da loja: implementação e validação

Data: 09/11/2026. Base: `464292716704fb23884755f3f268448f38408c31`.

## Mudanças

- Leituras públicas distinguem falha de serviço, loja inexistente e lista vazia. Uma falha nos produtos mantém as informações e o contato disponíveis, com nova tentativa no mesmo filtro/página.
- Menor preço mantém a sequência global devolvida pelo banco, sem reagrupamento por categoria ou repetição dos produtos das seções. A visualização Vitrine da loja preserva destaques fixados, seções próprias e grupos de categorias.
- Grade limitada a três colunas na área ao lado das informações, atalhos para anúncios/informações com compensação do cabeçalho fixo, contagem e navegação entre páginas.
- WhatsApp validado antes de gerar o link, mensagem com endereço canônico da loja, estado explícito sem contato e botão para copiar o link, incluindo alternativa manual quando a área de transferência falha.
- Banner e logo quebrados mostram o modelo da vitrine e as iniciais. O teste no navegador identificou e corrigiu o caso em que a imagem já falhou antes da hidratação.
- Prévia de loja suspensa/inadimplente não oferece contato externo nem cópia de divulgação. Metadados omitem seu nome e imagem. A rota de imagem responde 404 para loja ausente/inativa e 503 em falha de consulta, sempre com `private, no-store`; imagens válidas também não entram em cache público.
- Horários, endereço, Instagram, formas de pagamento, entrega, descrição, selo e edição da vitrine pelo responsável foram preservados. Coordenadas inválidas não produzem rota geográfica.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm test` | 155 testes passaram, incluindo 12 casos novos da loja. |
| `npm run test:db` | Suíte PostgreSQL completa passou, incluindo `240_pagina_loja.sql`. |
| `npm run typecheck` | Passou. |
| `npm run lint` | Sem erros; 10 avisos preexistentes nos componentes de demonstração. |
| `npm run build` | Passou com as integrações reais restauradas; loja e imagem são rotas dinâmicas. |
| `git diff --check` | Passou. |

Os testes Node executam as funções reais com as fronteiras externas substituídas. Verificam dados malformados, contato, privacidade, paginação, menor preço, seções/fixados, estados vazio/erro, metadados e respostas da imagem. Os testes PostgreSQL usam banco descartável sem acesso à rede e verificam contato público permitido, confirmação de telefone, campos internos omitidos, loja suspensa, isolamento do dono, categorias, preços em centavos, fixados, seções fora da página e paginação.

## Navegador

Telas emuladas de 320 × 740, 390 × 844 e computador em 1440 × 1000. Interface e leituras TypeScript reais com transporte de banco e autenticação locais substituídos por fixtures. Nenhuma escrita de teste em produção.

- Ordenação, próxima página com filtro preservado, abrir anúncio e retornar à loja no computador e no celular.
- Atalhos para informações/anúncios, horários legíveis, URLs de WhatsApp/Instagram/Maps e mensagem de contato conferidas. Nenhuma mensagem enviada.
- Copiar link apresentou confirmação; alternativa manual está implementada para falha da API.
- Falha de produtos, recuperação pelo botão Tentar novamente, falha da loja, lista vazia e ausência de WhatsApp.
- Banner/logo ausentes, arquivos quebrados e arquivos válidos. Imagens quebradas passaram a exibir o modelo e as iniciais mesmo em carregamento inicial.
- Prévia privada sem contato/divulgação; visitante recebe Loja não encontrada. Sem rolagem horizontal nas duas larguras móveis.
- Rota real de imagem local: 404 para prévia suspensa; 200 `image/png` para loja ativa; ambos `Cache-Control: private, no-store`.

Capturas: `loja-desktop-teste.png` e `loja-celular-teste.png` na pasta de visualizações desta sessão. São dados fictícios, sem oferta comercial. O ambiente de ensaio foi removido e as integrações reais restauradas antes do build final.

## Limites e publicação

A consulta de produção encontrou zero lojas públicas e zero anúncios ativos. Portanto, uma vitrine real publicada não foi usada como prova do fluxo completo. A validação visual usa fixtures; a autorização e as funções públicas são verificadas separadamente no PostgreSQL. Não houve alteração de schema, dados, contas ou contatos em produção.

Publicação condicionada ao build local, preview Vercel pronto no commit testado e confirmação do deployment de produção após o merge. O pós-deploy público verifica a página inicial e o tratamento de loja inexistente, sem criar loja fictícia no site.
