import Link from "next/link";
import { exigirTela } from "@/lib/admin/equipe";
import { quando, reais } from "@/lib/admin/formato";
import { LINK_ADMIN_ANUNCIOS } from "@/lib/rotas";
import { Aviso, Cartao, Titulo, estiloBotaoAprovar, estiloBotaoPerigo, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { decidirAnuncio, decidirPedido, resolverDenuncia, tirarFotoBanner } from "./actions";
import { BotaoDecisao } from "./botao-decisao";
import { BotaoTirarBanner } from "./botao-tirar-banner";
import { RadarModeracao } from "./radar-moderacao";
import { Badge } from "@/components/ui/badge";

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

export default async function ModeracaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; falha?: string; aviso?: string }>;
}) {
  const { erro, ok, falha, aviso } = await searchParams;
  // Administrador e moderador. Congelar é só do administrador (o banco também recusa).
  const { supabase, papel } = await exigirTela("moderacao");
  const podeCongelar = papel === "administrador";
  const [anunciosR, pedidosR, denunciasR, bannersR, iaR, iaAtivaR] = await Promise.all([
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
    supabase.from("moderacao_ia").select("anuncio_id, estado, motivo, concluido_em, criado_em").order("criado_em", { ascending: false }).limit(100),
    supabase.rpc("config", { p_chave: "moderacao.ia_ativa", p_microrregiao: null, p_padrao: false }),
  ]);
  const banners = bannersR.data ?? [];
  const anuncios = anunciosR.data ?? [];
  const pedidos = pedidosR.data ?? [];
  const denuncias = denunciasR.data ?? [];
  const idsEmAnalise = new Set([...anuncios.map((a) => a.id), ...pedidos.map((p) => p.id)]);
  const denunciasSoltas = denuncias.filter((d) => !idsEmAnalise.has(d.alvo_id)); // alvo ainda no ar
  const denunciasDe = (id: string) => denuncias.filter((d) => d.alvo_id === id);
  const analisesIA = iaR.data ?? [];
  const erroFila = anunciosR.error || pedidosR.error || denunciasR.error;
  const vazio = !erroFila && anuncios.length + pedidos.length + denunciasSoltas.length === 0;

  return (
    <>
      <Titulo sub="Anúncios entram no ar ao publicar. Termos sexuais ou violentos ficam para conferência da equipe. Denúncias e restrições continuam sendo revisadas. Aprovar devolve ao ar; recusar tira do ar; congelar é para Compliance Jurídico.">
        Moderação
      </Titulo>

      {papel === "administrador" && (
        <Link href={LINK_ADMIN_ANUNCIOS} className={`${estiloBotaoSec} mb-4`}>Ver todos os anúncios</Link>
      )}

      <Cartao className="mb-4 space-y-2 text-sm">
        <h2 className="font-semibold">Análise automática {iaAtivaR.data === true ? "ligada" : "desligada"}</h2>
        <p>A análise automática pode concluir pendências da regra anterior. Anúncios retidos por termos sexuais ou violentos aguardam a equipe. O orçamento da IA é compartilhado com o Aki e pode ser ajustado em Configurações.</p>
        {(iaR.error || iaAtivaR.error) && <p className="text-perigo">Não foi possível consultar a análise automática agora.</p>}
        {analisesIA.length > 0 && <details>
          <summary className="cursor-pointer font-semibold">Últimas análises</summary>
          <p className="mt-2 text-texto-suave">Este é o histórico de análises, incluindo anúncios já revisados pela equipe. Um anúncio pode aparecer mais de uma vez se foi alterado. As pendências atuais ficam abaixo.</p>
          <ul className="mt-2 space-y-2">
            {analisesIA.slice(0, 20).map((a, i) => <li key={`${a.anuncio_id}-${i}`}>
              <strong>{a.estado === "aprovado" ? "Aprovado pela IA" : a.estado === "manual" ? "Encaminhado para revisão manual" : a.estado === "obsoleto" ? "Anúncio alterado" : "Aguardando análise"}</strong>
              {" · "}{quando(a.concluido_em ?? a.criado_em)}{a.motivo && ` · ${a.motivo}`}
            </li>)}
          </ul>
        </details>}
      </Cartao>

      {(falha || aviso) && (
        <div className="mb-4">
          <Aviso tipo={falha ? "erro" : "ok"}>{falha ?? aviso}</Aviso>
        </div>
      )}

      {erroFila && <Aviso tipo="erro">Não foi possível carregar toda a fila. Recarregue a página para conferir as pendências.</Aviso>}
      {vazio && <Cartao className="text-sm text-texto-suave">Nada esperando revisão. Tudo em dia.</Cartao>}

      {anuncios.length > 0 && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">Anúncios em análise</h2>}
      <div className="space-y-4">
        {anuncios.map((a) => {
          const loja = Array.isArray(a.vitrines_lojas) ? a.vitrines_lojas[0] : a.vitrines_lojas;
          const dens = denunciasDe(a.id);
          const analise = analisesIA.find(ia => ia.anuncio_id === a.id);
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
                  <Badge variant="warning" className="mt-1 h-auto max-w-full py-0.5 whitespace-normal">{a.motivo_analise}</Badge>
                </div>
              </div>
              {a.descricao && <p className="mt-3 line-clamp-3 text-sm text-texto-suave">{a.descricao}</p>}
              {analise && <p className="mt-2 rounded-card bg-fundo p-3 text-sm">
                <strong>{analise.estado === "manual" ? "Exceção para a equipe:" : "Análise automática:"}</strong>{" "}
                {analise.motivo ?? "Aguardando conclusão. Você pode revisar manualmente a qualquer momento."}
              </p>}
              {dens.length > 0 && (
                <ul className="mt-3 space-y-1 text-legenda text-texto-suave">
                  {dens.map((d) => (
                    <li key={d.id}>
                      Denúncia · <strong>{MOTIVOS[d.motivo] ?? d.motivo}</strong> {d.detalhes && `· ${d.detalhes}`} · {quando(d.criado_em)}
                    </li>
                  ))}
                </ul>
              )}
              <form action={decidirAnuncio.bind(null, "")} className="mt-4 space-y-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="motivo" aria-label="Motivo da decisão sobre o anúncio" maxLength={300} placeholder={podeCongelar ? "Motivo (para recusar ou congelar)" : "Motivo (para recusar)"} className={estiloCampo} />
                <div className="flex flex-wrap gap-2">
                  <BotaoDecisao action={decidirAnuncio.bind(null, "aprovar")} className={estiloBotaoAprovar}>Aprovar</BotaoDecisao>
                  <BotaoDecisao action={decidirAnuncio.bind(null, "recusar")} className={estiloBotaoSec}>Recusar</BotaoDecisao>
                  {podeCongelar && (
                    <BotaoDecisao action={decidirAnuncio.bind(null, "congelar")} className={estiloBotaoPerigo}>Congelar (Compliance)</BotaoDecisao>
                  )}
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
            <Badge variant="warning" className="mt-1 h-auto max-w-full py-0.5 whitespace-normal">{p.motivo_analise}</Badge>
            {p.detalhes && <p className="mt-2 text-sm text-texto-suave">{p.detalhes}</p>}
            <form action={decidirPedido.bind(null, "")} className="mt-4 space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="motivo" aria-label="Motivo da decisão sobre o pedido" maxLength={300} placeholder="Motivo (para recusar)" className={estiloCampo} />
              <div className="flex gap-2">
                <BotaoDecisao action={decidirPedido.bind(null, "aprovar")} className={estiloBotaoAprovar}>Aprovar</BotaoDecisao>
                <BotaoDecisao action={decidirPedido.bind(null, "recusar")} className={estiloBotaoSec}>Recusar</BotaoDecisao>
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
                <strong>{MOTIVOS[d.motivo] ?? d.motivo}</strong> · {d.alvo_tipo} <span className="font-mono text-legenda text-texto-suave">{d.alvo_id.slice(0, 8)}</span>
              </p>
              {d.detalhes && <p className="text-texto-suave">{d.detalhes}</p>}
              <p className="text-legenda text-texto-suave">{quando(d.criado_em)}</p>
            </div>
            <form action={resolverDenuncia.bind(null, "")} className="flex gap-2">
              <input type="hidden" name="id" value={d.id} />
              <BotaoDecisao action={resolverDenuncia.bind(null, "sim")} className={estiloBotaoPerigo}>Procede</BotaoDecisao>
              <BotaoDecisao action={resolverDenuncia.bind(null, "nao")} className={estiloBotaoSec}>Não procede</BotaoDecisao>
            </form>
          </Cartao>
        ))}
      </div>
    </>
  );
}
