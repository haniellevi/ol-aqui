const EDICAO_AKI = new Set([
  "robo.ativo", "robo.provedor_conversa", "robo.modelo_conversa", "robo.provedor_foto", "robo.modelo_foto",
  "robo.limite_diario_pessoa", "robo.orcamento_mensal_centavos", "robo.alerta_percentual", "robo.cotacao_dolar",
  "robo.reserva_tokens_entrada", "robo.boas_vindas", "robo.aviso_ia", "robo.sugestoes", "robo.temas_proibidos",
]);
const SEM_EDICAO = new Set(["fotos.tamanho_max_bytes", "moderacao.preco_min_centavos", "moderacao.preco_max_centavos"]);
const GLOBAIS = new Set([
  "asaas.ambiente", "moderacao.ia_ativa", "robo.orcamento_mensal_centavos", "robo.cotacao_dolar",
  "robo.alerta_percentual", "robo.reserva_tokens_entrada", "fotos.origem", "fotos.tamanho_max_bytes",
]);

/** O formulário genérico não concorre com editores especializados nem oferece valores sem efeito. */
export function configGenericaEditavel(chave: string, regional = false): boolean {
  if (SEM_EDICAO.has(chave) || EDICAO_AKI.has(chave) || chave.startsWith("hoje.msg_")) return false;
  if (chave.startsWith("radar.aviso.")) return regional;
  return !regional || permiteExcecaoRegional(chave);
}

export function permiteExcecaoRegional(chave: string): boolean {
  return !GLOBAIS.has(chave) && !/^(hoje|funil|visitas|compliance)\./.test(chave);
}
