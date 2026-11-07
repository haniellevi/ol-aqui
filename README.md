# OLAKI · olha aqui o que você procura

Shopping digital e classificados regionais, mobile-first, com o **Radar de Negócios** (o comprador pede, as lojas propõem).
Domínio oficial: **olaki.com.br** (olaqui.com.br redireciona).

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- Clerk (login com Google e celular)
- Supabase (Postgres + Storage + RLS), recebendo o token do Clerk
- Vercel
- Cobrança: Asaas (próxima etapa)

## Rodar no computador

```bash
cp .env.example .env.local   # chaves do Clerk e do Supabase
npm install
npm run dev                  # http://localhost:3000
```

## Banco de dados

As migrações ficam em `supabase/migrations` e devem rodar **nesta ordem**:

1. `20261107000000_olaki_inicial.sql` · tabelas, RLS, logs do Marco Civil, Radar
2. `20261107010000_novos_status.sql` · status "em análise"
3. `20261107010100_painel_admin.sql` · planos, configurações, pagamentos, moderação, região-piloto

Com a [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` e depois `supabase db push`.
Sem a CLI: cole cada arquivo, na ordem, no SQL Editor do painel do Supabase.

### Ligar o Clerk ao Supabase

1. No Clerk: **Configure > Integrations > Supabase**, ative e copie o domínio do Clerk.
2. No Supabase: **Authentication > Sign In / Providers > Third-Party Auth > Clerk**, cole o domínio.
3. No Clerk: em **User & Authentication**, ligue **Google** e **Phone number** (código por SMS).
4. No Clerk: **Webhooks > Add endpoint** com `https://olaki.com.br/api/webhooks/clerk` e os eventos `user.created`, `user.updated` e `user.deleted`. O segredo vai em `CLERK_WEBHOOK_SIGNING_SECRET`.

O banco lê o id do usuário pela função `public.usuario_id()` (claim `sub` do token do Clerk). O perfil é criado no primeiro acesso e mantido pelo webhook. O celular só conta como confirmado quando o Clerk diz que foi verificado.

### Virar administrador

1. Entre no site uma vez (`/entrar`). Seu perfil é criado automaticamente.
2. No Clerk, copie seu **User ID** (começa com `user_`) e rode no SQL Editor do Supabase:

```sql
update public.perfis set e_admin = true where id = 'user_SEU_ID';
```

3. Acesse `/admin`.

## Estrutura

```
src/app/entrar          login do Clerk (Google ou celular)
src/app/api/webhooks    webhook do Clerk (cria e atualiza perfis)
src/app/radar           Radar de Negócios (lojista)
src/app/admin           painel: resumo, planos, configurações, moderação
src/lib/supabase        cliente com o token do Clerk e cliente de servidor (chave secreta)
src/lib/perfil.ts       sincroniza o perfil com os dados do Clerk
src/lib/admin           helpers do painel (exigirAdmin, formatos, configurações)
supabase/migrations     banco de dados
docs/                   decisões de produto e plano do painel
public/logo             logos (opção 1: pin no "i"; opção 2: balão "ol")
```

## Regra de ouro

Nenhum preço, limite ou regra fica no código. Tudo vem das tabelas `planos` e `configuracoes`, editáveis em `/admin`, e toda mudança fica registrada em `logs_atividade`.
