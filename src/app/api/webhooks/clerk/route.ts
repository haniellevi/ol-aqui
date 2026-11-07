import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { sincronizarPerfil } from "@/lib/perfil";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Webhook do Clerk (configure no painel do Clerk: user.created, user.updated, user.deleted).
 * A assinatura é conferida com CLERK_WEBHOOK_SIGNING_SECRET (svix); sem ela, recusa.
 */
export async function POST(req: NextRequest) {
  let evento;
  try {
    evento = await verifyWebhook(req);
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  try {
    if (evento.type === "user.created" || evento.type === "user.updated") {
      const d = evento.data;
      await sincronizarPerfil({
        id: d.id,
        firstName: d.first_name,
        lastName: d.last_name,
        imageUrl: d.image_url,
        primaryPhoneNumberId: d.primary_phone_number_id,
        phoneNumbers: d.phone_numbers.map((p) => ({
          id: p.id,
          phoneNumber: p.phone_number,
          verification: p.verification ? { status: p.verification.status } : null,
        })),
      });
    } else if (evento.type === "user.deleted" && evento.data.id) {
      // LGPD: conta apagada no Clerk → apaga o perfil (anúncios e vitrine vão junto).
      // Os registros de acesso do Marco Civil ficam em logs_atividade, sem ligação com o perfil.
      const db = supabaseAdmin();
      const { error } = await db.from("perfis").delete().eq("id", evento.data.id);
      if (error) {
        // Tem pagamentos (guardados por obrigação fiscal): anonimiza em vez de apagar.
        await db.from("perfis").update({ nome: "Conta excluída", whatsapp: null, whatsapp_verificado_em: null, avatar_url: null, cidade: null, bairro: null }).eq("id", evento.data.id);
        await db.from("anuncios").update({ status: "pausado" }).in("vitrine_id", (await db.from("vitrines_lojas").select("id").eq("dono_id", evento.data.id)).data?.map((v) => v.id) ?? []);
      }
    }
  } catch (e) {
    console.error("webhook clerk", e);
    return new Response("Erro ao processar", { status: 500 }); // o Clerk tenta de novo
  }
  return new Response("ok");
}
