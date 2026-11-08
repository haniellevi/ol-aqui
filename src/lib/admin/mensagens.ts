import { EXEMPLOS_VARIAVEIS } from "@/lib/tipos-relatorios";

// Tela 13 · Ajudas de texto usadas na prévia ao vivo (navegador) e na ação de salvar (servidor).
// A regra que vale é a do banco (gatilho proteger_modelo_mensagem); aqui é só para avisar antes.

const VARIAVEL = /\{([^{}]*)\}/g;

/** Variáveis {assim} que a mensagem não aceita, e "{ }" quando sobra chave sem par. Mesma regra do banco. */
export function variaveisInvalidas(texto: string | null | undefined, permitidas: readonly string[]): string[] {
  if (!texto) return [];
  const ruins: string[] = [];
  for (const m of texto.matchAll(VARIAVEL)) {
    const nome = `{${m[1]}}`;
    if (!permitidas.includes(m[1]) && !ruins.includes(nome)) ruins.push(nome);
  }
  const resto = texto.replace(VARIAVEL, "");
  if (resto.includes("{") || resto.includes("}")) ruins.push("{ }");
  return ruins;
}

/** Frase de erro igual à do banco, para mostrar na hora. */
export function erroVariaveis(campo: "título" | "texto", ruins: string[], permitidas: readonly string[]): string | null {
  if (ruins.length === 0) return null;
  if (ruins.length === 1 && ruins[0] === "{ }") {
    return `O ${campo} tem uma chave { ou } sem par. Use as variáveis assim: {nome}.`;
  }
  const lista = permitidas.length ? permitidas.map((v) => `{${v}}`).join(", ") : "nenhuma";
  const nomes = ruins.filter((r) => r !== "{ }").join(", ");
  return `O ${campo} usa uma variável que não existe: ${nomes}. Pode usar: ${lista}.`;
}

/** Texto com os valores de exemplo no lugar das variáveis (espaços juntados, como no banco). */
export function previa(texto: string | null | undefined, permitidas: readonly string[]): string {
  let t = texto ?? "";
  for (const v of permitidas) t = t.split(`{${v}}`).join(EXEMPLOS_VARIAVEIS[v]?.exemplo ?? `[${v}]`);
  return t.replace(/\s+/g, " ").trim();
}
