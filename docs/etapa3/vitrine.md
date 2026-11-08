# Etapa 3 · Vitrine completa da loja + página de planos

Nota para quem programa. Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md, seção 5 ("Vitrine da loja",
decidido pelo Raniel em 07/11/2026) e PAINEL-ADMIN.md, tela 2 (Planos).
A tabela que o documento chama de `lojas` é `public.vitrines_lojas` (tipo `pf` ou `loja`).
Pessoa física não tem página de vitrine: só o cartão do vendedor.

Migração: `supabase/migrations/20261107040000_vitrine_completa.sql`
Teste do banco: `supabase/testes/70_vitrine_completa.sql`
Tipos: `src/lib/tipos-vitrine.ts` · Dados: `src/lib/dados/vitrine-completa.ts`

## 1. Banco

### Colunas novas em `vitrines_lojas`
| Coluna | Regra |
|---|---|
| `banner_tipo` | `foto` ou `modelo` (padrão `modelo`). `foto` exige `banner_url` |
| `banner_url` | Só arquivo do Storage do OLAKI na pasta `<dono>/vitrine/` (`foto_do_olaki(url, dono, 'vitrine')`) |
| `banner_modelo` | Desenho do banner modelo: `liso`, `listras`, `pontos` (desenho é código, não negócio) |
| `banner_cor` | `#RRGGBB` de uma das cores da configuração `vitrine.banner_cores` |
| `endereco` | Até 160 letras |
| `lat`, `lng` | Os dois juntos ou nenhum (botão "Usar minha localização" no celular, na loja) |
| `horarios` | JSON por dia (`dom`..`sab`), cada dia com até 3 faixas `{"abre":"08:00","fecha":"12:00"}`, em ordem e sem cruzar. Dia vazio = fechado. `horarios_validos()` confere |
| `instagram` | Só o @ (o banco limpa `@`, `instagram.com/...`, maiúsculas) e confere `^[a-z0-9._]{1,30}$` |
| `sobre` | "Sobre nós", até 1500 letras. Copiado de `descricao` na migração; a tela passa a editar só `sobre`. Daqui em diante o banco copia o `sobre` (já filtrado) para `descricao` (600 letras); o dono não grava `descricao` direto e a página pública não lê `descricao` |
| `formas_pagamento` | Lista de textos, cada um da configuração `vitrine.formas_pagamento` |
| `faz_entrega`, `entrega_obs` | sim/não/não informado + observação até 200 letras |
| `banner_moderado_em`, `banner_moderado_motivo` | Só o sistema/admin grava (quando a equipe tira uma foto do banner) |

A `capa_url` antiga vira `banner_url` com `banner_tipo = 'foto'` na migração (continua só aparecendo se o plano deixar).

### Colunas novas em `planos` (editáveis na tela 2 do painel, com log pelo gatilho `log_planos`)
| Coluna | Sentido | Semente |
|---|---|---|
| `vitrine_foto_fachada` | pode usar foto no banner | teste/pf_gratis: não · slim/full: sim |
| `vitrine_secoes_max` | seções próprias (vazio = sem limite) | teste/pf_gratis: 0 · slim: 3 · full: 10 |
| `vitrine_fixados_max` | produtos fixados no topo (vazio = sem limite) | teste/pf_gratis: 0 · slim: 3 · full: 6 |
| `recomendado` | plano em destaque na página /planos (só um: marcar um desmarca o outro, gatilho `planos_0_recomendado`) | slim |

A semente desses valores roda com o gatilho `log_planos` desligado (não é mudança de ninguém); daí em diante toda mudança feita no painel fica no histórico.

### Tabelas novas (RLS ligado)
- `loja_secoes (id, vitrine_id, nome, ordem, ativa)`: dono faz tudo nas da sua loja; admin faz tudo; ninguém mais lê direto (o público lê pela função).
- `loja_secao_anuncios (secao_id, anuncio_id, ordem)`: o anúncio tem que ser da mesma vitrine da seção (gatilho). Máximo por seção: `vitrine.anuncios_por_secao_max`.
- `anuncios.fixado_na_loja`: ordem do fixado (vazio = não fixado).

