import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

// Casca em português do botão oficial (DESIGN.md, seção 9): mesma API de sempre, sem estilo próprio.
// Todo estilo mora em button-variants.ts. Com `href` vira link; sem `href` é <button>.
// Largura total só no celular: do tablet para cima o botão para em 320px.

export type VarianteBotao = "primario" | "secundario" | "perigo" | "whatsapp" | "texto";
export type TamanhoBotao = "normal" | "pequeno" | "toque" | "acao" | "grande";

type Comum = {
  variante?: VarianteBotao;
  /** Largura cheia no celular; do tablet para cima, no máximo 320px. */
  larguraTotal?: boolean;
  /** "toque" garante 44 × 44 px; "acao" dá 48 px (ação principal e WhatsApp); "grande" usa a régua do Modo fácil. */
  tamanho?: TamanhoBotao;
  /** Mostra a bolinha girando, troca o texto e trava o botão (evita toque duplo). */
  carregando?: boolean;
  /** Texto enquanto carrega, ex.: "Publicando...". */
  textoCarregando?: string;
  /** Ícone antes do texto (lucide, 20px). */
  icone?: ReactNode;
  className?: string;
  children: ReactNode;
};

type ComoBotao = Comum & Omit<ComponentProps<"button">, keyof Comum> & { href?: undefined };
type ComoLink = Comum & Omit<ComponentProps<typeof Link>, keyof Comum> & { href: ComponentProps<typeof Link>["href"] };

export type BotaoProps = ComoBotao | ComoLink;

export function classesBotao(variante: VarianteBotao = "primario", larguraTotal = false, extra = "", tamanho: TamanhoBotao = "normal") {
  return cn(buttonVariants({ variant: variante, size: tamanho }), larguraTotal && "w-full sm:max-w-xs", extra);
}

/** Com `href` vira link (next/link); sem `href` é <button> (type="button" por padrão). */
export function Botao(props: BotaoProps) {
  const { variante = "primario", larguraTotal, tamanho = "normal", carregando, textoCarregando, icone, className = "", children, ...resto } = props;
  const classes = classesBotao(variante, larguraTotal, className, tamanho);
  const conteudo = (
    <>
      {carregando ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        icone && <span className="inline-flex shrink-0 [&>svg]:size-4" aria-hidden>{icone}</span>
      )}
      <span className="inline-flex min-w-0 items-center justify-center gap-2 text-center [overflow-wrap:anywhere]">{carregando && textoCarregando ? textoCarregando : children}</span>
    </>
  );

  if (resto.href !== undefined) {
    const linkProps = resto as Omit<ComoLink, keyof Comum>;
    return (
      <Link {...linkProps} className={classes} aria-disabled={carregando || undefined} aria-busy={carregando || undefined}>
        {conteudo}
      </Link>
    );
  }
  const { type = "button", disabled, ...botaoProps } = resto as Omit<ComoBotao, keyof Comum>;
  return (
    <button {...botaoProps} type={type} disabled={disabled || carregando} aria-busy={carregando || undefined} className={classes}>
      {conteudo}
    </button>
  );
}
