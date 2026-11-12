import type { ReactNode } from "react";
import { CardAnuncio, type CardAnuncioProps } from "@/components/anuncio/card-anuncio";
import { MedirAparicoes } from "@/components/anuncio/medir-aparicoes";
import type { PaginaAparicao } from "@/lib/metricas/aparicoes";

// Grade de cards: 2 colunas no celular, 3 no tablet, 4 a 5 no computador.
export function GradeAnuncios({
  anuncios,
  vazio,
  prioridade = 2,
  acao,
  className = "",
  medirEm,
}: {
  anuncios: CardAnuncioProps["anuncio"][];
  /** O que mostrar quando não há anúncios (ex.: <Vazio ...>). */
  vazio?: ReactNode;
  /** Quantos primeiros cards carregam a foto na hora (o resto é preguiçoso). */
  prioridade?: number;
  /** Botão no canto de cada card (ex.: favoritar). Só funciona quando o componente pai é do servidor. */
  acao?: (anuncio: CardAnuncioProps["anuncio"]) => ReactNode;
  className?: string;
  /** Onde a lista aparece (conta as aparições no painel do dono e do administrador). */
  medirEm?: PaginaAparicao;
}) {
  if (anuncios.length === 0) return <>{vazio ?? null}</>;
  return (
    <>
      {medirEm && <MedirAparicoes pagina={medirEm} ids={anuncios.map((a) => a.id)} />}
      <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className}`}>
        {anuncios.map((a, i) => (
          <li key={a.id} className="flex">
            <div className="flex w-full flex-col [&>article]:flex-1">
              <CardAnuncio anuncio={a} prioridade={i < prioridade} acao={acao?.(a)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
