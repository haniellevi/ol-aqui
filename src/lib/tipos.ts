// Tipos que espelham o banco (migração 20261107020000_categorias_e_anuncios.sql).
// Valores em dinheiro sempre em centavos. Datas sempre em texto ISO (como o Supabase devolve).

/* ---------------------------- Categorias ---------------------------- */

export type TipoCampo = "texto" | "numero" | "lista" | "sim_nao";
export type TipoLegado = "imovel" | "veiculo" | "movel" | "geral";

/** Um campo extra da subcategoria (ex.: "Ano", "Câmbio"). O banco já normaliza o formato. */
export type CampoCategoria = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  filtro: boolean;
  opcoes?: string[]; // só em "lista"
  min?: number; // só em "numero"
  max?: number; // só em "numero"
  unidade?: string; // km, horas, cv, ha, m², kg, meses, cabeças, sacas
};

export type Categoria = {
  id: string;
  slug: string;
  nome: string;
  icone: string; // nome do ícone lucide (ex.: "car", "building-2")
  pai_id: string | null; // null = categoria pai
  ordem: number;
  ativa: boolean;
  campos: CampoCategoria[]; // pai sempre []
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  tipo_legado: TipoLegado;
};

/**
 * Categoria com as filhas dentro, em qualquer nível (Grande › Sub › Tipo, até 3 níveis).
 * Já vem ordenada. Filhas vazias = folha: só a folha recebe anúncio.
 */
export type CategoriaComFilhas = Categoria & { filhas: CategoriaComFilhas[] };

/** Valores dos campos extras do anúncio. */
export type Atributos = Record<string, string | number | boolean>;

/* ----------------------------- Anúncios ----------------------------- */

export type StatusAnuncio = "rascunho" | "ativo" | "pausado" | "vendido" | "expirado" | "em_analise" | "congelado" | "excluido";
export type TipoVitrine = "pf" | "loja";

/** Linha de buscar_anuncios(): o que o card precisa. */
export type AnuncioCard = {
  vendedor_pago?: boolean;
  vendedor_pf_verificado?: boolean;
  id: string;
  slug: string | null; // endereço curto do anúncio (null = ainda em rascunho ou anúncio antigo sem endereço)
  titulo: string;
  preco_centavos: number | null; // null = "a combinar"
  aceita_troca: boolean;
  cidade: string;
  bairro: string | null;
  capa: string | null; // primeira foto
  atributos: Atributos;
  criado_em: string; // quando foi publicado
  categoria_slug: string | null;
  categoria_nome: string | null;
  vitrine_nome: string;
  vitrine_slug: string;
  vitrine_selo: boolean; // loja verificada
  vitrine_tipo: TipoVitrine;
  destaque: boolean; // pago: mostrar "Patrocinado"
  total: number; // total de resultados da busca (igual em todas as linhas)
};

export type OrdemBusca = "relevancia" | "recentes" | "menor_preco" | "maior_preco";

/** Filtros pelos campos da categoria: faixa (número), valor, lista de valores ou sim/não. */
export type FiltroValor = string | number | boolean | string[] | { min?: number; max?: number };
export type FiltrosBusca = Record<string, FiltroValor>;

export type ParametrosBusca = {
  q?: string | null;
  categoria?: string | null; // slug (pai inclui as filhas)
  cidade?: string | null;
  precoMin?: number | null; // centavos
  precoMax?: number | null; // centavos
  filtros?: FiltrosBusca | null;
  ordem?: OrdemBusca | null;
  regiao?: string | null; // slug da microrregião
  facetas?: boolean;
  limite?: number; // 1 a 48 (padrão 24)
  deslocamento?: number;
};

export type FacetaBusca = { opcoes?: Record<string, number>; min?: number; max?: number };
export type FacetasBusca = Partial<Record<string, FacetaBusca>>;
export type ResultadoBusca = { anuncios: AnuncioCard[]; total: number; facetas?: FacetasBusca | null };

/** Linha de anuncio_publico(): página do anúncio e prévia "Revisar". */
export type AnuncioPublico = {
  id: string;
  slug: string | null;
  titulo: string | null; // rascunho pode estar sem título
  descricao: string | null;
  preco_centavos: number | null;
  aceita_troca: boolean;
  cidade: string | null;
  bairro: string | null;
  fotos: string[];
  atributos: Atributos;
  status: StatusAnuncio;
  criado_em: string;
  vendido_em: string | null;
  destaque: boolean;
  visualizacoes: number;
  total_favoritos: number;
  microrregiao_id: string;
  categoria_id: string | null;
  categoria_slug: string | null;
  categoria_nome: string | null;
  categoria_icone: string | null;
  categoria_pai_slug: string | null;
  categoria_pai_nome: string | null;
  campos: CampoCategoria[]; // rótulos e unidades para a lista de detalhes
  vitrine_id: string;
  vitrine_slug: string;
  vitrine_nome: string;
  vitrine_tipo: TipoVitrine; // "loja" tem página /loja/<slug>; "pf" não tem
  vitrine_logo_url: string | null;
  vitrine_selo: boolean;
  vitrine_desde: string;
  vendedor_certificado: boolean;
  whatsapp: string | null; // null = esconder o botão
  e_dono: boolean;
};

