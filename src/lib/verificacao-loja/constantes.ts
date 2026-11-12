// Valores usados pela tela e pela rota de envio da verificação de loja.

export const API_VERIFICACAO_LOJA = "/api/verificacao-loja";
export const MAX_ARQUIVO_VERIFICACAO_LOJA = 2 * 1024 * 1024;

/** Motivo (como fica em vitrines_lojas.verificacao_motivo) -> texto em palavras simples para o lojista. */
export const MOTIVOS_VERIFICACAO_LOJA: Record<string, string> = {
  arquivo_ilegivel: "Não conseguimos ler o arquivo. Mande uma foto mais clara ou o PDF baixado do site da empresa.",
  comprovante_invalido: "Esse arquivo não parece um comprovante de endereço. Mande uma conta de luz, água ou internet.",
  cnpj_inativo: "O CNPJ não está ativo na Receita. Procure seu contador para regularizar.",
  cnpj_nao_encontrado: "Não achamos esse CNPJ na Receita. Confira o número.",
  dados_mudaram: "Seus dados mudaram durante a conferência. Envie de novo.",
  dados_inconsistentes: "Os dados da loja não batem entre si. Confira nome, endereço e contato e envie de novo.",
  link_invalido: "Um dos links da loja não abre ou não é da sua loja. Corrija e envie de novo.",
  contato_nao_confirmado: "Não conseguimos confirmar o contato da loja. Confira o WhatsApp e envie de novo.",
  titularidade: "Não conseguimos confirmar que a loja é sua. Envie um comprovante em nome da empresa.",
  outro: "Não foi possível verificar. Fale com a equipe pela Ajuda.",
};

/** Texto do motivo; motivo novo e desconhecido cai no texto genérico; vazio devolve null. */
export function textoMotivoVerificacaoLoja(motivo: string | null | undefined): string | null {
  const m = String(motivo ?? "").trim();
  if (!m) return null;
  return Object.hasOwn(MOTIVOS_VERIFICACAO_LOJA, m) ? MOTIVOS_VERIFICACAO_LOJA[m] : MOTIVOS_VERIFICACAO_LOJA.outro;
}
