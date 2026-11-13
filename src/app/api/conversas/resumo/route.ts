import { auth } from "@clerk/nextjs/server";
import { conversasNaoLidas } from "@/lib/dados/conversas";

// Bolinha do ícone Conversas (mesmo formato de /api/notificacoes/resumo).
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ erro: "Entre na sua conta." }, { status: 401, headers });
  try {
    return Response.json({ naoLidas: await conversasNaoLidas() }, { headers });
  } catch {
    return Response.json({ erro: "Não foi possível atualizar as conversas." }, { status: 503, headers });
  }
}