### Como cada regra é garantida no banco
| Regra | Onde |
|---|---|
| Foto no banner só em plano com `vitrine_foto_fachada` | gatilho `vitrines_2_validar_vitrine` + `pode_enviar_foto()` (pasta `vitrine` só com o recurso) |
| Foto só do Storage do OLAKI, pasta do dono | `foto_do_olaki(url, dono, 'vitrine')`, mesmo do anúncio |
| Limite de seções | gatilho `secoes_0_validar` no INSERT (conta todas as seções da loja) |
| Limite de fixados | gatilho `anuncios_2_fixar` ao fixar (conta os fixados da loja) |
| Anúncio da seção é da mesma loja | gatilho `secao_anuncios_0_validar` |
| Pessoa física sem vitrine | `recursos_vitrine()` devolve tudo falso/0 para `tipo = 'pf'`; o gatilho apaga endereço exato e localização de pessoa física |
| Seção só na própria loja | gatilho `secoes_0_validar` recusa ("Loja não encontrada") antes da RLS |
| Anúncio fora do ar (vendido, vencido, rascunho, em análise, congelado) sai do fixado e libera a vaga | gatilho `anuncios_2_fixar` |
| Palavras proibidas em `sobre`, `entrega_obs` e nome de seção | `texto_bloqueado()` com `moderacao.palavras_bloqueadas` (recusa com mensagem) |
| Só o dono escreve | RLS (`vitrine propria editar`, políticas das seções) |
| Admin modera | admin passa em tudo (`acesso_sistema()`); `moderar_banner_vitrine(vitrine, motivo)` tira a foto do banner, grava o motivo e guarda o endereço tirado em `banner_moderado_url` (o dono não grava a mesma foto de novo; o aviso só sai com foto nova); devolve o endereço para o painel apagar o arquivo do Storage; seções têm política de admin |
| **Plano menor (downgrade)** | nada é apagado. A leitura pública mostra só as primeiras N seções ativas (por ordem), só os primeiros N fixados (por ordem) e o banner modelo quando o plano não tem foto. Voltando ao plano maior, tudo reaparece |

Os gatilhos de limite são SECURITY INVOKER de propósito: dentro de SECURITY DEFINER o usuário vira `postgres` e `acesso_sistema()` liberaria tudo.
As funções de ordenar (`ordenar_secoes`, `definir_anuncios_secao`, `fixar_anuncio`, `ordenar_fixados`) também são INVOKER: valem a RLS e os gatilhos.

### Funções
| Função | Quem chama | O que faz |
|---|---|---|
| `vitrine_publica(slug)` → jsonb | todos | Só campos públicos da loja ativa (dono/admin veem a inativa): banner efetivo, logo, selo, WhatsApp (mesma regra de `anuncio_publico`), informações, seções visíveis com os ids dos anúncios no ar. Nunca CNPJ, gateway ou plano |
| `anuncios_vitrine(vitrine_id, ordem, pagina)` | todos | Anúncios no ar da loja, fixados efetivos primeiro e mais novos (ou `menor_preco`), com a categoria para os grupos automáticos. Uma página de `vitrine.anuncios_por_pagina`; os produtos das seções visíveis vêm sempre (`na_pagina = false` quando estão fora da página) |
| `recursos_vitrine(vitrine)` / `recursos_vitrine_id(id)` / `minha_vitrine_recursos()` | gatilhos / dono | foto, seções e fixados do plano que vale agora (`plano_efetivo`). A versão por id existe porque quem está logado não lê todas as colunas da vitrine (CNPJ, cobrança) dentro dos gatilhos INVOKER |
| `horarios_validos(jsonb)` | check da tabela | formato dos horários |
| `moderar_banner_vitrine(vitrine, motivo)` | admin | tira a foto do banner (botão em /admin/moderacao, que também apaga o arquivo) |

