# Assistente de inicialização do OLAKI

O assistente pergunta o que a pessoa quer fazer e usa o estado atual da conta para apontar o próximo passo. Cada escolha é feita por botão. Os campos dos formulários existentes continuam sendo usados para dados como preço, fotos e descrição do pedido.

## Entrada e retomada

- A página inicial oferece **Começar** e **Agora não** uma vez. A pessoa pode navegar diretamente e abrir o assistente pelo botão **Preciso de ajuda**. Após dispensar ou concluir, o convite inicial deixa de aparecer. Se houver um caminho pendente, a página inicial oferece **Continuar**.
- Ao abrir o assistente, a pessoa escolhe **Explorar a região**, **Vender um item**, **Vender pela minha loja** ou **Procurar algo**. Pode voltar às opções para mudar de objetivo.
- Login, conclusão de perfil e confirmação do WhatsApp entram quando o caminho escolhido exige a etapa. Ao concluir cada uma, a pessoa volta à ação de origem, com o contexto de busca necessário. O destino deve ser interno e validado.
- **Continuar** recupera, no mesmo navegador, o último objetivo iniciado, a próxima etapa, os dados vindos da busca e o rascunho de anúncio escolhido, quando existir. Quando a pessoa muda de objetivo, **Continuar** passa a apontar para o novo caminho. Os rascunhos de anúncio continuam em **Meus anúncios**, inclusive em outros aparelhos após entrar na conta.
- Ao retomar, o assistente consulta o estado atual da conta para pular etapas já resolvidas. Os campos ainda não enviados dos formulários de loja e Radar continuam disponíveis enquanto a pessoa mantém o formulário aberto. Em navegador compartilhado, o progresso vinculado a uma conta só deve aparecer para essa conta.

## Caminhos

| Escolha | Como orientar | Onde termina |
| --- | --- | --- |
| Explorar a região | Abre os anúncios da região sem exigir conta. | Na abertura da listagem. |
| Vender um item | Prepara a conta e a vitrine de pessoa física quando necessário. Se a conta já tem loja, mostra o nome da loja e pede confirmação com **Anunciar pela loja** antes de abrir as etapas do anúncio. A pessoa pode voltar às opções. | No envio. Mostra se está no ar ou em análise e indica **Meus anúncios**. |
| Vender pela minha loja | Se a conta já tem loja, segue para o anúncio. Se ainda não tem, leva ao cadastro de loja, ou à conversão existente quando a conta já vende como pessoa física. Depois segue para o anúncio. | No envio. Mostra se está no ar ou em análise. Se a verificação da loja estiver pendente, oferece **Acompanhar verificação** em **Minha loja**, onde a equipe informa o status. |
| Procurar algo | Oferece **Buscar anúncios** e **Publicar pedido no Radar** para quem deseja receber propostas. Quando a ação parte da busca, reaproveita os campos que o Radar já aceita, como termo, cidade, categoria e faixa de preço. | Na abertura da busca, se a pessoa só quiser buscar, ou no envio do pedido. Nesse caso, mostra se está no ar ou em análise e oferece **Meus pedidos**. |

Se houver um único anúncio em rascunho, o assistente oferece **Continuar anúncio** e **Criar novo anúncio**. Se houver vários, a pessoa pode selecionar qual continuar. Com um rascunho escolhido, o fluxo abre a etapa em que ele pode ser retomado. Nas ações bloqueadas pelas regras atuais da conta, a orientação mostra a pendência e a ação disponível antes de prosseguir.

## Abordagens

A abordagem escolhida foi oferecer o próximo botão nas telas existentes. Isso aproveita os formulários, a retomada de anúncios e as confirmações que o OLAKI já mantém. A implementação precisa ligar as telas e preservar o contexto entre elas. Uma área própria concentraria a interface, mas exigiria mover ou duplicar etapas. Um roteiro na página inicial entregaria os atalhos com menos mudanças, mas deixaria a pessoa sem orientação nas telas seguintes.

## Critérios de aceite

1. Uma pessoa sem conta pode dispensar o convite, reabrir a ajuda e explorar sua região sem login.
2. Uma conta nova pode criar a loja ou seguir pela venda de um item e chegar até o envio do anúncio. Uma conta com loja existente pula o cadastro de loja. Ao escolher **Vender um item**, vê o nome da loja e confirma antes de continuar.
3. A pessoa pode escolher retomar um rascunho ou criar outro anúncio. Com vários rascunhos, escolhe qual abrir.
4. Login, conclusão de perfil e confirmação do WhatsApp devolvem a pessoa à etapa certa. Se ela veio de uma busca, os campos aceitos pelo Radar chegam preenchidos.
5. Anúncio e pedido mostram o estado retornado pelo site. Um envio em análise aparece como tal. A verificação pendente da loja aparece como sugestão após o anúncio.
6. **Continuar** recupera o último objetivo iniciado após fechar e reabrir o site no mesmo navegador. Trocar de objetivo mantém os rascunhos existentes em **Meus anúncios**. A troca de conta em um navegador compartilhado respeita o vínculo do progresso com a conta que iniciou o caminho.
