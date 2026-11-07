// Formatação para as telas públicas (serve no servidor e no navegador).
import type { CampoCategoria } from "@/lib/tipos";

export { reais, inteiro, quando } from "@/lib/admin/formato";

/**
 * Número digitado (padrão brasileiro): "45.000" → 45000; "2,5" → 2.5; "2.5" → 2.5; vazio/inválido → null.
 * Ponto só é milhar quando tem o formato 1.000 / 12.500.000. Mesma regra de public.numero_ou_nulo().
 */
export function numeroDoTexto(t: string): number | null {
  const s = t.replace(/\s/g, "");
  if (!s) return null;
  const normal = /,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://olaki.com.br").replace(/\/$/, "");

const moedaInteira = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaCentavos = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const numeroSemPonto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, useGrouping: false }); // ano: "2015"

/** 850000 → "R$ 8.500"; 4990 → "R$ 49,90"; null → "A combinar". */
export function preco(centavos: number | null | undefined): string {
  if (centavos == null) return "A combinar";
  return (centavos % 100 === 0 ? moedaInteira : moedaCentavos).format(centavos / 100).replace(/ /g, " ");
}

/** Do jeito que a gente fala: 850000 → "R$ 8,5 mil"; 6000000 → "R$ 60 mil"; 150000000 → "R$ 1,5 mi". */
export function precoFalado(centavos: number | null | undefined): string {
  if (centavos == null) return "A combinar";
  const r = centavos / 100;
  const curto = (n: number) => numero.format(Math.round(n * 10) / 10);
  if (r >= 1_000_000) return `R$ ${curto(r / 1_000_000)} mi`;
  if (r >= 1_000) return `R$ ${curto(r / 1_000)} mil`;
  return preco(centavos);
}

/** "8.500", "8500,50" ou "R$ 8.500" → centavos. Vazio ou inválido → null (não lança erro). */
export function centavosDoTexto(texto: string | null | undefined): number | null {
  const t = String(texto ?? "").replace(/[R$\s]/g, "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 2 dias", "há 1 mês", "há 2 anos". */
export function tempoRelativo(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return "";
  const seg = Math.max(0, (agora.getTime() - new Date(iso).getTime()) / 1000);
  const min = Math.floor(seg / 60);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (h < 24) return `há ${h} h`;
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const meses = Math.floor(d / 30);
  if (meses < 12) return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
  const anos = Math.floor(d / 365);
  return anos <= 1 ? "há 1 ano" : `há ${anos} anos`;
}

/** "Moto Titan 150 – 2015, revisada!" → "moto-titan-150-2015-revisada" (sem acento, até 60 letras). */
export function slugDoTitulo(titulo: string | null | undefined): string {
  return (
    String(titulo ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "anuncio"
  );
}

/** Caminho da página do anúncio: /anuncio/<id>-<slug>. */
export function linkAnuncio(id: string, titulo: string | null | undefined): string {
  return `/anuncio/${id}-${slugDoTitulo(titulo)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Tira o id do parâmetro "[id]-[slug]" da rota. Inválido → null. */
export function idDoLinkAnuncio(param: string): string | null {
  const m = decodeURIComponent(param).match(UUID);
  return m ? m[0].toLowerCase() : null;
}

export const ehUuid = (texto: string | null | undefined) => !!texto && UUID.test(texto) && texto.length === 36;

/** Caminho da vitrine de uma loja (pessoa física não tem página). */
export const linkLoja = (slug: string) => `/loja/${slug}`;

/** Caminho da lista de categoria: /c/<pai> ou /c/<pai>/<sub>. */
export const linkCategoria = (paiSlug: string, subSlug?: string | null) => (subSlug ? `/c/${paiSlug}/${subSlug}` : `/c/${paiSlug}`);

/** Caminho → endereço completo (para compartilhar e WhatsApp). */
export const urlAbsoluta = (caminho: string) => `${SITE}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;

/** Link do WhatsApp com a mensagem pronta: "Olá! Vi seu anúncio *TÍTULO* no OLAKI: URL". */
export function linkWhatsApp(numero: string, titulo: string, url: string): string {
  const texto = `Olá! Vi seu anúncio *${titulo}* no OLAKI: ${url}`;
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

/** "5589999990000" → "(89) 99999-0000". */
export function telefone(numero: string | null | undefined): string {
  const d = String(numero ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return d;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** Valor de um campo extra para mostrar: 45000 + km → "45.000 km"; true → "Sim". */
export function valorDoCampo(campo: Pick<CampoCategoria, "tipo" | "unidade">, valor: unknown): string {
  if (valor == null || valor === "") return "";
  if (campo.tipo === "sim_nao") return valor === true || valor === "true" ? "Sim" : "Não";
  if (campo.tipo === "numero" && typeof valor === "number") {
    // com unidade agrupa milhar ("45.000 km"); sem unidade não (ano "2015", quartos "3")
    return campo.unidade ? `${numero.format(valor)} ${campo.unidade}` : numeroSemPonto.format(valor);
  }
  return String(valor);
}
