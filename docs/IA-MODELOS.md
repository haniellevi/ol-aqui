# Modelos de IA de cada recurso

Atualizado em 14/11/2026. Onde trocar: **Painel → Configurações → IA do site → Modelos de IA**
(`/admin/configuracoes?grupo=ia`).

## Regra
- Padrão de todos os recursos: **GPT-6 Luna** (`openai/gpt-6-luna`, via OpenRouter).
- Opção no painel: **DeepSeek V4.1 Flash** (`deepseek/deepseek-v4.1-flash`, via OpenRouter). Lê texto e imagem.
- Cada recurso também mostra o modelo que usava antes ("modelo anterior"), para voltar atrás sem mudar código.
- Claude Opus 5.5 nunca entra na lista (pedido do Raniel).
- Chave ausente, vazia ou com modelo fora da lista: o recurso usa o GPT-6 Luna.
- A escolha é global (não tem exceção por região).

O Raniel pediu "DeepSeek 5.1 Flash" e "Luna 6". Esses nomes não existem. Em 14/11/2026, no catálogo público do
OpenRouter e na documentação da DeepSeek, os mais próximos eram o DeepSeek V4.1 Flash e o GPT-6 Luna. A escolha
foi do GPT Sol: GPT-6 Luna como padrão e DeepSeek como opção.

Preço: não dá para dizer qual é mais barato sem medir. Depende do tamanho do texto, do cache e do provedor que o
OpenRouter escolher.

## Recursos que trocam de modelo
| Recurso | Chave | Arquivo | Opções |
|---|---|---|---|
| Análise automática de anúncios retidos | `ia.modelo.moderacao` | `src/lib/moderacao-ia.ts` | Luna, DeepSeek, GPT-4.1 mini (anterior) |
| Categoria dos anúncios antigos | `ia.modelo.categorizacao` | `src/lib/categorizacao-ia.ts` | Luna, DeepSeek, GPT-4.1 mini (anterior) |
| Melhorar título e descrição | `ia.modelo.melhoria` | `src/lib/melhoria-ia.ts` | Luna, DeepSeek, GPT-4.1 mini (anterior) |
| Leitura do comprovante e da fachada da loja | `ia.modelo.verificacao` | `src/lib/verificacao-loja/ia.ts` | Luna, DeepSeek, GPT-4.1 mini (anterior) |
| Radar: textos e escolha de parecidos | `ia.modelo.radar` | `src/lib/radar-ia/gemini.ts` | Luna, DeepSeek, Gemini 2.5 Flash Lite (anterior) |

A lista fica em `src/lib/ia-modelos.ts` e, igual, na função `ia_modelo` do banco
(migração `20261126010000_ia_modelos_por_recurso.sql`). Um teste confere que as duas listas batem.

## Recursos com modelo fixo (aparecem na tela com o motivo)
- Busca que entende, sugestão de categoria e as partes do Radar que julgam (perguntas, novidades, "já comprei"):
  **TypeSafe JEV** (`jev-latest`). O JEV responde julgamentos com resposta fechada e tem protocolo próprio.
- Foto do produto no Merc lojista: modelo de imagem (`gpt-image-2` ou `gpt-image-1.5`), escolhido em Merc para lojistas.
- Texto do Merc lojista e robô Merc: já têm escolha própria (Merc para lojistas e Configurar Merc).

## Como funciona por dentro
- O banco grava no livro-caixa (`robo_uso` ou `radar_ia_uso`) o modelo escolhido, na hora da reserva.
  - Moderação: a fila (`moderacao_ia.modelo`) nasce com `ia_modelo('moderacao')`. Análises já na fila mantêm o
    modelo anterior e continuam funcionando.
  - Categorização e melhoria: a reserva devolve o modelo ao código, que usa esse mesmo modelo.
  - Verificação e Radar: o código lê o modelo com `modeloDoRecurso()` (`src/lib/ia-modelos-servidor.ts`), que
    guarda o valor por 30 segundos. Por até 30 s depois de uma troca, o livro-caixa pode mostrar o modelo novo
    numa chamada feita com o anterior.
- O GPT-6 Luna recusa o parâmetro `temperature`. Como as chamadas usam `require_parameters: true`, mandar o campo
  derrubaria a chamada. O código só manda `temperature` para quem aceita (`ajustesDoModelo`).
- O GPT-6 Luna (raciocínio médio) e o DeepSeek V4.1 Flash (raciocínio alto) raciocinam por padrão. O raciocínio
  gasta o mesmo `max_tokens` da resposta e cortaria o JSON (`finish_reason: "length"`), uma chamada paga e inútil.
  Por isso vão com `reasoning: { effort: "none" }`, como os modelos anteriores, que não raciocinavam. Os modelos
  anteriores seguem sem o campo. Fonte: catálogo do OpenRouter (`reasoning.default_effort`) em 14/11/2026.
- Continuam iguais: `data_collection: "deny"`, `zdr: true`, sem fallback, resposta em JSON estrito e preço máximo.

## Quando o modelo falha
Igual a antes da troca:
- moderação: o anúncio vai para a revisão da equipe;
- categorização e melhoria: não sugerem nada;
- verificação da loja: o pedido vai para a equipe;
- Radar: segue sem IA (prazo de 3 s).

## Falta conferir em produção (precisa do "sim" do Raniel)
1. Aplicar a migração `20261126010000_ia_modelos_por_recurso.sql` no Supabase. Ela para sozinha se alguma reserva
   tiver mudado desde 18/11.
2. Conferir se o OpenRouter tem rota **sem retenção (ZDR)** para o GPT-6 Luna e o DeepSeek V4.1 Flash. Sem rota,
   todas as chamadas falham e cada recurso cai no comportamento acima. Teste: aprovar um anúncio retido de teste
   e ver se a análise automática respondeu.
3. Radar: ver se o GPT-6 Luna responde em menos de 3 s. Se não, voltar o Radar para o Gemini no painel.
4. A política de privacidade publicada não pode citar o Gemini nem o GPT-4.1 mini como modelos em uso.
