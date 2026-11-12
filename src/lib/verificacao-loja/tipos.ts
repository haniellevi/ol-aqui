// Tipos da verificação automática de lojas. A IA só EXTRAI dados (Leitura*); quem decide são as regras em decidir.ts.
// Nenhum tipo voltado à IA tem campo "decisão": texto de documento nunca manda no resultado.
export type Receita = {
  situacao: string; razaoSocial: string; fantasia: string | null; socios: string[];
  municipioIbge: number | null; cidade: string; uf: string; logradouro: string | null; abertura: string | null;
};
export type ReceitaResultado = { estado: "ok"; dados: Receita } | { estado: "fora_do_ar" } | { estado: "nao_encontrada" };
export type LeituraComprovante = {
  legivel: boolean; tipoDocumento: "conta_servico" | "outro" | "nao_e_comprovante";
  titular: string | null; logradouro: string | null; cidade: string | null; cep: string | null; confianca: number;
};
export type LeituraFachada = { legivel: boolean; fachadaReal: boolean; nomeVisivel: string | null };
export type Cadastro = { nome: string; cidade: string; endereco: string | null };
export type MotivoLoja = "arquivo_ilegivel" | "comprovante_invalido" | "cnpj_inativo" | "cnpj_nao_encontrado" | "dados_mudaram";
export type MotivoEquipe = "ia_duvida" | "ia_falhou" | "ia_desligada" | "ia_sem_orcamento" | "nome_diferente" | "endereco_diferente"
  | "cnpj_duplicado" | "cidade_fora_da_regiao" | "receita_fora_do_ar" | "fachada_estranha" | "terceira_recusa";
// Parecer: só nome do item, sim/não e nota curta FIXA. Nunca nome, endereço ou texto copiado de documento.
export type ParecerItem = { item: string; ok: boolean | null; nota?: string };
export type Contexto = {
  receita: ReceitaResultado; comprovante: LeituraComprovante | null; pdfSemTexto: boolean;
  fachada: LeituraFachada | null; cadastro: Cadastro; cnpjEmOutraLoja: boolean; cidadeNaRegiao: boolean | null;
};
export type Decisao = {
  decisao: "aprovar" | "pedir_novo" | "recusar" | "equipe"; motivo: MotivoLoja | null;
  motivosEquipe: MotivoEquipe[]; parecer: ParecerItem[];
};
