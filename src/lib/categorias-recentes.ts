// "Usadas há pouco": guarda no próprio aparelho (localStorage) as últimas categorias escolhidas
// ou abertas. Sem login e sem banco. Se o navegador bloquear o armazenamento, a faixa não aparece.

const CHAVE = "mr-categorias-recentes-v1";
const MAXIMO = 4;

/** Ids das categorias mais recentes, da última para a primeira. */
export function lerRecentes(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string").slice(0, MAXIMO) : [];
  } catch {
    return [];
  }
}

export function guardarRecente(id: string) {
  try {
    const lista = [id, ...lerRecentes().filter((x) => x !== id)].slice(0, MAXIMO);
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* armazenamento bloqueado: segue sem a lista */
  }
}
