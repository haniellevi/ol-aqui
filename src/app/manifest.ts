import type { MetadataRoute } from "next";

// Ícone do app (PWA): M branco com o pin laranja no quadrado beringela (docs/MARCA.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mercado da Região",
    short_name: "Mercado da Região",
    description: "Aqui a sua cidade aparece",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4F7",
    theme_color: "#4B1248",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
