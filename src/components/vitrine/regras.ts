// Regras de exibição da vitrine completa (servem no servidor e no navegador).
// Horário "Aberto agora" sempre no fuso da região (America/Fortaleza, sem horário de verão).
import { DIAS_SEMANA, type DiaSemana, type FaixaHorario, type Horarios, type PlanoPublico, type RecursoVitrine } from "@/lib/tipos-vitrine";

export const FUSO_REGIAO = "America/Fortaleza";

export const NOME_DIA: Record<DiaSemana, string> = {
  dom: "Domingo",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
};

/** Segunda primeiro (como a gente lê a semana), domingo no fim. */
export const DIAS_EM_ORDEM: DiaSemana[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** "08:00" → 480; "24:00" → 1440; inválido → null. */
export function minutosDoDia(h: string): number | null {
  if (h === "24:00") return 1440;
  if (!HORA.test(h)) return null;
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
}

const PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_REGIAO,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DIA_INGLES: Record<string, DiaSemana> = { Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab" };

/** Dia da semana e minuto do dia agora na região. */
export function agoraNaRegiao(agora: Date = new Date()): { dia: DiaSemana; minutos: number } {
  const p = Object.fromEntries(PARTES.formatToParts(agora).map((x) => [x.type, x.value]));
  const dia = DIA_INGLES[p.weekday] ?? "seg";
  const minutos = (Number(p.hour) % 24) * 60 + Number(p.minute);
  return { dia, minutos };
}

/** Faixas válidas de um dia (ignora o que vier torto do banco). */
export function faixasDoDia(h: Horarios | null | undefined, dia: DiaSemana): FaixaHorario[] {
  const lista = h?.[dia];
  if (!Array.isArray(lista)) return [];
  return lista.filter((f) => f && minutosDoDia(f.abre) !== null && minutosDoDia(f.fecha) !== null);
}

export function temHorarios(h: Horarios | null | undefined): boolean {
  return !!h && DIAS_SEMANA.some((d) => faixasDoDia(h, d).length > 0);
}

export type SituacaoAgora = { aberto: boolean; texto: string } | null;

/**
 * "Aberto agora · fecha às 18:00" / "Fechado agora · abre amanhã às 08:00".
 * null quando a loja não informou horário.
 */
export function situacaoAgora(h: Horarios | null | undefined, agora: Date = new Date()): SituacaoAgora {
  if (!temHorarios(h)) return null;
  const { dia, minutos } = agoraNaRegiao(agora);
  for (const f of faixasDoDia(h, dia)) {
    const a = minutosDoDia(f.abre)!;
    const b = minutosDoDia(f.fecha)!;
    if (minutos >= a && minutos < b) {
      return { aberto: true, texto: f.fecha === "24:00" ? "Aberto agora · até meia-noite" : `Aberto agora · fecha às ${f.fecha}` };
    }
  }
  // próxima abertura: ainda hoje, ou nos próximos dias (i = 7: o mesmo dia da semana que vem,
  // para a loja que só abre um dia por semana)
  const hoje = DIAS_SEMANA.indexOf(dia);
  for (let i = 0; i <= 7; i++) {
    const d = DIAS_SEMANA[(hoje + i) % 7];
    const proxima = faixasDoDia(h, d).find((f) => i > 0 || minutosDoDia(f.abre)! > minutos);
    if (proxima) {
      const quando = i === 0 ? "hoje" : i === 1 ? "amanhã" : NOME_DIA[d].toLowerCase();
      return { aberto: false, texto: `Fechado agora · abre ${quando} às ${proxima.abre}` };
    }
  }
  return { aberto: false, texto: "Fechado agora" };
}

/** "08:00 às 12:00 e 14:00 às 18:00" ou "Fechado". */
export function textoDoDia(faixas: FaixaHorario[]): string {
  if (!faixas.length) return "Fechado";
  return faixas.map((f) => `${f.abre} às ${f.fecha === "24:00" ? "24:00" : f.fecha}`).join(" e ");
}

/** Link "Como chegar" no Google Maps: pela localização marcada ou pelo endereço escrito. */
export function linkComoChegar(p: { lat: number | null; lng: number | null; endereco: string | null; cidade?: string | null }): string | null {
  if (p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180) {
    return `https://www.google.com/maps/dir/?api=1&destination=${Number(p.lat)},${Number(p.lng)}`;
  }
  const texto = [p.endereco, p.cidade].filter(Boolean).join(", ").trim();
  return p.endereco && texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null;
}

/** "loja.setenta" → "https://instagram.com/loja.setenta". Só nome válido. */
export function linkInstagram(nome: string | null | undefined): string | null {
  const n = String(nome ?? "").trim().replace(/^@/, "");
  return /^[a-z0-9._]{1,30}$/.test(n) ? `https://instagram.com/${n}` : null;
}

/** Limpa o que a pessoa digitou no campo do Instagram: "@Loja", "instagram.com/loja/" → "loja". */
export function limparInstagram(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "");
}

/** "Plano Slim" → "Slim". */
export const nomeCurtoPlano = (nome: string) => nome.replace(/^Plano\s+/i, "").trim() || nome;

/** ["Slim", "Full"] → "Slim e no Full"; ["Full"] → "Full"; 3 → "Slim, no Full e no Ouro". */
function listaNo(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", no ")} e no ${nomes[nomes.length - 1]}`;
}

/** O plano libera o recurso? (null nos máximos = sem limite) */
export function planoTemRecurso(p: Pick<PlanoPublico, "vitrine_foto_fachada" | "vitrine_secoes_max" | "vitrine_fixados_max">, r: RecursoVitrine): boolean {
  if (r === "foto") return p.vitrine_foto_fachada;
  if (r === "secoes") return p.vitrine_secoes_max === null || p.vitrine_secoes_max > 0;
  return p.vitrine_fixados_max === null || p.vitrine_fixados_max > 0;
}

/** "Disponível no Slim e no Full" (nomes lidos da tabela de planos). null se nenhum plano à venda tem. */
export function textoDisponivelEm(planos: PlanoPublico[], r: RecursoVitrine): string | null {
  const nomes = planos.filter((p) => !p.e_teste && planoTemRecurso(p, r)).map((p) => nomeCurtoPlano(p.nome));
  return nomes.length ? `Disponível no ${listaNo(nomes)}` : null;
}

/** Cor do banner válida (#RRGGBB) ou a cor da marca. */
export function corSegura(c: string | null | undefined): string {
  return /^#[0-9A-Fa-f]{6}$/.test(String(c ?? "")) ? String(c).toUpperCase() : "#4B1248";
}

/** Texto claro ou escuro por cima da cor do banner (contraste WCAG, mínimo 4,5:1 quando possível). */
export function corDoTextoSobre(fundo: string): "#FFFFFF" | "#4B1248" {
  const hex = corSegura(fundo).slice(1);
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  const contrasteBranco = 1.05 / (lum + 0.05);
  const lumBeringela = 0.2126 * 0.0685 + 0.7152 * 0.0063 + 0.0722 * 0.0648; // #4B1248
  const contrasteEscuro = (Math.max(lum, lumBeringela) + 0.05) / (Math.min(lum, lumBeringela) + 0.05);
  return contrasteBranco >= contrasteEscuro ? "#FFFFFF" : "#4B1248";
}
