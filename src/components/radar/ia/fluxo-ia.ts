// Regras puras das telas da IA no pedido (servem no navegador e nos testes).

const MAX_DETALHES = 1000;

/** A resposta de uma pergunta da IA entra nos detalhes: "Tamanho: 42." */
export function juntarResposta(detalhes: string, rotulo: string, opcao: string): string {
  const frase = `${rotulo.trim()}: ${opcao.trim()}.`;
  const base = detalhes.trimEnd();
  return (base ? `${base} ${frase}` : frase).slice(0, MAX_DETALHES);
}
