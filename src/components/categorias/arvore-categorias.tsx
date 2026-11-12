"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { ehFolha, linkCanonico, nomeCaminho, percorrerLeve, sugerirPorTexto, type CategoriaLeve, type NoLeve } from "@/lib/categorias-arvore";
import { guardarRecente, lerRecentes } from "@/lib/categorias-recentes";

// Árvore de categorias em até 3 níveis (Grande › Sub › Tipo), igual para quem anuncia e quem procura.
// A lista abre no próprio lugar: a categoria tocada sobe para o caminho (com seta para voltar)
// e as de dentro aparecem logo abaixo. Sem painel deslizando e sem animação de entrada.
// - "escolher" (anunciar): a categoria final vira um item de escolha (radio), a mãe só abre.
// - "navegar" (procurar): tudo é link; a mãe aberta mostra "Ver tudo em ...".
// Com texto na busca, mostra as categorias mais parecidas (busca local, sem IA), com o caminho.

const LINHA =
  "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-card border border-borda bg-cartao p-3 text-left text-base font-semibold " +
  "hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

const OPCAO =
  `${LINHA} has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 ` +
  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

const VOLTA =
  "flex min-h-10 w-full items-center gap-2 rounded-campo px-2 text-left text-base text-texto-suave hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

type Props = {
  arvore: CategoriaLeve[];
  /** Texto digitado (o campo fica com quem usa a árvore). */
  busca: string;
  modo: "escolher" | "navegar";
  /** escolher: categoria marcada. */
  selecionadaId?: string | null;
  aoEscolher?: (x: NoLeve) => void;
  /** navegar: chamado ao tocar num link (ex.: fechar a folha). */
  aoNavegar?: () => void;
  /** O que mostrar quando a busca não acha nada. */
  semResultado?: ReactNode;
};

