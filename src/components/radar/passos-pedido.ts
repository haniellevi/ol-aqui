// Regras puras do pedido em 4 passos e do "Meu pedido" (servem no servidor, no navegador e nos testes).
import { validarPedido, type EntradaPedido, type ErroRadar } from "./validacao";
import type { SituacaoPedido, Visibilidade } from "@/lib/tipos-radar";

export type NumeroPasso = 1 | 2 | 3 | 4;
export const TOTAL_PASSOS_PEDIDO = 4;
export const NOMES_PASSOS_PEDIDO = ["O que procura", "Onde", "Quem vê", "Contato"] as const;

/** Passo que tem o campo (o servidor devolve o nome do campo no erro). Sem campo conhecido: passo 4. */
export function passoDoCampo(campo: string | null | undefined): NumeroPasso {
  switch (campo) {
    case "titulo":
    case "detalhes":
    case "categoria":
    case "preco":
    case "preco_min_centavos":
    case "preco_max_centavos":
      return 1;
    case "cidade":
    case "cidades":
      return 2;
    case "visibilidade":
      return 3;
    default:
      return 4;
  }
}

/**
 * Confere só o que o passo pergunta. Os passos seguintes entram com valores neutros,
 * para um erro de outro passo nunca esconder o erro deste.
 */
export function erroDoPasso(passo: NumeroPasso, e: EntradaPedido, cidadesValidas: string[]): ErroRadar | null {
  if (passo === 1) {
    return validarPedido({ ...e, cidade: undefined, cidadesIds: [], visibilidade: "lojas", modo: "whatsapp_direto", prazoHoras: null, whatsapp: undefined });
  }
  if (passo === 2) {
    const ids = e.cidadesIds ?? [];
    if (ids.length > 20) return { erro: "Escolha até 20 cidades.", campo: "cidades" };
    if (!ids.every((id) => cidadesValidas.includes(id))) return { erro: "Escolha cidades da lista.", campo: "cidades" };
    return null;
  }
  if (passo === 3) {
    return e.visibilidade === "lojas" || e.visibilidade === "todos" ? null : { erro: "Escolha quem pode ver o pedido.", campo: "visibilidade" };
  }
  return validarPedido(e) ?? erroDoPasso(2, e, cidadesValidas);
}

/** Tempo em que "Publicar pedido" ignora o toque depois de chegar ao passo 4 (evita o toque duplo em Continuar). */
export const ESPERA_PUBLICAR_MS = 600;

/** true = pode publicar: já se passou a espera desde que o passo 4 apareceu. */
export function podePublicar(chegouNoPasso4Em: number | null, agora: number, espera = ESPERA_PUBLICAR_MS): boolean {
  return chegouNoPasso4Em !== null && agora - chegouNoPasso4Em >= espera;
}

/** Área escolhida → o que vai para o servidor: lista vazia = região toda; sem repetidas. */
export function cidadesParaEnvio(valor: string[]): string[] {
  return [...new Set(valor)];
}

/** Texto da área para o resumo: "Toda a região" ou os nomes marcados. */
export function textoArea(valor: string[], cidades: { id: string; nome: string }[]): string {
  if (valor.length === 0) return "Toda a região";
  const nomes = cidades.filter((c) => valor.includes(c.id)).map((c) => c.nome);
  return nomes.length ? nomes.join(", ") : "Toda a região";
}

export const TEXTO_VISIBILIDADE: Record<Visibilidade, { titulo: string; ajuda: string }> = {
  lojas: { titulo: "Só lojas", ajuda: "Só lojas verificadas da região veem seu pedido." },
  todos: { titulo: "Todo mundo", ajuda: "Qualquer pessoa da região vê e pode te indicar onde tem." },
};

/** O que a pessoa falou entra no título (se ainda vazio) ou é somado aos detalhes. */
export function juntarFala(titulo: string, detalhes: string, fala: string): { titulo: string; detalhes: string } {
  const t = fala.replace(/\s+/g, " ").trim();
  if (!t) return { titulo, detalhes };
  if (!titulo.trim()) return { titulo: t.slice(0, 120), detalhes };
  const junto = detalhes.trim() ? `${detalhes.trimEnd()} ${t}` : t;
  return { titulo, detalhes: junto.slice(0, 1000) };
}

const DIA = 86_400_000;

/** Dias inteiros até vencer (arredonda para cima; 0 = vence hoje ou já venceu). */
export function diasParaVencer(expiraEm: string, agora: number): number {
  const fim = Date.parse(expiraEm);
  if (Number.isNaN(fim)) return 0;
  return Math.max(0, Math.ceil((fim - agora) / DIA));
}

/** "Vence hoje", "Vence em 1 dia", "Vence em 12 dias". */
export function textoVencimento(dias: number): string {
  if (dias <= 0) return "Vence hoje";
  return dias === 1 ? "Vence em 1 dia" : `Vence em ${dias} dias`;
}

/**
 * "Pedir de novo": pedido fechado (menos o tirado pela equipe) ou aberto, vencendo e sem poder estender
 * (já estendido o máximo). `diasLembrete` = quando o banco libera o "Ainda preciso" (radar.lembrete_dias).
 */
export function mostrarPedirDeNovo(p: {
  situacao: SituacaoPedido;
  fechado_motivo: string | null;
  pode_estender?: boolean;
  extensoes?: number;
  diasRestantes: number;
  diasLembrete?: number;
}): boolean {
  if (p.situacao === "fechado") return p.fechado_motivo !== "moderacao";
  if (p.situacao !== "aberto" || p.pode_estender) return false;
  return (p.extensoes ?? 0) > 0 && p.diasRestantes <= (p.diasLembrete ?? 2);
}
