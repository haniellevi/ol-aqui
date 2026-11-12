import { formatarNome } from "@/lib/formatar-nome";
import "server-only";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { lojasCatalogo } from "@/lib/dados/catalogo";
import type { Regiao } from "@/lib/tipos";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { linkLoja } from "@/lib/formato";

// "Lojas em destaque" no Início: lojas que contrataram o tipo "loja" na região.
// Lugar pago: sempre com a etiqueta "Patrocinado" (Código de Defesa do Consumidor).
// titulo: vem do painel (tela 12, home_blocos); sem ele, o de sempre.
export async function LojasEmDestaque({ regiao, titulo = "Lojas em destaque" }: { regiao: Regiao; titulo?: string }) {
  const lojas = await lojasCatalogo(regiao, null, 12, 0, true);
  if (!lojas.length) return null;
  return (
    <section aria-labelledby="titulo-lojas-destaque" className="flex flex-col gap-3">
      <h2 id="titulo-lojas-destaque" className="flex items-center gap-2 text-lg font-semibold">
        {titulo}
        <span className="rounded-full bg-patrocinado-fundo px-2 py-0.5 text-xs font-semibold text-beringela">Patrocinado</span>
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lojas.map((l) => (
          <li key={l.id} className="w-28 shrink-0 snap-start">
            <Link
              href={linkLoja(l.slug)}
              className="flex h-full flex-col items-center gap-2 rounded-card bg-cartao p-3 text-center shadow-1 focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            >
              <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="md" />
              <span className="line-clamp-2 text-sm leading-4 font-semibold">{formatarNome(l.nome)}</span>
              <span className="text-legenda leading-[18px] text-texto-suave">{l.cidade}</span>
              {l.verificada && (
                <span className="flex items-center gap-1 text-legenda leading-[18px] font-semibold text-verde-escuro">
                  <ShieldCheck className="size-4" aria-hidden />
                  Verificada
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
