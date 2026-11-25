import { eventoPermitido, type NomeEvento } from "./contrato";

export function configuracaoGa4(id: string, ambiente: string) {
  const valido = /^G-[A-Z0-9]{4,20}$/.test(id) && ["simulacao", "homologacao", "producao"].includes(ambiente);
  return { id: valido ? id : null, ambiente, habilitado: false as const, status: !id ? "nao_configurado" : valido ? "desligado" : "invalido" };
}

// Eventos sem os parâmetros de ecommerce obrigatórios usam nomes customizados.
// Este simulador não é importado por nenhum coletor e não tem transporte padrão.
const nomes: Record<NomeEvento, string> = {
  page_view: "page_view", search_completed: "search_completed", view_item_list: "catalog_list_view",
  view_item: "catalog_item_view", view_store: "store_view", contact_intent: "contact_intent", share: "catalog_share",
};
export type EventoGa4 = { name: string; params: { route_model: string; source: string; cohort: string; result_band?: string } };
export function criarSimuladorGa4(transporteSintetico: (evento: EventoGa4) => void) {
  const vistos = new Set<string>();
  return (config: ReturnType<typeof configuracaoGa4>, preferencia: { estatistica: boolean }, valor: unknown, ocorrencia: string): boolean => {
    if (config.ambiente !== "simulacao" || !config.id || config.status !== "desligado" || !/^G-[A-Z0-9]{4,20}$/.test(config.id) || preferencia.estatistica !== true) return false;
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(ocorrencia) || vistos.has(ocorrencia)) return false;
    const e = eventoPermitido(valor);
    if (!e) return false;
    // Sem fila, retry ou acesso a browser/fetch. Exceção do transporte não cria sucesso.
    vistos.add(ocorrencia);
    try {
      transporteSintetico({ name: nomes[e.nome], params: { route_model: e.rota, source: e.fonte, cohort: e.coorte, ...(e.faixa ? { result_band: e.faixa } : {}) } });
      return true;
    } catch { return false; }
  };
}
