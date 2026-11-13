// "Já comprei" (IA do Radar): só mensagem com palavra de compra vai para a IA (decisão do Raniel, 13/11/2026).
// Sem "server-only": a tela usa o filtro para saber quando recarregar e mostrar a pergunta.

const PALAVRAS = /\b(comprei|compramos|achei|achamos|encontrei|encontramos|consegui|conseguimos|resolvi|resolvido|resolvida|peguei|fechei|fechamos|adquiri|ganhei|ja tenho|nao preciso)\b/;

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function temPalavraDeCompra(texto: unknown): boolean {
  return typeof texto === "string" && PALAVRAS.test(normalizar(texto));
}

/** O que vai para a IA: sem link, e-mail nem telefone (8+ dígitos), até 300 letras. */
export function mascararParaIA(texto: string): string {
  return texto
    .replace(/https?:\/\/\S+/gi, "[removido]")
    .replace(/www\.\S+/gi, "[removido]")
    .replace(/[^\s@]+@[^\s@]+/g, "[removido]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, "[removido]") // link sem http nem www (loja.com.br/x)
    .replace(/\(?\+?(?:\d[\s().-]*){7,}\d/g, "[removido]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
