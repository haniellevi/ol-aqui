import { MapPin } from "lucide-react";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { desde } from "@/components/vitrine/util";

// Identidade pública de pessoa física. A rota fornece somente o primeiro nome.
export function CabecalhoVitrine({ nome, cidade, criadoEm }: {
  nome: string;
  cidade: string | null;
  criadoEm?: string | null;
}) {
  const desdeTexto = desde(criadoEm);
  return (
    <header className="flex min-w-0 items-center gap-3 rounded-card border border-borda bg-cartao p-4">
      <AvatarVitrine nome={nome} tamanho="lg" />
      <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
        <h1 className="text-titulo font-semibold text-beringela">{nome}</h1>
        {cidade && (
          <p className="flex items-start gap-1 text-sm text-texto-suave">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{cidade}</span>
          </p>
        )}
        {desdeTexto && <p className="text-sm text-texto-suave">{desdeTexto}</p>}
      </div>
    </header>
  );
}
