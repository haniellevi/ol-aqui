import { Info, Plus } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { LINK_RADAR, linkPedirRadar } from "@/lib/rotas";

export function CriarAnuncioInicio() {
  return (
    <Botao href="/anunciar" variante="secundario" tamanho="toque" className="shrink-0 whitespace-nowrap max-sm:px-2!">
      <Plus className="hidden size-4 shrink-0 sm:block" aria-hidden />
      Criar anúncio
    </Botao>
  );
}

export function RadarInicio({ titulo, texto, botao }: { titulo: string; texto: string; botao: string }) {
  return (
    <section aria-labelledby="titulo-radar-inicio" className="flex min-w-0 flex-col gap-3 rounded-card bg-beringela p-4 text-white lg:min-h-64">
      <div className="flex items-start justify-between gap-2">
        <h2 id="titulo-radar-inicio" className="min-w-0 pt-2 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">{titulo}</h2>
        <a href={`${LINK_RADAR}?como-funciona=1`} aria-label="Como funciona o Radar" title="Como funciona o Radar"
          className={classesBotao("texto", false, "-mt-2 -mr-2 shrink-0 px-0 text-white! focus-visible:outline-white hover:bg-white/15", "toque")}>
          <Info className="size-5" aria-hidden />
        </a>
      </div>
      <p className="min-w-0 text-base leading-relaxed text-selecao [overflow-wrap:anywhere]">{texto}</p>
      <Botao href={linkPedirRadar()} tamanho="toque" className="self-start lg:mt-auto lg:w-full">{botao}</Botao>
    </section>
  );
}
