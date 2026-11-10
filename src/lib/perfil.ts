import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { whatsappJaVinculado } from "@/lib/erros";

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

  async function lerPerfil() {
    const { data, error } = await db.from("perfis").select("id, whatsapp, whatsapp_verificado_em, whatsapp_origem, avatar_url").eq("id", u.id).maybeSingle();
    if (error) throw new Error("Não foi possível consultar o perfil.");
    return data;
  }

  let existente = await lerPerfil();

  if (!existente) {
    const { data: regiao } = await db.from("microrregioes").select("id").eq("slug", REGIAO_PADRAO).single();
    if (!regiao) throw new Error(`Região padrão "${REGIAO_PADRAO}" não existe.`);
    const perfil = {
      id: u.id,
      microrregiao_id: regiao.id,
      nome,
      avatar_url: avatar,
      whatsapp,
      whatsapp_verificado_em: whatsapp ? new Date().toISOString() : null,
    };
    let { error } = await db.from("perfis").insert(perfil);
    const vinculado = whatsappJaVinculado(error);
    if (vinculado) {
      // A conta ainda precisa de perfil para confirmar outro número.
      ({ error } = await db.from("perfis").insert({ ...perfil, whatsapp: null, whatsapp_verificado_em: null }));
    }
    if (!error) return vinculado ? { whatsappVinculado: true } : undefined;
    if (error.code !== "23505" || !error.message?.includes('"perfis_pkey"')) throw new Error("Não foi possível criar o perfil.");
    existente = await lerPerfil(); // Só a colisão do ID admite criação simultânea.
    if (!existente) throw new Error("Não foi possível confirmar a criação do perfil.");
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
  let vinculado = false;
  if (Object.keys(alteracoes).length) {
    // Foto independente do telefone. A condição na gravação protege uma confirmação concorrente.
    if (Object.hasOwn(alteracoes, "whatsapp")) {
      const { error } = await db.from("perfis").update({ whatsapp: alteracoes.whatsapp, whatsapp_verificado_em: alteracoes.whatsapp_verificado_em })
        .eq("id", u.id).eq("whatsapp_origem", "clerk");
      vinculado = whatsappJaVinculado(error);
      if (error && !vinculado) throw new Error("Não foi possível atualizar o telefone da conta.");
      if (vinculado && existente.whatsapp && existente.whatsapp_verificado_em) {
        // O Clerk já não comprova o número anterior. Uma confirmação mais recente deve prevalecer.
        const { error: erroRemocao } = await db.from("perfis").update({ whatsapp: null, whatsapp_verificado_em: null })
          .eq("id", u.id).eq("whatsapp_origem", "clerk").eq("whatsapp", existente.whatsapp)
          .eq("whatsapp_verificado_em", existente.whatsapp_verificado_em);
        if (erroRemocao) throw new Error("Não foi possível atualizar o telefone da conta.");
      }
      delete alteracoes.whatsapp; delete alteracoes.whatsapp_verificado_em;
    }
    if (Object.keys(alteracoes).length) {
      const { data, error } = await db.from("perfis").update(alteracoes).eq("id", u.id).select("id").maybeSingle();
      if (error || data?.id !== u.id) throw new Error("Não foi possível atualizar a foto da conta.");
    }
  }
  return vinculado ? { whatsappVinculado: true } : undefined;
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
