"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { enviarMensagemAtendimento } from "@/app/(conta)/minha-conta/atendimento/actions";
import { classesCampo } from "@/components/ui/input";

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
    <label htmlFor="mensagem-atendimento" className="block text-rotulo font-semibold text-beringela">Mensagem</label>
    <textarea id="mensagem-atendimento" rows={2} maxLength={2000} required value={texto} disabled={pendente}
      placeholder="Escreva sua mensagem..." aria-describedby={ofereceAki ? "aviso-ia-atendimento" : undefined}
      onChange={(e) => { chave.current = null; setAviso(null); setTexto(e.target.value); }}
      className={`${classesCampo} min-h-20 resize-y py-2 leading-6`} />
    {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
    <p role="status" className="text-sm text-texto-suave empty:hidden">{pendente ? destino === "aki" ? "A Lia está respondendo..." : "Enviando mensagem..." : aviso}</p>
    {ofereceAki && <p id="aviso-ia-atendimento" className="text-legenda text-texto-suave">A Lia usa IA para tirar dúvidas rápidas.</p>}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      {ofereceAki && <Botao type="button" variante="secundario" tamanho="toque" className="w-full sm:w-auto" disabled={pendente} carregando={pendente && destino === "equipe"} textoCarregando="Enviando..."
        onClick={() => { if (formulario.current?.reportValidity()) enviar(false); }}>Falar com a equipe</Botao>}
      <Botao type="submit" tamanho="acao" className="w-full sm:w-auto" disabled={pendente} carregando={pendente && destino === (ofereceAki ? "aki" : "equipe")} textoCarregando={ofereceAki ? "Aguarde..." : "Enviando..."}>
        {ofereceAki ? "Enviar à Lia" : "Enviar mensagem"}
      </Botao>
    </div>
  </form>;
}
