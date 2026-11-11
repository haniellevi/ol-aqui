import type { MetadataRoute } from "next";

// Ícone do app (PWA) com o selo "M" do Mercado da Região (DESIGN.md, seção Marca).
// O "maskable" tem fundo laranja até a borda para o Android recortar em círculo ou gota sem sobrar branco.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mercado da Região",
    short_name: "Mercado",
    description: "Olha aqui o que você procura",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F8FA",
    theme_color: "#4B1248",
    icons: [
      { src: "/icone-mercado.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/mercado-192.png", sizes: "192x192", type: "image/png" },
      { src: "/mercado-512.png", sizes: "512x512", type: "image/png" },
      { src: "/mercado-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
