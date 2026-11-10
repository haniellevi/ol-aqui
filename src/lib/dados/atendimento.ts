import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CONVERSAS_POR_PAGINA = 30;
export type Atendimento = {
  id: string;
  anuncio_id: string;
  aki_ativo: boolean;
  aguarda_equipe: boolean;
  atualizado_em: string;
  anuncios: { titulo: string | null } | null;
};
export type MensagemAtendimento = {
  id: number;
  autor: "equipe" | "anunciante" | "aki";
  texto: string;
  criado_em: string;
};

const COLUNAS = "id, anuncio_id, aki_ativo, aguarda_equipe, atualizado_em, anuncios(titulo)";

export function listarAtendimentos(db: SupabaseClient, pagina: number, anunciante?: string) {
  let consulta = db.from("atendimentos_anuncio").select(COLUNAS, { count: "exact" });
  if (anunciante) consulta = consulta.eq("anunciante_id", anunciante);
  else consulta = consulta.order("aguarda_equipe", { ascending: false });
  const inicio = (pagina - 1) * CONVERSAS_POR_PAGINA;
  return consulta.order("atualizado_em", { ascending: false }).order("id")
    .range(inicio, inicio + CONVERSAS_POR_PAGINA - 1).returns<Atendimento[]>();
}

export function paginaAtendimento(valor?: string) {
  return valor && /^\d{1,6}$/.test(valor) ? Math.max(1, Number(valor)) : 1;
}

export function meuAtendimento(db: SupabaseClient, id: string, anunciante: string) {
  return db.from("atendimentos_anuncio").select(COLUNAS).eq("id", id).eq("anunciante_id", anunciante).maybeSingle<Atendimento>();
}

export async function lerMensagensAtendimento(db: SupabaseClient, conversa: string, antes?: string) {
  let consulta = db.from("atendimento_mensagens").select("id, autor, texto, criado_em").eq("conversa_id", conversa);
  if (antes && /^\d{1,15}$/.test(antes)) consulta = consulta.lt("id", antes);
  const { data, error } = await consulta.order("id", { ascending: false }).limit(51).returns<MensagemAtendimento[]>();
  const mensagens = (data ?? []).slice(0, 50).reverse();
  return { mensagens, error, anterior: data && data.length > 50 ? mensagens[0].id : null };
}
