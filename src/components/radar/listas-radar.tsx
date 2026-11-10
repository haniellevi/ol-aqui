import Link from "next/link";
import { ChevronRight, Hourglass, MessageCircle, Radar, ShieldAlert, Star } from "lucide-react";
import { preco, tempoRelativo } from "@/lib/formato";
import { linkMeuPedidoRadar, linkPedidoRadarLoja } from "@/lib/rotas";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import type { MeuPedidoRadar, MinhaPropostaRadar } from "@/lib/tipos-radar";
import { CLASSE_TOM, dataHoraCurta, resumoPropostas, rotuloSituacao } from "./util";

const CARTAO =
  "flex min-h-12 items-center gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1 hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

// Aba "Meus pedidos": cada pedido com a situação, as propostas e o prazo.
export function ListaMeusPedidos({ pedidos, linkPedir }: { pedidos: MeuPedidoRadar[]; linkPedir: string }) {
  if (pedidos.length === 0) {
    return (
      <Vazio
        icone={<Radar />}
        titulo="Você ainda não pediu nada"
        texto="Diga o que você procura e as lojas da região mandam ofertas para você."
      >
        <Botao href={linkPedir} larguraTotal>
          Pedir no Radar
        </Botao>
      </Vazio>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {pedidos.map((p) => {
        const s = rotuloSituacao(p.situacao, p.fechado_motivo);
        return (
          <li key={p.id}>
            <Link href={linkMeuPedidoRadar(p.id)} className={CARTAO}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`w-fit rounded-full px-2 py-0.5 text-legenda font-semibold ${CLASSE_TOM[s.tom]}`}>{s.texto}</span>
                <span className="break-words text-base font-semibold leading-snug">{p.titulo}</span>
                <span className="text-[15px] font-semibold text-laranja-escuro">{resumoPropostas(p.total_propostas, p.menor_preco_centavos)}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-legenda text-texto-suave">
                  {p.modo_contato === "propostas_prazo" && p.propostas_ate && p.situacao === "aberto" ? (
                    <span className="inline-flex items-center gap-1">
                      <Hourglass className="size-3.5" aria-hidden />
                      Propostas até {dataHoraCurta(p.propostas_ate)}
                    </span>
                  ) : p.modo_contato === "whatsapp_direto" ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" aria-hidden />
                      Lojas chamam no WhatsApp
                    </span>
                  ) : null}
                  <span>
                    {p.cidade} · {tempoRelativo(p.criado_em)}
                  </span>
                </span>
              </div>
              <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Aba "Minhas propostas" (loja): o que mandou, se foi escolhida e se a equipe tirou.
export function ListaMinhasPropostas({ propostas }: { propostas: MinhaPropostaRadar[] }) {
  if (propostas.length === 0) {
    return (
      <Vazio icone={<Radar />} titulo="Nenhuma proposta ainda" texto="Veja o que os compradores da região estão procurando e mande sua oferta.">
        <Botao href="/radar?aba=regiao" variante="secundario" larguraTotal>
          Ver pedidos na região
        </Botao>
      </Vazio>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {propostas.map((p) => (
        <li key={p.id}>
          <Link href={linkPedidoRadarLoja(p.pedido_id)} className={CARTAO}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {p.status === "oculta" ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-perigo-fundo px-2 py-0.5 text-legenda font-semibold text-perigo">
                  <ShieldAlert className="size-3.5" aria-hidden />
                  Tirada pela equipe{p.moderado_motivo ? `: ${p.moderado_motivo}` : ""}
                </span>
              ) : p.escolhida ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sucesso-fundo px-2 py-0.5 text-legenda font-semibold text-verde-escuro">
                  <Star className="size-3.5" aria-hidden />
                  O comprador escolheu sua proposta
                </span>
              ) : (
                <span className={`w-fit rounded-full px-2 py-0.5 text-legenda font-semibold ${CLASSE_TOM[p.situacao === "aberto" ? "ok" : "neutro"]}`}>
                  {p.situacao === "aberto" ? "Pedido no ar" : p.situacao === "prazo_acabou" ? "Prazo acabou" : "Pedido encerrado"}
                </span>
              )}
              <span className="break-words text-base font-semibold leading-snug">{p.pedido_titulo}</span>
              <span className="text-[15px] font-semibold text-laranja-escuro">Sua oferta: {preco(p.preco_centavos)}</span>
              <span className="text-legenda text-texto-suave">
                {p.pedido_cidade} · enviada {tempoRelativo(p.criado_em)}
              </span>
            </div>
            <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
