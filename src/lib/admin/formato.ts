const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" });

export const reais = (centavos: number | null | undefined) => moeda.format((centavos ?? 0) / 100);
export const inteiro = (n: number | null | undefined) => numero.format(n ?? 0);
export const quando = (iso: string | null | undefined) => (iso ? dataHora.format(new Date(iso)) : "—");

/** "49,90" ou "1.234,50" → 4990 / 123450. Vazio → null. */
export function centavosDe(texto: FormDataEntryValue | null): number | null {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido: ${t}`);
  return Math.round(n * 100);
}

/** Inteiro opcional de um campo de formulário. Vazio → null (usado como "ilimitado"). */
export function inteiroOuNulo(texto: FormDataEntryValue | null): number | null {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Número inválido: ${t}`);
  return n;
}

export const paraReaisInput = (centavos: number | null | undefined) =>
  centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",");
