# Notificações: novas propostas e propostas escolhidas

Base: `78b8cf4b07b4ea2430adf1fb599ed16938df60eb`.

## Comportamento

O cabeçalho ganhou um sino com contador, disponível para quem entrou na conta. A contagem consulta apenas avisos próprios do canal app, sem cache compartilhado. Atualiza ao navegar, voltar à janela, marcar avisos e usar Atualizar; enquanto a página está visível, consulta a cada 60 segundos. Quando a contagem muda na tela de notificações, a lista é atualizada. Requisições interrompidas têm prazo de 15 segundos e permitem nova tentativa.

A tela preserva a lista, leitura individual, leitura em lote e preferências. Acrescenta filtros Todas/Não lidas, paginação de 30 itens e contagem global. No computador, avisos e preferências ficam lado a lado; no celular, em sequência. Foram mantidos os outros tipos de aviso, além dos dois eventos de propostas.

Abrir um aviso lê seu destino no banco, com sessão, proprietário, identificador e canal verificados. O navegador envia somente o identificador. Retornos inválidos não confirmam leitura nem preferência. Erros aparecem na própria ação e liberam nova tentativa. Falha de leitura não aparece como caixa vazia ou como todas as preferências ligadas.

O aviso de proposta escolhida confirma a escolha, sem prometer que uma mensagem de WhatsApp já foi enviada. A alteração do texto padrão preserva personalizações da equipe e o histórico de notificações existentes. As preferências valem para avisos futuros no site.

## Testes

- `npm test`: 114 testes aprovados. Novos casos cobrem sessão, propriedade, destino inseguro, retorno inválido, leitura idempotente, preferência desligada, paginação, canal, falha de leitura e endpoint privado sem cache.
- `npm run test:db`: aprovado, incluindo as suítes anteriores de Radar, busca, anúncios, lixeira e concorrência. A suíte 210 cobre isolamento entre contas, leitura individual/em lote, outros canais, permissões, preferências, histórico e deduplicação. A suíte 200 verifica geração e destinatários de novas propostas e escolhas. Repetir a migração preservou texto personalizado e o trigger de proteção.
- TypeScript e build de produção aprovados. ESLint sem erros, com os 10 avisos anteriores em componentes de demonstração.
- Chromium em 320 × 740, 390 × 844 e 1440 × 1000: filtros, três páginas de avisos, leitura individual e em lote, erros e nova tentativa, preferências, lista indisponível e recuperação, chegada automática de aviso, sino e destinos de comprador/loja. Sem estouro horizontal no tamanho de 320 px.
- Um teste com 65 avisos confirmou que os não lidos das páginas seguintes entram na contagem e no filtro. A abertura da nova proposta levou à comparação do comprador; a proposta escolhida levou à oferta da loja. Atualizar foi ajustado para sincronizar também o sino.

As páginas, componentes e ações reais foram exercitados com fronteiras temporárias de autenticação, banco e dados fictícios. Esses arquivos foram removidos e os originais restaurados antes do build. O banco foi testado separadamente em PostgreSQL descartável. Nenhuma mensagem foi enviada a pessoas reais. Dimensões móveis no Chromium não equivalem a ensaio em aparelho físico ou Safari.

## Banco remoto e publicação

Migração `20261109195657_notificacoes_confiaveis` aplicada no projeto Mercado da Região `ncrbqqdgweuqpsppxwti`. A pós-verificação confirmou RLS ligado, trigger protetor ativo, execução negada a anon e permitida a authenticated, leitura restrita ao canal app e o texto padrão corrigido. A quantidade de avisos existentes permaneceu em dois.

Prévia e produção são verificadas na Vercel após o envio desta versão. A página privada exige sessão Clerk; os testes completos com alterações ocorreram no ambiente isolado descrito acima.
