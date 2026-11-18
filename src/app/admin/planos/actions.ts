"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, exigirSuperAdmin } from "@/lib/admin/auth";
import { centavosDe, inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";

function lerPlano(form: FormData) {
  const preco = centavosDe(form.get("preco"));
  const dias = inteiroOuNulo(form.get("periodo_dias"));
  return {
    nome: String(form.get("nome") ?? "").trim(),
    descricao: String(form.get("descricao") ?? "").trim() || null,
    publico: String(form.get("publico") ?? "todos"),
    preco_centavos: preco ?? 0,
    periodo_dias: dias ?? 30,
    limite_anuncios: inteiroOuNulo(form.get("limite_anuncios")),
    acesso_radar: form.get("acesso_radar") === "on",
    // Aviso na hora de pedido novo só faz sentido em plano com Radar.
    aviso_radar_na_hora: form.get("aviso_radar_na_hora") === "on" && form.get("acesso_radar") === "on",
    propostas_radar_mes: inteiroOuNulo(form.get("propostas_radar_mes")),
    ordem: inteiroOuNulo(form.get("ordem")) ?? 0,
    ativo: form.get("ativo") === "on",
    // Vitrine da loja (vazio = sem limite). Marcar um plano como recomendado desmarca o outro (gatilho do banco).
    vitrine_foto_fachada: form.get("vitrine_foto_fachada") === "on",
    vitrine_secoes_max: inteiroOuNulo(form.get("vitrine_secoes_max")),
    vitrine_fixados_max: inteiroOuNulo(form.get("vitrine_fixados_max")),
    recomendado: form.get("recomendado") === "on",
  };
}

export async function salvarPlano(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const codigo = String(form.get("codigo"));
    if (codigo === "promocional") return { erro: "Este código é reservado ao plano Promocional." };
    const dados = lerPlano(form);
    if (!dados.nome) return { erro: "Dê um nome ao plano." };
    const { error } = await supabase
      .from("planos")
      .update({ ...dados, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("codigo", codigo);
    if (error) return { erro: error.message };
    revalidatePath("/admin", "layout");
    revalidatePath("/radar");
    revalidatePath("/planos");
    return { ok: "Plano salvo. Vale para novas assinaturas." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function criarPlano(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const codigo = String(form.get("codigo") ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (codigo === "promocional") return { erro: "Este código é reservado ao plano Promocional." };
    if (!/^[a-z0-9_]{2,30}$/.test(codigo)) return { erro: "Código inválido. Use letras, números e _ (ex.: ouro)." };
    const dados = lerPlano(form);
    if (!dados.nome) return { erro: "Dê um nome ao plano." };
    const { error } = await supabase.from("planos").insert({ codigo, ...dados, atualizado_por: userId });
    if (error) return { erro: error.code === "23505" ? "Já existe um plano com esse código." : error.message };
    revalidatePath("/admin/planos");
    revalidatePath("/planos");
    return { ok: `Plano "${dados.nome}" criado.` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar." };
  }
}

export async function salvarPromocional(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  let acesso;
  try {
    acesso = await exigirSuperAdmin();
  } catch {
    return { erro: "Acesso restrito ao administrador master." };
  }

  try {
    const marcado = (nome: string) => form.get(nome) === "on";
    const limite = (habilitado: string, nome: string) => marcado(habilitado) ? inteiroOuNulo(form.get(nome)) : 0;
    const radar = marcado("acesso_radar");
    const { error } = await acesso.supabase
      .from("planos")
      .update({
        limite_anuncios: limite("publicar_anuncios", "limite_anuncios"),
        acesso_radar: radar,
        aviso_radar_na_hora: radar && marcado("aviso_radar_na_hora"),
        propostas_radar_mes: limite("acesso_radar", "propostas_radar_mes"),
        vitrine_foto_fachada: marcado("vitrine_foto_fachada"),
        vitrine_secoes_max: limite("vitrine_secoes", "vitrine_secoes_max"),
        vitrine_fixados_max: limite("vitrine_fixados", "vitrine_fixados_max"),
        atualizado_em: new Date().toISOString(),
        atualizado_por: acesso.userId,
      })
      .eq("codigo", "promocional");
    if (error) return { erro: "Não foi possível salvar os recursos. Confira os limites e tente novamente." };
    revalidatePath("/", "layout");
    return { ok: "Recursos do plano Promocional salvos." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar os recursos." };
  }
}
