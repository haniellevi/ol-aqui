# Publicação e moderação dos anúncios

A regra implementada em `20261110121649_moderacao_sensivel_anuncios.sql` publica o anúncio no envio de **Publicar**, desde que os dados, fotos, WhatsApp, conta e limite do plano estejam válidos. Preço fora da faixa da categoria não deixa o anúncio pendente.

O banco procura termos sexuais ou violentos no título, na descrição e nos valores dos atributos. A configuração `moderacao.termos_sensiveis_anuncios`, no grupo Moderação do painel, mantém a lista reutilizável. Ela é exclusiva dos anúncios; a lista anterior continua sendo usada por Radar e vitrines. As chaves dos atributos não entram na busca, inclusive o campo `sexo` do cadastro de animais.

A correspondência ignora caixa, acentos e separadores e procura palavras ou expressões completas. Um termo configurado não é executado como expressão regular. É uma triagem textual por lista, sem avaliação semântica ou de imagens: palavras ambíguas podem exigir conferência, e grafias disfarçadas ou termos ausentes da lista podem passar.

Ao encontrar um termo, o banco grava `em_analise`, o motivo e a exigência de revisão humana. O anúncio permanece fora da página pública até a decisão da equipe. Edição de conteúdo, publicação direta pela API e reativação passam pelo mesmo filtro. A IA não pode liberar esses casos. Depois da aprovação, mudar apenas o preço ou marcar como vendido preserva a decisão; editar conteúdo público volta a aplicar a triagem.

Denúncias, decisões administrativas e congelamento conservam seus controles. A migração reavalia retenções automáticas antigas por preço ou palavras, preservando restrições e conferindo conta, categoria, fotos, atributos e cota antes da liberação. A ajuda personalizada pela equipe é preservada.

## Validação local

`npm test` passou com 257 testes. `npm run test:db` passou, incluindo termos, atributos, edição, API direta, revisão humana, IA, cotas concorrentes e reaplicação da migração. O teste de agendamento com `pg_cron` mantém o skip do ambiente isolado, que não dispõe dessa extensão. TypeScript passou; lint terminou sem erros, com dez avisos em componentes de demonstração fora desta alteração.

O build compilou o código, mas não concluiu a geração da página `/aki`: falta `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` no ambiente local. Não foram criadas chaves fictícias. A compilação posterior da prévia na Vercel concluiu com sucesso. A migração foi aplicada em produção em 10/11/2026, com igualdade de MD5 do SQL e das três funções confirmada. As verificações de texto comum, palavras parciais, termos sexuais e violência passaram por consulta direta. A publicação do aplicativo é acompanhada no PR #45.
