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

**Situação em 13/11/2026:** feita. Instância Production criada, DNS verificado, credenciais Google prontas, login
com Google testado no portal do Clerk de produção e as duas chaves guardadas pelo Raniel. Na Vercel continuam só as
chaves de teste (conferido 13/11) e o site segue com `pk_test`.

## Fase 3 — Preparar o Clerk de produção e montar o mapa (sem tocar no site)

Nada desta fase muda o site: ele continua com as chaves de teste. Tudo é feito nos painéis do Clerk e do Supabase.

### O que o código espera (conferido na main em 13/11/2026)

- O Supabase recebe o **session token nativo** do Clerk (`accessToken: auth().getToken()`, sem template JWT).
  O banco só lê duas claims: `sub` (vira `perfis.id`) e `role` (precisa ser `authenticated`). Sem `role`, toda
  consulta de quem está logado falha. Admin vem de `perfis.e_admin` no banco, não de metadata do Clerk.
- O código não lê `publicMetadata` nem claims personalizadas e não tem domínio do Clerk escrito (sem CSP).
  O domínio de produção vem da própria `pk_live`.
- Login do site: Google ou celular com código. O e-mail **não** fica no banco, só no Clerk.
- Criam perfil sozinhos (`garantirPerfil` / `sincronizarPerfil`): o webhook `user.created`/`user.updated`,
  o layout de `(conta)`, `/admin`, `/radar`, `/completar-perfil`, `/confirmar-celular`, convites e `/api/aki`.
  Por isso ninguém pode usar o site com a chave de produção antes da troca (ver Fase 4).
- Webhook e limpeza da lixeira: se o Clerk ligado responde 404 para um ID, o site chama `apagarConta`.
  Com as chaves de produção ligadas, todo ID antigo ainda não trocado dá 404.

### Banco em 13/11/2026 (só contagem)

6 perfis, 1 admin, nenhuma conta na lixeira nem revogada, nenhum WhatsApp confirmado pelo Clerk
(os 3 confirmados vieram pela Evolution e não dependem do Clerk).

### Passos (Raniel, nos painéis)

1. **Clerk de produção = Clerk de desenvolvimento.** Abrir os dois lado a lado e deixar igual:
   - User & Authentication: os mesmos métodos (Google, celular com código, e-mail) e "verificar no cadastro" ligado.
   - **Integrations → Supabase: ativar** na instância de produção. Isso põe `role: authenticated` no token.
     Anotar o "Clerk domain" que ele mostra.
   - Sessions → Customize session token: copiar o que houver na de desenvolvimento.
   - Paths: login e cadastro em `/entrar`; site `https://mercadodaregiao.com.br`.
   - Webhooks: **nenhum** na produção por enquanto.
2. **Supabase:** Authentication → Sign In / Providers → Third-Party Auth → adicionar um Clerk com o domínio de
   produção do passo 1. **Não remover** o de desenvolvimento. A doc do Supabase não diz se aceita dois Clerk
   ao mesmo tempo; se o painel recusar, parar: a troca do domínio passa para dentro da Fase 4 e a manutenção
   precisa cobrir isso. Fazer pelo menos 1 hora antes da virada (o Supabase pode levar até 30 min para valer).
3. **Lista das 6 pessoas no Clerk de desenvolvimento:** para cada uma, anotar o ID (`user_...`), o e-mail,
   o celular e como entra (Google ou celular).
4. **Criar as pessoas no Clerk de produção** (Users → Create user), com o **mesmo e-mail** (e o mesmo celular de
   quem entra por celular). O e-mail precisa ficar verificado: é isso que faz o Google ligar a conta em vez de
   criar outra. A conta do Raniel já existe na produção (teste do Google): não criar de novo.
   Sem senha. Sem webhook ligado, criar usuário não mexe no site.
5. Conferir que a produção tem **exatamente 6** usuários, sem repetido.
6. **Mapa:** 6 linhas `user_ANTIGO user_NOVO` (só os IDs; e-mail não precisa ir para o chat). Antes da virada,
   conferir no banco: os 6 antigos existem em `perfis` e nenhum novo existe em `perfis`, `contas_revogadas` ou
   `whatsapp_vinculos` (a função recusa nesses casos).
7. **Vercel: não mexer agora.** As chaves de produção entram só na Fase 4, com o site em manutenção. Se entrarem
   antes, o próximo PR juntado publica o site com o Clerk novo, as pessoas ganham perfil vazio e a limpeza pode
   apagar perfis antigos (404).
