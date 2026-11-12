import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { podeOtimizar } from "@/lib/imagem";
import { ImageOff, ShieldCheck } from "lucide-react";
import { linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import type { AnuncioCard } from "@/lib/tipos";
import { Badge } from "@/components/ui/badge";

export type CardAnuncioProps = {
  anuncio: Pick<
    AnuncioCard,
    "id" | "titulo" | "preco_centavos" | "cidade" | "capa" | "criado_em" | "destaque" | "vitrine_nome" | "vitrine_selo" | "vitrine_tipo" | "vendedor_pago" | "vendedor_pf_verificado"
  > & { aceita_troca?: boolean };
  /** Carrega a foto já (use nos primeiros cards da tela). Padrão: preguiçoso. */
  prioridade?: boolean;
  /** Botão no canto da foto (ex.: favoritar). Fica fora do link para não aninhar. */
  acao?: ReactNode;
};

// Card do anúncio: foto quadrada (1:1), preço grande, título em 2 linhas, cidade e "há 2 dias",
// selo da loja e "Patrocinado" quando é destaque pago. O card inteiro é tocável.
export function CardAnuncio({ anuncio: a, prioridade = false, acao }: CardAnuncioProps) {
  const quando = tempoRelativo(a.criado_em);
  return (
    <article className="olaki-toque relative flex flex-col overflow-hidden rounded-card bg-cartao shadow-1">
      <Link
        href={linkAnuncio(a.id, a.titulo)}
        className="flex flex-1 flex-col focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
      >
        <div className={`relative aspect-square w-full ${a.capa ? "bg-white" : "bg-borda"}`}>
          {a.capa ? (
            // Foto inteira (sem cortar) sobre fundo branco. Foto do Storage sai otimizada (AVIF/WebP, só o tamanho que a tela precisa); outras vão como estão.
            <Image
              src={a.capa}
              alt={`Foto de ${a.titulo}`}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
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
            <span className="absolute top-2 left-2 rounded-full bg-patrocinado-fundo px-2 py-0.5 text-xs font-semibold text-beringela">
              Patrocinado
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-3">
          <span className="text-lg leading-5 font-semibold tabular-nums">{preco(a.preco_centavos)}</span>
          <h3 className="line-clamp-2 text-sm leading-5">{a.titulo}</h3>
          <span className="mt-auto pt-1 text-legenda leading-[18px] text-texto-suave">
            {a.cidade}
            {quando && (
              <>
                {" · "}
                <time dateTime={a.criado_em} suppressHydrationWarning>
                  {quando}
                </time>
              </>
            )}
          </span>
          {a.vendedor_pago && a.vitrine_tipo === "pf" && a.vendedor_pf_verificado && (
            <Badge variant="success">
              <ShieldCheck className="size-3.5" aria-hidden /> Vendedor individual verificado
            </Badge>
          )}
          {a.vitrine_tipo === "loja" && (
            <span className="flex items-center gap-1 truncate text-legenda leading-[18px] text-texto-suave">
              {a.vitrine_selo && <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />}
              <span className="truncate">
                {a.vitrine_nome}
                {a.vitrine_selo && <span className="sr-only"> · Loja verificada</span>}
              </span>
            </span>
          )}
        </div>
      </Link>
      {acao && <div className="absolute top-1 right-1">{acao}</div>}
    </article>
  );
}
