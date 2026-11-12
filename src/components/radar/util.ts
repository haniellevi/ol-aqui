// Textos e formatos do Radar (servem no servidor e no navegador).
import { preco } from "@/lib/formato";
import type { MotivoFechamento, SituacaoPedido } from "@/lib/tipos-radar";
import type { MinhaConta } from "@/lib/tipos";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import { LINK_VERIFICACAO_VENDEDOR } from "@/lib/verificacao-vendedor";
import type { TomSelo } from "@/components/ui/badge";

const FUSO = "America/Fortaleza";
const diaHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "sex., 14/11 às 15:00" */
export function dataHoraCurta(iso: string | Date): string {
  const partes = diaHora.formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("weekday")} ${v("day")}/${v("month")} às ${v("hour")}:${v("minute")}`;
}

/** 24 → "24 horas"; 72 → "3 dias"; 168 → "7 dias"; 36 → "36 horas". */
export function rotuloPrazo(horas: number): string {
  if (horas % 24 === 0) {
    const d = horas / 24;
    return d === 1 ? "24 horas" : `${d} dias`;
  }
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

/** "R$ 1.000 a R$ 2.000", "até R$ 2.000", "a partir de R$ 1.000", "Valor a combinar". */
export function faixaPreco(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${preco(min)} a ${preco(max)}`;
  if (max != null) return `até ${preco(max)}`;
  if (min != null) return `a partir de ${preco(min)}`;
  return "Valor a combinar";
}

/** Etiqueta da situação do pedido para quem pediu. */
export function rotuloSituacao(s: SituacaoPedido, motivo: MotivoFechamento): { texto: string; tom: "ok" | "aviso" | "neutro" } {
  if (s === "em_analise") return { texto: "Em análise", tom: "aviso" };
  if (s === "prazo_acabou") return { texto: "Prazo acabou · escolha", tom: "aviso" };
  if (s === "aberto") return { texto: "No ar", tom: "ok" };
  switch (motivo) {
    case "resolvido":
      return { texto: "Resolvido", tom: "neutro" };
    case "cancelado":
      return { texto: "Cancelado", tom: "neutro" };
    case "moderacao":
      return { texto: "Tirado pela equipe", tom: "aviso" };
    default:
      return { texto: "Encerrado", tom: "neutro" };
  }
}

export const CLASSE_TOM: Record<"ok" | "aviso" | "neutro", TomSelo> = {
  ok: "success",
  aviso: "warning",
  neutro: "secondary",
};

/** "6 propostas, a menor R$ 1.850" / "1 proposta de R$ 900" / "Nenhuma proposta ainda". */
export function resumoPropostas(total: number, menor: number | null): string {
  if (total <= 0) return "Nenhuma proposta ainda";
  if (total === 1) return menor != null ? `1 proposta de ${preco(menor)}` : "1 proposta";
  return menor != null ? `${total} propostas, a menor ${preco(menor)}` : `${total} propostas`;
}

/** Valor editável em reais, preservando os centavos. */
export const textoPrecoProposta = (centavos: number | null) => centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ",");

/**
 * Loja (ou PF) ativa com plano pago que tem Radar, mas sem acesso: o que falta é a verificação,
 * não um plano. Devolve a página de verificação; null quando o caminho é mesmo "Ver planos".
 */
export function linkVerificarParaRadar(conta: Pick<MinhaConta, "vitrine" | "plano"> | null | undefined, temAcesso: boolean): string | null {
  const v = conta?.vitrine;
  const p = conta?.plano;
  if (temAcesso || !v || v.status !== "ativa" || !p) return null;
  if (!p.acesso_radar || p.e_teste || p.preco_centavos <= 0) return null;
  return v.tipo === "pf" ? LINK_VERIFICACAO_VENDEDOR : LINK_MINHA_LOJA;
}
