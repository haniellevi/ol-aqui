import type { MinhaConta } from "@/lib/tipos";

// Resumo do plano para o topo de "Minha conta" e para "Meu plano".
// Números sempre vindos do banco (planos, vitrine, contagem de anúncios): nada fixo aqui.

export type ResumoPlano = {
  nome: string | null; // null = sem plano valendo
  /** Data em que o plano/teste termina (null = não vence, ex.: plano grátis). */
  venceEm: string | null;
  diasRestantes: number | null;
  /** O plano contratado venceu e a pessoa caiu em outro (ou em nenhum). */
  venceu: boolean;
  /** "7 de 10 anúncios" / "3 anúncios no ar (sem limite)". */
  uso: string;
  /** Linha pronta: "Teste grátis · faltam 12 dias · 7 de 10 anúncios". */
  linha: string;
};

const DIA = 86_400_000;

export function resumoPlano(conta: MinhaConta, agora: number = Date.now()): ResumoPlano | null {
  const v = conta.vitrine;
  if (!v) return null;
  const plano = conta.plano;
  const contratadoVale = !!plano && plano.codigo === v.plano;
  let venceEm: string | null = null;
  if (plano && contratadoVale) {
    if (plano.e_teste) venceEm = v.teste_expira_em;
    else if (plano.preco_centavos > 0) venceEm = v.plano_expira_em;
  }
  const diasRestantes = venceEm ? Math.max(0, Math.ceil((new Date(venceEm).getTime() - agora) / DIA)) : null;
  const uso =
    conta.limite === null
      ? `${conta.ativos} ${conta.ativos === 1 ? "anúncio" : "anúncios"} no ar (sem limite)`
      : `${conta.ativos} de ${conta.limite} anúncios`;
  const prazo =
    diasRestantes === null ? null : diasRestantes === 0 ? "termina hoje" : diasRestantes === 1 ? "falta 1 dia" : `faltam ${diasRestantes} dias`;
  const nome = plano?.nome ?? null;
  const linha = [nome ? `Plano ${nome.replace(/^Plano\s+/i, "")}` : "Sem plano ativo", prazo, uso].filter(Boolean).join(" · ");
  return { nome, venceEm, diasRestantes, venceu: !contratadoVale, uso, linha };
}

const dataLonga = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Fortaleza" });

/** "12 de dezembro de 2026". */
export function dataPorExtenso(iso: string | null | undefined): string {
  if (!iso) return "";
  // Vencimentos DATE são dias civis, não meia-noite UTC (que vira o dia anterior no Brasil).
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(data.getTime()) ? "Data indisponível" : dataLonga.format(data);
}
