import "server-only";
import { cookies, headers } from "next/headers";
import { CHAVE_CONSENTIMENTO, lerPreferencia } from "./consentimento";
import { rotaNeutra } from "./contrato";

export async function permiteEstatistica(): Promise<boolean> {
  try {
    const valor = (await cookies()).get(CHAVE_CONSENTIMENTO)?.value;
    if (!lerPreferencia(valor ? decodeURIComponent(valor) : null).estatistica) return false;
    const h = await headers();
    if (h.get("next-router-prefetch") === "1" || /prefetch/i.test(`${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""}`)) return false;
    const origem = h.get("referer");
    if (!origem) return false;
    const url = new URL(origem);
    return url.host === h.get("host") && !!rotaNeutra(url.pathname);
  } catch { return false; }
}
