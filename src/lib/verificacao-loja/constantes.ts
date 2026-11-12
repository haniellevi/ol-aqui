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

/** Por que o pedido foi para a equipe (como fica em verificacoes_loja.motivos_equipe) -> texto para a equipe. */
export const MOTIVOS_EQUIPE_VERIFICACAO_LOJA: Record<string, string> = {
  ia_duvida: "A IA ficou em dúvida",
  ia_falhou: "A IA não conseguiu analisar",
  ia_desligada: "Conferência automática desligada",
  ia_sem_orcamento: "Sem orçamento da IA",
  nome_diferente: "Nome diferente do cadastro",
  endereco_diferente: "Endereço diferente do cadastro",
  cnpj_duplicado: "CNPJ já está em outra loja",
  cidade_fora_da_regiao: "Cidade fora da região",
  receita_fora_do_ar: "Receita fora do ar",
  fachada_estranha: "Fachada estranha",
  terceira_recusa: "Terceira recusa em 24 horas",
};

/** Item do parecer (verificacoes_loja.parecer[].item) -> o que foi conferido, em palavras da equipe. */
export const ITENS_PARECER_VERIFICACAO_LOJA: Record<string, string> = {
  receita: "Consulta na Receita",
  situacao_cnpj: "CNPJ ativo",
  comprovante: "Comprovante legível",
  leitura: "Leitura do documento",
  titular: "Nome do titular",
  endereco: "Endereço",
  cnpj_unico: "CNPJ só nesta loja",
  regiao: "Cidade na região",
  fachada: "Fachada",
  revisao_humana: "Revisão da equipe",
  analise: "Análise automática",
};

/** Texto do motivo para a equipe; código novo e desconhecido cai numa frase neutra. */
export function textoMotivoEquipeVerificacaoLoja(motivo: string): string {
  return Object.hasOwn(MOTIVOS_EQUIPE_VERIFICACAO_LOJA, motivo) ? MOTIVOS_EQUIPE_VERIFICACAO_LOJA[motivo] : "Conferir o pedido";
}

/** Nome do item do parecer; item novo e desconhecido cai numa frase neutra. */
export function textoItemParecerVerificacaoLoja(item: string): string {
  return Object.hasOwn(ITENS_PARECER_VERIFICACAO_LOJA, item) ? ITENS_PARECER_VERIFICACAO_LOJA[item] : "Outra conferência";
}
