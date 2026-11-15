import { Info, Plus, Radar } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { LINK_RADAR, linkPedirRadar } from "@/lib/rotas";

export function CriarAnuncioInicio() {
  return (
    <Botao href="/anunciar" tamanho="toque" className="shrink-0 whitespace-nowrap max-sm:px-2!">
      <Plus className="hidden size-4 shrink-0 sm:block" aria-hidden />
      Criar anúncio
    </Botao>
  );
}

export function RadarInicio({ titulo, texto, botao }: { titulo: string; texto: string; botao: string }) {
  return (
    <section aria-label="Radar" className="relative min-w-0">
      <div className="pr-13">
        <Botao href={linkPedirRadar()} variante="secundario" tamanho="toque" icone={<Radar />}
          className="w-full bg-beringela px-2 text-white hover:bg-beringela/90">
          {botao}
        </Botao>
      </div>
      <details className="group">
        <summary aria-label="Como funciona o Radar" title="Como funciona o Radar"
          className={classesBotao("secundario", false, "absolute top-0 right-0 cursor-pointer list-none px-0 group-open:bg-selecao [&::-webkit-details-marker]:hidden", "toque")}>
          <Info className="size-5" aria-hidden />
        </summary>
        <div className="mt-2 flex flex-col gap-1 rounded-card border border-borda bg-cartao p-3 [overflow-wrap:anywhere]">
          <h2 id="titulo-radar-inicio" className="text-lg font-semibold text-beringela">{titulo}</h2>
          <p className="text-base text-texto-suave">{texto}</p>
          <Botao href={`${LINK_RADAR}?como-funciona=1`} variante="texto" tamanho="toque" className="self-start px-0">
            Ver detalhes do Radar
          </Botao>
        </div>
      </details>
    </section>
  );
}
