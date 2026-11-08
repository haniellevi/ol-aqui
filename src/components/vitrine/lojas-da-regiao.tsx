import "server-only";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { COLUNAS_VITRINE } from "@/lib/dados/vitrines";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { linkLoja } from "@/lib/formato";
import type { Vitrine } from "@/lib/tipos";

// "Lojas da região" no Início (T2): logo redondo + nome + selo. Só lojas (tipo 'loja') ativas.
async function lerLojas(microrregiaoId: string, limite: number): Promise<Vitrine[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("vitrines_lojas")
      .select(COLUNAS_VITRINE)
      .eq("tipo", "loja")
      .eq("status", "ativa")
      .eq("microrregiao_id", microrregiaoId)
      .order("selo_loja_verificada", { ascending: false })
      .order("criado_em", { ascending: true })
      .limit(limite);
    return error ? [] : ((data ?? []) as Vitrine[]);
  }, []);
}

export async function LojasDaRegiao({
  microrregiaoId,
  lugar,
  limite = 12,
  titulo,
}: {
  microrregiaoId: string;
  lugar: string;
  limite?: number;
  /** vem do painel (tela 12, home_blocos); sem ele, "Lojas de {lugar}" */
  titulo?: string;
}) {
  const lojas = await lerLojas(microrregiaoId, limite);
  if (!lojas.length) return null;
  return (
    <section aria-labelledby="titulo-lojas" className="flex flex-col gap-3">
      <h2 id="titulo-lojas" className="text-lg font-semibold">
        {titulo ?? `Lojas de ${lugar}`}
      </h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lojas.map((l) => (
          <li key={l.id} className="w-24 shrink-0">
            <Link
              href={linkLoja(l.slug)}
              className="flex flex-col items-center gap-1.5 rounded-card p-1 text-center hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
            >
              <AvatarVitrine nome={l.nome} logo={l.logo_url} tamanho="lg" />
              <span className="line-clamp-2 text-[13px] font-semibold leading-[18px]">{l.nome}</span>
              {l.selo_loja_verificada && <span className="text-[13px] font-semibold leading-[18px] text-verde-escuro">Verificada</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
