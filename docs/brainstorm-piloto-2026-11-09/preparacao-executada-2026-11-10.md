# Preparação executada em 10/11/2026

As correções técnicas desta rodada foram integradas pela [PR 38](https://github.com/haniellevi/ol-aqui/pull/38) e publicadas. O piloto ainda não está liberado para convites.

## Publicação e verificações

- Produção: `https://ol-aqui.vercel.app`, deployment `dpl_8WnWDWwj24hjB2ALjEserbi8ZKbn`, estado READY, commit `f8b05682eca269fe1cd37ebb38caed1571f541c0`.
- Prévia: `dpl_9akrygdezdGG4pbkQmp4EedzgLQC`, READY no commit `ffdfc94423a891b38a59e9b73c114d531dc03a23`; Ajuda respondeu HTTP 200 pelo conector autenticado. O navegador da prévia exigiu autenticação adicional da Vercel.
- Em produção, o navegador mostrou o novo bloco de suporte em `/ajuda` e `/confirmar-celular`. A página reconheceu a sessão existente. Nenhum código foi solicitado ou enviado neste ensaio.
- Passaram 209 testes Node, regressão completa em PostgreSQL 17 com concorrência e build com verificação de tipos/lint. Dez avisos antigos em componentes de demonstração permanecem.
- Sharp 0.35.5 e PostCSS 8.5.32, mantendo Next 15.5.29. Auditoria das dependências de produção sem alertas; seis moderadas permanecem na cadeia de ferramentas de lint. Doze conversões passaram pelo otimizador real do Next, incluindo AVIF; arquivo inválido foi recusado.
- O agendamento foi testado também com pg_cron 1.6.4 real em contêiner descartável sem rede, com execução de jobs desativada. Repetir a migração preservou IDs, pausas e o job da IA.

## Alterações concluídas

Ajuda e confirmação usam o mesmo contato humano configurado no painel. Foi retirada da Ajuda a recomendação do Aki como substituto de um atendimento não configurado. Os canais públicos continuam vazios até o responsável fornecer os contatos reais.

A exportação pagina as coleções, inclui propostas recebidas e interrompe com erro quando uma leitura falha. A exclusão distingue retenção financeira de falhas operacionais; revoga a autorização de tokens já emitidos, preserva conteúdo congelado e só limpa arquivos após concluir o banco. A interface informa que a exclusão dos dados é processada após encerrar o acesso. Registros internos de segurança e cobrança permanecem sujeitos à definição de retenção.

As migrações `20261110031133`, `20261110031135` e `20261110031138` foram aplicadas antes da publicação do novo webhook. Seus conteúdos remotos correspondem aos arquivos locais. Conferidos três gatilhos de proteção, tabela de revogação vazia e sem acesso direto por visitantes ou usuários, além dos quatro jobs ativos em GMT.

| Job | Agenda | Primeira execução observada após a correção |
| --- | --- | --- |
| Expiração | Diariamente às 03:15 GMT | Sucesso em 10/11/2026 às 03:15 UTC |
| Prazos do Radar | A cada dez minutos | Sucesso em 10/11/2026 às 03:20 UTC |
| Avisos de planos | Minuto 20 de cada hora | Sucesso em 10/11/2026 às 03:20 UTC |
| Moderação por IA | A cada minuto, agenda preservada | Sucesso em 10/11/2026 às 03:20 UTC |

Não havia falha registrada para esses jobs na consulta. Sucesso SQL confirma execução da rotina; não comprova uma negociação ou entrega externa. Os avisos comerciais continuam sendo internos ao site.

## Pendências anteriores aos convites

1. Definir domínio, responsável pela plataforma e contatos públicos de suporte/privacidade. A pergunta foi enviada ao usuário e permanece sem resposta nesta rodada. Termos e privacidade ativos ainda têm campos por preencher.
2. Criar e configurar a identidade de produção. O Clerk ainda tem apenas Development. Os cinco IDs do banco foram reconciliados com os cinco IDs visíveis no Clerk; três perfis têm vínculos. O inventário está em arquivo privado, fora do Git. Não houve troca de instância nem associação automática por e-mail ou telefone.
3. Comprovar backup e restauração de banco e arquivos em destino isolado. O acesso administrativo ao Supabase foi resolvido, mas o conector disponível não executou exportação/restauração integral. O plano Free não foi tratado como prova de backup disponível.
4. Ensaiar cadastro, entrega real de OTP, recuperação e percurso comprador/loja na versão e no domínio definitivos. A inspeção atual da VPS por SSH foi recusada por autenticação; há QA histórico de OTP, mas nenhum novo envio real nesta preparação. Também falta ensaiar entrega/retry real do webhook com conta descartável autorizada.
5. Confirmar lojas, responsáveis, horários, produtos e cotas. O inventário inicial encontrou uma loja ativa e nenhum anúncio ativo visível. Foram preservados os registros existentes; não foram criadas ofertas ou negociações fictícias.

O banco tinha cinco perfis, duas vitrines, dois anúncios, um pedido encerrado, uma proposta, nenhum pagamento e três arquivos no bucket `anuncios`. O bucket `verificacoes` não existe nesse ambiente; habilitar esse recurso futuramente exige incluir seus documentos no procedimento de privacidade.

O [roteiro operacional](https://github.com/haniellevi/ol-aqui/blob/f8b05682eca269fe1cd37ebb38caed1571f541c0/docs/preparacao-piloto/liberacao.md), o manifesto e o modelo de registro de casos estão versionados na PR. Este registro complementa o roteiro com os resultados posteriores à publicação, incluindo o sucesso dos novos jobs.

O trabalho ficou isolado em `/home/raniel-linux/workspace/OLAQUI-piloto`. A outra branch em uso no diretório original, `codex/corrigir-decisoes-moderacao`, foi preservada. Nenhum convite foi enviado e nenhuma conta real foi excluída.
