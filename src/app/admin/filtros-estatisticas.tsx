"use client";

import { useState } from "react";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";

export type PeriodoEstatisticas = "mes" | "ano" | "historico";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Props = {
  periodoInicial: PeriodoEstatisticas;
  anoInicial: number;
  mesInicial: number;
  anoAtual: number;
  mesAtual: number;
  primeiroAno: number;
  regiao: string | null;
  regioes: { id: string; nome: string }[];
};

export function FiltrosEstatisticas({ periodoInicial, anoInicial, mesInicial, anoAtual, mesAtual, primeiroAno, regiao, regioes }: Props) {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const meses = MESES.slice(0, ano === anoAtual ? mesAtual : 12);
  const anos = Array.from({ length: anoAtual - primeiroAno + 1 }, (_, i) => anoAtual - i);

  return (
    <Cartao className="mb-4">
      <form action="/admin" method="get" className="grid grid-cols-1 items-end gap-3 @sm/painel:grid-cols-2 @4xl/painel:grid-cols-5">
        <label className="text-sm font-semibold text-beringela">
          Região
          <select name="regiao" defaultValue={regiao ?? ""} className={estiloCampo}>
            <option value="">Todas as regiões</option>
            {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-beringela">
          Período
          <select name="periodo" value={periodo} className={estiloCampo} onChange={(e) => setPeriodo(e.target.value as PeriodoEstatisticas)}>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
            <option value="historico">Histórico completo</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-beringela">
          Ano
          <select name="ano" value={ano} disabled={periodo === "historico"} className={estiloCampo} onChange={(e) => {
            const novoAno = Number(e.target.value);
            setAno(novoAno);
            if (novoAno === anoAtual && mes > mesAtual) setMes(mesAtual);
          }}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-beringela">
          Mês
          <select name="mes" value={mes} disabled={periodo !== "mes"} className={estiloCampo} onChange={(e) => setMes(Number(e.target.value))}>
            {meses.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <Botao type="submit" className="w-full">Aplicar filtros</Botao>
      </form>
    </Cartao>
  );
}
