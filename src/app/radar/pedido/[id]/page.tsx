import { auth } from "@clerk/nextjs/server";
import { ConcluirAssistente } from "@/components/assistente/retomar";
import { tentativaAssistente } from "@/lib/assistente";
// /radar/pedido/[id]: o comprador vê o próprio pedido e compara as propostas.
// Só o dono abre esta tela (o banco devolve sou_comprador); para os outros é "não encontrado".
import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronLeft, Hourglass, MapPin, MessageCircle, RotateCcw, ShieldAlert, Store } from "lucide-react";
import { cidadesDoMeuPedido, indicacoesDoPedido, pedidoArquivado, pedidoRadar, propostasDoPedido } from "@/lib/dados/radar";
import { LINK_RADAR, linkPedidoRadarLoja, linkPedirRadar } from "@/lib/rotas";
import { linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import { CLASSE_TOM, dataHoraCurta, FOCO_LINK, faixaPreco, resumoPropostas, rotuloSituacao, textoPrecoProposta } from "@/components/radar/util";
import { TEXTO_VISIBILIDADE, diasParaVencer, mostrarPedirDeNovo, textoVencimento } from "@/components/radar/passos-pedido";
import { PropostasRecebidas } from "@/components/radar/propostas-recebidas";
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
  searchParams: Promise<{ novo?: string; estendido?: string; assistente?: string }>;
}) {
  const [{ id }, { novo, estendido, assistente }] = await Promise.all([params, searchParams]);
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
  const tentativa = novo === "1" && ["aberto", "em_analise"].includes(pedido.situacao) ? tentativaAssistente(assistente) : undefined;
  const { userId } = tentativa ? await auth() : { userId: null };
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6">
      {tentativa && userId && <ConcluirAssistente dono={userId} tentativa={tentativa} />}
      <Link href={`${LINK_RADAR}?aba=meus${arquivado ? "&arquivo=1" : ""}`} className={`inline-flex min-h-11 w-fit items-center gap-1 text-lg font-semibold text-laranja-escuro hover:underline ${FOCO_LINK}`}>
        <ChevronLeft className="size-5" aria-hidden />
        {arquivado ? "Arquivados" : "Meus pedidos"}
      </Link>

      {novo === "1" && ["aberto", "em_analise"].includes(pedido.situacao) &&
        (pedido.status === "em_analise" ? (
          <Alert variant="warning" role="status" className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold">Pedido recebido!</p>
              <p className="text-lg">A equipe vai revisar o pedido antes de mostrá-lo às lojas.</p>
            </div>
          </Alert>
        ) : (
          <Alert variant="success" role="status" className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold">Pedido no ar!</p>
              <p className="text-lg text-texto">
                {modoPrazo
                  ? "As propostas aparecem aqui e nas suas notificações."
                  : "As lojas da região já podem te chamar no WhatsApp."}
              </p>
            </div>
          </Alert>
        ))}

      {estendido === "1" && aberto && (
        <Alert variant="success" role="status" className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-lg text-texto">
            <strong>Pronto!</strong> Seu pedido fica no ar até {dataHoraCurta(pedido.expira_em)}.
          </p>
        </Alert>
      )}

      <section aria-labelledby="titulo-pedido" className="flex min-w-0 flex-col gap-2 rounded-card border border-borda bg-cartao p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
          <Badge variant={CLASSE_TOM[s.tom]}>{s.texto}</Badge>
          {arquivado && <Badge variant="secondary">Arquivado</Badge>}
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="[overflow-wrap:anywhere]">{pedido.area_texto || pedido.cidade}</span>
          </span>
          {pedido.categoria_nome && <span className="[overflow-wrap:anywhere]">· {pedido.categoria_nome}</span>}
        </div>
        <h1 id="titulo-pedido" className="text-3xl font-semibold text-beringela [overflow-wrap:anywhere]">{formatarNome(pedido.titulo)}</h1>
        {pedido.detalhes && <p className="text-lg whitespace-pre-line text-texto [overflow-wrap:anywhere]">{pedido.detalhes}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
          <p className="font-semibold text-beringela">{faixaPreco(pedido.preco_min_centavos, pedido.preco_max_centavos)}</p>
          {modoPrazo && pedido.propostas_ate && aberto && (
            <p className="inline-flex items-center gap-1.5 font-semibold text-laranja-escuro">
              <Hourglass className="size-4 shrink-0" aria-hidden />
              Propostas até {dataHoraCurta(pedido.propostas_ate)}
            </p>
          )}
          {!modoPrazo && !fechado && (
            <p className="inline-flex items-center gap-1.5 text-texto-suave">
              <MessageCircle className="size-4 shrink-0" aria-hidden />
              As lojas chamam você no WhatsApp.
            </p>
          )}
        </div>
        <details className="group">
          <summary className={`flex min-h-11 w-fit max-w-full cursor-pointer items-center gap-1.5 font-semibold text-texto-suave hover:underline md:min-h-9 ${FOCO_LINK}`}>
            <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
            <span>Quem vê: {visibilidade.titulo} · Mais detalhes</span>
          </summary>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pb-1 pl-5.5 text-lg text-texto-suave">
            <li className="[overflow-wrap:anywhere]">{visibilidade.ajuda}</li>
            {aberto && <li>{vencimento}</li>}
            <li>Publicado {tempoRelativo(pedido.criado_em)}</li>
          </ul>
        </details>
        {pedido.moderado_motivo && <p className="text-lg font-semibold text-aviso [overflow-wrap:anywhere]">Motivo da equipe: {pedido.moderado_motivo}</p>}
      </section>

      {fechado && (pedido.fechado_motivo === "resolvido" || pedido.fechado_motivo === "cancelado") && (
        <section role="status" className="flex items-start gap-3 rounded-card bg-fundo p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-verde-escuro" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">{pedido.fechado_motivo === "resolvido" ? "Que bom que deu certo!" : "Pedido cancelado"}</p>
            <p className="text-lg text-texto-suave">As lojas não veem mais este pedido.</p>
          </div>
        </section>
      )}

      {destaque && <DestaquePrazo pedidoId={pedido.id} propostas={lojas} vencimento={vencimento} />}

      {pedirDeNovo && (
        <section aria-labelledby="titulo-de-novo" className="flex flex-col gap-3 rounded-card bg-fundo p-4">
          <h2 id="titulo-de-novo" className="text-2xl font-semibold text-beringela">
            {fechado ? "Precisa de novo?" : "Este pedido não pode mais ser estendido"}
          </h2>
          <p className="text-lg text-texto">
            {fechado ? "Faça o mesmo pedido outra vez. O texto já vem preenchido." : `${vencimento}. Se ainda precisa, faça o mesmo pedido outra vez.`}
          </p>
          <Botao href={linkDeNovo} variante={destaque ? "secundario" : "primario"} icone={<RotateCcw />} tamanho="toque" className="self-start">
            Pedir de novo
          </Botao>
        </section>
      )}

      {pedido.situacao === "prazo_acabou" && (
        <section className="flex flex-col gap-1 rounded-card bg-fundo p-4 text-beringela">
          <p className="text-lg font-bold">O prazo acabou</p>
          <p className="text-lg">
            {propostas.length > 0 ? `${resumoPropostas(propostas.length, menor)}. Escolha uma e chame no WhatsApp.` : "Nenhuma loja mandou proposta desta vez."}
          </p>
        </section>
      )}

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
      <h2 id="titulo-indicacoes" className="text-2xl font-semibold text-beringela">Indicações</h2>
      <p className="text-lg text-texto-suave">Pessoas da região indicaram onde tem.</p>
      <ul className="flex flex-col gap-3">
        {lista.map((i) => (
          <li key={i.anuncio_id} className="flex gap-3 rounded-card border border-borda bg-cartao p-3">
            {i.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto do anúncio no Storage
              <img src={i.foto} alt="" width={64} height={64} className="size-16 shrink-0 rounded-campo bg-borda object-cover" />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-campo bg-selecao text-beringela" aria-hidden>
                <Store className="size-6" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={linkAnuncio(i.anuncio_id, i.titulo, null)} className={`min-h-11 content-center text-lg font-semibold [overflow-wrap:anywhere] text-laranja-escuro underline underline-offset-4 ${FOCO_LINK}`}>
                {formatarNome(i.titulo)}
              </Link>
              <span className="text-lg font-bold text-beringela">{i.preco_centavos != null ? preco(i.preco_centavos) : "Preço a combinar"}</span>
              <span className="text-lg text-texto-suave">{formatarNome(i.vitrine_nome)} · indicado {tempoRelativo(i.criado_em)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
