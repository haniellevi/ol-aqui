// Converte valores das configurações entre o banco (jsonb) e os campos do painel.
export type TipoValor = "numero" | "texto" | "lista" | "mapa" | "json" | "simnao";

export function tipoDe(valor: unknown): TipoValor {
  if (typeof valor === "boolean") return "simnao";
  if (typeof valor === "number") return "numero";
  if (typeof valor === "string" || valor === null) return "texto";
  if (Array.isArray(valor) && valor.every((v) => typeof v === "string")) return "lista";
  if (valor && typeof valor === "object" && Object.values(valor).every((v) => typeof v === "number")) return "mapa";
  return "json";
}

/** Texto do formulário → jsonb. Lança Error com mensagem amigável. */
export function valorDoForm(tipo: TipoValor, bruto: string): unknown {
  const t = bruto.trim();
  switch (tipo) {
    case "numero": {
      const n = Number(t.replace(",", "."));
      if (!t || !Number.isFinite(n)) throw new Error("Digite um número.");
      return n;
    }
    case "texto":
      return t === "" ? null : t;
    case "simnao":
      if (t !== "true" && t !== "false") throw new Error("Escolha Sim ou Não.");
      return t === "true";
    case "lista":
      return t
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    case "mapa": {
      // uma linha por item: "veiculo = 5000000"
      const obj: Record<string, number> = {};
      for (const linha of t.split("\n").map((s) => s.trim()).filter(Boolean)) {
        const [k, v] = linha.split("=").map((s) => s.trim());
        const n = Number((v ?? "").replace(/\./g, "").replace(",", "."));
        if (!k || !Number.isFinite(n)) throw new Error(`Linha inválida: "${linha}". Use: chave = número`);
        obj[k] = n;
      }
      return obj;
    }
    default:
      try {
        return JSON.parse(t);
      } catch {
        throw new Error("JSON inválido.");
      }
  }
}

export function valorParaForm(tipo: TipoValor, valor: unknown): string {
  switch (tipo) {
    case "numero":
    case "simnao":
      return String(valor);
    case "texto":
      return (valor as string | null) ?? "";
    case "lista":
      return (valor as string[]).join("\n");
    case "mapa":
      return Object.entries(valor as Record<string, number>)
        .map(([k, v]) => `${k} = ${v}`)
        .join("\n");
    default:
      return JSON.stringify(valor, null, 2);
  }
}

export const NOMES_GRUPO: Record<string, string> = {
  planos: "Planos e avulsos",
  radar: "Radar de Negócios",
  moderacao: "Moderação",
  cobranca: "Cobrança",
  robo: "Robô Aki",
  geral: "Geral",
};

/** Dica exibida embaixo de campos em centavos. */
export const emCentavos = (chave: string) => chave.includes("centavos");

export type Opcao = { valor: string; nome: string };

/** Configurações de texto que só aceitam valores fixos: aparecem como lista de escolha. */
export const OPCOES_FIXAS: Record<string, Opcao[]> = {
  "asaas.ambiente": [
    { valor: "sandbox", nome: "Teste (sandbox): não cobra de verdade" },
    { valor: "producao", nome: "Produção: cobra de verdade" },
  ],
  "robo.provedor_conversa": PROVEDORES(),
  "robo.provedor_foto": PROVEDORES(),
  "robo.anthropic_esforco": [
    { valor: "low", nome: "Baixo (mais barato e rápido)" },
    { valor: "medium", nome: "Médio" },
    { valor: "high", nome: "Alto (mais caro)" },
  ],
};

function PROVEDORES(): Opcao[] {
  return [
    { valor: "anthropic", nome: "Anthropic" },
    { valor: "openrouter", nome: "OpenRouter" },
    { valor: "openai", nome: "OpenAI" },
  ];
}

/** Configurações que guardam o código de um plano: as opções vêm da tabela planos. */
export const CHAVES_DE_PLANO = new Set(["pf.plano_apos_teste", "pf.plano_inicial", "loja.plano_teste"]);
/** Configurações que guardam um modelo do catálogo do robô. */
export const CHAVES_DE_MODELO = new Set(["robo.modelo_conversa", "robo.modelo_foto"]);
