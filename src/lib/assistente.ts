import { ehUuid, valorDoCampo } from "@/lib/formato";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { PASSOS, type SlugPasso } from "@/components/anunciar/passos";
import { linkMeuPedidoRadar, linkPedirRadar, type FiltrosPedido } from "@/lib/rotas";
import type { CampoCategoria, MeuAnuncio } from "@/lib/tipos";

export const OBJETIVOS = {
  explorar: "Explorar a região",
  item: "Vender um item",
  loja: "Vender pela minha loja",
  procurar: "Procurar algo",
} as const;

export type ObjetivoAssistente = keyof typeof OBJETIVOS;
export type BuscaAssistente = FiltrosPedido & { q?: string | null };
export type ProgressoAssistente = {
  dono: string | null;
  tentativa: string;
  objetivo: ObjetivoAssistente;
  radar?: BuscaAssistente;
  pedidoId?: string;
  anuncio?: { id: string; passo: SlugPasso; pagamento?: string };
};

export function objetivoAssistente(valor: unknown): ObjetivoAssistente | null {
  return typeof valor === "string" && Object.hasOwn(OBJETIVOS, valor) ? valor as ObjetivoAssistente : null;
}

export function tentativaAssistente(valor: unknown): string | undefined {
  return typeof valor === "string" && ehUuid(valor) ? valor : undefined;
}

export function lerProgresso(raw: string | null, dono: string | null): ProgressoAssistente | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    const objetivo = objetivoAssistente(p?.objetivo);
    const tentativa = tentativaAssistente(p?.tentativa);
    if (!objetivo || !tentativa || p.dono !== dono) return null;
    const resultado: ProgressoAssistente = { dono, objetivo, tentativa };
    if (objetivo === "procurar" && p.radar && typeof p.radar === "object") {
      resultado.radar = {};
      for (const chave of ["q", "categoria", "cidade", "precoMin", "precoMax"] as const) {
        if (typeof p.radar[chave] === "string") resultado.radar[chave] = p.radar[chave].slice(0, 120);
      }
    }
    const pedidoId = tentativaAssistente(p.pedidoId);
    if (objetivo === "procurar" && pedidoId) resultado.pedidoId = pedidoId;
    if ((objetivo === "item" || objetivo === "loja") && tentativaAssistente(p.anuncio?.id) &&
      PASSOS.some(({ slug }) => slug === p.anuncio.passo)) {
      resultado.anuncio = { id: p.anuncio.id, passo: p.anuncio.passo };
      const pagamento = tentativaAssistente(p.anuncio.pagamento);
      if (pagamento) resultado.anuncio.pagamento = pagamento;
    }
    return resultado;
  } catch {
    return null;
  }
}

export function podeConcluir(progresso: ProgressoAssistente | null, tentativa: string): boolean {
  return progresso?.tentativa === tentativa;
}

export function linkAssistente(objetivo: ObjetivoAssistente, tentativa: string): string {
  return `/assistente?${new URLSearchParams({ objetivo, tentativa })}`;
}

export function comAssistente(href: string, valor: unknown): string {
  const tentativa = tentativaAssistente(valor);
  const interno = caminhoInterno(href);
  if (!tentativa || !interno) return href;
  const url = new URL(interno, "https://olaki.invalid");
  url.searchParams.set("assistente", tentativa);
  return url.pathname + url.search + url.hash;
}

export function destinoRadarAssistente(progresso: ProgressoAssistente | null, tentativa: string): string {
  const atual = progresso?.tentativa === tentativa && progresso.objetivo === "procurar" ? progresso : null;
  const href = atual?.pedidoId
    ? `${linkMeuPedidoRadar(atual.pedidoId)}?novo=1`
    : linkPedirRadar(atual?.radar?.q, atual?.radar);
  return comAssistente(href, tentativa);
}

type RascunhoAssistido = Pick<MeuAnuncio, "fotos" | "categoria_id" | "titulo" | "preco_centavos" | "cidade"> &
  Partial<Pick<MeuAnuncio, "atributos">>;

export function etapaAnuncio(r: RascunhoAssistido, minimoFotos = 1, campos: CampoCategoria[] = [], categoriaDisponivel = true): SlugPasso {
  if (r.fotos.length < minimoFotos) return "fotos";
  if (!r.categoria_id || !categoriaDisponivel) return "categoria";
  if ((r.titulo?.trim().length ?? 0) < 5 || campos.some((c) => c.obrigatorio && !valorDoCampo(c, r.atributos?.[c.chave]))) return "detalhes";
  if (r.preco_centavos == null && !r.cidade) return "preco";
  if (!r.cidade) return "local";
  return "revisar";
}
