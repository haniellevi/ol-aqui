"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, FileText, FolderTree, LayoutDashboard, MapPinned, Megaphone, MessageSquareText, Receipt, Scale, ShieldAlert, SlidersHorizontal, Sparkles, Store, Tags, UsersRound } from "lucide-react";
import { podeVerLink, type Papel } from "@/lib/tipos-equipe";
import { LINK_ADMIN_ANUNCIOS } from "@/lib/rotas";

const ITENS = [
  { href: "/admin", rotulo: "Resumo", icone: LayoutDashboard },
  { href: LINK_ADMIN_ANUNCIOS, rotulo: "Anúncios", icone: Megaphone },
  { href: "/admin/planos", rotulo: "Planos", icone: Tags },
  { href: "/admin/configuracoes", rotulo: "Configurações", curto: "Config.", icone: SlidersHorizontal },
  { href: "/admin/moderacao", rotulo: "Moderação", icone: ShieldAlert },
  { href: "/admin/lojas", rotulo: "Lojas", icone: Store },
  { href: "/admin/pagamentos", rotulo: "Pagamentos", curto: "Pagtos.", icone: Receipt },
  { href: "/admin/destaques", rotulo: "Destaques", icone: Sparkles },
  { href: "/admin/robo", rotulo: "Robô Aki", curto: "Aki", icone: Bot },
  { href: "/admin/textos", rotulo: "Página inicial e textos", curto: "Textos", icone: FileText },
  { href: "/admin/regioes", rotulo: "Regiões e cidades", curto: "Regiões", icone: MapPinned },
  { href: "/admin/categorias", rotulo: "Categorias e campos", curto: "Categ.", icone: FolderTree },
  { href: "/admin/equipe", rotulo: "Equipe e permissões", curto: "Equipe", icone: UsersRound },
  { href: "/admin/compliance", rotulo: "Compliance jurídico", curto: "Jurídico", icone: Scale },
  { href: "/admin/mensagens", rotulo: "Mensagens automáticas", curto: "Mensagens", icone: MessageSquareText },
  { href: "/admin/relatorios", rotulo: "Relatórios", icone: BarChart3 },
];

/** `papel`: o menu mostra só as telas que o papel usa (tela 14). Link sem regra = só administrador. */
export function NavAdmin({ pendencias, papel }: { pendencias: number; papel: Papel }) {
  const atual = usePathname();
  const itens = ITENS.filter((i) => podeVerLink(papel, i.href));
  const barra = useRef<HTMLElement>(null);
  // No celular a barra rola de lado: deixa o item aberto à vista
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [atual]);
  return (
    <nav
      ref={barra}
      aria-label="Painel administrativo"
      className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto overscroll-x-contain border-t [scrollbar-width:none] border-borda bg-cartao shadow-2 md:static md:min-h-0 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:border-0 md:bg-transparent md:px-3 md:pb-4 md:shadow-none"
    >
      {itens.map(({ href, rotulo, curto, icone: Icone }: (typeof ITENS)[number] & { curto?: string }) => {
        const ativo = href === "/admin" ? atual === href : atual.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`admin-menu-item relative flex min-h-16 w-20 shrink-0 flex-col items-center justify-center gap-1 text-legenda leading-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-laranja-escuro md:min-h-11 md:w-auto md:flex-row md:justify-start md:gap-2.5 md:rounded-campo md:px-3 md:py-2 md:leading-5 ${
              ativo ? "bg-selecao font-semibold text-beringela" : "font-normal text-texto-suave hover:bg-fundo"
            }`}
          >
            <Icone className={`size-5 shrink-0 md:size-[1.125rem] ${ativo ? "text-laranja-escuro" : ""}`} aria-hidden />
            {/* no celular (itens de 80px, a barra rola de lado) o nome longo vira curto para caber inteiro */}
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
              <span className="absolute right-[22%] top-1 rounded-full bg-perigo px-1.5 text-legenda font-bold leading-5 text-white md:static md:ml-auto">
                {pendencias}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
