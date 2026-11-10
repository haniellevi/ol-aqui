"use server";

import { unstable_rethrow } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";
import { idUsuarioValido } from "@/lib/admin/gestao";

export async function prepararFotoGestao(tipo: "usuario" | "loja", id: string, campo: string, formato: "webp" | "jpg") {
  try {
    const { supabase } = await exigirAdmin();
    if (!["webp", "jpg"].includes(formato) || !["usuario", "loja"].includes(tipo)) return { erro: "Formato inválido." };
    if (tipo === "usuario" ? !idUsuarioValido(id) || campo !== "avatar_url" : !ehUuid(id) || !["logo_url", "capa_url", "banner_url"].includes(campo))
      return { erro: "Imagem inválida." };
    const { data, error } = await supabase.rpc(tipo === "usuario" ? "admin_usuario" : "admin_loja_detalhe", { p_id: id });
    if (error || !data || data.revogado) return { erro: "Não foi possível abrir o cadastro para enviar a foto." };
    const dono = tipo === "usuario" ? id : data.dono_id;
    if (!idUsuarioValido(dono)) return { erro: "Titular inválido." };
    const pasta = tipo === "usuario" ? "perfil" : campo === "banner_url" ? "vitrine" : "loja";
    const caminho = `${dono}/${pasta}/admin-${crypto.randomUUID()}.${formato}`;
    const bucket = supabaseAdmin().storage.from("anuncios");
    const envio = await bucket.createSignedUploadUrl(caminho);
    if (envio.error || !envio.data) return { erro: "Não foi possível preparar o envio. Tente novamente." };
    return { urlEnvio: envio.data.signedUrl, urlPublica: bucket.getPublicUrl(caminho).data.publicUrl };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: "Não foi possível preparar o envio. Tente novamente." };
  }
}
