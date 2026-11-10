# Confirmação do WhatsApp

Branch `codex/whatsapp-verificacao`, base `f3888917887c997445794e675ac1ca9c16561acf`.

Implementação: Evolution exclusiva, Turnstile, OTP de seis dígitos com HMAC, cinco minutos, três erros, uso único e cotas atômicas. Troca só confirma o novo número após validar o código; Clerk preserva confirmação externa. Cadastro e operações de negociação passam a exigir confirmação. O WhatsApp comercial da vitrine permanece um contato separado.

## Evidências locais

- 191 testes Node passaram, incluindo normalização, autenticação, CAPTCHA por ação/origem, limites, falhas de rede, resposta do provedor, HMAC vinculado e preservação da confirmação pelo Clerk.
- Regressão completa em PostgreSQL 17 descartável sem rede passou. Testes adicionais verificam três erros, expiração, replay, contato pendente, privilégios, cotas e concorrência de quatro envios/quatro confirmações. Incluídos testes de visita/contato anônimos e favoritos de pessoa sem confirmação; a regra permite apenas os contadores protegidos e mantém a recusa de edição do anúncio sem WhatsApp confirmado. A coluna gerada de busca é desconsiderada nessa comparação por ainda não estar calculada nos gatilhos BEFORE.
- TypeScript e lint passaram. Dez avisos antigos em componentes de demonstração permanecem.
- Build local final passou. Prévia `dpl_G5sC4YsSsZJzNdn4JBUdLfQgu23V` READY no SHA `7f1ce1072b32ffae71cdc0763bf34bcdc2c1d0fb`.
- UI local com serviços simulados: 390×844 e 320×740 sem rolagem horizontal; desktop 1440×1000. Solicitação, erro, confirmação, três erros, correção do número e cooldown conferidos. Nenhuma mensagem real enviada nesses testes.

## Infraestrutura e ativação

VPS autorizada `179.197.229.13`, `/srv/olaki/whatsapp`, Compose `olaki-whatsapp`. Limites de recursos e rede próprios. API `127.0.0.1:8087`, HTTPS `srv2031318.hstgr.cloud`. Sem chave: 401; manager/criação de instância públicos: 404. Certificado emitido, renovação com hook próprio. Turnstile criado na conta aberta pelo usuário, modo gerenciado sem pré-liberação. Chaves sensíveis guardadas na Vercel; não incluídas neste relatório.

Pareamento concluído pelo usuário. Corrigida a tela auxiliar que podia exibir QR desatualizado: agora acompanha novos códigos sem reiniciar a sessão. Migração aditiva `20261110012622_confirmacao_whatsapp` e migração de obrigatoriedade `20261110014434_whatsapp_obrigatorio` aplicadas. Não houve alteração dos contêineres, credenciais ou volumes de outros projetos.

## Teste real

O usuário entrou na prévia protegida, solicitou o código, recebeu no WhatsApp e confirmou. A página Editar perfil mostrou confirmação por código. No banco: uma solicitação, um consumo e uma confirmação persistida com telefone correspondente e origem Evolution. Sem leitura ou registro do código e do número neste relatório.

Depois do teste, somente o contêiner da API OL-AKI foi reiniciado; a sessão voltou a `open` sem novo QR. Os dez contêineres anteriores preservaram IDs, horários de início e contadores de reinício. O serviço OL-AKI usava aproximadamente 250 MiB no conjunto após o pareamento.

## Corte de produção

Primeiro corte publicado em `dpl_BAuE3n8w2YVrDV22yKKctiVSJBhS`, READY, SHA `7f1ce1072b32ffae71cdc0763bf34bcdc2c1d0fb`, alias `ol-aqui.vercel.app`. Reconstruído para o ambiente production, usando as variáveis próprias desse ambiente. A migração de obrigatoriedade foi aplicada depois de o aplicativo novo estar disponível e de passar a regressão dos contadores. Os quatro gatilhos estão ativos; anon/authenticated não têm acesso direto às funções privadas de reserva/confirmação. A página Editar perfil de produção preservou a confirmação real feita na prévia.
