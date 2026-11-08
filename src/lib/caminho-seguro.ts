// Caminho interno seguro para redirecionar ou linkar ("/minha-conta?x=1#y").
// Recusa outro site em todas as formas que o navegador entende como site: "//x.com",
// "/\x.com" (barra invertida vira barra) e tab/quebra de linha no meio (o navegador apaga).
// Devolve o caminho já normalizado (pathname + busca + âncora) ou null.
const BASE = "https://olaki.invalid";

export function caminhoInterno(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(t)) return null;
  try {
    const u = new URL(t, BASE);
    if (u.origin !== BASE) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}
