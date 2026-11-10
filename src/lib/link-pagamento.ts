/** Só páginas de cobrança hospedadas pelo Asaas; nunca URLs vindas diretamente do navegador. */
export function linkPagamentoSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["www.asaas.com", "asaas.com", "sandbox.asaas.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
