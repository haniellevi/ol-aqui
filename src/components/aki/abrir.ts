// Abre a folha do Merc de qualquer tela (evento do navegador). Serve só no navegador.
export const EVENTO_ABRIR_AKI = "aki:abrir";
export const EVENTO_ESTADO_AKI = "aki:estado";

export type PedidoAbrirAki = {
  /** Texto já escrito na caixa (a pessoa confere e toca em Enviar). */
  texto?: string;
  /** Abre o seletor de foto (cadastro pela foto). */
  foto?: boolean;
  /** Rascunho do cadastro em andamento: o Merc guarda nele em vez de criar outro. */
  rascunhoId?: string;
};

export function abrirAki(pedido: PedidoAbrirAki = {}) {
  window.dispatchEvent(new CustomEvent<PedidoAbrirAki>(EVENTO_ABRIR_AKI, { detail: pedido }));
}

/** O balão marca no <html> se o Merc está disponível nesta região (data-aki="ligado"). */
export const akiLigado = () => typeof document !== "undefined" && document.documentElement.dataset.aki === "ligado";

/* ------------------- Foto que o Merc guardou no rascunho ------------------- */

/** A folha do Merc guardou uma foto no rascunho: o passo Fotos (se estiver aberto) mostra na hora. */
export const EVENTO_FOTO_AKI = "aki:foto";
export type FotoGuardadaAki = { anuncioId: string; url: string };

/* ------------------------- Dica perto do balão ------------------------- */

/** Convite leve ao lado do balão (ex.: busca sem resultado), sem abrir a folha. */
export const EVENTO_DICA_AKI = "aki:dica";
export type DicaAki = { texto: string; pedido?: PedidoAbrirAki };

// guardada aqui porque a tela pode pedir a dica antes de o balão começar a ouvir
let dicaPendente: DicaAki | null = null;
export const lerDicaPendente = () => dicaPendente;

export function mostrarDicaAki(dica: DicaAki | null) {
  dicaPendente = dica;
  window.dispatchEvent(new CustomEvent<DicaAki | null>(EVENTO_DICA_AKI, { detail: dica }));
}
