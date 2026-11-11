# Painel simplificado

Critério: mostrar primeiro o trabalho pendente, manter as ações de operação e reunir ajustes ocasionais em uma única entrada.

## Navegação

| Entrada | Conteúdo e justificativa |
| --- | --- |
| Hoje | Pendências que pedem ação. Falha de consulta aparece como erro, sem anunciar que a fila está vazia. |
| Lojas | Vendedores cadastrados, Captação e Usuários. Reúne acompanhamento comercial e gestão de contas. |
| Anúncios | Catálogo e Atendimentos. O atendimento é ligado ao anúncio. |
| Moderação | Anúncios, pedidos e denúncias que precisam de revisão. |
| Pagamentos | Cobranças, confirmação e devolução. Mantém os controles financeiros existentes. |
| Resultados | Quatro indicadores principais, visitas e detalhamento. Demais indicadores ficam recolhidos. |
| Configurações | Comercial, Aki, Conteúdo, Região, Catálogo, Comunicação, Equipe e Privacidade. Os ajustes avançados ficam recolhidos. |

As rotas existentes e a restrição por papel foram preservadas. Nenhum dado, histórico ou permissão de banco foi removido.

## Correções e cortes

| Item | Mudança e motivo |
| --- | --- |
| Hoje falhava ao consultar contatos privados | As consultas deixaram de pedir `vitrines_lojas.whatsapp`, cuja leitura foi revogada pela migração de verificação de lojas. A ação abre a ficha protegida do vendedor ou a cobrança. A proteção permanece. |
| Fila vazia durante erro | Exibe as fontes que falharam e mantém as tarefas que carregaram. O estado de sucesso depende de todas as fontes consultadas. |
| Atendimento e documentos | Inclui conversas aguardando a equipe e documentos de vendedores individuais na fila do dia. |
| Botão Feito | Renomeado para Adiar até amanhã, pois apenas oculta o acompanhamento naquele dia. Moderação, atendimentos e documentos continuam visíveis até sua resolução. |
| Cobranças de teste | Hoje considera apenas cobranças vencidas com origem confirmada em produção. |
| Indicadores repetidos | Resultados abre com lojas com anúncios, anúncios no ar, contatos solicitados no Radar e total recebido em produção. Os demais números podem ser expandidos. |
| Aki em dois editores | Modelo, orçamento e textos ficam no editor do Aki. O formulário genérico deixa de oferecer as mesmas chaves. |
| Mensagens sem envio | A tela mostra apenas os canais ativos. Modelos de WhatsApp e e-mail permanecem armazenados para desenvolvimento futuro. |
| Mensagens manuais de Hoje | Retiradas do formulário genérico porque Hoje passa a abrir a ficha ou cobrança protegida. |
| Preço suspeito por categoria | Retirado do editor porque esses limites não são consumidos pela moderação atual. Valores antigos ficam preservados. |
| Tamanho de foto no formulário genérico | Retirado porque o limite efetivo é aplicado no código de upload. |
| Exceções regionais sem consumidor | Não são oferecidas para ajustes lidos apenas de forma global. O servidor também recusa novos envios incompatíveis. |
| Textos globais do Radar | O editor principal continua em Mensagens. Exceções regionais efetivas ficam recolhidas nos ajustes do Radar. |
| Repasse de franquia desabilitado | Retirado por não oferecer operação disponível. |
| Duração duplicada do teste grátis | O plano de teste aponta para o ajuste efetivo `teste.dias`. Os planos pagos mantêm o período próprio. |
| Bloco obrigatório da página inicial | Substitui caixa desabilitada por explicação. Os blocos opcionais continuam editáveis. |
| Formulários extensos | Planos, tipos de destaque, preços regionais, créditos, detalhes do Aki, etapas de captação e dados de utilização ficam recolhidos. As operações continuam acessíveis. |
| Atalhos repetidos após reorganizar o menu | As abas de Catálogo e Atendimentos substituem os dois links avulsos que levavam aos mesmos destinos. Captação mantém um único botão Novo contato. |

## Verificação

O teste de Hoje reproduz a recusa de leitura dos contatos privados e verifica carregamento parcial, origem de cobranças e permanência dos atendimentos. Os testes de navegação e configuração verificam as sete entradas, permissões existentes, exceções regionais efetivas e recusa de formulários antigos. A suíte completa passou com 301 testes; tipos, lint e build também passaram. O lint mantém dez avisos anteriores em arquivos de demonstração e kit.

Conferência autenticada na prévia `e602256`: as sete entradas carregaram; Usuários e Captação permaneceram acessíveis em Lojas; Atendimentos abriu em Anúncios; Resultados mostrou os quatro indicadores; Planos abriu recolhido e o link do teste levou a `teste.dias`. Mensagens mostrou apenas avisos no site, e os ajustes avançados não ofereceram os editores duplicados do Aki, as mensagens manuais antigas de Hoje nem os limites de preço obsoletos. Hoje e Configurações também foram conferidos com viewport de 390 × 844, sem rolagem horizontal da página. Nenhum cadastro, cobrança ou configuração foi alterado nessa conferência.

A revisão visual identificou os atalhos repetidos entre Catálogo e Atendimentos e um espaçamento inadequado nos resumos de Destaques. Esses ajustes finais tiveram a validação automatizada repetida; o novo endereço de implantação exige uma sessão própria para uma nova conferência visual.

Não houve migração de banco nem publicação em produção nesta alteração.
