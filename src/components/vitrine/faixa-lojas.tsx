"use client";

import { formatarNome } from "@/lib/formatar-nome";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { IconeCategoria } from "@/components/ui/icone-categoria";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { linkLoja } from "@/lib/formato";
import type { TipoLoja } from "@/lib/tipos-de-loja";

// A home mostra a fileira de lojas. A busca fica no catálogo /lojas.
type LojaFaixa = { id: string; slug: string; nome: string; logo_url: string | null; verificada: boolean; tipos: string[] };

const SETA =
  "grid size-11 shrink-0 place-items-center rounded-campo border border-borda bg-cartao text-beringela " +
  "hover:bg-selecao focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro";

export function FaixaLojas({ titulo, lojas, tipos }: { titulo: string; lojas: LojaFaixa[]; tipos: TipoLoja[] }) {
  const [tipo, setTipo] = useState<string | null>(null);
  const fila = useRef<HTMLUListElement>(null);
  const [rolar, setRolar] = useState({ antes: false, depois: false });

  const visiveis = useMemo(() => lojas.filter((l) => !tipo || l.tipos.includes(tipo)), [lojas, tipo]);

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
    <section aria-labelledby="titulo-lojas" className="flex min-w-0 flex-col gap-1 rounded-card border border-borda bg-cartao p-2 md:px-3 md:py-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-lojas" className="min-w-0 text-lg font-semibold text-beringela [overflow-wrap:anywhere]">{titulo}</h2>
        <Botao href="/lojas" variante="texto" tamanho="toque" className="shrink-0 px-2">Ver todas</Botao>
      </div>
      {lojas.length > 0 && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
            {visiveis.length > 0 ? (
              <div className="relative min-w-0 flex-1">
                <ul ref={fila} id="lojas-da-regiao" aria-label="Lojas da região" className="flex min-w-0 snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
                  {visiveis.map((l) => {
                    const nome = formatarNome(l.nome);
                    return (
                      <li key={l.id} className="shrink-0 snap-start">
                        <Link href={linkLoja(l.slug)} title={nome} className="olaki-toque grid aspect-[4/5] w-24 grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-card border border-borda bg-cartao hover:border-beringela focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro md:aspect-square md:w-36">
                          <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="cartao" />
                          <span className="flex min-h-10 items-center justify-between gap-1 bg-beringela px-2 py-1 text-legenda leading-tight font-semibold text-white">
                            <span className="line-clamp-2 [overflow-wrap:anywhere]">{nome}</span>
                            {l.verificada && <ShieldCheck className="size-4 shrink-0" aria-label="Loja verificada" role="img" />}
                          </span>
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
              <Chip tamanho="toque" ativo={!tipo} onClick={() => setTipo(null)}>Todos os tipos</Chip>
              {tipos.map((t) => (
                <Chip tamanho="toque" key={t.slug} ativo={tipo === t.slug} icone={<IconeCategoria nome={t.icone} />} onClick={() => setTipo(tipo === t.slug ? null : t.slug)}>
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
