# Teste na Cloudflare

O Worker `mercado-regiao-teste` usa a branch `codex/cloudflare-producao`. A Vercel continua atendendo o domínio principal. Configure variáveis de build e de execução separadamente, sem guardar segredos no repositório.

A prévia usa a chave pública do Supabase e acesso anônimo, bloqueia ações e restringe RPCs à lista de funções verificadas como STABLE em produção. O PostgREST executa essas chamadas em transações de leitura. Antes de renovar a validade, confira novamente a volatilidade e as definições das funções no banco; se alguma mudar, mantenha a prévia expirada até revisar. O prazo de expiração está no `wrangler.jsonc` e deve coincidir com a variável de build. Configure o endereço e a chave pública do Supabase no ambiente de execução somente depois de verificar que o bloqueio de ações já está ativo no Worker publicado.

O teste de gravação exige banco e integrações isolados. Não configurar credenciais de pagamento, WhatsApp ou chaves privilegiadas de produção neste Worker. A configuração do candidato define `VERCEL_ENV=production` para preservar os bloqueios de cobrança que dependem dessa variável. A seleção de domínios do Turnstile e os fluxos reais de pagamento ainda precisam ser testados antes de qualquer migração para produção.

Execute `npm run build:cloudflare` e `npm run preview:cloudflare` para validar o pacote localmente. Antes de trocar domínios, valide login, revalidação, fotos, cadastro, webhooks, cobrança, WhatsApp e jobs em ambientes apropriados.


## Candidato com processamento de imagens

A branch `codex/cloudflare-producao` prepara o Worker `mercado-regiao-teste` em modo somente leitura. O Worker `mercado-regiao-imagens`, configurado em `infra/imagens/wrangler.jsonc`, deve ser publicado primeiro pelo GitHub; ele não possui domínio público e é acessado pela associação `IMAGENS_TRATAMENTO`. Ambos precisam acompanhar a mesma versão da branch.

O tratamento valida formato, animação, tamanho e dimensões antes de processar. A normalização e o ajuste usam a associação Images da Cloudflare; o tratamento de fundo liso usa WebAssembly e retorna ao fluxo alternativo quando não for possível processar. A cota gratuita de transformações precisa ser acompanhada para evitar falhas após seu esgotamento. O teste local com os dois Workers usa imagens artificiais e não precisa de banco. Antes de usar em produção, confira as operações no ambiente real da Cloudflare, incluindo o consumo de CPU e memória, e valide novamente os fluxos de envio e publicação. O artefato fixo de capa é gerado da arte em `src/lib/loja-ia/modelo-capa.ts`; mudanças nessa arte exigem atualizar `infra/imagens/modelo-capa.js` e rodar os testes.

## Integrações e troca do domínio

O domínio permanece na Vercel enquanto o candidato usa autenticação de teste e o Supabase anônimo. Antes da troca, conferir segredos, chaves públicas da mesma instância Clerk, domínios autorizados no Turnstile, webhooks do Clerk, Asaas e Evolution, processamento de imagens e revalidação. Nenhum webhook ou job deve ser duplicado durante a transição.

No banco de produção, as funções `categorizacao_ia_disparar`, `limpeza_disparar`, `moderacao_ia_disparar`, `radar_ia_novidades_disparar`, `verificacao_loja_disparar`, `verificacao_loja_reconferir_disparar` e `whatsapp_fila_disparar` ainda usam `ol-aqui.vercel.app`. Planejar uma migração revisada e reversível para o domínio principal antes de desligar a Vercel; não mudar os jobs durante a prévia. O endereço `olaki_loja_ia_endpoint` no Vault já usa o domínio principal. Os segredos de limpeza e moderação permanecem no Vault e não devem aparecer em código ou logs.

A zona DNS da Cloudflare está pendente e os sete registros foram comparados com o Registro.br. Antes da delegação, conferir novamente todos os registros, planejar a transição do DNSSEC e manter a possibilidade de retornar à Vercel. A ativação da zona e a mudança do destino do domínio só devem ocorrer depois dos testes de produção.
