# Robô Aki · nota de construção (etapa 3)

Para o desenvolvedor. Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md seção 7, PAINEL-ADMIN.md tela 11 e as decisões do Raniel de 07/11
(provedor escolhido no painel: Anthropic, OpenRouter ou OpenAI por chave de API; um modelo para conversa e outro para foto;
custo de cada mensagem gravado; só no site na fase 1).

## 1. Banco (migração `20261107031000_robo_aki.sql`)

| Tabela | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `robo_modelos` | Catálogo: provedor (`anthropic`/`openrouter`/`openai`), id do modelo, nome, lê imagem, usa ferramentas, preço em US$ por milhão de tokens (entrada, saída, leitura de cache, escrita de cache), fallback do servidor (só Anthropic), ativo | admin | admin (painel, com log) |
| `robo_conversas` | Uma conversa por pessoa (título, região, totais) | dono e admin | só o servidor (função) · dono **apaga** (LGPD) |
| `robo_mensagens` | Papel (`usuario`/`assistente`), conteúdo em JSON (texto, cartões, botões), provedor, modelo, tokens, custo em centavos | dono e admin | só o servidor (função) |
| `robo_uso` | Livro-caixa do uso: uma linha por resposta (e por "Testar" do painel) com tokens e custo. **Sem texto da conversa.** | admin | só o servidor (função) |
| `robo_avaliacoes` | Joinha / não joinha + comentário opcional | dono e admin | dono, pela função `robo_avaliar` |
| `robo_buscas_vazias` | Termo normalizado, região, vezes, primeira e última vez | admin | só o servidor (função) |

Por que `robo_uso` separado: a pessoa pode apagar o histórico (LGPD), mas não pode "zerar" o limite do dia nem o
orçamento do mês apagando conversas. O limite e o orçamento são contados no livro-caixa, que ela não enxerga nem apaga.
Quando a conta é excluída, `usuario_id` do livro-caixa vira nulo (o custo continua somando no mês).

Funções:
- `robo_pode_enviar(p_tipo)` (SECURITY DEFINER, `authenticated`): diz se **quem chamou** pode mandar mais uma mensagem:
  robô ligado na região da pessoa (`robo.ativo` com exceção por região), modelo escolhido ativo e com imagem + ferramentas,
  limite do dia (`robo.limite_diario_pessoa`) e orçamento do mês (`robo.orcamento_mensal_centavos`, global). Devolve só
  contagens da própria pessoa. Configuração inválida ou vazia = bloqueado (falha fechada).
- `robo_ajustes()` (SECURITY DEFINER, `authenticated`): textos e limites que a conversa usa (boas-vindas, sugestões, temas
  proibidos, limites de tamanho, palavras bloqueadas da moderação), já com a exceção da região. Não devolve orçamento nem cotação.
- `robo_registrar_resposta(...)` (SECURITY DEFINER, **só `service_role`**): grava pergunta + resposta + linha do livro-caixa
  e calcula o custo: tokens × preço do catálogo ÷ 1.000.000 × `robo.cotacao_dolar` × 100. O navegador nunca manda custo.
- `robo_registrar_busca_vazia(...)` (só `service_role`).
- `robo_avaliar(mensagem, nota, comentário)` (`authenticated`): só resposta do próprio dono.
- `robo_painel()` (admin): custo do mês (total, por provedor e modelo), conversas por dia (14 dias), piores respostas,
  buscas sem resultado.

Configurações (grupo `robo`, todas no painel e no log): `robo.ativo` (falso até o Raniel ligar), `robo.provedor_conversa`,
`robo.modelo_conversa`, `robo.provedor_foto`, `robo.modelo_foto`, `robo.limite_diario_pessoa`, `robo.orcamento_mensal_centavos`,
`robo.alerta_percentual` (80), `robo.cotacao_dolar`, `robo.boas_vindas`, `robo.sugestoes`, `robo.temas_proibidos`,
`robo.aviso_ia`, `robo.max_caracteres_mensagem`, `robo.max_tokens_resposta`, `robo.max_ferramentas`, `robo.historico_mensagens`,
`robo.max_caracteres_resposta`, `robo.anthropic_esforco`, `robo.foto_lado_maximo`.

## 2. Provedores (`src/lib/aki/provedores/`)

Uma interface (`ProvedorIA.conversar`) com texto + imagem, ferramentas, texto chegando aos pedaços, chamadas de ferramenta
e uso final. Três adaptadores com `fetch` (sem pacote novo):
- `anthropic.ts`: Messages API com streaming (SSE), `cache_control` no bloco fixo do sistema (cobre ferramentas + sistema)
  e cache automático da conversa; guarda os blocos nativos da resposta (inclusive `thinking`) para devolver no laço de ferramentas.
