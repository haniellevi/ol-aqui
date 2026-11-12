# Mercado da Região · aqui a sua cidade aparece

> O projeto nasceu como OLAKI e mudou de nome em 10/11/2026. Guia da marca: [docs/MARCA.md](docs/MARCA.md). Nomes internos (repositório `ol-aqui`, banco, jobs `olaki-*`) continuam iguais de propósito.

Shopping digital e classificados regionais, com o Radar de Negócios: o comprador descreve uma necessidade e as lojas enviam propostas.

O domínio de produção é `mercadodaregiao.com.br`, vinculado e verificado no projeto Vercel `ol-aqui`. O nome exibido é Mercado da Região. Consulte `docs/GESTAO-USUARIOS-LOJAS.md` para a gestão administrativa.

O ponto de entrada para a abertura acompanhada é [Liberação do piloto](docs/preparacao-piloto/liberacao.md). O documento distingue verificações locais, inspeção do ambiente publicado e ensaios com contas autorizadas. Os arquivos `QA-*` e `VALIDACAO-*` são registros históricos das respectivas versões.

## Aplicação e serviços

| Parte | Implementação |
| --- | --- |
| Aplicação | Next.js 15, React 19 e Tailwind CSS 4; versões exatas em `package-lock.json` |
| Identidade | Clerk; o `sub` do token identifica `perfis.id` e os vínculos da conta |
| Confirmação de contato | Código pelo WhatsApp via Evolution API, com Turnstile, cotas e consumo único; separada do login Clerk |
| Dados e arquivos | Supabase Postgres com RLS e Storage; cliente autenticado usa o token Clerk |
| Publicação | Vercel |
| Cobrança | Integração Asaas implementada; ambiente, chave, webhook e fluxo real precisam ser validados antes de cobrar |
| Aki e moderação | Recursos distintos; triagem de anúncios usa a mesma reserva de orçamento do Aki, conforme [operação da moderação](docs/MODERACAO-IA.md) |

## Desenvolvimento local

Copie `.env.example` para `.env.local`, preencha as credenciais do ambiente de desenvolvimento e mantenha esse arquivo fora do Git. Use as versões travadas:

```bash
npm ci
npm run dev
```

A aplicação abre em `http://localhost:3000`. O exemplo de ambiente contém chaves fictícias; elas não permitem validar login, build publicado ou serviços reais. A existência de uma integração no Marketplace não comprova que todas as variáveis foram provisionadas.

| Grupo | Variáveis usadas |
| --- | --- |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) |
| WhatsApp e CAPTCHA | `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`, `WHATSAPP_OTP_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES` |
| Cobrança, quando utilizada | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` |
| IA, quando utilizada | Chave do provedor configurado; para a moderação, `OPENROUTER_API_KEY` e `MODERACAO_IA_SECRET`; para a sugestão de categoria ao anunciar, `TYPESAFE_API_KEY` |

Somente valores públicos usam o prefixo `NEXT_PUBLIC_`. Não colocar segredos, QR de pareamento, códigos de confirmação ou respostas integrais do provedor nos relatórios.

## Verificações locais

```bash
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

`npm run test:db` requer Python 3, Docker em funcionamento e a imagem `postgres:17-alpine`. O executor cria um contêiner exclusivo, sem rede e com dados temporários, aplica todas as migrações em ordem e executa as asserções SQL e concorrentes. Ao terminar, para somente esse contêiner. Não usa as credenciais do Supabase publicado.

O antigo `supabase/testes/rodar.sh` recria o banco local `olaki`; use o executor isolado acima para validação automatizada. Testes locais não comprovam entrega de WhatsApp, agendamentos, configuração do Clerk nem funcionamento da versão publicada. Um build que falha por credenciais ausentes deve ser registrado como incompleto, sem chaves inventadas para apresentar sucesso.

Na verificação integrada desta preparação, 209 testes Node e a suíte SQL com concorrência passaram; o build terminou com saída zero, mantendo dez avisos preexistentes. Isso não substitui o ensaio publicado.

## Banco, integrações e publicação

As migrações versionadas estão em `supabase/migrations`. A ordem é o prefixo numérico crescente de **todos** os arquivos `.sql`; a aplicação atual depende de migrações posteriores às quatro iniciais. O [manifesto do recorte](docs/preparacao-piloto/migracoes.csv) registra hashes locais e situação de aplicação observada: 27 nomes/versões da base conferidos no projeto, mais três migrações aplicadas nesta preparação e conferidas por igualdade de conteúdo via MD5. Para as 27 anteriores, o conteúdo remoto não foi comparado por hash.

Antes de aplicar alterações em um ambiente existente, compare o histórico efetivamente aplicado com o manifesto da versão escolhida. Interrompa se houver uma versão ausente ou conteúdo divergente. Preserve migrações já aplicadas; faça novas mudanças por migrações adicionais. Nunca execute o simulador de testes contra o projeto publicado.

As migrações `20261110031133_preservar_conteudo_congelado.sql`, `20261110031135_revogacao_conta_excluida.sql` e `20261110031138_rotinas_piloto.sql` foram aplicadas e conferidas no projeto em 10/11/2026, antes do deploy do aplicativo correspondente. As duas primeiras protegem evidências congeladas e revogam acesso após exclusão; a terceira corrige os agendamentos ausentes. Preservar esses controles ao planejar retorno de versão.

