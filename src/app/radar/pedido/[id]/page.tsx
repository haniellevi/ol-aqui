import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, Hourglass, ImageOff, Inbox, MapPin, MessageCircle, PartyPopper, Radar, Store } from "lucide-react";
import { meuPedido, propostasDoPedido, type MeuPedido, type PropostaRecebida } from "@/lib/dados/radar";
import { linkAnuncio, linkLoja, preco, precoFalado, tempoRelativo } from "@/lib/formato";
import { CATEGORIAS_PEDIDO, URGENCIAS, diaEHora, situacaoPedido } from "@/lib/radar";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { BotaoChamarLoja, FecharPedido } from "@/components/radar/acoes-pedido";
import { Botao } from "@/components/ui/botao";

export const metadata: Metadata = { title: "Meu pedido no Radar", robots: { index: false } };

// T28 · Meu pedido e propostas recebidas. Só o dono vê (RLS de radar_pedidos e radar_propostas).
// Ofertas da mais barata para a mais cara; cada uma com "Chamar no WhatsApp" da loja.
export default async function PaginaMeuPedido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const [{ id }, { novo }] = await Promise.all([params, searchParams]);
  const pedido = await meuPedido(id);
  if (!pedido) notFound();
  const propostas = await propostasDoPedido(pedido.id);
  const s = situacaoPedido(pedido);
  const prazoAberto = pedido.modo_contato === "propostas_prazo" && s.aberto;

  return (
    <PaginaConta>
      <TopoConta titulo="Meu pedido" voltar="/radar?aba=meus" textoVoltar="Meus pedidos" />

      {novo === "1" &&
        (pedido.status === "em_analise" ? (
          <Aviso tipo="atencao">
            <span>Seu pedido está em análise. A equipe do OLAKI confere e ele entra no Radar logo.</span>
          </Aviso>
        ) : (
          <div role="status" className="flex items-start gap-3 rounded-card bg-laranja-claro p-4">
            <PartyPopper className="mt-0.5 size-6 shrink-0 text-laranja-escuro" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-beringela">Pedido no ar!</p>
              <p className="text-base">
                {pedido.modo_contato === "whatsapp_direto"
                  ? "As lojas da região já podem ver e te chamar no WhatsApp."
                  : "As lojas da região já podem ver. As ofertas aparecem aqui embaixo."}
              </p>
            </div>
          </div>
        ))}

      <ResumoPedido pedido={pedido} />

      {pedido.status === "em_analise" && novo !== "1" && (
        <Aviso tipo="atencao">
          <span>Seu pedido está em análise. A equipe do OLAKI confere e ele entra no Radar logo.</span>
        </Aviso>
      )}

      <section aria-labelledby="titulo-ofertas" className="flex flex-col gap-3">
        <h2 id="titulo-ofertas" className="text-lg font-bold">
          {propostas.length === 0
            ? "Ofertas"
            : propostas.length === 1
              ? "1 loja respondeu"
              : `${propostas.length} lojas responderam`}
        </h2>

        {pedido.modo_contato === "whatsapp_direto" && propostas.length > 0 && (
          <p className="text-base text-texto-suave">Estas lojas viram seu pedido e podem te chamar no WhatsApp. Você também pode chamar primeiro.</p>
        )}
        {prazoAberto && pedido.propostas_ate && (
          <p className="flex items-center gap-2 text-base text-texto-suave">
            <Hourglass className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
            Ofertas chegam até {diaEHora(pedido.propostas_ate)}. Pode escolher antes, se quiser.
          </p>
        )}

        {propostas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-card bg-cartao p-6 text-center shadow-1">
            <span className="grid size-14 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
              <Inbox className="size-7" />
            </span>
            <p className="text-base font-semibold">{s.aberto ? "Nenhuma oferta ainda." : "Nenhuma loja respondeu a este pedido."}</p>
            <p className="max-w-sm text-[15px] text-texto-suave">
              {s.aberto
                ? pedido.modo_contato === "whatsapp_direto"
                  ? "Quando uma loja tiver o que você quer, ela te chama no WhatsApp e aparece aqui."
                  : "Avisamos quando chegar oferta. Ela aparece aqui."
                : "Você pode fazer um pedido novo, com outras palavras ou um preço diferente."}
            </p>
            {!s.aberto && (
              <Botao href={`/radar/pedir?pedido=${encodeURIComponent(pedido.titulo)}`} larguraTotal className="mt-2 max-w-sm" icone={<Radar />}>
                Pedir de novo
              </Botao>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {propostas.map((p, i) => (
              <li key={p.id}>
                <CartaoProposta proposta={p} maisBarata={i === 0 && propostas.length > 1 && p.preco_centavos != null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pedido.status === "aberto" && <FecharPedido pedidoId={pedido.id} />}
    </PaginaConta>
  );
}

function ResumoPedido({ pedido: p }: { pedido: MeuPedido }) {
  const s = situacaoPedido(p);
  const categoria = CATEGORIAS_PEDIDO.find((c) => c.valor === p.categoria)?.rotulo;
  const urgencia = URGENCIAS.find((u) => u.valor === p.urgencia)?.rotulo;
  return (
    <section aria-label="Seu pedido" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${s.cor}`}>{s.texto}</span>
        {categoria && <span className="text-[13px] font-semibold text-texto-suave">{categoria}</span>}
      </div>
      <p className="text-xl font-bold leading-7 text-beringela">{p.titulo}</p>
      {p.detalhes && <p className="whitespace-pre-line text-base text-texto">{p.detalhes}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        <div>
          <dt className="text-texto-suave">Até quanto</dt>
          <dd className="font-semibold">{p.preco_max_centavos != null ? precoFalado(p.preco_max_centavos) : "Não disse"}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Para quando</dt>
          <dd className="font-semibold">{urgencia}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Cidade</dt>
          <dd className="flex items-center gap-1 font-semibold">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {p.cidade}
          </dd>
        </div>
        <div>
          <dt className="text-texto-suave">Como falam com você</dt>
          <dd className="flex items-center gap-1 font-semibold">
            {p.modo_contato === "whatsapp_direto" ? (
              <>
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                WhatsApp
              </>
            ) : (
              <>
                <Inbox className="size-4 shrink-0" aria-hidden />
                Ofertas aqui
              </>
            )}
          </dd>
        </div>
      </dl>
      <p className="flex items-center gap-1.5 text-sm text-texto-suave">
        <Clock className="size-4 shrink-0" aria-hidden />
        Pedido {tempoRelativo(p.criado_em)}
        {s.aberto && <> · fica no ar até {diaEHora(p.expira_em)}</>}
      </p>
    </section>
  );
}

function CartaoProposta({ proposta: p, maisBarata }: { proposta: PropostaRecebida; maisBarata: boolean }) {
  const foto = p.foto_url;
  return (
    <article className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      <header className="flex items-center gap-3">
        {p.loja?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo do Storage, leve no 3G
          <img src={p.loja.logo_url} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full bg-borda object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela" aria-hidden>
            <Store className="size-6" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {p.loja ? (
            <Link href={linkLoja(p.loja.slug)} className="truncate text-base font-semibold text-beringela underline-offset-4 hover:underline">
              {p.loja.nome}
            </Link>
          ) : (
            <span className="text-base font-semibold">Loja</span>
          )}
          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-texto-suave">
            {p.loja?.selo && (
              <span className="inline-flex items-center gap-1 font-semibold text-verde-escuro">
                <BadgeCheck className="size-4" aria-hidden />
                Loja verificada
              </span>
            )}
            {p.loja?.cidade && <span>{p.loja.cidade}</span>}
            <span>{tempoRelativo(p.criado_em)}</span>
          </span>
        </div>
      </header>

      <div className="flex gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do Storage, leve no 3G
          <img
            src={foto}
            alt={p.anuncio ? `Foto de ${p.anuncio.titulo}` : "Foto da oferta"}
            width={96}
            height={72}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-24 shrink-0 rounded-campo bg-borda object-cover"
          />
        ) : p.anuncio ? (
          <span className="grid aspect-[4/3] w-24 shrink-0 place-items-center rounded-campo bg-borda text-texto-suave" aria-label="Sem foto">
            <ImageOff className="size-6" aria-hidden />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xl font-bold text-beringela">
            {p.preco_centavos != null ? preco(p.preco_centavos) : "Preço a combinar"}
          </p>
          {maisBarata && (
            <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-[13px] font-bold text-verde-escuro">Menor preço</span>
          )}
          {p.anuncio && (
            <Link href={linkAnuncio(p.anuncio.id, p.anuncio.titulo)} className="line-clamp-2 text-[15px] font-semibold underline underline-offset-4">
              {p.anuncio.titulo}
            </Link>
          )}
        </div>
      </div>

      {p.mensagem && <p className="whitespace-pre-line rounded-campo bg-fundo p-3 text-base">“{p.mensagem}”</p>}

      <BotaoChamarLoja propostaId={p.id} escolhida={p.escolhida} />
    </article>
  );
}
