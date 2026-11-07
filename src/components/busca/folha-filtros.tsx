import Link from "next/link";
import { Check, X } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { ORDENS, paramCampo, type EstadoBusca } from "@/components/busca/parametros";
import type { CampoCategoria, CategoriaComFilhas, Cidade } from "@/lib/tipos";

// Folha de filtros (T6). Abre pelo endereço (#filtros ou #filtro-...) com CSS (:target),
// então funciona sem JavaScript. O formulário é GET: o resultado vira um link compartilhável.

export const ID_FOLHA = "filtros";
export const ID_RESULTADOS = "resultados";

const SELECT =
  "h-12 w-full rounded-campo border-2 border-borda bg-cartao px-3 text-base text-texto " +
  "focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30";
const ENTRADA = `${SELECT} placeholder:text-texto-suave`;
// Chip de escolha (igual ao <Chip>): selecionado = borda laranja-escuro, fundo laranja-claro, texto beringela e ✓.
const OPCAO =
  "group inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border border-borda bg-cartao px-4 text-[15px] font-semibold text-beringela " +
  "has-checked:border-laranja-escuro has-checked:bg-laranja-claro " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-laranja-escuro";
const LEGENDA = "mb-2 text-base font-semibold";

export function FolhaFiltros({
  caminho,
  estado,
  campos,
  cidades,
  categorias,
}: {
  /** Para onde o formulário vai (a própria página). */
  caminho: string;
  estado: EstadoBusca;
  /** Campos da subcategoria marcados como filtro. */
  campos: CampoCategoria[];
  cidades: Cidade[];
  /** Mostra a escolha de categoria (só na tela de busca). */
  categorias?: CategoriaComFilhas[];
}) {
  const filtraveis = campos.filter((c) => c.filtro);
  const limpar = estado.q ? `${caminho}?q=${encodeURIComponent(estado.q)}` : caminho;

  return (
    <div
      id={ID_FOLHA}
      className="fixed inset-0 z-40 hidden items-end justify-center target:flex has-[:target]:flex md:items-center md:p-6"
    >
      <a href={`#${ID_RESULTADOS}`} tabIndex={-1} aria-hidden className="absolute inset-0 bg-beringela/50" />
      <section
        aria-labelledby="titulo-filtros"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-folha bg-cartao shadow-2 md:rounded-folha"
      >
        <form action={caminho} method="get" className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-borda py-1 pl-4 pr-1">
            <h2 id="titulo-filtros" className="text-lg font-semibold">
              Filtros
            </h2>
            <a
              href={`#${ID_RESULTADOS}`}
              aria-label="Fechar filtros"
              className="grid size-12 place-items-center rounded-full hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
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
                <select id="f-categoria" name="categoria" defaultValue={estado.categoria} className={SELECT}>
                  <option value="">Todas as categorias</option>
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
                <CaixaNumero rotulo="De (R$)" name="preco_min" valor={estado.precoMinTexto} exemplo="0" />
                <CaixaNumero rotulo="Até (R$)" name="preco_max" valor={estado.precoMaxTexto} exemplo="Sem limite" />
              </div>
            </fieldset>

            {filtraveis.map((c) => (
              <FiltroCampo key={c.chave} campo={c} estado={estado} />
            ))}

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
            <Link href={limpar} className={classesBotao("secundario", false, "flex-1")}>
              Limpar
            </Link>
            <button type="submit" className={classesBotao("primario", false, "flex-[2]")}>
              Ver anúncios
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CaixaNumero({ rotulo, name, valor, exemplo }: { rotulo: string; name: string; valor: string; exemplo?: string }) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] text-texto-suave">
        {rotulo}
      </label>
      <input id={id} name={name} defaultValue={valor} inputMode="decimal" placeholder={exemplo} maxLength={20} className={ENTRADA} />
    </div>
  );
}

function FiltroCampo({ campo: c, estado }: { campo: CampoCategoria; estado: EstadoBusca }) {
  const id = `filtro-${c.chave}`;
  if (c.tipo === "numero") {
    const unidade = c.unidade ? ` (${c.unidade})` : "";
    return (
      <fieldset id={id} className="scroll-mt-4">
        <legend className={LEGENDA}>{c.rotulo}</legend>
        <div className="grid grid-cols-2 gap-3">
          <CaixaNumero
            rotulo={`De${unidade}`}
            name={paramCampo(c.chave, "min")}
            valor={String(estado.valores[paramCampo(c.chave, "min")] ?? "")}
            exemplo={c.min != null ? String(c.min) : undefined}
          />
          <CaixaNumero
            rotulo={`Até${unidade}`}
            name={paramCampo(c.chave, "max")}
            valor={String(estado.valores[paramCampo(c.chave, "max")] ?? "")}
            exemplo={c.max != null ? String(c.max) : undefined}
          />
        </div>
      </fieldset>
    );
  }
  if (c.tipo === "lista") {
    const marcados = new Set([estado.valores[paramCampo(c.chave)] ?? []].flat());
    return (
      <fieldset id={id} className="scroll-mt-4">
        <legend className={LEGENDA}>
          {c.rotulo} <span className="font-normal text-texto-suave">(pode marcar mais de um)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(c.opcoes ?? []).map((o) => (
            <label key={o} className={OPCAO}>
              <input type="checkbox" name={paramCampo(c.chave)} value={o} defaultChecked={marcados.has(o)} className="sr-only" />
              <Check className="hidden size-4 shrink-0 group-has-checked:inline" aria-hidden />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (c.tipo === "sim_nao") {
    const atual = String(estado.valores[paramCampo(c.chave)] ?? "");
    return (
      <fieldset id={id} className="scroll-mt-4">
        <legend className={LEGENDA}>{c.rotulo}</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "", r: "Tanto faz" },
            { v: "sim", r: "Sim" },
            { v: "nao", r: "Não" },
          ].map((o) => (
            <label key={o.v} className={OPCAO}>
              <input type="radio" name={paramCampo(c.chave)} value={o.v} defaultChecked={atual === o.v} className="sr-only" />
              <Check className="hidden size-4 shrink-0 group-has-checked:inline" aria-hidden />
              {o.r}
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
