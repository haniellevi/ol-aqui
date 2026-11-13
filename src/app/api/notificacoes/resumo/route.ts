import { auth } from "@clerk/nextjs/server";
import { avisosNaoLidos, minhasNotificacoes } from "@/lib/dados/radar";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ erro: "Entre na sua conta." }, { status: 401, headers });
  try {
    if (new URL(request.url).searchParams.get("previa") === "1") {
      const { avisos } = await minhasNotificacoes(1, false, 5);
      return Response.json({ avisos }, { headers });
    }
    return Response.json({ naoLidas: await avisosNaoLidos() }, { headers });
  } catch {
    return Response.json({ erro: "Não foi possível atualizar os avisos." }, { status: 503, headers });
  }
}
