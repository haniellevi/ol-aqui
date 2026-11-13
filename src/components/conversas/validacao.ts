// Regras de entrada das Conversas que dá para conferir antes de chamar o banco.
// O banco confere tudo de novo (enviar_mensagem, denunciar_conversa).

export const MENSAGEM_MAX = 1000;
export const DETALHES_MAX = 1000;

/** Motivos da fila de denúncias da equipe (mesma lista da tabela denuncias). */
export const MOTIVOS_DENUNCIA = [
  { valor: "golpe", nome: "Golpe ou pedido de pagamento adiantado" },
  { valor: "proibido", nome: "Produto proibido" },
  { valor: "falso", nome: "Produto ou loja falsa" },
  { valor: "ofensivo", nome: "Ofensa ou assédio" },
  { valor: "duplicado", nome: "Mensagens repetidas (spam)" },
  { valor: "outro", nome: "Outro motivo" },
] as const;

export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number]["valor"];

export const ehMotivoDenuncia = (m: unknown): m is MotivoDenuncia =>
  typeof m === "string" && MOTIVOS_DENUNCIA.some((x) => x.valor === m);

export function validarMensagem(texto: unknown): { campo: "texto"; mensagem: string } | null {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (t.length < 1) return { campo: "texto", mensagem: "Escreva uma mensagem." };
  if (t.length > MENSAGEM_MAX) return { campo: "texto", mensagem: "Escreva uma mensagem de até 1.000 letras." };
  return null;
}
