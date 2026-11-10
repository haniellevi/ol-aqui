import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Formato que o Clerk usa (WebhookEvent "user" e currentUser) reduzido ao que importa. */
type UsuarioClerk = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  hasImage?: boolean;
  primaryPhoneNumberId: string | null;
  phoneNumbers: { id: string; phoneNumber: string; verification: { status: string } | null }[];
};

const REGIAO_PADRAO = "corrente-pi"; // região-piloto; o usuário poderá trocar no perfil

/** "+5589999990000" → "5589999990000" (só se for celular brasileiro válido). */
function whatsappDe(e164?: string) {
  const d = (e164 ?? "").replace(/\D/g, "");
  return /^55[1-9][0-9]9?[0-9]{8}$/.test(d) ? d : null;
}

/**
 * Cria ou atualiza o perfil a partir dos dados do Clerk (fonte confiável).
 * A confirmação externa tem precedência; telefones do Clerk só mudam enquanto ele for a fonte.
 * Roda com a chave secreta porque grava campos que o usuário não pode alterar.
 */
export async function sincronizarPerfil(u: UsuarioClerk) {
  const db = supabaseAdmin();
  const tel = u.phoneNumbers.find((p) => p.id === u.primaryPhoneNumberId && p.verification?.status === "verified");
  const whatsapp = whatsappDe(tel?.phoneNumber);
  const avatar = u.hasImage === false ? null : u.imageUrl;
  const nome = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "Usuário OLAKI";

  const { data: existente, error: erroLeitura } = await db.from("perfis").select("id, whatsapp, whatsapp_verificado_em, whatsapp_origem, avatar_url").eq("id", u.id).maybeSingle();
  if (erroLeitura) throw new Error("Não foi possível consultar o perfil.");

  if (!existente) {
    const { data: regiao } = await db.from("microrregioes").select("id").eq("slug", REGIAO_PADRAO).single();
    if (!regiao) throw new Error(`Região padrão "${REGIAO_PADRAO}" não existe.`);
    const { error } = await db.from("perfis").insert({
      id: u.id,
      microrregiao_id: regiao.id,
      nome,
      avatar_url: avatar,
      whatsapp,
      whatsapp_verificado_em: whatsapp ? new Date().toISOString() : null,
    });
    if (error && error.code !== "23505") throw new Error(error.message); // 23505: outra requisição criou antes
    return;
  }

  // Atualiza só o que vem do Clerk; nome e cidade editados no site são do usuário.
  const alteracoes: Record<string, string | null> = {};
  if (avatar !== existente.avatar_url) alteracoes.avatar_url = avatar;
  if (existente.whatsapp_origem !== "evolution" && whatsapp && (whatsapp !== existente.whatsapp || !existente.whatsapp_verificado_em)) {
    alteracoes.whatsapp = whatsapp;
    alteracoes.whatsapp_verificado_em = new Date().toISOString();
  } else if (existente.whatsapp_origem !== "evolution" && !whatsapp && existente.whatsapp_verificado_em) {
    // Não substitui o principal por outro telefone. Preserva o contato digitado sem confirmação.
    alteracoes.whatsapp = null;
    alteracoes.whatsapp_verificado_em = null;
  }
  if (Object.keys(alteracoes).length) {
    // Foto independente do telefone. A condição na gravação protege uma confirmação concorrente.
    if (Object.hasOwn(alteracoes, "whatsapp")) {
      const { error } = await db.from("perfis").update({ whatsapp: alteracoes.whatsapp, whatsapp_verificado_em: alteracoes.whatsapp_verificado_em })
        .eq("id", u.id).eq("whatsapp_origem", "clerk");
      if (error) throw new Error("Não foi possível atualizar a foto e o telefone da conta.");
      delete alteracoes.whatsapp; delete alteracoes.whatsapp_verificado_em;
    }
    if (!Object.keys(alteracoes).length) return;
    const { data, error } = await db.from("perfis").update(alteracoes).eq("id", u.id).select("id").maybeSingle();
    if (error || data?.id !== u.id) throw new Error("Não foi possível atualizar a foto e o telefone da conta.");
  }
}

/**
 * Garante que o usuário logado tem perfil no banco (primeiro acesso).
 * O webhook do Clerk faz o mesmo; isto cobre o caso de o webhook atrasar.
 */
export async function garantirPerfil() {
  const { userId } = await auth();
  if (!userId) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from("perfis").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o perfil.");
  if (!data) {
    const u = await currentUser();
    if (u) await sincronizarPerfil(u);
  }
  return userId;
}
