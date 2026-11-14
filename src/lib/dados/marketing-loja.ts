import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

export type CriativoLoja = {
  id: string;
  titulo: string;
  foto: string;
  preco_centavos: number | null;
  preco_antes_centavos: number | null;
  visualizacoes: number;
  cliques: number;
  favoritos: number;
  motivos: string[];
};

export type OportunidadeLoja = {
  termo: string;
  categoria_id: string;
  categoria_slug: string;
  categoria_nome: string;
  buscas: number;
  pedidos: number;
  sem_resultado: number;
};

export type MarketingLoja = {
  dias: 30;
  nicho_definido: boolean;
  regiao_nome: string;
  total_buscas: number;
  criativos: CriativoLoja[];
  oportunidades: OportunidadeLoja[];
};

const contagem = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const texto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 300;
const dinheiro = (v: unknown) => v === null || contagem(v);

function criativo(v: CriativoLoja): boolean {
  return !!v && ehUuid(v.id) && texto(v.titulo) && typeof v.foto === "string" && /^https:\/\//.test(v.foto) &&
    dinheiro(v.preco_centavos) && dinheiro(v.preco_antes_centavos) &&
    contagem(v.visualizacoes) && contagem(v.cliques) && contagem(v.favoritos) &&
    Array.isArray(v.motivos) && v.motivos.length <= 6 && v.motivos.every(texto);
}

function oportunidade(v: OportunidadeLoja): boolean {
  return !!v && texto(v.termo) && ehUuid(v.categoria_id) && texto(v.categoria_nome) &&
    typeof v.categoria_slug === "string" && /^[a-z0-9-]+$/.test(v.categoria_slug) &&
    contagem(v.buscas) && contagem(v.pedidos) && contagem(v.sem_resultado) && v.sem_resultado <= v.buscas;
}

/** A RPC confere a sessão e as permissões atuais. null representa falha, nunca ausência de demanda. */
export async function meuMarketingLoja(vitrineId: string): Promise<MarketingLoja | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("meu_marketing_loja", { p_vitrine: vitrineId });
    const d = data as MarketingLoja | null;
    if (error || !d || d.dias !== 30 || typeof d.nicho_definido !== "boolean" || !texto(d.regiao_nome) ||
      !contagem(d.total_buscas) || !Array.isArray(d.criativos) || d.criativos.length > 3 || !d.criativos.every(criativo) ||
      !Array.isArray(d.oportunidades) || d.oportunidades.length > 8 || !d.oportunidades.every(oportunidade)) return null;
    return d;
  } catch {
    return null;
  }
}
