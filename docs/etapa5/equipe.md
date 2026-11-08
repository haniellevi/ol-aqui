# Etapa 5 · Equipe e permissões (tela 14) e Compliance jurídico (tela 8)

Nota para quem programa. Especificação: PAINEL-ADMIN.md, telas 8 e 14.
Migração: `supabase/migrations/20261108050000_equipe_compliance.sql`. Testes: `supabase/testes/97_equipe_compliance.sql`.
Tipos: `src/lib/tipos-equipe.ts`.

## 1. Papéis

| Papel | Telas do painel | O que o banco deixa |
|---|---|---|
| administrador | todas | tudo (é o `e_admin()` de sempre) |
| moderador | Moderação | ler anúncios, pedidos e propostas do Radar, denúncias e lojas; aprovar/recusar anúncio e pedido em análise, resolver denúncia, tirar foto de banner, moderar o Radar. **Não** congela (Compliance é só do administrador). |
| financeiro | Pagamentos (lista, totais, CSV) | ler pagamentos (e o nome da loja e do anúncio de cada um), ler planos |
| suporte | Lojas | lista de lojas, suspender e reativar loja, analisar verificações (documento, selfie, CNPJ). **Não** dá cortesia, não troca plano, não mexe em selo nem em dinheiro. |
| franqueado | Lojas (só a região dele, só leitura) | lista de lojas forçada para a região dele; nenhuma ação, nenhum preço |

Na dúvida, só o administrador: Resumo, Planos, Configurações, Destaques, Robô, Textos, Equipe e Compliance continuam com `exigirAdmin()` e as regras de banco de sempre (`e_admin()`).

### Tabela `equipe`
`usuario_id` (perfis, único: uma pessoa = um papel), `papel`, `microrregiao_id` (obrigatório só para franqueado, vazio nos outros), `ativo`, `observacao`, `adicionado_por`, `desativado_por`, `desativado_em`, `criado_em`, `atualizado_em`.
RLS: o administrador lê tudo; cada pessoa lê só a própria linha. Ninguém escreve direto (sem policy de escrita e sem grant): só as funções abaixo. Cada mudança vai para `logs_atividade` (gatilho `registrar_log`).

### Administrador = `perfis.e_admin`
`e_admin()` não muda: quem já é admin continua com acesso total sem nenhum passo manual.
- A migração cria uma linha `administrador` em `equipe` para cada perfil com `e_admin = true`.
- Gatilho em `perfis` (quando `e_admin` muda, inclusive se o Raniel ligar pelo Supabase): cria/reativa ou desativa a linha de administrador em `equipe`.
- As funções da tela 14 ligam/desligam `perfis.e_admin` quando alguém vira ou deixa de ser administrador.

### Funções de apoio (todas `security definer`, `search_path = public, extensions`)
- `meu_papel()` → `administrador`, o papel ativo em `equipe` ou nulo.
- `tem_papel(papel)` → administrador sempre `true`; senão, tem esse papel ativo. Liberada para anon também (é usada em regras de RLS, como `e_admin()`; para visitante devolve `false`).
- `pode_ver_regiao(id)` → administrador, moderador, financeiro e suporte veem todas; franqueado só a dele.
- `minha_regiao_equipe()` → região do franqueado (ou nulo).

### Onde cada papel é conferido no banco
- Policies novas de leitura (só `select`, com `(select tem_papel(...))` para rodar uma vez por consulta): `anuncios`, `radar_pedidos`, `radar_propostas`, `denuncias`, `vitrines_lojas` (moderador); `pagamentos`, `vitrines_lojas`, `anuncios`, `planos` (financeiro); `perfis_verificacoes`, `perfis`, `planos` (suporte).
- Funções novas da moderação: `moderar_anuncio(id, aprovar|recusar, motivo)`, `moderar_pedido(id, aprovar|recusar, motivo)`, `resolver_denuncia(id, procedente)`. Só item **em análise** (aprovar não ressuscita rascunho nem congelado). Fecham as denúncias abertas do item. A tela de moderação passa a usar estas funções para todos (antes atualizava a tabela direto, o que só funcionava para o admin).
- Funções reescritas (mesmo corpo, só muda quem pode): `moderar_banner_vitrine`, `moderar_radar` (moderador); `admin_resumo_pagamentos` (financeiro); `admin_lojas` (suporte; franqueado com a região forçada), `admin_acao_loja` (suporte só `suspender`/`reativar`), `admin_analisar_verificacao` (suporte).
- `congelar_anuncio` continua só administrador.

