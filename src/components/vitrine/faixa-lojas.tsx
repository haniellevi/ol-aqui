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

// Início: lojas da região numa fileira que rola para o lado, no jeito da faixa de categorias
// (foto pequena em cima, nome embaixo). Junto, "Buscar loja" e o filtro por tipo (das categorias
// dos anúncios de cada loja). Tudo filtra aqui mesmo, sem recarregar; "Ver todas" leva ao catálogo.
// No computador, setas para rolar; no celular, o dedo rola.

type LojaFaixa = { id: string; slug: string; nome: string; logo_url: string | null; verificada: boolean; tipos: string[] };

const ITEM =
  "olaki-toque flex w-20 flex-col items-center gap-1 rounded-card px-1 py-1.5 text-center text-sm font-semibold leading-tight text-texto " +
  "hover:bg-cartao focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

const SETA =
  "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full border border-borda bg-cartao text-beringela shadow-1 " +
  "hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro md:grid";

export function FaixaLojas({ titulo, lojas, tipos }: { titulo: string; lojas: LojaFaixa[]; tipos: TipoLoja[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const fila = useRef<HTMLUListElement>(null);
  const [rolar, setRolar] = useState({ antes: false, depois: false });

  const visiveis = useMemo(() => {
    const q = semAcento(busca);
    return lojas.filter((l) => (!q || semAcento(l.nome).includes(q)) && (!tipo || l.tipos.includes(tipo)));
  }, [lojas, busca, tipo]);

  // Mostra cada seta só quando há o que rolar daquele lado.
  useEffect(() => {
    const ul = fila.current;
    if (!ul) return;
    const medir = () => setRolar({ antes: ul.scrollLeft > 4, depois: ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 4 });
    medir();
    ul.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      ul.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [visiveis]);

  const andar = (lado: 1 | -1) => fila.current?.scrollBy({ left: lado * fila.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section aria-labelledby="titulo-lojas" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-lojas" className="text-lg font-semibold">{titulo}</h2>
        <Botao href="/lojas" variante="texto" className="shrink-0">Ver todas</Botao>
      </div>

      {lojas.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <div role="search" className="relative w-40 shrink-0 sm:w-56">
            <label htmlFor="busca-loja" className="sr-only">Buscar loja</label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
            <input
              id="busca-loja"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar loja"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={60}
              className={`${classesCampo} h-10 pl-10`}
            />
          </div>
          {tipos.length > 1 && (
            <div role="group" aria-label="Tipo de loja" className="flex gap-2">
              <Chip ativo={!tipo} onClick={() => setTipo(null)}>Todos os tipos</Chip>
              {tipos.map((t) => (
                <Chip key={t.slug} ativo={tipo === t.slug} icone={<IconeCategoria nome={t.icone} />} onClick={() => setTipo(tipo === t.slug ? null : t.slug)}>
                  {t.nome}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {lojas.length > 0 && (visiveis.length > 0 ? (
        <div className="relative">
          {rolar.antes && (
            <button type="button" onClick={() => andar(-1)} aria-label="Ver lojas anteriores" className={`${SETA} -left-3`}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          )}
          <ul ref={fila} className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {visiveis.map((l) => (
              <li key={l.id} className="shrink-0 snap-start">
                <Link href={linkLoja(l.slug)} className={ITEM}>
                  <span className="relative">
                    <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="md" />
                    {l.verificada && (
                      <ShieldCheck className="absolute -right-1 -bottom-1 size-5 rounded-full bg-cartao p-0.5 text-verde-escuro" aria-label="Loja verificada" role="img" />
                    )}
                  </span>
                  <span className="line-clamp-2 max-w-full hyphens-auto break-words">{formatarNome(l.nome)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {rolar.depois && (
            <button type="button" onClick={() => andar(1)} aria-label="Ver mais lojas" className={`${SETA} -right-3`}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-texto-suave">
          Nenhuma loja com esse nome aqui.{" "}
          <Link href="/lojas" className="font-semibold text-laranja-escuro underline underline-offset-4">Ver todas as lojas</Link>
        </p>
      ))}
    </section>
  );
}
