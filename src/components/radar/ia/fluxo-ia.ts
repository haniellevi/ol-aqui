// Regras puras das telas da IA no pedido (servem no navegador e nos testes).

const MAX_DETALHES = 1000;

/** A resposta de uma pergunta da IA entra nos detalhes: "Tamanho: 42." */
export function juntarResposta(detalhes: string, rotulo: string, opcao: string): string {
  const frase = `${rotulo.trim()}: ${opcao.trim()}.`;
  const base = detalhes.trimEnd();
  return (base ? `${base} ${frase}` : frase).slice(0, MAX_DETALHES);
}

export type EtapaIA = { tipo: "pergunta"; indice: 0 | 1 } | { tipo: "parecidos" } | null;

/** Depois do passo 1: pergunta 1 → pergunta 2 → parecidos → passo 2. Pula o que veio vazio. */
export function proximaEtapaIA(atual: EtapaIA, perguntas: unknown[], parecidos: unknown[]): EtapaIA {
  if (atual === null && perguntas.length > 0) return { tipo: "pergunta", indice: 0 };
  if (atual?.tipo === "pergunta" && atual.indice === 0 && perguntas.length > 1) return { tipo: "pergunta", indice: 1 };
  if (atual?.tipo !== "parecidos" && parecidos.length > 0) return { tipo: "parecidos" };
  return null;
}

/** Só vale a resposta da IA que chegou para o último "Continuar" (a pessoa pode ter voltado ou avançado). */
export function respostaAindaVale(pedidoDaResposta: number, pedidoAtual: number): boolean {
  return pedidoDaResposta === pedidoAtual;
}
