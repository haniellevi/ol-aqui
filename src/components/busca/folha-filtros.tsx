"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { ID_FOLHA, ID_RESULTADOS, ORDENS, lerEstadoBusca, paramCampo, type EstadoBusca } from "@/components/busca/parametros";
import { inteiro, valorDoCampo } from "@/lib/formato";
import type { CampoCategoria, CategoriaComFilhas, Cidade, FacetaBusca, FacetasBusca } from "@/lib/tipos";
import { classesCampo } from "@/components/ui/input";

// GET e :target preservam a busca sem JavaScript. Com JS, o diálogo nativo cuida
// do foco, do fundo inativo e do Escape; os valores são validados também no servidor.

const SELECT = `${classesCampo} h-10`;
const ENTRADA = SELECT;
// Chip de escolha (igual ao <Chip>): selecionado = borda laranja-escuro, fundo laranja-claro, texto beringela e ✓.
const OPCAO =
  "group inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-campo border border-borda bg-cartao px-4 text-base font-semibold text-beringela " +
  "has-checked:border-laranja-escuro has-checked:bg-selecao " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-laranja-escuro";
const LEGENDA = "mb-2 text-base font-semibold";

export function FolhaFiltros({
  caminho,
  estado,
  campos,
  facetas,
  cidades,
  categorias,
}: {
  /** Para onde o formulário vai (a própria página). */
  caminho: string;
  estado: EstadoBusca;
  /** Campos da subcategoria marcados como filtro. */
  campos: CampoCategoria[];
  facetas?: FacetasBusca | null;
  cidades: Cidade[];
  /** Mostra a escolha de categoria (só na tela de busca). */
  categorias?: CategoriaComFilhas[];
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pronto, setPronto] = useState(false);
  const [categoria, setCategoria] = useState(estado.categoria);
  const [erros, setErros] = useState(estado.erros);
  const escolhida = categorias?.flatMap((p) => [p, ...p.filhas]).find((c) => c.slug === categoria);
  const filtraveis = (categorias ? escolhida?.campos ?? [] : campos).filter((c) => c.filtro);
  const estadoCampos = categoria === estado.categoria ? estado : { ...estado, valores: {} };
  const facetasAtuais = categoria === estado.categoria ? facetas : null;
  const limpar = estado.q ? `${caminho}?q=${encodeURIComponent(estado.q)}` : caminho;

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    setPronto(true);
    let retorno: HTMLElement | null = null;
    let overflow: string | null = null;
    const liberar = () => {
      if (overflow != null) document.body.style.overflow = overflow;
      overflow = null;
      if (retorno?.isConnected) retorno.focus({ preventScroll: true });
      retorno = null;
    };
    const alvoAtual = () => document.getElementById(window.location.hash.slice(1));
    const lembrarOrigem = (evento: MouseEvent) => {
      const link = evento.target instanceof Element ? evento.target.closest("a") : null;
      if (el.open || !link || link.origin !== window.location.origin || link.pathname !== window.location.pathname || link.search !== window.location.search) return;
      const alvo = document.getElementById(link.hash.slice(1));
      if (alvo && (alvo === el || el.contains(alvo))) retorno = link;
    };
    const sincronizar = () => {
      const alvo = alvoAtual();
      if (alvo && (alvo === el || el.contains(alvo))) {
        if (!el.open) {
          retorno ??= document.activeElement instanceof HTMLElement && !el.contains(document.activeElement) ? document.activeElement : null;
          overflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          el.querySelector("form")?.reset();
          setCategoria(estado.categoria);
          setErros(estado.erros);
          el.showModal();
          el.querySelector<HTMLElement>("form a")?.focus({ preventScroll: true });
        }
        if (alvo !== el) {
          alvo.scrollIntoView({ block: "nearest" });
          alvo.querySelector<HTMLElement>("select, input:not([type=hidden]), button")?.focus({ preventScroll: true });
        }
      } else if (el.open) el.close();
    };
    const fechar = () => {
      const alvo = alvoAtual();
      if (alvo && (alvo === el || el.contains(alvo))) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      liberar();
    };
    window.addEventListener("hashchange", sincronizar);
    document.addEventListener("click", lembrarOrigem, true);
    el.addEventListener("close", fechar);
    sincronizar();
    return () => {
      window.removeEventListener("hashchange", sincronizar);
      document.removeEventListener("click", lembrarOrigem, true);
      el.removeEventListener("close", fechar);
      if (el.open) el.close();
      liberar();
    };
  }, [estado]);

  function validar(evento: FormEvent<HTMLFormElement>) {
    const form = evento.currentTarget;
    const dados = new FormData(form);
    const sp = Object.fromEntries([...new Set(dados.keys())].map((k) => [k, dados.getAll(k).map(String)]));
    const novos = lerEstadoBusca(sp, filtraveis, !!categorias).erros;
    if (categorias && categoria && !escolhida) novos.categoria = "Escolha uma categoria disponível.";
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      evento.preventDefault();
      const campo = form.elements.namedItem(primeiro);
      if (campo instanceof HTMLElement) campo.focus();
    }
  }

  return (
    <dialog
      ref={dialogo}
      id={ID_FOLHA}
      data-pronto={pronto}
      aria-labelledby="titulo-filtros"
      className="fixed inset-0 z-40 m-0 hidden h-dvh max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 text-texto backdrop:bg-transparent open:flex data-[pronto=false]:target:flex data-[pronto=false]:has-[:target]:flex md:items-center md:p-6"
    >
      <a href={`#${ID_RESULTADOS}`} tabIndex={-1} aria-hidden className="absolute inset-0 bg-beringela/50" />
      <section
        aria-labelledby="titulo-filtros"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-folha bg-cartao shadow-2 md:rounded-folha"
      >
        <form action={caminho} method="get" onSubmit={validar} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-borda py-1 pl-4 pr-1">
            <h2 id="titulo-filtros" className="text-lg font-semibold">
              Filtros
            </h2>
            <a
              href={`#${ID_RESULTADOS}`}
              aria-label="Fechar filtros"
              className="grid size-10 place-items-center rounded-full hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            >
              <X className="size-6" aria-hidden />
            </a>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-4">
            {estado.q && <input type="hidden" name="q" value={estado.q} />}

            {categorias && (
              <fieldset id="filtro-categoria" className="scroll-mt-4">
                <legend className={LEGENDA}>Categoria</legend>
                <label htmlFor="f-categoria" className="sr-only">
                  Categoria
                </label>
                <select id="f-categoria" name="categoria" value={categoria} onChange={(e) => {
                  setCategoria(e.target.value);
                  setErros((anteriores) => Object.fromEntries(Object.entries(anteriores).filter(([k]) => k !== "categoria" && !k.startsWith("c_"))));
                }} aria-invalid={!!erros.categoria || undefined} aria-describedby={erros.categoria ? "erro-categoria" : undefined} className={SELECT}>
                  <option value="">Todas as categorias</option>
                  {categoria && !escolhida && <option value={categoria}>Categoria indisponível</option>}
                  {categorias.map((p) => (
                    <optgroup key={p.id} label={p.nome}>
                      <option value={p.slug}>{p.nome}: tudo</option>
                      {p.filhas.map((f) => (
                        <option key={f.id} value={f.slug}>
                          {f.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {erros.categoria && <p id="erro-categoria" role="alert" className="mt-1 text-sm text-perigo">{erros.categoria}</p>}
              </fieldset>
            )}

            <fieldset id="filtro-cidade" className="scroll-mt-4">
              <legend className={LEGENDA}>Cidade</legend>
              <label htmlFor="f-cidade" className="sr-only">
                Cidade
              </label>
              <select id="f-cidade" name="cidade" defaultValue={estado.cidade} className={SELECT}>
                <option value="">Todas as cidades da região</option>
                {estado.cidade && !cidades.some((c) => c.nome === estado.cidade) && (
                  <option value={estado.cidade}>{estado.cidade}</option>
                )}
                {cidades.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome} ({c.uf})
                  </option>
                ))}
              </select>
            </fieldset>

            <fieldset id="filtro-preco" className="scroll-mt-4">
              <legend className={LEGENDA}>Preço</legend>
              <div className="grid grid-cols-2 gap-3">
                <CaixaNumero rotulo="De (R$)" name="preco_min" valor={estado.precoMinTexto} exemplo="0" erro={erros.preco_min} />
                <CaixaNumero rotulo="Até (R$)" name="preco_max" valor={estado.precoMaxTexto} exemplo="Sem limite" erro={erros.preco_max} />
              </div>
            </fieldset>

            {filtraveis.map((c) => {
              const faceta = facetasAtuais && Object.hasOwn(facetasAtuais, c.chave) ? facetasAtuais[c.chave] : undefined;
              if (facetasAtuais && !faceta && !Object.hasOwn(estadoCampos.filtros, c.chave)) return null;
              return <FiltroCampo key={`${categoria}-${c.chave}`} campo={c} estado={estadoCampos} erros={erros} faceta={facetasAtuais ? faceta ?? {} : undefined} />;
            })}

            <fieldset id="filtro-ordem" className="scroll-mt-4">
              <legend className={LEGENDA}>Ordenar por</legend>
              <div className="flex flex-wrap gap-2">
                {ORDENS.map((o) => (
                  <label key={o.valor} className={OPCAO}>
                    <input
                      type="radio"
                      name="ordem"
                      value={o.valor === "relevancia" ? "" : o.valor}
                      defaultChecked={estado.ordem === o.valor}
                      className="sr-only"
                    />
                    <Check className="hidden size-4 shrink-0 group-has-checked:inline" aria-hidden />
                    {o.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex gap-3 border-t border-borda bg-cartao px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            <a href={limpar} className={classesBotao("secundario", false, "flex-1")}>
              Limpar
            </a>
            <button type="submit" className={classesBotao("primario", false, "flex-[2]")}>
              Ver anúncios
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}

function CaixaNumero({ rotulo, name, valor, exemplo, erro }: { rotulo: string; name: string; valor: string; exemplo?: string; erro?: string }) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base text-texto-suave">
        {rotulo}
      </label>
      <input id={id} name={name} defaultValue={valor} inputMode="decimal" placeholder={exemplo} maxLength={20} aria-invalid={!!erro || undefined} aria-describedby={erro ? `${id}-erro` : undefined} className={ENTRADA} />
      {erro && <p id={`${id}-erro`} role="alert" className="text-sm text-perigo">{erro}</p>}
    </div>
  );
}

function FiltroCampo({ campo: c, estado, erros, faceta }: {
  campo: CampoCategoria; estado: EstadoBusca; erros: Record<string, string>; faceta?: FacetaBusca;
}) {
  const id = `filtro-${c.chave}`;
  if (c.tipo === "numero") {
    const unidade = c.unidade ? ` (${c.unidade})` : "";
    return (
      <fieldset id={id} className="scroll-mt-4">
        <legend className={LEGENDA}>{c.rotulo}</legend>
        {faceta?.min != null && faceta.max != null && (
          <p className="mb-2 text-sm text-texto-suave">
            {faceta.min === faceta.max
              ? `Valor disponível de ${valorDoCampo(c, faceta.min)}`
              : `Disponível de ${valorDoCampo(c, faceta.min)} a ${valorDoCampo(c, faceta.max)}`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <CaixaNumero
            rotulo={`De${unidade}`}
            name={paramCampo(c.chave, "min")}
            valor={String(estado.valores[paramCampo(c.chave, "min")] ?? "")}
            exemplo={c.min != null ? String(c.min) : undefined}
            erro={erros[paramCampo(c.chave, "min")]}
          />
          <CaixaNumero
            rotulo={`Até${unidade}`}
            name={paramCampo(c.chave, "max")}
            valor={String(estado.valores[paramCampo(c.chave, "max")] ?? "")}
            exemplo={c.max != null ? String(c.max) : undefined}
            erro={erros[paramCampo(c.chave, "max")]}
          />
        </div>
      </fieldset>
    );
  }
  if (c.tipo === "lista") {
    const marcados = new Set([estado.valores[paramCampo(c.chave)] ?? []].flat());
    const opcoes = (c.opcoes ?? []).filter((o) => !faceta || marcados.has(o) || quantidadeNaFaceta(faceta, o) > 0);
    const erro = erros[paramCampo(c.chave)];
    return (
      <fieldset id={id} className="scroll-mt-4" aria-describedby={erro ? `${id}-erro` : undefined}>
        <legend className={LEGENDA}>
          {c.rotulo} <span className="font-normal text-texto-suave">(pode marcar mais de um)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <label key={o} className={OPCAO}>
              <input type="checkbox" name={paramCampo(c.chave)} value={o} defaultChecked={marcados.has(o)} className="sr-only" />
              <Check className="hidden size-4 shrink-0 group-has-checked:inline" aria-hidden />
              {faceta ? `${o} (${inteiro(quantidadeNaFaceta(faceta, o))})` : o}
            </label>
          ))}
        </div>
        {erro && <p id={`${id}-erro`} role="alert" className="mt-1 text-sm text-perigo">{erro}</p>}
      </fieldset>
    );
  }
  if (c.tipo === "sim_nao") {
    const atual = String(estado.valores[paramCampo(c.chave)] ?? "");
    const opcoes = [
      { v: "", r: "Tanto faz" },
      { v: "sim", r: "Sim" },
      { v: "nao", r: "Não" },
    ].filter((o) => !faceta || !o.v || o.v === atual || quantidadeNaFaceta(faceta, o.v) > 0);
    return (
      <fieldset id={id} className="scroll-mt-4">
        <legend className={LEGENDA}>{c.rotulo}</legend>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <label key={o.v} className={OPCAO}>
              <input type="radio" name={paramCampo(c.chave)} value={o.v} defaultChecked={atual === o.v} className="sr-only" />
              <Check className="hidden size-4 shrink-0 group-has-checked:inline" aria-hidden />
              {faceta && o.v ? `${o.r} (${inteiro(quantidadeNaFaceta(faceta, o.v))})` : o.r}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const idEntrada = `f-${c.chave}`;
  return (
    <fieldset id={id} className="scroll-mt-4">
      <legend className={LEGENDA}>{c.rotulo}</legend>
      <label htmlFor={idEntrada} className="sr-only">
        {c.rotulo}
      </label>
      <input
        id={idEntrada}
        name={paramCampo(c.chave)}
        defaultValue={String(estado.valores[paramCampo(c.chave)] ?? "")}
        maxLength={120}
        className={ENTRADA}
      />
    </fieldset>
  );
}

function quantidadeNaFaceta(faceta: FacetaBusca, opcao: string): number {
  const quantidade = faceta.opcoes?.[opcao];
  return typeof quantidade === "number" ? quantidade : 0;
}