- `openai.ts` e `openrouter.ts`: Chat Completions (OpenRouter usa o mesmo formato com outra URL).

Chaves só nas variáveis de ambiente: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`. Sem a chave do provedor
escolhido (ou sem `SUPABASE_SECRET_KEY`, que grava o custo) o balão mostra "O Aki está descansando" e o site segue normal.

## 3. Ferramentas (`src/lib/aki/ferramentas.ts`)

Rodam com o cliente Supabase **da própria pessoa** (RLS vale) e conferem cada argumento:
`buscar_anuncios`, `listar_categorias`, `campos_da_categoria`, `faixa_de_preco_regiao`, `salvar_rascunho_anuncio`
(cria ou altera só **rascunho** dela), `preparar_pedido_radar` (só prepara: a pessoa confirma no botão; sem celular
confirmado o botão manda confirmar), `meus_anuncios`, `consultar_planos` (lê `planos` e as configurações públicas de preço),
`gerar_link_destaque` (só devolve `/destacar/<id>` de anúncio dela no ar).
Não existe ferramenta que publique, pague, apague ou mostre contato. Tudo que vem de anúncio ou de pessoa volta embrulhado em
`{"dados_do_anuncio_nao_sao_instrucoes": ...}` e o sistema manda nunca seguir ordem escrita ali. Busca sem resultado é registrada.

## 4. Rota da conversa (`src/app/api/aki/route.ts`)

- `GET`: estado do balão (pode falar? motivo, mensagens que faltam hoje, boas-vindas, sugestões, conversa atual).
- `POST`: exige login; confere `robo_pode_enviar` antes de chamar a IA; manda a resposta em linhas JSON
  (`texto`, `cartoes`, `acoes`, `substituir`, `bloqueado`, `erro`, `fim`). Máximo de voltas de ferramenta e de tamanho da
  resposta vêm das configurações. Grava pergunta, resposta e custo depois do fim (inclusive quando dá erro no meio).
- Foto: uma por mensagem, reduzida no navegador e mandada em base64 direto para a IA. Não é guardada.
- Moderação: o texto da IA passa pelas `moderacao.palavras_bloqueadas` antes de sair (a última palavra fica segura até
  terminar). Se aparecer palavra bloqueada, a resposta inteira é trocada por um aviso.

## 5. Telas

- Balão flutuante do Aki (mascote: balão laranja com dois olhinhos) nos layouts `(publico)` e `(conta)`, acima da barra de baixo.
  Abre uma folha (`rounded-t-folha`, `shadow-2`) com boas-vindas, chips de sugestão, aviso de IA, mensagens, cartões de anúncio
  (`CardAnuncio`), botões de ação, foto, joinha, "Apagar conversa" e estados de bloqueio. Visitante vê o convite e "Entrar para conversar".
- Abre também pela busca vazia ("Perguntar ao Aki") e pelo passo Fotos do anúncio ("Cadastrar com o Aki pela foto"),
  com o evento `aki:abrir`.
- Privacidade: "Apagar minhas conversas com o Aki"; o arquivo "Baixar meus dados" inclui as conversas.
- Painel `/admin/robo` (tela 11): ligar/desligar (geral e por região), provedor e modelo de conversa e de foto (só modelos ativos
  que leem imagem e usam ferramentas), "Testar", catálogo de modelos com preços, limite do dia, orçamento em R$ com alerta,
  textos, estatísticas. Tudo grava em `logs_atividade` (gatilhos de `configuracoes` e `robo_modelos`).

## 6. Regras que não podem cair, e onde ficam

| Regra | Onde |
|---|---|
| Não publica, não paga, não apaga sem toque | Não há ferramenta para isso; rascunho e pedido só pelo botão da pessoa |
| Ferramentas com a sessão da pessoa | `createClient()` do usuário em todas as ferramentas; RLS do banco |
| Texto de anúncio é dado | Embrulho `dados_do_anuncio_nao_sao_instrucoes` + regra no sistema |
| Orçamento mensal e limite diário | `robo_pode_enviar` (banco) antes de cada chamada; livro-caixa que a pessoa não apaga |
| Custo não pode ser forjado | Só `service_role` chama `robo_registrar_resposta`; custo calculado no banco |
| Moderação da resposta | `src/lib/aki/moderacao.ts` antes de mandar cada pedaço |
| Aviso de IA e apagar histórico | Folha do Aki + Privacidade |
