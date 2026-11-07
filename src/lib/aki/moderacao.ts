// Moderação do texto do Aki: a mesma lista de palavras bloqueadas dos anúncios
// (configuracoes "moderacao.palavras_bloqueadas"), comparada do mesmo jeito que o banco
// (sem acento, minúsculas, palavra inteira). Serve no servidor; não guarda estado global.

export function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Monta o verificador a partir da lista do painel. Lista vazia = nada bloqueado. */
export function criarModerador(palavras: unknown) {
  const lista = Array.isArray(palavras)
    ? palavras.filter((p): p is string => typeof p === "string" && p.trim().length > 1).map((p) => semAcento(p.trim()))
    : [];
  const regras = lista.map((p) => new RegExp(`(^|[^a-z0-9])${escapar(p).replace(/\s+/g, "\\s+")}([^a-z0-9]|$)`));
  return {
    /** Primeira palavra bloqueada encontrada (ou null). */
    achar(texto: string): string | null {
      if (!regras.length) return null;
      const t = semAcento(texto);
      const i = regras.findIndex((r) => r.test(t));
      return i >= 0 ? lista[i] : null;
    },
    palavras: lista,
  };
}

export type Moderador = ReturnType<typeof criarModerador>;

/**
 * Libera o texto aos pedaços sem deixar escapar palavra bloqueada: segura a última palavra
 * (pode estar pela metade) e confere o texto inteiro a cada pedaço. Se achar palavra proibida,
 * para de liberar e avisa (quem chama troca a resposta inteira por um aviso).
 */
export function criarFiltroStream(moderador: Moderador, emitir: (pedaco: string) => void) {
  let tudo = "";
  let liberado = 0;
  let bloqueado = false;
  return {
    get bloqueado() {
      return bloqueado;
    },
    get texto() {
      return tudo;
    },
    adicionar(pedaco: string) {
      if (bloqueado) return;
      tudo += pedaco;
      if (moderador.achar(tudo)) {
        bloqueado = true;
        return;
      }
      // libera até o último espaço/quebra (a palavra seguinte pode completar uma expressão)
      const corte = Math.max(tudo.lastIndexOf(" "), tudo.lastIndexOf("\n"));
      if (corte + 1 > liberado) {
        emitir(tudo.slice(liberado, corte + 1));
        liberado = corte + 1;
      }
    },
    /** Fim da resposta: libera o resto (se não houve bloqueio). */
    terminar() {
      if (bloqueado) return;
      if (moderador.achar(tudo)) {
        bloqueado = true;
        return;
      }
      if (tudo.length > liberado) emitir(tudo.slice(liberado));
      liberado = tudo.length;
    },
  };
}
