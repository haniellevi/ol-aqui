import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Botão do OLAKI (docs/DESIGN-SYSTEM.md, "Botões"). Altura mínima 48px, texto 16px negrito.
// Principal = laranja com texto beringela (nunca branco no laranja).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "whatsapp" | "texto";

const BASE =
  "inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-card px-5 text-base font-semibold leading-5 " +
  "transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-laranja text-beringela font-bold hover:bg-[#f25f0a] active:bg-[#e55a08]",
  secundario: "border-2 border-beringela bg-cartao text-beringela hover:bg-fundo active:bg-borda",
  perigo: "border-2 border-perigo bg-cartao text-perigo hover:bg-red-50 active:bg-red-100",
  whatsapp: "bg-verde-escuro text-white hover:bg-[#0c6a35] active:bg-[#0a5a2d]",
  texto: "px-3 text-laranja-escuro underline-offset-4 hover:underline",
};

type Comum = {
  variante?: VarianteBotao;
  /** Largura cheia (padrão no celular para o botão principal). */
  larguraTotal?: boolean;
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

export function classesBotao(variante: VarianteBotao = "primario", larguraTotal = false, extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${larguraTotal ? "w-full" : ""} ${extra}`.trim();
}

/** Com `href` vira link (next/link); sem `href` é <button> (type="button" por padrão). */
export function Botao(props: BotaoProps) {
  const { variante = "primario", larguraTotal, carregando, textoCarregando, icone, className = "", children, ...resto } = props;
  const classes = classesBotao(variante, larguraTotal, className);
  const conteudo = (
    <>
      {carregando ? (
        <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        icone && <span className="inline-flex shrink-0 [&>svg]:size-5" aria-hidden>{icone}</span>
      )}
      <span>{carregando && textoCarregando ? textoCarregando : children}</span>
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
