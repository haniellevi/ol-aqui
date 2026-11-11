"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { salvarCategoria } from "@/app/(conta)/anunciar/actions";
import type { Categoria, CategoriaComFilhas } from "@/lib/tipos";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar } from "./barra-continuar";
import { classesCampo } from "@/components/ui/input";

// Passo 2 · Categoria: primeiro a categoria grande (com ícone), depois o tipo (subcategoria).
// A busca filtra direto as subcategorias ("geladeira", "moto"...), sem ligar para acento.

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const OPCAO =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-card border border-borda bg-cartao p-3 pr-3 text-base font-semibold " +
  "hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 " +
  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

export function EscolhaCategoria({
  id,
  editar,
  formId,
  arvore,
  selecionadaId,
}: {
  id: string;
  editar: boolean;
  formId: string;
  arvore: CategoriaComFilhas[];
  selecionadaId: string | null;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarCategoria);
  const paiInicial = arvore.find((p) => p.filhas.some((f) => f.id === selecionadaId))?.id ?? null;
  const [paiId, setPaiId] = useState<string | null>(paiInicial);
  const [filhaId, setFilhaId] = useState<string | null>(selecionadaId);
  const [busca, setBusca] = useState("");

  const pai = arvore.find((p) => p.id === paiId) ?? null;
  const achadas = useMemo(() => {
    const q = semAcento(busca);
    if (!q) return [];
    const r: { filha: Categoria; pai: CategoriaComFilhas }[] = [];
    for (const p of arvore) {
      const paiBate = semAcento(p.nome).includes(q);
      for (const f of p.filhas) if (paiBate || semAcento(f.nome).includes(q)) r.push({ filha: f, pai: p });
    }
    return r;
  }, [busca, arvore]);

  const escolhida = arvore.flatMap((p) => p.filhas.map((f) => ({ f, p }))).find((x) => x.f.id === filhaId);
  const outros = arvore.find((p) => p.slug === "outros");
  const diversos = outros?.filhas.find((f) => f.slug === "diversos");

  function opcao(f: Categoria, p: CategoriaComFilhas, mostrarPai: boolean) {
    return (
      <li key={f.id}>
        <label className={OPCAO}>
          <input
            type="radio"
            name="escolha-categoria"
            value={f.id}
            checked={filhaId === f.id}
            onChange={() => {
              setFilhaId(f.id);
              setPaiId(p.id);
            }}
            className="sr-only"
          />
          <CirculoCategoria nome={f.icone || p.icone} />
          <span className="flex flex-1 flex-col">
            <span>{f.nome}</span>
            {mostrarPai && <span className="text-sm font-normal text-texto-suave">{p.nome}</span>}
          </span>
          {filhaId === f.id && <Check className="size-6 text-beringela" aria-hidden />}
        </label>
      </li>
    );
  }

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />
      <input type="hidden" name="categoria_id" value={filhaId ?? ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      {escolhida && (
        <p className="rounded-card bg-selecao p-3 text-base" aria-live="polite">
          Escolhida: <strong>{escolhida.p.nome} › {escolhida.f.nome}</strong>
          {selecionadaId && selecionadaId !== filhaId && (
            <span className="mt-1 block text-sm">A troca mantém os dados compatíveis. Os demais detalhes precisarão ser preenchidos na nova categoria.</span>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="busca-categoria" className="text-base font-semibold">
          Procurar categoria
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            id="busca-categoria"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: moto, geladeira, casa"
            autoComplete="off"
            className={`${classesCampo} h-10 pl-10`}
          />
        </div>
      </div>

      {busca.trim() ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold" aria-live="polite">
            {achadas.length ? `${achadas.length} ${achadas.length === 1 ? "encontrada" : "encontradas"}` : "Nenhuma categoria encontrada"}
          </legend>
          {achadas.length ? (
            <ul className="flex flex-col gap-2">{achadas.map(({ filha, pai: p }) => opcao(filha, p, true))}</ul>
          ) : (
            <>
              <p className="text-sm text-texto-suave">
                {diversos ? "Procure a categoria mais próxima. Se nenhuma servir, escolha Outros › Diversos." : "Tente uma palavra mais ampla ou veja a lista de categorias."}
              </p>
              <Botao variante="secundario" className="self-start" onClick={() => { setBusca(""); setPaiId(null); }}>Ver todas as categorias</Botao>
              {outros && diversos && <ul>{opcao(diversos, outros, true)}</ul>}
            </>
          )}
        </fieldset>
      ) : pai ? (
        <fieldset className="flex flex-col gap-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <legend className="text-base font-semibold">Qual destes em {pai.nome}?</legend>
            <Botao variante="texto" onClick={() => setPaiId(null)}>
              Trocar
            </Botao>
          </div>
          <ul className="flex flex-col gap-2">{pai.filhas.map((f) => opcao(f, pai, false))}</ul>
        </fieldset>
      ) : (
        <section aria-labelledby="titulo-grandes" className="flex flex-col gap-2">
          <h2 id="titulo-grandes" className="text-base font-semibold">
            Escolha a categoria
          </h2>
          <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            {arvore.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPaiId(p.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-card border border-borda bg-cartao p-3 text-left text-base font-semibold hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
                >
                  <CirculoCategoria nome={p.icone} />
                  <span className="flex-1">{p.nome}</span>
                  <ChevronRight className="size-5 text-texto-suave" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarraContinuar>
        <Botao type="submit" name="acao" value="seguir" larguraTotal carregando={enviando} textoCarregando="Salvando...">
          Continuar
        </Botao>
      </BarraContinuar>
    </form>
  );
}
