"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Folha, FolhaContent, FolhaDescription, FolhaHeader, FolhaTitle, FolhaTrigger } from "@/components/ui/folha";
import { classesCampo } from "@/components/ui/input";
import { ArvoreCategorias } from "./arvore-categorias";
import type { CategoriaLeve } from "@/lib/categorias-arvore";

// "Todas as categorias" para quem procura: abre a folha (no celular sobe de baixo) com busca,
// as usadas há pouco e os 3 níveis, sem sair da tela. Cada categoria é um link.

export function TodasCategorias({
  arvore,
  soComAnuncios,
  children,
  className,
}: {
  arvore: CategoriaLeve[];
  /** A árvore já veio sem as vazias (contagem da região deu certo). */
  soComAnuncios: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");

  return (
    <Folha
      open={aberta}
      onOpenChange={(a) => {
        setAberta(a);
        if (!a) setBusca("");
      }}
    >
      <FolhaTrigger className={className}>{children}</FolhaTrigger>
      <FolhaContent>
        <FolhaHeader>
          <FolhaTitle>Todas as categorias</FolhaTitle>
          <FolhaDescription>{soComAnuncios ? "Só aparecem as categorias com anúncios na sua região." : "Toque numa categoria para ver os anúncios."}</FolhaDescription>
        </FolhaHeader>
        <div className="relative">
          <label htmlFor="busca-todas-categorias" className="sr-only">
            Procurar categoria
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input
            id="busca-todas-categorias"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar categoria: moto, sofá, ração"
            autoComplete="off"
            enterKeyHint="search"
            className={`${classesCampo} h-10 pl-10`}
          />
        </div>
        <ArvoreCategorias
          arvore={arvore}
          busca={busca}
          modo="navegar"
          aoNavegar={() => setAberta(false)}
          semResultado={<p className="text-sm text-texto-suave">Tente uma palavra mais simples, como “moto” ou “sofá”.</p>}
        />
      </FolhaContent>
    </Folha>
  );
}
