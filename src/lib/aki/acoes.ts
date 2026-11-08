"use server";
// Ações que a PESSOA dispara tocando num botão da folha do Aki (nunca a IA sozinha).
// Todas usam o cliente com a sessão dela: a RLS e as funções do banco conferem tudo de novo.
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { validarPedidoRadar, ehId } from "@/lib/aki/validar";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { salvarFotos } from "@/app/(conta)/anunciar/actions";

export type RespostaAcao = { ok: true; mensagem: string } | { ok: false; erro: string; link?: { rotulo: string; href: string } };

const SEM_LOGIN: RespostaAcao = { ok: false, erro: "Entre na sua conta para continuar.", link: { rotulo: "Entrar", href: "/entrar" } };

/** Joinha (1), não joinha (-1) ou tirar (0) numa resposta do Aki. */
export async function avaliarResposta(mensagemId: number, nota: -1 | 0 | 1, comentario?: string | null): Promise<RespostaAcao> {
  const { userId } = await auth();
  if (!userId) return SEM_LOGIN;
  if (!Number.isSafeInteger(mensagemId) || mensagemId <= 0 || ![-1, 0, 1].includes(nota)) return { ok: false, erro: "Avaliação inválida." };
  const db = await createClient();
  const { error } = await db.rpc("robo_avaliar", {
    p_mensagem_id: mensagemId,
    p_nota: nota,
    p_comentario: typeof comentario === "string" ? comentario.slice(0, 500) : null,
  });
  if (error) return { ok: false, erro: traduzirErro(error).mensagem };
  return { ok: true, mensagem: nota === 0 ? "Avaliação tirada." : "Obrigado! Isso ajuda o Aki a melhorar." };
}

/**
 * "Usar esta foto no anúncio": põe no rascunho a foto que a pessoa mandou ao Aki (já enviada ao
 * Storage pelo navegador com criarUrlEnvioFoto). Só rascunho dela; salvarFotos confere o endereço.
 */
export async function adicionarFotoRascunho(anuncioId: string, url: string): Promise<RespostaAcao> {
  const { userId } = await auth();
  if (!userId) return SEM_LOGIN;
  if (!ehId(anuncioId) || typeof url !== "string") return { ok: false, erro: "Anúncio não encontrado." };
  const a = await meuAnuncio(anuncioId);
  if (!a || a.status !== "rascunho") return { ok: false, erro: "Anúncio não encontrado." };
  const fotos = a.fotos ?? [];
  if (fotos.includes(url)) return { ok: true, mensagem: "A foto já está no anúncio." };
  const r = await salvarFotos(anuncioId, [...fotos, url]);
  if (!r.ok) return { ok: false, erro: r.erro.mensagem };
  return { ok: true, mensagem: "Foto guardada no anúncio." };
}

/** LGPD: apaga todas as conversas da pessoa com o Aki (o uso sem texto continua contando no limite). */
export async function apagarMinhasConversas(): Promise<RespostaAcao> {
  const { userId } = await auth();
  if (!userId) return SEM_LOGIN;
  const db = await createClient();
  const { error } = await db.from("robo_conversas").delete().eq("usuario_id", userId);
  if (error) return { ok: false, erro: traduzirErro(error).mensagem };
  revalidatePath("/minha-conta/privacidade");
  return { ok: true, mensagem: "Pronto. Suas conversas com o Aki foram apagadas." };
}

/**
 * "Confirmar pedido no Radar": cria o pedido que o Aki preparou (a pessoa tocou no botão).
 * Os dados vêm da resposta guardada no banco (não do navegador) e o botão vale uma vez só:
 * robo_marcar_acao marca a ação como usada antes de criar o pedido e desfaz a marca se falhar.
 */
export async function confirmarPedidoRadar(mensagemId: number, indice: number): Promise<RespostaAcao> {
  const { userId } = await auth();
  if (!userId) return SEM_LOGIN;
  if (!Number.isSafeInteger(mensagemId) || mensagemId <= 0 || !Number.isInteger(indice) || indice < 0 || indice > 9) {
    return { ok: false, erro: "Pedido não encontrado." };
  }

  const db = await createClient();
  const [{ data: confirmado }, { data: perfil }] = await Promise.all([
    db.rpc("whatsapp_confirmado"),
    db.from("perfis").select("microrregiao_id").eq("id", userId).maybeSingle(),
  ]);
  if (confirmado !== true) {
    return { ok: false, erro: "Confirme seu celular antes de pedir no Radar.", link: { rotulo: "Confirmar meu celular", href: "/minha-conta/dados" } };
  }
  if (!perfil?.microrregiao_id) return { ok: false, erro: "Termine seu cadastro antes de pedir no Radar.", link: { rotulo: "Meus dados", href: "/minha-conta/dados" } };

  const { data: dados, error: erroMarca } = await db.rpc("robo_marcar_acao", { p_mensagem_id: mensagemId, p_indice: indice, p_usada: true });
  if (erroMarca) {
    if (erroMarca.code === "23505") return { ok: true, mensagem: "Esse pedido já foi enviado ao Radar." };
    return { ok: false, erro: traduzirErro(erroMarca).mensagem };
  }
  const desfazer = () => db.rpc("robo_marcar_acao", { p_mensagem_id: mensagemId, p_indice: indice, p_usada: false });
  const v = validarPedidoRadar(dados);
  if (!v.ok) {
    await desfazer();
    return { ok: false, erro: v.erro };
  }

  // Mesma função do formulário /radar/pedir: celular, cidade da região, limites e moderação no banco
  const { data, error } = await db.rpc("criar_pedido_radar", {
    p_titulo: v.dados.titulo,
    p_cidade: v.dados.cidade,
    p_modo: "whatsapp_direto",
    p_detalhes: v.dados.detalhes,
    p_preco_max_centavos: v.dados.preco_max_centavos,
    p_urgencia: v.dados.urgencia,
    p_categoria: v.dados.categoria,
    p_origem: "aki",
  });
  const criado = data as { id: string; status: string } | null;
  if (error || !criado) {
    await desfazer();
    return { ok: false, erro: error?.code === "P0002" && error.message ? error.message : traduzirErro(error).mensagem };
  }
  revalidatePath("/radar");
  return {
    ok: true,
    mensagem:
      criado.status === "em_analise"
        ? "Recebemos seu pedido. Ele passa por uma conferência rápida antes de ir para o Radar."
        : "Pedido no Radar! As lojas da região vão te chamar no WhatsApp.",
  };
}
