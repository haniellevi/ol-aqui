import "server-only";
import { cookies, headers } from "next/headers";
import { CHAVE_CONSENTIMENTO, lerPreferencia } from "./consentimento";
import { rotaNeutra } from "./contrato";

export async function permiteEstatistica(): Promise<boolean> {
  try {
    if (!lerPreferencia((await cookies()).get(CHAVE_CONSENTIMENTO)?.value ? decodeURIComponent((await cookies()).get(CHAVE_CONSENTIMENTO)!.value) : null).estatistica) return false;
    const h = await headers();
    const origem = h.get("referer");
    if (!origem) return false;
    const url = new URL(origem);
    return url.host === h.get("host") && !!rotaNeutra(url.pathname);
  } catch { return false; }
}
