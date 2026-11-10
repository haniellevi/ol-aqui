import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Botão do OLAKI (docs/DESIGN-SYSTEM.md, "Régua de tamanhos"):
// normal = 40px no toque e 36px com mouse; pequeno = 32px no toque e 28px com mouse
// (ações dentro de cards, listas e tabelas). Texto 13px (12px no pequeno).
// Largura total só no celular: do tablet para cima o botão para em 320px.
// Principal = laranja com texto beringela (nunca branco no laranja).

export type VarianteBotao = "primario" | "secundario" | "perigo" | "whatsapp" | "texto";
export type TamanhoBotao = "normal" | "pequeno";

const TAMANHOS: Record<TamanhoBotao, string> = {
  normal: "olaki-controle min-h-10 px-3.5 text-sm leading-5",
  pequeno: "olaki-controle-pequeno min-h-8 px-2.5 text-legenda leading-4",
};

const BASE =
  "olaki-acao inline-flex select-none items-center justify-center gap-1.5 rounded-campo font-semibold " +
  "transition-colors active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-laranja text-beringela hover:brightness-95",
  secundario: "border border-beringela bg-cartao text-beringela hover:bg-fundo",
  perigo: "border border-perigo bg-cartao text-perigo hover:bg-perigo-fundo",
  whatsapp: "bg-verde-escuro text-white hover:brightness-95",
  texto: "text-laranja-escuro underline-offset-4 hover:underline",
};

type Comum = {
  variante?: VarianteBotao;
  /** Largura cheia no celular; do tablet para cima, no máximo 320px. */
  larguraTotal?: boolean;
  /** "pequeno" para ações dentro de cards, listas e tabelas. */
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
  return `${BASE} ${TAMANHOS[tamanho]} ${VARIANTES[variante]} ${larguraTotal ? "w-full sm:max-w-xs" : ""} ${extra}`.trim();
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
