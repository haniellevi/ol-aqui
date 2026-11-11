# Plano: gestão e exclusão de usuários, lojas e anúncios + melhorias do grid e do painel

Decidido com o Raniel em 10/11/2026. Base para os próximos PRs (um por etapa).

> **Base:** este trabalho está na branch `claude/gestao-exclusao`, criada a partir de `origin/main`
> (e9dfb05), na pasta `~/workspace/OLAQUI-gestao-exclusao`. A `main` não tem migration repetida.
>
> **Pendência fora deste plano:** a pasta `~/workspace/OLAQUI` (branch `codex/visual-compacto-aki`)
> tem cerca de 150 arquivos sem commit. Entre eles estão migrations que não existem em nenhuma branch:
> `20261110174000_aki_lojistas.sql` e `20261110175000_admin_aki_lojistas.sql` (trabalho novo),
> mais `20261110190000_gestao_usuarios_lojas.sql` e `20261110191000_marca_mercado_da_regiao.sql`,
> versões antigas do que já entrou na `main` como `20261110234135` e `20261110190000`.
> Essas duas antigas **não** devem ser aplicadas. Quem estiver mexendo nessa pasta precisa salvar o
> trabalho do Aki para lojistas numa branch a partir da `main`, renomeando as migrations para
> depois de `20261110234459`.

---

## 1. Regras (o que foi decidido)

| Situação | Regra |
|---|---|
| Qualquer exclusão | Sai do ar na hora → **lixeira por 30 dias** → apagado de vez por rotina automática, junto com as fotos do Storage. |
| Usuário exclui a própria conta | Conta, loja e anúncios vão **juntos** para a lixeira. Se ele **entrar de novo** nos 30 dias, vê "Sua conta será excluída em X dias. Cancelar?" e recupera tudo com um clique. |
| Dono exclui só a loja | Os anúncios da loja vão **junto** para a lixeira. Restaurar a loja restaura os anúncios. |
| Loja com gerente e o dono sai | Loja vai para a lixeira, **gerente perde o acesso** e recebe aviso. Se o dono voltar em 30 dias, tudo volta. |
| Anúncio congelado (prova) | A exclusão segue normalmente para o resto. **Só o congelado fica guardado**, escondido, até o admin liberar. |
| Admin pune (golpe, conteúdo proibido) | **Suspender, não apagar**: conta, loja e anúncios saem do ar e ficam guardados como prova. O mesmo celular não cria conta nova. |
| Apagar de vez na hora | Só o admin, **dentro da tela Lixeira**, digitando o nome/slug para confirmar. Uso: pedido LGPD ou lixo óbvio. |
| Conversas após exclusão definitiva | Continuam, mostrando "usuário excluído" / "anúncio removido". Nome, foto e celular somem. |
| Pagamentos | Fica só o financeiro (valor, data, recibo, ~5 anos). O resto da pessoa é apagado/anonimizado. |
| Histórico (`logs_atividade`) | Na exclusão definitiva, tira nome, celular e e-mail dos registros da pessoa. Registros com mais de 1 ano também têm os dados pessoais limpos. A ação em si continua registrada. |
| Lojas por pessoa | Continua **1 loja por pessoa** (`dono_id` único). Ajuda vem pelos gerentes. |
| Quem usa o painel | Só o Raniel (um nível de admin). Níveis ficam para depois. |

---

## 2. Como está hoje e o que precisa mudar

| Hoje | Problema | Mudança |
|---|---|---|
| Excluir conta chama `clerk.users.deleteUser` na hora e o webhook apaga tudo em cascata. | Sem lixeira, sem volta. | Excluir conta só **marca** o pedido (`exclusao_pedida_em`), tira conta/loja/anúncios do ar e mostra a tela de cancelar no próximo login. O `deleteUser` do Clerk só roda na limpeza dos 30 dias. |
| Conteúdo congelado faz a exclusão falhar e o Clerk ficar tentando de novo. | Conta presa sem saída. | Congelado é separado do dono (fica guardado e escondido); o resto segue a regra normal. |
| Não existe função de descongelar. | Prova fica presa para sempre. | Nova ação admin **Descongelar / liberar prova**, com motivo. |
| Admin só tem `admin_bloquear_usuario`; loja e anúncios ficam no ar. | Bloqueado continua vendendo. | **Suspender usuário** tira do ar a loja e os anúncios (guardando o status de antes) e bloqueia o celular. **Reativar** volta ao estado anterior. |
| Admin não consegue excluir conta. | Não atende pedido LGPD. | Botão **Excluir conta** na ficha do usuário → vai para a lixeira (mesma regra do usuário). |
| `admin_excluir_loja` faz DELETE físico; dono não tem tela para excluir a loja. | Sem volta; as fotos ficam no Storage. | Excluir loja = lixeira (aproveita `arquivada_em`/Arquivar da `main`). Tela para o dono excluir a própria loja. DELETE físico só pela limpeza ou pela Lixeira. |
| `vitrines_acoes_admin` apaga em cascata com a loja. | Perde o histórico da loja. | Trocar para SET NULL ou guardar o id sem FK. |
| Lixeira de anúncios sem prazo; as fotos nunca saem. | Storage cresce para sempre. | Rotina pg_cron diária apaga de vez o que tem mais de 30 dias e remove as fotos sem uso (reaproveitar a checagem de `apagarFoto`). |
| `pagamentos.vitrine_id` é RESTRICT. | Bloqueia a limpeza da loja. | Na limpeza, **anonimizar** a loja que tem pagamento (como o webhook já faz) em vez de apagar. |
| `logs_atividade` sem prazo e com dados pessoais. | Conflito com a LGPD. | Rotina de limpeza (1 ano + exclusão definitiva). |

