// Radar do comprador: textos e regras usados no servidor e no navegador.
// Valores do banco: radar_pedidos.categoria (enum categoria_anuncio), urgencia, modo_contato e status.

export type CategoriaPedido = "veiculo" | "imovel" | "movel" | "geral";
export type UrgenciaPedido = "normal" | "esta_semana" | "hoje";
export type ModoContato = "whatsapp_direto" | "propostas_prazo";
export type StatusPedido = "aberto" | "em_analise" | "atendido" | "encerrado" | "congelado";

export const CATEGORIAS_PEDIDO: { valor: CategoriaPedido; rotulo: string }[] = [
  { valor: "veiculo", rotulo: "Veículos" },
  { valor: "imovel", rotulo: "Imóveis" },
  { valor: "movel", rotulo: "Móveis e casa" },
  { valor: "geral", rotulo: "Outra coisa" },
];

export const URGENCIAS: { valor: UrgenciaPedido; rotulo: string }[] = [
  { valor: "normal", rotulo: "Sem pressa" },
  { valor: "esta_semana", rotulo: "Esta semana" },
  { valor: "hoje", rotulo: "Hoje" },
];

/** Limites do banco (checks de radar_pedidos). */
export const TITULO_MIN = 8;
export const TITULO_MAX = 120;
export const DETALHES_MAX = 1000;

/** Prazos padrão do modo "propostas aqui" quando o painel não responde (radar.prazos_horas). */
export const PRAZOS_PADRAO = [24, 72, 168];

/** 24 → "1 dia"; 72 → "3 dias"; 12 → "12 horas". */
export function rotuloPrazo(horas: number): string {
  if (horas % 24 === 0) {
    const d = horas / 24;
    return d === 1 ? "1 dia" : `${d} dias`;
  }
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

const diaHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

/** "12/11 às 18:30" (horário de Corrente). */
export function diaEHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const partes = diaHora.formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}/${v("month")} às ${v("hour")}:${v("minute")}`;
}

export type SituacaoPedido = { texto: string; cor: string; aberto: boolean };

/** Situação do pedido em palavras (status do banco + prazo). */
export function situacaoPedido(
  p: { status: StatusPedido; expira_em: string; modo_contato: ModoContato; propostas_ate: string | null },
  agora: Date = new Date(),
): SituacaoPedido {
  if (p.status === "em_analise") return { texto: "Em análise", cor: "bg-aviso-fundo text-aviso", aberto: false };
  if (p.status === "atendido") return { texto: "Resolvido", cor: "bg-green-100 text-verde-escuro", aberto: false };
  if (p.status === "congelado") return { texto: "Suspenso", cor: "bg-red-100 text-perigo", aberto: false };
  if (p.status === "encerrado" || new Date(p.expira_em) <= agora) {
    return { texto: "Encerrado", cor: "bg-fundo text-texto-suave", aberto: false };
  }
  if (p.modo_contato === "propostas_prazo" && p.propostas_ate && new Date(p.propostas_ate) <= agora) {
    return { texto: "Prazo acabou", cor: "bg-laranja-claro text-beringela", aberto: false };
  }
  return { texto: "No ar", cor: "bg-green-100 text-verde-escuro", aberto: true };
}

/** Link para pedir no Radar já com o texto da busca. */
export const linkPedir = (texto?: string | null) => {
  const t = (texto ?? "").trim();
  return t ? `/radar/pedir?pedido=${encodeURIComponent(t.slice(0, TITULO_MAX))}` : "/radar/pedir";
};

export const linkPedido = (id: string) => `/radar/pedido/${id}`;
