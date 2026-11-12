import type { Cadastro, LeituraComprovante } from "./tipos";

const RUIDO_SOCIETARIO = new Set(["LTDA", "ME", "EPP", "EIRELI", "SA", "S", "A", "DE", "DA", "DO", "DOS", "DAS", "E"]);
const RUIDO_RUA = new Set(["RUA", "R", "AV", "AVENIDA", "TRAVESSA", "N", "DE", "DA", "DO", "DOS", "DAS", "E"]);

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/S\/A/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
}
function tokens(texto: string, ruido: Set<string>): Set<string> {
  return new Set(normalizar(texto).split(" ").filter((t) => t && !/^\d+$/.test(t) && !ruido.has(t)));
}

// Dois nomes batem se um conjunto de palavras contém o outro com pelo menos 2 em comum,
// ou se os dois têm uma única palavra idêntica de 5 letras ou mais. Dúvida = não bate.
export function nomesBatem(a: string, b: string): boolean {
  const ta = tokens(a, RUIDO_SOCIETARIO), tb = tokens(b, RUIDO_SOCIETARIO);
  if (ta.size === 0 || tb.size === 0) return false;
  const comum = [...ta].filter((t) => tb.has(t)).length;
  if (ta.size === 1 && tb.size === 1) { const [x] = ta; return comum === 1 && x.length >= 5; }
  return comum >= 2 && (comum === ta.size || comum === tb.size);
}

function vazio(texto: string | null | undefined): boolean {
  return texto === null || texto === undefined || texto.trim() === "";
}
// Rua inteira sem o tipo ("Rua", "R.", "Av."), mas com os números: "Rua 7" e "R. 7" viram "7".
function ruaCompleta(texto: string): string {
  const todas = normalizar(texto).split(" ").filter(Boolean);
  const sem = todas.filter((t) => !RUIDO_RUA.has(t));
  return (sem.length ? sem : todas).join(" ");
}

// Cidade tem de ser igual. Rua: pelo menos 50 % das palavras em comum (sobre a maior lista).
// Só a falta de texto (nulo/vazio) significa "sem dado" e deixa a cidade decidir sozinha. Rua com texto mas sem palavras
// (só número, como "Rua 7") é comparada inteira, com os números: "Rua 7" ≠ "Rua 8" e "Rua 7" ≠ "Avenida Brasil".
export function enderecoBate(leitura: Pick<LeituraComprovante, "logradouro" | "cidade">, cadastro: Cadastro): boolean {
  if (!leitura.cidade || normalizar(leitura.cidade) !== normalizar(cadastro.cidade)) return false;
  if (vazio(leitura.logradouro) || vazio(cadastro.endereco)) return true;
  const la = leitura.logradouro as string, lb = cadastro.endereco as string;
  const ra = tokens(la, RUIDO_RUA), rb = tokens(lb, RUIDO_RUA);
  if (ra.size === 0 || rb.size === 0) return ruaCompleta(la) === ruaCompleta(lb);
  const comum = [...ra].filter((t) => rb.has(t)).length;
  return comum / Math.max(ra.size, rb.size) >= 0.5;
}
