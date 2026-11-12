// Fotos do Storage do Supabase passam pelo otimizador do Next (AVIF/WebP no tamanho da tela).
// Qualquer outro endereço (prévia local, blob:, outro host) vai como está, para não quebrar.

const HOST_STORAGE = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

/** true quando a foto é do Storage público do projeto (o mesmo host liberado no next.config). */
export function podeOtimizar(src: string): boolean {
  if (!HOST_STORAGE) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === HOST_STORAGE && url.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}
