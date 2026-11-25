import { lerFiltrosRelatorio, somarDias } from "./relatorios";

type Params = Record<string, string | string[] | undefined>;
export function periodoLancamento(params: Params, hoje: string) {
  const dias = [7, 30, 90].includes(Number(params.dias)) ? Number(params.dias) : 30;
  const { filtros, aviso } = lerFiltrosRelatorio({ de: somarDias(hoje, 1 - dias), ate: hoje, ...params });
  const tamanho = Math.round((Date.parse(filtros.ate) - Date.parse(filtros.de)) / 86400000) + 1;
  return { de: filtros.de, ate: filtros.ate, anteriorDe: somarDias(filtros.de, -tamanho), anteriorAte: somarDias(filtros.de, -1), aviso };
}
export function variacao(atual: number, anterior: number): string {
  if (anterior === 0) return "Sem base anterior";
  const pct = Math.round((atual - anterior) / anterior * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export type Lancamento = {
  gerado_em: string; corte: string | null; de: string; ate: string;
  medicao: Medicao;
  oferta: { lojas: number; sem_anuncios: number; anuncios: number };
  ativacao: { maduras: number; com_oferta: number };
  radar: { maduros: number; com_proposta: number; sem_proposta: number };
  negocio: { publicados: number; vendas_declaradas: number; contatos: number; cupons: number; receita_centavos: number };
  demanda: { categoria: string; regiao: string; buscas: number; sem_resultado: number }[];
  catalogo: { categoria: string; cidade: string; anuncios: number }[];
  origens: { origem: string; pageviews: number }[];
  ultima_visita: string | null;
};
export type Medicao = { fonte: "interno"; coorte: "consentida_v1"; pageviews: number; navegadores: number; sessoes: number; sem_dados: boolean };
const numero = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function lerMedicao(data: unknown): Medicao | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Medicao;
  return d.fonte === "interno" && d.coorte === "consentida_v1" && [d.pageviews,d.navegadores,d.sessoes].every(numero) && typeof d.sem_dados === "boolean" ? d : null;
}
export function lerLancamento(data: unknown): Lancamento | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Lancamento;
  if (!lerMedicao(d.medicao)) return null;
  if (![d.gerado_em,d.de,d.ate].every(s => typeof s === "string" && Number.isFinite(Date.parse(s)))) return null;
  if (![d.corte,d.ultima_visita].every(s => s === null || (typeof s === "string" && Number.isFinite(Date.parse(s))))) return null;
  for (const [obj, keys] of [[d.oferta,["lojas","sem_anuncios","anuncios"]],[d.ativacao,["maduras","com_oferta"]],[d.radar,["maduros","com_proposta","sem_proposta"]],[d.negocio,["publicados","vendas_declaradas","contatos","cupons","receita_centavos"]]] as const) {
    if (!obj || !keys.every(k => numero((obj as Record<string,unknown>)[k]))) return null;
  }
  if (!Array.isArray(d.demanda) || !d.demanda.every(r=>r && typeof r.categoria === "string" && typeof r.regiao === "string" && numero(r.buscas) && numero(r.sem_resultado) && r.sem_resultado<=r.buscas)) return null;
  if (!Array.isArray(d.catalogo) || !d.catalogo.every(r=>r && typeof r.categoria === "string" && typeof r.cidade === "string" && numero(r.anuncios))) return null;
  if (!Array.isArray(d.origens) || !d.origens.every(r=>r && typeof r.origem === "string" && numero(r.pageviews))) return null;
  if (d.ativacao.com_oferta>d.ativacao.maduras || d.radar.com_proposta>d.radar.maduros) return null;
  return d;
}
