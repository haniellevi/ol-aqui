# Segurança e fluxo do Radar

Base reconciliada com `origin/main` em `6052f1d`, que já continha o Radar completo, cobrança, notificações e administração. A revisão anterior havia usado uma cópia local antiga. Nenhuma dessas implementações foi substituída pelo protótipo antigo.

## Alterações

- O banco limita o feed e o acesso direto aos pedidos à região do usuário, preservando o acesso do comprador, da administração e o histórico de quem já propôs.
- A escolha da proposta trava o pedido e relê a oferta, em conjunto com a trava já usada pela edição. Pedidos cancelados ou moderados não liberam novo contato.
- O limite de anúncios trava a vitrine antes da contagem. A cota de propostas, que já tinha essa trava na versão atual, foi validada com concorrência.
- O envio de pedido recebe um identificador por formulário. A repetição após falha de rede devolve o mesmo pedido e não consome outro limite.
- A sincronização de telefone propaga falhas de leitura e escrita. Se o Clerk retirar a confirmação, o telefone anteriormente confirmado é removido. O modo de WhatsApp digitado, quando autorizado pelo painel, foi preservado.
- A busca leva texto, categoria, cidade e faixa de preço ao pedido. Cidade incompatível com a região do cadastro exige nova escolha explícita.
- A seleção de cidade do visitante usa ID e UF. Essa escolha altera a navegação pública; pedidos continuam vinculados à região do cadastro.
- O Radar usa as categorias cadastradas, incluindo suas subcategorias. Leituras essenciais distinguem indisponibilidade de listas vazias, com tela para tentar novamente.
- Formulários preservam os campos após falha de rede; abas de contato abertas durante uma tentativa são fechadas em erro. Valores inválidos não viram orçamento vazio, e preço decimal com ponto é interpretado corretamente.

## Verificação reproduzível

`npm test` executa os testes de aplicação sem credenciais ou rede. `npm run test:db` cria um PostgreSQL 17 descartável, aplica todas as migrações, executa asserções com interrupção em erro e remove o banco ao terminar. Requer Docker.

Casos de banco: visitante sem permissão, confirmação de celular, acesso regional pela API e por RLS, criação e repetição de pedido, comparação e envio de propostas, contato direto e contato escolhido, bloqueio de edição de oferta escolhida, cancelamento e configuração de WhatsApp digitado. Casos concorrentes: quatro propostas disputam três créditos; três anúncios disputam uma vaga; quatro envios repetidos criam um pedido.

`npm run typecheck`, `npm run lint` e `npm run build` verificam o projeto. Avisos preexistentes do kit de demonstração são separados das correções deste fluxo.

## Publicação

A migração `20261109032907_seguranca_fluxo_radar.sql` deve ser aplicada antes de disponibilizar a nova ação de criação de pedidos. Ela preserva as funções anteriores e adiciona `criar_pedido_radar_site`, mantendo compatibilidade com o Aki e a versão anterior do site.

A conta Clerk conectada ao projeto está em ambiente de desenvolvimento. O webhook de criação, alteração e exclusão de usuários estava ausente; sua configuração foi autorizada pelo usuário e realizada nesta execução, com `CLERK_WEBHOOK_SIGNING_SECRET` armazenado como segredo de produção na Vercel. O resultado da publicação e da entrega de eventos será registrado após a verificação.

O teste automatizado não envia WhatsApp a pessoas reais. A disponibilidade de respostas comerciais depende das lojas. Migração da instância Clerk para produção, registro de marca, compra de domínio e mudanças na identidade visual ficam fora desta alteração.

## Nome e marketing

`VendaPorAqui` tem 12 letras antes da extensão e comunica principalmente venda. `TemDaqui` tem 8 e comporta descoberta local e pedidos; sugestão de mensagem: **Encontre perto. Peça o que falta.** O nome ainda exige consulta de domínio, pesquisa de marca e teste de compreensão com compradores e vendedores. A identidade atual foi preservada.
