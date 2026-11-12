// Padrão de exibição de nomes (loja, pessoa) e títulos de anúncio. Só muda o que aparece na tela:
// o texto original continua guardado no banco do jeito que a pessoa digitou.

/** Palavras que ficam minúsculas no meio do nome: "Casa da Ana", "Pães e Doces", "Pizza na Brasa". */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "na", "no", "com", "em"]);

/** Algarismos romanos comuns em nome de produto ("Parte II", "Copa IV"). */
const ROMANO = /^(?:II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV)$/;

/** Siglas com vogal que continuam maiúsculas: tipo de empresa e termos de produto comuns na região. */
const SIGLAS = new Set(["LTDA", "EPP", "MEI", "EIRELI", "ONG", "USB", "LED", "LCD", "HD", "SSD", "PI"]);

/** Abreviações sem vogal que não são sigla: "DR. JOÃO" → "Dr. João". */
const ABREVIACOES = new Set(["DR", "SR", "SRS"]);

const VOGAL = /[aeiouáéíóúâêôãõàäëïöü]/i;
const LETRA = /\p{L}/u;
const MAIUSCULA = /\p{Lu}/u;
const TEM_NUMERO = /\d/;

function maiusculaNoInicio(parte: string): string {
  const i = parte.search(LETRA);
  return i < 0 ? parte : parte.slice(0, i) + parte[i].toLocaleUpperCase("pt-BR") + parte.slice(i + 1);
}

/** Uma palavra do texto em caixa alta, já sem os números (que ficam como foram digitados). */
function palavraPadrao(palavra: string, primeira: boolean): string {
  return palavra
    .split(/([-/])/) // "AUTO-PEÇAS" → "Auto-Peças"
    .map((parte, i) => {
      if (parte === "-" || parte === "/") return parte;
      const letras = parte.replace(/[^\p{L}]/gu, "");
      const emMaiuscula = letras.length >= 2 && letras === letras.toLocaleUpperCase("pt-BR");
      // Sigla com pontos ("S.A.", "S.A"): fica maiúscula.
      if (emMaiuscula && /^(?:\p{L}\.)+\p{L}?\.?$/u.test(parte)) return parte;
      // Sigla: só consoantes ("RVS", "TV", "LG"), algarismo romano ou da lista (LTDA, ME…).
      if (emMaiuscula && !ABREVIACOES.has(letras) && (!VOGAL.test(letras) || ROMANO.test(letras) || SIGLAS.has(letras))) return parte;
      const minuscula = parte.toLocaleLowerCase("pt-BR");
      if (!(primeira && i === 0) && LIGACOES.has(minuscula)) return minuscula;
      return maiusculaNoInicio(minuscula);
    })
    .join("");
}

/**
 * Padrão de exibição para nome de loja, nome de pessoa e título de anúncio.
 *
 * - Todo (ou quase todo, 80% das letras) em CAIXA ALTA → Cada Palavra com a Primeira Maiúscula,
 *   com "de, da, do, das, dos, e, na, no, com, em" minúsculas no meio: "CASA DA ANA" → "Casa da Ana".
 *   Siglas sem vogal ou conhecidas continuam maiúsculas ("RVS", "TV LG", "LTDA", "S.A."); palavras com número ficam como foram
 *   digitadas ("15KG", "160cc", "PS5").
 * - Todo em minúscula → só a primeira letra maiúscula: "geladeira usada" → "Geladeira usada".
 * - Maiúsculas e minúsculas misturadas → fica como está ("Loja RVS", "iPhone 11").
 * - Espaços repetidos viram um só; vazio ou null → "".
 */
export function formatarNome(texto: string | null | undefined): string {
  const limpo = String(texto ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) return "";
  const palavras = limpo.split(" ");
  // Conta só as palavras sem número: "MOTO 160cc" é caixa alta, mesmo com o "cc" minúsculo.
  const letras = palavras.filter((p) => !TEM_NUMERO.test(p)).join("").replace(/[^\p{L}]/gu, "");
  if (!letras) return limpo;
  const maiusculas = [...letras].filter((c) => MAIUSCULA.test(c)).length;
  if (maiusculas === 0) return maiusculaNoInicio(limpo);
  if (maiusculas / letras.length < 0.8) return limpo;
  return palavras.map((p, i) => (TEM_NUMERO.test(p) ? p : palavraPadrao(p, i === 0))).join(" ");
}

/** Aviso para a tela onde a pessoa digita: só aparece quando o site vai mostrar diferente do digitado. */
export function avisoComoVaiAparecer(texto: string | null | undefined): string | undefined {
  const digitado = String(texto ?? "").trim().replace(/\s+/g, " ");
  const mostrado = formatarNome(digitado);
  return mostrado && mostrado !== digitado ? `Vai aparecer assim: “${mostrado}”.` : undefined;
}
