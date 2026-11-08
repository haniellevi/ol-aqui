# Etapa 5 · Painel: mensagens automáticas (tela 13) e relatórios (tela 15)

Nota para o desenvolvedor. Base: PAINEL-ADMIN.md (telas 13 e 15), PRODUTO-CONTAS-ANUNCIOS-ROBO.md
(seções 2, 5, 6 e 7), as tabelas `notificacoes`/`preferencias_avisos` (20261108020000), `eventos_anuncio`,
`pagamentos`, `robo_uso` e docs/DESIGN-SYSTEM.md.

Migração: `supabase/migrations/20261108060000_mensagens_relatorios.sql` · Testes: `supabase/testes/98_mensagens_relatorios.sql`
Tipos: `src/lib/tipos-relatorios.ts` · Leituras: `src/lib/admin/relatorios.ts` e `src/lib/admin/mensagens.ts`
Ações: `src/app/admin/mensagens/actions.ts` · CSV: `src/app/admin/relatorios/csv/route.ts`

## 1. Mensagens automáticas (tela 13, `/admin/mensagens`)

### Tabela `modelos_mensagem` (RLS: só admin lê e edita)

Uma linha por **mensagem + canal**. As linhas são fixas (cada uma está ligada a um acontecimento no
código): o painel só muda `titulo`, `texto` e `ativo`. Não se cria nem se apaga pela API.

| Coluna | Para que serve |
|---|---|
| `chave` | qual mensagem (`codigo_acesso`, `plano_vencendo`, `plano_vencido`, `destaque_acabou`, `proposta_nova`, `prazo_acabou`, `prazo_sem_propostas`, `pedido_novo`, `proposta_escolhida`, `pagamento_confirmado`) |
| `canal` | `notificacao` (aviso dentro do site, já funciona), `whatsapp` e `email` (guardados para depois: **envio em breve**, ainda não há provedor) |
| `nome`, `quando` | nome e "quando é mandada", para o painel (fixos) |
| `variaveis` | as `{variáveis}` que aquela mensagem aceita (fixas) |
| `titulo`, `texto` | o que o admin edita. WhatsApp não tem título; e-mail usa o título como assunto |
| `titulo_padrao`, `texto_padrao` | texto original, para o botão "Voltar ao texto original" (fixos) |
| `ativo` | ligada ou desligada. No canal `notificacao`, desligada = o aviso não é gravado |

Regras garantidas no banco:
- Gatilho `modelos_mensagem_proteger` (antes de INSERT/UPDATE): trava as colunas fixas, apaga espaços,
  tira o título do WhatsApp, grava `atualizado_por = usuario_id()` (o navegador não forja) e **recusa
  variável desconhecida** (`{xyz}`) ou chave `{`/`}` sem par, com mensagem em português (código 23514, `campo:texto`/`campo:titulo`).
- Tamanhos por canal: aviso no site título ≤ 120 e texto ≤ 500 (os mesmos da tabela `notificacoes`),
  WhatsApp texto ≤ 1.000, e-mail título ≤ 150 e texto ≤ 4.000.
- Permissão de coluna: `authenticated` só pode dar UPDATE em `titulo`, `texto`, `ativo`; a policy deixa só o admin.
- Toda mudança vai para `logs_atividade` (gatilho `registrar_log`), com quem, IP e valor antigo.

### Funções

| Função | Quem chama | O que faz |
|---|---|---|
| `mensagem_variaveis_invalidas(texto, variaveis)` | interna (gatilho e semente) | devolve as variáveis que não estão na lista (e `{`/`}` soltas) |
| `mensagem_montar(texto, vars jsonb)` | interna | troca `{variável}` pelos valores, junta espaços, corta em 500 |
| `mensagem_aviso(usuario, chave, vars, link, chave_unica)` | interna (gatilhos/rotina) | lê o modelo `notificacao`; se desligado não grava; se não existir não grava; senão chama `notificar()` (que já respeita `preferencias_avisos` e não repete a mesma `chave_unica`) |
| `radar_aviso(...)` (nova versão) | interna (Radar) | igual a antes (respeita `radar.avisos_ligados`), mas o título e o texto saem do modelo da tela 13. Sem modelo, cai no texto antigo de `configuracoes` |
| `mensagens_avisar_planos()` | rotina (pg_cron de hora em hora; só service_role) | grava "plano vencendo" (dentro de `assinatura.aviso_vencimento_dias`) e "plano vencido" (até `mensagens.vencido_dias_max` dias depois), para plano pago e teste grátis. Uma vez por vencimento (chave única com a data) |
| gatilho `mensagens_destaque_acabou` | destaques: `ativo` → `encerrado` | aviso "destaque acabou" com visualizações e cliques do período (mesma conta de `resultados_destaques`) |
| gatilho `mensagens_pagamento_confirmado` | pagamentos: status vira `pago` | aviso "pagamento confirmado" com valor e o que foi pago |

