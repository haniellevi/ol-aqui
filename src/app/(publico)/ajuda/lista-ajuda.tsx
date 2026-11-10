"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search, ShieldAlert } from "lucide-react";
import { Chip } from "@/components/ui/chip";
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
    <div className="flex flex-col gap-5">
      <div role="search" className="flex flex-col gap-2">
        <label htmlFor="busca-ajuda" className="sr-only">
          Buscar na ajuda
        </label>
        <div className="flex h-12 items-center gap-2 rounded-card border-2 border-beringela bg-cartao px-3 md:h-11 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro">
          <Search className="size-6 shrink-0 text-beringela" aria-hidden />
          <input
            id="busca-ajuda"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: golpe, Pix, Radar, destaque"
            maxLength={80}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-texto placeholder:text-texto-suave focus:outline-none"
          />
        </div>
      </div>

      {!termo && categorias.length > 1 && (
        <nav aria-label="Assuntos" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-2">
            {categorias.map((c) => (
              <li key={c.slug}>
                <Chip href={`#ajuda-${c.slug}`}>{c.nome}</Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {termo && (
        <p role="status" className="text-base text-texto-suave">
          {filtradas.length === 0
            ? `Não achamos "${busca.trim()}" na ajuda. Tente outra palavra ou fale com a equipe aqui embaixo.`
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
            className={`flex scroll-mt-20 flex-col gap-3 ${seguranca ? "rounded-card border border-borda bg-cartao p-4" : ""}`}
          >
            <div className="flex items-start gap-2">
              {seguranca && <ShieldAlert className="mt-0.5 size-6 shrink-0 text-laranja-escuro" aria-hidden />}
              <div className="flex flex-col">
                <h2 id={`titulo-ajuda-${c.slug}`} className="text-lg font-semibold leading-6">
                  {c.nome}
                </h2>
                {c.descricao && <p className="text-sm text-texto-suave">{c.descricao}</p>}
              </div>
            </div>
            {itens.length > 0 && (
              <ul className="overflow-hidden rounded-card bg-cartao shadow-1">
                {itens.map((p) => (
                  <li key={p.id} className="border-b border-borda last:border-0">
                    <details className="group" open={!!termo && filtradas.length <= 3}>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">{p.pergunta}</span>
                        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                      </summary>
                      <div className="px-4 pb-4">
                        <Markdown texto={p.resposta} />
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
