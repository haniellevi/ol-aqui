"use client";

import { useActionState } from "react";
import { Aviso, estiloBotao, estiloCampo } from "@/components/admin/ui";
import { paraReaisInput } from "@/lib/admin/formato";
import { criarPlano, salvarPlano } from "./actions";

export type Plano = {
  codigo: string;
  nome: string;
  descricao: string | null;
  publico: "pf" | "pj" | "todos";
  preco_centavos: number;
  periodo_dias: number;
  limite_anuncios: number | null;
  acesso_radar: boolean;
  propostas_radar_mes: number | null;
  e_teste: boolean;
  ordem: number;
  ativo: boolean;
};

export function FormPlano({ plano }: { plano?: Plano }) {
  const novo = !plano;
  const [estado, acao, pendente] = useActionState(novo ? criarPlano : salvarPlano, null);

  return (
    <form action={acao} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {novo ? (
        <label className="col-span-2 text-sm font-medium md:col-span-1">
          Código
          <input name="codigo" required placeholder="ex.: ouro" className={estiloCampo} />
        </label>
      ) : (
        <input type="hidden" name="codigo" value={plano.codigo} />
      )}
      <label className="col-span-2 text-sm font-medium">
        Nome
        <input name="nome" required defaultValue={plano?.nome} className={estiloCampo} />
      </label>
      <label className="text-sm font-medium">
        Preço (R$/período)
        <input name="preco" inputMode="decimal" defaultValue={paraReaisInput(plano?.preco_centavos ?? 0)} className={estiloCampo} />
      </label>
      <label className="text-sm font-medium">
        Dias do período
        <input name="periodo_dias" type="number" min={1} defaultValue={plano?.periodo_dias ?? 30} className={estiloCampo} />
      </label>
      <label className="text-sm font-medium">
        Limite de anúncios
        <input name="limite_anuncios" type="number" min={0} placeholder="ilimitado" defaultValue={plano?.limite_anuncios ?? ""} className={estiloCampo} />
      </label>
      <label className="text-sm font-medium">
        Propostas no Radar/mês
        <input
          name="propostas_radar_mes"
          type="number"
          min={0}
          placeholder="ilimitado"
          defaultValue={plano?.propostas_radar_mes ?? ""}
          className={estiloCampo}
        />
      </label>
      <label className="text-sm font-medium">
        Para quem
        <select name="publico" defaultValue={plano?.publico ?? "todos"} className={estiloCampo}>
          <option value="todos">Todos</option>
          <option value="pf">Pessoa física</option>
          <option value="pj">Loja / empresa</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Ordem na tela
        <input name="ordem" type="number" defaultValue={plano?.ordem ?? 10} className={estiloCampo} />
      </label>
      <label className="col-span-2 text-sm font-medium md:col-span-4">
        Descrição (aparece para o cliente)
        <input name="descricao" defaultValue={plano?.descricao ?? ""} className={estiloCampo} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-4">
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="acesso_radar" defaultChecked={plano?.acesso_radar ?? true} className="size-5 accent-orange-500" />
          Acessa o Radar
        </label>
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={plano?.ativo ?? true} className="size-5 accent-orange-500" />
          Ativo (aparece para venda)
        </label>
        <button disabled={pendente} className={`${estiloBotao} ml-auto`}>
          {pendente ? "Salvando…" : novo ? "Criar plano" : "Salvar"}
        </button>
      </div>
      {estado?.ok && <div className="col-span-2 md:col-span-4"><Aviso tipo="ok">{estado.ok}</Aviso></div>}
      {estado?.erro && <div className="col-span-2 md:col-span-4"><Aviso tipo="erro">{estado.erro}</Aviso></div>}
    </form>
  );
}
