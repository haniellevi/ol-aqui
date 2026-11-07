import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// LGPD · "Baixar meus dados": JSON com o que é da pessoa, lido com o cliente dela (RLS).
// Fica de fora o que é interno (ids do gateway de pagamento) e o que é de outras pessoas.
export const dynamic = "force-dynamic";

const COLUNAS_VITRINE =
  "id, tipo, slug, nome, descricao, logo_url, capa_url, whatsapp, cidade, bairro, plano, status, teste_expira_em, plano_expira_em, selo_loja_verificada, criado_em";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Entre na sua conta para continuar.", { status: 401 });

  const db = await createClient();
  const [perfil, vitrine, favoritos, pedidos, conversasAki] = await Promise.all([
    db.rpc("meu_perfil"),
    db.from("vitrines_lojas").select(COLUNAS_VITRINE).eq("dono_id", userId).maybeSingle<{ id: string }>(),
    db.from("favoritos").select("anuncio_id, criado_em").eq("usuario_id", userId).order("criado_em", { ascending: false }),
    db.from("radar_pedidos").select("*").eq("comprador_id", userId).order("criado_em", { ascending: false }),
    db
      .from("robo_conversas")
      .select("id, titulo, criado_em, atualizado_em, robo_mensagens(papel, conteudo, criado_em)")
      .eq("usuario_id", userId)
      .order("criado_em", { ascending: false }),
  ]);
  if (perfil.error) return new Response("Não deu para juntar seus dados agora. Tente de novo.", { status: 500 });

  const vitrineId = vitrine.data?.id;
  const [anuncios, propostas, pagamentos] = vitrineId
    ? await Promise.all([
        db.from("anuncios").select("*").eq("vitrine_id", vitrineId).order("criado_em", { ascending: false }),
        db.from("radar_propostas").select("*").eq("vitrine_id", vitrineId).order("criado_em", { ascending: false }),
        db
          .from("pagamentos")
          .select("id, tipo, plano_codigo, anuncio_id, valor_centavos, forma, status, vencimento, pago_em, criado_em")
          .eq("vitrine_id", vitrineId)
          .order("criado_em", { ascending: false }),
      ])
    : [null, null, null];

  const linhaPerfil = Array.isArray(perfil.data) ? perfil.data[0] ?? null : perfil.data;
  const dados = {
    gerado_em: new Date().toISOString(),
    site: "OLAKI (olaki.com.br)",
    aviso: "Estes são os dados da sua conta no OLAKI. Guarde este arquivo com cuidado: ele tem informações pessoais.",
    perfil: linhaPerfil,
    vitrine: vitrine.data ?? null,
    anuncios: anuncios?.data ?? [],
    propostas_radar_enviadas: propostas?.data ?? [],
    pagamentos: pagamentos?.data ?? [],
    favoritos: favoritos.data ?? [],
    pedidos_radar: pedidos.data ?? [],
    conversas_com_o_aki: conversasAki.data ?? [],
  };

  const dia = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="olaki-meus-dados-${dia}.json"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
