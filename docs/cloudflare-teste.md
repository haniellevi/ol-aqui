# Teste na Cloudflare

O Worker `mercado-regiao-teste` usa a branch `codex/cloudflare-migracao`. A Vercel continua atendendo o domínio principal. Configure variáveis de build e de execução separadamente, sem guardar segredos no repositório.

A prévia usa a chave pública do Supabase e acesso anônimo, bloqueia ações e restringe RPCs à lista de funções verificadas como STABLE em produção. O PostgREST executa essas chamadas em transações de leitura. Antes de renovar a validade, confira novamente a volatilidade e as definições das funções no banco; se alguma mudar, mantenha a prévia expirada até revisar. O prazo de expiração está no `wrangler.jsonc` e deve coincidir com a variável de build. Configure o endereço e a chave pública do Supabase no ambiente de execução somente depois de verificar que o bloqueio de ações já está ativo no Worker publicado.

O teste de gravação exige banco e integrações isolados. Não configurar credenciais de pagamento, WhatsApp ou chaves privilegiadas de produção neste Worker. A aplicação usa `VERCEL_ENV` em verificações de cobrança e na seleção de domínios do Turnstile; esses controles precisam ser revistos e testados antes de qualquer migração para produção.

Execute `npm run build:cloudflare` e `npm run preview:cloudflare` para validar o pacote localmente. Antes de trocar domínios, valide login, revalidação, fotos, cadastro, webhooks, cobrança, WhatsApp e jobs em ambientes apropriados.
