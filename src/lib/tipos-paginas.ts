// Tipos das páginas e textos (migração 20261108030000_paginas_e_textos.sql):
// termos e privacidade com versão, aceites, Central de ajuda e blocos da página inicial.
// Arquivo separado de tipos.ts para não misturar com as outras partes do sistema.

export type TipoDocumento = "termos" | "privacidade";

/** Uma versão publicada dos termos ou da privacidade (tabela documentos_legais). */
export type DocumentoLegal = {
  id: string;
  tipo: TipoDocumento;
  versao: number;
  titulo: string;
  conteudo: string; // markdown simples (títulos, listas, negrito, links)
  resumo_mudancas: string | null;
  revisado_advogado: boolean; // false = RASCUNHO no painel
  ativo: boolean;
  publicado_em: string;
};

/** Versão sem o texto (listas e histórico). */
export type VersaoDocumento = Omit<DocumentoLegal, "conteudo">;

/** Linha de termos_pendentes(): versão no ar que a pessoa ainda não aceitou. */
export type TermoPendente = {
  id: string;
  tipo: TipoDocumento;
  versao: number;
  titulo: string;
  resumo_mudancas: string | null;
  publicado_em: string;
  primeira_vez: boolean; // nunca aceitou nenhuma versão deste tipo (conta nova)
};

/** Textos da faixa "Atualizamos os termos" (configurações termos.aviso_*). */
export type AvisoTermos = { titulo: string; texto: string; pendentes: TermoPendente[] };

export type AjudaCategoria = {
  slug: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativa: boolean;
};

export type AjudaPergunta = {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string; // markdown simples
  ordem: number;
  ativo: boolean;
};

export type AjudaCompleta = { categorias: AjudaCategoria[]; perguntas: AjudaPergunta[] };

/** Contato da equipe na Central de ajuda (configurações contato.* e ajuda.texto_contato). */
export type ContatoEquipe = { whatsapp: string | null; email: string | null; texto: string | null };

/** Preço de um tipo de destaque como vale na região (para a ajuda; nunca escrito no texto). */
export type PrecoDestaqueAjuda = { slug: string; nome: string; descricao: string | null; preco_centavos: number; dias: number | null };

export type ChaveBlocoHome = "destaques" | "lojas_destaque" | "radar" | "lojas_regiao" | "recentes";
export type CampoBlocoHome = "titulo" | "texto" | "botao";

/** Bloco da página inicial (tabela home_blocos). */
export type BlocoHome = {
  chave: ChaveBlocoHome;
  nome: string;
  ordem: number;
  ativo: boolean;
  pode_desligar: boolean;
  /** lugar vendido (destaques): fica sempre acima de "Mais recentes" */
  pago: boolean;
  campos: CampoBlocoHome[];
  titulo: string | null;
  texto: string | null;
  botao: string | null;
};

export const NOME_DOCUMENTO: Record<TipoDocumento, string> = {
  termos: "Termos de uso",
  privacidade: "Política de privacidade",
};
