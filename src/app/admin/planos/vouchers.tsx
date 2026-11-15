"use client";

import { useActionState } from "react";
import { Aviso, estiloBotao, estiloCampo } from "@/components/admin/ui";
import { salvarVoucher } from "./voucher-actions";

export type CampanhaVoucher = { id: string; codigo: string; valido_ate: string; ativo: boolean };
export function FormVoucher({ campanha }: { campanha?: CampanhaVoucher }) {
  const [estado, acao, pendente] = useActionState(salvarVoucher, null);
  const dia = campanha ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(new Date(campanha.valido_ate).getTime() - 1)) : "";
  return <form action={acao} className="flex flex-wrap items-end gap-3 rounded-card border border-borda p-4">
    {campanha ? <><input type="hidden" name="id" value={campanha.id} /><strong>{campanha.codigo}</strong></> : <label className="text-sm font-medium">Código do cupom<input name="codigo" required maxLength={32} className={estiloCampo} placeholder="LANCAMENTO2026" /></label>}
    <label className="text-sm font-medium">Válido para resgate até<input name="validade" type="date" required defaultValue={dia} className={estiloCampo} /></label>
    {campanha && <label className="flex min-h-10 items-center gap-2 text-sm"><input name="ativo" type="checkbox" defaultChecked={campanha.ativo} /> Ativo</label>}
    <button type="submit" disabled={pendente} className={estiloBotao}>{pendente ? "Salvando..." : campanha ? "Salvar" : "Criar cupom"}</button>
    {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
  </form>;
}