### Estados

- **Conta:** `ativa` → `suspensa` (admin) | `exclusao_pendente` (30 dias) → apagada/anonimizada.
- **Loja:** `ativa` / `inadimplente` / `suspensa` / `na_lixeira` (com data) → apagada ou anonimizada.
- **Anúncio:** os atuais + `excluido` com `excluido_em` (já existe). Restaurar nunca volta direto para `ativo` (regra atual mantida).
- Cada item guarda **o status de antes** e **o motivo** (quem, quando, por quê), para restaurar certo.

### Cascata (sempre na mesma ordem)

`conta → loja → anúncios`. Restaurar sobe pelo mesmo caminho. Um anúncio que já estava na lixeira antes **não** volta junto (só o que caiu pela cascata).

---

## 3. Painel admin

1. **Lixeira** (novo item no menu): contas, lojas e anúncios excluídos, com dias restantes, quem excluiu e o motivo. Ações: **Restaurar** e **Apagar de vez** (digitar o nome para confirmar).
2. **Ficha única do usuário**: dados, loja, gerentes, anúncios, pagamentos, denúncias e histórico. Botões: Suspender / Reativar / Excluir conta / Restaurar.
3. **Busca de anúncios**: por título, loja ou celular. Filtros novos: vendidos, vencidos, congelados, lixeira.
4. **Descongelar / liberar prova** na moderação.
5. Conferir a busca de usuários por e-mail (o doc diz que funciona; o SQL `admin_usuarios` não procura por e-mail).
6. Itens já levantados em `AUDITORIA-PAINEL-2026-11-10.md` (separar Ver loja de Gerenciar, Atendimento no menu, botão Sair, filas paginadas) entram junto quando tocarem a mesma tela.

---

## 4. Grid público

1. **Fotos leves:** miniatura de ~400–600px para os cards (gerada no envio ou via `next/image`, que já tem `remotePatterns`). Hoje o card baixa a foto de até 1600px.
2. **Filtros em mais categorias:** levantar no banco as **3 categorias com mais anúncios** (fora Carros e Casas) e criar as facetas delas em `buscar_anuncios_com_facetas`.
3. **Carregar ao rolar** no celular, **mantendo os links `?pagina=N`** para o Google.
4. **Busca mais rápida:** cache curto nas buscas/categorias (hoje `force-dynamic`), evitar as 3 consultas extras na busca vazia e rever o `count(*)`.
5. Medir o celular (Lighthouse/CWV) **antes e depois** da etapa 4.

---

## 5. Ordem das etapas (um PR cada)

| # | Etapa | Pronto quando |
|---|---|---|
| 0 | Atualizar com `main` e conciliar as migrations locais | Branch nova a partir de `main`, sem migration duplicada. |
| 1 | Regras de lixeira/suspensão/exclusão no banco + rotina de limpeza + exclusão de conta adiada (Clerk) | Testes cobrindo: conta com loja, loja com gerente, congelado, pagamento, cancelar no login, limpeza aos 30 dias. |
| 2 | Tela Lixeira + Excluir conta e Suspender no admin + o dono excluir a própria loja | Fluxos testados no navegador. |
| 3 | Ficha única, busca de anúncios, descongelar, busca por e-mail | Idem. |
| 4 | Fotos leves no grid | Medição de antes e depois no celular. |
| 5 | Filtros (3 categorias), carregar ao rolar, cache | Google ainda acha `?pagina=N`. |
| 6 | Limpeza do histórico (LGPD) + revisar a política de privacidade | A política descreve os 30 dias e o que fica guardado. |

## Etapa 1 — feita na branch `claude/gestao-exclusao` (ainda não está em produção)

