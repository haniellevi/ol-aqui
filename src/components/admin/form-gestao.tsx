"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import type { LocalidadesGestao } from "@/lib/admin/gestao";
import type { EstadoForm } from "@/lib/admin/estado";

/** Dispara a ação sem o reset automático do formulário, preservando dados após erros. */
export function useGestaoForm(salvar: (estado: EstadoForm, dados: FormData) => Promise<EstadoForm>) {
  const [estado, acao, pendente] = useActionState(salvar, null);
  const formulario = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (estado?.ok) formulario.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(campo => { campo.value = ""; });
  }, [estado]);
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendente) return;
    formulario.current = e.currentTarget;
    const dados = new FormData(e.currentTarget);
    startTransition(() => acao(dados));
  }
  return [estado, enviar, pendente] as const;
}

export function RetornoGestao({ estado }: { estado: EstadoForm }) {
  return estado?.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}
export function CampoGestao({ rotulo, ...props }: React.ComponentProps<"input"> & { rotulo: string }) {
  return <label className="block text-sm font-semibold">{rotulo}<input {...props} className={estiloCampo} /></label>;
}
export function TextoGestao({ rotulo, ...props }: React.ComponentProps<"textarea"> & { rotulo: string }) {
  return <label className="block text-sm font-semibold">{rotulo}<textarea {...props} className={`${estiloCampo} min-h-28 py-2`} /></label>;
}
export function MotivoGestao() {
  return <CampoGestao rotulo="Motivo da alteração (registrado no histórico)" name="motivo" required minLength={3} maxLength={300} />;
}
export function LocalidadeGestao({ locais, regiao, cidade, obrigatoria = false }: {
  locais: LocalidadesGestao; regiao?: string; cidade?: string | null; obrigatoria?: boolean;
}) {
  const [atual, setAtual] = useState(regiao ?? "");
  return <>
    <label className="block text-sm font-semibold">Região
      <select name="microrregiao_id" required value={atual} onChange={e => setAtual(e.target.value)} className={estiloCampo}>
        <option value="">Selecione</option>
        {locais.regioes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold">Cidade
      <select key={atual} name="cidade" required={obrigatoria} defaultValue={atual === regiao ? cidade ?? "" : ""} className={estiloCampo}>
        <option value="">Selecione</option>
        {locais.cidades.filter(c => c.microrregiao_id === atual).map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
      </select>
    </label>
  </>;
}
