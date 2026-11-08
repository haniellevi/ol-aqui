import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { corDoTextoSobre, corSegura } from "@/components/vitrine/regras";
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
  prioridade = false,
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
  className?: string;
}) {
  if (tipo === "foto" && url) {
    return (
      <div className={`relative aspect-[3/1] w-full overflow-hidden bg-borda ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage; img simples é leve no 3G */}
        <img
          src={url}
          alt={`Fachada da loja ${nome}`}
          width={1500}
          height={500}
          fetchPriority={prioridade ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
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
      <span className="hidden shrink-0 sm:block">
        <AvatarVitrine nome={nome} logo={logo} tamanho="lg" />
      </span>
      <span className="line-clamp-2 text-center text-[22px] font-bold leading-7 sm:text-3xl sm:leading-9">{nome}</span>
    </div>
  );
}
