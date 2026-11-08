"use server";
// T38 · Minha loja: editar nome, WhatsApp, cidade, bairro e logo da vitrine.
// A RLS só deixa o dono editar; o gatilho do banco protege plano, status, selo e tipo.
// A logo vai para o bucket público "anuncios", na pasta <usuario>/loja/ (a RLS do Storage
// só deixa cada um gravar na própria pasta). Banner, "Sobre nós" e as outras informações da
// vitrine completa ficam em vitrine-actions.ts.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { apagarFoto } from "@/lib/dados/fotos";
import { traduzirErro } from "@/lib/erros";
import { linkLoja } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

const BUCKET = "anuncios";

export type EstadoLojaConta = { ok?: boolean; erro?: string; campos?: Record<string, string> } | null;
export type EnvioImagemLoja = { urlEnvio: string; urlPublica: string };

/** Endereço público aceito para a logo: só arquivo da pasta <usuario>/loja/ no Storage do OLAKI. */
function imagemValida(url: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return false;
  const prefixo = `${base}/storage/v1/object/public/${BUCKET}/${userId}/loja/`;
  if (!url.startsWith(prefixo)) return false;
  const resto = url.slice(prefixo.length);
  return /^[A-Za-z0-9._-]+$/.test(resto) && !resto.includes("..");
}

/** Prepara o envio da logo direto do navegador para o Storage (endereço assinado). */
export async function prepararEnvioImagemLoja(qual: "logo", formato: "webp" | "jpg"): Promise<Resultado<EnvioImagemLoja>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  if (qual !== "logo") return { ok: false, erro: { mensagem: "Imagem inválida." } };
  const fmt = formato === "jpg" ? "jpg" : "webp";
  const conta = await meuPerfilEVitrine();
  if (conta?.vitrine?.tipo !== "loja") return { ok: false, erro: { mensagem: "Só lojas podem mudar a logo." } };

  const db = await createClient();
  const caminho = `${userId}/loja/${qual}-${crypto.randomUUID()}.${fmt}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) return { ok: false, erro: { mensagem: "Não deu para preparar o envio da imagem. Tente de novo." } };
  const urlPublica = db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  return { ok: true, dados: { urlEnvio: data.signedUrl, urlPublica } };
}

export async function salvarLoja(_antes: EstadoLojaConta, form: FormData): Promise<EstadoLojaConta> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  const conta = await meuPerfilEVitrine();
  const v = conta?.vitrine;
  if (!v || v.tipo !== "loja") return { erro: "Só lojas têm vitrine para editar." };

  const nome = String(form.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const digitos = String(form.get("whatsapp") ?? "").replace(/\D/g, "");
  const cidade = String(form.get("cidade") ?? "").trim();
  const bairro = String(form.get("bairro") ?? "").replace(/\s+/g, " ").trim();
  const logo = String(form.get("logo_url") ?? "").trim();

  const campos: Record<string, string> = {};
  if (nome.length < 2 || nome.length > 80) campos.nome = "Escreva o nome da loja (de 2 a 80 letras).";
  const fone = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  if (digitos && !/^55[1-9][0-9]9?[0-9]{8}$/.test(fone)) campos.whatsapp = "WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.";
  const cidades = await listarCidades(v.microrregiao_id);
  if (!cidade) campos.cidade = "Escolha a cidade da loja.";
  else if (cidades.length > 0 && cidade !== v.cidade && !cidades.some((c) => c.nome === cidade)) campos.cidade = "Escolha uma cidade da lista.";
  if (bairro.length > 80) campos.bairro = "Bairro muito longo (até 80 letras).";
  // Imagem nova precisa ser do Storage do OLAKI; a atual (mesmo endereço) pode ficar.
  if (logo && logo !== v.logo_url && !imagemValida(logo, userId)) campos.logo_url = "Envie a logo pelo botão.";
  if (Object.keys(campos).length) return { erro: "Confira os campos marcados.", campos };

  const db = await createClient();
  const { error } = await db
    .from("vitrines_lojas")
    .update({
      nome,
      whatsapp: digitos ? fone : null,
      cidade,
      bairro: bairro || null,
      logo_url: logo || null,
    })
    .eq("id", v.id)
    .eq("dono_id", userId);
  if (error) {
    const e = traduzirErro(error);
    return { erro: e.mensagem, campos: e.campo ? { [e.campo]: e.mensagem } : undefined };
  }

  // Logo trocada ou tirada: apaga a antiga da pasta da loja (só a do próprio usuário).
  const antigas = [v.logo_url !== (logo || null) ? v.logo_url : null].filter((u): u is string => !!u && imagemValida(u, userId));
  await Promise.allSettled(antigas.map((u) => apagarFoto(u)));

  revalidatePath("/minha-conta", "layout");
  revalidatePath(linkLoja(v.slug));
  return { ok: true };
}
