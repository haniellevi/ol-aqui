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
};

// Card do anúncio (modelo pedido em 12/11/2026, no jeito da OLX): foto quadrada com "Patrocinado" num canto
// e o coração no outro; título em até 2 linhas; preço antigo riscado (só se for maior); preço grande;
// "Hoje, 18:58 · Corrente - PI"; e, bem leve, a loja ou o vendedor verificado. O card inteiro é tocável.
export function CardAnuncio({ anuncio: a, prioridade = false, acao }: CardAnuncioProps) {
  const quando = quandoCard(a.criado_em);
  const antes = precoAntesValido(a.preco_antes_centavos, a.preco_centavos);
  const pfVerificado = a.vendedor_pago && a.vitrine_tipo === "pf" && a.vendedor_pf_verificado;
  return (
    <article className="olaki-toque relative flex flex-col overflow-hidden rounded-card bg-cartao shadow-1">
      <Link
        href={linkAnuncio(a.id, a.titulo, a.slug)}
        className="flex flex-1 flex-col focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
      >
        <div className={`relative aspect-square w-full ${a.capa ? "bg-white" : "bg-borda"}`}>
          {a.capa ? (
            // Foto inteira (sem cortar) sobre fundo branco. Foto do Storage sai otimizada (AVIF/WebP, só o tamanho que a tela precisa); outras vão como estão.
            <Image
              src={a.capa}
              alt={`Foto de ${formatarNome(a.titulo)}`}
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
            <Badge variant="featured" className="absolute top-2 left-2 font-semibold">
              Patrocinado
            </Badge>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 text-lg leading-5 font-semibold text-texto">{formatarNome(a.titulo)}</h3>
          <p className="mt-1.5 flex flex-col">
            {antes != null && (
              <s className="text-legenda leading-4 text-texto-suave tabular-nums">
                <span className="sr-only">Antes: </span>
                {preco(antes)}
              </s>
            )}
            <span className="text-2xl font-bold tabular-nums">
              {antes != null && <span className="sr-only">Agora: </span>}
              {preco(a.preco_centavos)}
            </span>
          </p>
          <span className="mt-auto pt-1.5 text-legenda leading-[18px] text-texto-suave">
            {quando && (
              <>
                <time dateTime={a.criado_em} suppressHydrationWarning>
                  {quando}
                </time>
                {" · "}
              </>
            )}
            {cidadeUf(formatarNome(a.cidade), a.uf)}
          </span>
          {pfVerificado ? (
            <span className="flex items-start gap-1 text-legenda leading-[18px] text-texto-suave">
              <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />
              <span>Vendedor individual verificado</span>
            </span>
          ) : a.vitrine_tipo === "loja" ? (
            <span className="flex items-center gap-1 truncate text-legenda leading-[18px] text-texto-suave">
              {a.vitrine_selo && <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />}
              <span className="truncate">
                {formatarNome(a.vitrine_nome)}
                {a.vitrine_selo && <span className="sr-only"> · Loja verificada</span>}
              </span>
            </span>
          ) : null}
        </div>
      </Link>
      {acao && <div className="absolute top-1 right-1">{acao}</div>}
    </article>
  );
}
