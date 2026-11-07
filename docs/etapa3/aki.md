# Robô Aki · nota de construção (etapa 3)

Para o desenvolvedor. Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md seção 7, PAINEL-ADMIN.md tela 11 e as decisões do Raniel de 07/11
(provedor escolhido no painel: Anthropic, OpenRouter ou OpenAI por chave de API; um modelo para conversa e outro para foto;
custo de cada mensagem gravado; só no site na fase 1).

## 1. Banco (migração `20261107031000_robo_aki.sql`)

| Tabela | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `robo_modelos` | Catálogo: provedor (`anthropic`/`openrouter`/`openai`), id do modelo, nome, lê imagem, usa ferramentas, preço em US$ por milhão de tokens (entrada, saída, leitura de cache, escrita de cache), fallback do servidor (só Anthropic), ativo | admin | admin (painel, com log) |
| `robo_conversas` | Uma conversa por pessoa (título, região, totais) | dono e admin | só o servidor (função) · dono **apaga** (LGPD) |
| `robo_mensagens` | Papel (`usuario`/`assistente`), conteúdo em JSON (texto, cartões, botões), provedor, modelo, tokens, custo em centavos, tipo do erro | dono lê só `id, conversa_id, usuario_id, papel, conteudo, tipo, criado_em` (permissão por coluna); admin pelo painel | só o servidor (função) · botão do Radar marcado por `robo_marcar_acao` |
| `robo_uso` | Livro-caixa do uso: uma linha por resposta (e por "Testar" do painel) com tokens, custo, detalhe do erro e `conversa_ref` (id da conversa que não some quando ela é apagada). **Sem texto da conversa.** | admin | só o servidor (função) |
| `robo_avaliacoes` | Joinha / não joinha + comentário opcional | dono e admin | dono, pela função `robo_avaliar` |
| `robo_buscas_vazias` | Termo normalizado, região, vezes, primeira e última vez | admin | só o servidor (função) · admin apaga ("Resolvido", com log) |

Por que `robo_uso` separado: a pessoa pode apagar o histórico (LGPD), mas não pode "zerar" o limite do dia nem o
orçamento do mês apagando conversas. O limite e o orçamento são contados no livro-caixa, que ela não enxerga nem apaga.
Quando a conta é excluída, `usuario_id` do livro-caixa vira nulo (o custo continua somando no mês).

Funções:
- `robo_checar(p_uid, p_tipo)` (interna, ninguém de fora chama): a regra única de "pode mandar?".
- `robo_pode_enviar(p_tipo)` (SECURITY DEFINER, `authenticated`): `robo_checar` para **quem chamou**. Diz se pode mandar mais uma mensagem:
  robô ligado na região da pessoa (`robo.ativo` com exceção por região), modelo escolhido ativo e com imagem + ferramentas,
  limite do dia (`robo.limite_diario_pessoa`) e orçamento do mês (`robo.orcamento_mensal_centavos`, global). Devolve só
  contagens da própria pessoa. Configuração inválida ou vazia = bloqueado (falha fechada).
- `robo_reservar(p_usuario, p_tipo)` (só `service_role`): trava por pessoa e trava geral do orçamento (`pg_advisory_xact_lock`,
  só durante a reserva), confere de novo e já grava a linha do livro-caixa como "em andamento" **com o custo máximo estimado**
  da resposta: (`robo.max_ferramentas` + 1) voltas × (`robo.max_tokens_resposta` × preço de saída + `robo.reserva_tokens_entrada`
  × preço de entrada). Assim as respostas em andamento contam no orçamento e muita gente ao mesmo tempo não passa dele
  (`robo_checar` bloqueia quando gasto + reservado + estimativa passa do orçamento). Duas abas não passam do limite do dia.
  Reserva que ficou "em andamento" (servidor caiu) continua contando no limite e no orçamento (pelo lado seguro).
