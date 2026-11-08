"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, FileText, LayoutDashboard, MessageSquareText, Receipt, ShieldAlert, SlidersHorizontal, Sparkles, Store, Tags } from "lucide-react";

const ITENS = [
  { href: "/admin", rotulo: "Resumo", icone: LayoutDashboard },
  { href: "/admin/planos", rotulo: "Planos", icone: Tags },
  { href: "/admin/configuracoes", rotulo: "Configurações", curto: "Config.", icone: SlidersHorizontal },
  { href: "/admin/moderacao", rotulo: "Moderação", icone: ShieldAlert },
  { href: "/admin/lojas", rotulo: "Lojas", icone: Store },
  { href: "/admin/pagamentos", rotulo: "Pagamentos", curto: "Pagtos.", icone: Receipt },
  { href: "/admin/destaques", rotulo: "Destaques", icone: Sparkles },
  { href: "/admin/robo", rotulo: "Robô Aki", curto: "Aki", icone: Bot },
  { href: "/admin/textos", rotulo: "Página inicial e textos", curto: "Textos", icone: FileText },
  { href: "/admin/mensagens", rotulo: "Mensagens automáticas", curto: "Msgs.", icone: MessageSquareText },
  { href: "/admin/relatorios", rotulo: "Relatórios", curto: "Relat.", icone: BarChart3 },
];

export function NavAdmin({ pendencias }: { pendencias: number }) {
  const atual = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-borda bg-cartao shadow-2 md:static md:flex md:w-56 md:flex-col md:gap-1 md:border-0 md:bg-transparent md:p-4 md:shadow-none">
      {ITENS.map(({ href, rotulo, curto, icone: Icone }: (typeof ITENS)[number] & { curto?: string }) => {
        const ativo = href === "/admin" ? atual === href : atual.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[13px] font-semibold leading-4 md:h-12 md:flex-row md:justify-start md:gap-3 md:rounded-card md:px-3 md:text-sm md:leading-5 ${
              ativo ? "text-laranja-escuro md:bg-laranja-claro" : "text-texto-suave md:hover:bg-fundo"
            }`}
          >
            <Icone className="size-5" aria-hidden />
            {/* no celular (5 itens lado a lado) o nome longo vira curto para caber inteiro */}
            {curto ? (
              <>
                <span className="max-w-full truncate px-0.5 md:hidden" aria-hidden>
                  {curto}
                </span>
                <span className="sr-only md:not-sr-only">{rotulo}</span>
              </>
            ) : (
              <span className="max-w-full truncate px-0.5">{rotulo}</span>
            )}
            {href === "/admin/moderacao" && pendencias > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-perigo px-1.5 text-[13px] font-bold leading-5 text-white md:static md:ml-auto">
                {pendencias}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