### Tela 14 · `/admin/equipe` (só administrador)
- Buscar a conta por celular (perfis.whatsapp, só dígitos) ou e-mail (procura no Clerk pelo servidor, com `CLERK_SECRET_KEY` que já existe; sem a chave, a busca por e-mail mostra "indisponível").
- `equipe_buscar_conta(busca)`, `equipe_lista()`, `equipe_salvar(usuario, papel, regiao, observacao)`, `equipe_desativar(usuario, observacao)`.
- Regras no banco: só administrador; não mexe em si mesmo; nunca deixa o OLAKI sem administrador ativo (trava `pg_advisory_xact_lock` para dois admins não se rebaixarem ao mesmo tempo); franqueado exige região; uma região tem no máximo um franqueado ativo.
- `equipe_lista()` devolve quem pôs (`adicionado_por_nome`) e quem tirou (`desativado_por_nome`) cada pessoa.

### Franqueado = `equipe` + espelho em `microrregioes.franqueado_id`
Uma fonte só. A equipe (papel franqueado + região) manda e `microrregioes.franqueado_id` (PAINEL-ADMIN, "Quem entra") é o espelho:
- A migração põe na equipe quem já estava em `franqueado_id` e limpa o que não bate (o valor antigo fica em `logs_atividade`).
- Gatilho em `equipe`: pôr, trocar de região, mudar de papel ou tirar atualiza `franqueado_id`.
- Gatilho em `microrregioes`: mudar `franqueado_id` direto (pelo Supabase) põe a pessoa como franqueado na equipe e tira o anterior. Recusa quem já está na equipe com outro papel.

## 2. Compliance jurídico · `/admin/compliance` (só administrador)

Fluxo: abrir a tela grava um acesso. Para ver qualquer dado, a pessoa escreve o **motivo** (ex.: "Ofício 123/2026 da Delegacia de Corrente") e toca em "Começar consulta". Isso cria uma **consulta** (linha em `compliance_acessos`) com validade em minutos (configuração). Toda busca, toda conta aberta e todo relatório grava uma linha ligada à consulta, com motivo, IP e navegador. Cada linha também cai em `logs_atividade`.

### Tabela `compliance_acessos`
`id`, `consulta_id` (a consulta que abriu), `admin_id`, `tipo` (`entrar`, `abrir`, `buscar`, `ver_conta`, `relatorio`, `ver_relatorio`), `motivo`, `busca`, `alvo_usuario`, `alvo_anuncio`, `ip` (do banco), `ip_navegador` (o servidor do site manda, do cabeçalho da Vercel), `user_agent`, `criado_em`. RLS: só administrador lê; escrita só pelas funções.

### Funções (só administrador)
- `compliance_entrar(ip)`: grava que a tela foi aberta.
- `compliance_abrir(motivo, ip)` → id da consulta.
- `compliance_buscar(consulta, busca, ip, ids)`: contas por id, nome, celular, CNPJ ou nome da loja; anúncios por id ou título. Acha também **conta, loja e anúncio apagados** (pelo que ficou em `logs_atividade`): é o caso comum de pedido da polícia (o golpista apaga a conta e tudo cai em cascata). Busca por e-mail: o e-mail fica no Clerk; o servidor acha os ids lá (`CLERK_SECRET_KEY`) e manda em `ids`, e o banco busca só por eles (o e-mail buscado fica gravado).
- `compliance_conta(consulta, usuario, ip)` → jsonb com cadastro (perfil completo, aceites dos termos), lojas, anúncios e o histórico de `logs_atividade` (ações da pessoa e mudanças nos registros dela: data, IP, navegador, quem fez, campos alterados com antes/depois) dos últimos N meses. Conta apagada: `perfil_apagado` (último cadastro guardado), `lojas_apagadas`, `anuncios_apagados` e os aceites vêm do histórico. O e-mail do login é lido no Clerk pelo servidor depois que o acesso foi gravado.
- `compliance_pedir_relatorio(consulta, usuario, motivo, ip)` → id do relatório (motivo obrigatório, pode ser outro número de ofício).
- `compliance_relatorio(relatorio, ip)` → os mesmos dados + cabeçalho (quem gerou, quando, motivo). Só quem pediu, dentro da validade.

