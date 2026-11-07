import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { soDigitos } from "@/lib/cpf-cnpj";

/**
 * Cliente do Asaas (só servidor, com fetch, sem biblioteca extra).
 * Chaves só em variável de ambiente (Vercel): ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.
 * Ambiente (sandbox ou producao) vem da configuração "asaas.ambiente" do painel.
 * Sem ASAAS_API_KEY o site mostra "Pagamento em breve" e nada aqui é chamado.
 */

export type AmbienteAsaas = "sandbox" | "producao";

const URLS: Record<AmbienteAsaas, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

/** Situações do Asaas que contam como pago. */
export const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export class ErroAsaas extends Error {
  constructor(
    mensagem: string,
    public status?: number,
  ) {
    super(mensagem);
  }
}

/** true quando a chave da API está na Vercel. */
export function asaasConfigurado(): boolean {
  return !!process.env.ASAAS_API_KEY?.trim();
}

/** true quando o token do webhook está na Vercel. */
export function webhookConfigurado(): boolean {
  return !!process.env.ASAAS_WEBHOOK_TOKEN?.trim();
}

/** Lê "asaas.ambiente" (painel). Qualquer valor diferente de produção vira sandbox (falha segura). */
export async function ambienteAsaas(): Promise<AmbienteAsaas> {
  try {
    const { data } = await supabaseAdmin().rpc("config", { p_chave: "asaas.ambiente", p_microrregiao: null, p_padrao: "sandbox" });
    const v = String(data ?? "sandbox").toLowerCase();
    return v === "producao" || v === "produção" || v === "production" ? "producao" : "sandbox";
  } catch {
    return "sandbox";
  }
}

async function chamar<T>(ambiente: AmbienteAsaas, caminho: string, init: RequestInit = {}): Promise<T> {
  const chave = process.env.ASAAS_API_KEY?.trim();
  if (!chave) throw new ErroAsaas("Pagamento ainda não está ligado.");
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 15000);
  try {
    const r = await fetch(`${URLS[ambiente]}${caminho}`, {
      ...init,
      signal: controle.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "olaki",
        access_token: chave,
        ...(init.headers ?? {}),
      },
    });
    const texto = await r.text();
    const corpo = texto ? (JSON.parse(texto) as unknown) : null;
    if (!r.ok) {
      const erros = (corpo as { errors?: { description?: string }[] } | null)?.errors;
      throw new ErroAsaas(erros?.[0]?.description ?? `Asaas respondeu ${r.status}`, r.status);
    }
    return corpo as T;
  } catch (e) {
    if (e instanceof ErroAsaas) throw e;
    throw new ErroAsaas(e instanceof Error && e.name === "AbortError" ? "O Asaas demorou para responder." : "Não deu para falar com o Asaas.");
  } finally {
    clearTimeout(tempo);
  }
}

/** O id do cliente fica guardado como "ambiente:cus_..." (trocar de ambiente pede o documento de novo). */
export function clienteDoAmbiente(guardado: string | null | undefined, ambiente: AmbienteAsaas): string | null {
  if (!guardado) return null;
  const [amb, id] = guardado.split(":", 2);
  return amb === ambiente && id?.startsWith("cus_") ? id : null;
}

/** Cria o cliente no Asaas. O CPF/CNPJ vai só para o Asaas; quem chama guarda apenas o id. */
export async function criarCliente(ambiente: AmbienteAsaas, dados: { nome: string; documento: string; referencia: string }) {
  const c = await chamar<{ id: string }>(ambiente, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome.slice(0, 100) || "Cliente OLAKI",
      cpfCnpj: soDigitos(dados.documento),
      externalReference: dados.referencia,
      notificationDisabled: true, // o OLAKI avisa a pessoa; o Asaas não manda e-mail/SMS
    }),
  });
  return c.id;
}

export type CobrancaAsaas = { id: string; status: string; invoiceUrl: string | null; billingType: string; value: number };

/** Cria a cobrança (Pix ou cartão). Valor em centavos; data no formato AAAA-MM-DD. */
export async function criarCobranca(
  ambiente: AmbienteAsaas,
  dados: { cliente: string; forma: "pix" | "cartao"; centavos: number; vencimento: string; descricao: string; referencia: string },
) {
  return chamar<CobrancaAsaas>(ambiente, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.cliente,
      billingType: dados.forma === "pix" ? "PIX" : "CREDIT_CARD",
      value: Math.round(dados.centavos) / 100,
      dueDate: dados.vencimento,
      description: dados.descricao.slice(0, 500),
      externalReference: dados.referencia,
    }),
  });
}

/** Troca a forma de uma cobrança que ainda não foi paga (Pix ⇄ cartão). */
export async function trocarForma(ambiente: AmbienteAsaas, id: string, forma: "pix" | "cartao") {
  return chamar<CobrancaAsaas>(ambiente, `/payments/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ billingType: forma === "pix" ? "PIX" : "CREDIT_CARD" }),
  });
}

export async function consultarCobranca(ambiente: AmbienteAsaas, id: string) {
  return chamar<CobrancaAsaas & Record<string, unknown>>(ambiente, `/payments/${encodeURIComponent(id)}`);
}

/** Apaga uma cobrança criada a mais (dois cliques ao mesmo tempo). Erro aqui não atrapalha a pessoa. */
export async function apagarCobranca(ambiente: AmbienteAsaas, id: string) {
  try {
    await chamar(ambiente, `/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* fica pendente no Asaas e vence sozinha */
  }
}

/** QR Code do Pix: imagem (base64 PNG) e o código "copia e cola". */
export async function qrCodePix(ambiente: AmbienteAsaas, id: string) {
  return chamar<{ encodedImage: string; payload: string; expirationDate?: string }>(
    ambiente,
    `/payments/${encodeURIComponent(id)}/pixQrCode`,
  );
}

/** Compara o cabeçalho "asaas-access-token" com ASAAS_WEBHOOK_TOKEN em tempo constante. */
export function tokenWebhookConfere(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado || !recebido) return false;
  // resumo (sha256) dos dois: mesmo tamanho sempre, e o tempo não revela o tamanho do token
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
