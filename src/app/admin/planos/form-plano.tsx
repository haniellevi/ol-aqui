"use client";

import { useActionState } from "react";
import Link from "next/link";
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
    <form action={acao} className="grid grid-cols-2 items-end gap-3 @3xl/painel:grid-cols-4">
      {novo ? (
        <label className="col-span-2 text-sm font-medium @3xl/painel:col-span-1">
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
      {plano?.e_teste ? <div className="text-sm">
        <input type="hidden" name="periodo_dias" value={plano.periodo_dias} />
        <Link href="/admin/configuracoes?grupo=planos#teste.dias" className="font-semibold text-laranja-escuro underline">Ajustar duração do teste grátis</Link>
      </div> : <label className="text-sm font-medium">
        Dias do período
        <input name="periodo_dias" type="number" min={1} defaultValue={plano?.periodo_dias ?? 30} className={estiloCampo} />
      </label>}
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
      <fieldset className="col-span-2 grid grid-cols-2 items-end gap-3 rounded-card border border-borda p-3 @3xl/painel:col-span-4 @3xl/painel:grid-cols-4">
        <legend className="px-1 text-sm font-semibold">Vitrine da loja</legend>
        <label className="text-sm font-medium">
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
        <label className="text-sm font-medium">
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
        <label className="col-span-2 flex h-10 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="vitrine_foto_fachada" defaultChecked={plano?.vitrine_foto_fachada ?? false} className="size-5 accent-laranja-escuro" />
          Foto da fachada no banner
        </label>
        <p className="col-span-2 text-legenda text-texto-suave @3xl/painel:col-span-4">
          0 = não tem o recurso; vazio = sem limite. Plano menor não apaga nada: o que passa do limite fica escondido na vitrine.
        </p>
      </fieldset>
      <label className="col-span-2 text-sm font-medium @3xl/painel:col-span-4">
        Descrição (aparece para o cliente)
        <textarea name="descricao" rows={2} defaultValue={plano?.descricao ?? ""} className={`${estiloCampo} h-auto min-h-20 py-2 leading-relaxed`} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 @3xl/painel:col-span-4">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="acesso_radar" defaultChecked={plano?.acesso_radar ?? true} className="size-5 accent-laranja-escuro" />
          Acessa o Radar
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={plano?.ativo ?? true} className="size-5 accent-laranja-escuro" />
          Ativo (aparece para venda)
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="recomendado" defaultChecked={plano?.recomendado ?? false} className="size-5 accent-laranja-escuro" />
          Recomendado na página de planos (só um)
        </label>
        <button disabled={pendente} className={`${novo ? estiloBotao : estiloBotaoSec} ml-auto`}>
          {pendente ? "Salvando…" : novo ? "Criar plano" : "Salvar"}
        </button>
      </div>
      {estado?.ok && <div className="col-span-2 @3xl/painel:col-span-4"><Aviso tipo="ok">{estado.ok}</Aviso></div>}
      {estado?.erro && <div className="col-span-2 @3xl/painel:col-span-4"><Aviso tipo="erro">{estado.erro}</Aviso></div>}
    </form>
  );
}
