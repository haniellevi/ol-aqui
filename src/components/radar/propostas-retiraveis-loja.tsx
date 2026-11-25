import { createClient } from "@/lib/supabase/server";
import { RetirarProposta } from "./retirar-proposta";
import { JanelaConfirmar } from "@/components/ui/confirmar";

export async function PropostasRetiraveisLoja({ loja }: { loja: string }) {
  const db = await createClient();
  const { data, error } = await db.rpc("propostas_retiraveis_loja", { p_loja: loja });
  if (error) return <p role="alert">Não foi possível carregar as propostas. Atualize a página para tentar novamente.</p>;
  if (!Array.isArray(data) || !data.length) return null;
  return <section className="flex flex-col gap-3">
    <JanelaConfirmar />
    <h2 className="text-lg font-semibold">Propostas no Radar</h2>
    <p>Retire uma oferta se a loja não puder mais atender ao pedido.</p>
    <ul className="flex flex-col gap-3">{data.map((p: { id: string; titulo: string }) => <li key={p.id} className="flex flex-col gap-2">
      <p className="break-words">{p.titulo}</p>
      <RetirarProposta id={p.id} />
    </li>)}</ul>
  </section>;
}