### Relatório
`/admin/compliance/relatorio/[id]`: página HTML para imprimir (botão "Imprimir ou salvar em PDF" chama `window.print()`; CSS `@media print`). Sem biblioteca de PDF. O motivo nunca vai no endereço.

### Configurações novas (grupo Geral, editáveis em /admin/configuracoes, com log)
- `compliance.consulta_minutos` (60): validade de uma consulta e de um relatório.
- `compliance.meses_historico` (6): quantos meses de histórico aparecem (Marco Civil art. 15: mínimo 6 meses; o banco nunca usa menos que 6).
- `compliance.max_linhas_historico` (2000): teto de linhas de histórico por conta. Quando corta, o relatório diz no cabeçalho e mostra a data da linha mais antiga que entrou.
- Valor estranho salvo no painel (1.5, texto) não quebra a tela: `config_inteiro` arredonda para baixo e mantém entre o mínimo e o máximo (minutos 1 a 1440, meses 6 a 120, linhas 1 a 20000).

## 3. Painel (Next.js)
- `src/lib/admin/equipe.ts`: `lerPapel()`, `exigirTela(tela)` (redireciona para entrar, ou 404 se o papel não pode) e `exigirEquipe()` (layout).
- `src/lib/tipos-equipe.ts`: papéis, nomes, telas por papel (o menu esconde o que o papel não usa).
- Layout do painel: aceita qualquer pessoa ativa da equipe e mostra só as telas dela. `/admin` (Resumo) manda quem não é administrador para a primeira tela que pode usar.
- Moderação, Lojas e Pagamentos (e o CSV) usam `exigirTela`. Botões que o papel não pode usar somem (congelar, cortesia, trocar plano, selo); o banco recusa de qualquer jeito.
- Rotas: `LINK_ADMIN_EQUIPE`, `LINK_ADMIN_COMPLIANCE`, `linkRelatorioCompliance(id)` em `src/lib/rotas.ts`.

## 4. Sem variável nova
Usa `CLERK_SECRET_KEY` (já existe) para buscar por e-mail. Nenhuma chave no banco.

## 5. Pontos em aberto (para o Raniel decidir)
- IP no histórico: o banco grava o IP que chega no Supabase. Como o site fala com o banco pelo servidor da Vercel, quase sempre esse IP (e o navegador) é o do servidor, não o da pessoa. **Por isso a tela e o relatório marcam esses IPs com * e dizem com todas as letras que costumam ser do servidor do OLAKI.** Um cabeçalho mandado pelo servidor não resolve sozinho: qualquer pessoa pode chamar o Supabase direto e inventar o cabeçalho, e o banco não guarda chave para conferir assinatura. Para o Marco Civil ficar redondo, o próximo passo é gravar o IP da pessoa no servidor (com a chave secreta, numa tabela de acessos só do servidor) em cada ação, e a porta (Cloudflare na frente, ver ARQUITETURA.md).
- IP de quem usa o Compliance: `ip` é o que chegou ao banco; `ip_navegador` é o que o painel informa (cabeçalho da Vercel). Um administrador que chama a função direto pode informar outro valor, por isso o relatório escreve "informado pelo painel" ao lado e mostra os dois.
- Franqueado: por enquanto só vê a lista de lojas da região dele. Resumo da região e moderação da região podem entrar depois, quando o modelo de franquia for decidido.
- Menu do painel no celular: com 11 telas, os botões de baixo ficam estreitos. Vale trocar por um menu que rola para o lado ou um botão "Mais".
