"use client";

import { formatarNome } from "@/lib/formatar-nome";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { classesCampo } from "@/components/ui/input";
import { IconeCategoria } from "@/components/ui/icone-categoria";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { semAcento } from "@/lib/categorias-arvore";
import { linkLoja } from "@/lib/formato";
import type { TipoLoja } from "@/lib/tipos-de-loja";

// A busca fica fixa enquanto a fileira de lojas rola ao lado.
type LojaFaixa = { id: string; slug: string; nome: string; logo_url: string | null; verificada: boolean; tipos: string[] };

const SETA =
  "grid size-10 shrink-0 place-items-center rounded-campo border border-borda bg-cartao text-beringela " +
  "hover:bg-selecao focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro";

export function FaixaLojas({ titulo, lojas, tipos }: { titulo: string; lojas: LojaFaixa[]; tipos: TipoLoja[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const fila = useRef<HTMLUListElement>(null);
  const [rolar, setRolar] = useState({ antes: false, depois: false });

  const visiveis = useMemo(() => {
    const q = semAcento(busca);
    return lojas.filter((l) => (!q || semAcento(l.nome).includes(q)) && (!tipo || l.tipos.includes(tipo)));
  }, [lojas, busca, tipo]);

  useEffect(() => {
    const ul = fila.current;
    if (!ul) return;
    const medir = () => {
      const antes = ul.scrollLeft > 4;
      const depois = ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 4;
      setRolar((atual) => atual.antes === antes && atual.depois === depois ? atual : { antes, depois });
    };
    const tamanho = new ResizeObserver(medir);
    medir();
    tamanho.observe(ul);
    ul.addEventListener("scroll", medir, { passive: true });
    return () => {
      tamanho.disconnect();
      ul.removeEventListener("scroll", medir);
    };
  }, [visiveis]);

  function andar(lado: 1 | -1) {
    const ul = fila.current;
    if (!ul) return;
    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ul.scrollBy({ left: lado * Math.max(88, ul.clientWidth * 0.8), behavior: movimentoReduzido ? "instant" : "smooth" });
  }

  return (
    <section aria-labelledby="titulo-lojas" className="flex min-w-0 flex-col gap-2 rounded-card border border-borda bg-cartao p-2.5 md:px-4 md:py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-lojas" className="min-w-0 text-sm font-semibold text-beringela md:text-base">{titulo}</h2>
        <Botao href="/lojas" variante="texto" className="shrink-0 px-2">Ver todas</Botao>
      </div>
      {lojas.length > 0 && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
            <div role="search" aria-label="Lojas" className="relative w-28 shrink-0 min-[360px]:w-32 md:w-48">
              <label htmlFor="busca-loja" className="sr-only">Buscar loja</label>
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-texto-suave" aria-hidden />
              <input
                id="busca-loja"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar loja"
                autoComplete="off"
                enterKeyHint="search"
                maxLength={60}
                className={`${classesCampo} h-11 px-1.5 pl-7 text-[13px]`}
              />
            </div>

            {visiveis.length > 0 ? (
              <div className="relative min-w-0 flex-1">
                <ul ref={fila} id="lojas-da-regiao" aria-label="Lojas da região" className="flex min-w-0 snap-x gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
                  {visiveis.map((l) => {
                    const nome = formatarNome(l.nome);
                    return (
                      <li key={l.id} className="shrink-0 snap-start">
                        <Link href={linkLoja(l.slug)} title={nome} className="olaki-toque flex w-[5.375rem] flex-col items-center gap-1 rounded-campo bg-fundo px-1.5 py-1.5 text-center hover:bg-selecao focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro md:w-28">
                          <span className="relative">
                            <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="sm" quadrado />
                            {l.verificada && (
                              <ShieldCheck className="absolute -right-1 -bottom-1 size-4 rounded-full bg-cartao p-0.5 text-verde-escuro" aria-label="Loja verificada" role="img" />
                            )}
                          </span>
                          <span className="w-full truncate text-xs font-medium leading-4 text-texto">{nome}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {rolar.antes && (
                  <button type="button" onClick={() => andar(-1)} aria-label="Ver lojas anteriores" aria-controls="lojas-da-regiao" className={`${SETA} absolute top-1/2 left-0 -translate-y-1/2 shadow-1`}>
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ) : (
              <p role="status" className="min-w-0 text-xs leading-4 text-texto-suave">Nenhuma loja encontrada.</p>
            )}

            {visiveis.length > 0 && (rolar.depois || rolar.antes) && (
              <button type="button" onClick={() => andar(1)} disabled={!rolar.depois} aria-label="Ver mais lojas" aria-controls="lojas-da-regiao" className={`${SETA} disabled:opacity-40`}>
                <ChevronRight className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {tipos.length > 1 && (
            <div role="group" aria-label="Tipo de loja" className="flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
              <Chip ativo={!tipo} onClick={() => setTipo(null)}>Todos os tipos</Chip>
              {tipos.map((t) => (
                <Chip key={t.slug} ativo={tipo === t.slug} icone={<IconeCategoria nome={t.icone} />} onClick={() => setTipo(tipo === t.slug ? null : t.slug)}>
                  {t.nome}
                </Chip>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
