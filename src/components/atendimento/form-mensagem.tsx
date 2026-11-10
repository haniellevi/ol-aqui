"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { enviarMensagemAtendimento } from "@/app/(conta)/minha-conta/atendimento/actions";

export function FormMensagemAtendimento({ id, ofereceAki }: { id: string; ofereceAki: boolean }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);
  const chave = useRef<string | null>(null);
  const router = useRouter();
  function enviar(aoAki: boolean) {
    if (pendente) return;
    setErro(null);
    iniciar(async () => {
      try {
        chave.current ??= crypto.randomUUID();
        const r = await enviarMensagemAtendimento(id, chave.current, texto, ofereceAki && aoAki);
        if (!r.ok) {
          setErro(r.erro.mensagem);
          return;
        }
        setTexto("");
        chave.current = null;
        window.dispatchEvent(new Event("olaki:avisos"));
        router.refresh();
      } catch {
        setErro("Não foi possível confirmar o envio. Tente novamente.");
      }
    });
  }
  return <form ref={formulario} onSubmit={(evento) => { evento.preventDefault(); enviar(false); }} className="space-y-3">
    {ofereceAki && <p className="text-sm text-texto-suave">Ao enviar ao Aki, esta mensagem pode ser processada pelo provedor de IA do OL-AKI. Você também pode enviar direto à equipe.</p>}
    <label htmlFor="mensagem-atendimento" className="block text-rotulo font-semibold">Mensagem</label>
    <textarea id="mensagem-atendimento" rows={3} maxLength={2000} required value={texto} disabled={pendente}
      onChange={(e) => { chave.current = null; setTexto(e.target.value); }}
      className="w-full rounded-campo border border-borda-campo bg-cartao px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro" />
    {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      <Botao type="submit" carregando={pendente} variante={ofereceAki ? "secundario" : "primario"}>
        {ofereceAki ? "Enviar à equipe" : "Enviar mensagem"}
      </Botao>
      {ofereceAki && <Botao type="button" disabled={pendente} onClick={() => { if (formulario.current?.reportValidity()) enviar(true); }}>Enviar ao Aki</Botao>}
    </div>
  </form>;
}
