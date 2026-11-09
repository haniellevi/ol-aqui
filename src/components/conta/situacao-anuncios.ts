import type { StatusAnuncio } from "@/lib/tipos";

export const ABAS_ANUNCIOS = [
  { chave: "todos", nome: "Todos", status: ["ativo", "em_analise", "congelado", "rascunho", "pausado", "expirado", "vendido"] },
  { chave: "ativos", nome: "Ativos", status: ["ativo"] },
  { chave: "rascunhos", nome: "Rascunhos", status: ["rascunho"] },
  { chave: "pausados", nome: "Pausados", status: ["pausado", "expirado"] },
  { chave: "vendidos", nome: "Vendidos", status: ["vendido"] },
  { chave: "analise", nome: "Em análise", status: ["em_analise", "congelado"] },
  { chave: "lixeira", nome: "Lixeira", status: ["excluido"] },
] as const satisfies readonly { chave: string; nome: string; status: readonly StatusAnuncio[] }[];

export function abaDoStatus(status: StatusAnuncio) {
  return ABAS_ANUNCIOS.slice(1).find((a) => (a.status as readonly string[]).includes(status))?.chave ?? "todos";
}

export const ROTULO_ANUNCIO: Record<StatusAnuncio, { texto: string; cor: string }> = {
  ativo: { texto: "No ar", cor: "bg-sucesso-fundo text-verde-escuro" },
  em_analise: { texto: "Em análise", cor: "bg-aviso-fundo text-aviso" },
  congelado: { texto: "Bloqueado", cor: "bg-perigo-fundo text-perigo" },
  rascunho: { texto: "Rascunho", cor: "bg-fundo text-texto-suave" },
  pausado: { texto: "Pausado", cor: "bg-fundo text-texto-suave" },
  expirado: { texto: "Vencido", cor: "bg-fundo text-texto-suave" },
  vendido: { texto: "Vendido", cor: "bg-beringela text-white" },
  excluido: { texto: "Na lixeira", cor: "bg-fundo text-texto-suave" },
};

export const RESULTADOS_ANUNCIO = {
  pausado: "Anúncio pausado. Ele saiu da busca e pode ser reativado quando você quiser.",
  ativo: "Anúncio reativado. Ele está no ar novamente.",
  em_analise: "Seu anúncio está em análise. Aguarde a liberação da equipe.",
  vendido: "Anúncio marcado como vendido. O contato para esta venda foi encerrado.",
  excluido: "Anúncio movido para a lixeira. As fotos foram guardadas e você pode restaurá-lo.",
  restaurado: "Anúncio restaurado. Confira a situação indicada antes de voltar a vender.",
  salvo: "Alterações salvas no anúncio.",
} as const;
