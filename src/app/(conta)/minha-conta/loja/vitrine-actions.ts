"use server";
// Vitrine completa (Minha loja): banner, informações, seções próprias e produtos fixados no topo.
// Tudo com o cliente do usuário: a RLS só deixa o dono mexer, e os gatilhos do banco conferem
// o plano (foto da fachada, quantas seções, quantos fixados), a pasta da foto, os horários,
// o Instagram, as formas de pagamento e as palavras proibidas. Aqui é só conforto: mensagens
// amigáveis antes de ir ao banco.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { apagarFoto } from "@/lib/dados/fotos";
import { minhaVitrineCompleta, meusRecursosVitrine, minhasSecoes, opcoesVitrine } from "@/lib/dados/vitrine-completa";
import { traduzirErro } from "@/lib/erros";
import { ehUuid, linkLoja, telefoneComercialDigitado } from "@/lib/formato";
import { limparInstagram, linkSiteLoja, minutosDoDia } from "@/components/vitrine/regras";
import { BANNER_MODELOS, DIAS_SEMANA, type FaixaHorario, type Horarios } from "@/lib/tipos-vitrine";
import type { Resultado } from "@/lib/tipos";

const BUCKET = "anuncios";
const SEM_LOGIN = { ok: false as const, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
const SO_LOJA = { ok: false as const, erro: { mensagem: "Só lojas têm vitrine para editar." } };

export type EstadoVitrine = { ok?: boolean; erro?: string; campos?: Record<string, string> } | null;

async function minhaLoja(exigirLeitura = false) {
  const { userId } = await auth();
  if (!userId) return { userId: null, v: null } as const;
  const v = await minhaVitrineCompleta(exigirLeitura);
  return { userId, v: v && v.tipo === "loja" && (!exigirLeitura || v.dono_id === userId) ? v : null } as const;
}

function atualizar(slug: string) {
  revalidatePath("/minha-conta/loja", "layout");
  revalidatePath("/minha-conta/anuncios");
  revalidatePath(linkLoja(slug));
}

/** Endereço público de uma foto do banner: só arquivo da pasta <usuario>/vitrine/ no Storage do OLAKI. */
function bannerValido(url: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return false;
  const prefixo = `${base}/storage/v1/object/public/${BUCKET}/${userId}/vitrine/`;
  if (!url.startsWith(prefixo)) return false;
  const resto = url.slice(prefixo.length);
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(resto) && !resto.includes("..");
}

/** Arquivo do próprio usuário no Storage (pasta vitrine ou loja), para apagar quando sai de uso. */
function arquivoMeu(url: string | null, userId: string): url is string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return !!url && !!base && (url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/${userId}/vitrine/`) ||
    url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/${userId}/loja/`));
}

/* -------------------------------- Banner -------------------------------- */

export type EnvioBanner = { urlEnvio: string; urlPublica: string };

