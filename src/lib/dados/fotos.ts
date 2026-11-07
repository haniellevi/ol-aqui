"use server";
// Server Actions das fotos do anúncio. Podem ser chamadas direto de componente de cliente.
// Usam o cliente do usuário: a RLS do Storage só deixa gravar/apagar na pasta <usuario_id>/.
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

const BUCKET = "anuncios";
const MAX_FOTOS = 12; // mesmo limite do banco (check de anuncios.fotos)

export type EnvioFoto = {
  /** Caminho no bucket: <usuario>/<anuncio>/<uuid>.webp */
  caminho: string;
  /** Endereço para enviar o arquivo (PUT, vale por 2 horas). Use enviarFoto() de "@/lib/fotos". */
  urlEnvio: string;
  token: string;
  /** Endereço público para salvar em anuncios.fotos depois que o envio der certo. */
  urlPublica: string;
};

/**
 * Prepara o envio de uma foto: confere que o anúncio é do usuário e devolve um endereço
 * assinado para o navegador mandar o arquivo direto ao Storage (sem passar pelo servidor).
 */
export async function criarUrlEnvioFoto(anuncioId: string, formato: "webp" | "jpg" = "webp"): Promise<Resultado<EnvioFoto>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };

  const db = await createClient();
  const { data: anuncio } = await db
    .from("anuncios")
    .select("id, fotos, vitrines_lojas!inner(dono_id)")
    .eq("id", anuncioId)
    .eq("vitrines_lojas.dono_id", userId)
    .maybeSingle();
  if (!anuncio) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };
  if (((anuncio.fotos as string[] | null)?.length ?? 0) >= MAX_FOTOS) {
    return { ok: false, erro: { mensagem: `Você já colocou ${MAX_FOTOS} fotos. Tire uma para pôr outra.`, campo: "fotos" } };
  }

  const caminho = `${userId}/${anuncioId}/${crypto.randomUUID()}.${formato}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) return { ok: false, erro: { mensagem: "Não deu para preparar o envio da foto. Tente de novo." } };
  const urlPublica = db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  return { ok: true, dados: { caminho, urlEnvio: data.signedUrl, token: data.token, urlPublica } };
}

/**
 * Apaga do Storage uma foto do próprio usuário (ex.: tirou a foto do anúncio).
 * Só aceita caminho dentro da pasta do usuário. Não mexe em anuncios.fotos.
 */
export async function apagarFoto(urlOuCaminho: string): Promise<Resultado> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  const caminho = caminhoDaFoto(urlOuCaminho);
  if (!caminho || !caminho.startsWith(`${userId}/`)) return { ok: false, erro: { mensagem: "Foto não encontrada." } };
  const db = await createClient();
  const { error } = await db.storage.from(BUCKET).remove([caminho]);
  return error ? { ok: false, erro: { mensagem: "Não deu para apagar a foto. Tente de novo." } } : { ok: true, dados: undefined };
}

/** ".../storage/v1/object/public/anuncios/<caminho>" ou "<caminho>" → "<caminho>" (só letras seguras). */
function caminhoDaFoto(v: string): string | null {
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = v.indexOf(marca);
  const c = i >= 0 ? v.slice(i + marca.length) : v;
  return /^[A-Za-z0-9._/-]+$/.test(c) && !c.includes("..") ? c : null;
}