export function ArvoreCategorias({ arvore, busca, modo, selecionadaId = null, aoEscolher, aoNavegar, semResultado }: Props) {
  const todos = useMemo(() => percorrerLeve(arvore), [arvore]);
  // Abre já no nível da escolhida (editar anúncio): as mães dela ficam no caminho.
  const [abertas, setAbertas] = useState<string[]>(
    () => todos.find((x) => x.no.id === selecionadaId)?.caminho.slice(0, -1).map((c) => c.id) ?? [],
  );
  const [recentes, setRecentes] = useState<NoLeve[]>([]);

  useEffect(() => {
    const ids = lerRecentes();
    setRecentes(ids.map((id) => todos.find((x) => x.no.id === id)).filter((x): x is NoLeve => !!x && (modo === "navegar" || ehFolha(x.no))));
  }, [todos, modo]);

  const caminhoAberto = useMemo(() => {
    let nivel = arvore;
    const caminho: CategoriaLeve[] = [];
    for (const id of abertas) {
      const no = nivel.find((c) => c.id === id);
      if (!no) break;
      caminho.push(no);
      nivel = no.filhas;
    }
    return caminho;
  }, [abertas, arvore]);

  const achadas = useMemo(() => sugerirPorTexto(arvore, busca), [arvore, busca]);

  function escolher(x: NoLeve) {
    guardarRecente(x.no.id);
    aoEscolher?.(x);
  }

  function navegou(id: string) {
    guardarRecente(id);
    aoNavegar?.();
  }

  // Uma categoria na lista: final escolhe/abre o link; com filhas, abre a lista de dentro.
  function item({ no, caminho }: NoLeve, mostrarCaminho: boolean) {
    const icone = <CirculoCategoria nome={no.icone || caminho[0].icone} />;
    const nome = (
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{no.nome}</span>
        {mostrarCaminho && caminho.length > 1 && (
          <span className="text-sm font-normal text-texto-suave">{nomeCaminho(caminho.slice(0, -1))}</span>
        )}
      </span>
    );
    if (!ehFolha(no) && !mostrarCaminho) {
      return (
        <li key={no.id}>
          <button type="button" onClick={() => setAbertas(caminho.map((c) => c.id))} className={LINHA} aria-label={`${no.nome}: ver as de dentro`}>
            {icone}
            {nome}
            <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
          </button>
        </li>
      );
    }
    if (modo === "navegar") {
      return (
        <li key={no.id}>
          <Link href={linkCanonico(caminho)} onClick={() => navegou(no.id)} className={LINHA}>
            {icone}
            {nome}
            <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
          </Link>
        </li>
      );
    }
    const marcada = selecionadaId === no.id;
    return (
      <li key={no.id}>
        <label className={OPCAO}>
          <input
            type="radio"
            name="escolha-categoria"
            value={no.id}
            checked={marcada}
            onChange={() => escolher({ no, caminho })}
            className="sr-only"
          />
          {icone}
          {nome}
          {marcada && <Check className="size-6 shrink-0 text-beringela" aria-hidden />}
        </label>
      </li>
    );
  }

  const lista = (nos: CategoriaLeve[], antes: CategoriaLeve[]) => nos.map((no) => item({ no, caminho: [...antes, no] }, false));

  // 1) Com texto: as mais parecidas.
  if (busca.trim()) {
    return (
      <section aria-labelledby="titulo-achadas" className="flex flex-col gap-2">
        <h2 id="titulo-achadas" className="text-base font-semibold" aria-live="polite">
          {achadas.length ? (achadas.length === 1 ? "1 categoria parecida" : `${achadas.length} categorias parecidas`) : "Nenhuma categoria parecida"}
        </h2>
        {achadas.length ? <ul className="flex flex-col gap-2">{achadas.map((x) => item(x, true))}</ul> : semResultado}
      </section>
    );
  }

  // 2) Uma categoria aberta: caminho em cima (toque para voltar) e as de dentro embaixo.
  if (caminhoAberto.length) {
    const atual = caminhoAberto[caminhoAberto.length - 1];
    return (
      <section aria-labelledby="titulo-aberta" className="flex flex-col gap-2">
        <nav aria-label="Caminho da categoria">
          <ol className="flex flex-col">
            <li>
              <button type="button" onClick={() => setAbertas([])} className={VOLTA}>
                <ChevronLeft className="size-5 shrink-0" aria-hidden />
                Todas as categorias
              </button>
            </li>
            {caminhoAberto.slice(0, -1).map((c, i) => (
              <li key={c.id} className={i === 0 ? "pl-3" : "pl-6"}>
                <button type="button" onClick={() => setAbertas(abertas.slice(0, i + 1))} className={VOLTA}>
                  <ChevronLeft className="size-5 shrink-0" aria-hidden />
                  {c.nome}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex items-center gap-3">
          <CirculoCategoria nome={atual.icone || caminhoAberto[0].icone} />
          <h2 id="titulo-aberta" className="text-titulo font-semibold text-beringela">
            {atual.nome}
          </h2>
        </div>
        <ul className="flex flex-col gap-2">
          {modo === "navegar" && (
            <li>
              <Link href={linkCanonico(caminhoAberto)} onClick={() => navegou(atual.id)} className={LINHA}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-borda text-beringela">
                  <LayoutGrid className="size-5" aria-hidden />
                </span>
                <span className="flex-1">Ver tudo em {atual.nome}</span>
                <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
              </Link>
            </li>
          )}
          {lista(atual.filhas, caminhoAberto)}
        </ul>
      </section>
    );
  }

  // 3) Início: as usadas há pouco e as categorias grandes.
  return (
    <div className="flex flex-col gap-4">
      {recentes.length > 0 && (
        <section aria-labelledby="titulo-recentes" className="flex flex-col gap-2">
          <h2 id="titulo-recentes" className="text-base font-semibold">
            Usadas há pouco
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
            {recentes.map((x) => (
              <li key={x.no.id}>
                {modo === "navegar" ? (
                  <Chip href={linkCanonico(x.caminho)} onClick={() => navegou(x.no.id)}>
                    {x.no.nome}
                  </Chip>
                ) : (
                  <Chip ativo={selecionadaId === x.no.id} onClick={() => escolher(x)} aria-label={nomeCaminho(x.caminho)}>
                    {x.no.nome}
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="titulo-grandes" className="flex flex-col gap-2">
        <h2 id="titulo-grandes" className="text-base font-semibold">
          {modo === "navegar" ? "Categorias" : "Ou escolha na lista"}
        </h2>
        <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">{lista(arvore, [])}</ul>
      </section>
    </div>
  );
}
