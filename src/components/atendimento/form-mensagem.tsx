"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { enviarMensagemAtendimento } from "@/app/(conta)/minha-conta/atendimento/actions";

export function FormMensagemAtendimento({ id, ofereceAki }: { id: string; ofereceAki: boolean }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [destino, setDestino] = useState<"aki" | "equipe">("equipe");
  const [pendente, iniciar] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);
  const chave = useRef<string | null>(null);
  const router = useRouter();
  function enviar(aoAki: boolean) {
    if (pendente) return;
    setErro(null);
    setAviso(null);
    setDestino(aoAki ? "aki" : "equipe");
    iniciar(async () => {
      try {
        chave.current ??= crypto.randomUUID();
        const r = await enviarMensagemAtendimento(id, chave.current, texto, ofereceAki && aoAki);
        if (!r.ok) {
          setErro(r.erro.mensagem);
          return;
        }
        setTexto("");
        setAviso(r.dados.mensagem);
        chave.current = null;
        window.dispatchEvent(new Event("olaki:avisos"));
        router.refresh();
      } catch {
        setErro("Não foi possível confirmar o envio. Tente novamente.");
      }
    });
  }
  return <form ref={formulario} onSubmit={(evento) => { evento.preventDefault(); enviar(ofereceAki); }} className="space-y-2 border-t border-borda pt-3" aria-busy={pendente}>
    <label htmlFor="mensagem-atendimento" className="sr-only">Mensagem</label>
    <textarea id="mensagem-atendimento" rows={2} maxLength={2000} required value={texto} disabled={pendente}
      placeholder="Escreva sua mensagem..." aria-describedby={ofereceAki ? "aviso-ia-atendimento" : undefined}
      onChange={(e) => { chave.current = null; setAviso(null); setTexto(e.target.value); }}
      className="w-full rounded-campo border border-borda-campo bg-cartao px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro" />
    {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
    <p role="status" className="text-legenda text-texto-suave empty:hidden">{pendente ? destino === "aki" ? "O Aki está respondendo..." : "Enviando mensagem..." : aviso}</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {ofereceAki && <span id="aviso-ia-atendimento" className="text-legenda text-texto-suave">Aki usa IA.</span>}
      <div className="ml-auto flex flex-wrap gap-2">
        {ofereceAki && <Botao type="button" variante="texto" disabled={pendente} carregando={pendente && destino === "equipe"} textoCarregando="Enviando..."
          onClick={() => { if (formulario.current?.reportValidity()) enviar(false); }}>Falar com a equipe</Botao>}
        <Botao type="submit" disabled={pendente} carregando={pendente && destino === (ofereceAki ? "aki" : "equipe")} textoCarregando={ofereceAki ? "Respondendo..." : "Enviando..."}>
          {ofereceAki ? "Enviar ao Aki" : "Enviar mensagem"}
        </Botao>
      </div>
    </div>
  </form>;
}
