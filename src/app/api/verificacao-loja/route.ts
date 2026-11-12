import { auth } from "@clerk/nextjs/server";
import { cnpjValido, soDigitos } from "@/lib/cpf-cnpj";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_ARQUIVO_VERIFICACAO_LOJA } from "@/lib/verificacao-loja/constantes";

export const runtime = "nodejs";
const MAX_PEDIDO = 2 * MAX_ARQUIVO_VERIFICACAO_LOJA + 64 * 1024;

function resposta(status: number, mensagem: string) {
  return Response.json({ ok: status === 200, mensagem }, { status, headers: { "Cache-Control": "no-store" } });
}

async function lerFormulario(req: Request, tipo: string) {
  const leitor = req.body?.getReader();
  if (!leitor) return null;
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.length;
    if (tamanho > MAX_PEDIDO) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  return new Response(new Uint8Array(Buffer.concat(partes)), { headers: { "Content-Type": tipo } }).formData();
}

type Leitura = { ok: true; base64: string | null } | { ok: false };

/** Arquivo ausente vale null (quando opcional); arquivo vazio ou grande demais é recusado. */
async function lerArquivo(arquivo: FormDataEntryValue | null): Promise<Leitura> {
  if (arquivo === null) return { ok: true, base64: null };
  if (typeof arquivo === "string") return arquivo === "" ? { ok: true, base64: null } : { ok: false };
  if (arquivo.size === 0) return { ok: true, base64: null };
  if (arquivo.size > MAX_ARQUIVO_VERIFICACAO_LOJA) return { ok: false };
  return { ok: true, base64: Buffer.from(await arquivo.arrayBuffer()).toString("base64") };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return resposta(401, "Entre na sua conta para enviar os documentos.");
  if (req.headers.get("origin") !== new URL(req.url).origin) return resposta(403, "Abra a página de verificação no Mercado da Região.");
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.startsWith("multipart/form-data;")) return resposta(400, "Envie os documentos pelo formulário.");
  if (Number(req.headers.get("content-length")) > MAX_PEDIDO) return resposta(413, "Cada arquivo pode ter até 2 MB.");

  let formulario: FormData | null;
  try {
    formulario = await lerFormulario(req, tipo);
  } catch {
    return resposta(400, "Não foi possível ler o envio. Selecione os arquivos novamente.");
  }
  if (!formulario) return resposta(413, "Cada arquivo pode ter até 2 MB.");

  const bruto = formulario.get("cnpj");
  const cnpj = soDigitos(typeof bruto === "string" ? bruto : "");
  if (cnpj.length === 11) return resposta(400, "Esse número é de CPF. O selo de loja pede CNPJ.");
  if (!cnpjValido(cnpj)) return resposta(400, "Confira o número do CNPJ.");

  const [comprovante, fachada] = await Promise.all([
    lerArquivo(formulario.get("comprovante")), lerArquivo(formulario.get("fachada")),
  ]);
  if (!comprovante.ok || !comprovante.base64) return resposta(400, "Envie o comprovante de endereço, com até 2 MB.");
  if (!fachada.ok) return resposta(400, "A foto da fachada deve ter até 2 MB.");

  try {
    const { data, error } = await supabaseAdmin().rpc("enviar_verificacao_loja", {
      p_usuario: userId, p_cnpj: cnpj, p_comprovante: comprovante.base64, p_fachada: fachada.base64,
    });
    if (error) return resposta(503, "Não foi possível confirmar o envio. Confira a situação na sua loja antes de tentar novamente.");
    switch (data) {
      case "enviada": return resposta(200, "Documentos enviados para conferência.");
      case "pendente": return resposta(409, "Sua loja já tem um envio em análise. Atualize esta página.");
      case "verificada": return resposta(409, "Sua loja já foi verificada.");
      case "conta": return resposta(403, "O envio é para contas de loja.");
      case "whatsapp": return resposta(403, "Confirme seu WhatsApp antes de enviar.");
      case "limite": return resposta(429, "Você atingiu o limite de envios em 24 horas. Tente novamente mais tarde.");
      case "cnpj": return resposta(400, "Esse CNPJ não pode ser usado. Confira o número ou fale com a equipe pela Ajuda.");
      case "invalido": return resposta(400, "Envie arquivos em PDF, JPG ou PNG, cada um com até 2 MB.");
      default: return resposta(503, "Não foi possível confirmar o envio. Consulte a situação na sua loja.");
    }
  } catch {
    return resposta(503, "O envio está indisponível agora. Tente novamente.");
  }
}
