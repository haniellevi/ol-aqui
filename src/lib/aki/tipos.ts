// Tipos do Robô Merc (migração 20261107031000_robo_aki.sql). Servem no servidor e no navegador.
// Dinheiro em centavos de real; preço de modelo em US$ por milhão de tokens.

export type ProvedorIA = "anthropic" | "openrouter" | "openai";
export const PROVEDORES: readonly ProvedorIA[] = ["anthropic", "openrouter", "openai"] as const;

/** Conversa normal ou cadastro por foto (cada um pode ter provedor e modelo próprios). */
export type TipoUso = "conversa" | "foto";

/** Por que o Merc não pode responder agora (robo_pode_enviar + checagens do servidor). */
export type MotivoBloqueio =
  | "sem_login"
  | "sem_perfil"
  | "desligado"
  | "sem_modelo"
  | "sem_cotacao"
  | "limite_diario"
  | "orcamento"
  | "sem_chave" // falta a chave do provedor (ou a chave do servidor que grava o custo)
  | "erro";

/** Linha de robo_pode_enviar(). */
export type PodeEnviar = {
  pode: boolean;
  motivo: MotivoBloqueio | null;
  usadas_hoje: number;
  limite_diario: number;
  provedor: string | null;
  modelo: string | null;
  microrregiao_id: string | null;
};

/** Cartão de anúncio mostrado na conversa (mesmos campos que o CardAnuncio usa). */
export type CartaoAki = {
  id: string;
  slug: string | null;
  titulo: string;
  preco_centavos: number | null;
  cidade: string;
  capa: string | null;
  criado_em: string;
  destaque: boolean; // pago: o card mostra "Patrocinado"
  vitrine_nome: string;
  vitrine_selo: boolean;
  vitrine_tipo: "pf" | "loja";
  aceita_troca?: boolean;
  preco_antes_centavos?: number | null;
  uf?: string | null;
};

/** Pedido do Radar preparado pelo Merc. Só vira pedido quando a pessoa toca em "Confirmar". */
export type DadosPedidoRadar = {
  titulo: string;
  detalhes: string | null;
  preco_max_centavos: number | null;
  /** null = região toda (o Aki só manda cidade quando a pessoa disse uma). */
  cidade: string | null;
  urgencia: "normal" | "esta_semana" | "hoje";
  categoria: "imovel" | "veiculo" | "movel" | "geral";
};

/** Botão que aparece embaixo da resposta. Nenhum deles publica, paga ou apaga sozinho. */
export type AcaoAki =
  | { tipo: "link"; rotulo: string; href: string; icone?: "revisar" | "planos" | "destacar" | "radar" | "vender" | "celular" }
  /** usada = a pessoa já confirmou (marcado no banco por robo_marcar_acao; o botão não volta). */
  | { tipo: "pedido_radar"; rotulo: string; dados: DadosPedidoRadar; usada?: boolean }
  /** Prévia do rascunho que o Merc guardou (foto, título, preço) com o botão para revisar e publicar. */
  | { tipo: "rascunho"; id: string; titulo: string | null; preco_centavos: number | null; capa: string | null; fotos: number; href: string };

export type ConteudoUsuario = { texto: string; foto?: boolean };
export type ConteudoAssistente = {
  texto: string;
  cartoes?: CartaoAki[];
  acoes?: AcaoAki[];
  ferramentas?: string[];
};

/** Mensagem como a folha do Merc mostra. */
export type MensagemAki =
  | { id: number | null; papel: "usuario"; conteudo: ConteudoUsuario; criado_em: string }
  | { id: number | null; papel: "assistente"; conteudo: ConteudoAssistente; criado_em: string; nota?: -1 | 1 | null };

/** Resposta do GET /api/aki: o que o balão precisa saber ao abrir. */
export type EstadoAki = {
  logado: boolean;
  /** O Merc existe nesta região (robo.ativo)? Desligado no painel = o balão nem aparece. */
  ligado: boolean;
  pode: boolean;
  motivo: MotivoBloqueio | null;
  restantes: number | null; // mensagens que ainda pode mandar hoje
  boasVindas: string | null;
  sugestoes: string[];
  avisoIa: string | null;
  fotoLadoMaximo: number;
  maxCaracteres: number;
  conversaId: string | null;
  mensagens: MensagemAki[];
};

/** Linhas (JSON por linha) que o POST /api/aki manda enquanto a resposta chega. */
export type EventoAki =
  | { tipo: "texto"; texto: string }
  | { tipo: "substituir"; texto: string } // a moderação trocou a resposta inteira
  | { tipo: "cartoes"; cartoes: CartaoAki[] }
  | { tipo: "acoes"; acoes: AcaoAki[] }
  | { tipo: "pensando"; rotulo: string } // está usando uma função do site (buscar, rascunho...)
  | { tipo: "bloqueado"; motivo: MotivoBloqueio; mensagem: string }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "fim"; conversaId: string | null; mensagemId: number | null; restantes: number | null };

/** Corpo do POST /api/aki. */
export type PedidoAki = {
  ajudaWhatsapp?: boolean;
  conversaId?: string | null;
  texto: string;
  foto?: { base64: string; tipo: "image/webp" | "image/jpeg" | "image/png" } | null;
  /** Rascunho aberto no cadastro (passo Fotos): o Merc guarda nele em vez de criar outro. */
  rascunhoId?: string | null;
};

/* ------------------------------- Painel ------------------------------- */

/** Linha do catálogo robo_modelos. */
export type ModeloIA = {
  id: string;
  provedor: ProvedorIA;
  modelo: string;
  nome: string;
  le_imagem: boolean;
  usa_ferramentas: boolean;
  preco_entrada_usd: number | null;
  preco_saida_usd: number | null;
  preco_cache_leitura_usd: number | null;
  preco_cache_escrita_usd: number | null;
  fallback_servidor: boolean;
  ativo: boolean;
  observacao: string | null;
  atualizado_em: string;
};

/** Retorno de robo_painel(). */
export type PainelAki = {
  custo_mes_centavos: number;
  respostas_mes: number;
  orcamento_centavos: number | null;
  alerta_percentual: number | null;
  por_provedor: { provedor: string; modelo: string; custo: number; respostas: number; tokens_entrada: number; tokens_saida: number }[];
  por_dia: { dia: string; conversas: number; mensagens: number; custo: number }[];
  piores: { mensagem_id: number; comentario: string | null; quando: string; resposta: string | null; pergunta: string | null; modelo: string | null }[];
  avaliacoes: { boas: number; ruins: number };
  buscas_vazias: { id: number; termo: string; categoria_slug: string | null; vezes: number; ultima_em: string; regiao: string | null }[];
};

/** Resultado do botão "Testar" do painel. */
export type ResultadoTeste =
  | { ok: true; resposta: string; latenciaMs: number; custoCentavos: number | null; modelo: string }
  | { ok: false; erro: string };
