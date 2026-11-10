import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EXTENSAO: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const PRIVADO = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Entre na sua conta.", { status: 401, headers: PRIVADO });
  const { id, tipo } = await params;
  if (!ehUuid(id) || (tipo !== "documento" && tipo !== "comprovante")) {
    return new Response("Arquivo indisponível.", { status: 404, headers: PRIVADO });
  }

  const db = await createClient();
  const { data, error } = await db.rpc("admin_arquivo_verificacao_pf", { p_id: id, p_tipo: tipo })
    .maybeSingle<{ arquivo_base64: string; mime: string }>();
  if (error) {
    return new Response("Arquivo indisponível.", { status: error.code === "42501" ? 403 : 503, headers: PRIVADO });
  }
  const extensao = data ? EXTENSAO[data.mime] : null;
  if (!data?.arquivo_base64 || !extensao) return new Response("Arquivo indisponível.", { status: 404, headers: PRIVADO });

  return new Response(new Uint8Array(Buffer.from(data.arquivo_base64, "base64")), {
    headers: {
      ...PRIVADO,
      "Content-Type": data.mime,
      "Content-Disposition": `attachment; filename="${tipo}.${extensao}"`,
    },
  });
}
