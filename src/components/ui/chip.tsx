import Link from "next/link";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Chip de filtro/escolha. Selecionado = fundo laranja-claro, borda laranja-escuro (a laranja comum só tem 2,9:1 sobre branco)
// e um ✓, para o estado não depender só da cor. Altura 48px (área de toque).

const BASE =
  "inline-flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-campo border px-4 text-[15px] font-semibold " +
  "transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function classesChip(ativo = false, extra = "") {
  return `${BASE} ${ativo ? "border-laranja-escuro bg-laranja-claro text-beringela" : "border-borda bg-cartao text-beringela hover:bg-fundo active:bg-fundo"} ${extra}`.trim();
}

type Comum = { ativo?: boolean; icone?: ReactNode; className?: string; children: ReactNode };
type ComoBotao = Comum & Omit<ComponentProps<"button">, keyof Comum> & { href?: undefined };
type ComoLink = Comum & Omit<ComponentProps<typeof Link>, keyof Comum> & { href: ComponentProps<typeof Link>["href"] };

/** Com `href` é link (aria-current quando ativo); sem `href` é botão (aria-pressed). */
export function Chip(props: ComoBotao | ComoLink) {
  const { ativo = false, icone, className = "", children, ...resto } = props;
  const conteudo = (
    <>
      {ativo && <Check className="size-4 shrink-0" aria-hidden />}
      {icone && <span className="inline-flex [&>svg]:size-4" aria-hidden>{icone}</span>}
      {children}
    </>
  );
  if (resto.href !== undefined) {
    return (
      <Link {...(resto as Omit<ComoLink, keyof Comum>)} aria-current={ativo ? "true" : undefined} className={classesChip(ativo, className)}>
        {conteudo}
      </Link>
    );
  }
  const { type = "button", ...b } = resto as Omit<ComoBotao, keyof Comum>;
  return (
    <button {...b} type={type} aria-pressed={ativo} className={classesChip(ativo, className)}>
      {conteudo}
    </button>
  );
}
