// /radar/pedido/[id]: o comprador vê o próprio pedido e compara as propostas.
// Só o dono abre esta tela (o banco devolve sou_comprador); para os outros é "não encontrado".
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, ChevronLeft, Eye, Hourglass, MapPin, MessageCircle, RotateCcw, ShieldAlert, Store } from "lucide-react";
import { cidadesDoMeuPedido, indicacoesDoPedido, pedidoArquivado, pedidoRadar, propostasDoPedido } from "@/lib/dados/radar";
import { LINK_RADAR, linkPedidoRadarLoja, linkPedirRadar } from "@/lib/rotas";
import { linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import { CLASSE_TOM, dataHoraCurta, faixaPreco, resumoPropostas, rotuloSituacao, textoPrecoProposta } from "@/components/radar/util";
import { TEXTO_VISIBILIDADE, diasParaVencer, mostrarPedirDeNovo, textoVencimento } from "@/components/radar/passos-pedido";
import { PropostasRecebidas } from "@/components/radar/propostas-recebidas";
import { AtualizarRadar } from "@/components/radar/atualizar-radar";
import { AcoesPedido, DestaquePrazo } from "@/components/radar/acoes-pedido";
import { Botao } from "@/components/ui/botao";
import type { IndicacaoRadar } from "@/lib/tipos-radar";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Meu pedido no Radar" };

export default async function MeuPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string; estendido?: string }>;
}) {
  const [{ id }, { novo, estendido }] = await Promise.all([params, searchParams]);
  const pedido = await pedidoRadar(id);
  if (!pedido) notFound();
  if (!pedido.sou_comprador) redirect(linkPedidoRadarLoja(id));

  // Indicações são extra: se a leitura falhar, a página abre sem elas.
  const [propostas, arquivado, indicacoes, cidadesPedido] = await Promise.all([
    propostasDoPedido(id),
    pedidoArquivado(id),
    indicacoesDoPedido(id).catch((): IndicacaoRadar[] => []),
    // Só serve para "Pedir de novo": se falhar, o novo pedido abre com a região toda.
    cidadesDoMeuPedido(id).catch((): string[] => []),
  ]);
  const s = rotuloSituacao(pedido.situacao, pedido.fechado_motivo);
  const fechado = pedido.situacao === "fechado";
  const menor = propostas.reduce<number | null>((m, p) => (p.preco_centavos != null && (m == null || p.preco_centavos < m) ? p.preco_centavos : m), null);
  const modoPrazo = pedido.modo_contato === "propostas_prazo";
  const aberto = pedido.situacao === "aberto";
  const podeResolver = !fechado && pedido.status === "aberto";
  const dias = diasParaVencer(pedido.expira_em, new Date().getTime());
  const vencimento = textoVencimento(dias);
  const destaque = podeResolver && pedido.pode_estender === true;
  const pedirDeNovo = mostrarPedirDeNovo({ ...pedido, diasRestantes: dias });
  // "Pedir de novo" leva o pedido inteiro para o formulário: texto, detalhes, categoria, preço, área e quem vê.
  const linkDeNovo = linkPedirRadar(pedido.titulo, {
    detalhes: pedido.detalhes,
    categoriaId: pedido.categoria_id,
    precoMin: textoPrecoProposta(pedido.preco_min_centavos),
    precoMax: textoPrecoProposta(pedido.preco_max_centavos),
    cidades: cidadesPedido,
    visibilidade: pedido.visibilidade ?? null,
  });
  const lojas = propostas.filter((p) => p.status === "ativa").map((p) => ({ propostaId: p.id, lojaNome: p.loja_nome }));
  const visibilidade = TEXTO_VISIBILIDADE[pedido.visibilidade ?? "lojas"];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Link href={`${LINK_RADAR}?aba=meus${arquivado ? "&arquivo=1" : ""}`} className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 px-2 text-facil font-semibold text-laranja-escuro">
        <ChevronLeft className="size-5" aria-hidden />
        {arquivado ? "Arquivados" : "Meus pedidos"}
      </Link>

      {novo === "1" && ["aberto", "em_analise"].includes(pedido.situacao) &&
        (pedido.status === "em_analise" ? (
          <Alert variant="warning" role="status" className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-facil font-bold">Pedido recebido!</p>
              <p className="text-facil">A equipe vai dar uma olhada antes de mostrar para as lojas. Você pode acompanhar a situação nesta página.</p>
            </div>
          </Alert>
        ) : (
          <Alert variant="success" role="status" className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-facil font-bold">Pedido no ar!</p>
              <p className="text-facil text-texto">
                {modoPrazo
                  ? "As lojas da região já podem mandar propostas. As novas ofertas aparecem aqui e nas notificações da sua conta."
                  : "As lojas da região já podem te chamar no WhatsApp."}
              </p>
            </div>
          </Alert>
        ))}

      {estendido === "1" && aberto && (
        <Alert variant="success" role="status" className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
          <p className="text-facil text-texto">
            <strong>Pronto!</strong> Seu pedido fica no ar até {dataHoraCurta(pedido.expira_em)}.
          </p>
        </Alert>
      )}

      <section className="flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1">
        <div className="flex flex-wrap gap-2">
          <Badge variant={CLASSE_TOM[s.tom]}>{s.texto}</Badge>
          {arquivado && <Badge variant="secondary">Arquivado</Badge>}
        </div>
        <h1 className="text-facil-titulo font-bold break-words">{pedido.titulo}</h1>
        {pedido.detalhes && <p className="text-facil break-words whitespace-pre-line text-texto-suave">{pedido.detalhes}</p>}
        <p className="text-facil font-semibold">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
        <p className="flex items-start gap-2 text-facil">
          <MapPin className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <span><span className="font-semibold">Onde:</span> {pedido.area_texto || pedido.cidade}</span>
        </p>
        <p className="flex items-start gap-2 text-facil">
          <Eye className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <span><span className="font-semibold">Quem vê:</span> {visibilidade.titulo}. {visibilidade.ajuda}</span>
        </p>
        {aberto && (
          <p className="flex items-center gap-2 text-facil font-semibold text-beringela">
            <CalendarClock className="size-5 shrink-0" aria-hidden />
            {vencimento}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-facil text-texto-suave">
          {pedido.categoria_nome && <span>{pedido.categoria_nome} ·</span>}
          <span>pedido {tempoRelativo(pedido.criado_em)}</span>
        </p>
        {modoPrazo && pedido.propostas_ate && pedido.situacao === "aberto" && (
          <p className="inline-flex items-center gap-2 text-facil font-semibold text-laranja-escuro">
            <Hourglass className="size-5" aria-hidden />
            Propostas até {dataHoraCurta(pedido.propostas_ate)}
          </p>
        )}
        {!modoPrazo && !fechado && (
          <p className="inline-flex items-center gap-2 text-facil text-texto-suave">
            <MessageCircle className="size-5" aria-hidden />
            As lojas chamam você no WhatsApp.
          </p>
        )}
        {pedido.moderado_motivo && <p className="text-facil font-semibold text-aviso">Motivo da equipe: {pedido.moderado_motivo}</p>}
      </section>

      {fechado && (pedido.fechado_motivo === "resolvido" || pedido.fechado_motivo === "cancelado") && (
        <section role="status" className="flex items-start gap-3 rounded-card bg-fundo p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-verde-escuro" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-facil font-bold">{pedido.fechado_motivo === "resolvido" ? "Que bom que deu certo!" : "Pedido cancelado"}</p>
            <p className="text-facil text-texto-suave">As lojas não veem mais este pedido.</p>
          </div>
        </section>
      )}

      {destaque && <DestaquePrazo pedidoId={pedido.id} propostas={lojas} vencimento={vencimento} />}

      {pedirDeNovo && (
        <section aria-labelledby="titulo-de-novo" className="flex flex-col gap-3 rounded-card bg-fundo p-4">
          <h2 id="titulo-de-novo" className="text-3xl font-semibold text-beringela">
            {fechado ? "Precisa de novo?" : "Este pedido não pode mais ser estendido"}
          </h2>
          <p className="text-facil text-texto">
            {fechado ? "Faça o mesmo pedido outra vez. O texto já vem preenchido." : `${vencimento}. Se ainda precisa, faça o mesmo pedido outra vez.`}
          </p>
          <Botao href={linkDeNovo} variante={destaque ? "secundario" : "primario"} larguraTotal icone={<RotateCcw />} tamanho="grande">
            Pedir de novo
          </Botao>
        </section>
      )}

      {pedido.situacao === "prazo_acabou" && (
        <section className="flex flex-col gap-1 rounded-card bg-fundo p-4 text-beringela">
          <p className="text-facil font-bold">O prazo acabou</p>
          <p className="text-facil">
            {propostas.length > 0 ? `${resumoPropostas(propostas.length, menor)}. Escolha uma e chame no WhatsApp.` : "Nenhuma loja mandou proposta desta vez."}
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-3xl font-bold">Ofertas recebidas</h2><AtualizarRadar tamanho="grande" /></div>
      <PropostasRecebidas propostas={propostas} podeEscolher={!["em_analise", "congelado"].includes(pedido.status) && !["cancelado", "moderacao"].includes(pedido.fechado_motivo ?? "")} modoPrazo={modoPrazo} />

      {indicacoes.length > 0 && <Indicacoes lista={indicacoes} />}

      <AcoesPedido
        pedidoId={pedido.id}
        podeResolver={podeResolver && !destaque}
        propostas={lojas}
        podeCancelar={!fechado}
        podeArquivar={!["em_analise", "congelado"].includes(pedido.status)}
        arquivado={arquivado}
        aberto={aberto}
      />
    </main>
  );
}

/** "Eu sei onde tem": anúncios que pessoas da região indicaram (sem dizer quem indicou). */
function Indicacoes({ lista }: { lista: IndicacaoRadar[] }) {
  return (
    <section aria-labelledby="titulo-indicacoes" className="flex flex-col gap-3">
      <h2 id="titulo-indicacoes" className="text-3xl font-bold">Indicações</h2>
      <p className="text-facil text-texto-suave">Pessoas da região indicaram onde tem.</p>
      <ul className="flex flex-col gap-3">
        {lista.map((i) => (
          <li key={i.anuncio_id} className="flex gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1">
            {i.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto do anúncio no Storage
              <img src={i.foto} alt="" width={80} height={80} className="size-20 shrink-0 rounded-campo bg-borda object-cover" />
            ) : (
              <span className="grid size-20 shrink-0 place-items-center rounded-campo bg-selecao text-beringela" aria-hidden>
                <Store className="size-6" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={linkAnuncio(i.anuncio_id, i.titulo, null)} className="min-h-12 content-center text-facil font-semibold break-words text-laranja-escuro underline underline-offset-4">
                {i.titulo}
              </Link>
              <span className="text-facil font-bold text-beringela">{i.preco_centavos != null ? preco(i.preco_centavos) : "Preço a combinar"}</span>
              <span className="text-facil text-texto-suave">{i.vitrine_nome} · indicado {tempoRelativo(i.criado_em)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
