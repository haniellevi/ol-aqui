import Image from "next/image";
import Link from "next/link";
import { exigirEquipe } from "@/lib/admin/equipe";
import { podeVerTela, primeiraTela } from "@/lib/tipos-equipe";
import { NavAdmin } from "@/components/admin/nav-admin";

export const metadata = { title: { default: "Painel", template: "%s · Painel OLAKI" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Qualquer pessoa ativa da equipe entra; o menu mostra só as telas do papel dela (tela 14).
  const { supabase, papel } = await exigirEquipe();
  let pendencias = 0;
  if (podeVerTela(papel, "moderacao")) {
    const [anuncios, pedidos, denuncias] = await Promise.all([
      supabase.from("anuncios").select("id", { count: "exact", head: true }).eq("status", "em_analise"),
      supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "em_analise"),
      supabase.from("denuncias").select("id", { count: "exact", head: true }).eq("status", "aberta"),
    ]);
    pendencias = (anuncios.count ?? 0) + (pedidos.count ?? 0) + (denuncias.count ?? 0);
  }

  return (
    <div className="min-h-dvh bg-fundo md:flex">
      <aside className="md:sticky md:top-0 md:h-dvh md:border-r md:border-borda md:bg-cartao">
        <Link href={primeiraTela(papel)} className="hidden items-center gap-2 px-6 pb-2 pt-6 md:flex">
          <Image src="/logo/olaki-marca.svg" alt="OLAKI" width={88} height={36} />
          <span className="text-[13px] font-semibold uppercase tracking-wide text-texto-suave">Painel</span>
        </Link>
        <NavAdmin pendencias={pendencias} papel={papel} />
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
    </div>
  );
}
