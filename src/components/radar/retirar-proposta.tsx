"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { Alert } from "@/components/ui/alert";
import { useConfirmar } from "@/components/ui/confirmar";
import { retirarProposta } from "@/app/radar/actions";

export function RetirarProposta({ id }: { id: string }) {
  const confirmar = useConfirmar();
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return <div className="flex flex-col gap-2">
    <Botao variante="perigo" disabled={ocupado} carregando={ocupado} onClick={async () => {
      if (!(await confirmar({ titulo: "Retirar proposta?", texto: "O comprador não poderá escolher esta oferta. O histórico e a cota usada serão mantidos.", acao: "Retirar proposta", perigo: true }))) return;
      iniciar(async () => {
        setErro(null);
        const r = await retirarProposta(id);
        if (!r.ok) setErro(r.erro);
        else router.refresh();
      });
    }}>Retirar proposta</Botao>
    {erro && <Alert variant="destructive" role="alert">{erro}</Alert>}
  </div>;
}
