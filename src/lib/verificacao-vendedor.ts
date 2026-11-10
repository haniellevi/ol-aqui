export const MAX_ARQUIVO_VERIFICACAO = 2 * 1024 * 1024;
export const API_VERIFICACAO_VENDEDOR = "/api/verificacao-vendedor";
export const LINK_VERIFICACAO_VENDEDOR = "/minha-conta/verificacao";

export const MOTIVOS_VERIFICACAO_PF = {
  arquivo_ilegivel: "Um dos arquivos está ilegível",
  documento_invalido: "O documento de identificação precisa ser corrigido",
  endereco_nao_comprovado: "O comprovante de endereço precisa ser corrigido",
  dados_divergentes: "Os dados do perfil e dos documentos precisam ser conferidos",
  reenviar: "É necessário enviar novos arquivos",
} as const;
