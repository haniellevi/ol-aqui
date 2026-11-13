import Link from "next/link";
import { ChevronRight, MessageSquare, Store, UserRound } from "lucide-react";
import { tempoRelativo } from "@/lib/formato";
import { dataHoraCurta } from "@/components/radar/util";
import { linkConversa } from "@/lib/rotas";
import type { ResumoConversa } from "@/lib/tipos-conversas";

// Lista de conversas (mesmo desenho das linhas de Notificações, mas cada linha só navega).
export function ListaConversas({ conversas }: { conversas: ResumoConversa[] }) {
  return <ul className="flex min-w-0 flex-col overflow-hidden rounded-card border border-borda bg-cartao">
    {conversas.map((c) => {
      const nova = c.nao_lidas > 0;
      const Icone = c.papel === "cliente" ? Store : UserRound;
      return <li key={c.id} className="border-b border-borda last:border-b-0">
        <Link href={linkConversa(c.id)}
          className={`flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro ${nova ? "bg-selecao/40" : ""}`}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fundo text-beringela"><Icone className="size-4" aria-hidden /></span>
          <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
            <span className={`min-w-0 break-words text-facil ${nova ? "font-semibold text-beringela" : ""}`}>
              {c.outro_nome}
              <span className="sr-only">{c.papel === "cliente" ? " (loja)" : " (cliente)"}</span>
            </span>
            <time className="text-legenda text-texto-suave" dateTime={c.ultima_em} title={dataHoraCurta(c.ultima_em)}>{tempoRelativo(c.ultima_em)}</time>
            <span className="col-span-2 line-clamp-1 min-w-0 text-base text-texto-suave">{c.ultima_texto ?? ""}</span>
            {(nova || c.bloqueada) && <span className="col-span-2 flex flex-wrap gap-2 text-legenda font-semibold">
              {nova && <span className="rounded-full bg-laranja-escuro px-2 text-white">{c.nao_lidas === 1 ? "1 nova" : `${c.nao_lidas} novas`}</span>}
              {c.bloqueada && <span className="rounded-full border border-borda px-2 text-texto-suave">Bloqueada</span>}
            </span>}
          </span>
          <ChevronRight className="size-4 shrink-0 text-texto-suave" aria-hidden />
        </Link>
      </li>;
    })}
  </ul>;
}

export const IconeVazioConversas = MessageSquare;
