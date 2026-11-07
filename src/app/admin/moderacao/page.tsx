import { exigirAdmin } from "@/lib/admin/auth";
import { quando, reais } from "@/lib/admin/formato";
import { Cartao, Titulo, estiloCampo } from "@/components/admin/ui";
import { decidirAnuncio, decidirPedido, resolverDenuncia } from "./actions";

export const metadata = { title: "Moderação" };

const MOTIVOS: Record<string, string> = {
  golpe: "Golpe",
  proibido: "Item proibido",
  falso: "Anúncio falso",
  ofensivo: "Ofensivo",
  duplicado: "Duplicado",
  outro: "Outro",
};

const botao = "h-11 rounded-xl px-4 text-sm font-semibold";

export default async function ModeracaoPage() {
  const { supabase } = await exigirAdmin();
  const [anunciosR, pedidosR, denunciasR] = await Promise.all([
    supabase
      .from("anuncios")
      .select("id, titulo, descricao, preco_centavos, categoria, cidade, fotos, motivo_analise, criado_em, vitrines_lojas(nome, slug)")
      .eq("status", "em_analise")
      .order("criado_em"),
    supabase.from("radar_pedidos").select("id, titulo, detalhes, cidade, motivo_analise, criado_em").eq("status", "em_analise").order("criado_em"),
    supabase.from("denuncias").select("id, alvo_tipo, alvo_id, motivo, detalhes, criado_em").eq("status", "aberta").order("criado_em"),
  ]);
  const anuncios = anunciosR.data ?? [];
  const pedidos = pedidosR.data ?? [];
  const denuncias = denunciasR.data ?? [];
  const idsEmAnalise = new Set([...anuncios.map((a) => a.id), ...pedidos.map((p) => p.id)]);
  const denunciasSoltas = denuncias.filter((d) => !idsEmAnalise.has(d.alvo_id)); // alvo ainda no ar
  const denunciasDe = (id: string) => denuncias.filter((d) => d.alvo_id === id);

  const vazio = anuncios.length + pedidos.length + denunciasSoltas.length === 0;

  return (
    <>
      <Titulo sub="Itens segurados pelo filtro automático ou por denúncias. Aprovar devolve ao ar; recusar tira do ar e avisa o motivo ao dono; congelar é para casos de Compliance Jurídico.">
        Moderação
      </Titulo>

      {vazio && <Cartao className="text-sm text-neutral-600">Nada esperando revisão. Tudo em dia.</Cartao>}

      {anuncios.length > 0 && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Anúncios em análise</h2>}
      <div className="space-y-4">
        {anuncios.map((a) => {
          const loja = Array.isArray(a.vitrines_lojas) ? a.vitrines_lojas[0] : a.vitrines_lojas;
          const dens = denunciasDe(a.id);
          return (
            <Cartao key={a.id}>
              <div className="flex gap-3">
                {a.fotos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.fotos[0]} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="size-20 shrink-0 rounded-xl bg-neutral-100" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{a.titulo}</p>
                  <p className="text-sm text-neutral-600">
                    {a.preco_centavos != null ? reais(a.preco_centavos) : "A combinar"} · {a.cidade} · {loja?.nome ?? "—"}
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{a.motivo_analise}</p>
                </div>
              </div>
              {a.descricao && <p className="mt-3 line-clamp-3 text-sm text-neutral-600">{a.descricao}</p>}
              {dens.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-neutral-600">
                  {dens.map((d) => (
                    <li key={d.id}>
                      Denúncia · <strong>{MOTIVOS[d.motivo] ?? d.motivo}</strong> {d.detalhes && `· ${d.detalhes}`} · {quando(d.criado_em)}
                    </li>
                  ))}
                </ul>
              )}
              <form action={decidirAnuncio} className="mt-4 space-y-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="motivo" placeholder="Motivo (para recusar ou congelar)" className={estiloCampo} />
                <div className="flex flex-wrap gap-2">
                  <button name="decisao" value="aprovar" className={`${botao} bg-emerald-700 text-white`}>Aprovar</button>
                  <button name="decisao" value="recusar" className={`${botao} border border-neutral-300 bg-white`}>Recusar</button>
                  <button name="decisao" value="congelar" className={`${botao} bg-red-700 text-white`}>Congelar (Compliance)</button>
                </div>
              </form>
            </Cartao>
          );
        })}
      </div>

      {pedidos.length > 0 && <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">Pedidos do Radar em análise</h2>}
      <div className="space-y-4">
        {pedidos.map((p) => (
          <Cartao key={p.id}>
            <p className="font-semibold">{p.titulo}</p>
            <p className="text-sm text-neutral-600">{p.cidade} · {quando(p.criado_em)}</p>
            <p className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{p.motivo_analise}</p>
            {p.detalhes && <p className="mt-2 text-sm text-neutral-600">{p.detalhes}</p>}
            <form action={decidirPedido} className="mt-4 space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="motivo" placeholder="Motivo (para recusar)" className={estiloCampo} />
              <div className="flex gap-2">
                <button name="decisao" value="aprovar" className={`${botao} bg-emerald-700 text-white`}>Aprovar</button>
                <button name="decisao" value="recusar" className={`${botao} border border-neutral-300 bg-white`}>Recusar</button>
              </div>
            </form>
          </Cartao>
        ))}
      </div>

      {denunciasSoltas.length > 0 && (
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">Denúncias de itens ainda no ar</h2>
      )}
      <div className="space-y-3">
        {denunciasSoltas.map((d) => (
          <Cartao key={d.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <strong>{MOTIVOS[d.motivo] ?? d.motivo}</strong> · {d.alvo_tipo} <span className="font-mono text-xs text-neutral-400">{d.alvo_id.slice(0, 8)}</span>
              </p>
              {d.detalhes && <p className="text-neutral-600">{d.detalhes}</p>}
              <p className="text-xs text-neutral-400">{quando(d.criado_em)}</p>
            </div>
            <form action={resolverDenuncia} className="flex gap-2">
              <input type="hidden" name="id" value={d.id} />
              <button name="procedente" value="sim" className={`${botao} bg-red-700 text-white`}>Procede</button>
              <button name="procedente" value="nao" className={`${botao} border border-neutral-300 bg-white`}>Não procede</button>
            </form>
          </Cartao>
        ))}
      </div>
    </>
  );
}
