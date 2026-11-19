"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Aviso } from "@/components/conta/aviso";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { diaDoCupom } from "@/lib/cupons";
import { resgatarVoucher } from "./voucher-actions";

type Cupom = { codigo: string; valido_ate: string | null; reservado_em: string | null; duracao_dias: number };

export function Voucher({ codigos }: { codigos: Cupom[] }) {
  const [estado, acao, pendente] = useActionState(resgatarVoucher, null);
  return (
    <Card id="cupom" role="region" aria-labelledby="titulo-cupom" className="scroll-mt-24">
      <CardHeader>
        <h2 id="titulo-cupom" className="text-lg font-semibold">Tem um cupom?</h2>
        <p className="text-base text-texto-suave">Digite o código para começar a usar o plano Promocional hoje.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {codigos.map((v) => <p key={v.codigo} className="text-base [overflow-wrap:anywhere]">
          Seu cupom <strong>{v.codigo}</strong> dá {v.duracao_dias} {v.duracao_dias === 1 ? "dia" : "dias"} de acesso.
          {v.valido_ate && !v.reservado_em && ` Ative até ${diaDoCupom.format(new Date(Date.parse(v.valido_ate) - 1)).split("-").reverse().join("/")}.`}
        </p>)}
        <form action={acao} className="flex flex-col gap-3">
          <Campo id="codigo-cupom" rotulo="Código do cupom" name="codigo" autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={4} maxLength={32} tamanho="toque" required erro={estado?.erro} />
          <Botao type="submit" variante="secundario" tamanho="toque" className="self-start" carregando={pendente}>Ativar cupom</Botao>
          {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        </form>
      </CardContent>
    </Card>
  );
}
