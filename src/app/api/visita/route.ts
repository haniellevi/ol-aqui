import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { permiteEstatistica } from "@/lib/metricas/gate-servidor";
import { origemPermitida, rotaNeutra } from "@/lib/metricas/contrato";
import { ehBot } from "@/lib/metricas/aparicoes";
export async function POST(req: Request) {
  if (!(await permiteEstatistica()) || ehBot(req.headers.get("user-agent"))) return NextResponse.json({ ok: false }, { status: 403 });
  const bruto = await req.text();
  if (bruto.length > 2000) return NextResponse.json({ ok: false }, { status: 413 });
  let c;
  try { c = JSON.parse(bruto); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  const rota = rotaNeutra(c?.caminho);
  if (!rota || !uuid(c?.visitante) || !uuid(c?.sessao) || !uuid(c?.ocorrencia)) return NextResponse.json({ ok: false }, { status: 400 });
  const origem = origemPermitida(`origem=${encodeURIComponent(c.origem ?? "")}`).origem;
  const { error } = await supabaseAdmin().rpc("registrar_visita_consentida", {
    p_visitante: c.visitante, p_sessao: c.sessao, p_ocorrencia: c.ocorrencia, p_caminho: rota,
    p_origem: origem, p_celular: c.celular === true, p_primeira: c.primeira === true,
  });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
