/** Sugestão de localização, sem alterar permissões ou o endereço da loja. */
export function localDaLoja(loja: { tipo: string; cidade: string | null; bairro: string | null; endereco?: string | null; ajudante?: boolean }, cidades: { nome: string }[]): { cidade: string; bairro: string } | null {
  return loja.tipo === "loja" && !loja.ajudante && loja.endereco?.trim() && loja.cidade && cidades.some(c => c.nome === loja.cidade)
    ? { cidade: loja.cidade, bairro: loja.bairro ?? "" } : null;
}
