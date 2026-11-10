import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { SeloLoja } from "@/components/vitrine/selos";
import { desde } from "@/components/vitrine/util";

// Topo da vitrine da loja (T10) e do perfil do vendedor (T11): capa, logo, nome, selo, cidade.
export function CabecalhoVitrine({
  nome,
  logo,
  capa,
  selo,
  cidade,
  bairro,
  criadoEm,
  descricao,
  rotulo,
  children,
}: {
  nome: string;
  logo?: string | null;
  capa?: string | null;
  selo?: boolean;
  cidade?: string | null;
  bairro?: string | null;
  criadoEm?: string | null;
  descricao?: string | null;
  /** "Loja" ou "Vendedor". */
  rotulo: string;
  /** Botões (WhatsApp, compartilhar). */
  children?: ReactNode;
}) {
  const desdeTexto = desde(criadoEm);
  return (
    <header className="overflow-hidden bg-cartao shadow-1 md:rounded-card">
      <div className="relative aspect-[3/1] max-h-56 w-full bg-gradient-to-br from-beringela to-beringela/80">
        {capa && (
          // eslint-disable-next-line @next/next/no-img-element -- capa vem do Storage
          <img src={capa} alt="" width={1200} height={400} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="-mt-12 flex items-end gap-3">
          <span className="rounded-full border-4 border-cartao bg-cartao">
            <AvatarVitrine nome={nome} logo={logo} tamanho="xl" />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-legenda text-texto-suave">{rotulo}</span>
          <h1 className="text-titulo font-semibold">{nome}</h1>
          {selo && (
            <span>
              <SeloLoja />
            </span>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-texto-suave">
            {cidade && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {[bairro, cidade].filter(Boolean).join(", ")}
              </span>
            )}
            {desdeTexto && <span>{desdeTexto}</span>}
          </p>
        </div>
        {descricao && <p className="whitespace-pre-line break-words text-base leading-6">{descricao}</p>}
        {children}
      </div>
    </header>
  );
}
