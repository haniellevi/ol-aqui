import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Botão do OLAKI: texto 14px, altura 44px no toque e 40px com mouse.
// Principal = laranja com texto beringela (nunca branco no laranja).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "whatsapp" | "texto";

const BASE =
  "olaki-acao olaki-controle inline-flex select-none items-center justify-center gap-1.5 rounded-campo px-3 text-sm font-semibold leading-5 " +
  "transition-colors active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-laranja text-beringela hover:brightness-95",
  secundario: "border border-beringela bg-cartao text-beringela hover:bg-fundo",
  perigo: "border border-perigo bg-cartao text-perigo hover:bg-perigo-fundo",
  whatsapp: "bg-verde-escuro text-white hover:brightness-95",
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
  return `${BASE} min-h-11 ${VARIANTES[variante]} ${larguraTotal ? "w-full" : ""} ${extra}`.trim();
}

/** Com `href` vira link (next/link); sem `href` é <button> (type="button" por padrão). */
export function Botao(props: BotaoProps) {
  const { variante = "primario", larguraTotal, carregando, textoCarregando, icone, className = "", children, ...resto } = props;
  const classes = classesBotao(variante, larguraTotal, className);
  const conteudo = (
    <>
      {carregando ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        icone && <span className="inline-flex shrink-0 [&>svg]:size-4" aria-hidden>{icone}</span>
      )}
      <span className="inline-flex items-center justify-center gap-2">{carregando && textoCarregando ? textoCarregando : children}</span>
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