/** Prepara o envio da foto da fachada (já cortada no aparelho) direto do navegador para o Storage. */
export async function prepararEnvioBanner(formato: "webp" | "jpg"): Promise<Resultado<EnvioBanner>> {
  try {
    const { userId, v } = await minhaLoja(true);
    if (!userId) return SEM_LOGIN;
    if (!v) return SO_LOJA;
    const recursos = await meusRecursosVitrine(true);
    if (!recursos.foto_fachada) return { ok: false, erro: { mensagem: "A foto da fachada não faz parte do seu plano.", campo: "banner" } };
    if (!["webp", "jpg"].includes(formato) || v.status === "suspensa") return { ok: false, erro: { mensagem: "Não é possível enviar esta foto." } };
    const fmt = formato;
    const db = await createClient();
    const caminho = `${userId}/vitrine/banner-${crypto.randomUUID()}.${fmt}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (error || !data) return { ok: false, erro: { mensagem: "Não deu para preparar o envio da foto. Tente de novo." } };
    const urlPublica = db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
    return { ok: true, dados: { urlEnvio: data.signedUrl, urlPublica } };
  } catch {
    return { ok: false, erro: { mensagem: "Não foi possível preparar a foto. Tente novamente." } };
  }
}

export async function salvarBanner(_antes: EstadoVitrine, form: FormData): Promise<EstadoVitrine> {
  try {
    const { userId, v } = await minhaLoja(true);
    if (!userId) return { erro: SEM_LOGIN.erro.mensagem };
    if (!v) return { erro: SO_LOJA.erro.mensagem };

    if (["banner_tipo", "banner_url", "banner_cor", "banner_modelo"].some((k) => typeof form.get(k) !== "string") || !["foto", "modelo"].includes(String(form.get("banner_tipo"))) || !(BANNER_MODELOS as readonly string[]).includes(String(form.get("banner_modelo")))) return { erro: "Escolha o tipo e o modelo da capa." };
    let tipo = form.get("banner_tipo") === "foto" ? "foto" : "modelo";
    let url = String(form.get("banner_url") ?? "").trim();
    // Plano sem foto da fachada (plano menor): a tela só mostra o modelo, mas a foto guardada fica
    // como está para voltar quando o plano tiver foto de novo. Aqui só mudam a cor e o desenho.
    if (v.banner_tipo === "foto" && v.banner_url && !(await meusRecursosVitrine(true)).foto_fachada) {
      tipo = "foto";
      url = v.banner_url;
    }
    const cor = String(form.get("banner_cor") ?? "").trim().toUpperCase();
    const modeloBruto = String(form.get("banner_modelo") ?? "liso");
    const modelo = (BANNER_MODELOS as readonly string[]).includes(modeloBruto) ? modeloBruto : "liso";

    const opcoes = await opcoesVitrine(v.microrregiao_id);
    if (!/^#[0-9A-F]{6}$/.test(cor) || (opcoes.cores.length > 0 && !opcoes.cores.includes(cor) && cor !== v.banner_cor)) {
      return { erro: "Escolha uma das cores da lista.", campos: { banner_cor: "Escolha uma das cores da lista." } };
    }
    // Foto nova precisa ser do Storage do OLAKI; a atual (mesmo endereço) pode ficar.
    if (url && url !== v.banner_url && !bannerValido(url, userId)) {
      return { erro: "Envie a foto pelo botão.", campos: { banner: "Envie a foto pelo botão." } };
    }
    if (tipo === "foto" && !url) {
      return { erro: "Envie a foto da fachada ou escolha um banner modelo.", campos: { banner: "Envie a foto da fachada." } };
    }

    // Trocar para modelo preserva a foto guardada; substituir a URL libera a anterior.
    const novaUrl = url || null;
    const mudancas: Record<string, unknown> = { banner_tipo: tipo, banner_url: novaUrl, banner_cor: cor, banner_modelo: modelo };
    // A capa antiga (etapa 2) virou o banner na migração: quando o banner muda, ela sai junto.
    if (v.capa_url && v.capa_url === v.banner_url && novaUrl !== v.banner_url) mudancas.capa_url = null;

    const db = await createClient();
    const { data, error } = await db.from("vitrines_lojas").update(mudancas).eq("id", v.id).eq("dono_id", userId).select("id").maybeSingle();
    if (error) {
      const e = traduzirErro(error);
      return { erro: e.mensagem, campos: e.campo ? { [e.campo]: e.mensagem } : undefined };
    }
    if (data?.id !== v.id) return { erro: "A capa não foi atualizada. Recarregue a página e tente novamente." };
    if (v.banner_url && v.banner_url !== novaUrl && arquivoMeu(v.banner_url, userId)) {
      await Promise.allSettled([apagarFoto(v.banner_url)]);
    }
    atualizar(v.slug);
    return { ok: true };
  } catch {
    return { erro: "Não foi possível confirmar o salvamento da capa. Tente novamente." };
  }
}

/** Apaga do Storage uma foto do banner que foi enviada mas não chegou a ser salva (trocou de ideia). */
export async function descartarFotoBanner(url: string): Promise<Resultado> {
  try {
    const { userId, v } = await minhaLoja(true);
    if (!userId) return SEM_LOGIN;
    if (!v) return SO_LOJA;
    if (!bannerValido(url, userId) || url === v.banner_url) return { ok: true, dados: undefined };
    return apagarFoto(url);
  } catch {
    return { ok: false, erro: { mensagem: "Não foi possível descartar a foto." } };
  }
}

/* ------------------------------ Informações ----------------------------- */

/** Confere os horários do jeito do banco (para mostrar o erro no dia certo). */
function lerHorarios(bruto: string): { horarios: Horarios | null; erro?: string } {
  if (!bruto.trim()) return { horarios: null };
  let obj: unknown;
  try {
    obj = JSON.parse(bruto);
  } catch {
    return { horarios: null, erro: "Não deu para ler os horários. Confira e tente de novo." };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { horarios: null, erro: "Horários inválidos." };
  if (Object.keys(obj).some((k) => !(DIAS_SEMANA as readonly string[]).includes(k))) return { horarios: null, erro: "Dia da semana inválido." };
  const saida: Horarios = {};
  let algum = false;
  for (const dia of DIAS_SEMANA) {
    const lista = (obj as Record<string, unknown>)[dia];
    if (lista == null) continue;
    if (!Array.isArray(lista) || lista.length > 3) return { horarios: null, erro: "Cada dia pode ter até 3 horários." };
    const faixas: FaixaHorario[] = [];
    let ultimo = -1;
    for (const f of lista) {
      const abre = String((f as FaixaHorario)?.abre ?? "");
      const fecha = String((f as FaixaHorario)?.fecha ?? "");
      const a = minutosDoDia(abre);
      const b = minutosDoDia(fecha);
      if (a === null || b === null || abre === "24:00" || a >= b || a < ultimo) {
        return {
          horarios: null,
          erro: "Confira os horários: a hora de abrir vem antes da hora de fechar, e os horários do mesmo dia não podem se cruzar.",
        };
      }
      ultimo = b;
      faixas.push({ abre, fecha });
    }
    saida[dia] = faixas;
    if (faixas.length) algum = true;
  }
  return { horarios: algum ? saida : null };
}

export async function salvarInformacoes(_antes: EstadoVitrine, form: FormData): Promise<EstadoVitrine> {
  try {
    const { userId, v } = await minhaLoja(true);
    if (!userId) return { erro: SEM_LOGIN.erro.mensagem };
    if (!v) return { erro: SO_LOJA.erro.mensagem };

    if (["endereco", "lat", "lng", "instagram", "sobre", "faz_entrega", "entrega_obs", "horarios"].some((k) => typeof form.get(k) !== "string") || form.getAll("formas_pagamento").some((f) => typeof f !== "string")) return { erro: "Recarregue a página e preencha as informações da loja." };
    const endereco = String(form.get("endereco") ?? "").replace(/\s+/g, " ").trim();
    const latTxt = String(form.get("lat") ?? "").trim();
    const lngTxt = String(form.get("lng") ?? "").trim();
    const instagram = limparInstagram(String(form.get("instagram") ?? ""));
    const site = form.get("site_url");
    const telefone = form.get("telefone_publico");
    const siteUrl = typeof site === "string" && site.trim() ? linkSiteLoja(site.trim()) : null;
    const telefonePublico = telefoneComercialDigitado(telefone);
    const sobre = String(form.get("sobre") ?? "").trim();
    const entrega = String(form.get("faz_entrega") ?? "");
    const entregaObs = String(form.get("entrega_obs") ?? "").replace(/\s+/g, " ").trim();
    const formas = form.getAll("formas_pagamento").map((f) => String(f).trim()).filter(Boolean);
    const { horarios, erro: erroHorario } = lerHorarios(String(form.get("horarios") ?? ""));

    const campos: Record<string, string> = {};
    if (!["", "sim", "nao"].includes(entrega)) campos.faz_entrega = "Escolha uma opção de entrega.";
    if (endereco.length > 160) campos.endereco = "O endereço pode ter até 160 letras.";
    const lat = latTxt ? Number(latTxt) : null;
    const lng = lngTxt ? Number(lngTxt) : null;
    if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
        (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) {
      campos.localizacao = "A localização não ficou certa. Toque de novo em \"Usar minha localização\".";
    }
    if (instagram && (!/^[a-z0-9._]{1,30}$/.test(instagram) || instagram.includes(".."))) {
      campos.instagram = "Instagram inválido. Escreva só o nome, ex.: @minhaloja.";
    }
    if (site !== null && (typeof site !== "string" || (site.trim() && !siteUrl))) campos.site_url = "Informe um site válido, incluindo https://.";
    if (telefone !== null && (typeof telefone !== "string" || (telefone.trim() && !telefonePublico))) campos.telefone_publico = "Informe o telefone com DDD.";
    if (sobre.length > 1500) campos.sobre = "O texto \"Sobre nós\" pode ter até 1500 letras.";
    if (entregaObs.length > 200) campos.entrega_obs = "O recado da entrega pode ter até 200 letras.";
    if (erroHorario) campos.horarios = erroHorario;
    const opcoes = await opcoesVitrine(v.microrregiao_id);
    if (formas.some((f) => !opcoes.formasPagamento.includes(f) && !v.formas_pagamento.includes(f))) {
      campos.formas_pagamento = "Escolha as formas de pagamento da lista.";
    }
    if (Object.keys(campos).length) return { erro: "Confira os campos marcados.", campos };

    const db = await createClient();
    const { data, error } = await db
      .from("vitrines_lojas")
      .update({
        endereco: endereco || null,
        lat: lat === null ? null : Math.round(lat * 1e6) / 1e6,
        lng: lng === null ? null : Math.round(lng * 1e6) / 1e6,
        horarios,
        instagram: instagram || null,
        ...(site !== null ? { site_url: siteUrl } : {}),
        ...(telefone !== null ? { telefone_publico: telefonePublico } : {}),
        sobre: sobre || null,
        // a descrição curta (etapa 2) acompanha o "Sobre nós": o banco copia (só o texto que passou no filtro)
        formas_pagamento: [...new Set(formas)],
        faz_entrega: entrega === "sim" ? true : entrega === "nao" ? false : null,
        entrega_obs: entregaObs || null,
      })
      .eq("id", v.id)
      .eq("dono_id", userId).select("id").maybeSingle();
    if (error) {
      const e = traduzirErro(error);
      return { erro: e.mensagem, campos: e.campo ? { [e.campo]: e.mensagem } : undefined };
    }
    if (data?.id !== v.id) return { erro: "As informações não foram atualizadas. Recarregue a página e tente novamente." };
    atualizar(v.slug);
    return { ok: true };
  } catch {
    return { erro: "Não foi possível confirmar o salvamento. Seus dados continuam preenchidos; tente novamente." };
  }
}

/* -------------------------------- Seções -------------------------------- */

function nomeSecao(t: string): string | null {
  const n = t.replace(/\s+/g, " ").trim();
  return n.length >= 2 && n.length <= 40 ? n : null;
}

const NOME_INVALIDO = { ok: false as const, erro: { mensagem: "Escreva o nome da seção (de 2 a 40 letras).", campo: "nome" } };
const SECAO_NAO_ACHOU = { ok: false as const, erro: { mensagem: "Seção não encontrada." } };

export async function criarSecao(nome: string): Promise<Resultado<string>> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  const n = nomeSecao(String(nome ?? ""));
  if (!n) return NOME_INVALIDO;
  const db = await createClient();
  const { data, error } = await db.from("loja_secoes").insert({ vitrine_id: v.id, nome: n }).select("id").single();
  if (error || !data) return { ok: false, erro: traduzirErro(error) };
  atualizar(v.slug);
  return { ok: true, dados: String((data as { id: string }).id) };
}

export async function renomearSecao(id: string, nome: string): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  if (!ehUuid(id)) return SECAO_NAO_ACHOU;
  const n = nomeSecao(String(nome ?? ""));
  if (!n) return NOME_INVALIDO;
  const db = await createClient();
  const { data, error } = await db.from("loja_secoes").update({ nome: n }).eq("id", id).eq("vitrine_id", v.id).select("id");
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!data?.length) return SECAO_NAO_ACHOU;
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}

/** Mostrar ou esconder a seção na vitrine (nada é apagado). */
export async function mostrarSecao(id: string, ativa: boolean): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  if (!ehUuid(id)) return SECAO_NAO_ACHOU;
  const db = await createClient();
  const { data, error } = await db.from("loja_secoes").update({ ativa: !!ativa }).eq("id", id).eq("vitrine_id", v.id).select("id");
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!data?.length) return SECAO_NAO_ACHOU;
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}

export async function apagarSecao(id: string): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  if (!ehUuid(id)) return SECAO_NAO_ACHOU;
  const db = await createClient();
  const { data, error } = await db.from("loja_secoes").delete().eq("id", id).eq("vitrine_id", v.id).select("id");
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!data?.length) return SECAO_NAO_ACHOU;
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}

/** Sobe ou desce uma seção uma posição. */
export async function moverSecao(id: string, direcao: "subir" | "descer"): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  const ids = (await minhasSecoes(v.id)).map((s) => s.id);
  const i = ids.indexOf(id);
  if (i < 0) return SECAO_NAO_ACHOU;
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return { ok: true, dados: undefined };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const db = await createClient();
  const { error } = await db.rpc("ordenar_secoes", { p_ids: ids });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}

/** Troca a lista de produtos da seção (na ordem da lista). */
export async function definirProdutosSecao(id: string, anuncios: string[]): Promise<Resultado<number>> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  if (!ehUuid(id)) return SECAO_NAO_ACHOU;
  const ids = [...new Set((Array.isArray(anuncios) ? anuncios : []).filter((a) => ehUuid(a)))];
  if (ids.length > 500) return { ok: false, erro: { mensagem: "Escolha menos produtos." } };
  const db = await createClient();
  const { data, error } = await db.rpc("definir_anuncios_secao", { p_secao: id, p_anuncios: ids });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar(v.slug);
  return { ok: true, dados: Number(data ?? ids.length) };
}

/* ------------------------------- Fixados -------------------------------- */

const ANUNCIO_NAO_ACHOU = { ok: false as const, erro: { mensagem: "Anúncio não encontrado." } };

/** Fixa no topo da loja (vai para o fim da fila dos fixados) ou tira do topo. */
export async function fixarNaLoja(anuncioId: string, fixar: boolean): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  if (!ehUuid(anuncioId)) return ANUNCIO_NAO_ACHOU;
  const db = await createClient();
  const { error } = await db.rpc("fixar_anuncio", { p_anuncio: anuncioId, p_fixar: !!fixar });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}

/** Sobe ou desce um produto fixado uma posição. */
export async function moverFixado(anuncioId: string, direcao: "subir" | "descer"): Promise<Resultado> {
  const { userId, v } = await minhaLoja();
  if (!userId) return SEM_LOGIN;
  if (!v) return SO_LOJA;
  const db = await createClient();
  const { data, error: erroLer } = await db
    .from("anuncios")
    .select("id, fixado_na_loja, publicado_em")
    .eq("vitrine_id", v.id)
    .not("fixado_na_loja", "is", null)
    .order("fixado_na_loja")
    .order("publicado_em", { ascending: false });
  if (erroLer) return { ok: false, erro: traduzirErro(erroLer) };
  const ids = (data ?? []).map((a) => String((a as { id: string }).id));
  const i = ids.indexOf(anuncioId);
  if (i < 0) return ANUNCIO_NAO_ACHOU;
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return { ok: true, dados: undefined };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const { error } = await db.rpc("ordenar_fixados", { p_ids: ids });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar(v.slug);
  return { ok: true, dados: undefined };
}
