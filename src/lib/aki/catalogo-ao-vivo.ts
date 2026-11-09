import "server-only";
import type { ProvedorIA } from "@/lib/aki/tipos";

// Lista de modelos puxada AO VIVO do provedor, para o painel escolher sem digitar.
// OpenRouter: lista pública, já vem com preço e o que cada modelo sabe fazer.
// OpenAI e Anthropic: lista com a chave da Vercel; preço e capacidades vêm do
// catálogo público do OpenRouter, que revende os mesmos modelos.
// A chave nunca sai do servidor. A lista fica guardada por 1 hora.

export type ModeloAoVivo = {
  provedor: ProvedorIA;
  modelo: string;
  nome: string;
  le_imagem: boolean;
  usa_ferramentas: boolean;
  preco_entrada_usd: number | null;
  preco_saida_usd: number | null;
  preco_cache_leitura_usd: number | null;
  preco_cache_escrita_usd: number | null;
  /** Data de lançamento (AAAA-MM-DD) quando o provedor informa. */
  lancado_em: string | null;
};

const UMA_HORA = 3600;
const ID_VALIDO = /^[A-Za-z0-9._:/-]{2,120}$/;
const TEMPO_MAX = 15_000;

type ModeloOpenRouter = {
  id: string;
  name?: string;
  created?: number;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string; input_cache_read?: string; input_cache_write?: string };
};

/** Preço por token (texto) → US$ por milhão. Vazio, negativo ou inválido vira null. */
function porMilhao(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1e6 * 1e6) / 1e6;
}

function data(segundos: number | undefined): string | null {
  if (!segundos || !Number.isFinite(segundos)) return null;
  return new Date(segundos * 1000).toISOString().slice(0, 10);
}

async function buscarJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { headers, next: { revalidate: UMA_HORA }, signal: AbortSignal.timeout(TEMPO_MAX) });
  if (!r.ok) throw new Error(`O provedor respondeu ${r.status} ao listar os modelos.`);
  return (await r.json()) as T;
}

async function catalogoOpenRouter(): Promise<ModeloOpenRouter[]> {
  const j = await buscarJson<{ data?: ModeloOpenRouter[] }>("https://openrouter.ai/api/v1/models");
  return Array.isArray(j.data) ? j.data : [];
}

function deOpenRouter(m: ModeloOpenRouter, provedor: ProvedorIA, modelo: string, nome?: string, lancado?: string | null): ModeloAoVivo {
  return {
    provedor,
    modelo,
    nome: (nome ?? m.name ?? modelo).slice(0, 80),
    le_imagem: (m.architecture?.input_modalities ?? []).includes("image"),
    usa_ferramentas: (m.supported_parameters ?? []).includes("tools"),
    preco_entrada_usd: porMilhao(m.pricing?.prompt),
    preco_saida_usd: porMilhao(m.pricing?.completion),
    preco_cache_leitura_usd: porMilhao(m.pricing?.input_cache_read),
    preco_cache_escrita_usd: porMilhao(m.pricing?.input_cache_write),
    lancado_em: lancado ?? data(m.created),
  };
}

/** "claude-opus-4-5-20251101" → "claude-opus-4.5" (como o OpenRouter chama o mesmo modelo). */
function idAnthropicNoOpenRouter(id: string): string {
  return id.replace(/-\d{8}$/, "").replace(/(\d)-(\d)/g, "$1.$2");
}

// Modelos da OpenAI que não servem para conversa (áudio, imagem, busca, embeddings...).
const OPENAI_FORA = /(audio|realtime|tts|transcribe|whisper|embedding|dall-e|image|moderation|search|davinci|babbage|instruct)/i;

async function listarOpenRouter(): Promise<ModeloAoVivo[]> {
  return (await catalogoOpenRouter())
    // ":batch" responde em lote (horas depois): não serve para conversa ao vivo
    .filter((m) => typeof m.id === "string" && m.id.length > 0 && !m.id.endsWith(":batch"))
    .map((m) => deOpenRouter(m, "openrouter", m.id));
}

async function listarOpenAI(): Promise<ModeloAoVivo[]> {
  const chave = process.env.OPENAI_API_KEY?.trim();
  if (!chave) throw new Error("Falta a chave OPENAI_API_KEY na Vercel para listar os modelos da OpenAI.");
  const [j, or] = await Promise.all([
    buscarJson<{ data?: { id: string; created?: number }[] }>("https://api.openai.com/v1/models", { Authorization: `Bearer ${chave}` }),
    catalogoOpenRouter().catch(() => [] as ModeloOpenRouter[]),
  ]);
  const precos = new Map(or.map((m) => [m.id, m]));
  return (j.data ?? [])
    .filter((m) => /^(gpt-|o\d|chatgpt-)/i.test(m.id) && !OPENAI_FORA.test(m.id))
    .map((m) => {
      const ref = precos.get(`openai/${m.id}`);
      return ref
        ? deOpenRouter(ref, "openai", m.id, ref.name?.replace(/^OpenAI:\s*/, ""), data(m.created))
        : semReferencia("openai", m.id, m.id, data(m.created));
    });
}

async function listarAnthropic(): Promise<ModeloAoVivo[]> {
  const chave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!chave) throw new Error("Falta a chave ANTHROPIC_API_KEY na Vercel para listar os modelos da Anthropic.");
  const [j, or] = await Promise.all([
    buscarJson<{ data?: { id: string; display_name?: string; created_at?: string }[] }>("https://api.anthropic.com/v1/models?limit=1000", {
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    }),
    catalogoOpenRouter().catch(() => [] as ModeloOpenRouter[]),
  ]);
  const precos = new Map(or.map((m) => [m.id, m]));
  return (j.data ?? []).map((m) => {
    const lancado = m.created_at ? m.created_at.slice(0, 10) : null;
    const ref = precos.get(`anthropic/${idAnthropicNoOpenRouter(m.id)}`);
    // todos os Claude atuais leem imagem e usam ferramentas
    return ref
      ? deOpenRouter(ref, "anthropic", m.id, m.display_name, lancado)
      : { ...semReferencia("anthropic", m.id, m.display_name ?? m.id, lancado), le_imagem: true, usa_ferramentas: true };
  });
}

function semReferencia(provedor: ProvedorIA, modelo: string, nome: string, lancado: string | null): ModeloAoVivo {
  return {
    provedor,
    modelo,
    nome: nome.slice(0, 80),
    le_imagem: false,
    usa_ferramentas: false,
    preco_entrada_usd: null,
    preco_saida_usd: null,
    preco_cache_leitura_usd: null,
    preco_cache_escrita_usd: null,
    lancado_em: lancado,
  };
}

/** Modelos do provedor, do mais novo para o mais antigo. Lança Error com mensagem amigável. */
export async function listarModelosAoVivo(provedor: ProvedorIA): Promise<ModeloAoVivo[]> {
  const lista = provedor === "openrouter" ? await listarOpenRouter() : provedor === "openai" ? await listarOpenAI() : await listarAnthropic();
  // mesma regra do banco (robo_modelos.modelo): apelidos como "~deepseek/...-latest" ficam de fora
  return lista.filter((m) => ID_VALIDO.test(m.modelo)).sort((a, b) => (b.lancado_em ?? "").localeCompare(a.lancado_em ?? "") || a.nome.localeCompare(b.nome));
}

/** Serve para o Aki: lê imagem, usa ferramentas e tem preço (o custo de cada resposta depende dele). */
export const serveParaOAki = (m: ModeloAoVivo) =>
  m.le_imagem && m.usa_ferramentas && m.preco_entrada_usd !== null && m.preco_saida_usd !== null;
