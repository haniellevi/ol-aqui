// Funil de vendas de lojistas (CRM simples): tipos e regras usadas pelas telas e pelas ações.

export type EtapaFunil = { codigo: string; nome: string; tipo: "aberta" | "ganho" | "perdido"; ordem: number; ativa: boolean };

export type LojistaFunil = {
  id: string;
  microrregiao_id: string;
  cidade_id: string | null;
  nome_loja: string;
  contato_nome: string | null;
  whatsapp: string | null;
  categoria_id: string | null;
  origem: string | null;
  etapa: string;
  etapa_desde: string;
  vitrine_id: string | null;
  responsavel_id: string | null;
  proximo_passo: string | null;
  proximo_em: string | null;
  motivo_perda: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type NotaFunil = { id: string; texto: string; automatica: boolean; autor_id: string | null; criado_em: string; perfis: { nome: string } | null };

export type Opcao = { valor: string; nome: string; detalhe?: string };

/** Opções dos selects do formulário (tudo do banco). */
export type OpcoesFunil = {
  etapas: EtapaFunil[];
  regioes: Opcao[];
  cidades: (Opcao & { regiao: string })[];
  origens: Opcao[];
  categorias: Opcao[];
  responsaveis: Opcao[];
};

/** "(89) 99999-0000" → "5589999990000". Vazio → null. Inválido → undefined. */
export function whatsappParaBanco(bruto: FormDataEntryValue | null): string | null | undefined {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (!d) return null;
  const com55 = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^55[1-9][0-9]9?[0-9]{8}$/.test(com55) ? com55 : undefined;
}

export const TOM_ETAPA: Record<EtapaFunil["tipo"], "secondary" | "success" | "destructive"> = {
  aberta: "secondary",
  ganho: "success",
  perdido: "destructive",
};

/** Dias desde uma data (para "há 3 dias nesta etapa"). */
export function diasDesde(iso: string, agora = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - Date.parse(iso)) / 86_400_000));
}
