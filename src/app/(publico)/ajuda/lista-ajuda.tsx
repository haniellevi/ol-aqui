"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, ShieldAlert, X } from "lucide-react";
import { classesChip } from "@/components/ui/chip";
import { Markdown, textoPuro } from "@/components/paginas/markdown";
import type { AjudaCategoria, AjudaPergunta } from "@/lib/tipos-paginas";

// Lista da Central de ajuda: busca na própria página (sem ir ao servidor), atalhos por categoria
// e cada pergunta abre e fecha (details). "Dicas de segurança" ganha destaque visual.

function normal(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function ListaAjuda({
  categorias,
  perguntas,
  extras = {},
}: {
  categorias: AjudaCategoria[];
  perguntas: AjudaPergunta[];
  /** Conteúdo a mais no fim de uma categoria (ex.: preços de hoje em "destaques"). */
  extras?: Record<string, ReactNode>;
}) {
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);
  const termo = normal(busca.trim());

  const indice = useMemo(
    () => new Map(perguntas.map((p) => [p.id, normal(`${p.pergunta} ${textoPuro(p.resposta)}`)])),
    [perguntas],
  );
  const filtradas = termo ? perguntas.filter((p) => termo.split(/\s+/).every((t) => indice.get(p.id)?.includes(t))) : perguntas;
  const grupos = categorias
    .map((c) => ({ c, itens: filtradas.filter((p) => p.categoria === c.slug) }))
    .filter((g) => g.itens.length > 0 || (!termo && extras[g.c.slug]));

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="flex flex-col gap-2">
        <label htmlFor="busca-ajuda" className="sr-only">
          Buscar na ajuda
        </label>
        <div className="flex min-h-12 items-center gap-2 rounded-card border border-borda-campo bg-cartao pr-1 pl-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro">
          <Search className="size-5 shrink-0 text-beringela" aria-hidden />
          <input
            id="busca-ajuda"
            ref={campoBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busque por golpe, Pix ou Radar"
            maxLength={80}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-texto placeholder:text-texto-suave focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {busca && (
            <button type="button" aria-label="Limpar busca na Ajuda"
              onClick={() => { setBusca(""); campoBusca.current?.focus(); }}
              className="grid size-11 shrink-0 place-items-center rounded-campo text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {!termo && grupos.length > 1 && (
        <nav aria-label="Assuntos" className="min-w-0">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grupos.map(({ c }) => (
              <li key={c.slug} className="min-w-0">
                <a href={`#ajuda-${c.slug}`} className={classesChip(false, "h-full w-full px-2! py-1", "toque")}>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{c.nome}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {termo && (
        <p role="status" className="text-base text-texto-suave">
          {filtradas.length === 0
            ? `Nenhuma resposta para “${busca.trim()}”. Tente outra palavra.`
            : filtradas.length === 1
              ? "1 resposta encontrada."
              : `${filtradas.length} respostas encontradas.`}
        </p>
      )}

      {grupos.map(({ c, itens }) => {
        const seguranca = c.slug === "seguranca";
        return (
          <section
            key={c.slug}
            id={`ajuda-${c.slug}`}
            aria-labelledby={`titulo-ajuda-${c.slug}`}
            className={`flex scroll-mt-20 flex-col gap-2 ${seguranca ? "rounded-card bg-aviso-fundo p-3" : ""}`}
          >
            <div className="flex items-start gap-2">
              {seguranca && <ShieldAlert className="mt-0.5 size-5 shrink-0 text-laranja-escuro" aria-hidden />}
              <div className="flex flex-col">
                <h2 id={`titulo-ajuda-${c.slug}`} className="text-lg leading-6 font-semibold">
                  {c.nome}
                </h2>
                {c.descricao && <p className="text-sm text-texto-suave">{c.descricao}</p>}
              </div>
            </div>
            {itens.length > 0 && (
              <ul className="overflow-hidden rounded-card border border-borda bg-cartao">
                {itens.map((p) => (
                  <li key={p.id} className="border-b border-borda last:border-0">
                    <details className="group" open={!!termo && filtradas.length <= 3}>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-base font-semibold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.pergunta}</span>
                        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                      </summary>
                      <div className="px-3 pb-3">
                        <Markdown texto={p.resposta} prefixo={`resposta-${p.id}-`} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {!termo && extras[c.slug]}
          </section>
        );
      })}
    </div>
  );
}
