# Gestão de usuários e lojas

Implementação de 10/11/2026. Marca: Mercado da Região. Domínio: mercadodaregiao.com.br.

## Acesso e operações

Somente administradores acessam as novas fichas e ações. O banco confere a autorização novamente. Suporte e franqueados mantêm as permissões anteriores na lista de lojas.

- `/admin/usuarios`: busca por nome, e-mail, WhatsApp ou ID, com paginação.
- `/admin/usuarios/[id]`: nome, tipo de pessoa, região, cidade, bairro, WhatsApp, foto por upload ou URL; e-mail principal e senha em operações separadas; bloqueio e desbloqueio. Papéis administrativos continuam em Equipe e permissões.
- `/admin/lojas/nova`: criação vinculada a uma conta existente sem outra vitrine.
- `/admin/lojas/[id]`: cadastro, titularidade, tipo, localização, CNPJ, contatos, descrição, categoria comercial, horários, entrega, formas de pagamento, imagens e banner; acesso às ações de plano, cortesia, suspensão, reativação e verificação, e aos anúncios filtrados por loja.
- A exclusão física remove a loja e seus registros dependentes, preservando a conta do titular e o histórico administrativo. Exige motivo, confirmação do endereço público e conferência do impacto atual. Pagamentos, assinaturas e retenções impedem a exclusão. Os objetos já enviados ao Storage não são apagados por esta operação, pois podem ter referências compartilhadas.

Trocar o WhatsApp invalida a confirmação e os códigos pendentes. Sincronizações do login não restauram o contato anterior. A foto editada pelo administrador é preservada até o titular atualizar explicitamente a foto. Alterações comerciais reabrem a verificação da loja pelos gatilhos existentes. Mudanças de titularidade com pagamentos, anúncios ou imagens exigem tratamento desses vínculos antes da transferência.

As edições usam a versão lida para recusar sobrescrita concorrente. O motivo e o autor ficam no histórico. Senhas nunca entram no histórico; a redefinição encerra as sessões anteriores. A confirmação de um novo e-mail pelo administrador exige conferência explícita de identidade e endereço.

## Publicação

As mudanças estão preparadas no repositório; implementação local e testes isolados não significam publicação.

1. Conciliar o histórico real de migrações do destino com o repositório, incluindo as alterações anteriores que já estavam em andamento. Não reaplicar migrações históricas divergentes.
2. Aplicar `20261110190000_gestao_usuarios_lojas.sql` antes do novo código. Ela acrescenta as funções de gestão e a revogação permanente usada pelo webhook do login. Depende do esquema das migrações anteriores, inclusive dos campos do Aki.
3. Aplicar `20261110191000_marca_mercado_da_regiao.sql`. Ela atualiza mensagens, ajuda, configurações textuais e mensagens das funções, preservando identificadores técnicos. Documentos legais publicados recebem uma nova versão com a nova marca; as versões aceitas anteriormente permanecem intactas. A nova versão fica sem a marcação de revisão jurídica.
4. Publicar o código com `NEXT_PUBLIC_SITE_URL=https://mercadodaregiao.com.br`, as variáveis públicas do login/banco e as chaves de servidor. Conferir DNS, domínio na hospedagem, origens permitidas no login e no Turnstile e URLs de webhooks. O destino histórico da rotina de moderação deve ser conferido separadamente antes de mudar o cron.
5. Conferir as fichas com sessão administrativa no destino, incluindo e-mail, senha, fotos e um cadastro descartável para testar a exclusão. Nenhuma conta real foi alterada ou excluída durante a implementação.

## Validação

`npm test`: 289 testes aprovados. `npm run typecheck`, `npm run lint`, `npm run test:db` e `npm run build` concluídos. A suíte SQL roda PostgreSQL descartável sem rede. Os testes novos cobrem autorização, dados protegidos, contatos, versões concorrentes, preservação do titular, pagamentos, retenções e auditoria após exclusão.

Conferência visual dos componentes reais com dados fictícios no desktop e em 320 px. Ela não substitui o teste autenticado no ambiente publicado. Lint mantém os dez avisos anteriores do kit de demonstração. O build usa a configuração pública real do projeto; não requer copiar segredos de produção para executar os testes.
