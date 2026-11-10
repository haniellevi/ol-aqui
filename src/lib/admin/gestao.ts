import type { Horarios } from "@/lib/tipos-vitrine";

export type UsuarioAdmin = {
  id: string; nome: string; tipo_pessoa: "pf" | "pj"; microrregiao_id: string;
  cidade: string | null; bairro: string | null; whatsapp: string | null; avatar_url: string | null;
  whatsapp_verificado_em: string | null; atualizado_em: string; criado_em: string;
  bloqueado: boolean; revogado: boolean; loja_id: string | null; loja_nome: string | null;
};
export type LojaGestao = {
  id: string; dono_id: string; dono_nome: string; nome: string; slug: string; tipo: "pf" | "loja";
  microrregiao_id: string; cidade: string; bairro: string | null; cnpj: string | null;
  whatsapp: string | null; telefone_publico: string | null; site_url: string | null; instagram: string | null;
  descricao: string | null; sobre: string | null; endereco: string | null; lat: number | null; lng: number | null;
  horarios: Horarios | null; formas_pagamento: string[]; faz_entrega: boolean | null; entrega_obs: string | null;
  logo_url: string | null; capa_url: string | null; banner_url: string | null;
  banner_tipo: string; banner_modelo: string; banner_cor: string;
  status: string; plano: string; atualizado_em: string; verificacao_estado: string;
  assinatura_vinculada: boolean; gerentes_total: number; anuncios_total: number; pagamentos_total: number; propostas_total: number; retencoes_total: number;
};
export type LocalidadesGestao = {
  regioes: { id: string; nome: string }[];
  cidades: { nome: string; microrregiao_id: string }[];
};

export const idUsuarioValido = (id: string) => /^user_[A-Za-z0-9]+$/.test(id);
export const textoForm = (form: FormData, chave: string) => {
  const v = form.get(chave);
  if (v !== null && typeof v !== "string") throw new Error("Preencha os campos com texto.");
  return (v ?? "").trim();
};
export function motivoForm(form: FormData) {
  const motivo = textoForm(form, "motivo");
  if (motivo.length < 3 || motivo.length > 300) throw new Error("Informe o motivo, de 3 a 300 caracteres.");
  return motivo;
}
export function telefoneForm(form: FormData, chave: string) {
  const texto = textoForm(form, chave);
  if (!texto) return null;
  if (texto.length > 30 || !/^[\d+().\s-]+$/.test(texto)) throw new Error("Confira os telefones: use DDD e número.");
  let n = texto.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (!/^55[1-9][0-9]9?[0-9]{8}$/.test(n)) throw new Error("Confira os telefones: use DDD e número.");
  return n;
}

export function erroGestao(erro: { code?: string; message?: string }) {
  if (erro.code === "55000") return "Há conteúdo preservado por Compliance. Resolva a retenção antes de excluir a loja.";
  if (erro.code === "23503") return "Há registros vinculados que impedem esta operação. Confira pagamentos e histórico.";
  return null;
}
