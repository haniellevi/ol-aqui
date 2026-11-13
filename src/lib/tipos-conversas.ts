// Tipos das Conversas (colunas das funções do banco, em snake_case como em tipos-radar.ts).

export type PapelConversa = "cliente" | "loja";
export type LadoMensagem = PapelConversa | "sistema";
export type TipoMensagem = "texto" | "anuncio" | "proposta" | "sistema";

/** Linha de minhas_conversas(). */
export type ResumoConversa = {
  id: string;
  papel: PapelConversa;
  outro_nome: string;
  vitrine_id: string;
  ultima_texto: string | null;
  ultima_em: string;
  nao_lidas: number;
  bloqueada: boolean;
};

/** Linha de conversa_detalhe(). whatsapp_cliente só chega para a loja depois que o cliente mostrou. */
export type DetalheConversa = {
  id: string;
  papel: PapelConversa;
  outro_nome: string;
  loja_slug: string;
  whatsapp_cliente: string | null;
  whatsapp_liberado: boolean;
  eu_bloqueei: boolean;
  fui_bloqueado: boolean;
};

/** Linha de conversa_mensagens_de(). */
export type MensagemConversa = {
  id: string;
  lado: LadoMensagem;
  tipo: TipoMensagem;
  texto: string | null;
  alerta_golpe: boolean;
  criado_em: string;
  anuncio_id: string | null;
  anuncio_titulo: string | null;
  anuncio_preco_centavos: number | null;
  anuncio_foto: string | null;
  anuncio_link: string | null;
  pedido_id: string | null;
  pedido_titulo: string | null;
  proposta_preco_centavos: number | null;
  proposta_id_ref: string | null;
  /** Proposta tirada pela equipe ou apagada: o cartão fica sem texto nem preço. */
  proposta_retirada: boolean;
};

/** Linha de admin_ler_conversa(): a mensagem com o nome de quem escreveu. */
export type MensagemConversaAdmin = MensagemConversa & { autor_nome: string | null };
