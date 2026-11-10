import "server-only";
import Link from "next/link";
import { lojasCatalogo } from "@/lib/dados/catalogo";
import { Botao } from "@/components/ui/botao";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { linkLoja } from "@/lib/formato";
import type { Regiao } from "@/lib/tipos";

export async function LojasDaRegiao({
  regiao,
  lugar,
  limite = 12,
  titulo,
}: {
  regiao: Regiao;
  lugar: string;
  limite?: number;
  /** vem do painel (tela 12, home_blocos); sem ele, "Lojas de {lugar}" */
  titulo?: string;
}) {
  const lojas = await lojasCatalogo(regiao, null, limite);
  return (
    <section aria-labelledby="titulo-lojas" className="flex flex-col gap-3">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
        <h2 id="titulo-lojas" className="text-lg font-semibold">
          {titulo ?? `Lojas de ${lugar}`}
        </h2>
        <Botao href="/lojas" variante="secundario">Ver todas as lojas</Botao>
      </div>
      {lojas.length > 0 && (
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {lojas.map((l) => (
            <li key={l.id} className="w-24 shrink-0">
              <Link
                href={linkLoja(l.slug)}
                className="flex flex-col items-center gap-1.5 rounded-card p-1 text-center hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
              >
                <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="lg" />
                <span className="line-clamp-2 text-legenda font-semibold leading-[18px]">{l.nome}</span>
                {l.verificada && <span className="text-legenda font-semibold leading-[18px] text-verde-escuro">Verificada</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
