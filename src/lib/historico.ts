// Histórico de alterações (Etapa P5a): frases que o dono lê, por exemplo
// "Editado por Ana (Equipe Mercado da Região) em 12/11 às 14:30". Sem acesso ao banco: serve à tela e aos testes.

export type PapelHistorico = "dono" | "ajudante" | "equipe" | "sistema";
export type AcaoHistorico = "criou" | "editou" | "status" | "lixeira" | "restaurou";

export type LinhaHistorico = {
  quando: string;
  acao: AcaoHistorico;
  de: string | null;
  para: string | null;
  motivo: string | null;
  papel: PapelHistorico;
  nome: string | null;
  e_voce: boolean;
};

export const MARCA_EQUIPE = "Equipe Mercado da Região";

/** Quem fez: "você", "Ana (Equipe Mercado da Região)", "João (ajudante da loja)", "o sistema". */
export function quemFez(l: Pick<LinhaHistorico, "papel" | "nome" | "e_voce">): string {
  if (l.e_voce) return "você";
  const nome = l.nome?.trim();
  switch (l.papel) {
    case "equipe": return nome ? `${nome} (${MARCA_EQUIPE})` : `a ${MARCA_EQUIPE}`;
    case "ajudante": return nome ? `${nome} (ajudante da loja)` : "um ajudante da loja";
    case "dono": return nome || "o dono";
    default: return "o sistema";
  }
}

const SITUACAO: Record<string, string> = {
  ativo: "Colocado no ar",
  pausado: "Pausado",
  vendido: "Marcado como vendido",
  em_analise: "Enviado para revisão",
  expirado: "Expirou",
  congelado: "Retido pela equipe",
  rascunho: "Voltou para rascunho",
  suspensa: "Loja fora do ar",
  ativa: "Loja no ar",
};

/** O que aconteceu, sem quem: "Editado", "Pausado", "Enviado para a lixeira". */
export function oQueAconteceu(l: Pick<LinhaHistorico, "acao" | "de" | "para">): string {
  switch (l.acao) {
    case "criou": return "Publicado";
    case "editou": return "Editado";
    case "lixeira": return "Enviado para a lixeira";
    case "restaurou": return "Restaurado da lixeira";
    default:
      if (l.de === "rascunho" && (l.para === "ativo" || l.para === "em_analise")) return "Publicado";
      return (l.para && SITUACAO[l.para]) || "Situação alterada";
  }
}

const FUSO = "America/Fortaleza";

/** "12/11 às 14:30" (ano só quando não é o atual). */
export function dataHistorico(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mesmoAno = d.toLocaleDateString("pt-BR", { timeZone: FUSO, year: "numeric" }) === agora.toLocaleDateString("pt-BR", { timeZone: FUSO, year: "numeric" });
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", ...(mesmoAno ? {} : { year: "numeric" }) });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

/** Frase completa: "Editado por Ana (Equipe Mercado da Região) em 12/11 às 14:30". "Expirou" não diz "por o sistema". */
export function fraseHistorico(l: LinhaHistorico, agora = new Date()): string {
  const oque = oQueAconteceu(l);
  const data = dataHistorico(l.quando, agora);
  const quem = l.papel === "sistema" && !l.e_voce ? "" : ` por ${quemFez(l)}`;
  return `${oque}${quem}${data ? ` em ${data}` : ""}`;
}
