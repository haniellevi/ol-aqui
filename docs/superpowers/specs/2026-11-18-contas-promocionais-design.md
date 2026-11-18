# Contas Gratuita, Full e Promocional

## Pedido e resultado esperado

Raniel definiu três tipos de conta para os lojistas. A conta Gratuita mantém os limites gratuitos. A Full oferece os recursos completos mediante pagamento, com possibilidade de concessão pelo administrador master. A Promocional oferece os mesmos recursos da Full durante a promoção controlada pelo master.

O master pode liberar a promoção para todas as lojas, encerrar essa liberação quando decidir e editar individualmente o tipo de conta no painel. O site deve mostrar o tipo e os recursos efetivamente disponíveis.

## Situação existente

- Os direitos e pagamentos são associados à loja. A conta de pessoa física possui seu próprio plano gratuito.
- O plano gratuito da loja tem limite de 10 anúncios. O Full e seus recursos são configurados no painel.
- O banco calcula o plano efetivo, limita a publicação e protege os pagamentos contra duplicidade.
- A rotina `aplicar_limite_loja_gratis` pausa os anúncios comuns mais antigos que excedem o limite, conservando os dados dos produtos.
- O cupom atual concede três meses de Full. Os códigos, mensagens e datas existentes refletem essa oferta.
- Existe distinção entre super admin (administrador master), administrador e demais operadores.

## Abordagens

Raniel escolheu o controle por tipo de conta e uma promoção geral, substituindo o planejamento de uma carteira de créditos.

Regravar todos os contratos ao ligar e desligar a promoção poderia alterar direitos comprados e dificultar desfazer a operação. A proposta técnica é uma configuração geral combinada com uma escolha individual, mantendo os registros de pagamentos e períodos concedidos.

Uma promoção controlada por chave atende ao período de lançamento sem exigir que cada lojista resgate um cupom.

## Regras propostas

### Três tipos visíveis

| Tipo | Recursos | Duração |
| --- | --- | --- |
| Gratuita | Recursos do plano gratuito da loja, inicialmente 10 anúncios ativos | Sem vencimento |
| Full | Recursos do Full configurado no painel | Período comprado ou concessão do master |
| Promocional | Os mesmos recursos do Full | Até o master encerrar a promoção |

Os preços, limites e nomes continuam vindo das configurações do painel. Alterar os recursos do Full deve atualizar também os recursos da Promocional. A promoção concede os direitos do plano, incluindo os limites próprios de IA. As exigências de verificação da loja continuam iguais às do Full.

### Promoção geral

- O comando “Liberar conta promocional para todas as lojas” alcança as lojas existentes e as criadas enquanto a chave estiver ligada.
- Uma loja com Full pago e vigente continua reconhecida como Full. O pagamento fica registrado e a data contratada é preservada.
- Uma loja sem Full pago fica Promocional enquanto a regra geral se aplicar, ressalvadas as escolhas individuais do master.
- O comando “Encerrar promoção e voltar ao gratuito” encerra as liberações promocionais gerais e individuais existentes naquele momento. As lojas sem outro direito Full vigente passam ao gratuito.
- Ao encerrar a promoção, nenhum produto é apagado. A rotina existente aplica o limite gratuito e pausa os excedentes.
- Ligar a promoção novamente devolve a possibilidade de publicar acima do limite gratuito. A reativação dos anúncios pausados é feita pelo lojista.

### Edição individual pelo master

- A ficha da loja exibe o tipo atual, a origem da liberação e o eventual período Full comprado.
- O master pode escolher Gratuita, Full ou Promocional e devolver a loja à regra geral.
- Uma escolha individual de Gratuita pode retirar a liberação promocional dessa loja durante a campanha. Períodos Full pagos e vigentes são preservados.
- Uma concessão manual de Full é identificada como concessão administrativa. O master pode definir uma validade ou manter a concessão até uma alteração manual.
- Uma liberação individual de Promocional pode ser concedida mesmo fora da promoção geral. O comando geral de encerramento deve indicar que encerra também essas liberações promocionais.
- Alterações individuais e gerais exigem motivo e são registradas com operador, horário e estado anterior e posterior.
- Somente o master pode alterar a chave geral e os tipos individuais. As permissões são verificadas no banco e no servidor.
- Os caminhos antigos de troca de plano e cortesia também devem exigir master quando alterarem esses direitos. A restrição cobre os formulários existentes e as funções do banco, inclusive `admin_acao_loja`.

