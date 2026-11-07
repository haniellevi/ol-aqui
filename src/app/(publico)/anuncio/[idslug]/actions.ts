"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { garantirPerfil } from "@/lib/perfil";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { Resultado, TipoEvento } from "@/lib/tipos";

// Ações da página do anúncio: contar visita/clique, favoritar e denunciar.
// Quem decide o que vale é o banco (registrar_evento, RLS de favoritos e denúncias).

const TIPOS: TipoEvento[] = ["visualizacao", "clique_whatsapp", "compartilhar"];

/**
 * Conta uma visualização ou clique no WhatsApp. O banco ignora repetição do mesmo visitante,
 * o próprio dono e anúncio fora do ar. Nunca lança erro (a pessoa não precisa saber).
 */
export async function registrarEvento(anuncioId: string, tipo: TipoEvento): Promise<boolean> {
  if (!ehUuid(anuncioId) || !TIPOS.includes(tipo)) return false;
  try {
    const h = await headers();
    // A chamada sai do servidor: informa ao banco quem é o visitante (IP que a Vercel recebeu)
    // e o usuário logado. O banco guarda só um resumo embaralhado, nunca o IP.
    // O navegador (user-agent) não entra: o visitante pode trocá-lo à vontade.
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100);
    const { userId } = await auth();
    const { data, error } = await supabaseAdmin().rpc("registrar_evento", {
      anuncio_id: anuncioId,
      tipo,
      visitante: ip || null,
      usuario: userId ?? null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

const PRECISA_ENTRAR = { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } as const;

/** Liga/desliga o favorito. Sem login devolve código 28000 (a tela manda para /entrar). */
export async function alternarFavorito(anuncioId: string, favoritar: boolean): Promise<Resultado<{ favorito: boolean }>> {
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { ...PRECISA_ENTRAR } };
  try {
    await garantirPerfil(); // favorito aponta para o perfil (1º acesso)
    const db = await createClient();
    if (favoritar) {
      const { error } = await db.from("favoritos").insert({ usuario_id: userId, anuncio_id: anuncioId });
      if (error && error.code !== "23505") return { ok: false, erro: traduzirErro(error) }; // 23505: já era favorito
    } else {
      const { error } = await db.from("favoritos").delete().eq("usuario_id", userId).eq("anuncio_id", anuncioId);
      if (error) return { ok: false, erro: traduzirErro(error) };
    }
    return { ok: true, dados: { favorito: favoritar } };
  } catch {
    return { ok: false, erro: traduzirErro(null) };
  }
}

/** Motivos prontos (F9) → motivo aceito pelo banco (tabela denuncias). */
const MOTIVOS: Record<string, { motivo: string; detalhe?: string }> = {
  pagamento: { motivo: "golpe", detalhe: "Pediu pagamento antecipado" },
  falso: { motivo: "falso" },
  preco: { motivo: "golpe", detalhe: "Preço enganoso" },
  proibido: { motivo: "proibido" },
  ofensivo: { motivo: "ofensivo" },
  repetido: { motivo: "duplicado" },
  outro: { motivo: "outro" },
};

export type EstadoDenuncia = { ok: boolean; mensagem: string; precisaEntrar?: boolean } | null;

/** Formulário "Denunciar" (useActionState). Exige login: a regra do banco guarda quem denunciou. */
export async function denunciarAnuncio(_anterior: EstadoDenuncia, form: FormData): Promise<EstadoDenuncia> {
  const anuncioId = String(form.get("anuncio_id") ?? "");
  const chave = String(form.get("motivo") ?? "");
  const texto = String(form.get("detalhes") ?? "").trim().slice(0, 900);
  const m = MOTIVOS[chave];
  if (!ehUuid(anuncioId)) return { ok: false, mensagem: "Anúncio não encontrado." };
  if (!m) return { ok: false, mensagem: "Escolha um motivo." };
  if (chave === "outro" && texto.length < 5) return { ok: false, mensagem: "Conte em poucas palavras o que aconteceu." };

  const { userId } = await auth();
  if (!userId) return { ok: false, mensagem: PRECISA_ENTRAR.mensagem, precisaEntrar: true };
  try {
    await garantirPerfil();
    const db = await createClient();
    const detalhes = [m.detalhe, texto].filter(Boolean).join(": ") || null;
    const { error } = await db
      .from("denuncias")
      .insert({ alvo_tipo: "anuncio", alvo_id: anuncioId, denunciante_id: userId, motivo: m.motivo, detalhes });
    if (error?.code === "23505") return { ok: true, mensagem: "Você já denunciou este anúncio. Obrigado, vamos olhar." };
    if (error) return { ok: false, mensagem: traduzirErro(error).mensagem };
    return { ok: true, mensagem: "Denúncia enviada. Obrigado! A equipe do OLAKI vai olhar." };
  } catch {
    return { ok: false, mensagem: traduzirErro(null).mensagem };
  }
}
