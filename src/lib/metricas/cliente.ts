import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO, lerPreferencia, type Preferencia } from "./consentimento";
import { rotaNeutra } from "./contrato";

export function preferenciaAtual() {
  if (typeof document === "undefined") return lerPreferencia(null);
  try {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith(`${CHAVE_CONSENTIMENTO}=`));
    return lerPreferencia(cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null);
  } catch { return lerPreferencia(null); }
}
export function podeMedir() {
  return typeof window !== "undefined" && preferenciaAtual().estatistica && !!rotaNeutra(window.location.pathname);
}
export function limparIdentificadores() {
  for (const path of ["/", "/anuncio", "/loja"]) document.cookie = `mr_medicao_visitante=; Path=${path}; Max-Age=0; SameSite=Lax`;
  for (const chave of ["mr_visitante", "mr_primeira_origem", "mr_origem_conta_ok", "mr-vistos-v1"]) {
    try { localStorage.removeItem(chave); } catch { /* storage indisponível */ }
  }
  for (const chave of ["mr_sessao_origem", "mr_medicao_sessao", "olaki.buscaAberta"]) {
    try { sessionStorage.removeItem(chave); } catch { /* storage indisponível */ }
  }
}
export function salvarPreferencia(p: Preferencia) {
  const valor = JSON.stringify({ v: 1, estatistica: p.estatistica === true, marketing: p.marketing === true });
  document.cookie = `${CHAVE_CONSENTIMENTO}=${encodeURIComponent(valor)}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (!p.estatistica) limparIdentificadores();
  try { localStorage.setItem(CHAVE_CONSENTIMENTO, valor); } catch { /* cookie continua sendo a preferência */ }
  window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
}
