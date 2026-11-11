"use server";
// Vitrine com IA, etapa 5b: o lojista pede a sugestão e decide. O banco confere dono, cota do mês,
// orçamento e o texto que a IA devolveu; ao aceitar, a moderação do anúncio confere o texto novo.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sugerirMelhoriaIA, type PedidoMelhoria } from "@/lib/melhoria-ia";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

const SEM_LOGIN = { ok: false as const, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
const FALHA = { ok: false as const, erro: { mensagem: "A conexão falhou. Tente novamente." } };
const ERROS: Record<string, string> = {
  nao_encontrado: "Só dá para melhorar produtos no ar da sua loja.",
  indisponivel: "A melhoria com IA ainda não está disponível na sua região.",
  ocupado: "Já estamos preparando a sugestão deste produto. Aguarde um pouco e atualize a página.",
  orcamento: "A IA está indisponível agora. Tente de novo mais tarde.",
};

function atualizar(anuncioId: string) {
  revalidatePath(`/minha-conta/loja/melhorar/${anuncioId}`);
  revalidatePath("/minha-conta/loja", "layout");
  revalidatePath("/minha-conta/anuncios");
}

export async function pedirMelhoria(anuncioId: string): Promise<Resultado<{ estado: string }>> {
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Escolha um produto válido." } };
  try {
    const { userId } = await auth();
    if (!userId) return SEM_LOGIN;
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("melhoria_ia_reservar", { p_anuncio: anuncioId, p_usuario: userId });
    if (error || !data || typeof data !== "object") return FALHA;
    const r = data as Record<string, unknown>;
    if (typeof r.erro === "string") {
      if (r.erro === "limite") return { ok: false, erro: { mensagem: `Você já usou as ${Number(r.limite) || 0} melhorias com IA deste mês. No mês que vem tem mais.` } };
      return { ok: false, erro: { mensagem: ERROS[r.erro] ?? "Não foi possível pedir agora. Tente de novo." } };
    }
    const pedido = r as unknown as PedidoMelhoria;
    const a = await sugerirMelhoriaIA(pedido);
    const c = await db.rpc("melhoria_ia_concluir", {
      p_id: pedido.id, p_reserva: pedido.reserva, p_resultado: a.resultado,
      p_custo_usd: a.custo, p_tokens_entrada: a.entrada, p_tokens_saida: a.saida,
    });
    atualizar(anuncioId);
    if (c.error) return FALHA;
    if (c.data !== "pronta") return { ok: false, erro: { mensagem: "A IA não conseguiu responder agora. Tente de novo; esta tentativa não conta no limite." } };
    return { ok: true, dados: { estado: "pronta" } };
  } catch {
    return FALHA;
  }
}

export async function decidirMelhoria(melhoriaId: string, anuncioId: string, aceitar: boolean): Promise<Resultado<{ estado: string }>> {
  if (!ehUuid(melhoriaId) || !ehUuid(anuncioId) || typeof aceitar !== "boolean") return { ok: false, erro: { mensagem: "Escolha uma ação válida." } };
  try {
    const { userId } = await auth();
    if (!userId) return SEM_LOGIN;
    const db = await createClient();
    const { data, error } = await db.rpc("melhoria_ia_decidir", { p_id: melhoriaId, p_aceitar: aceitar });
    if (error) return { ok: false, erro: traduzirErro(error) };
    atualizar(anuncioId);
    if (data === "desatualizada") return { ok: false, erro: { mensagem: "O produto mudou depois da sugestão, então nada foi trocado. Peça uma sugestão nova." } };
    return { ok: true, dados: { estado: String(data) } };
  } catch {
    return FALHA;
  }
}
