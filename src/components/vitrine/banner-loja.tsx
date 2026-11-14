"use client";

import { formatarNome } from "@/lib/formatar-nome";
import { useState } from "react";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { corDoTextoSobre, corSegura } from "@/components/vitrine/regras";
import { BANNER_LARGURA, BANNER_ALTURA } from "@/lib/tamanhos-imagem";
import type { BannerModelo, BannerTipo } from "@/lib/tipos-vitrine";

// Banner da vitrine (3:1). Foto da fachada, ou o modelo pronto: cor + desenho + logo + nome.
// Nenhuma vitrine fica sem banner. Serve na página pública e na prévia de "Minha loja".

const DESENHO: Record<BannerModelo, string | undefined> = {
  liso: undefined,
  // listras e pontos bem suaves (branco a 12%), só para dar textura; o texto continua legível
  listras: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.12) 0 14px, transparent 14px 34px)",
  pontos: "radial-gradient(rgb(255 255 255 / 0.16) 2px, transparent 2.5px)",
};

export function BannerLoja({
  tipo,
  url,
  modelo,
  cor,
  nome,
  logo,
  posicaoAki = null,
  prioridade = false,
  mostrarLogoModelo = true,
  className = "",
}: {
  tipo: BannerTipo;
  url: string | null;
  modelo: BannerModelo;
  cor: string;
  nome: string;
  logo: string | null;
  /** Carrega a foto já (topo da página). */
  prioridade?: boolean;
  posicaoAki?: number | null;
  mostrarLogoModelo?: boolean;
  className?: string;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  if (tipo === "foto" && url && falhou !== url) {
    return (
      <div className={`relative aspect-[3/1] w-full overflow-hidden bg-borda ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage; img simples é leve no 3G */}
        <img
          src={url}
          ref={(img) => { if (img?.complete && img.naturalWidth === 0) setFalhou(url); }}
          onError={() => setFalhou(url)}
          alt={`${posicaoAki === null ? "Fachada" : "Banner"} da loja ${formatarNome(nome)}`}
          width={BANNER_LARGURA}
          height={BANNER_ALTURA}
          fetchPriority={prioridade ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        {posicaoAki !== null && logo && (
          // eslint-disable-next-line @next/next/no-img-element -- logo do Storage ou prévia local
          <img src={logo} alt={`Logo de ${formatarNome(nome)}`} className="absolute top-1/2 h-[62%] w-1/4 -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{ left: `${12.5 + posicaoAki * 0.75}%` }} />
        )}
      </div>
    );
  }
  const fundo = corSegura(cor);
  const texto = corDoTextoSobre(fundo);
  const desenho = DESENHO[modelo] ?? undefined;
  return (
    <div
      className={`relative flex aspect-[3/1] w-full items-center justify-center gap-3 overflow-hidden px-6 ${className}`}
      style={{
        backgroundColor: fundo,
        backgroundImage: desenho,
        backgroundSize: modelo === "pontos" ? "18px 18px" : undefined,
        color: texto,
      }}
    >
      {mostrarLogoModelo && (
        <span className={posicaoAki === null ? "hidden shrink-0 sm:block" : "shrink-0"}>
          <AvatarVitrine nome={nome} logo={logo} tamanho="lg" />
        </span>
      )}
      <span className="line-clamp-2 text-center text-xl leading-6 font-bold sm:text-2xl sm:leading-8">{formatarNome(nome)}</span>
    </div>
  );
}