### Configurações novas (tela 3 do painel; todas com histórico)
| Chave | Grupo | Para quê |
|---|---|---|
| `vitrine.banner_cores` | geral | cores do banner modelo |
| `vitrine.formas_pagamento` | geral | formas de pagamento que a loja pode marcar |
| `vitrine.anuncios_por_secao_max` | geral | produtos por seção |
| `vitrine.anuncios_por_pagina` | geral (pública) | produtos por página na loja; o resto aparece em "Ver mais produtos" |
| `planos.perguntas_frequentes` | planos | perguntas da página /planos, uma por linha: `Pergunta | Resposta` |

## 2. Telas e rotas
| Rota | O quê |
|---|---|
| `/loja/[slug]` | Banner (foto ou modelo: cor + nome + logo, nunca vazio), logo, nome, selo, "Chamar no WhatsApp", seções próprias, grupos por categoria, chip "Menor preço" (`?ordem=menor_preco`, funciona sem JS), informações (endereço + "Como chegar", horário com "Aberto agora" no fuso America/Fortaleza, Instagram, Sobre nós, pagamento, entrega). OpenGraph com a foto do banner ou uma imagem gerada (`/loja/[slug]/imagem`) |
| `/minha-conta/loja` | Prévia do banner, menu da vitrine (Banner, Informações, Seções, Produtos no topo, com o uso do plano) e os dados da loja (nome, WhatsApp, cidade, bairro, logo) |
| `/minha-conta/loja/banner` | Foto da fachada cortada no aparelho em 3:1 (1500 x 500, com régua para escolher a parte) ou modelo (cor da lista do painel + desenho). A foto fica guardada mesmo quando o plano não mostra |
| `/minha-conta/loja/informacoes` | Endereço + "Usar minha localização", horários por dia com "Aberto/Fechado" e até 3 faixas, Instagram, "Sobre nós" (o banco copia os primeiros 600 caracteres para a `descricao` antiga), chips de pagamento, entrega |
| `/minha-conta/loja/secoes` e `/minha-conta/loja/secoes/[id]` | Criar, renomear, subir/descer, esconder, apagar seção; escolher os produtos |
| `/minha-conta/loja/fixados` | Fixar/desafixar e ordenar os fixados |
| `/minha-conta/anuncios` | Botão "Fixar na loja" nos anúncios no ar (lojas) |
| `/planos` | Planos ativos da tabela (preço, anúncios, Radar, propostas, vitrine), recomendado em destaque, botão por plano (vendedor → `/minha-conta/plano`; visitante → `/entrar` e volta), perguntas da configuração. `LINK_PLANOS` aponta para cá e mantém `?origem=` |
| `/admin/planos` | Campos novos: foto da fachada, seções, fixados, recomendado |

Quando o recurso não está no plano, a tela mostra "Disponível no …" com os nomes dos planos que têm o recurso (lidos da tabela) e o link para `/planos?origem=vitrine`.

## 3. Arquivos do app
- Leituras: `src/lib/dados/vitrine-completa.ts` · Ações: `src/app/(conta)/minha-conta/loja/vitrine-actions.ts`
- Regras de tela (horário em America/Fortaleza, "Como chegar", Instagram, "Disponível no ..."): `src/components/vitrine/regras.ts`
- Componentes: `banner-loja`, `informacoes-loja`, `form-banner` (+ `cortar-banner.ts`), `form-informacoes`, `gerenciar-secoes`, `escolher-produtos`, `botao-fixar`, `upsell-plano` em `src/components/vitrine/`
- Imagem de compartilhamento do banner modelo: `src/app/(publico)/loja/[slug]/imagem/route.tsx` (sem imagem de fora, nada para dar erro)
- Nenhuma variável de ambiente nova.

## 4. O que ficou para depois
- Moderação do banner: /admin/moderacao lista as fotos de banner mais novas com o botão "Tirar foto do banner" (motivo vai para o dono). Não há fila de "banner novo para revisar": a equipe confere pela lista.
- Horário que passa da meia-noite (ex.: 18:00 às 02:00): hoje a loja divide em dois dias.
