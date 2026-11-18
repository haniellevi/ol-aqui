export function normalizarCodigoCupom(entrada: FormDataEntryValue | null): string | null {
  const codigo = String(entrada ?? "").trim().toUpperCase();
  return /^[A-Z0-9-]{4,32}$/.test(codigo) ? codigo : null;
}

export const diaDoCupom = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
