// "Você viu há pouco": guarda no próprio aparelho (localStorage) os últimos anúncios abertos.
// Sem login e sem banco. Se o navegador bloquear o armazenamento, a faixa simplesmente não aparece.
import type { AnuncioCard } from "@/lib/tipos";

export type AnuncioVisto = Pick<
  AnuncioCard,
  "id" | "slug" | "titulo" | "preco_centavos" | "cidade" | "capa" | "criado_em" | "destaque" | "vitrine_nome" | "vitrine_selo" | "vitrine_tipo" | "preco_antes_centavos" | "uf"
>;

const CHAVE = "mr-vistos-v1";
const MAXIMO = 12;

function valido(v: unknown): v is AnuncioVisto {
  const a = v as AnuncioVisto;
  return !!a && typeof a.id === "string" && typeof a.titulo === "string" && typeof a.cidade === "string" &&
    (a.preco_centavos === null || typeof a.preco_centavos === "number") && typeof a.criado_em === "string";
}

export function lerVistos(): AnuncioVisto[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(lista) ? lista.filter(valido).slice(0, MAXIMO) : [];
  } catch {
    return [];
  }
}

export function guardarVisto(a: AnuncioVisto) {
  try {
    const lista = [a, ...lerVistos().filter((x) => x.id !== a.id)].slice(0, MAXIMO);
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* armazenamento bloqueado: segue sem a lista */
  }
}

export function limparVistos() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
