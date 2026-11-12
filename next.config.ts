import type { NextConfig } from "next";

// Fotos dos anúncios ficam no Storage do Supabase. Libera esse endereço para o next/image
// (lido na hora do build; sem a variável, nenhum host extra é liberado).
function hostDoSupabase(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
}
const host = hostDoSupabase();

const nextConfig: NextConfig = {
  images: {
    // AVIF/WebP no tamanho de cada tela: fotos e logos ficam bem mais leves no celular.
    formats: ["image/avif", "image/webp"],
    // Guarda a foto otimizada por 31 dias (as fotos do Storage não mudam no mesmo endereço).
    minimumCacheTTL: 2678400,
    remotePatterns: host
      ? [{ protocol: "https", hostname: host, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
