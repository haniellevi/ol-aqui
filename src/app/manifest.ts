import type { MetadataRoute } from "next";

// Ícone do app (PWA) com o logo oficial: opção 1, pin no "i", em beringela.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OLAKI",
    short_name: "OLAKI",
    description: "Olha aqui o que você procura",
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
