import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// Página vista no site (sem IP e sem dado pessoal: só um código aleatório do navegador).
// O banco decide a origem (link marcado, site de onde veio ou direto) e ignora robô e /admin.

type Corpo = {
  visitante?: unknown;
  caminho?: unknown;
  origem?: unknown;
  campanha?: unknown;
  referencia?: unknown;
  celular?: unknown;
  primeira?: unknown;
  /** origem do primeiro clique, para guardar na conta nova (uma vez) */
  conta?: { origem?: unknown; campanha?: unknown };
};

const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  const bruto = await req.text();
  if (bruto.length > 2000) return NextResponse.json({ ok: false }, { status: 413 });
  let corpo: Corpo;
  try {
    corpo = JSON.parse(bruto) as Corpo;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const visitante = texto(corpo.visitante, 40);
  const caminho = texto(corpo.caminho, 200);
  if (!visitante || !caminho) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_visita", {
    p_visitante: visitante,
    p_caminho: caminho,
    p_origem: texto(corpo.origem, 60),
    p_campanha: texto(corpo.campanha, 80),
    p_referencia: texto(corpo.referencia, 100),
    p_celular: corpo.celular !== false,
    p_primeira: corpo.primeira === true,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  let contaMarcada = false;
  const origemConta = texto(corpo.conta?.origem, 60);
  if (origemConta) {
    const { userId } = await auth();
    if (userId) {
      const r = await supabase.rpc("marcar_origem_conta", { p_origem: origemConta, p_campanha: texto(corpo.conta?.campanha, 80) });
      contaMarcada = !r.error;
    }
  }
  return NextResponse.json({ ok: true, origem: typeof data === "string" ? data : null, contaMarcada });
}