O Clerk emite o token usado pelo cliente Supabase; `public.usuario_id()` lê seu `sub`. A integração de autenticação externa no Supabase deve reconhecer a instância Clerk do ambiente. O endpoint `/api/webhooks/clerk` trata criação, atualização e exclusão de usuários e deve usar o segredo dessa instância. Trocar desenvolvimento por produção exige tratar os IDs existentes e seus vínculos antes de mudar as chaves. A confirmação do WhatsApp continua sendo feita pelo fluxo próprio, sem liberar negociação por uma marcação manual.

A instalação, o pareamento e a recuperação do serviço de confirmação estão em [infra/whatsapp/README.md](infra/whatsapp/README.md). O procedimento de liberação deve conferir domínio do Turnstile, origens, webhooks e destinos de jobs na versão publicada.

### Fotos

O bucket público `anuncios` recebe WebP, JPEG e PNG em pastas do titular, como `<user_id>/<id do anúncio>/` e `<user_id>/loja/`. Configure `fotos.origem` em `/admin/configuracoes` com a origem exata do projeto Supabase e confira também o limite real do bucket. Alterar uma configuração da aplicação não demonstra que o limite do Storage foi alterado.

O webhook de exclusão de conta também trata os arquivos do titular. A comprovação do procedimento, inclusive quando há registros financeiros, faz parte do ensaio de privacidade.

### Rotinas e recuperação

| Rotina | Previsão no código | Verificação necessária |
| --- | --- | --- |
| `expirar_rotina()` | Migração `20261110031138` agenda `olaki-expirar`, diariamente às 03:15 no fuso do cron | Aplicado e ativo; primeira execução real ainda pendente de observação |
| `radar_avisar_prazos()` | A mesma migração agenda `olaki-radar-prazos` a cada dez minutos | Aplicado e ativo; primeira execução real ainda pendente de observação |
| `mensagens_avisar_planos()` | A mesma migração agenda `olaki-mensagens-planos` no minuto 20 de cada hora | Aplicado e ativo; primeira execução real ainda pendente de observação |
| `moderacao_ia_disparar()` | Job `olaki-moderacao-ia` a cada minuto | Ativo, com sucesso SQL observado em 10/11/2026 às 03:05 UTC; esse resultado isolado não comprova análise ou aprovação de anúncio |

O fuso observado do cron é GMT. A migração corretiva foi executada duas vezes com pg_cron real em contêiner isolado, com execução de jobs desabilitada: IDs e configuração permaneceram iguais, sem modificar a IA. `cron.schedule` preserva `active=false` em jobs previamente pausados; os três jobs necessários foram conferidos ativos em produção, junto com a IA, sob usuário/banco `postgres` e fuso GMT. A primeira execução real dos jobs novos ainda precisa ser observada. Consulte a [evidência do teste](docs/preparacao-piloto/validacao-cron.md).

O destino da moderação é fixado como `https://ol-aqui.vercel.app/api/interno/moderacao` na migração de agendamento. Uma mudança de domínio exige conferir se esse destino continua intencional e acessível. Não registrar tokens dos jobs nas evidências.

O projeto foi acessado e estava saudável em PostgreSQL 17.11, numa organização Free. Backup e restauração ainda não foram comprovados. Backup de banco e backup dos arquivos do Storage são controles separados; restauração precisa ser ensaiada em destino isolado, com jobs e integrações de envio desabilitados nesse destino. O protocolo está no [roteiro de liberação](docs/preparacao-piloto/liberacao.md).

## Administração

O titular precisa entrar uma vez para criar seu perfil. Um administrador autorizado pode conceder o acesso inicial no banco ao **ID verificado da instância correta**:

```sql
update public.perfis set e_admin = true where id = 'user_SEU_ID_VERIFICADO';
```

Depois, use `/admin/equipe` para administrar os acessos disponíveis. A concessão inicial é uma mudança privilegiada, não parte do cadastro de convidados. Planos, cotas, configurações e concessões ficam nos painéis existentes; registre prazo e motivo das cortesias. Prorrogar dias não deve ser presumido como reposição de propostas.

## Estrutura principal

| Caminho | Conteúdo |
| --- | --- |
| `src/app/(publico)` | Busca, anúncios, vitrines, ajuda e documentos públicos |
| `src/app/(conta)` | Anunciar, conta, loja, plano, notificações e privacidade |
| `src/app/radar` | Pedido, propostas e negociação entre comprador e loja |
| `src/app/admin` | Configuração, equipe, moderação, planos e relatórios |
| `src/app/api` | Webhooks e consumidor interno da moderação |
| `src/lib/supabase` | Clientes autenticado e administrativo |
| `src/lib/whatsapp` | Confirmação de contato e integração Evolution |
| `supabase/migrations` | Esquema e regras versionados |
| `supabase/testes` e `tests` | Asserções de banco e testes Node |
| `infra/whatsapp` | Serviço exclusivo de confirmação |
| `docs/preparacao-piloto` | Liberação, ensaio e registro mínimo do piloto |
