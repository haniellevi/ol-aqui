import Link from "next/link";
import { ChevronRight, Hourglass, MessageCircle, Radar, ShieldAlert, Star } from "lucide-react";
import { preco, tempoRelativo } from "@/lib/formato";
import { linkMeuPedidoRadar, linkPedidoRadarLoja } from "@/lib/rotas";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import type { MeuPedidoRadar, MinhaPropostaRadar } from "@/lib/tipos-radar";
import { CLASSE_TOM, dataHoraCurta, resumoPropostas, rotuloSituacao } from "./util";
import { Badge } from "@/components/ui/badge";

const CARTAO =
  "flex min-h-10 items-center gap-3 rounded-card border border-borda bg-cartao p-4 shadow-1 hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

// Aba "Meus pedidos": cada pedido com a situação, as propostas e o prazo.
export function ListaMeusPedidos({ pedidos, linkPedir, arquivados = false }: {
  pedidos: MeuPedidoRadar[];
  linkPedir: string;
  arquivados?: boolean;
}) {
  if (pedidos.length === 0) {
    return (
      <Vazio
        icone={<Radar />}
        titulo={arquivados ? "Nenhum pedido arquivado" : "Nenhum pedido nesta lista"}
        texto={arquivados ? "Os pedidos que você arquivar aparecem aqui com as ofertas recebidas." : "Diga o que você procura e as lojas da região mandam ofertas para você."}
      >
        {!arquivados && <Botao href={linkPedir} larguraTotal>Pedir no Radar</Botao>}
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
                <Badge variant={CLASSE_TOM[s.tom]}>{s.texto}</Badge>
                <span className="text-base leading-snug font-semibold break-words">{p.titulo}</span>
                <span className="text-base font-semibold text-laranja-escuro">{resumoPropostas(p.total_propostas, p.menor_preco_centavos)}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-legenda text-texto-suave">
                  {p.modo_contato === "propostas_prazo" && p.propostas_ate && p.situacao === "aberto" ? (
                    <span className="inline-flex items-center gap-1">
                      <Hourglass className="size-3.5" aria-hidden />
                      Propostas até {dataHoraCurta(p.propostas_ate)}
                    </span>
                  ) : p.modo_contato === "whatsapp_direto" && p.situacao === "aberto" ? (
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
                <Badge variant="destructive">
                  <ShieldAlert className="size-3.5" aria-hidden />
                  Tirada pela equipe{p.moderado_motivo ? `: ${p.moderado_motivo}` : ""}
                </Badge>
              ) : p.escolhida ? (
                <Badge variant="success">
                  <Star className="size-3.5" aria-hidden />
                  O comprador escolheu sua proposta
                </Badge>
              ) : (
                <Badge variant={CLASSE_TOM[p.situacao === "aberto" ? "ok" : "neutro"]}>
                  {p.situacao === "aberto" ? "Pedido no ar" : p.situacao === "prazo_acabou" ? "Prazo acabou" : "Pedido encerrado"}
                </Badge>
              )}
              <span className="text-base leading-snug font-semibold break-words">{p.pedido_titulo}</span>
              <span className="text-base font-semibold text-laranja-escuro">Sua oferta: {preco(p.preco_centavos)}</span>
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
