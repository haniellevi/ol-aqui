"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";
import { centavosDe } from "@/lib/admin/formato";
import { conferirCampos, limpo, slugDe } from "@/lib/admin/regras-cadastros";
import { NOMES_ICONES } from "@/components/ui/icone-categoria";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_CATEGORIAS, linkAdminCategoria } from "@/lib/rotas";

// Tela 9 · Categorias e campos. Tudo pelo token do admin: a RLS (e_admin) barra quem não é.
// O banco confere os campos de novo (validar_campos_categoria + conferir_categoria), recusa apagar
// categoria em uso e grava cada mudança no histórico (registrar_log em logs_atividade).
// As páginas públicas (cadastro, busca, robô) leem as categorias na hora; o revalidate é garantia.

function atualizarTelas(id?: string) {
  revalidatePath(LINK_ADMIN_CATEGORIAS);
  if (id) revalidatePath(linkAdminCategoria(id));
  revalidatePath("/", "layout");
}

type Linha = { id: string; slug: string; pai_id: string | null; ordem: number; tipo_legado: string };

export async function criarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const { supabase } = await exigirAdmin();
    const nome = limpo(form.get("nome"));
    if (nome.length < 2 || nome.length > 60) return { erro: "Escreva o nome da categoria (de 2 a 60 letras)." };
    const icone = String(form.get("icone") ?? "");
    if (icone && !NOMES_ICONES.includes(icone)) return { erro: "Escolha um ícone da lista." };
    const paiId = String(form.get("pai_id") ?? "");
    if (paiId && !ehUuid(paiId)) return { erro: "Categoria principal inválida." };

    const { data: todas, error: erroLer } = await supabase.from("categorias").select("id, slug, pai_id, ordem, tipo_legado");
    if (erroLer) return { erro: traduzirErro(erroLer).mensagem };
    const linhas = (todas ?? []) as Linha[];
    const pai = paiId ? linhas.find((c) => c.id === paiId) : null;
    if (paiId && (!pai || pai.pai_id)) return { erro: "Escolha uma categoria principal para colocar a subcategoria." };

    // endereço único: "outros" já existe? tenta "outros-<mãe>", depois "outros-2"...
    const usados = new Set(linhas.map((c) => c.slug));
    const base = slugDe(nome);
    if (base.length < 2) return { erro: "O nome precisa ter letras ou números." };
    let slug = base;
    if (usados.has(slug) && pai) slug = slugDe(`${base}-${pai.slug}`);
    for (let k = 2; usados.has(slug); k++) slug = `${base.slice(0, 56)}-${k}`;

    const irmas = linhas.filter((c) => (c.pai_id ?? null) === (pai?.id ?? null));
    const ordem = irmas.reduce((m, c) => Math.max(m, c.ordem), 0) + 10;
    const { data, error } = await supabase
      .from("categorias")
      .insert({ slug, nome, icone: icone || null, pai_id: pai?.id ?? null, ordem, tipo_legado: pai?.tipo_legado ?? "geral" })
      .select("id")
      .single();
    if (error) return { erro: traduzirErro(error).mensagem };
    novoId = data.id as string;
    atualizarTelas();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar a categoria." };
  }
  if (!novoId) return { erro: "Erro ao criar a categoria." };
  redirect(linkAdminCategoria(novoId));
}

export async function salvarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    if (!ehUuid(id)) return { erro: "Categoria inválida." };
    const nome = limpo(form.get("nome"));
    if (nome.length < 2 || nome.length > 60) return { erro: "Escreva o nome da categoria (de 2 a 60 letras)." };
    const icone = String(form.get("icone") ?? "");
    if (icone && !NOMES_ICONES.includes(icone)) return { erro: "Escolha um ícone da lista." };

    const { data: atual, error: erroLer } = await supabase
      .from("categorias")
      .select("id, slug, pai_id, ordem, tipo_legado")
      .eq("id", id)
      .maybeSingle<Linha>();
    if (erroLer) return { erro: traduzirErro(erroLer).mensagem };
    if (!atual) return { erro: "Categoria não encontrada. Recarregue a página." };

    const dados: Record<string, unknown> = { nome, icone: icone || null, ativa: form.get("ativa") === "on" };

    // subcategoria: pode mudar de mãe e tem campos e preços
    if (atual.pai_id) {
      const paiId = String(form.get("pai_id") ?? "");
      if (!ehUuid(paiId)) return { erro: "Escolha em qual categoria principal ela fica." };
      if (paiId !== atual.pai_id) {
        const { data: irmas } = await supabase.from("categorias").select("ordem").eq("pai_id", paiId);
        dados.pai_id = paiId;
        dados.ordem = (irmas ?? []).reduce((m, c) => Math.max(m, c.ordem as number), 0) + 10; // vai para o fim da nova mãe
      }
      let precoMin: number | null;
      let precoMax: number | null;
      try {
        precoMin = centavosDe(form.get("preco_min"));
        precoMax = centavosDe(form.get("preco_max"));
      } catch {
        return { erro: "Preço inválido. Use só números, ex.: 1500 ou 1.500,00." };
      }
      if (precoMin != null && precoMax != null && precoMin > precoMax) return { erro: "O preço mínimo precisa ser menor que o máximo." };
      dados.preco_min_centavos = precoMin;
      dados.preco_max_centavos = precoMax;

      let editados: unknown;
      try {
        editados = JSON.parse(String(form.get("campos") ?? "[]"));
      } catch {
        return { erro: "Os campos chegaram num formato inválido. Recarregue a página." };
      }
      const conferidos = conferirCampos(editados);
      if (!conferidos.ok) return { erro: conferidos.erro };
      dados.campos = conferidos.campos;
    }

    const { data, error } = await supabase.from("categorias").update(dados).eq("id", id).select("id");
    if (error) return { erro: traduzirErro(error).mensagem };
    if (!data?.length) return { erro: "Categoria não encontrada. Recarregue a página." };
    atualizarTelas(id);
    return { ok: "Categoria salva. O cadastro de anúncio e a busca já usam a mudança." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Sobe ou desce entre as irmãs (lista da tela). */
export async function moverCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    const direcao = String(form.get("direcao") ?? "");
    if (!ehUuid(id) || (direcao !== "subir" && direcao !== "descer")) return { erro: "Pedido inválido." };
    const { error } = await supabase.rpc("admin_mover_categoria", { p_id: id, p_direcao: direcao });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: "Ordem salva." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao mudar a ordem." };
  }
}

/** Apaga de vez (só sem anúncios, pedidos e subcategorias: o banco recusa as outras e explica). */
export async function apagarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    if (!ehUuid(id)) return { erro: "Categoria inválida." };
    const { data, error } = await supabase.from("categorias").delete().eq("id", id).select("id");
    if (error) {
      if (error.code === "23503") return { erro: "Esta categoria ainda está ligada a anúncios ou pedidos. Esconda em vez de apagar." };
      return { erro: traduzirErro(error).mensagem };
    }
    if (!data?.length) return { erro: "Categoria não encontrada. Recarregue a página." };
    atualizarTelas();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao apagar." };
  }
  redirect(LINK_ADMIN_CATEGORIAS);
}
