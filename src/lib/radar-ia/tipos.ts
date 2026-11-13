// Tipos da IA do Radar que o navegador também usa (sem "server-only").

/** Pergunta da IA para pedido vago: o rótulo vai para os detalhes ("Tamanho: 42."). */
export type PerguntaIA = { rotulo: string; pergunta: string; opcoes: string[] };

/** Anúncio da região parecido com o pedido, com a frase de 1 linha da IA. */
export type ParecidoIA = {
  id: string;
  titulo: string;
  preco_centavos: number | null;
  capa: string | null;
  vitrine_nome: string | null;
  link: string;
  motivo: string;
};

/** Anúncio da vitrine da loja que combina com o pedido. */
export type DestaqueIA = { id: string; motivo: string };
