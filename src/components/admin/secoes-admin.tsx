"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { entradaAdminAtiva } from "@/lib/admin/navegacao";

const SECOES: Record<string, { href: string; nome: string }[]> = {
  "/admin": [
    { href: "/admin", nome: "Visão geral" },
    { href: "/admin/visitas", nome: "Visitas e origem" },
    { href: "/admin/relatorios", nome: "Detalhamento" },
  ],
  "/admin/lojas": [{ href: "/admin/lojas", nome: "Vendedores cadastrados" }, { href: "/admin/funil", nome: "Captação" }, { href: "/admin/usuarios", nome: "Usuários" }],
  "/admin/anuncios": [{ href: "/admin/anuncios", nome: "Catálogo" }, { href: "/admin/anuncios/conversas", nome: "Atendimentos" }],
};

export function SecoesAdmin() {
  const caminho = usePathname();
  const entrada = entradaAdminAtiva(caminho);
  if (entrada === "/admin/configuracoes") {
    return caminho !== entrada ? <Link href={entrada} className="mb-4 inline-flex min-h-10 items-center text-sm font-semibold text-laranja-escuro hover:underline">Voltar às configurações</Link> : null;
  }
  const secoes = SECOES[entrada];
  if (!secoes) return null;
  const atual = [...secoes].reverse().find(s => caminho === s.href || (s.href !== "/admin" && caminho.startsWith(`${s.href}/`)))?.href;
  return <nav aria-label="Seções desta área" className="mb-5 flex gap-2 overflow-x-auto pb-1">
    {secoes.map(s => <Link key={s.href} href={s.href} aria-current={atual === s.href ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-campo border px-4 text-sm font-semibold ${atual === s.href ? "border-laranja-escuro bg-selecao text-beringela" : "border-borda bg-cartao text-beringela hover:bg-fundo"}`}>
      {s.nome}
    </Link>)}
  </nav>;
}
