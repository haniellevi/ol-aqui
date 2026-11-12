"use server";
// Server Actions das fotos do anúncio. Podem ser chamadas direto de componente de cliente.
// Usam o cliente do usuário: a RLS do Storage só deixa gravar/apagar na pasta <usuario_id>/
// ou, para o ajudante (P5b), na pasta <dono>/<anuncio>/ de uma loja que ele ajuda.
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { lojasQueCuido } from "@/lib/dados/loja-ativa";
import { edicaoAdmin } from "@/lib/dados/edicao-admin";
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
  if (formato !== "webp" && formato !== "jpg") return { ok: false, erro: { mensagem: "Formato de foto inválido." } };
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };

  const db = await createClient();
  const { data: anuncio, error: erroAnuncio } = await db
    .from("anuncios")
    .select("id, fotos, vitrine_id, vitrines_lojas!inner(dono_id)")
    .eq("id", anuncioId)
    .maybeSingle();
  if (erroAnuncio) return { ok: false, erro: { mensagem: "Não foi possível abrir o anúncio. Tente de novo." } };
  // P5b: anúncio da própria loja ou de uma loja que a pessoa ajuda.
  const lojas = await lojasQueCuido();
  const dono = (anuncio?.vitrines_lojas as { dono_id?: string } | null)?.dono_id;
  // P5b-2a: ou super admin com a edição aberta neste anúncio.
  if (!anuncio || !dono || !(lojas.some((l) => l.id === anuncio.vitrine_id) || (await edicaoAdmin(anuncioId)))) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };
  if (((anuncio.fotos as string[] | null)?.length ?? 0) >= MAX_FOTOS) {
    return { ok: false, erro: { mensagem: `Você já colocou ${MAX_FOTOS} fotos. Tire uma para pôr outra.`, campo: "fotos" } };
  }

  // A foto fica na pasta do dono da loja; o banco (pode_enviar_foto) confere o ajudante.
  const caminho = `${dono}/${anuncioId}/${crypto.randomUUID()}.${formato}`;
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
  if (!caminho) return { ok: false, erro: { mensagem: "Foto não encontrada." } };
  const db = await createClient();
  // Própria pasta, ou (P5b) a pasta <dono>/<anúncio>/ de uma loja que a pessoa ajuda.
  if (!caminho.startsWith(`${userId}/`) && !(await pastaDaLojaAjudada(db, caminho))) return { ok: false, erro: { mensagem: "Foto não encontrada." } };
  // Pode ter sido usada em outro anúncio, na vitrine ou em uma proposta.
  // Falha de consulta também impede apagar: uma resposta perdida não pode quebrar uma foto salva.
  const publica = db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  const referencias = await Promise.all([
    db.from("anuncios").select("id").contains("fotos", [publica]).limit(1),
    db.from("vitrines_lojas").select("id").or(`logo_url.eq.${publica},capa_url.eq.${publica},banner_url.eq.${publica}`).limit(1),
    db.from("radar_propostas").select("id").eq("foto_url", publica).limit(1),
  ]);
  if (referencias.some((r) => r.error || r.data?.length)) return { ok: false, erro: { mensagem: "Esta foto ainda pode estar em uso e foi mantida." } };
  const { error } = await db.storage.from(BUCKET).remove([caminho]);
  return error ? { ok: false, erro: { mensagem: "Não deu para apagar a foto. Tente de novo." } } : { ok: true, dados: undefined };
}

async function pastaDaLojaAjudada(db: Awaited<ReturnType<typeof createClient>>, caminho: string): Promise<boolean> {
  const partes = caminho.split("/");
  const ajudadas = (await lojasQueCuido()).filter((l) => !l.dono).map((l) => l.id);
  if (partes.length !== 3 || !ehUuid(partes[1])) return false;
  // P5b-2a: super admin com a edição aberta no anúncio também apaga na pasta do dono.
  const equipe = !!(await edicaoAdmin(partes[1]));
  if (!ajudadas.length && !equipe) return false;
  const busca = db.from("anuncios").select("id, vitrines_lojas!inner(dono_id)").eq("id", partes[1]);
  const { data } = await (equipe ? busca : busca.in("vitrine_id", ajudadas)).maybeSingle();
  return (data?.vitrines_lojas as { dono_id?: string } | null | undefined)?.dono_id === partes[0];
}

/** ".../storage/v1/object/public/anuncios/<caminho>" ou "<caminho>" → "<caminho>" (só letras seguras). */
function caminhoDaFoto(v: string): string | null {
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = v.indexOf(marca);
  const c = i >= 0 ? v.slice(i + marca.length) : v;
  return /^[A-Za-z0-9._/-]+$/.test(c) && !c.includes("..") ? c : null;
}
