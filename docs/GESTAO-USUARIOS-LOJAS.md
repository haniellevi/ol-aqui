# Gestão de usuários e lojas

Implementação de 10/11/2026. Marca: Mercado da Região. Domínio: mercadodaregiao.com.br.

## Acesso e operações

Somente administradores acessam as fichas de usuários e as novas ações. A ficha de lojas mantém o acesso de consulta anterior. O banco confere a autorização novamente. Suporte e franqueados mantêm as permissões anteriores na lista de lojas.

- `/admin/usuarios`: busca por nome, e-mail, WhatsApp ou ID, com paginação.
- `/admin/usuarios/[id]`: nome, tipo de pessoa, região, cidade, bairro, WhatsApp, foto por upload ou URL; e-mail principal e senha em operações separadas; bloqueio e desbloqueio. Papéis administrativos continuam em Equipe e permissões.
- `/admin/lojas/nova`: criação vinculada a uma conta existente sem outra vitrine.
- `/admin/lojas/[id]`: cadastro, titularidade, tipo, localização, CNPJ, contatos, descrição, horários, entrega, formas de pagamento, imagens e banner; acesso às ações de plano, cortesia, suspensão, reativação e verificação, e aos anúncios filtrados por loja.
- A exclusão física remove a loja e seus registros dependentes, preservando a conta do titular e o histórico administrativo. Exige motivo, confirmação do endereço público e conferência do impacto atual. Pagamentos, assinaturas e retenções impedem a exclusão. Os objetos já enviados ao Storage não são apagados por esta operação, pois podem ter referências compartilhadas.

Trocar o WhatsApp invalida a confirmação e os códigos pendentes. Sincronizações do login não restauram o contato anterior. A foto editada pelo administrador é preservada até o titular atualizar explicitamente a foto. Alterações comerciais reabrem a verificação da loja pelos gatilhos existentes. Mudanças de titularidade com pagamentos, anúncios ou imagens exigem tratamento desses vínculos antes da transferência.

As edições usam a versão lida para recusar sobrescrita concorrente. O motivo e o autor ficam no histórico. Senhas nunca entram no histórico; a redefinição encerra as sessões anteriores. A confirmação de um novo e-mail pelo administrador exige conferência explícita de identidade e endereço.

## Publicação

Integrado sobre `955449a`, preservando a ficha, o arquivo de lojas e os gerentes já publicados. Aplicar a migração `gestao_usuarios_lojas` antes do código. A migração de marca já publicada não é reaplicada. `marca_documentos_atuais` cria versões com o nome atual sem modificar os textos ou aceites anteriores; o site poderá pedir aceite das novas versões. Funções históricas são preservadas. URLs de compartilhamento usam mercadodaregiao.com.br e mensagens de validação traduzem a marca antiga na apresentação.

Lojas arquivadas precisam ser restauradas antes de editar. Arquivamento, restauração, permissões e histórico anteriores permanecem na mesma ficha. A exclusão também remove convites e vínculos de gerentes.

## Validação

Executar `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:db` e o build com a configuração pública real. A suíte SQL usa PostgreSQL descartável sem rede; cobre permissões, versões concorrentes, contatos, preservação do titular, pagamentos, retenções e auditoria após exclusão.
