import Link from "next/link";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Chip de filtro/escolha. Selecionado = fundo lavanda, borda beringela e um ✓.
// Área de toque 44px; com mouse, 40px.

const BASE =
  "olaki-controle inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-campo border px-3 text-rotulo font-semibold " +
  "transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function classesChip(ativo = false, extra = "") {
  return `${BASE} ${ativo ? "border-beringela bg-selecao text-beringela" : "border-borda-campo bg-cartao text-beringela hover:bg-fundo active:bg-fundo"} ${extra}`.trim();
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
