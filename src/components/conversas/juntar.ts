// Junta mensagens da conversa aberta sem repetir nem perder nenhuma.

type ComId = { id: string; criado_em: string };

/** Acrescenta as novas (vindas da busca incremental) que ainda não estão na tela. */
export function juntar<T extends ComId>(atuais: T[], novas: T[]): T[] {
  if (novas.length === 0) return atuais;
  const vistos = new Set(atuais.map((m) => m.id));
  return [...atuais, ...novas.filter((m) => !vistos.has(m.id))];
}

/**
 * A lista completa do servidor vale para o que ela cobre (cartões ao vivo: proposta retirada, anúncio fora do ar);
 * da tela só ficam as mensagens mais novas que a última do servidor (chegaram pela busca depois dele).
 */
export function reconciliar<T extends ComId>(servidor: T[], atuais: T[]): T[] {
  const ultima = servidor.at(-1)?.criado_em ?? "";
  const doServidor = new Set(servidor.map((m) => m.id));
  return [...servidor, ...atuais.filter((m) => !doServidor.has(m.id) && m.criado_em > ultima)];
}
