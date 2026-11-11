import { Camera, MessageCircle, Store } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { linkPedirRadar } from "@/lib/rotas";

// Início "no começo": enquanto a região tem poucos anúncios, a primeira tela mostra as duas
// portas que já funcionam (pedir no Radar e anunciar) no lugar de uma prateleira vazia.
// Os quadros são só ilustração: levam a palavra "Exemplo" e ficam fora do leitor de tela.

const ETIQUETA = "self-start rounded-full bg-selecao px-2 text-legenda font-semibold text-beringela";

type TextosPorta = { titulo: string; texto: string; botao: string };

function PortaComprar({ textos, cidade }: { textos: TextosPorta; cidade: string | null }) {
  return (
    <section aria-labelledby="titulo-radar" className="flex flex-col gap-3 rounded-card bg-beringela p-5 text-white md:gap-4 md:p-8">
      <h2 id="titulo-radar" className="text-2xl font-semibold text-balance md:text-3xl">{textos.titulo}</h2>
      <p className="text-base text-pretty text-white/85">{textos.texto}</p>
      <div aria-hidden className="flex max-w-sm -rotate-1 flex-col gap-1 rounded-campo bg-cartao p-3 text-texto md:p-4">
        <span className={ETIQUETA}>Exemplo</span>
        <span className="text-lg font-semibold text-beringela">Geladeira frost free</span>
        <span className="text-sm text-texto-suave">até R$ 2.000{cidade ? ` · ${cidade}` : ""}</span>
        <span className="mt-1 flex flex-wrap gap-2">
          {[0, 1].map((i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-2 py-0.5 text-legenda font-semibold text-verde-escuro">
              <Store className="size-3.5" />
              Loja respondeu
            </span>
          ))}
        </span>
      </div>
      <Botao href={linkPedirRadar()} className="mt-auto focus-visible:outline-white" larguraTotal>
        {textos.botao}
      </Botao>
    </section>
  );
}

function PortaVender({ texto, cidade, principal }: { texto: string; cidade: string | null; principal: boolean }) {
  return (
    <section aria-labelledby="titulo-vender" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-5 shadow-1 md:gap-4 md:p-8">
      <h2 id="titulo-vender" className="text-2xl font-semibold text-balance text-beringela md:text-3xl">Tem algo para vender?</h2>
      <p className="text-base text-pretty text-texto-suave">{texto}</p>
      <div aria-hidden className="grid max-w-sm grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-card border border-borda bg-fundo p-2">
        <span className="relative grid aspect-4/3 place-items-center rounded-campo border border-dashed border-borda-campo bg-cartao text-beringela">
          <Camera className="size-5" />
          <span className={`absolute top-1 left-1 ${ETIQUETA}`}>Exemplo</span>
        </span>
        <span className="flex min-w-0 flex-col justify-center">
          <span className="text-lg font-bold text-beringela">R$ 8.500</span>
          <span className="text-base">Seu produto aqui</span>
          <span className="text-legenda text-texto-suave">{cidade ? `${cidade} · agora` : "agora"}</span>
          <span className="mt-1 inline-flex items-center gap-1 self-start rounded-campo bg-verde-escuro px-2 py-0.5 text-legenda font-semibold text-white">
            <MessageCircle className="size-3.5" />
            Chamar no WhatsApp
          </span>
        </span>
      </div>
      <Botao href="/anunciar" variante={principal ? "primario" : "secundario"} className="mt-auto" larguraTotal>
        Anunciar agora
      </Botao>
    </section>
  );
}

export function PortasInicio({
  radar,
  textoVender,
  cidade,
  venderPrimeiro = false,
}: {
  /** Textos do bloco do Radar (painel). null = bloco desligado: só a porta de vender. */
  radar: TextosPorta | null;
  textoVender: string;
  cidade: string | null;
  /** Segue a ordem dos blocos no painel ("recentes" antes de "radar"). */
  venderPrimeiro?: boolean;
}) {
  const comprar = radar && <PortaComprar key="comprar" textos={radar} cidade={cidade} />;
  const vender = <PortaVender key="vender" texto={textoVender} cidade={cidade} principal={!radar} />;
  return (
    <div className={`grid gap-4 md:gap-6 ${radar ? "md:grid-cols-2" : ""}`}>
      {venderPrimeiro ? [vender, comprar] : [comprar, vender]}
    </div>
  );
}
