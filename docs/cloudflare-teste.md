# Teste na Cloudflare

O Worker `mercado-regiao-teste` usa a branch `codex/cloudflare-teste`. A Vercel continua atendendo o domínio principal. Configure variáveis de build e de execução separadamente, sem guardar segredos no repositório.

O teste de gravação exige banco e integrações isolados. Não configurar credenciais de pagamento, WhatsApp ou chaves privilegiadas de produção neste Worker. A aplicação usa `VERCEL_ENV` em verificações de cobrança e na seleção de domínios do Turnstile; esses controles precisam ser revistos e testados antes de qualquer migração para produção.

Execute `npm run build:cloudflare` e `npm run preview:cloudflare` para validar o pacote localmente. Antes de trocar domínios, valide login, revalidação, fotos, cadastro, webhooks, cobrança, WhatsApp e jobs em ambientes apropriados.
