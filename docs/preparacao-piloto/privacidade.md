# Privacidade na preparação do piloto

Alterações preparadas em 10/11/2026. As migrações `20261110031133_preservar_conteudo_congelado.sql` e `20261110031135_revogacao_conta_excluida.sql` foram aplicadas em produção antes da publicação do webhook atualizado, com igualdade de conteúdo remoto/local confirmada por MD5. Foram conferidos três triggers ativos, zero contas revogadas, bloqueio de SELECT/INSERT para `anon` e `authenticated` na tabela do marcador e `usuario_id()` como SECURITY DEFINER. A entrega real do novo webhook ainda depende do deploy e do ensaio autorizado.

## Exportação

O download usa a sessão da pessoa e filtros explícitos de proprietário. Falha com HTTP 500 se qualquer coleção ou página falhar, ou se o perfil não corresponder à sessão. Não entrega arquivo parcial como sucesso. Todas as respostas impedem cache.

As coleções são paginadas com ordenação única. Mensagens do Aki são consultadas separadamente para evitar truncamento da relação aninhada. O arquivo inclui propostas enviadas e propostas ativas recebidas nos próprios pedidos, notificações, preferências, avaliações e dados visíveis das verificações. IP de terceiros, identificadores do gateway e registros internos de segurança permanecem fora do arquivo. Dados protegidos sem concessão de leitura ao cliente, como o CNPJ da vitrine, também não foram adicionados por uma elevação de privilégios.

A exportação não é uma fotografia transacional do banco. Se houver alterações durante o download, os dados podem refletir instantes diferentes. Para os casos assistidos do piloto, evitar editar a conta enquanto baixa o arquivo.

## Exclusão e revogação

Depois de verificar a assinatura e confirmar no Clerk que o usuário já não existe, o webhook grava idempotentemente `contas_revogadas(usuario_id, revogada_em)`. Se essa gravação falhar, não inicia a limpeza.

A tabela não tem FK com o perfil. Guarda apenas o identificador Clerk e a data original da revogação; não armazena nome, contato, IP ou conteúdo. Somente o servidor insere e consulta. O marcador permanece após a exclusão do perfil, sem expiração automática, para impedir que tokens já emitidos recuperem permissões ou recriem a conta. Removê-lo exige intervenção administrativa consciente. É retenção técnica adicional que precisa constar no inventário e na política operacional; não equivale a uma declaração de conformidade jurídica.

A função `usuario_id()` passa a devolver `NULL` para IDs revogados. Isso alcança as políticas e funções existentes, incluindo a autorização de upload. Uma conta nova sem perfil continua podendo se cadastrar. A conta de outro administrador continua funcionando.

O banco remove o perfil normalmente quando a cascata é permitida. Somente a FK conhecida dos pagamentos permite seguir com o ramo que mantém perfil e vitrine: esse ramo remove anúncios, pedidos, propostas, conversas e outros dados operacionais, e limpa a identificação pública das linhas retidas. Erros de rede, permissão, outras FKs ou falhas parciais retornam HTTP 500 para nova tentativa. Registros financeiros e logs não são apagados indiscriminadamente e podem conter dados pessoais sujeitos à política de retenção.

O Storage do bucket `anuncios` só é limpo após o sucesso das operações no banco. Uma falha de Storage pode ser repetida usando o mesmo Clerk ID, inclusive se o perfil já foi removido. O fluxo atual não remove arquivos do bucket privado `verificacoes`; se esse recurso tiver documentos reais, a equipe deve inventariar e tratar esses arquivos antes de declarar a solicitação inteiramente concluída.

## Conteúdo congelado

O webhook verifica antes da limpeza se há anúncios próprios sob retenção, pedidos congelados ou propostas da loja ligadas a pedidos congelados. Inclui anúncio congelado que foi movido à lixeira. Havendo retenção, mantém os arquivos e retorna erro de revisão humana, com a autorização da conta já revogada.

Gatilhos `BEFORE DELETE` protegem também a cascata do perfil e o congelamento concorrente. A exclusão de proposta bloqueia a linha do pedido durante a decisão. A exclusão de anúncio verifica os pedidos vinculados para preservar a referência da oferta. Não há bypass de exclusão para `service_role`: resolver a retenção continua sendo uma decisão de Compliance.

O atendimento deve acompanhar o webhook com falha, identificar a retenção, registrar a decisão e repetir o processamento quando a exclusão for permitida. A tela confirma o encerramento do acesso e informa que a exclusão é processada depois, sem afirmar que toda a limpeza terminou no instante em que o Clerk respondeu.

## Verificação

- Treze testes Node cobrem sessão, paginação, erro parcial, isolamento de propostas, assinatura, repetição, FK financeira, retenção, ordem do Storage e falha da revogação.
- `300_privacidade.sql` valida as concessões reais de leitura, a revogação e o cadastro novo, a preservação de cobranças e o bloqueio de exclusão de conteúdo congelado, inclusive na lixeira.
- O harness PostgreSQL também disputa congelamento e exclusão em conexões concorrentes, conferindo proposta, referência do anúncio e cascata da conta.

As verificações usam banco descartável e mocks nas fronteiras externas. Ainda é necessário ensaiar a entrega real do webhook, inclusive retry, com conta descartável do ambiente de piloto. Não foi excluída nenhuma conta real nesta preparação.
