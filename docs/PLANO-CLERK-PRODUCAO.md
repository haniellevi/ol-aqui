# Plano: trocar o Clerk de desenvolvimento pelo de produção

Hoje o site usa o Clerk de **desenvolvimento** (chaves `pk_test` / `sk_test`). Para valer de verdade
precisa do Clerk de **produção** (`pk_live` / `sk_live`). O problema: cada pessoa ganha um ID novo
(`user_...`), e o banco usa esse ID como chave de tudo (perfil, loja, anúncios, avisos, equipe...).
Se só trocarmos as chaves, todo mundo "perde" a conta. Por isso a troca é feita com cuidado, em 4 fases.

## Fase 1 — Preparar o banco (feita neste ramo, nada roda em produção)

- Migração `supabase/migrations/20261119010000_troca_id_clerk.sql`:
  - toda chave estrangeira que aponta para `perfis(id)` ganha `ON UPDATE CASCADE` (achadas pelo próprio
    banco, sem lista à mão);
  - função `public.admin_trocar_id_usuario(antigo, novo, p_mover_arquivos default false)`: troca o ID de **uma**
    pessoa em tudo, numa única transação (ou troca tudo, ou não troca nada). Só a chave secreta
    (`service_role`) executa; `anon` e `authenticated` não.
  - para **desfazer**, chame a mesma função com os dois IDs invertidos.
  - cada troca deixa 1 linha em `admin_gestao_eventos` (`acao = 'troca_id_clerk'`) com os dois IDs.
- Teste: `supabase/testes/780_troca_id_clerk.sql` (entra na suíte `automatizados.py`).
- A migração só **cria** a função e liga o CASCADE. Ela não troca ID de ninguém.
- **Aplicar em produção** só junto com a Fase 4 (ou antes, em um dia calmo: ela não muda dado nenhum,
  mas mexe nas chaves estrangeiras, então faça backup antes).

## Fase 2 — Você cria a instância de produção no Clerk (sem tocar no site)

1. No painel do Clerk, criar a instância **Production** (copiando as configurações da de desenvolvimento).
2. Domínio: o Clerk pede registros DNS (CNAME) no domínio do site. Adicionar no provedor do domínio e esperar verificar.
3. Login com Google: em produção o Clerk exige **suas próprias credenciais Google** (Client ID e Secret do
   Google Cloud) com a URL de retorno que o Clerk mostra. Sem isso o botão do Google não funciona.
4. Anotar as chaves de produção: `pk_live_...` e `sk_live_...` (guardar em lugar seguro; não colar em chat).
5. **Não** criar o webhook agora (veja a Fase 3, passo 3).

## Fase 3 — Criar as pessoas na produção e montar o mapa

1. Criar na produção cada pessoa que já existe (Clerk: importação em lote ou API de criar usuário), pelo **mesmo e-mail**.
2. Montar o **mapa antigo → novo por e-mail**: uma lista com `user_ANTIGO`, `user_NOVO`, e-mail. Conferir à mão:
   sem e-mail repetido, nenhum ID faltando, nenhum par trocado.
3. **Webhook novo só depois da virada.** O site cria o perfil quando o webhook `user.created` chega
   (`/api/webhooks/clerk`). Se o webhook de produção já estiver ligado ao criar os usuários, o perfil com o
   ID novo nasce vazio e a troca recusa ("O ID novo já existe"). Deixe o webhook de produção para o passo 6 da Fase 4.
4. Supabase: em **Authentication → Sign In / Providers → Third-Party Auth**, adicionar o Clerk de produção
   (o emissor/domínio da instância de produção). O de desenvolvimento continua lá até a virada terminar.
