# Triagem automática de anúncios

A IA analisa apenas anúncios em análise por preço ou palavras do filtro. Aprova falsos positivos claros; dúvidas, infrações, denúncias e restrições administrativas continuam com a equipe. Não há exclusão automática nem decisão sobre a pessoa anunciante.

## Funcionamento

O Supabase Cron verifica a fila a cada minuto e chama `POST /api/interno/moderacao` com um token exclusivo guardado no Vault e na Vercel. Não envia conteúdo do anúncio nesse disparo. Cada execução reserva até três trabalhos, processados em paralelo. Uma reserva expirada vai para revisão manual, sem reenviar uma chamada que pode ter sido cobrada.

O servidor envia título, descrição, preço, categoria, atributos e todas as fotos ao modelo `openai/gpt-4.1-mini` pelo OpenRouter. Não inclui dados do perfil, telefone da conta, e-mail ou identificadores. Texto livre e fotos podem conter dados inseridos pelo anunciante. Os provedores são restringidos por `data_collection: deny` e `zdr: true`, sem fallback para uma rota incompatível.

Fotos precisam pertencer ao próprio anúncio no Storage configurado. Redirecionamentos, SVG, origens externas, excesso de tamanho e imagens que não carregam impedem aprovação. Anúncios identificados como teste nunca são liberados automaticamente.

O resultado precisa obedecer ao esquema, cobrir todas as imagens, ter confiança de pelo menos 0,98 e nenhum risco. Esse limiar é uma regra operacional, não uma garantia estatística. Conteúdo do anúncio é tratado como dado não confiável, incluindo instruções em texto ou imagem.

Antes de publicar, o banco compara a versão analisada com a atual, confere status, denúncias, contato confirmado, conta e categoria, e passa pelos gatilhos de cota e plano. Uma decisão administrativa ou edição durante a análise não é sobrescrita. A conclusão é idempotente e a aprovação gera uma notificação no site.

## Custos e controle

- O orçamento é o mesmo `robo.orcamento_mensal_centavos` usado pelo Aki, com a mesma trava transacional e o livro-caixa `robo_uso`. Não é criado um segundo orçamento independente.
- Cada chamada reserva US$ 0,50 convertido pela cotação configurada. A reserva cobre o contexto máximo do modelo com os limites de preço enviados ao OpenRouter: US$ 0,40 por milhão de tokens de entrada e US$ 1,60 de saída, sem tarifa por requisição. A resposta fica limitada a 1.000 tokens.
- O custo retornado pelo provedor substitui a reserva. Em falha de rede, interrupção ou custo desconhecido, a reserva permanece por segurança. Erros HTTP que recusam a chamada antes da execução têm custo zero.
- No máximo dez chamadas por anunciante/dia. Falta de orçamento, limite ou indisponibilidade do provedor encaminha para revisão manual.
- Os preços foram conferidos no catálogo público do OpenRouter em 9/11/2026. Os limites bloqueiam uma rota mais cara; não atualizam preços silenciosamente.

## Operação

`moderacao.ia_ativa` começa desligada e pode ser controlada em Configurações. O painel Moderação mostra o estado da rotina, resultados recentes e a justificativa das exceções. A aprovação manual permanece disponível.

O token `MODERACAO_IA_SECRET` deve corresponder a `olaki_moderacao_ia_token` no Vault. Nunca usar uma chave de serviço do banco como token do agendamento. Para interromper o processamento, desligar `moderacao.ia_ativa`; uma chamada em andamento ainda registra o custo, mas não publica.

Migrações: `20261110024323_moderacao_ia.sql` e `20261110024336_moderacao_ia_agendamento.sql`. Ambas são compatíveis com a versão anterior da aplicação, mantendo a automação desligada até a validação.

## Verificação

Executar `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint` e build antes de publicar. Os testes cobrem JSON inválido, resposta truncada, recusa, falha de rede, custo ausente, fotos inválidas, revisão alterada, congelamento, denúncia, contato revogado, orçamento, sigilo, conclusão repetida e reservas concorrentes. A verificação real do provedor deve ser registrada separadamente dos testes simulados.

Fontes: [saídas estruturadas](https://openrouter.ai/docs/guides/features/structured-outputs), [roteamento e limites](https://openrouter.ai/docs/guides/routing/provider-selection), [catálogo do modelo](https://openrouter.ai/openai/gpt-4.1-mini), [Supabase Cron](https://supabase.com/docs/guides/cron).
