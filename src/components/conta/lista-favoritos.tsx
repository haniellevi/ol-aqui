"use client";

import { useState } from "react";
import { PackageX, Radar } from "lucide-react";
import type { Favorito } from "@/lib/dados/favoritos";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { BotaoRemoverFavorito } from "./botao-remover-favorito";
import { Badge } from "@/components/ui/badge";
import { Botao } from "@/components/ui/botao";

/** radar: mostra "Estou procurando…" (vitrine nova ligada). */
export function ListaFavoritos({ itens, radar = false }: { itens: Favorito[]; radar?: boolean }) {
  const [removido, setRemovido] = useState<string | null>(null);
  return <div className="flex flex-col gap-3">
    <p role="status" className={removido ? "rounded-campo bg-sucesso-fundo p-3 text-sm font-semibold text-verde-escuro" : "sr-only"}>
      {removido && `${removido} foi removido dos favoritos.`}
    </p>
    <ul aria-label="Anúncios salvos" className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {itens.map((f, indice) => {
        const titulo = f.anuncio?.titulo ?? `Anúncio indisponível ${indice + 1}`;
        return <li key={f.id} className="flex min-w-0 flex-col gap-2 rounded-card bg-cartao p-2 shadow-1">
          <Badge variant={f.situacao === "ativo" ? "success" : "secondary"}>
            {f.situacao === "ativo" ? "Disponível" : f.situacao === "vendido" ? "Vendido" : "Fora do ar"}
          </Badge>
          {f.anuncio ? <div className="flex flex-1 flex-col [&>article]:flex-1 [&>article]:shadow-none"><CardAnuncio anuncio={f.anuncio} prioridade={indice < 2} /></div> :
            <div className="flex flex-1 flex-col gap-3 px-1 py-3">
              <PackageX className="size-8 text-texto-suave" aria-hidden />
              <h2 className="text-base font-semibold break-words">Anúncio indisponível</h2>
              <p className="text-sm text-texto-suave">{radar ? "Ele saiu do ar. Peça parecido no Radar e as lojas da região mandam ofertas." : "Ele saiu do ar. Você pode removê-lo da lista."}</p>
            </div>}
          <p className="px-1 text-legenda text-texto-suave">Salvo em <time dateTime={f.salvoEm}>{new Date(f.salvoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p>
          {radar && <div className="px-1"><Botao href={f.radar} tamanho="pequeno" variante={f.situacao === "ativo" ? "texto" : "primario"} icone={<Radar />}
            aria-label={f.anuncio ? `Estou procurando algo parecido com ${titulo}` : "Estou procurando algo parecido"}>Estou procurando…</Botao></div>}
          <div className="border-t border-borda pt-1"><BotaoRemoverFavorito anuncioId={f.id} titulo={titulo} comTexto onRemovido={() => setRemovido(titulo)} /></div>
        </li>;
      })}
    </ul>
  </div>;
}
