"use client";

import { useActionState } from "react";
import { Aviso, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { emCentavos, valorParaForm, type TipoValor } from "@/lib/admin/config";
import { criarExcecao, salvarConfig } from "./actions";

const AJUDA: Record<TipoValor, string> = {
  numero: "",
  texto: "Deixe vazio para não usar.",
  lista: "Um item por linha.",
  mapa: "Um item por linha, no formato: categoria = valor",
  json: "Formato JSON.",
};

function CampoValor({ tipo, valor, chave }: { tipo: TipoValor; valor: unknown; chave: string }) {
  const texto = valorParaForm(tipo, valor);
  const ajuda = [AJUDA[tipo], emCentavos(chave) ? "Valores em centavos (R$ 9,90 = 990)." : ""].filter(Boolean).join(" ");
  return (
    <>
      {tipo === "numero" || tipo === "texto" ? (
        <input name="valor" defaultValue={texto} inputMode={tipo === "numero" ? "decimal" : "text"} className={estiloCampo} />
      ) : (
        <textarea
          name="valor"
          defaultValue={texto}
          rows={Math.min(8, Math.max(3, texto.split("\n").length))}
          className={`${estiloCampo} h-auto py-2 font-mono`}
        />
      )}
      {ajuda && <p className="mt-1 text-[13px] text-texto-suave">{ajuda}</p>}
    </>
  );
}

export function FormConfig({ id, chave, tipo, valor }: { id: string; chave: string; tipo: TipoValor; valor: unknown }) {
  const [estado, acao, pendente] = useActionState(salvarConfig, null);
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <CampoValor tipo={tipo} valor={valor} chave={chave} />
      <div className="flex items-center gap-3">
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        {estado?.ok && <span className="text-sm font-semibold text-verde-escuro">{estado.ok}</span>}
      </div>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}

export function FormExcecao({
  chave,
  tipo,
  valor,
  regioes,
}: {
  chave: string;
  tipo: TipoValor;
  valor: unknown;
  regioes: { id: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState(criarExcecao, null);
  return (
    <details className="rounded-card bg-fundo px-3">
      <summary className="min-h-12 cursor-pointer py-3.5 text-sm font-semibold text-beringela">Criar exceção para uma região</summary>
      <form action={acao} className="space-y-2 pb-3">
        <input type="hidden" name="chave" value={chave} />
        <input type="hidden" name="tipo" value={tipo} />
        <select name="microrregiao_id" defaultValue="" className={estiloCampo}>
          <option value="" disabled>
            Escolha a região
          </option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
        <CampoValor tipo={tipo} valor={valor} chave={chave} />
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Criando…" : "Criar exceção"}
        </button>
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
    </details>
  );
}
