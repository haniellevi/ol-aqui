// "Entrar para salvar": antes de mandar para o login, guarda no aparelho qual anúncio salvar.
// O endereço de volta (?salvar=) pode se perder no caminho do login (ex.: Google, ou a pessoa
// entra por outra aba); com esta reserva, o Início salva mesmo assim. Vale por 30 minutos.
const CHAVE = "mr-salvar-pendente";
const VALIDADE_MS = 30 * 60 * 1000;

export function guardarPendente(id: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ id, em: Date.now() }));
  } catch {
    /* armazenamento bloqueado: fica só o endereço de volta */
  }
}

export function lerPendente(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { id?: unknown; em?: unknown } | null;
    if (!v || typeof v.id !== "string" || typeof v.em !== "number" || Date.now() - v.em > VALIDADE_MS) return null;
    return v.id;
  } catch {
    return null;
  }
}

export function limparPendente() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
