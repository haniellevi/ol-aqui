import { formatarNome } from "@/lib/formatar-nome";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { podeOtimizar } from "@/lib/imagem";
import { ImageOff, ShieldCheck } from "lucide-react";
import { cidadeUf, linkAnuncio, preco, precoAntesValido, quandoCard } from "@/lib/formato";
import type { AnuncioCard } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";

export type CardAnuncioProps = {
  anuncio: Pick<
    AnuncioCard,
    "id" | "slug" | "titulo" | "preco_centavos" | "cidade" | "capa" | "criado_em" | "destaque" | "vitrine_nome" | "vitrine_selo" | "vitrine_tipo" | "vendedor_pago" | "vendedor_pf_verificado"
  > & { aceita_troca?: boolean; preco_antes_centavos?: number | null; uf?: string | null };
  /** Carrega a foto já (use nos primeiros cards da tela). Padrão: preguiçoso. */
  prioridade?: boolean;
  /** Botão no canto da foto (ex.: favoritar). Fica fora do link para não aninhar. */
  acao?: ReactNode;
  compacto?: boolean;
  voltarHref?: string;
  /** Prévia de revisão: o anúncio ainda pode não ter uma página pública. */
  semLink?: boolean;
};

// Card do anúncio (modelo pedido em 12/11/2026, no jeito da OLX): foto quadrada com "Patrocinado" num canto
// e o coração no outro; título em até 2 linhas; preço antigo riscado (só se for maior); preço grande;
// "Hoje, 18:58 · Corrente - PI"; e, bem leve, a loja ou o vendedor verificado. O card inteiro é tocável.
export function CardAnuncio({ anuncio: a, prioridade = false, acao, compacto = false, voltarHref, semLink = false }: CardAnuncioProps) {
  const caminho = linkAnuncio(a.id, a.titulo, a.slug);
  const href = voltarHref ? `${caminho}?${new URLSearchParams({ voltar: voltarHref })}` : caminho;
  const quando = quandoCard(a.criado_em);
  const antes = precoAntesValido(a.preco_antes_centavos, a.preco_centavos);
  const pfVerificado = a.vendedor_pago && a.vitrine_tipo === "pf" && a.vendedor_pf_verificado;
  const conteudo = (
    <>
      <div className={`relative aspect-square w-full ${compacto ? "max-md:aspect-auto max-md:w-17 max-md:shrink-0" : ""} ${a.capa ? "bg-white" : "bg-borda"}`}>
        {a.capa ? (
          // Foto inteira (sem cortar) sobre fundo branco. Foto do Storage sai otimizada (AVIF/WebP, só o tamanho que a tela precisa); outras vão como estão.
          <Image
            src={a.capa}
            alt={compacto ? "" : `Foto de ${formatarNome(a.titulo)}`}
            fill
            sizes={compacto ? "(max-width: 767px) 68px, (min-width: 1024px) 25vw, 33vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
            priority={prioridade}
            unoptimized={!podeOtimizar(a.capa)}
            className="object-contain"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-texto-suave" aria-label="Sem foto">
            <ImageOff className="size-8" aria-hidden />
          </span>
        )}
        {a.destaque && (
          <Badge variant="featured" className={`absolute top-2 left-2 font-semibold ${compacto ? "max-md:hidden" : ""}`}>
            Patrocinado
          </Badge>
        )}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col p-3 ${compacto ? "max-md:justify-center max-md:px-2 max-md:py-1" : ""}`}>
        <h3 className={`line-clamp-2 text-lg leading-5 font-semibold text-texto [overflow-wrap:anywhere] ${compacto ? "max-md:text-[13px] max-md:leading-4 max-md:font-normal" : ""}`}>{formatarNome(a.titulo)}</h3>
        <p className={`mt-1.5 flex flex-col ${compacto ? "max-md:mt-0.5 max-md:flex-row max-md:flex-wrap max-md:items-baseline max-md:gap-x-1.5" : ""}`}>
          {antes != null && (
            <s className="text-legenda leading-4 text-texto-suave tabular-nums">
              <span className="sr-only">Antes: </span>
              {preco(antes)}
            </s>
          )}
          <span className={`text-2xl font-bold tabular-nums ${compacto ? "max-md:text-sm max-md:leading-[18px] max-md:text-beringela" : ""}`}>
            {antes != null && <span className="sr-only">Agora: </span>}
            {preco(a.preco_centavos)}
          </span>
        </p>
        <span className={`mt-auto pt-1.5 text-legenda leading-[18px] text-texto-suave [overflow-wrap:anywhere] ${compacto ? "max-md:mt-0 max-md:pt-0 max-md:text-[11px] max-md:leading-[14px]" : ""}`}>
          {quando && (compacto ? (
            <span className="hidden md:inline">
              <time dateTime={a.criado_em} suppressHydrationWarning>{quando}</time>
              {" · "}
            </span>
          ) : (
            <>
              <time dateTime={a.criado_em} suppressHydrationWarning>{quando}</time>
              {" · "}
            </>
          ))}
          {cidadeUf(formatarNome(a.cidade), a.uf)}
          {compacto && a.destaque && <span className="ml-1.5 font-semibold text-beringela md:hidden">Patrocinado</span>}
          {compacto && (pfVerificado || a.vitrine_selo) && <ShieldCheck className="ml-1 inline size-3.5 text-verde-escuro md:hidden" aria-label={a.vitrine_selo ? "Loja verificada" : "Vendedor verificado"} role="img" />}
        </span>
        {pfVerificado ? (
          <span className={`flex items-start gap-1 text-legenda leading-[18px] text-texto-suave ${compacto ? "max-md:hidden" : ""}`}>
            <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />
            <span>Vendedor individual verificado</span>
          </span>
        ) : a.vitrine_tipo === "loja" ? (
          <span className={`flex items-center gap-1 truncate text-legenda leading-[18px] text-texto-suave ${compacto ? "max-md:hidden" : ""}`}>
            {a.vitrine_selo && <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />}
            <span className="truncate">
              {formatarNome(a.vitrine_nome)}
              {a.vitrine_selo && <span className="sr-only"> · Loja verificada</span>}
            </span>
          </span>
        ) : null}
      </div>
    </>
  );
  const layout = `flex flex-1 flex-col ${compacto ? "max-md:min-h-18 max-md:flex-row" : ""}`;

  return (
    <article className="olaki-toque relative flex flex-col overflow-hidden rounded-card bg-cartao shadow-1">
      {semLink ? <div className={layout}>{conteudo}</div> : (
        <Link href={href} className={`${layout} focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro`}>
          {conteudo}
        </Link>
      )}
      {acao && <div className={`absolute top-1 ${compacto ? "left-1 md:left-auto md:right-1" : "right-1"}`}>{acao}</div>}
    </article>
  );
}
