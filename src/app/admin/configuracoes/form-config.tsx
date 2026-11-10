"use client";

import { useActionState, useId } from "react";
import { Aviso, estiloBotaoSec, estiloCampo } from "@/components/admin/ui";
import { CampoBusca } from "@/components/admin/campo-busca";
import { emCentavos, valorParaForm, type Opcao, type TipoValor } from "@/lib/admin/config";
import { criarExcecao, salvarConfig } from "./actions";

/** Até este tanto de opções, lista simples; acima, campo com filtro digitando. */
const LISTA_CURTA = 6;

const AJUDA: Record<TipoValor, string> = {
  numero: "",
  texto: "Deixe vazio para não usar.",
  lista: "Um item por linha.",
  mapa: "Um item por linha, no formato: categoria = valor",
  json: "Formato JSON.",
  simnao: "",
};

function CampoValor({ tipo, valor, chave, opcoes }: { tipo: TipoValor; valor: unknown; chave: string; opcoes?: Opcao[] }) {
  const ajudaId = useId();
  const texto = valorParaForm(tipo, valor);
  const ajuda = [AJUDA[tipo], emCentavos(chave) ? "Valores em centavos (R$ 9,90 = 990)." : ""].filter(Boolean).join(" ");
  if (tipo === "simnao") {
    return (
      <select name="valor" aria-label={`Valor de ${chave}`} defaultValue={texto} className={estiloCampo}>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }
  if (opcoes && opcoes.length > LISTA_CURTA) {
    // lista longa: a pessoa digita algumas letras e a lista filtra na hora
    const comAtual = opcoes.some((o) => o.valor === texto) || !texto ? opcoes : [{ valor: texto, nome: `${texto} (valor atual, fora da lista)` }, ...opcoes];
    return <CampoBusca nome="valor" opcoes={comAtual} valorInicial={texto} rotulo={chave} placeholder="Digite parte do nome para filtrar" />;
  }
  if (opcoes && opcoes.length > 0) {
    const conhecido = opcoes.some((o) => o.valor === texto);
    return (
      <select name="valor" aria-label={`Valor de ${chave}`} defaultValue={texto} className={estiloCampo}>
        {!conhecido && <option value={texto}>{texto || "(vazio)"} (valor atual, fora da lista)</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
    );
  }
  return (
    <>
      {tipo === "numero" || tipo === "texto" ? (
        <input name="valor" aria-label={`Valor de ${chave}`} aria-describedby={ajuda ? ajudaId : undefined} defaultValue={texto} inputMode={tipo === "numero" ? "decimal" : "text"} className={estiloCampo} />
      ) : (
        <textarea
          name="valor"
          aria-label={`Valor de ${chave}`}
          aria-describedby={ajuda ? ajudaId : undefined}
          defaultValue={texto}
          rows={Math.min(8, Math.max(3, texto.split("\n").length))}
          className={`${estiloCampo} h-auto py-2 font-mono`}
        />
      )}
      {ajuda && <p id={ajudaId} className="mt-1 text-legenda text-texto-suave">{ajuda}</p>}
    </>
  );
}

export function FormConfig({ id, chave, tipo, valor, opcoes }: { id: string; chave: string; tipo: TipoValor; valor: unknown; opcoes?: Opcao[] }) {
  const [estado, acao, pendente] = useActionState(salvarConfig, null);
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <CampoValor tipo={tipo} valor={valor} chave={chave} opcoes={opcoes} />
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
  opcoes,
}: {
  chave: string;
  tipo: TipoValor;
  valor: unknown;
  regioes: { id: string; nome: string }[];
  opcoes?: Opcao[];
}) {
  const [estado, acao, pendente] = useActionState(criarExcecao, null);
  return (
    <details className="rounded-card bg-fundo px-3">
      <summary className="min-h-12 cursor-pointer py-3.5 text-sm font-semibold text-beringela">Criar exceção para uma região</summary>
      <form action={acao} className="space-y-2 pb-3">
        <input type="hidden" name="chave" value={chave} />
        <input type="hidden" name="tipo" value={tipo} />
        <select name="microrregiao_id" aria-label={`Região da exceção de ${chave}`} defaultValue="" className={estiloCampo}>
          <option value="" disabled>
            Escolha a região
          </option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
        <CampoValor tipo={tipo} valor={valor} chave={chave} opcoes={opcoes} />
        <button disabled={pendente} className={estiloBotaoSec}>
          {pendente ? "Criando…" : "Criar exceção"}
        </button>
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
    </details>
  );
}
