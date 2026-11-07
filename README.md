# OLAKI · olha aqui o que você procura

Shopping digital e classificados regionais, mobile-first, com o **Radar de Negócios** (o comprador pede, as lojas propõem).
Domínio oficial: **olaki.com.br** (olaqui.com.br redireciona).

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- Supabase (Postgres + Auth + RLS)
- Vercel
- Cobrança: Asaas (próxima etapa)

## Rodar no computador

```bash
cp .env.example .env.local   # preencha com a URL e a chave anon do Supabase
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

### Virar administrador

1. Entre no site uma vez (`/entrar`).
2. No SQL Editor do Supabase, crie seu perfil e ligue o admin (troque o e-mail):

```sql
insert into public.perfis (id, microrregiao_id, nome, tipo_pessoa, e_admin)
select u.id, (select id from public.microrregioes where slug = 'corrente-pi'), 'Raniel', 'pj', true
from auth.users u where u.email = 'seu@email.com'
on conflict (id) do update set e_admin = true;
```

3. Acesse `/admin`.

### Login por código

- **E-mail:** em Authentication > Email Templates > Magic Link, inclua `{{ .Token }}` no texto para o e-mail trazer o código de 6 dígitos.
- **Celular:** precisa de um provedor de SMS configurado em Authentication > Providers > Phone (ex.: Twilio). O envio pelo WhatsApp entra numa próxima etapa.

## Estrutura

```
src/app/entrar          login sem senha (celular ou e-mail)
src/app/radar           Radar de Negócios (lojista)
src/app/admin           painel: resumo, planos, configurações, moderação
src/lib/supabase        clientes do Supabase (servidor e navegador)
src/lib/admin           helpers do painel (exigirAdmin, formatos, configurações)
supabase/migrations     banco de dados
docs/                   decisões de produto e plano do painel
public/logo             logos (opção 1: pin no "i"; opção 2: balão "ol")
```

## Regra de ouro

Nenhum preço, limite ou regra fica no código. Tudo vem das tabelas `planos` e `configuracoes`, editáveis em `/admin`, e toda mudança fica registrada em `logs_atividade`.
