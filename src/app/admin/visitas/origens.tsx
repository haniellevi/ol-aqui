"use client";

import { useActionState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { salvarOrigem } from "./actions";

export type OrigemLinha = { codigo: string; nome: string; dominios: string[]; ordem: number; ativa: boolean };

function Linha({ o }: { o?: OrigemLinha }) {
  const [estado, acao, pendente] = useActionState(salvarOrigem, null);
  return (
    <form action={acao} className="grid grid-cols-2 items-end gap-2 border-b border-borda py-3 last:border-b-0 @3xl/painel:grid-cols-[1.2fr_2fr_5rem_7rem_auto]">
      {o ? <input type="hidden" name="codigo" value={o.codigo} /> : <input type="hidden" name="nova" value="1" />}
      <label className="text-sm font-medium text-beringela">
        Nome
        <input name="nome" defaultValue={o?.nome} required maxLength={60} placeholder={o ? undefined : "ex.: Feira de sábado"} className={estiloCampo} />
      </label>
      <label className="col-span-2 text-sm font-medium text-beringela @3xl/painel:col-span-1">
        Sites que contam como esta origem
        <input name="dominios" defaultValue={o?.dominios.join(", ")} placeholder="ex.: instagram.com" className={estiloCampo} />
      </label>
      <label className="text-sm font-medium text-beringela">
        Ordem
        <input name="ordem" type="number" min={0} max={9999} defaultValue={o?.ordem ?? 100} className={estiloCampo} />
      </label>
      <label className="text-sm font-medium text-beringela">
        Situação
        <select name="ativa" defaultValue={o ? String(o.ativa) : "true"} className={estiloCampo}>
          <option value="true">Ligada</option>
          <option value="false">Desligada</option>
        </select>
      </label>
      <Botao type="submit" variante={o ? "secundario" : "primario"} tamanho="pequeno" carregando={pendente}>{o ? "Salvar" : "Adicionar"}</Botao>
      {estado && <div className="col-span-full"><Aviso tipo={estado.erro ? "erro" : "ok"}>{estado.erro ?? estado.ok}</Aviso></div>}
    </form>
  );
}

export function Origens({ origens }: { origens: OrigemLinha[] }) {
  return (
    <div>
      {origens.map((o) => <Linha key={o.codigo} o={o} />)}
      <Linha />
    </div>
  );
}
