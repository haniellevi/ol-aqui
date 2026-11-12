"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Botao } from "@/components/ui/botao";

// "Falar em vez de digitar": usa o reconhecimento de voz do navegador (Chrome, Edge, Safari).
// Sem suporte (ex.: Firefox) o botão não aparece. Nada é gravado nem enviado por nós.

type ResultadoFala = { 0: { transcript: string }; isFinal: boolean };
type EventoFala = { resultIndex: number; results: ArrayLike<ResultadoFala> };
type Reconhecedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EventoFala) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type ConstrutorReconhecedor = new () => Reconhecedor;

function construtor(): ConstrutorReconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecedor; webkitSpeechRecognition?: ConstrutorReconhecedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function BotaoFalar({ onTexto }: { onTexto: (t: string) => void }) {
  const [suporte, setSuporte] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const reconhecedor = useRef<Reconhecedor | null>(null);
  const aoTexto = useRef(onTexto);
  useEffect(() => {
    aoTexto.current = onTexto;
  }, [onTexto]);

  // Só no navegador: no servidor não existe window (e o botão some sem suporte).
  useEffect(() => {
    setSuporte(construtor() !== null);
    return () => reconhecedor.current?.stop();
  }, []);

  if (!suporte) return null;

  function alternar() {
    if (ouvindo) {
      reconhecedor.current?.stop();
      return;
    }
    const Classe = construtor();
    if (!Classe) return;
    setFalhou(false);
    const r = new Classe();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      let texto = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) texto += e.results[i][0].transcript;
      if (texto.trim()) aoTexto.current(texto);
    };
    r.onerror = () => setFalhou(true);
    r.onend = () => setOuvindo(false);
    reconhecedor.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      setFalhou(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Botao variante="secundario" larguraTotal icone={<Mic />} onClick={alternar} tamanho="grande">
        {ouvindo ? "Ouvindo… toque para parar" : "Falar em vez de digitar"}
      </Botao>
      {falhou && (
        <p role="status" className="text-facil text-texto-suave">
          Não deu para ouvir. Tente de novo ou digite.
        </p>
      )}
    </div>
  );
}
