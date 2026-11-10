// Tela 14 (Equipe e permissões) e tela 8 (Compliance jurídico).
// Quem pode o quê de verdade é o banco (tem_papel, e_admin); aqui só o que o painel mostra.

export const PAPEIS = ["administrador", "moderador", "financeiro", "suporte", "franqueado"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ehPapel = (v: unknown): v is Papel => typeof v === "string" && (PAPEIS as readonly string[]).includes(v);

export const NOME_PAPEL: Record<Papel, string> = {
  administrador: "Administrador",
  moderador: "Moderador",
  financeiro: "Financeiro",
  suporte: "Suporte",
  franqueado: "Franqueado",
};

export const O_QUE_FAZ: Record<Papel, string> = {
  administrador: "Vê e muda tudo, em todas as regiões.",
  moderador: "Só a Moderação: aprova ou recusa anúncios e pedidos, resolve denúncias. Não congela.",
  financeiro: "Só os Pagamentos: vê a lista, os totais e baixa a planilha.",
  suporte: "Só as Lojas: suspende, reativa e confere documentos. Não mexe em plano nem em dinheiro.",
  franqueado: "Só vê as lojas da região dele. Não muda nada nem vê preços de outras regiões.",
};

/** Telas do painel (cada uma tem o seu endereço em /admin). */
export type TelaAdmin =
  | "resumo"
  | "planos"
  | "configuracoes"
  | "anuncios"
  | "moderacao"
  | "lojas"
  | "pagamentos"
  | "destaques"
  | "robo"
  | "textos"
  | "equipe"
  | "compliance"
  | "hoje"
  | "funil"
  | "visitas";

/** Telas de cada papel (fora o administrador, que vê todas). Na dúvida, só o administrador. */
const TELAS_DO_PAPEL: Record<Exclude<Papel, "administrador">, readonly TelaAdmin[]> = {
  moderador: ["moderacao"],
  financeiro: ["pagamentos"],
  suporte: ["lojas"],
  franqueado: ["lojas"],
};

export function podeVerTela(papel: Papel | null, tela: TelaAdmin): boolean {
  if (!papel) return false;
  if (papel === "administrador") return true;
  return TELAS_DO_PAPEL[papel].includes(tela);
}

/** Endereço de cada tela que outros papéis usam. Link que não está aqui = só administrador. */
const TELA_DO_LINK: Record<string, TelaAdmin> = {
  "/admin/moderacao": "moderacao",
  "/admin/lojas": "lojas",
  "/admin/pagamentos": "pagamentos",
};

export function podeVerLink(papel: Papel | null, href: string): boolean {
  if (papel === "administrador") return true;
  const tela = TELA_DO_LINK[href];
  return !!tela && podeVerTela(papel, tela);
}

/** Primeira tela de quem não é administrador (o Resumo é só do administrador). */
export function primeiraTela(papel: Papel): string {
  if (papel === "administrador") return "/admin/hoje";
  const tela = TELAS_DO_PAPEL[papel][0];
  return Object.keys(TELA_DO_LINK).find((href) => TELA_DO_LINK[href] === tela) ?? "/admin";
}

export type MembroEquipe = {
  usuario_id: string;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  papel: Papel;
  microrregiao_id: string | null;
  regiao_nome: string | null;
  ativo: boolean;
  observacao: string | null;
  adicionado_por_nome: string | null;
  desativado_em: string | null;
  /** quem tirou da equipe (nome, ou o código se a conta não existe mais) */
  desativado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type ContaEncontrada = {
  usuario_id: string;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  papel: Papel | null;
  ativo: boolean | null;
};

export type Regiao = { id: string; nome: string };

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

export type TipoResultadoCompliance = "conta" | "conta_apagada" | "anuncio" | "anuncio_apagado";

export type ResultadoCompliance = {
  tipo: TipoResultadoCompliance;
  id: string;
  titulo: string | null;
  detalhe: string | null;
  usuario_id: string | null;
  criado_em: string | null;
};

export type LinhaHistorico = {
  criado_em: string;
  tabela: string;
  acao: "INSERT" | "UPDATE" | "DELETE";
  registro_id: string;
  quem: string | null;
  ip: string | null;
  user_agent: string | null;
  /** campo → [antes, depois] (texto, cortado em 200 letras) */
  campos: Record<string, [string | null, string | null]> | null;
};

export type DadosCompliance = {
  usuario_id: string;
  meses_historico: number;
  desde: string;
  historico_limite: number;
  perfil: Record<string, unknown> | null;
  /** conta apagada: o último cadastro guardado no histórico */
  perfil_apagado: { dados: Record<string, unknown>; apagado_em: string; apagado_por: string | null } | null;
  equipe: { papel: Papel; ativo: boolean } | null;
  aceites: { tipo: string; versao: number; aceito_em: string }[];
  lojas: {
    id: string;
    nome: string;
    slug: string;
    tipo: string;
    cnpj: string | null;
    whatsapp: string | null;
    cidade: string | null;
    status: string;
    plano: string | null;
    criado_em: string;
    criado_ip: string | null;
  }[];
  anuncios: {
    id: string;
    titulo: string;
    status: string;
    preco_centavos: number | null;
    cidade: string | null;
    criado_em: string;
    criado_ip: string | null;
    atualizado_em: string;
    congelado_motivo: string | null;
  }[];
  lojas_apagadas: {
    id: string;
    nome: string | null;
    slug: string | null;
    tipo: string | null;
    cnpj: string | null;
    whatsapp: string | null;
    cidade: string | null;
    criado_em: string | null;
    criado_ip: string | null;
    apagado_em: string;
    apagado_por: string | null;
    ip: string | null;
  }[];
  anuncios_apagados: { id: string; titulo: string | null; apagado_em: string; apagado_por: string | null; ip: string | null }[];
  historico: LinhaHistorico[];
};

export type CabecalhoRelatorio = {
  relatorio_id: string;
  gerado_em: string;
  impresso_em: string;
  gerado_por_id: string;
  gerado_por_nome: string | null;
  motivo: string;
  motivo_consulta: string | null;
  ip_banco: string | null;
  ip_navegador: string | null;
};

export type RelatorioCompliance = { cabecalho: CabecalhoRelatorio; dados: DadosCompliance };

/** Nomes simples das tabelas que aparecem no histórico. */
export const NOME_TABELA: Record<string, string> = {
  perfis: "Cadastro",
  vitrines_lojas: "Loja",
  anuncios: "Anúncio",
  radar_pedidos: "Pedido no Radar",
  radar_propostas: "Proposta no Radar",
  denuncias: "Denúncia",
  pagamentos: "Pagamento",
  aceites: "Aceite dos termos",
  equipe: "Equipe",
  compliance_acessos: "Compliance",
  perfis_verificacoes: "Verificação",
  vitrines_acoes_admin: "Ação do painel na loja",
};

export const NOME_ACAO: Record<LinhaHistorico["acao"], string> = { INSERT: "Criou", UPDATE: "Mudou", DELETE: "Apagou" };
