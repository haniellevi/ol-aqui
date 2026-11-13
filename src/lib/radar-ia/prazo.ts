// Espera a IA só até o prazo: demora, erro ou rejeição viram null e o Radar segue sem IA.
// Sem "server-only": serve no servidor (ações) e no navegador (tela do pedido).
export function comPrazo<T>(p: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const relogio = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => { clearTimeout(relogio); resolve(v); },
      () => { clearTimeout(relogio); resolve(null); },
    );
  });
}
