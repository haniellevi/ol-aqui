import Link from "next/link";
import { Plus, Radar } from "lucide-react";
import type { ReactNode } from "react";
import { linkPedirRadar } from "@/lib/rotas";

// Início: faixa fina logo acima dos anúncios, com as duas saídas de quem não achou o que queria
// (pedir no Radar) e de quem quer vender (anunciar). Substitui os dois cartões grandes:
// os anúncios ficam como o assunto principal. Sem laranja aqui: o "+ Anunciar" laranja já está
// no cabeçalho e na barra de baixo (um laranja por tela).

const ACAO =
  "olaki-toque flex min-h-11 min-w-0 items-center gap-2 px-3 py-1.5 hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro md:min-h-10";

function Acao({ href, icone, chamada, acao }: { href: string; icone: ReactNode; chamada: string; acao: string }) {
  return (
    <Link href={href} className={ACAO}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-4" aria-hidden>{icone}</span>
      <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1">
        <span className="line-clamp-2 text-legenda text-texto-suave sm:text-sm">{chamada}</span>
        <span className="line-clamp-2 text-sm font-semibold text-beringela">{acao}</span>
      </span>
    </Link>
  );
}

export function AcoesInicio({
  radar,
  venderPrimeiro = false,
}: {
  /** Textos do bloco do Radar no painel (chamada curta e botão). null = bloco desligado: só "Anunciar". */
  radar: { chamada: string; botao: string } | null;
  /** Segue a ordem dos blocos no painel ("recentes" antes de "radar"). */
  venderPrimeiro?: boolean;
}) {
  const pedir = radar && <li key="radar" className="min-w-0"><Acao href={linkPedirRadar()} icone={<Radar />} chamada={radar.chamada} acao={radar.botao} /></li>;
  const vender = <li key="vender" className="min-w-0"><Acao href="/anunciar" icone={<Plus />} chamada="Quer vender?" acao="Anunciar" /></li>;
  return (
    <nav aria-label="Pedir no Radar ou anunciar">
      <ul className={`grid divide-x divide-borda overflow-hidden rounded-card border border-borda bg-cartao ${radar ? "grid-cols-2" : ""}`}>
        {venderPrimeiro ? [vender, pedir] : [pedir, vender]}
      </ul>
    </nav>
  );
}
