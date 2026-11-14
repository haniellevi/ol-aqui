// Modelo de IA de cada recurso do site, escolhido em /admin/configuracoes?grupo=ia.
// Arquivo sem "server-only": o painel e os testes também leem o catálogo.
//
// Regras:
// - O padrão de todos os recursos é o GPT-6 Luna (openai/gpt-6-luna), via OpenRouter.
// - O DeepSeek V4.1 Flash fica como opção, para testar depois.
// - Cada recurso guarda também o modelo que usava antes, para voltar atrás sem mexer no código.
// - Chave ausente, vazia ou com modelo fora da lista: o recurso usa o padrão.
// - Claude Opus 5.5 nunca entra nesta lista (decisão do Raniel, 14/11/2026).
// IDs conferidos no catálogo público do OpenRouter em 14/11/2026.

export type ModeloIA = {
  valor: string;
  nome: string;
  /** false = o modelo recusa o parâmetro temperature (com require_parameters, a chamada falharia). */
  temperatura: boolean;
  /** true = o modelo raciocina por padrão. O raciocínio gasta o mesmo max_tokens da resposta e cortaria o JSON. */
  raciocinio: boolean;
};

export const LUNA: ModeloIA = { valor: "openai/gpt-6-luna", nome: "OpenAI: GPT-6 Luna (openai/gpt-6-luna)", temperatura: false, raciocinio: true };
export const DEEPSEEK: ModeloIA = { valor: "deepseek/deepseek-v4.1-flash", nome: "DeepSeek: DeepSeek V4.1 Flash (deepseek/deepseek-v4.1-flash)", temperatura: true, raciocinio: true };
const GPT41_MINI: ModeloIA = { valor: "openai/gpt-4.1-mini", nome: "OpenAI: GPT-4.1 mini (openai/gpt-4.1-mini), modelo anterior", temperatura: true, raciocinio: false };
const GEMINI_LITE: ModeloIA = { valor: "google/gemini-2.5-flash-lite", nome: "Google: Gemini 2.5 Flash Lite (google/gemini-2.5-flash-lite), modelo anterior", temperatura: true, raciocinio: false };

export const MODELO_IA_PADRAO = LUNA.valor;

export type RecursoIA = "moderacao" | "categorizacao" | "melhoria" | "verificacao" | "radar";

export const RECURSOS_IA: Record<RecursoIA, { chave: string; nome: string; modelos: ModeloIA[] }> = {
  moderacao: { chave: "ia.modelo.moderacao", nome: "Análise automática de anúncios retidos", modelos: [LUNA, DEEPSEEK, GPT41_MINI] },
  categorizacao: { chave: "ia.modelo.categorizacao", nome: "Categoria dos anúncios antigos", modelos: [LUNA, DEEPSEEK, GPT41_MINI] },
  melhoria: { chave: "ia.modelo.melhoria", nome: "Melhorar título e descrição do anúncio", modelos: [LUNA, DEEPSEEK, GPT41_MINI] },
  verificacao: { chave: "ia.modelo.verificacao", nome: "Leitura do comprovante e da fachada da loja", modelos: [LUNA, DEEPSEEK, GPT41_MINI] },
  radar: { chave: "ia.modelo.radar", nome: "Radar: textos e escolha de anúncios parecidos", modelos: [LUNA, DEEPSEEK, GEMINI_LITE] },
};

/** Recursos que não trocam de modelo, com o motivo mostrado no painel. */
export const MODELOS_FIXOS_IA: { nome: string; modelo: string; motivo: string }[] = [
  { nome: "Busca que entende", modelo: "TypeSafe JEV (jev-latest)", motivo: "O JEV responde perguntas de julgamento com resposta fechada. Os modelos de texto acima não falam esse protocolo." },
  { nome: "Sugestão de categoria", modelo: "TypeSafe JEV (jev-latest)", motivo: "Mesmo motivo: é um julgamento (escolher a categoria certa) feito pelo protocolo do JEV." },
  { nome: "Radar: perguntas, novidades e \"já comprei\"", modelo: "TypeSafe JEV (jev-latest)", motivo: "São julgamentos do JEV. Só a parte que escreve textos do Radar troca de modelo." },
  { nome: "Merc lojista: foto do produto", modelo: "OpenAI GPT Image (gpt-image-2 ou gpt-image-1.5)", motivo: "Só modelo de imagem gera foto. A escolha entre os dois fica em Merc para lojistas." },
  { nome: "Merc lojista e robô Merc: conversa", modelo: "Escolhido em outras telas", motivo: "O texto do Merc lojista fica em Merc para lojistas. O robô Merc fica em Configurar Merc." },
];

export function modeloDaLista(recurso: RecursoIA, valor: unknown): ModeloIA | null {
  return RECURSOS_IA[recurso].modelos.find((m) => m.valor === valor) ?? null;
}

/** Valor salvo no banco → modelo usado. Qualquer valor estranho cai no padrão. */
export function modeloOuPadrao(recurso: RecursoIA, valor: unknown): string {
  return modeloDaLista(recurso, valor)?.valor ?? MODELO_IA_PADRAO;
}

/**
 * Ajustes por modelo: temperature só para quem aceita, e raciocínio desligado em quem raciocina por padrão.
 * As chamadas são curtas e em JSON, como no modelo anterior (que não raciocinava). Com o raciocínio ligado,
 * ele gastaria o max_tokens e a resposta viria cortada (finish_reason "length"), paga e inútil.
 */
export function ajustesDoModelo(recurso: RecursoIA, modelo: string, temperatura: number): { temperature?: number; reasoning?: { effort: "none" } } {
  const m = modeloDaLista(recurso, modelo);
  return {
    ...(m?.temperatura === false ? {} : { temperature: temperatura }),
    ...(m?.raciocinio ? { reasoning: { effort: "none" as const } } : {}),
  };
}

/** Opções da lista de escolha do painel, por chave de configuração. */
export const OPCOES_MODELOS_IA: Record<string, { valor: string; nome: string }[]> = Object.fromEntries(
  Object.values(RECURSOS_IA).map((r) => [r.chave, r.modelos.map(({ valor, nome }) => ({ valor, nome }))]),
);
