import Link from "next/link";
import type { ReactNode } from "react";
import { ImageOff, ShieldCheck } from "lucide-react";
import { linkAnuncio, preco, tempoRelativo } from "@/lib/formato";
import type { AnuncioCard } from "@/lib/tipos";

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

// Card do anúncio: foto 4:3, preço grande, título em 2 linhas, cidade e "há 2 dias",
// selo da loja e "Patrocinado" quando é destaque pago. O card inteiro é tocável.
export function CardAnuncio({ anuncio: a, prioridade = false, acao }: CardAnuncioProps) {
  const quando = tempoRelativo(a.criado_em);
  return (
    <article className="relative flex flex-col overflow-hidden rounded-card bg-cartao shadow-1">
      <Link
        href={linkAnuncio(a.id, a.titulo)}
        className="flex flex-1 flex-col focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
      >
        <div className="relative aspect-[4/3] w-full bg-borda">
          {a.capa ? (
            // eslint-disable-next-line @next/next/no-img-element -- img simples: leve no 3G e funciona com qualquer host do Storage
            <img
              src={a.capa}
              alt={`Foto de ${a.titulo}`}
              width={400}
              height={300}
              loading={prioridade ? "eager" : "lazy"}
              fetchPriority={prioridade ? "high" : undefined}
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-texto-suave" aria-label="Sem foto">
              <ImageOff className="size-8" aria-hidden />
            </span>
          )}
          {a.destaque && (
            <span className="absolute left-2 top-2 rounded-full bg-patrocinado-fundo px-2 py-0.5 text-[13px] font-bold text-beringela">
              Patrocinado
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-2.5">
          <span className="text-lg font-bold leading-6">{preco(a.preco_centavos)}</span>
          <h3 className="line-clamp-2 text-[15px] leading-5">{a.titulo}</h3>
          <span className="mt-auto pt-1 text-[13px] leading-[18px] text-texto-suave">
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
          {a.vendedor_pago && a.vitrine_tipo === "loja" && (
            <span className="w-fit rounded-full bg-fundo px-2 py-0.5 text-xs font-semibold text-beringela">Loja</span>
          )}
          {a.vendedor_pago && a.vitrine_tipo === "pf" && a.vendedor_pf_verificado && (
            <span className="flex w-fit items-center gap-1 rounded-full bg-sucesso-fundo px-2 py-0.5 text-xs font-semibold text-verde-escuro">
              <ShieldCheck className="size-3.5" aria-hidden /> Vendedor individual verificado
            </span>
          )}
          {a.vitrine_tipo === "loja" && (
            <span className="flex items-center gap-1 truncate text-[13px] leading-[18px] text-texto-suave">
              {a.vitrine_selo && <ShieldCheck className="size-4 shrink-0 text-verde-escuro" aria-hidden />}
              <span className="truncate">
                {a.vitrine_nome}
                {a.vitrine_selo && <span className="font-semibold text-verde-escuro"> · Loja verificada</span>}
              </span>
            </span>
          )}
        </div>
      </Link>
      {acao && <div className="absolute right-1 top-1">{acao}</div>}
    </article>
  );
}
