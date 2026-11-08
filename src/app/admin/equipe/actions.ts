"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { buscarContas } from "@/lib/dados/equipe";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_EQUIPE } from "@/lib/rotas";
import { ehPapel, type ContaEncontrada } from "@/lib/tipos-equipe";

// Tela 14 · Equipe e permissões (só administrador). Quem confere tudo é o banco: equipe_salvar e
// equipe_desativar recusam quem não é administrador, mudar a si mesmo e ficar sem administrador.
// Cada mudança vai para logs_atividade (gatilho na tabela equipe e em perfis).

export type EstadoBusca = { contas?: ContaEncontrada[]; erro?: string; aviso?: string; termo?: string } | null;
export type EstadoEquipe = { ok?: string; erro?: string } | null;

const USUARIO = /^user_[A-Za-z0-9]+$/;

export async function buscarConta(_: EstadoBusca, form: FormData): Promise<EstadoBusca> {
  try {
    const { supabase } = await exigirAdmin();
    const termo = String(form.get("q") ?? "").trim();
    if (termo.length < 3) return { erro: "Digite o celular com DDD ou o e-mail da pessoa.", termo };
    const r = await buscarContas(supabase, termo);
    if (r.erro) return { erro: r.erro, termo };
    if (r.emailIndisponivel) return { erro: "A busca por e-mail não está funcionando agora. Tente pelo celular.", termo };
    if (r.contas.length === 0) {
      return { contas: [], aviso: "Nenhuma conta encontrada. A pessoa precisa entrar no OLAKI uma vez antes.", termo };
    }
    return { contas: r.contas, termo };
  } catch (e) {
    unstable_rethrow(e); // sessão vencida (redirect) ou quem saiu da equipe (404) não viram texto de erro
    return { erro: e instanceof Error ? e.message : "Não deu para buscar agora." };
  }
}

export async function salvarMembro(_: EstadoEquipe, form: FormData): Promise<EstadoEquipe> {
  try {
    const { supabase } = await exigirAdmin();
    const usuario = String(form.get("usuario") ?? "");
    const papel = String(form.get("papel") ?? "");
    const regiao = String(form.get("regiao") ?? "");
    const observacao = String(form.get("observacao") ?? "").trim().slice(0, 300);
    if (!USUARIO.test(usuario)) return { erro: "Conta não encontrada." };
    if (!ehPapel(papel)) return { erro: "Escolha o papel." };
    if (papel === "franqueado" && !ehUuid(regiao)) return { erro: "Escolha a região do franqueado." };
    const { error } = await supabase.rpc("equipe_salvar", {
      p_usuario: usuario,
      p_papel: papel,
      p_regiao: papel === "franqueado" ? regiao : null,
      p_observacao: observacao || null,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath(LINK_ADMIN_EQUIPE);
    return { ok: "Pronto. O papel já vale na próxima tela que a pessoa abrir." };
  } catch (e) {
    unstable_rethrow(e); // sessão vencida (redirect) ou quem saiu da equipe (404) não viram texto de erro
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}

export async function desativarMembro(_: EstadoEquipe, form: FormData): Promise<EstadoEquipe> {
  try {
    const { supabase } = await exigirAdmin();
    const usuario = String(form.get("usuario") ?? "");
    if (!USUARIO.test(usuario)) return { erro: "Conta não encontrada." };
    if (form.get("confirmar") !== "sim") return { erro: 'Marque "Sim, tirar da equipe" para confirmar.' };
    const observacao = String(form.get("observacao") ?? "").trim().slice(0, 300);
    const { error } = await supabase.rpc("equipe_desativar", { p_usuario: usuario, p_observacao: observacao || null });
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath(LINK_ADMIN_EQUIPE);
    return { ok: "Pessoa tirada da equipe. Ela perde o acesso ao painel na hora." };
  } catch (e) {
    unstable_rethrow(e); // sessão vencida (redirect) ou quem saiu da equipe (404) não viram texto de erro
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}
