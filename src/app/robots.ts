import type { MetadataRoute } from "next";
import { SITE } from "@/lib/formato";

// O que o Google pode ler. Áreas com login, painel e rotas internas ficam de fora
// (as páginas já levam "noindex"; aqui o robô nem gasta visita com elas).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/minha-conta",
        "/anunciar",
        "/quero-vender",
        "/destacar",
        "/pagar",
        "/entrar",
        "/confirmar-celular",
        "/completar-perfil",
        "/convite-loja",
        "/receber-loja",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
