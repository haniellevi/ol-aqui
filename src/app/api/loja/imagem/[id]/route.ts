import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response(null, { status: 404, headers });
  try {
    const db = supabaseAdmin();
    const { data: caminho, error } = await db.rpc("loja_ia_imagem_publica", { p_imagem: id });
    if (error || !caminho) return new Response(null, { status: 404, headers });
    const { data, error: falha } = await db.storage.from("loja-ia").download(caminho);
    if (falha || !data) return new Response(null, { status: 404, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
