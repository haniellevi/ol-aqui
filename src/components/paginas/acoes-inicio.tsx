import Link from "next/link";
import { ChevronRight, Plus, Radar } from "lucide-react";
import type { ReactNode } from "react";
import { linkPedirRadar } from "@/lib/rotas";

const ACAO =
  "olaki-toque flex h-full min-h-14 min-w-0 items-center gap-2 rounded-card border px-2.5 py-2 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro md:gap-3 md:px-4";

function Acao({ href, icone, chamada, acao, principal = false }: { href: string; icone: ReactNode; chamada: string; acao: string; principal?: boolean }) {
  return (
    <Link href={href} className={`${ACAO} ${principal ? "border-laranja bg-laranja text-beringela hover:brightness-95" : "border-beringela bg-beringela text-cartao hover:brightness-110"}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-campo [&>svg]:size-4 md:size-9 ${principal ? "bg-cartao/55" : "bg-cartao/15"}`} aria-hidden>{icone}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-4 font-bold [overflow-wrap:anywhere] md:text-base md:leading-5">{acao}</span>
        <span className="line-clamp-2 text-xs leading-4">{chamada}</span>
      </span>
      <ChevronRight className="hidden size-4 shrink-0 min-[390px]:block" aria-hidden />
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
  const vender = <li key="vender" className="min-w-0"><Acao href="/anunciar" icone={<Plus />} chamada="Quer vender?" acao="Anunciar" principal /></li>;
  return (
    <nav aria-label="Pedir no Radar ou anunciar">
      <ul className={`grid gap-2 ${radar ? "min-[350px]:grid-cols-2" : ""}`}>
        {venderPrimeiro ? [vender, pedir] : [pedir, vender]}
      </ul>
    </nav>
  );
}
