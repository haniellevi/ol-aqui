"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { idUsuarioValido, motivoForm, telefoneForm, textoForm } from "@/lib/admin/gestao";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { EstadoForm } from "@/lib/admin/estado";

function atualizar() { revalidatePath("/", "layout"); }

export async function salvarUsuario(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), motivo = motivoForm(form);
    const nome = textoForm(form, "nome"), regiao = textoForm(form, "microrregiao_id"), tipo = textoForm(form, "tipo_pessoa");
    if (!idUsuarioValido(id) || !ehUuid(regiao)) return { erro: "Confira o usuário e a região." };
    if (nome.length < 2 || nome.length > 120 || !["pf", "pj"].includes(tipo)) return { erro: "Confira o nome e o tipo de pessoa." };
    const { error } = await supabase.rpc("admin_salvar_usuario", {
      p_id: id, p_versao: textoForm(form, "versao"), p_motivo: motivo,
      p_dados: { nome, microrregiao_id: regiao, tipo_pessoa: tipo, cidade: textoForm(form, "cidade") || null,
        bairro: textoForm(form, "bairro") || null, whatsapp: telefoneForm(form, "whatsapp"), avatar_url: textoForm(form, "avatar_url") || null },
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: "Cadastro atualizado. Se o WhatsApp mudou, o titular precisará confirmar o novo número." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível salvar o cadastro." };
  }
}

export async function alterarAcesso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirAdmin();
  let id = "", motivo = "", operacao = "";
  try {
    id = textoForm(form, "id"); motivo = motivoForm(form); operacao = textoForm(form, "operacao");
    if (!idUsuarioValido(id) || !["email", "senha"].includes(operacao)) return { erro: "Escolha uma alteração válida." };
    const email = textoForm(form, "email").toLowerCase();
    // Não normaliza a senha: espaços podem fazer parte dela.
    const senha = form.get("senha");
    if (operacao === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || form.get("confirmar") !== "on"))
      return { erro: "Confira o e-mail e confirme que verificou a identidade do titular e o novo endereço." };
    if (operacao === "senha" && (typeof senha !== "string" || senha.length < 8 || senha.length > 128 || senha !== form.get("repetir_senha")))
      return { erro: "Digite a mesma senha nos dois campos, com 8 a 128 caracteres." };
    const { error } = await supabase.rpc("admin_registrar_acesso", {
      p_id: id, p_acao: operacao === "email" ? "email_solicitado" : "senha_solicitada", p_motivo: motivo,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    const clerk = await clerkClient();
    if (operacao === "email") {
      const u = await clerk.users.getUser(id);
      const existente = u.emailAddresses.find(e => e.emailAddress.toLowerCase() === email);
      if (existente) await clerk.emailAddresses.updateEmailAddress(existente.id, { verified: true, primary: true });
      else await clerk.emailAddresses.createEmailAddress({ userId: id, emailAddress: email, verified: true, primary: true });
    } else {
      await clerk.users.updateUser(id, { password: senha as string, signOutOfOtherSessions: true });
    }
    const registro = await supabase.rpc("admin_registrar_acesso", {
      p_id: id, p_acao: operacao === "email" ? "email_concluido" : "senha_concluida", p_motivo: motivo,
    });
    atualizar();
    if (registro.error) return { ok: "Acesso alterado. O histórico contém a solicitação, mas o registro da conclusão está indisponível." };
    return { ok: operacao === "email" ? "E-mail principal atualizado. Os demais endereços da conta foram preservados." : "Senha atualizada e sessões anteriores encerradas." };
  } catch (e) {
    unstable_rethrow(e);
    if (idUsuarioValido(id) && motivo.length >= 3 && ["email", "senha"].includes(operacao)) {
      try { await supabase.rpc("admin_registrar_acesso", { p_id: id, p_acao: "acesso_falhou", p_motivo: motivo }); }
      catch { /* A solicitação anterior permanece; a indisponibilidade não expõe dados do provedor. */ }
    }
    return { erro: "Não foi possível concluir a alteração. Confira os dados atuais antes de tentar novamente. O e-mail pode estar em uso ou a senha pode não atender à política de segurança." };
  }
}

export async function bloquearUsuario(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), motivo = motivoForm(form), acao = textoForm(form, "operacao");
    if (!idUsuarioValido(id) || !["bloquear", "desbloquear"].includes(acao)) return { erro: "Operação inválida." };
    // A regra no banco preserva a própria conta e os administradores.
    // O bloqueio é imediato para tokens existentes e novas sessões no site.
    const { error } = await supabase.rpc("admin_bloquear_usuario", { p_id: id, p_bloquear: acao === "bloquear", p_motivo: motivo });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: acao === "bloquear" ? "Acesso ao site bloqueado. As lojas e os anúncios continuam com a situação atual; gerencie-os na ficha da loja." : "Acesso ao site liberado." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível alterar o acesso." };
  }
}
