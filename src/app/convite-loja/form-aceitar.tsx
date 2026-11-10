"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { aceitarConviteGerente } from "./actions";

export function FormAceitarConvite({ codigo }: { codigo: string }) {
  const [erro, acao, pendente] = useActionState(aceitarConviteGerente.bind(null, codigo), null);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <Botao type="submit" larguraTotal carregando={pendente}>Aceitar convite</Botao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </form>
  );
}
