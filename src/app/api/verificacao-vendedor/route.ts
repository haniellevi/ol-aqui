import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_ARQUIVO_VERIFICACAO } from "@/lib/verificacao-vendedor";

export const runtime = "nodejs";
const MAX_PEDIDO = 2 * MAX_ARQUIVO_VERIFICACAO + 64 * 1024;

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

async function lerArquivo(arquivo: FormDataEntryValue | null) {
  if (!arquivo || typeof arquivo === "string" || arquivo.size < 1 || arquivo.size > MAX_ARQUIVO_VERIFICACAO) return null;
  return Buffer.from(await arquivo.arrayBuffer()).toString("base64");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return resposta(401, "Entre na sua conta para enviar os arquivos.");
  if (req.headers.get("origin") !== new URL(req.url).origin) return resposta(403, "Abra a página de verificação no OLAKI.");
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.startsWith("multipart/form-data;")) return resposta(400, "Selecione os dois arquivos pelo formulário.");
  if (Number(req.headers.get("content-length")) > MAX_PEDIDO) return resposta(413, "Cada arquivo pode ter até 2 MB.");

  let formulario: FormData | null;
  try {
    formulario = await lerFormulario(req, tipo);
  } catch {
    return resposta(400, "Não foi possível ler o envio. Selecione os arquivos novamente.");
  }
  if (!formulario) return resposta(413, "Cada arquivo pode ter até 2 MB.");
  const [documento, comprovante] = await Promise.all([
    lerArquivo(formulario.get("documento")), lerArquivo(formulario.get("comprovante")),
  ]);
  if (!documento || !comprovante) return resposta(400, "Selecione o documento e o comprovante, cada um com até 2 MB.");

  try {
    const { data, error } = await supabaseAdmin().rpc("enviar_verificacao_vendedor_pf", {
      p_usuario: userId, p_documento: documento, p_comprovante: comprovante,
    });
    if (error) return resposta(503, "Não foi possível confirmar o envio. Confira a situação na sua conta antes de tentar novamente.");
    switch (data) {
      case "enviada": return resposta(200, "Arquivos enviados para conferência.");
      case "pendente": return resposta(409, "Você já tem um envio em análise. Atualize esta página.");
      case "verificada": return resposta(409, "Sua identidade já foi verificada.");
      case "conta": return resposta(403, "O envio é para contas de vendedor individual.");
      case "whatsapp": return resposta(403, "Confirme seu WhatsApp antes de enviar.");
      case "limite": return resposta(429, "Você atingiu o limite de envios em 24 horas. Tente novamente mais tarde.");
      case "invalido": return resposta(400, "Envie dois arquivos diferentes em PDF, JPG ou PNG.");
      default: return resposta(503, "Não foi possível confirmar o envio. Consulte a situação na sua conta.");
    }
  } catch {
    return resposta(503, "O envio está indisponível agora. Tente novamente.");
  }
}
