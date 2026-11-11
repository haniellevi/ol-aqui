export type SugestaoLoja = { categoria: string; descricao: string };
export type RespostaCadastroAki = { sugestao: SugestaoLoja } | { pergunta: string };
export type ImagemAki = { id: string; url: string; restantes: number };
export type PedidoLojistaAki =
  | { tipo: "cadastro"; nome: string; contexto: string }
  | { tipo: "banner"; id: string; estilo: string; cor: string }
  | { tipo: "produto"; id: string; anuncio: string; foto: string };

export class ErroLojistaAki extends Error {
  constructor(mensagem: string, readonly repetirPedido: boolean) {
    super(mensagem);
  }
}

export async function pedirAoAki<T>(pedido: PedidoLojistaAki): Promise<T> {
  const resposta = await fetch("/api/aki/lojista", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new ErroLojistaAki(dados.erro ?? "O Merc não conseguiu concluir o pedido.", dados.repetir === true);
  return dados as T;
}

export const MODELOS_LOJISTA = {
  "robo.lojista_modelo_texto": [
    { valor: "gpt-6-luna", nome: "GPT-6 Luna" },
    { valor: "gpt-6-sol", nome: "GPT-6 Sol" },
  ],
  "robo.lojista_modelo_imagem": [
    { valor: "gpt-image-2", nome: "GPT Image 2" },
    { valor: "gpt-image-1.5", nome: "GPT Image 1.5" },
  ],
};
