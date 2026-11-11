import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { sincronizarPerfil } from "@/lib/perfil";
import { apagarConta } from "@/lib/conta-exclusao";

/**
 * Webhook do Clerk (configure no painel do Clerk: user.created, user.updated, user.deleted).
 * A assinatura é conferida com CLERK_WEBHOOK_SIGNING_SECRET (svix); sem ela, recusa.
 *
 * Os eventos podem chegar atrasados, repetidos ou fora de ordem. Por isso o conteúdo do
 * evento não é usado: o usuário é buscado de novo no Clerk e o estado atual vale.
 * Se o Clerk responde 404, a conta já foi apagada e nada é recriado.
 *
 * O site não apaga contas na hora: o pedido vai para a lixeira por 30 dias e a limpeza
 * (/api/interno/limpeza) apaga no Clerk. Este webhook termina o trabalho no banco.
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