**Banco** (`supabase/migrations/20261111000000_lixeira_contas_lojas.sql`, teste `450_lixeira_contas_lojas.sql`):
- Tabelas `lixeira_contas` e `lixeira_lojas` (prazo de 30 dias, origem, motivo, status anterior).
- `vitrines_lojas.excluida_em` (situação `excluida`) e `anuncios.excluido_com_loja`.
- Conta na lixeira: `usuario_id()` fica nulo, igual a uma conta bloqueada.
- Dono: `excluir_minha_loja`, `restaurar_minha_loja`, `pedir_exclusao_conta`, `minha_exclusao_pendente`, `cancelar_exclusao_conta`.
- Admin: `admin_lixeira_conta`, `admin_lixeira_loja`, `admin_antecipar_limpeza` (pede o nome exato) e `admin_lixeira` (lista).
- `admin_bloquear_usuario` agora suspende a loja e pausa os anúncios no ar, e devolve tudo igual ao reativar.
- Limpeza: `limpeza_pendente`, `purgar_anuncio`, `purgar_loja`, `urls_sem_uso` e pg_cron `olaki-limpeza-lixeira` às 04:00 UTC.
- Congelados nunca vão para a lixeira nem são apagados. Uma loja com pagamento ou prova fica anonimizada.

**Site:**
- Excluir conta só pede a exclusão. O Clerk só é apagado depois de 30 dias.
- Nova página `/conta-em-exclusao` com o botão "Cancelar a exclusão". A área da conta manda para lá.
- A lógica de apagar conta saiu do webhook e foi para `src/lib/conta-exclusao.ts`. Conteúdo congelado agora não trava a exclusão: a prova fica e o resto sai.
- Nova rota `/api/interno/limpeza`, protegida por `LIMPEZA_SECRET`.

**Para ligar em produção (precisa do "sim" do Raniel):**
1. Fazer backup do banco e aplicar a migration.
2. Criar o segredo `LIMPEZA_SECRET` (32 ou mais caracteres) na Vercel e o mesmo valor no Vault do Supabase com o nome `olaki_limpeza_token`.
3. Publicar o site **junto** com a migration. Sem o site novo, o botão antigo apagaria a conta na hora.
4. Conferir se o Clerk deixa o usuário excluir a conta pelo próprio painel do Clerk. Se deixar, desligar essa opção, porque ela pula a lixeira.

**Limites conhecidos:**
- Quem tem loja com pagamento e apaga só a loja continua com ela anonimizada no nome. Como cada pessoa só pode ter uma loja, essa pessoa não consegue abrir outra. Na etapa 2 o dono é avisado disso antes de confirmar.
- Os anúncios voltam ao ar ao restaurar. Os que venceram nesse meio-tempo são expirados pela rotina da noite.

## Etapa 2 — feita na branch `claude/gestao-exclusao-painel` (sobre a etapa 1; ainda não está em produção)

**Banco** (`supabase/migrations/20261111010000_painel_lixeira.sql`): `minha_loja_exclusao()` diz ao dono se a loja está na lixeira, o prazo, se ele pode restaurar e se a loja já teve pagamento. Teste no `450_lixeira_contas_lojas.sql`.

**Painel:**
- Nova tela `/admin/lixeira`, como aba da área Lojas (o menu lateral continua com 7 itens). Lista contas, lojas e anúncios, com dias restantes, "Restaurar" e "Apagar de vez agora" (pede o nome exato e roda a limpeza na hora).
- Ficha do usuário: "Suspender conta" / "Reativar conta" (punição) e "Excluir conta" (lixeira, para pedido do titular).
- Ficha da loja: "Excluir loja" agora manda para a lixeira. Apagar de vez só pela tela Lixeira. Loja na lixeira esconde edição e operação.
- Filtro "Na lixeira" na lista de lojas. Histórico com os nomes novos (Conta suspensa, Movido para a lixeira etc.).

**Dono (Minha loja):** botão "Excluir minha loja" (escrever EXCLUIR), aviso quando a loja já teve pagamento, e tela "Restaurar minha loja" enquanto estiver na lixeira.

**Falta conferir:** os fluxos no navegador (sem as chaves no computador, o site não abre aqui). A ação antiga `excluirLojaAdmin` (apagar loja na hora) não aparece mais na tela; dá para retirar numa etapa seguinte.

## Riscos

- **Produção:** as migrations mexem em dados reais. Cada etapa precisa de backup e teste antes de aplicar.
- **Clerk:** adiar o `deleteUser` muda o webhook atual. O retry do webhook ainda não foi ensaiado de verdade (`preparacao-piloto/privacidade.md`).
- **Prazo de 5 anos do financeiro:** confirmar com o contador.
- O estado real do banco de produção e dos jobs pg_cron ainda **não foi conferido**; só as migrations foram lidas.
