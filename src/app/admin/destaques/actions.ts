"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { centavosDe, inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";
import { ehSlugAnuncio, ehUuid, idDoLinkAnuncio } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";
import { apagarCobrancaDoPedido } from "@/lib/cobranca-destaque";
import type { SlugDestaque } from "@/lib/tipos-destaques";

// Tela 10 · Destaques. Tudo pelo token do admin: a RLS (e_admin) barra quem não é,
// e os gatilhos registrar_log gravam cada mudança no histórico (logs_atividade).

const TIPOS: readonly SlugDestaque[] = ["subir", "busca", "home", "loja"];

function atualizarTelas() {
  revalidatePath("/admin/destaques");
  revalidatePath("/", "layout");
}

export async function salvarTipoDestaque(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const slug = String(form.get("slug")) as SlugDestaque;
    if (!TIPOS.includes(slug)) return { erro: "Tipo inválido." };
    const nome = String(form.get("nome") ?? "").trim();
    if (nome.length < 2) return { erro: "Dê um nome ao destaque." };
    const preco = centavosDe(form.get("preco"));
    if (preco == null) return { erro: "Digite o preço (0 = grátis)." };
    const dias = slug === "subir" ? null : inteiroOuNulo(form.get("dias"));
    if (slug !== "subir" && (!dias || dias < 1 || dias > 365)) return { erro: "Os dias devem ficar entre 1 e 365." };
    const vagas = inteiroOuNulo(form.get("vagas"));
    if (vagas !== null && (vagas < 1 || vagas > 1000)) return { erro: "Vagas entre 1 e 1000 (vazio = sem limite)." };

    const { error } = await supabase
      .from("destaque_tipos")
      .update({
        nome,
        descricao: String(form.get("descricao") ?? "").trim().slice(0, 200) || null,
        preco_centavos: preco,
        dias,
        vagas_por_regiao: vagas,
        ativo: form.get("ativo") === "on",
        ordem: inteiroOuNulo(form.get("ordem")) ?? 0,
        atualizado_por: userId,
      })
      .eq("slug", slug);
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: "Salvo. Vale para os próximos pedidos." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Créditos grátis por mês: um campo por plano × tipo ("c:<plano>:<tipo>"). Vazio = 0. */
export async function salvarCreditosDestaque(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const linhas: { plano_codigo: string; tipo: SlugDestaque; quantidade_mes: number; atualizado_por: string }[] = [];
    for (const [chave, valor] of form.entries()) {
      const m = /^c:([a-z0-9_]{2,30}):(subir|busca|home|loja)$/.exec(chave);
      if (!m) continue;
      const n = inteiroOuNulo(valor) ?? 0;
      if (n > 1000) return { erro: "No máximo 1000 por mês." };
      linhas.push({ plano_codigo: m[1], tipo: m[2] as SlugDestaque, quantidade_mes: n, atualizado_por: userId });
    }
    if (!linhas.length) return { erro: "Nada para salvar." };
    // grava só o que mudou (o histórico fica limpo)
    const { data: atuais } = await supabase.from("destaque_creditos_plano").select("plano_codigo, tipo, quantidade_mes");
    const antes = new Map((atuais ?? []).map((c) => [`${c.plano_codigo}:${c.tipo}`, c.quantidade_mes as number]));
    const mudou = linhas.filter((l) => (antes.get(`${l.plano_codigo}:${l.tipo}`) ?? 0) !== l.quantidade_mes);
    if (!mudou.length) return { ok: "Nada mudou." };
    const { error } = await supabase.from("destaque_creditos_plano").upsert(mudou, { onConflict: "plano_codigo,tipo" });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: `Créditos salvos (${mudou.length} ${mudou.length === 1 ? "mudança" : "mudanças"}).` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Destaque de cortesia: ativa na hora e fica no histórico com o motivo. */
export async function concederCortesia(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const tipo = String(form.get("tipo")) as SlugDestaque;
    if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo." };
    const alvo = String(form.get("alvo") ?? "").trim();
    if (!alvo) return { erro: tipo === "loja" ? "Digite o endereço da loja." : "Cole o link do anúncio." };
    let anuncioId: string | null = null;
    let vitrineId: string | null = null;
    if (tipo === "loja") {
      const slug = alvo.replace(/^.*\/loja\//, "").replace(/[/?#].*$/, "").toLowerCase();
      const { data } = await supabase.from("vitrines_lojas").select("id").eq("slug", slug).eq("tipo", "loja").maybeSingle();
      if (!data) return { erro: "Loja não encontrada. Use o endereço dela (ex.: /loja/nome)." };
      vitrineId = data.id as string;
    } else {
      // Aceita o link antigo (/anuncio/<id>-<titulo>), o curto (/anuncio/<slug>) ou só o id.
      const trecho = alvo.replace(/^.*\/anuncio\//, "").replace(/[/?#].*$/, "");
      if (ehUuid(alvo)) anuncioId = alvo.toLowerCase();
      else if (idDoLinkAnuncio(trecho)) anuncioId = idDoLinkAnuncio(trecho);
      else if (ehSlugAnuncio(trecho)) {
        const { data } = await supabase.rpc("anuncio_id_por_slug", { p_slug: trecho });
        anuncioId = typeof data === "string" ? data : null;
      }
      if (!anuncioId) return { erro: "Link do anúncio inválido." };
    }
    const dias = inteiroOuNulo(form.get("dias"));
    const { error } = await supabase.rpc("conceder_destaque_cortesia", {
      p_tipo: tipo,
      p_anuncio_id: anuncioId,
      p_vitrine_id: vitrineId,
      p_dias: dias,
      p_motivo: String(form.get("motivo") ?? "").trim(),
      p_ignorar_vagas: form.get("ignorar_vagas") === "on",
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: "Cortesia ativada." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao dar a cortesia." };
  }
}

export async function cancelarDestaqueAdmin(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id"));
    if (!ehUuid(id)) return { erro: "Destaque inválido." };
    const { data: antes } = await supabase
      .from("destaques")
      .select("pagamento_id, status, pagamentos(status, asaas_cobranca_id)")
      .eq("id", id)
      .maybeSingle<{ pagamento_id: string | null; status: string; pagamentos: { status: string; asaas_cobranca_id: string | null } | null }>();
    const { error } = await supabase.rpc("cancelar_destaque", { p_destaque_id: id, p_motivo: String(form.get("motivo") ?? "").trim() || null });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    // Pedido que esperava pagamento: apaga a cobrança no Asaas para o Pix antigo não ser pago.
    // (Se for pago assim mesmo, o banco não liga o destaque e marca para devolver o dinheiro.)
    if (antes?.status === "aguardando_pagamento" && antes.pagamentos?.status === "pendente" && antes.pagamentos.asaas_cobranca_id) {
      const apagou = await apagarCobrancaDoPedido({ pagamento_id: antes.pagamento_id });
      return apagou
        ? { ok: "Pedido cancelado e cobrança apagada no Asaas." }
        : { ok: "Pedido cancelado. Não deu para apagar a cobrança no Asaas: apague lá para ninguém pagar por engano." };
    }
    return { ok: "Destaque cancelado." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao cancelar." };
  }
}

/** Exceção por região: preço e/ou dias de um tipo numa microrregião (vazio = usa o do tipo). */
export async function salvarPrecoRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const tipo = String(form.get("tipo")) as SlugDestaque;
    if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo." };
    const regiao = String(form.get("microrregiao_id") ?? "");
    if (!ehUuid(regiao)) return { erro: "Escolha a região." };
    const textoPreco = String(form.get("preco") ?? "").trim();
    const preco = textoPreco ? centavosDe(textoPreco) : null;
    if (textoPreco && preco == null) return { erro: "Preço inválido (0 = grátis)." };
    const dias = tipo === "subir" ? null : inteiroOuNulo(form.get("dias"));
    if (dias !== null && (dias < 1 || dias > 365)) return { erro: "Os dias devem ficar entre 1 e 365." };
    if (preco == null && dias == null) return { erro: "Digite o preço ou os dias desta região." };
    const { error } = await supabase
      .from("destaque_precos_regiao")
      .upsert(
        { tipo, microrregiao_id: regiao, preco_centavos: preco, dias, atualizado_por: userId },
        { onConflict: "tipo,microrregiao_id" },
      );
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: "Exceção salva. Vale para os próximos pedidos dessa região." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function removerPrecoRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id"));
    if (!ehUuid(id)) return { erro: "Exceção inválida." };
    const { error } = await supabase.from("destaque_precos_regiao").delete().eq("id", id);
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas();
    return { ok: "Exceção removida." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao remover." };
  }
}