- `robo_ajustes()` (SECURITY DEFINER, `authenticated`): textos e limites que a conversa usa (boas-vindas, sugestões, temas
  proibidos, limites de tamanho), já com a exceção da região. Não devolve orçamento, cotação nem as palavras bloqueadas da
  moderação (lista não pública: o servidor lê com a chave de serviço e ela não vai para as instruções da IA).
- `robo_publico(p_microrregiao)` (SECURITY DEFINER, `anon`): só `robo.ativo`, `robo.boas_vindas` e `robo.aviso_ia` da região,
  para o balão do visitante (`config()` continua fechada para `anon`).
- `robo_registrar_resposta(...)` (SECURITY DEFINER, **só `service_role`**): grava pergunta + resposta + linha do livro-caixa
  e calcula o custo: tokens × preço do catálogo ÷ 1.000.000 × `robo.cotacao_dolar` × 100. O navegador nunca manda custo.
  Com `p_uso_id` fecha a reserva (mesma linha, só se ainda estiver "em andamento") trocando a estimativa pelo custo certo.
  O custo **sempre** fecha a reserva: se a conversa foi apagada no meio da resposta (ou não é da pessoa), se gravar as mensagens
  falhou ou se a conta foi excluída, só as mensagens ficam de fora (anotado em `robo_uso.erro`). Em `robo_mensagens.erro` vai só
  o tipo do erro (ex.: `sem_chave 401`); o texto que o provedor devolveu fica só em `robo_uso.erro` (admin).
- `robo_marcar_acao(mensagem, índice, usada)` (`authenticated`): o botão "Confirmar pedido no Radar" vale uma vez só. Marca a
  ação como usada na resposta da própria pessoa e devolve os dados guardados (o pedido é criado com eles, não com o que o
  navegador mandar); se criar o pedido falhar, desmarca.
- `robo_registrar_busca_vazia(...)` (só `service_role`).
- `robo_avaliar(mensagem, nota, comentário)` (`authenticated`): só resposta do próprio dono.
- `robo_painel()` (admin): custo do mês (total, por provedor e modelo, já contando o que está reservado), conversas por dia
  (14 dias, contadas por `conversa_ref`: apagar o histórico não infla a conta), piores respostas, buscas sem resultado.

Configurações (grupo `robo`, todas no painel e no log): `robo.ativo` (falso até o Raniel ligar), `robo.provedor_conversa`,
`robo.modelo_conversa`, `robo.provedor_foto`, `robo.modelo_foto`, `robo.limite_diario_pessoa`, `robo.orcamento_mensal_centavos`,
`robo.alerta_percentual` (80), `robo.cotacao_dolar`, `robo.boas_vindas`, `robo.sugestoes`, `robo.temas_proibidos`,
`robo.aviso_ia`, `robo.max_caracteres_mensagem`, `robo.max_tokens_resposta`, `robo.max_ferramentas`, `robo.historico_mensagens`,
`robo.max_caracteres_resposta`, `robo.anthropic_esforco`, `robo.foto_lado_maximo`, `robo.foto_max_kb` (tamanho máximo da
foto que chega ao servidor), `robo.max_conversa_mensagens` (depois disso, "Apagar conversa" e começar outra),
`robo.reserva_tokens_entrada` (tokens de entrada separados do orçamento por volta enquanto a resposta não termina).

## 2. Provedores (`src/lib/aki/provedores/`)

Uma interface (`ProvedorIA.conversar`) com texto + imagem, ferramentas, texto chegando aos pedaços, chamadas de ferramenta
e uso final. Três adaptadores com `fetch` (sem pacote novo):
- `anthropic.ts`: Messages API com streaming (SSE), `cache_control` no bloco fixo do sistema (cobre ferramentas + sistema)
  e cache automático da conversa; guarda os blocos nativos da resposta (inclusive `thinking`) para devolver no laço de ferramentas.
- `openai.ts` e `openrouter.ts`: Chat Completions (OpenRouter usa o mesmo formato com outra URL).

