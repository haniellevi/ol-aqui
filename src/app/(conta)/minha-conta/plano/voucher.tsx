"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Aviso } from "@/components/conta/aviso";
import { resgatarVoucher } from "./voucher-actions";

export function Voucher({ codigos }: { codigos: { codigo: string; valido_ate: string; reservado_em: string | null }[] }) {
  const [estado, acao, pendente] = useActionState(resgatarVoucher, null);
  return <section className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1" aria-labelledby="titulo-cupom">
    <h2 id="titulo-cupom" className="text-lg font-bold">Cupom de lançamento</h2>
    <p className="text-sm text-texto-suave">Aplique seu cupom para usar o plano completo por três meses, sem cobrança. Se houver um plano vigente ou cobrança pendente, o benefício pode ficar reservado para você ativar depois.</p>
    {codigos.map((v) => <p key={v.codigo} className="rounded-campo bg-selecao p-3 text-sm">Seu cupom: <strong>{v.codigo}</strong> · {v.reservado_em ? "reservado para ativação posterior" : `use até ${new Date(new Date(v.valido_ate).getTime() - 1).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}.</p>)}
    <form action={acao} className="flex flex-col gap-3">
      <Campo rotulo="Código do cupom" name="codigo" autoComplete="off" maxLength={32} required />
      <Botao type="submit" carregando={pendente}>Aplicar cupom</Botao>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
    </form>
  </section>;
}
