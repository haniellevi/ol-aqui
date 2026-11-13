import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MARCA_EQUIPE } from "@/lib/historico";
import { linkAdminAnuncio } from "@/lib/rotas";
import { DESTINO_SAIR, PASSOS, TOTAL_PASSOS, numeroPasso, passoAnterior, urlPasso, type SlugPasso } from "./passos";

// Topo de cada passo: "Voltar", "Passo N de 6 · Nome", etapas tocáveis e "Salvar e sair".
// Etapas: ao editar, todas tocáveis; no anúncio novo, só as já feitas (antes da atual).
// Com formulário, tocar numa etapa salva o passo atual e vai direto para ela (acao="ir:<etapa>").
// "Salvar e sair" envia o formulário do passo (atributo form) para não perder o que foi digitado.
// Sem formulário (revisão, que não tem campos editáveis), vira um link.

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });
function horaCurta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : HORA.format(d);
}

const LINK_TOPO =
  "inline-flex min-h-11 items-center gap-1 rounded-card px-2 text-sm font-semibold text-beringela md:min-h-10 md:text-base md:text-laranja-escuro " +
  "hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function CabecalhoPasso({
  passo,
  id,
  editar,
  formId,
  titulo,
  subtitulo,
  equipe,
}: {
  passo: SlugPasso;
  id: string;
  editar: boolean;
  /** id do <form> do passo; sem ele o "Salvar e sair" é só um link. */
  formId?: string;
  /** Frase grande da tela, ex.: "Tire fotos do que você quer vender". */
  titulo: string;
  subtitulo?: string;
  /** P5b-2a: super admin editando anúncio de outra pessoa (faixa de aviso com motivo e prazo). */
  equipe?: { motivo: string; expira_em: string } | null;
}) {
  const n = numeroPasso(passo);
  const nome = PASSOS[n - 1].titulo;
  const anterior = passoAnterior(passo);
  // P5b-2a: a equipe volta para a ficha do anúncio no painel.
  const sair = equipe ? linkAdminAnuncio(id) : DESTINO_SAIR;
  const voltar = anterior ? urlPasso(anterior, id, editar) : editar ? sair : "/anunciar";
  // Fotos salvam sozinhas ao enviar e a revisão não tem campos: lá a etapa é só um link.
  const salvaAoIr = Boolean(formId) && passo !== "fotos" && passo !== "revisar";

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {equipe && (
        <p role="note" className="rounded-card border border-aviso bg-aviso-fundo p-3 text-sm break-words">
          <strong>Este anúncio é de outra pessoa.</strong> Você está editando como {MARCA_EQUIPE}. Motivo: {equipe.motivo}.
          {" "}Vale até {horaCurta(equipe.expira_em)}. Cada mudança vai para o histórico do anúncio.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Link href={voltar} className={`${LINK_TOPO} -ml-2`}>
          <ArrowLeft className="size-4 md:size-5" aria-hidden />
          Voltar
        </Link>
        {formId ? (
          <button type="submit" form={formId} name="acao" value="sair" className={`${LINK_TOPO} -mr-2`}>
            Salvar e sair
          </button>
        ) : (
          <Link href={sair} className={`${LINK_TOPO} -mr-2`}>
            Salvar e sair
          </Link>
        )}
      </div>
      <div className="flex flex-col md:gap-2">
        <p className="text-sm font-semibold text-texto-suave">
          Passo {n} de {TOTAL_PASSOS} · {nome}
          {editar && <span className="ml-1 font-normal">(editando)</span>}
        </p>
        <EtapasTocaveis passo={passo} id={id} editar={editar} formId={salvaAoIr ? formId : undefined} />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold leading-tight text-beringela [overflow-wrap:anywhere] md:text-titulo">{titulo}</h1>
        {subtitulo && <p className="text-sm text-texto-suave [overflow-wrap:anywhere] md:text-base">{subtitulo}</p>}
      </div>
    </div>
  );
}

const ETAPA =
  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-campo px-1 py-1 text-legenda leading-tight md:min-h-10 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

function EtapasTocaveis({ passo, id, editar, formId }: { passo: SlugPasso; id: string; editar: boolean; formId?: string }) {
  const atual = numeroPasso(passo);
  return (
    <nav aria-label="Etapas do anúncio">
      <ol className="flex gap-1">
        {PASSOS.map((p, i) => {
          const n = i + 1;
          const ehAtual = n === atual;
          const feita = n < atual;
          const liberada = !ehAtual && (editar || feita);
          const marca = (
            <>
              <span aria-hidden className={`grid size-7 place-items-center rounded-full text-xs font-semibold md:hidden ${ehAtual ? "bg-laranja text-beringela" : feita ? "bg-selecao text-beringela" : "border border-borda text-texto-suave"}`}>{n}</span>
              <span aria-hidden className={`hidden h-1.5 w-full rounded-full md:block ${ehAtual || feita ? "bg-laranja" : "bg-borda"}`} />
              <span className={`max-md:sr-only ${ehAtual ? "font-semibold text-beringela" : liberada ? "font-semibold text-laranja-escuro" : "text-texto-suave"}`}>{p.titulo}</span>
            </>
          );
          return (
            <li key={p.slug} className="flex min-w-0 flex-1">
              {ehAtual ? (
                <span aria-current="step" className={ETAPA}>{marca}</span>
              ) : !liberada ? (
                <span aria-disabled="true" className={ETAPA}>{marca}</span>
              ) : formId ? (
                <button type="submit" form={formId} name="acao" value={`ir:${p.slug}`} className={`${ETAPA} hover:bg-fundo`}>
                  {marca}
                </button>
              ) : (
                <Link href={urlPasso(p.slug, id, editar)} className={`${ETAPA} hover:bg-fundo`}>{marca}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
