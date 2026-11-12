import "server-only";

// Envio de avisos por WhatsApp (Evolution). Só precisa do servidor Evolution: não usa Turnstile nem código OTP.
export type ConfiguracaoEnvio = { url: string; chave: string; instancia: string };

export function configuracaoEnvio(): ConfiguracaoEnvio {
  const { EVOLUTION_URL: endereco, EVOLUTION_API_KEY: chave, EVOLUTION_INSTANCE: instancia } = process.env;
  if (!endereco || !chave || !instancia) throw Error("Envio indisponível.");
  let url: URL;
  try { url = new URL(endereco); } catch { throw Error("Envio indisponível."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/^[\w-]{1,80}$/.test(instancia)) throw Error("Envio indisponível.");
  return { url: url.toString().replace(/\/$/, ""), chave, instancia };
}

// Mesmo protocolo do envio do código: instância aberta, sendText, mensagem de saída confirmada.
// "falha" = nada saiu (pode tentar de novo); "incerto" = pode ter saído (nunca repetir sozinho).
export async function enviarTexto(numero: string, texto: string, config: ConfiguracaoEnvio): Promise<"enviado" | "incerto" | "falha"> {
  try {
    const estado = await fetch(`${config.url}/instance/connectionState/${config.instancia}`, {
      headers: { apikey: config.chave, Origin: new URL(config.url).origin }, cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!estado.ok || (await estado.json()).instance?.state !== "open") return "falha";
  } catch { return "falha"; }
  try {
    const r = await fetch(`${config.url}/message/sendText/${config.instancia}`, {
      method: "POST", headers: { apikey: config.chave, Origin: new URL(config.url).origin, "Content-Type": "application/json" }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(15000), body: JSON.stringify({ number: numero, text: texto, linkPreview: false }),
    });
    // Uma falha de rede/servidor pode ocorrer depois de a mensagem sair. Nunca repetir automaticamente.
    if (!r.ok) return r.status >= 400 && r.status < 500 ? "falha" : "incerto";
    const d = await r.json();
    return !d.error && d.key?.fromMe === true && typeof d.key?.id === "string" && d.key.id.length > 0 ? "enviado" : "incerto";
  } catch { return "incerto"; }
}