8. Fotos (Storage): as fotos ficam em pastas com o ID da pessoa (`anuncios/user_ANTIGO/...`). **Plano escolhido:
   não mover nada.** Com o padrão (`p_mover_arquivos = false`) a função não mexe em arquivo nem nos endereços
   gravados, então as fotos antigas continuam aparecendo. Fotos novas vão para a pasta do ID novo.
   Efeito: a pessoa não consegue apagar pelo app uma foto antiga que ficou na pasta velha (a equipe consegue).
   Mover as fotos pela API do Storage (`move`) e chamar com `true` é opcional e fica para depois.

## Fase 4 — A virada (janela combinada, com o site em manutenção)

1. **Backup completo** do banco do Supabase (e anotar a hora). Sem backup, não começa.
2. Colocar o site em manutenção (ninguém grava durante a troca). Na Vercel, ambiente **Production**:
   - `MANUTENCAO` = `1`;
   - `MANUTENCAO_CODIGO` = um código **novo** com 16 caracteres ou mais (não reaproveitar de outra manutenção:
     o cookie da equipe vale 12 horas e seria aceito de novo).

   Publicar de novo (`vercel redeploy` do último deploy de produção): a variável só vale no próximo deploy.
   Conferir: o site mostra "Estamos fazendo uma melhoria"; em **Sou da equipe**, o código abre o site.
   Se aparecer "código da equipe não está configurado", corrigir a variável e publicar antes de seguir.
   Durante a manutenção, todas as APIs respondem 503 (webhooks e rotas do pg_cron tentam de novo depois),
   menos o aviso do Asaas (`/api/asaas/webhook`).
3. Aplicar a migração `20261119010000_troca_id_clerk.sql` (se ainda não foi).
4. Fotos: nada a fazer (ficam na pasta antiga; ver Fase 3, passo 8). Conferir que ninguém está na lixeira
   (`lixeira_contas`): a limpeza diária das 04:00 UTC apagaria um perfil ainda não trocado.
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
6. Vercel, separar as chaves por ambiente (as três juntas, da mesma instância):
   - **Production**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`, `CLERK_SECRET_KEY` = `sk_live_...`,
     `CLERK_WEBHOOK_SIGNING_SECRET` do webhook de produção.
   - **Preview** e **Development**: continuam com `pk_test_...` / `sk_test_...`.

   Criar o **webhook de produção** no Clerk (`user.created`, `user.updated`, `user.deleted` → `/api/webhooks/clerk`)
   e **publicar** o site (novo build: a `pk_live` é embutida no build). Todos vão precisar entrar de novo.
7. Testar com 2 contas reais (a equipe entra pelo código da manutenção): entrar, ver Minha conta, a loja, os anúncios
   com foto, os avisos, e (admin) o painel. **Não apagar usuário no Clerk de produção** durante os testes.
8. Antes de abrir: conferir de novo que ninguém está em `lixeira_contas` e ver quantos itens há em `whatsapp_fila`
   (o que se acumulou sai de uma vez quando o site abrir).
9. Tirar o site da manutenção: apagar `MANUTENCAO` (ou pôr `0`) na Vercel e publicar de novo. Desligar o webhook do
   Clerk de **desenvolvimento** (se ele ficar ligado, apagar um usuário de teste no Clerk de desenvolvimento pode
   apagar perfil no banco real).

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

- ~~Exclusão de conta apagar também a pasta do ID antigo~~ **feito**: `pastasDaConta` em
  `src/lib/conta-exclusao.ts` lê o par antigo → novo em `admin_gestao_eventos` (`acao = 'troca_id_clerk'`)
  e a exclusão põe na fila e apaga as duas pastas (nunca a de um ID antigo que voltou a ser perfil).
- (Opcional) Script de mover fotos no Storage pela API (`move`) por pessoa, para usar `p_mover_arquivos = true`.
- ~~Confirmar no Supabase real que o dono da função pode desligar os gatilhos~~ **feito** 12/11: função e tabelas são do `postgres`.
- Ensaiar a função num **clone** do banco de produção antes da virada (nunca ensaiar direto na produção).
- Definir a janela de manutenção e quem avisa os usuários.
- ~~Modo de manutenção~~ **feito**: `MANUTENCAO=1` + `MANUTENCAO_CODIGO` (ver Fase 4, passo 2;
  código em `src/lib/manutencao.ts`, `src/middleware.ts` e `src/app/manutencao/`).