/** Anúncio do próprio dono (lido direto da tabela, com RLS). */
export type MeuAnuncio = {
  id: string;
  slug: string | null;
  vitrine_id: string;
  categoria_id: string | null;
  titulo: string | null;
  descricao: string | null;
  preco_centavos: number | null;
  aceita_troca: boolean;
  cidade: string | null;
  bairro: string | null;
  fotos: string[];
  atributos: Atributos;
  status: StatusAnuncio;
  visualizacoes: number;
  cliques_whatsapp: number;
  total_favoritos: number;
  destaque_ate: string | null;
  pago_ate: string | null;
  motivo_analise: string | null;
  excluido_em: string | null;
  status_antes_exclusao: StatusAnuncio | null;
  publicado_em: string | null;
  vendido_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type FaixaPreco = { minimo: number | null; maximo: number | null; quantidade: number };

export type TipoEvento = "visualizacao" | "clique_whatsapp" | "compartilhar";

/* --------------------------- Vitrine e conta -------------------------- */

/** Dados públicos da vitrine (nunca CNPJ). */
export type Vitrine = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  logo_url: string | null;
  capa_url: string | null;
  whatsapp: string | null;
  cidade: string;
  bairro: string | null;
  tipo: TipoVitrine;
  selo_loja_verificada: boolean;
  microrregiao_id: string;
  status: "ativa" | "inadimplente" | "suspensa";
  criado_em: string;
};

/** Vitrine vista pelo dono: inclui plano e prazos. */
export type MinhaVitrine = Vitrine & {
  dono_id: string;
  plano: string; // código do plano contratado (tabela planos)
  teste_expira_em: string;
  plano_expira_em: string | null;
};

export type Plano = {
  codigo: string;
  nome: string;
  descricao: string | null;
  publico: "pf" | "pj" | "todos";
  preco_centavos: number;
  periodo_dias: number;
  limite_anuncios: number | null; // null = ilimitado
  acesso_radar: boolean;
  propostas_radar_mes: number | null;
  e_teste: boolean;
  ordem: number;
};

export type MeuPerfil = {
  id: string;
  microrregiao_id: string;
  nome: string;
  tipo_pessoa: "pf" | "pj";
  whatsapp: string | null;
  whatsapp_verificado_em: string | null;
  cidade: string | null;
  bairro: string | null;
  avatar_url: string | null;
  selo_negociador_certificado: boolean;
  e_admin: boolean;
  aceitou_termos_em: string | null;
};

/** Tudo que as telas da conta precisam saber sobre quem está logado. */
export type MinhaConta = {
  perfil: MeuPerfil;
  vitrine: MinhaVitrine | null; // null = ainda não escolheu "Quero vender"
  plano: Plano | null; // plano que vale agora (null = sem plano / vencido)
  limite: number | null; // anúncios ativos permitidos (null = ilimitado; 0 = bloqueado)
  ativos: number; // anúncios ativos que contam no limite
  rascunhos: number;
  podePublicar: boolean; // limite null ou ativos < limite
  ajudante?: boolean; // P5b: true quando a loja é de outra pessoa (a pessoa ajuda)
};

/** Retorno de quero_vender(). */
export type ResultadoQueroVender = {
  vitrine_id: string;
  tipo: TipoVitrine;
  slug: string;
  nome: string;
  plano: string;
  teste_expira_em: string | null;
  plano_expira_em: string | null;
};

/* ------------------------------ Região ------------------------------ */

export type Cidade = { id: string; nome: string; uf: string; microrregiao_id: string };

export type Regiao = {
  id: string;
  slug: string;
  nome: string;
  cidadeSede: string | null;
  /** Cidade escolhida pelo visitante (cookie), ou null = região toda. */
  cidade: string | null;
};

/* ------------------------------ Erros ------------------------------- */

/** Erro pronto para a tela: mensagem em português e, se houver, o campo a destacar. */
export type ErroTela = { mensagem: string; campo?: string; codigo?: string };

/** Resultado padrão de Server Action. */
export type Resultado<T = undefined> = { ok: true; dados: T } | { ok: false; erro: ErroTela };
