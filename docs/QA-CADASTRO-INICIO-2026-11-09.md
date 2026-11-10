# Cadastro, primeiro anúncio e ajustes visuais

Data da validação: 9 de novembro de 2026, horário de Brasília.

## Resultado

A conta nova criada pelo usuário concluiu cadastro, confirmação do WhatsApp e aceite dos termos. Com essa conta, um anúncio fictício percorreu fotos, categoria, detalhes, preço, localização, revisão e publicação. O anúncio apareceu na busca e foi pausado após a validação, retirando seu contato da consulta pública.

O primeiro rascunho preenchido pelo usuário havia sido retido porque o piso genérico de R$ 5.000 para imóveis também era aplicado a aluguel. A migração `20261110020853_moderacao_aluguel.sql`, aplicada no Supabase durante esta validação, separa esse caso: aluguel deixa de herdar o piso genérico de venda, mas mantém limites explícitos da categoria, teto de preço e filtro de conteúdo. Alterar somente a finalidade também aciona a moderação. Anúncios já retidos não são liberados automaticamente.

## Teste real autorizado

- O usuário criou a credencial, confirmou e-mail e WhatsApp e aceitou os termos. O agente não preencheu senha nem resolveu essas etapas em seu lugar.
- O anúncio de teste recebeu imagem identificada como sem oferta comercial, categoria Imóveis / Casas, finalidade Aluguel, preço de R$ 1.000,50 e localização Corrente / Centro.
- Foram verificadas as exigências de foto, categoria e cidade, a rejeição de preço negativo e a alternância entre preço e “A combinar”.
- Salvar e sair preservou imagem, título, categoria, atributos, preço e localização. O rascunho foi retomado e revisado no computador.
- A publicação automática exibiu a confirmação de sucesso. A busca encontrou o anúncio, e a página de detalhes abriu em larguras de celular e computador.
- A consulta de integridade confirmou que o contato do anúncio correspondia ao celular verificado, sem registrar o número neste relatório.
- O anúncio publicado foi pausado pela interface. A consulta pública deixou de retorná-lo. O primeiro anúncio retido também permaneceu fora da consulta pública.

Identificadores dos registros fictícios para rastreabilidade interna:

| Registro | Identificador | Estado final |
| --- | --- | --- |
| Primeiro teste, retido antes da correção | `7a0593da-15d2-47e6-bbe0-30c5fe4e1f16` | `em_analise`, não público |
| Teste completo após a correção | `c65e9c31-9030-4202-b096-d8792d7490d9` | `pausado`, não público |

## Interface

- Página inicial com fundo lilás claro, categorias lilás, Radar em roxo e chamada laranja, preservando a identidade OL-AKI e as funcionalidades existentes.
- Entrada identificada como “Entre ou crie sua conta”, adequada ao fluxo combinado do Clerk.
- Texto e ícone do botão “Criar minha loja” alinhados na mesma linha no componente compartilhado. A geometria foi verificada em renderização local do componente real, com dados fictícios.
- Resultado de anúncio retido mostra seu motivo ao proprietário e oferece acesso à revisão. O título da página passa a indicar a situação, sem afirmar publicação quando há retenção.
- Correção do singular no resultado da busca de categorias.

Testes responsivos realizados no navegador em larguras solicitadas de 390 e 1.440 pixels, com largura útil menor quando havia barra de rolagem. A página inicial também foi conferida em 320 pixels. O formulário de entrada foi medido em 320 pixels, com largura útil e conteúdo de 305 pixels, sem transbordamento horizontal. Não foram usados aparelhos físicos iOS ou Android.

## Verificações técnicas

- 191 testes Node aprovados, sem falhas.
- Typecheck aprovado.
- Lint sem erros, com 10 avisos preexistentes em componentes de demonstração.
- Build local aprovado; build Vercel da prévia `af2d3bf62bed537b7481f3653d6cf9a292a50a65` pronto.
- Suíte de banco aprovada, incluindo isolamento, permissões, concorrência, cotas e confirmação de WhatsApp.
- Regressões novas de moderação: aluguel de R$ 1.000 publica; venda nesse preço é retida; palavra bloqueada, teto de preço e piso explícito da categoria continuam funcionando; troca de finalidade reavalia o anúncio; voltar para aluguel não remove uma retenção existente.

## Limites e operação

A moderação atual usa regras automáticas. Não foi integrado serviço de IA, e os casos retidos ainda dependem da fila administrativa. Revisar manualmente todos os anúncios não faz parte do fluxo atual; uma futura triagem por IA deve tratar os casos suspeitos e reservar intervenção humana para exceções e recursos.

O teste real de publicação ocorreu no site de produção com a migração corrigida. A prévia foi usada para os ajustes visuais. As variáveis de WhatsApp de prévia estão restritas à branch anterior de integração; esta prévia não comprova envio de código. A confirmação real da conta foi realizada no ambiente já configurado. O Clerk permanece na instância de desenvolvimento existente, sem alteração de domínio ou ativação de instância de produção nesta entrega.
