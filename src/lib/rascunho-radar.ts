// Radar: pedido escrito antes do login (docs/designs/crescimento-radar-lojista.md, decisão 9).
// Quem não tem conta escreve o pedido; no fim guardamos o rascunho no aparelho e mandamos entrar.
// Na volta (LINK_RETOMAR_PEDIDO) o formulário abre no resumo. Guarda só o que a pessoa digitou no
// pedido: nunca telefone, nome ou dados da conta. Vale por 2 horas.
import { ehUuid } from "@/lib/formato";
import type { ModoContato, Visibilidade } from "@/lib/tipos-radar";

const CHAVE = "mr-radar-rascunho";
const VERSAO = 1;
export const VALIDADE_RASCUNHO_MS = 2 * 60 * 60 * 1000;
/** Endereço fixo de volta depois do login. Nunca vem de parâmetro. */
export const LINK_RETOMAR_PEDIDO = "/radar/pedir?retomar=1";

export type RascunhoPedido = {
  titulo: string;
  detalhes: string;
  categoriaId: string | null;
  precoMin: string;
  precoMax: string;
  cidadesIds: string[];
  visibilidade: Visibilidade;
  modo: ModoContato;
  prazoHoras: number | null;
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Confere e limpa o que veio do aparelho. Formato errado, versão antiga ou vencido: null. */
export function rascunhoValido(v: unknown, agora: number): RascunhoPedido | null {
  if (!v || typeof v !== "object") return null;
  const { v: versao, em, dados } = v as { v?: unknown; em?: unknown; dados?: unknown };
  if (versao !== VERSAO || typeof em !== "number" || agora - em > VALIDADE_RASCUNHO_MS) return null;
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  const titulo = texto(d.titulo, 120);
  if (!titulo.trim()) return null;
  const categoriaId = typeof d.categoriaId === "string" && ehUuid(d.categoriaId) ? d.categoriaId : null;
  const cidadesIds = Array.isArray(d.cidadesIds) ? d.cidadesIds.filter((c): c is string => typeof c === "string" && ehUuid(c)).slice(0, 20) : [];
  return {
    titulo,
    detalhes: texto(d.detalhes, 1000),
    categoriaId,
    precoMin: texto(d.precoMin, 120),
    precoMax: texto(d.precoMax, 120),
    cidadesIds,
    visibilidade: d.visibilidade === "todos" ? "todos" : "lojas",
    modo: d.modo === "propostas_prazo" ? "propostas_prazo" : "whatsapp_direto",
    prazoHoras: typeof d.prazoHoras === "number" && Number.isInteger(d.prazoHoras) ? d.prazoHoras : null,
  };
}

export function guardarRascunho(dados: RascunhoPedido) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ v: VERSAO, em: Date.now(), dados }));
  } catch {
    /* armazenamento bloqueado: na volta a pessoa escreve de novo */
  }
}

export function lerRascunho(): RascunhoPedido | null {
  try {
    return rascunhoValido(JSON.parse(localStorage.getItem(CHAVE) ?? "null"), Date.now());
  } catch {
    return null;
  }
}

export function limparRascunho() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
