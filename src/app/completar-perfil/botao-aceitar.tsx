"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { aceitarTermos } from "@/app/(publico)/termos/actions";
import { Alert } from "@/components/ui/alert";

// "Aceitar e continuar" (um botão laranja na tela) + "Agora não" (a faixa lembra depois).
export function BotaoAceitarTermos({ ids, destino }: { ids: string[]; destino: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await aceitarTermos(ids).catch(() => ({ ok: false as const, erro: "Sem conexão agora. Tente de novo.", mudou: false }));
    if (r.ok) {
      router.replace(destino);
      return; // continua "Entrando…" até a próxima tela abrir
    }
    setEnviando(false);
    setErro(r.mudou ? "Os textos mudaram agora mesmo. Confira a versão nova." : r.erro);
    if (r.mudou) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && (
        <Alert variant="destructive" role="alert">
          {erro}
        </Alert>
      )}
      <Botao larguraTotal carregando={enviando} textoCarregando="Entrando…" onClick={() => void aceitar()}>
        Aceitar e continuar
      </Botao>
      <Botao href={destino} variante="texto">
        Agora não
      </Botao>
    </div>
  );
}
