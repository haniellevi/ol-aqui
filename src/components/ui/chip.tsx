import Link from "next/link";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { toggleVariants } from "@/components/ui/toggle-variants";
import { cn } from "@/lib/utils";

// Chip de filtro/escolha: casca do Toggle oficial (estilos em toggle-variants.ts, DESIGN.md seção 9).
// Selecionado = fundo `selecao`, borda beringela e um ✓. Área de toque 44px; com mouse, 36px.
export type TamanhoChip = "normal" | "toque" | "grande";

export function classesChip(ativo = false, extra = "", tamanho: TamanhoChip = "normal") {
  return cn(toggleVariants({ variant: ativo ? "chipAtivo" : "chip", size: tamanho }), extra);
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
      {icone && <span className="inline-flex shrink-0 [&>svg]:size-4" aria-hidden>{icone}</span>}
      {tamanho === "toque" ? <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span> : children}
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
