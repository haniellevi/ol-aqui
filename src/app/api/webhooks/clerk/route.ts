import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { sincronizarPerfil } from "@/lib/perfil";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Webhook do Clerk (configure no painel do Clerk: user.created, user.updated, user.deleted).
 * A assinatura é conferida com CLERK_WEBHOOK_SIGNING_SECRET (svix); sem ela, recusa.
 *
 * Os eventos podem chegar atrasados, repetidos ou fora de ordem. Por isso o conteúdo do
 * evento não é usado: o usuário é buscado de novo no Clerk e o estado atual vale.
 * Se o Clerk responde 404, a conta já foi apagada e nada é recriado.
 */
export async function POST(req: NextRequest) {
  let evento;
  try {
    evento = await verifyWebhook(req);
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  try {
    const id = evento.data.id;
    if (!id) return new Response("ok");

    if (evento.type === "user.created" || evento.type === "user.updated") {
      const atual = await buscarUsuario(id);
      if (atual) await sincronizarPerfil(atual);
      else await apagarConta(id);
    } else if (evento.type === "user.deleted") {
      // confere que foi apagada mesmo (evento antigo não pode apagar conta ativa)
      if (!(await buscarUsuario(id))) await apagarConta(id);
    }
  } catch (e) {
    console.error("webhook clerk", e);
    return new Response("Erro ao processar", { status: 500 }); // o Clerk tenta de novo
  }
  return new Response("ok");
}

async function buscarUsuario(id: string) {
  try {
    return await (await clerkClient()).users.getUser(id);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

/** LGPD: conta apagada no Clerk. Remove o perfil; se houver pagamentos (guarda fiscal), anonimiza. */
async function apagarConta(id: string) {
  const db = supabaseAdmin();
  const ok = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  };

  // Fotos dos anúncios, rascunhos, logo e capa saem do Storage (pasta <id>/ do bucket público).
  await apagarArquivos(db, id);

  const apagou = await db.from("perfis").delete().eq("id", id);
  if (!apagou.error) return;

  // Não deu para apagar (pagamentos ligados à vitrine): tira tudo do ar e anonimiza.
  const vitrines = await db.from("vitrines_lojas").select("id").eq("dono_id", id);
  ok(vitrines);
  const ids = (vitrines.data ?? []).map((v) => v.id);
  if (ids.length) {
    ok(await db.from("anuncios").update({ status: "pausado" }).in("vitrine_id", ids).neq("status", "congelado"));
    ok(await db.from("anuncios").update({ fotos: [] }).in("vitrine_id", ids));
    ok(
      await db
        .from("vitrines_lojas")
        .update({
          status: "suspensa",
          nome: "Loja encerrada",
          descricao: null,
          whatsapp: null,
          cnpj: null,
          logo_url: null,
          capa_url: null,
          // dados da vitrine completa (endereço exato, localização, redes, textos, horários, banner)
          sobre: null,
          endereco: null,
          lat: null,
          lng: null,
          instagram: null,
          entrega_obs: null,
          horarios: null,
          formas_pagamento: [],
          faz_entrega: null,
          banner_tipo: "modelo",
          banner_url: null,
          banner_moderado_url: null,
          banner_moderado_motivo: null,
          banner_moderado_em: null,
        })
        .in("id", ids),
    );
    // seções próprias (os produtos delas saem junto, em cascata)
    ok(await db.from("loja_secoes").delete().in("vitrine_id", ids));
  }
  ok(await db.from("radar_pedidos").update({ status: "encerrado" }).eq("comprador_id", id).in("status", ["aberto", "em_analise"]));
  ok(await db.from("perfis_verificacoes").delete().eq("perfil_id", id));
  ok(await db.from("favoritos").delete().eq("usuario_id", id));
  ok(await db.from("notificacoes").delete().eq("usuario_id", id)); // avisos do Radar
  ok(
    await db
      .from("perfis")
      .update({ nome: "Conta excluída", whatsapp: null, whatsapp_verificado_em: null, avatar_url: null, cidade: null, bairro: null })
      .eq("id", id),
  );
}

/** Apaga todos os arquivos da pasta <id>/ do bucket "anuncios" (subpastas incluídas). */
async function apagarArquivos(db: ReturnType<typeof supabaseAdmin>, id: string) {
  if (!/^[A-Za-z0-9_]+$/.test(id)) return; // id do Clerk (user_...): nunca apaga fora da pasta da pessoa
  const bucket = db.storage.from("anuncios");
  const LOTE = 1000;
  const pastas = [id];
  const arquivos: string[] = [];
  while (pastas.length) {
    const pasta = pastas.pop()!;
    for (let inicio = 0; ; inicio += LOTE) {
      const { data, error } = await bucket.list(pasta, { limit: LOTE, offset: inicio });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        const caminho = `${pasta}/${item.name}`;
        if (item.id) arquivos.push(caminho);
        else pastas.push(caminho); // sem id = subpasta
      }
      if ((data?.length ?? 0) < LOTE) break;
    }
  }
  for (let i = 0; i < arquivos.length; i += LOTE) {
    const { error } = await bucket.remove(arquivos.slice(i, i + LOTE));
    if (error) throw new Error(error.message);
  }
}
