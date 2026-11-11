"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { desfazerFeitas, marcarFeito } from "./actions";

export function BotaoFeito({ tipo, alvo }: { tipo: string; alvo: string }) {
  const [estado, acao, pendente] = useActionState(marcarFeito, null);
  return (
    <form action={acao}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="alvo" value={alvo} />
      <Botao type="submit" variante="discreto" tamanho="pequeno" carregando={pendente} icone={<Check className="size-4" aria-hidden />}>
        Adiar até amanhã
      </Botao>
      {estado?.erro && <p role="alert" className="mt-1 text-legenda text-perigo">{estado.erro}</p>}
    </form>
  );
}

export function BotaoDesfazer({ dia }: { dia: string }) {
  const [estado, acao, pendente] = useActionState(desfazerFeitas, null);
  return (
    <form action={acao} className="inline">
      <input type="hidden" name="dia" value={dia} />
      <Botao type="submit" variante="discreto" tamanho="pequeno" carregando={pendente}>
        Mostrar de novo
      </Botao>
      {estado?.erro && <span role="alert" className="ml-2 text-legenda text-perigo">{estado.erro}</span>}
    </form>
  );
}
