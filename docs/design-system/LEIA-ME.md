# Design system · bastidores

O documento que manda é o [`DESIGN.md`](../../DESIGN.md) da raiz. Esta pasta guarda o que levou até ele.

| Pasta ou arquivo | O que é |
|---|---|
| [pesquisa/01-auditoria-marca.md](pesquisa/01-auditoria-marca.md) | Site no ar contra os documentos; contraste das cores; logo em tamanho pequeno |
| [pesquisa/02-auditoria-concorrentes.md](pesquisa/02-auditoria-concorrentes.md) | OLX e Mercado Livre medidos no celular (Facebook Marketplace não foi medido: exige login) |
| [pesquisa/03-auditoria-publico.md](pesquisa/03-auditoria-publico.md) | Dados públicos sobre a região, aparelhos, visão e toque |
| [pesquisa/04-tipografia-e-bibliotecas.md](pesquisa/04-tipografia-e-bibliotecas.md) | Fontes comparadas, bibliotecas, peças duplicadas, como travar o padrão |
| [opcoes/index.html](opcoes/index.html) | Página mostrada ao Raniel para escolher fonte, tamanho, nome do logo e cores |
| [CONFERIDOR.md](CONFERIDOR.md) | Especificação e estado do conferidor de design |
| [historico/](historico/) | Versões antigas do `DESIGN.md` e do `docs/DESIGN-SYSTEM.md` |

## Decisões do Raniel em 14/11/2026

| Assunto | Decisão |
|---|---|
| Público que decide o visual | Comprador no celular simples |
| Tom da marca | Vizinho de confiança |
| Modo escuro | Não; só claro |
| Fonte | Figtree (sai a Poppins) |
| Tamanho | Médio: texto 14 px, toque 44 px (ação principal 48 px) |
| Nome do logo | Opção A: uma linha, tudo beringela; símbolo M com pin não muda |
| Cores | Afinadas: `laranja-escuro` de `#c2410c` para `#b84010` |
| Biblioteca base | Fica shadcn + Base UI + Lucide |
| Peças duplicadas | A do shadcn é a oficial; a em português vira casca |
| Fontes permitidas | Só gratuitas do Google |
| Documentos | Um só manda (`DESIGN.md`); os outros apontam para ele |
| Trava para a IA | `AGENTS.md` + `CLAUDE.md` + conferidor automático |

## Estado da migração

A base e as ondas 1 a 3 foram implementadas; a área logada está parcialmente revisada e o painel administrativo permanece pendente. A seção 11 do `DESIGN.md` registra os lotes e o trabalho restante. Pontos de atenção:

- A pesquisa de público recomendava texto de 16 px; a escolha foi 14 px. Validar no teste de corredor.
- Sem pesquisa com usuários reais e sem números de uso.
- População de Corrente veio de site de terceiros; conferir no IBGE antes de citar.
- Limpar rascunhos antigos que ainda dizem OLAKI (`design_draft.md`, `concepts_brief.md`, se existirem na sua pasta).