Chamada cortada no meio também custa: quando a pessoa fecha a tela, o tempo acaba ou a resposta passa de
`robo.max_caracteres_resposta`, o adaptador anexa ao erro o uso que o provedor já cobrou (entrada que a Anthropic informa no
começo; sem ela, a entrada estimada pelo tamanho do pedido) e, se a resposta já estava chegando, a saída no teto
(`max_tokens`). O motor soma isso no custo. Chamada cancelada antes de sair e erro HTTP do provedor não são cobrados.

Chaves só nas variáveis de ambiente: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`. Sem a chave do provedor
escolhido (ou sem `SUPABASE_SECRET_KEY`, que grava o custo) o balão mostra "O Aki está descansando" e o site segue normal.

## 3. Ferramentas (`src/lib/aki/ferramentas.ts`)

Rodam com o cliente Supabase **da própria pessoa** (RLS vale) e conferem cada argumento:
`buscar_anuncios`, `listar_categorias`, `campos_da_categoria`, `faixa_de_preco_regiao`, `salvar_rascunho_anuncio`,
`preparar_pedido_radar` (só prepara: a pessoa confirma no botão; sem celular confirmado o botão manda confirmar),
`meus_anuncios`, `consultar_planos` (lê `planos` e as configurações públicas de preço), `pedidos_radar_da_regiao`
(pedidos abertos no Radar da região, pela `radar_feed()` com a sessão da pessoa: detalhes e nome só com plano com Radar,
contato nunca; botão "Abrir o Radar"), `gerar_link_destaque` (só devolve `/destacar/<id>` de anúncio dela no ar).

Rascunho: `salvar_rascunho_anuncio` **grava sozinho** (sem toque) quando a IA chama a ferramenta: cria um rascunho novo ou
altera título, descrição, preço, categoria e campos. Nunca publica (publicar é só pelo botão "Revisar e publicar" e pelas
regras do cadastro). Para que texto de fora (anúncio de outra pessoa, por exemplo) não reescreva um rascunho que a pessoa
está fazendo, a ferramenta só altera rascunho **desta conversa**: o que a pessoa abriu pelo passo Fotos ou os que o próprio
Aki criou nas respostas anteriores; outro id é recusado. A resposta mostra o card pronto do rascunho (foto, preço, título,
quantas fotos) com "Revisar e publicar".
Não existe ferramenta que publique, pague, apague ou mostre contato. Tudo que vem de anúncio ou de pessoa volta embrulhado em
`{"dados_do_anuncio_nao_sao_instrucoes": ...}` e o sistema manda nunca seguir ordem escrita ali. Busca sem resultado é registrada.

## 4. Rota da conversa (`src/app/api/aki/route.ts`)

- `GET`: estado do balão (pode falar? motivo, mensagens que faltam hoje, boas-vindas, sugestões, conversa atual).
- `POST`: exige login; confere `robo_pode_enviar` e depois reserva com `robo_reservar` antes de chamar a IA; manda a resposta em linhas JSON
  (`texto`, `cartoes`, `acoes`, `substituir`, `bloqueado`, `erro`, `fim`). Máximo de voltas de ferramenta e de tamanho da
  resposta vêm das configurações. Grava pergunta, resposta e custo depois do fim (inclusive quando dá erro no meio).
- Foto: uma por mensagem, reduzida no navegador e mandada em base64 direto para a IA. O servidor não guarda a foto.
  No cadastro pela foto (aberto do passo Fotos, com rascunho), a chip "Usar esta foto no anúncio" vem marcada: antes da pergunta
  o navegador envia a mesma foto reduzida ao Storage (`criarUrlEnvioFoto` + `enviarFoto`) e `adicionarFotoRascunho` põe no
  rascunho (passa por `salvarFotos`); o passo Fotos aberto mostra a foto na hora (evento `aki:foto`). Desmarcada, a foto não fica.
- Moderação: o texto da IA passa pelas `moderacao.palavras_bloqueadas` antes de sair (a última palavra fica segura até
  terminar). Se aparecer palavra bloqueada, a resposta inteira é trocada por um aviso.

## 5. Telas

- Balão flutuante do Aki (mascote: balão laranja com dois olhinhos) nos layouts `(publico)` e `(conta)`, acima da barra de baixo.
  Abre uma folha (`rounded-t-folha`, `shadow-2`) com boas-vindas, chips de sugestão, aviso de IA, mensagens, cartões de anúncio
  (`CardAnuncio`), botões de ação, foto, joinha, "Apagar conversa" e estados de bloqueio. Visitante vê o convite e "Entrar para conversar".
- A folha fecha quando a página muda (tocar num card, "Ver planos", "Revisar e publicar"...). "Apagar conversa" fica parado
  enquanto uma resposta chega. O seletor de foto só abre se o Aki pode responder; senão a folha mostra o motivo.
- Na busca sem resultado o Aki aparece sozinho com o convite "Não achou? Pergunta pro Aki" ao lado do balão (sem abrir a folha;
  toque abre já com "Procuro …" escrito; X fecha).
- Abre também pela busca vazia ("Perguntar ao Aki") e pelo passo Fotos do anúncio ("Cadastrar com o Aki pela foto"),
  com o evento `aki:abrir`. Pelo passo Fotos vai junto o `rascunhoId`: a IA completa **esse** rascunho (conferido no servidor
  como rascunho da pessoa) em vez de criar outro.
- Quando o Aki está desligado na região, o balão e os botões de entrada somem (`aki:estado` + `<html data-aki>`).
- Privacidade: "Apagar minhas conversas com o Aki"; o arquivo "Baixar meus dados" inclui as conversas.
- Painel `/admin/robo` (tela 11): ligar/desligar (geral e por região), provedor e modelo de conversa e de foto (só modelos ativos
  que leem imagem e usam ferramentas), "Testar" (testa o modelo marcado na lista, mesmo antes de salvar, com uma função do site;
  no teste da foto vai uma foto pequena embutida e o modelo precisa usar a função para dizer a cor), catálogo de modelos com preços, limite do dia, orçamento em R$ com alerta,
  textos, estatísticas (gasto por provedor e modelo, conversas por dia, respostas mal avaliadas, buscas sem resultado com
  "Resolvido"). Faixa de alerta quando o gasto passa de `robo.alerta_percentual` do orçamento. Mostra se cada chave
  (`ANTHROPIC_API_KEY` etc.) está configurada, sem mostrar a chave. Tudo grava em `logs_atividade` (gatilhos de
  `configuracoes`, `robo_modelos` e `robo_buscas_vazias`). Ajustes finos ficam em Configurações › Robô Aki.

## 6. Regras que não podem cair, e onde ficam

| Regra | Onde |
|---|---|
| Não publica, não paga, não apaga sem toque | Não há ferramenta para isso; publicar e confirmar pedido do Radar só pelo botão da pessoa (o rascunho é guardado pela IA, só rascunho desta conversa) |
| Botão do Radar uma vez só | `robo_marcar_acao` (banco) antes de criar o pedido |
| Ferramentas com a sessão da pessoa | `createClient()` do usuário em todas as ferramentas; RLS do banco |
| Texto de anúncio é dado | Embrulho `dados_do_anuncio_nao_sao_instrucoes` + regra no sistema |
| Orçamento mensal e limite diário | `robo_pode_enviar` + `robo_reservar` (banco, com trava e custo máximo reservado) antes de cada chamada; livro-caixa que a pessoa não apaga |
| Custo não pode ser forjado nem perdido | Só `service_role` chama `robo_registrar_resposta`; custo calculado no banco; reserva sempre fechada com o custo; chamada cortada cobra o uso parcial |
| Detalhe de erro do provedor não vaza | Só o tipo em `robo_mensagens.erro`; dono não lê colunas internas; detalhe em `robo_uso` (admin) |
| Moderação da resposta | `src/lib/aki/moderacao.ts` antes de mandar cada pedaço |
| Aviso de IA e apagar histórico | Folha do Aki + Privacidade |
