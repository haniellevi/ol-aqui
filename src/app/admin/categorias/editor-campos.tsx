"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { TIPOS_CAMPO } from "@/lib/admin/regras-cadastros";
import type { TipoCampo } from "@/lib/tipos";
import type { CampoEditado } from "@/lib/tipos-cadastros";

// Editor dos campos que a subcategoria pede no anúncio (tela 9). Vai para o servidor como JSON no
// campo escondido "campos"; o servidor e o banco conferem tudo de novo antes de gravar.
// A chave de cada campo sai do nome na criação e não muda depois (os anúncios guardam o valor por ela).

const rotulo = "block text-sm font-semibold text-beringela";

type Item = CampoEditado & { _id: number };

const vazio = (): CampoEditado => ({
  chave: "",
  rotulo: "",
  tipo: "texto",
  obrigatorio: false,
  filtro: false,
  opcoes: "",
  unidade: "",
  min: "",
  max: "",
});

export function EditorCampos({ inicial, temAnuncios }: { inicial: CampoEditado[]; temAnuncios: boolean }) {
  const proximo = useRef(inicial.length);
  const [itens, setItens] = useState<Item[]>(() => inicial.map((c, i) => ({ ...c, _id: i })));

  const mudar = (id: number, parte: Partial<CampoEditado>) => setItens((l) => l.map((c) => (c._id === id ? { ...c, ...parte } : c)));
  const mover = (i: number, d: -1 | 1) =>
    setItens((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const tirar = (c: Item) => {
    if (c.chave && temAnuncios && !window.confirm(`Tirar o campo "${c.rotulo}"? Os anúncios guardam o valor, mas ele deixa de aparecer.`)) return;
    setItens((l) => l.filter((x) => x._id !== c._id));
  };
  const adicionar = () => setItens((l) => [...l, { ...vazio(), _id: proximo.current++ }]);

  const json = JSON.stringify(itens.map(({ _id, ...c }) => c)); // eslint-disable-line @typescript-eslint/no-unused-vars

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold text-beringela">Campos do anúncio</legend>
      <p className="text-[13px] text-texto-suave">
        O que o vendedor preenche no passo &quot;Detalhes&quot;. &quot;Vira filtro&quot; faz o campo aparecer nos filtros da busca.
      </p>
      <input type="hidden" name="campos" value={json} />

      {itens.length === 0 && (
        <p className="rounded-card bg-fundo px-4 py-3 text-sm text-texto-suave">
          Nenhum campo: o vendedor só escreve título e descrição. Toque em &quot;Adicionar campo&quot; para pedir mais (ex.: Marca, Ano).
        </p>
      )}

      <ol className="space-y-3">
        {itens.map((c, i) => {
          const base = `campo-${c._id}`;
          return (
            <li key={c._id} className="rounded-card border border-borda bg-cartao p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${base}-nome`} className={rotulo}>
                    Campo {i + 1}: nome
                  </label>
                  <input
                    id={`${base}-nome`}
                    value={c.rotulo}
                    onChange={(e) => mudar(c._id, { rotulo: e.target.value })}
                    maxLength={60}
                    required
                    placeholder="Ex.: Ano"
                    className={estiloCampo}
                  />
                </div>
                <div className="flex shrink-0 gap-1 pt-6">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir o campo ${c.rotulo || i + 1}`}
                    className="inline-flex size-12 items-center justify-center rounded-card border border-borda text-beringela hover:bg-fundo disabled:opacity-40"
                  >
                    <ArrowUp className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === itens.length - 1}
                    aria-label={`Descer o campo ${c.rotulo || i + 1}`}
                    className="inline-flex size-12 items-center justify-center rounded-card border border-borda text-beringela hover:bg-fundo disabled:opacity-40"
                  >
                    <ArrowDown className="size-5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-3" role="group" aria-label={`Tipo do campo ${c.rotulo || i + 1}`}>
                <p className={rotulo}>Tipo</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TIPOS_CAMPO.map((t) => (
                    <Chip key={t.valor} ativo={c.tipo === t.valor} onClick={() => mudar(c._id, { tipo: t.valor as TipoCampo })}>
                      {t.rotulo}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1 text-[13px] text-texto-suave">{TIPOS_CAMPO.find((t) => t.valor === c.tipo)?.dica}</p>
                {c.chave && temAnuncios && (
                  <p className="mt-1 text-[13px] text-aviso">Este campo já pode ter valores nos anúncios: mudar o tipo pode deixar valores antigos fora dos filtros.</p>
                )}
              </div>

              {c.tipo === "lista" && (
                <div className="mt-3">
                  <label htmlFor={`${base}-opcoes`} className={rotulo}>
                    Opções (uma por linha)
                  </label>
                  <textarea
                    id={`${base}-opcoes`}
                    value={c.opcoes}
                    onChange={(e) => mudar(c._id, { opcoes: e.target.value })}
                    rows={4}
                    placeholder={"Manual\nAutomático"}
                    className={`${estiloCampo} h-auto py-2`}
                  />
                </div>
              )}

              {c.tipo === "numero" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor={`${base}-unidade`} className={rotulo}>
                      Unidade
                    </label>
                    <input id={`${base}-unidade`} value={c.unidade} onChange={(e) => mudar(c._id, { unidade: e.target.value })} maxLength={12} placeholder="km" className={estiloCampo} />
                  </div>
                  <div>
                    <label htmlFor={`${base}-min`} className={rotulo}>
                      Mínimo
                    </label>
                    <input id={`${base}-min`} value={c.min} onChange={(e) => mudar(c._id, { min: e.target.value })} inputMode="decimal" placeholder="—" className={estiloCampo} />
                  </div>
                  <div>
                    <label htmlFor={`${base}-max`} className={rotulo}>
                      Máximo
                    </label>
                    <input id={`${base}-max`} value={c.max} onChange={(e) => mudar(c._id, { max: e.target.value })} inputMode="decimal" placeholder="—" className={estiloCampo} />
                  </div>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-6">
                <label className="flex min-h-12 items-center gap-2 text-base text-beringela">
                  <input type="checkbox" checked={c.obrigatorio} onChange={(e) => mudar(c._id, { obrigatorio: e.target.checked })} className="size-5 accent-laranja-escuro" />
                  Obrigatório
                </label>
                <label className="flex min-h-12 items-center gap-2 text-base text-beringela">
                  <input type="checkbox" checked={c.filtro} onChange={(e) => mudar(c._id, { filtro: e.target.checked })} className="size-5 accent-laranja-escuro" />
                  Vira filtro na busca
                </label>
                <Botao type="button" variante="perigo" onClick={() => tirar(c)} icone={<Trash2 />} className="ml-auto">
                  Tirar campo
                </Botao>
              </div>
            </li>
          );
        })}
      </ol>

      <Botao type="button" variante="secundario" onClick={adicionar} icone={<Plus />}>
        Adicionar campo
      </Botao>
    </fieldset>
  );
}
