export const ENTRADAS_ADMIN = [
  { href: "/admin/hoje", rotulo: "Hoje" },
  { href: "/admin/lojas", rotulo: "Lojas" },
  { href: "/admin/anuncios", rotulo: "Anúncios" },
  { href: "/admin/moderacao", rotulo: "Moderação" },
  { href: "/admin/pagamentos", rotulo: "Pagamentos" },
  { href: "/admin", rotulo: "Resultados" },
  { href: "/admin/configuracoes", rotulo: "Configurações", curto: "Config." },
] as const;

export function entradaAdminAtiva(caminho: string): string {
  if (caminho === "/admin" || /^\/admin\/(visitas|relatorios|produtos)(\/|$)/.test(caminho)) return "/admin";
  if (/^\/admin\/(funil|usuarios|lixeira)(\/|$)/.test(caminho)) return "/admin/lojas";
  return ENTRADAS_ADMIN.find(({ href }) => href !== "/admin" && (caminho === href || caminho.startsWith(`${href}/`)))?.href ?? "/admin/configuracoes";
}