### Prioridade dos direitos

1. Suspensão, arquivo, lixeira e montagem continuam impedindo as operações correspondentes.
2. Full pago vigente e os períodos de cupom já concedidos prevalecem até o vencimento.
3. Uma concessão administrativa Full vigente prevalece sobre a promoção geral. O master pode substituí-la por outro tipo.
4. Uma escolha individual Gratuita ou Promocional prevalece sobre a regra geral.
5. Na ausência das condições anteriores, a promoção geral determina o acesso Promocional. Com a chave desligada, vale a conta Gratuita.

O master deve ver essa prioridade no resultado de sua ação. Escolher Gratuita para uma loja que já tem período comprado deve informar a data até a qual o direito comprado permanece.

### Pagamento

- A loja pode contratar Full durante ou depois da promoção. A compra usa o fluxo Asaas existente.
- A promoção não é uma cobrança paga nem uma assinatura com renovação automática.
- A data da compra Full passa a contar conforme o período vendido no pagamento. A tela deve avisar quando esse período começa antes de confirmar a compra.
- Encerrar a promoção não cancela nem encurta períodos pagos.

### Promoções e direitos já concedidos

- Os períodos Full já concedidos pelo LANCAMENTO2026 continuam válidos até a data original.
- A oferta de três meses por cupom sai dos novos cadastros e da contratação assim que o novo modelo entrar em vigor.
- Os registros dos cupons e pagamentos anteriores ficam disponíveis para histórico.
- Os planos técnicos antigos continuam disponíveis para ler direitos e pagamentos já existentes, enquanto a apresentação comercial passa aos três tipos definidos.

## Painel e site

Em “Planos e preços”, o master encontra a situação da promoção e as ações de início e encerramento. Antes de encerrar, vê a quantidade de lojas afetadas e a informação sobre a aplicação do limite gratuito.

Na ficha da loja, um formulário permite editar o tipo individual e a validade opcional de uma concessão Full. Na conta do lojista e na página de planos, os nomes e recursos devem refletir o tipo efetivo. A conta Promocional mostra que é gratuita e que a liberação será encerrada pelo administrador, sem inventar uma data final. O resumo não deve mostrar aviso de plano vencido por haver uma liberação Promocional sobre um contrato antigo.

As telas seguem DESIGN.md, USABILIDADE.md e os componentes existentes.

## Verificação

1. Ligar a promoção libera Full para lojas gratuitas existentes e novas.
2. Encerrar a promoção devolve as lojas promocionais ao gratuito.
3. Full pago e períodos de cupom já concedidos conservam suas datas.
4. O excedente gratuito é pausado, com todos os produtos preservados.
5. Uma loja que volta a Full ou Promocional pode reativar os produtos pelo fluxo existente.
6. Operadores sem permissão de master não conseguem alterar os direitos, inclusive chamando o banco diretamente.
7. Compras, renovação, cancelamento e repetição de notificações de pagamento conservam a consistência existente.
8. As telas funcionam em 360 px e passam nos conferidores do projeto.
9. Testes de produção, se necessários, usam dados temporários e têm limpeza confirmada.
10. Alterar a promoção enquanto a rotina pausa anúncios ou enquanto um pagamento Full é confirmado mantém os direitos consistentes. A operação final revalida as condições e a quantidade de lojas afetadas, além da prévia do painel.

## Escolhas propostas para aprovação

O escopo inicial é o das lojas, incluindo as que pertencem a contas pessoa física. Os vendedores individuais sem loja mantêm o plano próprio. Essa delimitação segue o modelo atual do produto e precisa ser confirmada por Raniel.

Preservar direitos Full pagos e benefícios de cupom já concedidos, oferecer validade opcional para concessões manuais de Full e encerrar liberações promocionais individuais junto com a promoção geral são propostas técnicas e de operação, ainda sujeitas à aprovação de Raniel.

## Estado

Proposta em revisão. A implementação depende da aprovação do desenho.
