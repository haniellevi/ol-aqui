# Confirmação do WhatsApp

Branch `codex/whatsapp-verificacao`, base `f3888917887c997445794e675ac1ca9c16561acf`.

Implementação: Evolution exclusiva, Turnstile, OTP de seis dígitos com HMAC, cinco minutos, três erros, uso único e cotas atômicas. Troca só confirma o novo número após validar o código; Clerk preserva confirmação externa. Cadastro e operações de negociação passam a exigir confirmação. O WhatsApp comercial da vitrine permanece um contato separado.

## Evidências locais

- 191 testes Node passaram, incluindo normalização, autenticação, CAPTCHA por ação/origem, limites, falhas de rede, resposta do provedor, HMAC vinculado e preservação da confirmação pelo Clerk.
- Regressão completa em PostgreSQL 17 descartável sem rede passou. Testes adicionais verificam três erros, expiração, replay, contato pendente, privilégios, cotas e concorrência de quatro envios/quatro confirmações.
- TypeScript e lint passaram. Dez avisos antigos em componentes de demonstração permanecem.
- Build local passou antes da última revisão de integração; build do commit de publicação deve ser confirmado na Vercel.
- UI local com serviços simulados: 390×844 e 320×740 sem rolagem horizontal; desktop 1440×1000. Solicitação, erro, confirmação, três erros, correção do número e cooldown conferidos. Nenhuma mensagem real enviada nesses testes.

## Infraestrutura e ativação

VPS autorizada `179.197.229.13`, `/srv/olaki/whatsapp`, Compose `olaki-whatsapp`. Limites de recursos e rede próprios. API `127.0.0.1:8087`, HTTPS `srv2031318.hstgr.cloud`. Sem chave: 401; manager/criação de instância públicos: 404. Certificado emitido, renovação com hook próprio. Turnstile criado na conta aberta pelo usuário, modo gerenciado sem pré-liberação. Chaves sensíveis guardadas na Vercel; não incluídas neste relatório.

Pareamento concluído pelo usuário. Corrigida a tela auxiliar que podia exibir QR desatualizado: agora acompanha novos códigos sem reiniciar a sessão. Migração aditiva `20261110012622_confirmacao_whatsapp` aplicada. Exigência global ainda pendente do teste real e da publicação. Não houve alteração dos contêineres, credenciais ou volumes de outros projetos.

## Pendente antes do encerramento

Validar entrega real, confirmação e estado persistido em preview autorizada; verificar build do commit; publicar e ativar a migração de obrigatoriedade; conferir produção e saúde dos serviços existentes. Conexão aberta da Evolution e testes simulados não são prova de entrega no WhatsApp.
