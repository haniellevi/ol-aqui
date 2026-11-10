import Image from "next/image";
import Link from "next/link";
import { exigirEquipe } from "@/lib/admin/equipe";
import { podeVerTela, primeiraTela } from "@/lib/tipos-equipe";
import { NavAdmin } from "@/components/admin/nav-admin";
import "./painel.css";

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
    <div className="painel-admin min-h-dvh bg-fundo md:flex">
      <a href="#painel-conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-campo focus:bg-laranja focus:p-3 focus:text-beringela">Pular para o conteúdo</a>
      <aside className="md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-borda md:bg-cartao">
        <Link href={primeiraTela(papel)} className="hidden min-h-20 shrink-0 items-center gap-2 px-6 md:flex focus-visible:outline-2 focus-visible:outline-laranja-escuro">
          <Image src="/logo/olaki-marca.svg" alt="OLAKI" width={88} height={36} />
          <span className="text-legenda text-texto-suave">Painel</span>
        </Link>
        <NavAdmin pendencias={pendencias} papel={papel} />
      </aside>
      <main id="painel-conteudo" className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10 lg:px-8">{children}</main>
    </div>
  );
}
