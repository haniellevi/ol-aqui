// Pequenas regras de exibição do vendedor (servidor e navegador).

/** Pessoa física aparece só com o primeiro nome (privacidade). */
export function primeiroNome(nome: string | null | undefined): string {
  return String(nome ?? "").trim().split(/\s+/)[0] || "Vendedor";
}

/** Iniciais para o círculo quando não há logo: "João Moto Peças" → "JM". */
export function iniciais(nome: string | null | undefined): string {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Fortaleza" });

/** "no OLAKI desde novembro de 2026". */
export function desde(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `No OLAKI desde ${mesAno.format(d)}`;
}

/** Caminho do perfil público da pessoa física (pelo id da vitrine, nunca o id da conta). */
export const linkVendedor = (vitrineId: string) => `/vendedor/${vitrineId}`;
