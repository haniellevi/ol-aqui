// Tipos do painel: Regiões e cidades (tela 7) e Categorias e campos (tela 9).
// Espelham as funções admin_regioes(), admin_cidades() e admin_categorias() do banco
// (migração 20261108040000_regioes_categorias.sql).
import type { CampoCategoria, TipoCampo } from "@/lib/tipos";

/** Linha de admin_regioes(): região com sede e contagens. */
export type RegiaoAdmin = {
  id: string;
  slug: string;
  nome: string;
  cidade_sede: string | null;
  ativa: boolean;
  /** Repasse do franqueado: fica vazio até o modelo de franquia ser decidido ("a definir"). */
  repasse_percentual: number | null;
  cidades_total: number;
  cidades_ativas: number;
  lojas: number;
  vendedores_pf: number;
  anuncios_ativos: number;
  anuncios_total: number;
  pessoas: number;
};

/** Linha de admin_cidades(regiao): cidade com o uso (o que impede remover ou renomear). */
export type CidadeAdmin = {
  id: string;
  nome: string;
  uf: string;
  ativa: boolean;
  e_sede: boolean;
  anuncios: number;
  lojas: number;
  pessoas: number;
  pedidos: number;
};

/** Linha de admin_categorias(): todas as categorias (inclusive escondidas) com o uso. */
export type CategoriaAdmin = {
  id: string;
  slug: string;
  nome: string;
  icone: string | null;
  pai_id: string | null;
  ordem: number;
  ativa: boolean;
  campos: CampoCategoria[];
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  tipo_legado: string;
  anuncios_ativos: number;
  anuncios_total: number;
  pedidos_radar: number;
  filhas: number;
};

/** Um grupo de sugestões de categoria pendentes (mesmo texto normalizado): linha de admin_categorias_sugeridas(). */
export type GrupoSugestao = {
  texto_norm: string;
  texto: string;
  quantidade: number;
  anuncios: number;
  proximas: { id: string; caminho: string; vezes: number }[];
  primeira: string;
  ultima: string;
  /** Textos normalizados de outros grupos pendentes parecidos (erro de digitação). */
  parecidas: string[];
};

/** Categoria em árvore (até 3 níveis): nivel 1 = grande, 2 = sub, 3 = tipo. Filhas na ordem do painel. */
export type CategoriaAdminArvore = CategoriaAdmin & { nivel: number; subcategorias: CategoriaAdminArvore[] };

/**
 * Campo como o editor do painel manda para o servidor (JSON). `chave` vazia = campo novo
 * (o servidor cria a chave a partir do nome). Números chegam como texto digitado.
 */
export type CampoEditado = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  filtro: boolean;
  opcoes: string;
  unidade: string;
  min: string;
  max: string;
};

/** Resultado da conferência dos campos: lista pronta para gravar ou a mensagem do problema. */
export type CamposConferidos = { ok: true; campos: CampoCategoria[] } | { ok: false; erro: string };
