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

// Cidade tem de ser igual. Rua: pelo menos 50 % das palavras em comum (sobre a maior lista). Dado faltando → só a cidade conta.
export function enderecoBate(leitura: Pick<LeituraComprovante, "logradouro" | "cidade">, cadastro: Cadastro): boolean {
  if (!leitura.cidade || normalizar(leitura.cidade) !== normalizar(cadastro.cidade)) return false;
  if (!leitura.logradouro || !cadastro.endereco) return true;
  const ra = tokens(leitura.logradouro, RUIDO_RUA), rb = tokens(cadastro.endereco, RUIDO_RUA);
  if (ra.size === 0 || rb.size === 0) return true;
  const comum = [...ra].filter((t) => rb.has(t)).length;
  return comum / Math.max(ra.size, rb.size) >= 0.5;
}
