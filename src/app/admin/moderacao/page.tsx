import { exigirAdmin } from "@/lib/admin/auth";
import { quando, reais } from "@/lib/admin/formato";
import { Cartao, Titulo, estiloBotaoAprovar, estiloBotaoPerigo, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { decidirAnuncio, decidirPedido, resolverDenuncia, tirarFotoBanner } from "./actions";
import { BotaoTirarBanner } from "./botao-tirar-banner";
import { RadarModeracao } from "./radar-moderacao";

export const metadata = { title: "Moderação" };

// Banners com foto da fachada mais recentes (para a equipe conferir). Só a lista da tela: a regra
// de quem pode tirar a foto e o histórico ficam no banco (moderar_banner_vitrine + logs_atividade).
const BANNERS_NA_TELA = 30;

const MOTIVOS: Record<string, string> = {
  golpe: "Golpe",
  proibido: "Item proibido",
  falso: "Anúncio falso",
  ofensivo: "Ofensivo",
  duplicado: "Duplicado",
  outro: "Outro",
};

export default async function ModeracaoPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const { supabase } = await exigirAdmin();
  const [anunciosR, pedidosR, denunciasR, bannersR] = await Promise.all([
    supabase
      .from("anuncios")
      .select("id, titulo, descricao, preco_centavos, categoria, cidade, fotos, motivo_analise, criado_em, vitrines_lojas(nome, slug)")
      .eq("status", "em_analise")
      .order("criado_em"),
    supabase.from("radar_pedidos").select("id, titulo, detalhes, cidade, motivo_analise, criado_em").eq("status", "em_analise").order("criado_em"),
    supabase.from("denuncias").select("id, alvo_tipo, alvo_id, motivo, detalhes, criado_em").eq("status", "aberta").order("criado_em"),
    supabase
      .from("vitrines_lojas")
      .select("id, nome, slug, cidade, banner_url, atualizado_em")
      .eq("banner_tipo", "foto")
      .not("banner_url", "is", null)
      .order("atualizado_em", { ascending: false })
      .limit(BANNERS_NA_TELA),
  ]);
  const banners = bannersR.data ?? [];
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

      {vazio && <Cartao className="text-sm text-texto-suave">Nada esperando revisão. Tudo em dia.</Cartao>}

      {anuncios.length > 0 && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">Anúncios em análise</h2>}
      <div className="space-y-4">
        {anuncios.map((a) => {
          const loja = Array.isArray(a.vitrines_lojas) ? a.vitrines_lojas[0] : a.vitrines_lojas;
          const dens = denunciasDe(a.id);
          return (
            <Cartao key={a.id}>
              <div className="flex gap-3">
                {a.fotos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.fotos[0]} alt="" className="size-20 shrink-0 rounded-card object-cover" />
                ) : (
                  <div className="size-20 shrink-0 rounded-card bg-fundo" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-beringela">{a.titulo}</p>
                  <p className="text-sm text-texto-suave">
                    {a.preco_centavos != null ? reais(a.preco_centavos) : "A combinar"} · {a.cidade} · {loja?.nome ?? "—"}
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-aviso-fundo px-2 py-0.5 text-[13px] font-semibold text-aviso">{a.motivo_analise}</p>
                </div>
              </div>
              {a.descricao && <p className="mt-3 line-clamp-3 text-sm text-texto-suave">{a.descricao}</p>}
              {dens.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px] text-texto-suave">
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
                  <button name="decisao" value="aprovar" className={estiloBotaoAprovar}>Aprovar</button>
                  <button name="decisao" value="recusar" className={estiloBotaoSec}>Recusar</button>
                  <button name="decisao" value="congelar" className={estiloBotaoPerigo}>Congelar (Compliance)</button>
                </div>
              </form>
            </Cartao>
          );
        })}
      </div>

      {pedidos.length > 0 && <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Pedidos do Radar em análise</h2>}
      <div className="space-y-4">
        {pedidos.map((p) => (
          <Cartao key={p.id}>
            <p className="font-semibold text-beringela">{p.titulo}</p>
            <p className="text-sm text-texto-suave">{p.cidade} · {quando(p.criado_em)}</p>
            <p className="mt-1 inline-block rounded-full bg-aviso-fundo px-2 py-0.5 text-[13px] font-semibold text-aviso">{p.motivo_analise}</p>
            {p.detalhes && <p className="mt-2 text-sm text-texto-suave">{p.detalhes}</p>}
            <form action={decidirPedido} className="mt-4 space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="motivo" placeholder="Motivo (para recusar)" className={estiloCampo} />
              <div className="flex gap-2">
                <button name="decisao" value="aprovar" className={estiloBotaoAprovar}>Aprovar</button>
                <button name="decisao" value="recusar" className={estiloBotaoSec}>Recusar</button>
              </div>
            </form>
          </Cartao>
        ))}
      </div>

      <RadarModeracao erro={erro} ok={ok} />

      {banners.length > 0 && (
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Fotos de banner das lojas (mais novas)</h2>
      )}
      <div className="space-y-4">
        {banners.map((b) => (
          <Cartao key={b.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.banner_url ?? ""} alt={`Banner de ${b.nome}`} className="aspect-[3/1] w-full rounded-card object-cover" />
            <p className="mt-2 font-semibold text-beringela">
              <a href={`/loja/${b.slug}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {b.nome}
              </a>
            </p>
            <p className="text-sm text-texto-suave">
              {b.cidade} · {quando(b.atualizado_em)}
            </p>
            <form action={tirarFotoBanner} className="mt-4 space-y-2">
              <input type="hidden" name="id" value={b.id} />
              <input name="motivo" maxLength={300} placeholder="Motivo (o dono da loja vê)" className={estiloCampo} />
              <BotaoTirarBanner />
            </form>
          </Cartao>
        ))}
      </div>

      {denunciasSoltas.length > 0 && (
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Denúncias de itens ainda no ar</h2>
      )}
      <div className="space-y-3">
        {denunciasSoltas.map((d) => (
          <Cartao key={d.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm text-beringela">
              <p>
                <strong>{MOTIVOS[d.motivo] ?? d.motivo}</strong> · {d.alvo_tipo} <span className="font-mono text-[13px] text-texto-suave">{d.alvo_id.slice(0, 8)}</span>
              </p>
              {d.detalhes && <p className="text-texto-suave">{d.detalhes}</p>}
              <p className="text-[13px] text-texto-suave">{quando(d.criado_em)}</p>
            </div>
            <form action={resolverDenuncia} className="flex gap-2">
              <input type="hidden" name="id" value={d.id} />
              <button name="procedente" value="sim" className={estiloBotaoPerigo}>Procede</button>
              <button name="procedente" value="nao" className={estiloBotaoSec}>Não procede</button>
            </form>
          </Cartao>
        ))}
      </div>
    </>
  );
}
