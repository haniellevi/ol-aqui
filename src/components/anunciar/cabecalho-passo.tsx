import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DESTINO_SAIR, PASSOS, TOTAL_PASSOS, numeroPasso, passoAnterior, urlPasso, type SlugPasso } from "./passos";

// Topo de cada passo: "Voltar", "Passo N de 6 · Nome", barra de progresso e "Salvar e sair".
// "Salvar e sair" envia o formulário do passo (atributo form) para não perder o que foi digitado.
// Sem formulário (revisão, que não tem campos editáveis), vira um link.

const LINK_TOPO =
  "inline-flex min-h-12 items-center gap-1 rounded-card px-2 text-base font-semibold text-laranja-escuro " +
  "hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function CabecalhoPasso({
  passo,
  id,
  editar,
  formId,
  titulo,
  subtitulo,
}: {
  passo: SlugPasso;
  id: string;
  editar: boolean;
  /** id do <form> do passo; sem ele o "Salvar e sair" é só um link. */
  formId?: string;
  /** Frase grande da tela, ex.: "Tire fotos do que você quer vender". */
  titulo: string;
  subtitulo?: string;
}) {
  const n = numeroPasso(passo);
  const nome = PASSOS[n - 1].titulo;
  const anterior = passoAnterior(passo);
  const voltar = anterior ? urlPasso(anterior, id, editar) : editar ? DESTINO_SAIR : "/";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={voltar} className={`${LINK_TOPO} -ml-2`}>
          <ArrowLeft className="size-5" aria-hidden />
          Voltar
        </Link>
        {formId ? (
          <button type="submit" form={formId} name="acao" value="sair" className={`${LINK_TOPO} -mr-2`}>
            Salvar e sair
          </button>
        ) : (
          <Link href={DESTINO_SAIR} className={`${LINK_TOPO} -mr-2`}>
            Salvar e sair
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-texto-suave">
          Passo {n} de {TOTAL_PASSOS} · {nome}
          {editar && <span className="ml-1 font-normal">(editando)</span>}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-borda"
          role="progressbar"
          aria-label="Progresso do anúncio"
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASSOS}
          aria-valuenow={n}
          aria-valuetext={`Passo ${n} de ${TOTAL_PASSOS}`}
        >
          <div className="h-full rounded-full bg-laranja" style={{ width: `${(n / TOTAL_PASSOS) * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold leading-7">{titulo}</h1>
        {subtitulo && <p className="text-base text-texto-suave">{subtitulo}</p>}
      </div>
    </div>
  );
}
