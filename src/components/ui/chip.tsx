import Link from "next/link";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Chip de filtro/escolha. Selecionado = fundo lavanda, borda beringela e um ✓.
// Área de toque 44px; com mouse, 40px.

// grande = Modo fácil do Radar: 48px e letra 18px em qualquer tela.

const BASE =
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-campo border font-semibold " +
  "transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";
const TAMANHOS = {
  normal: "olaki-controle min-h-10 px-3 text-rotulo",
  grande: "min-h-12 px-4 text-facil",
} as const;
export type TamanhoChip = keyof typeof TAMANHOS;

export function classesChip(ativo = false, extra = "", tamanho: TamanhoChip = "normal") {
  return `${BASE} ${TAMANHOS[tamanho]} ${ativo ? "border-beringela bg-selecao text-beringela" : "border-borda-campo bg-cartao text-beringela hover:bg-fundo active:bg-fundo"} ${extra}`.trim();
}

type Comum = { ativo?: boolean; icone?: ReactNode; tamanho?: TamanhoChip; className?: string; children: ReactNode };
type ComoBotao = Comum & Omit<ComponentProps<"button">, keyof Comum> & { href?: undefined };
type ComoLink = Comum & Omit<ComponentProps<typeof Link>, keyof Comum> & { href: ComponentProps<typeof Link>["href"] };

/** Com `href` é link (aria-current quando ativo); sem `href` é botão (aria-pressed). */
export function Chip(props: ComoBotao | ComoLink) {
  const { ativo = false, icone, tamanho = "normal", className = "", children, ...resto } = props;
  const conteudo = (
    <>
      {ativo && <Check className="size-4 shrink-0" aria-hidden />}
      {icone && <span className="inline-flex [&>svg]:size-4" aria-hidden>{icone}</span>}
      {children}
    </>
  );
  if (resto.href !== undefined) {
    return (
      <Link {...(resto as Omit<ComoLink, keyof Comum>)} aria-current={ativo ? "true" : undefined} className={classesChip(ativo, className, tamanho)}>
        {conteudo}
      </Link>
    );
  }
  const { type = "button", ...b } = resto as Omit<ComoBotao, keyof Comum>;
  return (
    <button {...b} type={type} aria-pressed={ativo} className={classesChip(ativo, className, tamanho)}>
      {conteudo}
    </button>
  );
}
