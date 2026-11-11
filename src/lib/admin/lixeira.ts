// Formato devolvido por admin_lixeira() (tela Lixeira e fichas do painel).
export type Lixeira = {
  contas: { id: string; nome: string; origem: string; motivo: string | null; pedida_em: string; apagar_apos: string }[];
  lojas: { id: string; nome: string; slug: string; origem: string; motivo: string | null; excluida_em: string; apagar_apos: string; anuncios: number }[];
  anuncios: { id: string; titulo: string; loja: string; excluido_em: string; apagar_apos: string }[];
};
