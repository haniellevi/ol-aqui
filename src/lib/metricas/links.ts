import { origemPermitida } from "./contrato";

export function linkComOrigem(site: string, caminho: string, origem: string, ativas: string[]): string {
  if (!ativas.includes(origem) || origemPermitida(new URLSearchParams({ origem }).toString()).origem !== origem) return "";
  if (!["/", "/lojas", "/radar", "/quero-vender", "/planos"].includes(caminho) && !/^\/loja\/[a-z0-9-]{3,60}$/.test(caminho)) return "";
  try {
    const base = new URL(site);
    if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) return "";
    return `${base.origin}${caminho}?${new URLSearchParams({ origem })}`;
  } catch { return ""; }
}
