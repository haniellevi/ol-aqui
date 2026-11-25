import { DESTINOS, eventoPermitido, type Evento } from "./contrato";

export type DestinoExterno = keyof typeof DESTINOS;
export type AmbienteExterno = "local" | "homologacao" | "producao";
type Entrada = Readonly<{ id?: string; solicitarHomologacao?: boolean }>;
export type EstadoExterno = "nao_configurado" | "invalido" | "desativado" | "pronto_para_homologar";
export type ConfiguracaoExterna = Readonly<{
  destino: DestinoExterno; ambiente: AmbienteExterno; id: string | null;
  solicitarHomologacao: boolean; status: EstadoExterno; habilitado: false;
}>;
const desligados = () => Object.freeze({ ga4: Object.freeze({ solicitarHomologacao: false }), meta: Object.freeze({ solicitarHomologacao: false }) });
// IDs são identificadores públicos próprios, nunca tokens. Nenhuma leitura de .env/segredo.
export const CONFIGURACOES_EXTERNAS: Readonly<Record<AmbienteExterno, Readonly<Record<DestinoExterno, Entrada>>>> = Object.freeze({
  local: desligados(), homologacao: desligados(), producao: desligados(),
});
export function configuracaoExterna(destino: DestinoExterno, ambiente: AmbienteExterno, entrada: Entrada = {}): ConfiguracaoExterna {
  const conhecido = ["local", "homologacao", "producao"].includes(ambiente) && ["ga4", "meta"].includes(destino);
  // Validação conservadora de formato, não consulta nem confirma existência/propriedade.
  const id = entrada.id ?? "";
  const formato = typeof id === "string" && (destino === "ga4" ? /^G-[A-Z0-9]{4,20}$/.test(id) : /^[1-9][0-9]{4,24}$/.test(id)) && !/\s/.test(id);
  const solicitarHomologacao = entrada.solicitarHomologacao === true;
  const status: EstadoExterno = !conhecido ? "invalido" : !id ? "nao_configurado" : !formato ? "invalido" : solicitarHomologacao ? "pronto_para_homologar" : "desativado";
  return Object.freeze({ destino, ambiente, id: conhecido && formato ? id : null, solicitarHomologacao, status, habilitado: false });
}

type Parametros = { route_model: string; source: "interno"; cohort: "consentida_v1" };
type Ga4 = { destino: "ga4"; evento: { name: "page_view" | "contact_intent"; params: Parametros } };
type Meta = { destino: "meta"; evento: { name: "PageView" | "ContactIntent"; metodo: "trackSingle" | "trackSingleCustom"; params: Parametros; eventID: string } };
export type DespachoEnsaio = (Ga4 | Meta) & { id: string; ocorrencia: string; modo: "ensaio_sem_sdk" };

function envelopeExterno(valor: unknown): Evento | null {
  const e = eventoPermitido(valor);
  // Recusa a URL original mesmo que eventoPermitido consiga neutralizá-la.
  if (!e || !(valor && typeof valor === "object" && "rota" in valor) || valor.rota !== e.rota) return null;
  if (!["/", "/lojas", "/categorias"].includes(e.rota) || e.faixa !== undefined) return null;
  return e.nome === "page_view" || e.nome === "contact_intent" ? e : null;
}
function adaptar(config: ConfiguracaoExterna, e: Evento, ocorrencia: string): DespachoEnsaio {
  const params: Parametros = { route_model: e.rota, source: e.fonte, cohort: e.coorte };
  const base = { id: config.id!, ocorrencia, modo: "ensaio_sem_sdk" as const };
  return config.destino === "ga4"
    ? { ...base, destino: "ga4", evento: { name: e.nome === "page_view" ? "page_view" : "contact_intent", params } }
    : { ...base, destino: "meta", evento: { name: e.nome === "page_view" ? "PageView" : "ContactIntent", metodo: e.nome === "page_view" ? "trackSingle" : "trackSingleCustom", params, eventID: ocorrencia } };
}

/** Contrato de teste, não é cliente vendor. Sem transporte padrão, SDK, fila ou retries.
 * Cada instância representa um destino e uma vida de navegação. Retorna aceite do
 * transporte sintético, nunca confirmação de ingestão Google/Meta.
 */
export function criarEnsaioExterno(fontes: {
  configuracao: () => ConfiguracaoExterna | null;
  preferencia: () => { estatistica?: boolean; marketing?: boolean };
  transporte?: (despacho: DespachoEnsaio) => void | Promise<void>;
}) {
  const tentadas = new Set<string>();
  let ultimaPagina: string | null = null;
  return async (valor: unknown, ocorrencia: string): Promise<boolean> => {
    if (typeof ocorrencia !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(ocorrencia) || /\s/.test(ocorrencia) || tentadas.has(ocorrencia)) return false;
    // Também consome recusas, para que aceite posterior não recupere o evento.
    tentadas.add(ocorrencia);
    try {
      const c = fontes.configuracao();
      if (!c || c.habilitado !== false || c.ambiente !== "local" || c.status !== "pronto_para_homologar") return false;
      const revalidada = configuracaoExterna(c.destino, c.ambiente, { id: c.id ?? "", solicitarHomologacao: c.solicitarHomologacao });
      if (revalidada.status !== "pronto_para_homologar" || !fontes.transporte) return false;
      const e = envelopeExterno(valor);
      if (!e) return false;
      const p = fontes.preferencia();
      if ((c.destino === "ga4" ? p.estatistica : p.marketing) !== true) return false;
      if (e.nome === "page_view") {
        if (ultimaPagina === e.rota) return false;
        ultimaPagina = e.rota;
      }
      await fontes.transporte(adaptar(revalidada, e, ocorrencia));
      return true;
    } catch { return false; }
  };
}
