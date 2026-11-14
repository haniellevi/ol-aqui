import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rascunho = new URL(request.url).searchParams.get("rascunho") ?? "";
  if (!ehUuid(id) || !ehUuid(rascunho)) return new Response(null, { status: 404, headers });
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("loja_ia_obter_imagem_propria", { p_rascunho: rascunho, p_imagem: id });
    if (error || !data || data.estado !== "pronta") return new Response(null, { status: 404, headers });
    const { data: arquivo, error: falha } = await supabaseAdmin().storage.from("loja-ia").download(data.caminho);
    if (falha || !arquivo) return new Response(null, { status: 404, headers });
    return new Response(arquivo, { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
