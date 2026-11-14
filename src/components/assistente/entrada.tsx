"use client";

import { useEffect, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { OBJETIVOS, linkAssistente, type ObjetivoAssistente, type ProgressoAssistente } from "@/lib/assistente";
import { EVENTO_ASSISTENTE, conviteVisto, marcarConviteVisto, progressoAtual, salvarProgresso } from "./progresso";

export function EntradaAssistente({ dono }: { dono: string | null }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<{ convite: boolean; atual: ProgressoAssistente | null } | null>(null);

  useEffect(() => {
    const atualizar = () => setEstado({ convite: !conviteVisto(), atual: progressoAtual(dono) });
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

  useEffect(() => { if (aberto) titulo.current?.focus(); }, [aberto]);

  function viuConvite() {
    marcarConviteVisto();
    setEstado((anterior) => ({ convite: false, atual: anterior?.atual ?? null }));
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
        <div className="flex w-full flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
          <h2 ref={titulo} tabIndex={-1} className="text-lg font-semibold">O que você quer fazer hoje?</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OBJETIVOS) as ObjetivoAssistente[]).map((objetivo) => (
              <Botao key={objetivo} variante="secundario" onClick={() => iniciar(objetivo)}>{OBJETIVOS[objetivo]}</Botao>
            ))}
          </div>
          <Botao className="self-start" variante="texto" onClick={() => setAberto(false)}>Fechar ajuda</Botao>
        </div>
      ) : estado?.convite && !estado.atual ? (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-card border border-borda bg-cartao p-3">
          <p className="mr-auto text-sm">Quer ajuda para dar o próximo passo?</p>
          <Botao onClick={() => { viuConvite(); setAberto(true); }}>Começar</Botao>
          <Botao variante="texto" onClick={viuConvite}>Agora não</Botao>
        </div>
      ) : (
        <>
          {estado?.atual && <Botao href={linkAssistente(estado.atual.objetivo, estado.atual.tentativa) + (estado.atual.radar ? "&radar=1" : "")}>Continuar</Botao>}
          <Botao variante="texto" disabled={!estado} onClick={() => setAberto(true)}>Preciso de ajuda</Botao>
        </>
      )}
    </section>
  );
}