Aviso nunca derruba a ação principal: os gatilhos pegam qualquer erro e só deixam de avisar.

### Semente

Os textos do Radar que já estavam em `configuracoes` (`radar.aviso.*`) são copiados para os modelos de
`notificacao` na migração (se forem válidos), então o que o Raniel já mudou continua igual. As chaves antigas
ficam (os testes e o painel antigo as conhecem), com a descrição dizendo que agora se edita na tela 13.
O canal WhatsApp de cada mensagem e o e-mail das mensagens de plano e pagamento nascem com texto pronto,
para quando o provedor for contratado.

`codigo_acesso`: o código de login hoje é mandado pelo Clerk (texto configurado no Clerk). O modelo fica
guardado para quando o OLAKI mandar o próprio código pelo WhatsApp.

### Configuração nova

| Chave | Grupo | Padrão | Uso |
|---|---|---|---|
| `mensagens.vencido_dias_max` | `planos` | `3` | até quantos dias depois do vencimento ainda se manda "plano vencido" (evita avisar quem venceu há meses no primeiro dia) |

### Tela

Lista por mensagem; em cada uma, um cartão por canal com: situação ("No site: ligado/desligado",
"WhatsApp: envio em breve", "E-mail: envio em breve"), campos de título e texto, botões das variáveis (tocar
insere no cursor), **prévia ao vivo** com valores de exemplo (`EXEMPLOS_VARIAVEIS` em `tipos-relatorios.ts`,
só para mostrar, não é regra do negócio), aviso na hora de variável desconhecida (a gravação também é barrada
no banco), "Salvar" com "Salvando…" e "Voltar ao texto original" (com confirmação).

## 2. Relatórios (tela 15, `/admin/relatorios`)

Funções `SECURITY DEFINER`, `stable`, que conferem `e_admin()` e devolvem **só números somados** (nada de
nome, telefone ou id de pessoa). Todas recebem `(p_de date, p_ate date, p_regiao uuid)`:
- período no fuso de Fortaleza; vazio = últimos 30 dias até hoje; `de > ate` ou mais de **12 meses**
  (366 dias) é recusado (código 22023). Assim cada consulta tem tamanho limitado.
- região vazia = todas.

| Função | Devolve | Índice usado |
|---|---|---|
| `relatorio_funil` | visualizações de anúncio, cliques no WhatsApp, compartilhamentos, anúncios vendidos, "vendi pelo OLAKI" (sim / não / não respondeu) | `eventos_criado_idx` (data) + `anuncios` pela chave; novo `anuncios_vendido_em_idx` |
| `relatorio_anuncios` | por categoria-mãe e cidade: anúncios no ar agora e publicados no período | `anuncios` por status/região |
| `relatorio_conversao_teste` | por mês de início do teste: começaram, pagaram plano, ainda em teste, acabou sem pagar | `vitrines_lojas.criado_em` (novo índice) + `pagamentos_vitrine_idx` |
| `relatorio_receita` | por mês e tipo (plano, avulso, destaque): quantidade e total pago | novo `pagamentos_pago_em_idx` (só `pago`) |
| `relatorio_custo_aki` | por mês: respostas, conversas, custo em R$ (centavos com fração) | `robo_uso_criado_idx` |

"Visitas" do funil = visualizações de anúncio (`eventos_anuncio`), que é o que o site mede hoje. Buscas não
são medidas (só as buscas vazias do Aki), então o funil começa nas visualizações.

### Tela

Filtros por endereço (`?de=&ate=&regiao=`), com atalhos (Últimos 30 dias, Este mês, 3 meses, 12 meses) em
chips e datas livres. Cada bloco tem barras simples em HTML/CSS (sem biblioteca nova), com o número sempre
escrito ao lado e a barra só como enfeite (`aria-hidden`), e um link "Baixar CSV" daquele bloco.
CSV: `/admin/relatorios/csv?r=funil|anuncios|conversao|receita|aki&de=&ate=&regiao=` (mesma regra do CSV de
pagamentos: `;`, BOM, célula que começa com `= + - @` vira texto, 404 para quem não é admin).

## 3. Rotas novas

| Rota | O que é |
|---|---|
| `/admin/mensagens` | tela 13 (+ item no menu do painel) |
| `/admin/relatorios` | tela 15 (+ item no menu do painel) |
| `/admin/relatorios/csv` | exportação CSV |

Constantes em `src/lib/rotas.ts`: `LINK_ADMIN_MENSAGENS`, `LINK_ADMIN_RELATORIOS`.

## 4. Segredos

Nenhuma chave nova. WhatsApp e e-mail não têm provedor ainda: a tela mostra "envio em breve" e nada é mandado.
Quando houver provedor, a chave vai para a Vercel (variável de ambiente), nunca para o banco.
