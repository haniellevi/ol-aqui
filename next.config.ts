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
    remotePatterns: host ? [{ protocol: "https", hostname: host, pathname: "/storage/v1/object/public/**" }] : [],
  },
};

export default nextConfig;
