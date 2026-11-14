import "server-only";
import { isIP } from "node:net";
import { importarLogoWhatsapp } from "@/lib/loja-ia/whatsapp-logo";

type Trabalho = { id: string; tentativa: string };
type Banco = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type Evidencia = { id: string; campo: "nome" | "sobre" | "site" | "logo"; valor: string; origem: { fonte: "whatsapp"; rotulo: string } };
export type ResultadoPerfil = { estado: "ok"; evidencias: Evidencia[] } | { estado: "indisponivel"; motivo: string; evidencias?: Evidencia[] };
const indisponivel: ResultadoPerfil = { estado: "indisponivel", motivo: "Não foi possível consultar o perfil comercial." };

export async function consultarPerfilComercial(trabalho: Trabalho, db: Banco): Promise<ResultadoPerfil> {
  const endereco = process.env.LOJA_IA_PERFIL_URL?.trim();
  const segredo = process.env.LOJA_IA_PERFIL_SEGREDO?.trim();
  if (!endereco || !segredo || segredo.length < 32) return indisponivel;
  try {
    const url = new URL(endereco);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return indisponivel;
    const { data: ticket, error } = await db.rpc("loja_ia_emitir_ticket", { p_trabalho: trabalho.id, p_tentativa: trabalho.tentativa });
    if (error || typeof ticket !== "string") return indisponivel;
    const resposta = await fetch(`${url.toString().replace(/\/$/, "")}/perfil-loja`, { method: "POST", headers: { authorization: `Bearer ${segredo}`, "content-type": "application/json" }, body: JSON.stringify({ ticket }), redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!resposta.ok || Number(resposta.headers.get("content-length") ?? 0) > 8192 || !resposta.body) return indisponivel;
    const reader = resposta.body.getReader(); let bytes = 0; const blocos: Uint8Array[] = [];
    for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 8192) { await reader.cancel(); return indisponivel; } blocos.push(value); }
    const dados: Record<string, unknown> = JSON.parse(Buffer.concat(blocos).toString("utf8"));
    const evidencias: Evidencia[] = [];
    for (const [chave, campo, limite] of [["nome", "nome", 80], ["descricao", "sobre", 600], ["site", "site", 2048]] as const) {
      if (typeof dados[chave] !== "string") continue;
      const valor = dados[chave].trim().slice(0, limite);
      if (!valor) continue;
      if (campo === "site") {
        try {
          const site = new URL(valor); const host = site.hostname.toLowerCase();
          if (site.protocol !== "https:" || site.username || site.password || site.port || !host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || isIP(host.replace(/^\[|\]$/g, ""))) continue;
        } catch { continue; }
      }
      evidencias.push({ id: `whatsapp:${campo}`, campo, valor, origem: { fonte: "whatsapp", rotulo: "Perfil comercial do WhatsApp" } });
    }
    if (typeof dados.foto === "string") {
      try {
        const logo = await importarLogoWhatsapp(dados.foto, trabalho);
        evidencias.push({ id: "whatsapp:logo", campo: "logo", valor: logo, origem: { fonte: "whatsapp", rotulo: "Foto do perfil do WhatsApp Business" } });
      } catch {
        return { estado: "indisponivel", motivo: "Os dados disponíveis foram importados, mas a foto do perfil falhou. Envie um logo ou tente novamente.", evidencias };
      }
    }
    return evidencias.length ? { estado: "ok", evidencias } : indisponivel;
  } catch { return indisponivel; }
}
