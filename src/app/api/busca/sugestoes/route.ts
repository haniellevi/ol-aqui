import { sugestoesBusca } from "@/lib/dados/sugestoes-busca";

// Sugestões da busca do topo enquanto a pessoa digita (sem IA). Depende da cidade escolhida (cookie).
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(await sugestoesBusca(q), { headers });
}
