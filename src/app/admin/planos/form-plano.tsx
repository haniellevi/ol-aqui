"use client";

import { useActionState } from "react";
import { Aviso, estiloBotao, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
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
  vitrine_foto_fachada: boolean;
  vitrine_secoes_max: number | null;
  vitrine_fixados_max: number | null;
  recomendado: boolean;
};

export function FormPlano({ plano }: { plano?: Plano }) {
  const novo = !plano;
  const [estado, acao, pendente] = useActionState(novo ? criarPlano : salvarPlano, null);

  return (
    <form action={acao} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {novo ? (
        <label className="col-span-2 text-sm font-semibold md:col-span-1">
          Código
          <input name="codigo" required placeholder="ex.: ouro" className={estiloCampo} />
        </label>
      ) : (
        <input type="hidden" name="codigo" value={plano.codigo} />
      )}
      <label className="col-span-2 text-sm font-semibold">
        Nome
        <input name="nome" required defaultValue={plano?.nome} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Preço (R$/período)
        <input name="preco" inputMode="decimal" defaultValue={paraReaisInput(plano?.preco_centavos ?? 0)} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Dias do período
        <input name="periodo_dias" type="number" min={1} defaultValue={plano?.periodo_dias ?? 30} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
        Limite de anúncios
        <input name="limite_anuncios" type="number" min={0} placeholder="ilimitado" defaultValue={plano?.limite_anuncios ?? ""} className={estiloCampo} />
      </label>
      <label className="text-sm font-semibold">
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
      <label className="text-sm font-semibold">
        Para quem
        <select name="publico" defaultValue={plano?.publico ?? "todos"} className={estiloCampo}>
          <option value="todos">Todos</option>
          <option value="pf">Pessoa física</option>
          <option value="pj">Loja / empresa</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Ordem na tela
        <input name="ordem" type="number" defaultValue={plano?.ordem ?? 10} className={estiloCampo} />
      </label>
      <fieldset className="col-span-2 grid grid-cols-2 gap-3 rounded-card border border-borda p-3 md:col-span-4 md:grid-cols-4">
        <legend className="px-1 text-sm font-semibold">Vitrine da loja</legend>
        <label className="text-sm font-semibold">
          Seções próprias
          <input
            name="vitrine_secoes_max"
            type="number"
            min={0}
            placeholder="ilimitado"
            defaultValue={plano ? (plano.vitrine_secoes_max ?? "") : 0}
            className={estiloCampo}
          />
        </label>
        <label className="text-sm font-semibold">
          Produtos fixados no topo
          <input
            name="vitrine_fixados_max"
            type="number"
            min={0}
            placeholder="ilimitado"
            defaultValue={plano ? (plano.vitrine_fixados_max ?? "") : 0}
            className={estiloCampo}
          />
        </label>
        <label className="col-span-2 flex h-12 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="vitrine_foto_fachada" defaultChecked={plano?.vitrine_foto_fachada ?? false} className="size-5 accent-laranja-escuro" />
          Foto da fachada no banner
        </label>
        <p className="col-span-2 text-[13px] text-texto-suave md:col-span-4">
          0 = não tem o recurso; vazio = sem limite. Plano menor não apaga nada: o que passa do limite fica escondido na vitrine.
        </p>
      </fieldset>
      <label className="col-span-2 text-sm font-semibold md:col-span-4">
        Descrição (aparece para o cliente)
        <input name="descricao" defaultValue={plano?.descricao ?? ""} className={estiloCampo} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-4">
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="acesso_radar" defaultChecked={plano?.acesso_radar ?? true} className="size-5 accent-laranja-escuro" />
          Acessa o Radar
        </label>
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={plano?.ativo ?? true} className="size-5 accent-laranja-escuro" />
          Ativo (aparece para venda)
        </label>
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="recomendado" defaultChecked={plano?.recomendado ?? false} className="size-5 accent-laranja-escuro" />
          Recomendado na página de planos (só um)
        </label>
        <button disabled={pendente} className={`${novo ? estiloBotao : estiloBotaoSec} ml-auto`}>
          {pendente ? "Salvando…" : novo ? "Criar plano" : "Salvar"}
        </button>
      </div>
      {estado?.ok && <div className="col-span-2 md:col-span-4"><Aviso tipo="ok">{estado.ok}</Aviso></div>}
      {estado?.erro && <div className="col-span-2 md:col-span-4"><Aviso tipo="erro">{estado.erro}</Aviso></div>}
    </form>
  );
}
