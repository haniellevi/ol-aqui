"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { BarChart3, Bot, FileText, FolderTree, LayoutDashboard, LogOut, MapPinned, Megaphone, MessageSquareText, Receipt, Scale, ShieldAlert, SlidersHorizontal, Sparkles, Store, Tags, UsersRound } from "lucide-react";
import { podeVerLink, type Papel } from "@/lib/tipos-equipe";
import { LINK_ADMIN_ANUNCIOS } from "@/lib/rotas";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

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

/**
 * Menu do painel. No computador é a barra lateral (peça Sidebar), que recolhe para só ícones
 * pelo botão do topo ou Ctrl+B; no celular é a barra de baixo que rola de lado.
 * `papel`: o menu mostra só as telas que o papel usa (tela 14). Link sem regra = só administrador.
 */
export function NavAdmin({ pendencias, papel, inicio, aberta = true }: { pendencias: number; papel: Papel; inicio: string; aberta?: boolean }) {
  const atual = usePathname();
  const itens = ITENS.filter((i) => podeVerLink(papel, i.href));
  const barra = useRef<HTMLElement>(null);
  // No celular a barra rola de lado: deixa o item aberto à vista
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [atual]);
  const ehAtivo = (href: string) => (href === "/admin" ? atual === href : atual.startsWith(href));
  return (
    <>
    <SidebarProvider defaultOpen={aberta} className="contents" style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="h-16 flex-row items-center justify-between gap-2 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link href={inicio} className="flex items-center gap-2 group-data-[collapsible=icon]:hidden focus-visible:outline-2 focus-visible:outline-laranja-escuro">
            <Image src="/logo/mercado-da-regiao-marca.svg" alt="Mercado da Região" width={98} height={36} />
            <span className="text-legenda text-texto-suave">Painel</span>
          </Link>
          <SidebarTrigger className="text-texto-suave" />
        </SidebarHeader>
        <SidebarContent className="px-3 pb-4 group-data-[collapsible=icon]:px-2">
          <nav aria-label="Painel administrativo">
            <SidebarMenu>
              {itens.map(({ href, rotulo, icone: Icone }) => {
                const ativo = ehAtivo(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} aria-current={ativo ? "page" : undefined} />}
                      isActive={ativo}
                      tooltip={rotulo}
                      className="admin-menu-item h-9 gap-2.5 px-3 text-base text-texto-suave data-active:text-beringela [&_svg]:size-[1.125rem] data-active:[&_svg]:text-laranja-escuro"
                    >
                      <Icone aria-hidden />
                      <span>{rotulo}</span>
                    </SidebarMenuButton>
                    {href === "/admin/moderacao" && pendencias > 0 && (
                      <SidebarMenuBadge className="right-2 top-2 rounded-full bg-perigo px-1.5 text-legenda font-bold text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                        {pendencias}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarContent>
        <SidebarFooter className="px-3 pb-3 group-data-[collapsible=icon]:px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SignOutButton redirectUrl="/">
                <SidebarMenuButton type="button" tooltip="Sair" className="admin-menu-item h-9 gap-2.5 px-3 text-base text-beringela">
                  <LogOut aria-hidden />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SignOutButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
    <div className="fixed inset-x-0 bottom-0 z-20 flex border-t border-borda bg-cartao shadow-2 md:hidden">
    <nav
      ref={barra}
      aria-label="Painel administrativo"
      className="flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
    >
      {itens.map(({ href, rotulo, curto, icone: Icone }: (typeof ITENS)[number] & { curto?: string }) => {
        const ativo = ehAtivo(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`relative flex min-h-14 w-20 shrink-0 flex-col items-center justify-center gap-1 text-legenda leading-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-laranja-escuro ${
              ativo ? "bg-selecao font-semibold text-beringela" : "font-normal text-texto-suave hover:bg-fundo"
            }`}
          >
            <Icone className={`size-5 shrink-0 ${ativo ? "text-laranja-escuro" : ""}`} aria-hidden />
            {/* no celular (itens de 80px, a barra rola de lado) o nome longo vira curto para caber inteiro */}
            {curto ? (
              <>
                <span className="max-w-full truncate px-0.5" aria-hidden>
                  {curto}
                </span>
                <span className="sr-only">{rotulo}</span>
              </>
            ) : (
              <span className="max-w-full truncate px-0.5">{rotulo}</span>
            )}
            {href === "/admin/moderacao" && pendencias > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-perigo px-1.5 text-legenda font-bold leading-5 text-white">
                {pendencias}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
    <SignOutButton redirectUrl="/">
      <button type="button" className="flex min-h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 border-l border-borda text-legenda font-semibold leading-4 text-beringela hover:bg-fundo focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-laranja-escuro">
        <LogOut className="size-5" aria-hidden />
        Sair
      </button>
    </SignOutButton>
    </div>
    </>
  );
}
