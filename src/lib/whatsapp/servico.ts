import "server-only";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { whatsappDigitado } from "@/lib/formato";

export function numeroWhatsapp(entrada: unknown): string | null {
  if (typeof entrada !== "string" || entrada.length > 30 || !/^[\d+().\s-]+$/.test(entrada)) return null;
  if (entrada.includes("+") && (!/^\s*\+55[\d().\s-]*$/.test(entrada) || entrada.replace(/\D/g, "").length !== 13)) return null;
  if (entrada.trimStart().startsWith("(") && entrada.replace(/\D/g, "").length !== 11) return null;
  return whatsappDigitado(entrada);
}

export function configuracaoWhatsapp() {
  const { EVOLUTION_URL: endereco, EVOLUTION_API_KEY: chave, EVOLUTION_INSTANCE: instancia,
    WHATSAPP_OTP_SECRET: segredo, TURNSTILE_SECRET_KEY: turnstile, NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey,
    TURNSTILE_HOSTNAMES: hosts } = process.env;
  if (!endereco || !chave || !instancia || !segredo || segredo.length < 32 || !turnstile || !siteKey || !hosts) throw Error("Verificação indisponível.");
  const url = new URL(endereco);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/^[\w-]{1,80}$/.test(instancia)) throw Error("Verificação indisponível.");
  const hostnames = hosts.split(",").map(h => h.trim()).filter(Boolean);
  // URLs fornecidas pela Vercel, nunca pelo cabeçalho Host da requisição.
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (host) hostnames.push(host);
  }
  if (!hostnames.length || hostnames.some(h => !/^[a-z0-9.-]+$/.test(h))) throw Error("Verificação indisponível.");
  return { url: url.toString().replace(/\/$/, ""), chave, instancia, segredo, turnstile, hostnames, siteKey };
}
export function resumoCodigo(usuario: string, desafio: string, codigo: string, segredo: string) {
  return createHmac("sha256", segredo).update(JSON.stringify([usuario, desafio, codigo])).digest("hex");
}
export function novoCodigo(usuario: string, segredo: string) {
  const id = randomUUID(), codigo = String(randomInt(100000, 1000000));
  return { id, codigo, resumo: resumoCodigo(usuario, id, codigo, segredo) };
}

export async function validarTurnstile(token: unknown, config: ReturnType<typeof configuracaoWhatsapp>): Promise<boolean> {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ secret: config.turnstile, response: token }), signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!r.ok) return false;
    const d = await r.json();
    return d.success === true && d.action === "confirmar-whatsapp" && config.hostnames.includes(d.hostname);
  } catch { return false; }
}

export async function enviarCodigo(numero: string, codigo: string, config: ReturnType<typeof configuracaoWhatsapp>): Promise<"enviado" | "incerto" | "falha"> {
  try {
    const estado = await fetch(`${config.url}/instance/connectionState/${config.instancia}`, {
      headers: { apikey: config.chave, Origin: new URL(config.url).origin }, cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!estado.ok || (await estado.json()).instance?.state !== "open") return "falha";
  } catch { return "falha"; }
  try {
    const r = await fetch(`${config.url}/message/sendText/${config.instancia}`, {
      method: "POST", headers: { apikey: config.chave, Origin: new URL(config.url).origin, "Content-Type": "application/json" }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(15000), body: JSON.stringify({ number: numero, text: `Seu código de verificação para o Mercado da Região é: ${codigo}. Válido por 5 minutos. Não compartilhe este código. Se você não solicitou, ignore esta mensagem.`, linkPreview: false }),
    });
    // Uma falha de rede/servidor pode ocorrer depois de a mensagem sair. Nunca repetir automaticamente.
    if (!r.ok) return r.status >= 400 && r.status < 500 ? "falha" : "incerto";
    const d = await r.json();
    return !d.error && d.key?.fromMe === true && typeof d.key?.id === "string" && d.key.id.length > 0 ? "enviado" : "incerto";
  } catch { return "incerto"; }
}
