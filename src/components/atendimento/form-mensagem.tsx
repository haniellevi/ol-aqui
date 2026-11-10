"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { enviarMensagemAtendimento } from "@/app/(conta)/minha-conta/atendimento/actions";

export function FormMensagemAtendimento({ id, ofereceAki }: { id: string; ofereceAki: boolean }) {
  const [texto, setTexto] = useState("");
  const chave = useRef<string | null>(null);
  const router = useRouter();
  const [erro, enviar, pendente] = useActionState(async (_: string | null, form: FormData) => {
    try {
      chave.current ??= crypto.randomUUID();
      const r = await enviarMensagemAtendimento(id, chave.current, texto, ofereceAki && form.get("destino") === "aki");
      if (!r.ok) return r.erro.mensagem;
      setTexto("");
      chave.current = null;
      window.dispatchEvent(new Event("olaki:avisos"));
      router.refresh();
      return null;
    } catch {
      return "Não foi possível confirmar o envio. Tente novamente.";
    }
  }, null);
  return <form action={enviar} className="space-y-3">
    {ofereceAki && <p className="text-sm text-texto-suave">Ao enviar ao Aki, esta mensagem pode ser processada pelo provedor de IA do OL-AKI. Você também pode enviar direto à equipe.</p>}
    <label htmlFor="mensagem-atendimento" className="block text-rotulo font-semibold">Mensagem</label>
    <textarea id="mensagem-atendimento" rows={3} maxLength={2000} required value={texto} disabled={pendente}
      onChange={(e) => { chave.current = null; setTexto(e.target.value); }}
      className="w-full rounded-campo border border-borda-campo bg-cartao px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro" />
    {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      <Botao type="submit" name="destino" value="equipe" carregando={pendente} variante={ofereceAki ? "secundario" : "primario"}>
        {ofereceAki ? "Enviar à equipe" : "Enviar mensagem"}
      </Botao>
      {ofereceAki && <Botao type="submit" name="destino" value="aki" disabled={pendente}>Enviar ao Aki</Botao>}
    </div>
  </form>;
}
