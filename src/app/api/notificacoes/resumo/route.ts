import { auth } from "@clerk/nextjs/server";
import { avisosNaoLidos } from "@/lib/dados/radar";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ erro: "Entre na sua conta." }, { status: 401, headers });
  try {
    return Response.json({ naoLidas: await avisosNaoLidos() }, { headers });
  } catch {
    return Response.json({ erro: "Não foi possível atualizar os avisos." }, { status: 503, headers });
  }
}
