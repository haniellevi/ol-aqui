"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { ehUuid } from "@/lib/formato";
import { erroGestao, idUsuarioValido, motivoForm, telefoneForm, textoForm } from "@/lib/admin/gestao";
import { traduzirErro } from "@/lib/erros";
import { documentoValido } from "@/lib/cpf-cnpj";
import type { EstadoForm } from "@/lib/admin/estado";
import { DIAS_SEMANA, type Horarios } from "@/lib/tipos-vitrine";

export async function salvarLojaAdmin(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), dono = textoForm(form, "dono_id"), motivo = motivoForm(form);
    if ((id && !ehUuid(id)) || !idUsuarioValido(dono)) return { erro: "Confira a loja e o ID do titular." };
    const dados: Record<string, unknown> = {};
    for (const campo of ["nome", "slug", "tipo", "microrregiao_id", "cidade", "bairro", "site_url", "instagram", "descricao", "sobre", "endereco", "entrega_obs", "logo_url", "capa_url", "banner_url", "banner_tipo", "banner_modelo", "banner_cor", "categoria_loja"]) {
      dados[campo] = textoForm(form, campo) || null;
    }
    if (typeof dados.nome !== "string" || dados.nome.length < 2 || dados.nome.length > 80) return { erro: "Nome da loja: use de 2 a 80 caracteres." };
    if (typeof dados.slug !== "string" || !/^[a-z0-9-]{3,60}$/.test(dados.slug)) return { erro: "Endereço da loja: use de 3 a 60 letras minúsculas, números ou hífens." };
    if (!ehUuid(String(dados.microrregiao_id)) || !dados.cidade || !["loja", "pf"].includes(String(dados.tipo))) return { erro: "Confira a região, a cidade e o tipo de cadastro." };
    const cnpj = textoForm(form, "cnpj").replace(/\D/g, "");
    if (cnpj && (cnpj.length !== 14 || !documentoValido(cnpj))) return { erro: "Confira o CNPJ." };
    Object.assign(dados, { dono_id: dono, cnpj: cnpj || null, whatsapp: telefoneForm(form, "whatsapp"), telefone_publico: telefoneForm(form, "telefone_publico") });
    for (const campo of ["lat", "lng", "banner_aki_posicao"]) {
      const valor = textoForm(form, campo);
      if (valor && !Number.isFinite(Number(valor))) return { erro: "Confira os números da localização e da posição do banner." };
      dados[campo] = valor ? Number(valor) : null;
    }
    const horarios: Horarios = {};
    for (const dia of DIAS_SEMANA) {
      const linhas = textoForm(form, `horario_${dia}`);
      if (!linhas) continue;
      const faixas = linhas.split(",").map(f => f.trim().split("-"));
      if (faixas.some(f => f.length !== 2 || !/^\d{2}:\d{2}$/.test(f[0].trim()) || !/^\d{2}:\d{2}$/.test(f[1].trim())))
        return { erro: "Horários: use 08:00-12:00, 14:00-18:00. Deixe vazio nos dias fechados." };
      horarios[dia] = faixas.map(([abre, fecha]) => ({ abre: abre.trim(), fecha: fecha.trim() }));
    }
    dados.horarios = Object.keys(horarios).length ? horarios : null;
    dados.formas_pagamento = textoForm(form, "formas_pagamento").split(",").map(s => s.trim()).filter(Boolean);
    const entrega = textoForm(form, "faz_entrega");
    if (!["", "sim", "nao"].includes(entrega)) return { erro: "Confira a opção de entrega." };
    dados.faz_entrega = entrega === "" ? null : entrega === "sim";
    const { data, error } = await supabase.rpc("admin_salvar_loja", {
      p_id: id || null, p_versao: textoForm(form, "versao") || null, p_dados: dados, p_motivo: motivo,
    });
    if (error) return { erro: erroGestao(error) ?? traduzirErro(error).mensagem };
    revalidatePath("/", "layout");
    if (!id) redirect(`/admin/lojas/${data}`);
    return { ok: "Loja atualizada. Alterações nos dados comerciais podem exigir nova verificação." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar a loja." };
  }
}

export async function excluirLojaAdmin(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), motivo = motivoForm(form);
    if (!ehUuid(id) || form.get("confirmar") !== "on") return { erro: "Confirme que leu o efeito da exclusão." };
    const anuncios = Number(textoForm(form, "anuncios_total")), propostas = Number(textoForm(form, "propostas_total"));
    if (![anuncios, propostas].every(n => Number.isSafeInteger(n) && n >= 0)) return { erro: "Recarregue a ficha para conferir o impacto da exclusão." };
    const { error } = await supabase.rpc("admin_excluir_loja", {
      p_id: id, p_versao: textoForm(form, "versao"), p_confirmacao: textoForm(form, "confirmacao"), p_motivo: motivo,
      p_impacto: { anuncios, propostas },
    });
    if (error) return { erro: erroGestao(error) ?? traduzirErro(error).mensagem };
    revalidatePath("/", "layout");
    redirect("/admin/lojas?excluida=1");
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível excluir a loja." };
  }
}
