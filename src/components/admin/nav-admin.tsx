"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldAlert, SlidersHorizontal, Tags } from "lucide-react";

const ITENS = [
  { href: "/admin", rotulo: "Resumo", icone: LayoutDashboard },
  { href: "/admin/planos", rotulo: "Planos", icone: Tags },
  { href: "/admin/configuracoes", rotulo: "Configurações", icone: SlidersHorizontal },
  { href: "/admin/moderacao", rotulo: "Moderação", icone: ShieldAlert },
];

export function NavAdmin({ pendencias }: { pendencias: number }) {
  const atual = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-neutral-200 bg-white md:static md:flex md:w-56 md:flex-col md:gap-1 md:border-0 md:bg-transparent md:p-4">
      {ITENS.map(({ href, rotulo, icone: Icone }) => {
        const ativo = href === "/admin" ? atual === href : atual.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium md:h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${
              ativo ? "text-laranja-escuro md:bg-orange-50" : "text-neutral-500 md:hover:bg-neutral-100"
            }`}
          >
            <Icone className="size-5" aria-hidden />
            {rotulo}
            {href === "/admin/moderacao" && pendencias > 0 && (
              <span className="absolute right-[22%] top-2 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white md:static md:ml-auto md:text-xs">
                {pendencias}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
