"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";
import { limpo } from "@/lib/admin/regras-cadastros";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_CATEGORIAS, LINK_ADMIN_CATEGORIAS_SUGERIDAS } from "@/lib/rotas";

// Decisão sobre as sugestões de categoria. Tudo pelo token do admin: o banco
// (decidir_categorias_sugeridas) confere e_admin, o limite de 3 níveis e se a categoria está no ar,
// move os anúncios e avisa o vendedor no sino. Sucesso volta para a lista com o resumo na URL.

const ACOES = ["aprovar", "juntar", "recusar"] as const;

export async function decidirSugestoes(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  // Sem try: quem não é admin recebe o 404 de exigirAdmin e nada é decidido.
  const { supabase } = await exigirAdmin();

  const acao = String(form.get("acao") ?? "");
  if (!(ACOES as readonly string[]).includes(acao)) return { erro: "Escolha aprovar, juntar ou recusar." };
  const grupos = [...new Set(form.getAll("grupo").map((g) => String(g)).filter((g) => g.length >= 2 && g.length <= 60))];
  if (!grupos.length) return { erro: "Escolha pelo menos um grupo de sugestões." };

  const nome = limpo(form.get("nome"));
  const pai = String(form.get("pai_id") ?? "");
  const categoria = String(form.get("categoria_id") ?? "");
  if (acao === "aprovar") {
    if (nome.length < 2 || nome.length > 60) return { erro: "Escreva o nome da categoria nova (de 2 a 60 letras)." };
    if (!ehUuid(pai)) return { erro: "Escolha onde a categoria nova vai ficar." };
  }
  if (acao === "juntar" && !ehUuid(categoria)) return { erro: "Escolha a categoria que já existe." };

  const { data, error } = await supabase.rpc("decidir_categorias_sugeridas", {
    p_grupos: grupos,
    p_acao: acao,
    p_nome: acao === "aprovar" ? nome : null,
    p_pai: acao === "aprovar" ? pai : null,
    p_categoria: acao === "juntar" ? categoria : null,
  });
  if (error) return { erro: traduzirErro(error).mensagem };

  revalidatePath(LINK_ADMIN_CATEGORIAS_SUGERIDAS);
  revalidatePath(LINK_ADMIN_CATEGORIAS);
  revalidatePath("/", "layout");
  const r = (data ?? {}) as { decididas?: number; movidos?: number; revisar?: number };
  const resumo = new URLSearchParams({
    feito: acao,
    decididas: String(r.decididas ?? 0),
    movidos: String(r.movidos ?? 0),
    revisar: String(r.revisar ?? 0),
  });
  redirect(`${LINK_ADMIN_CATEGORIAS_SUGERIDAS}?${resumo.toString()}`);
}
