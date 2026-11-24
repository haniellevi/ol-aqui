"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Botao } from "@/components/ui/botao";
import { OBJETIVOS, linkAssistente, type ObjetivoAssistente, type ProgressoAssistente } from "@/lib/assistente";
import { EVENTO_ASSISTENTE, marcarConviteVisto, progressoAtual, salvarProgresso } from "./progresso";

export function EntradaAssistente({ dono, ocultarContinuar = false }: { dono: string | null; ocultarContinuar?: boolean }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const ajudaAberta = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<{ atual: ProgressoAssistente | null } | null>(null);

  useEffect(() => {
    const atualizar = () => setEstado({ atual: progressoAtual(dono) });
    atualizar();
    window.addEventListener("storage", atualizar);
    window.addEventListener(EVENTO_ASSISTENTE, atualizar);
    window.addEventListener("pageshow", atualizar);
    return () => {
      window.removeEventListener("storage", atualizar);
      window.removeEventListener(EVENTO_ASSISTENTE, atualizar);
      window.removeEventListener("pageshow", atualizar);
    };
  }, [dono]);

  useEffect(() => {
    if (aberto) titulo.current?.focus();
    else if (ajudaAberta.current) gatilho.current?.focus();
    ajudaAberta.current = aberto;
  }, [aberto]);

  function viuConvite() {
    marcarConviteVisto();
  }

  function iniciar(objetivo: ObjetivoAssistente) {
    viuConvite();
    setAberto(false);
    if (objetivo === "explorar") {
      salvarProgresso(dono, null);
      window.location.assign("/busca");
      return;
    }
    const tentativa = crypto.randomUUID();
    salvarProgresso(dono, { objetivo, tentativa, dono });
    window.location.assign(linkAssistente(objetivo, tentativa));
  }

  return (
    <section aria-label="Assistente de primeiros passos" className="flex flex-wrap items-center gap-2">
      {aberto ? (
        <div className="flex w-full flex-col gap-2 rounded-card border border-borda bg-cartao p-3" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); } }}>
          <div className="flex items-center justify-between gap-2">
            <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold">O que você quer fazer hoje?</h2>
            <Button variant="ghost" size="icon-lg" aria-label="Fechar ajuda" onClick={() => setAberto(false)}><X className="size-5" aria-hidden /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {(Object.keys(OBJETIVOS) as ObjetivoAssistente[]).map((objetivo) => (
              <Botao key={objetivo} variante="secundario" tamanho="toque" onClick={() => iniciar(objetivo)}>{OBJETIVOS[objetivo]}</Botao>
            ))}
          </div>
        </div>
      ) : (
        <>
          {!ocultarContinuar && estado?.atual && <Botao tamanho="toque" href={linkAssistente(estado.atual.objetivo, estado.atual.tentativa) + (estado.atual.radar ? "&radar=1" : "")}>Continuar</Botao>}
          <Botao ref={gatilho} variante="texto" tamanho="toque" disabled={!estado} onClick={() => { viuConvite(); setAberto(true); }}>Preciso de ajuda</Botao>
        </>
      )}
    </section>
  );
}
