import { centavosDoTexto, ehUuid } from "@/lib/formato";
import type { ModoContato, Visibilidade } from "@/lib/tipos-radar";

export type EntradaPedido = {
  chaveEnvio: string; titulo: string; detalhes?: string; categoriaId?: string | null;
  precoMin?: string; precoMax?: string; cidade?: string; modo: ModoContato;
  /** 0–20 cidades; vazio = região toda. */
  cidadesIds?: string[]; visibilidade: Visibilidade;
  prazoHoras?: number | null; whatsapp?: string;
};
export type EntradaProposta = { pedidoId: string; anuncioId?: string | null; fotoUrl?: string | null; preco?: string; mensagem?: string };
export type ErroRadar = { erro: string; campo?: string };

export function validarPreco(valor: unknown, campo: string): ErroRadar | null {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "string") return { erro: "Digite um preço válido.", campo };
  const centavos = centavosDoTexto(valor);
  return valor.trim() && (centavos === null || centavos > 100_000_000_000)
    ? { erro: "Digite um preço válido, até R$ 1 bilhão.", campo } : null;
}

export function validarPedido(e: EntradaPedido): ErroRadar | null {
  if (!e || typeof e !== "object" || !ehUuid(e.chaveEnvio)) return { erro: "Atualize a página e tente novamente." };
  if (typeof e.titulo !== "string" || e.titulo.trim().length < 8 || e.titulo.trim().length > 120) return { erro: "Descreva o que procura usando de 8 a 120 caracteres.", campo: "titulo" };
  if (e.detalhes != null && (typeof e.detalhes !== "string" || e.detalhes.length > 1000)) return { erro: "Use até 1.000 caracteres nos detalhes.", campo: "detalhes" };
  if (e.cidade != null && (typeof e.cidade !== "string" || e.cidade.length > 80)) return { erro: "Escolha a cidade.", campo: "cidade" };
  if (e.cidadesIds != null && (!Array.isArray(e.cidadesIds) || e.cidadesIds.length > 20 || !e.cidadesIds.every(ehUuid))) return { erro: "Escolha até 20 cidades da lista.", campo: "cidades" };
  if (e.visibilidade !== "lojas" && e.visibilidade !== "todos") return { erro: "Escolha quem pode ver o pedido.", campo: "visibilidade" };
  if (!["whatsapp_direto", "propostas_prazo"].includes(e.modo)) return { erro: "Escolha como quer receber as propostas." };
  if (e.categoriaId != null && !ehUuid(e.categoriaId)) return { erro: "Escolha uma categoria válida.", campo: "categoria" };
  if (e.modo === "propostas_prazo" && (!Number.isInteger(e.prazoHoras) || (e.prazoHoras ?? 0) <= 0)) return { erro: "Escolha o prazo das propostas.", campo: "prazo" };
  const erro = validarPreco(e.precoMin, "preco_min_centavos") ?? validarPreco(e.precoMax, "preco_max_centavos");
  if (erro) return erro;
  const min = centavosDoTexto(e.precoMin), max = centavosDoTexto(e.precoMax);
  if (min !== null && max !== null && min > max) return { erro: "O valor até deve ser igual ou maior que o valor de.", campo: "preco_max_centavos" };
  if (e.whatsapp != null && (typeof e.whatsapp !== "string" || e.whatsapp.length > 20)) return { erro: "Confira seu WhatsApp com DDD.", campo: "whatsapp" };
  return null;
}

export function validarProposta(e: EntradaProposta): ErroRadar | null {
  if (!e || typeof e !== "object" || !ehUuid(e.pedidoId)) return { erro: "Pedido não encontrado." };
  if (e.anuncioId != null && !ehUuid(e.anuncioId)) return { erro: "Escolha um anúncio válido.", campo: "foto" };
  if (e.fotoUrl != null && (typeof e.fotoUrl !== "string" || e.fotoUrl.length > 500)) return { erro: "Escolha uma foto válida.", campo: "foto" };
  if (e.anuncioId && e.fotoUrl) return { erro: "Escolha um anúncio ou uma foto para a proposta.", campo: "foto" };
  if (e.mensagem != null && (typeof e.mensagem !== "string" || e.mensagem.length > 500)) return { erro: "Use até 500 caracteres na mensagem.", campo: "mensagem" };
  return validarPreco(e.preco, "preco");
}
