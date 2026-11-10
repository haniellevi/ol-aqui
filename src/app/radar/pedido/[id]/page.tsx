// /radar/pedido/[id]: o comprador vê o próprio pedido e compara as propostas.
// Só o dono abre esta tela (o banco devolve sou_comprador); para os outros é "não encontrado".
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft, Hourglass, MessageCircle, ShieldAlert } from "lucide-react";
import { pedidoArquivado, pedidoRadar, propostasDoPedido } from "@/lib/dados/radar";
import { LINK_RADAR, linkPedidoRadarLoja, linkPedirRadar } from "@/lib/rotas";
import { tempoRelativo } from "@/lib/formato";
import { CLASSE_TOM, dataHoraCurta, faixaPreco, resumoPropostas, rotuloSituacao } from "@/components/radar/util";
import { PropostasRecebidas } from "@/components/radar/propostas-recebidas";
import { AtualizarRadar } from "@/components/radar/atualizar-radar";
import { AcoesPedido } from "@/components/radar/acoes-pedido";

export const metadata = { title: "Meu pedido no Radar" };

export default async function MeuPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const [{ id }, { novo }] = await Promise.all([params, searchParams]);
  const pedido = await pedidoRadar(id);
  if (!pedido) notFound();
  if (!pedido.sou_comprador) redirect(linkPedidoRadarLoja(id));

  const [propostas, arquivado] = await Promise.all([propostasDoPedido(id), pedidoArquivado(id)]);
  const s = rotuloSituacao(pedido.situacao, pedido.fechado_motivo);
  const fechado = pedido.situacao === "fechado";
  const menor = propostas.reduce<number | null>((m, p) => (p.preco_centavos != null && (m == null || p.preco_centavos < m) ? p.preco_centavos : m), null);
  const modoPrazo = pedido.modo_contato === "propostas_prazo";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Link href={`${LINK_RADAR}?aba=meus${arquivado ? "&arquivo=1" : ""}`} className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 px-2 text-base font-semibold text-laranja-escuro">
        <ChevronLeft className="size-5" aria-hidden />
        {arquivado ? "Arquivados" : "Meus pedidos"}
      </Link>

      {novo === "1" && ["aberto", "em_analise"].includes(pedido.situacao) &&
        (pedido.status === "em_analise" ? (
          <section role="status" className="flex items-start gap-3 rounded-card bg-aviso-fundo p-4 text-aviso">
            <ShieldAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold">Pedido recebido!</p>
              <p className="text-base">A equipe vai dar uma olhada antes de mostrar para as lojas. Você pode acompanhar a situação nesta página.</p>
            </div>
          </section>
        ) : (
          <section role="status" className="flex items-start gap-3 rounded-card bg-sucesso-fundo p-4 text-verde-escuro">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold">Pedido no ar!</p>
              <p className="text-base text-texto">
                {modoPrazo
                  ? "As lojas da região já podem mandar propostas. As novas ofertas aparecem aqui e nas notificações da sua conta."
                  : "As lojas da região já podem te chamar no WhatsApp."}
              </p>
            </div>
          </section>
        ))}

      <section className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex flex-wrap gap-2">
          <span className={`w-fit rounded-full px-2 py-0.5 text-[13px] font-semibold ${CLASSE_TOM[s.tom]}`}>{s.texto}</span>
          {arquivado && <span className="w-fit rounded-full bg-fundo px-2 py-0.5 text-[13px] font-semibold text-texto-suave">Arquivado</span>}
        </div>
        <h1 className="break-words text-xl font-bold leading-7">{pedido.titulo}</h1>
        {pedido.detalhes && <p className="whitespace-pre-line break-words text-base text-texto-suave">{pedido.detalhes}</p>}
        <p className="text-[15px] font-semibold">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-suave">
          {pedido.categoria_nome && <span>{pedido.categoria_nome} ·</span>}
          <span>{pedido.cidade} ·</span>
          <span>pedido {tempoRelativo(pedido.criado_em)}</span>
        </p>
        {modoPrazo && pedido.propostas_ate && pedido.situacao === "aberto" && (
          <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-laranja-escuro">
            <Hourglass className="size-4" aria-hidden />
            Propostas até {dataHoraCurta(pedido.propostas_ate)}
          </p>
        )}
        {!modoPrazo && !fechado && (
          <p className="inline-flex items-center gap-1.5 text-[15px] text-texto-suave">
            <MessageCircle className="size-4" aria-hidden />
            As lojas chamam você no WhatsApp.
          </p>
        )}
        {pedido.moderado_motivo && <p className="text-sm font-semibold text-aviso">Motivo da equipe: {pedido.moderado_motivo}</p>}
      </section>

      {fechado && (pedido.fechado_motivo === "resolvido" || pedido.fechado_motivo === "cancelado") && (
        <section role="status" className="flex items-start gap-3 rounded-card bg-fundo p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-verde-escuro" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">{pedido.fechado_motivo === "resolvido" ? "Que bom que deu certo!" : "Pedido cancelado"}</p>
            <p className="text-base text-texto-suave">
              As lojas não veem mais este pedido. Precisa de outra coisa?{" "}
              <Link href={linkPedirRadar()} className="font-semibold text-laranja-escuro underline">
                Fazer um pedido novo
              </Link>
            </p>
          </div>
        </section>
      )}

      {pedido.situacao === "prazo_acabou" && (
        <section className="flex flex-col gap-1 rounded-card bg-laranja-claro p-4 text-beringela">
          <p className="text-lg font-bold">O prazo acabou</p>
          <p className="text-base">
            {propostas.length > 0 ? `${resumoPropostas(propostas.length, menor)}. Escolha uma e chame no WhatsApp.` : "Nenhuma loja mandou proposta desta vez."}
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Ofertas recebidas</h2><AtualizarRadar /></div>
      <PropostasRecebidas propostas={propostas} podeEscolher={!["em_analise", "congelado"].includes(pedido.status) && !["cancelado", "moderacao"].includes(pedido.fechado_motivo ?? "")} modoPrazo={modoPrazo} />

      <AcoesPedido
        pedidoId={pedido.id}
        podeResolver={!fechado && pedido.status === "aberto"}
        podeCancelar={!fechado}
        podeArquivar={!["em_analise", "congelado"].includes(pedido.status)}
        arquivado={arquivado}
        aberto={pedido.situacao === "aberto"}
      />
    </main>
  );
}