5. Vercel, separar as chaves por ambiente (**ainda sem publicar**):
   - **Production**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`, `CLERK_SECRET_KEY` = `sk_live_...`,
     `CLERK_WEBHOOK_SIGNING_SECRET` da produção.
   - **Preview** e **Development**: continuam com `pk_test_...` / `sk_test_...` e o segredo do webhook de teste.
6. Fotos (Storage): as fotos ficam em pastas com o ID da pessoa (`anuncios/user_ANTIGO/...`). **Plano escolhido:
   não mover nada.** Com o padrão (`p_mover_arquivos = false`) a função não mexe em arquivo nem nos endereços
   gravados, então as fotos antigas continuam aparecendo. Fotos novas vão para a pasta do ID novo.
   Efeito: a pessoa não consegue apagar pelo app uma foto antiga que ficou na pasta velha (a equipe consegue).
   Mover as fotos pela API do Storage (`move`) e chamar com `true` é opcional e fica para depois.

## Fase 4 — A virada (janela combinada, com o site em manutenção)

1. **Backup completo** do banco do Supabase (e anotar a hora). Sem backup, não começa.
2. Colocar o site em manutenção (ninguém grava durante a troca).
3. Aplicar a migração `20261119010000_troca_id_clerk.sql` (se ainda não foi).
4. Fotos: nada a fazer (ficam na pasta antiga; ver Fase 3, passo 6).
5. Rodar a troca de **todas** as pessoas numa só transação (se uma falhar, nenhuma muda). Exemplo, no editor SQL do Supabase:

   ```sql
   -- Padrão: fotos ficam onde estão. Só use true se as fotos já foram movidas pela API do Storage.
   with mapa(antigo, novo) as (values
     ('user_ANTIGO1', 'user_NOVO1'),
     ('user_ANTIGO2', 'user_NOVO2')
   )
   select antigo, novo, public.admin_trocar_id_usuario(antigo, novo) as linhas_trocadas
     from mapa
    order by antigo;
   ```

   Cada linha do resultado mostra quantas linhas mudaram em cada tabela. Conferir que **todas** as pessoas aparecem.
6. Vercel: ligar as chaves de produção (Fase 3, passo 5), criar o **webhook de produção** no Clerk
   (`user.created`, `user.updated`, `user.deleted` → `/api/webhooks/clerk`) e **publicar** o site.
7. Testar com 2 contas reais: entrar, ver Minha conta, a loja, os anúncios com foto, os avisos, e (admin) o painel.
8. Tirar o site da manutenção. Desligar o webhook do Clerk de **desenvolvimento** (se ele ficar ligado, apagar
   um usuário de teste no Clerk de desenvolvimento pode apagar perfil no banco real).

### Como voltar atrás

- **Antes de publicar** (passos 1 a 5): desfazer pelo mesmo comando com os IDs invertidos:

  ```sql
  with mapa(antigo, novo) as (values
    ('user_ANTIGO1', 'user_NOVO1'),
    ('user_ANTIGO2', 'user_NOVO2')
  )
  select novo as antigo, antigo as novo, public.admin_trocar_id_usuario(novo, antigo)
    from mapa
   order by antigo;
  ```

  (Se um dia as fotos forem movidas pela API e a troca usar `true`, movê-las de volta também.)
- **Depois de publicar**: voltar as chaves `pk_test` / `sk_test` na Vercel (Production) e publicar de novo
  **junto** com o desfazer acima. Quem entrou ou criou conta na produção nesse meio tempo não entra no mapa:
  por isso a janela de virada deve ser curta e com o site em manutenção.
- **Último recurso:** restaurar o backup do passo 1 (perde o que foi gravado depois dele).

## Limites e cuidados conhecidos

- A função desliga os gatilhos de proteção/auditoria **só dentro da transação** e religa no fim (se algo falhar, tudo volta).
  Isso é necessário porque, por exemplo, termos publicados e o registro do Compliance são protegidos contra mudança.
- IDs parecidos (`user_abc` e `user_abcd`) não se misturam: a troca de texto só pega o ID inteiro.
- Textos de mensagens do robô (`robo_mensagens.conteudo`) e notificações **não** são reescritos (não guardam ID de usuário).
  A pegada de visitante nas métricas (`eventos_*.visitante_hash`) é um hash e muda sozinha; só afeta contagem de "visitantes únicos" do dia.
- Se uma tabela nova com ID de usuário sem chave estrangeira for criada **depois** desta migração, ela precisa entrar na função.
  O teste confere "nada sobrou" nas colunas de texto/jsonb/array de todas as tabelas, mas só com os dados do próprio teste.

## O que falta (para você ou para a próxima sessão)

- **Antes da virada:** a exclusão de conta (`src/lib/conta-exclusao.ts`, `apagarPasta`) apaga só a pasta
  `<ID atual>/`. Com as fotos deixadas na pasta antiga, quem pedir exclusão depois da virada ficaria com fotos
  na pasta velha. Ajustar a exclusão para também apagar a pasta do ID antigo (o par fica em
  `admin_gestao_eventos`, `acao = 'troca_id_clerk'`), ou mover as fotos e usar `true`.
- (Opcional) Script de mover fotos no Storage pela API (`move`) por pessoa, para usar `p_mover_arquivos = true`.
- Confirmar no Supabase real que o dono da função pode desligar os gatilhos das tabelas (`alter table ... disable trigger`).
- Ensaiar a função num **clone** do banco de produção antes da virada (nunca ensaiar direto na produção).
- Definir a janela de manutenção e quem avisa os usuários.
