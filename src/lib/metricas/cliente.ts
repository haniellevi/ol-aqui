import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO, lerPreferencia, type Preferencia } from "./consentimento";
import { origemPermitida, rotaNeutra } from "./contrato";

let primeiraPendente = false;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

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
/** Preparação síncrona, somente com escolha atual aceita; não despacha nem agenda eventos. */
export function prepararIdentidadeMedicao(consumirPrimeira = false): { visitante: string; primeira: boolean } | null {
  if (!podeMedir()) return null;
  try {
    let visitante = localStorage.getItem("mr_visitante");
    if (!visitante || !UUID.test(visitante)) {
      visitante = crypto.randomUUID(); localStorage.setItem("mr_visitante", visitante); primeiraPendente = true;
    }
    for (const path of ["/anuncio", "/loja"]) document.cookie = `mr_medicao_visitante=${visitante}; Path=${path}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (/^\/(anuncio|loja)\//.test(window.location.pathname) && !document.cookie.split("; ").includes(`mr_medicao_visitante=${visitante}`)) return null;
    const primeira = primeiraPendente;
    if (consumirPrimeira) primeiraPendente = false;
    return { visitante, primeira };
  } catch { return null; }
}

/** Fluxo de despachos de pageview no sessionStorage, que o navegador pode copiar entre abas. */
export function sessaoPageviews(agora: number, query: string): { id: string; em: number; origem: string | null } | null {
  if (!podeMedir()) return null;
  let s: { id: string; em: number; origem: string | null } | null = null;
  try { s = JSON.parse(sessionStorage.getItem("mr_medicao_sessao") ?? "null"); } catch { /* refaz */ }
  if (!s || !UUID.test(s.id) || !Number.isFinite(s.em) || agora < s.em || agora - s.em >= 30 * 60 * 1000) s = { id: crypto.randomUUID(), em: agora, origem: origemPermitida(query).origem };
  s.origem = origemPermitida(`origem=${encodeURIComponent(s.origem ?? "")}`).origem;
  s.em = agora;
  sessionStorage.setItem("mr_medicao_sessao", JSON.stringify(s));
  return s;
}
export function limparIdentificadores() {
  primeiraPendente = false;
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
