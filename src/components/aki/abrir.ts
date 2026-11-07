// Abre a folha do Aki de qualquer tela (evento do navegador). Serve só no navegador.
export const EVENTO_ABRIR_AKI = "aki:abrir";
export const EVENTO_ESTADO_AKI = "aki:estado";

export type PedidoAbrirAki = {
  /** Texto já escrito na caixa (a pessoa confere e toca em Enviar). */
  texto?: string;
  /** Abre o seletor de foto (cadastro pela foto). */
  foto?: boolean;
  /** Rascunho do cadastro em andamento: o Aki guarda nele em vez de criar outro. */
  rascunhoId?: string;
};

export function abrirAki(pedido: PedidoAbrirAki = {}) {
  window.dispatchEvent(new CustomEvent<PedidoAbrirAki>(EVENTO_ABRIR_AKI, { detail: pedido }));
}

/** O balão marca no <html> se o Aki está disponível nesta região (data-aki="ligado"). */
export const akiLigado = () => typeof document !== "undefined" && document.documentElement.dataset.aki === "ligado";
