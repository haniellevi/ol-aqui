// app/radar/actions.ts
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sincronizarPerfil } from "@/lib/perfil";
import { traduzirErro } from "@/lib/erros";
import { centavosDoTexto, ehUuid } from "@/lib/formato";
import type {
  EnvioFotoProposta,
  ModoContato,
  RespostaCriarPedido,
  RespostaEscolher,
  RespostaProposta,
  RespostaSimples,
} from "@/lib/tipos-radar";

// Ações do Radar. Quem decide tudo é o banco (funções criar_pedido_radar, propor_radar,
// escolher_proposta, fechar_pedido_radar): aqui só arrumamos a entrada e a resposta.
// Os links do WhatsApp são montados aqui, no servidor, só depois que o banco liberou o número.

type ErroBanco = { code?: string; message?: string; details?: string | null } | null;

const SEM_LOGIN = "Entre na sua conta para continuar.";

/** Mensagem do banco para a pessoa. P0002 ("pedido fechado", "prazo acabou") já vem pronta. */
function mensagemDe(e: ErroBanco): { erro: string; campo?: string } {
  if (e?.code === "P0002" && e.message) return { erro: e.message };
  const t = traduzirErro(e);
  return { erro: t.mensagem, campo: t.campo };
}

const linkWa = (numero: string, texto: string) => `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

/** Celular confirmado: a fonte é o Clerk. Atualiza o perfil antes de o banco conferir. */
async function atualizarCelularDoClerk() {
  try {
    const u = await currentUser();
    if (u) await sincronizarPerfil(u);
  } catch {
    // sem a chave secreta ou Clerk fora do ar: vale o que já está no banco
  }
}

export async function criarPedido(entrada: {
  titulo: string;
  detalhes?: string;
  categoriaId?: string | null;
  precoMin?: string;
  precoMax?: string;
  cidade: string;
  modo: ModoContato;
  prazoHoras?: number | null;
}): Promise<RespostaCriarPedido> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  await atualizarCelularDoClerk();

  const db = await createClient();
  const { data, error } = await db.rpc("criar_pedido_radar", {
    p_titulo: String(entrada.titulo ?? "").slice(0, 200),
    p_cidade: String(entrada.cidade ?? "").slice(0, 80),
    p_modo: entrada.modo === "propostas_prazo" ? "propostas_prazo" : "whatsapp_direto",
    p_prazo_horas: entrada.modo === "propostas_prazo" && Number.isInteger(entrada.prazoHoras) ? entrada.prazoHoras : null,
    p_detalhes: entrada.detalhes ? String(entrada.detalhes).slice(0, 1200) : null,
    p_categoria_id: entrada.categoriaId && ehUuid(entrada.categoriaId) ? entrada.categoriaId : null,
    p_preco_min_centavos: centavosDoTexto(entrada.precoMin),
    p_preco_max_centavos: centavosDoTexto(entrada.precoMax),
    p_origem: "site",
  });
  if (error || !data) {
    const m = mensagemDe(error);
    return { ok: false, ...m, precisaCelular: m.campo === "celular" };
  }
  const r = data as { id: string; status: "aberto" | "em_analise" };
  revalidatePath("/radar");
  return { ok: true, id: r.id, status: r.status };
}

/** Prepara o envio da foto da proposta: pasta <usuario>/radar-<pedido>/ (o Storage confere quem pode). */
export async function criarUrlFotoProposta(pedidoId: string, formato: "webp" | "jpg" = "webp"): Promise<EnvioFotoProposta> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(pedidoId)) return { ok: false, erro: "Pedido não encontrado." };
  const db = await createClient();
  const caminho = `${userId}/radar-${pedidoId}/${crypto.randomUUID()}.${formato === "jpg" ? "jpg" : "webp"}`;
  const { data, error } = await db.storage.from("anuncios").createSignedUploadUrl(caminho);
  if (error || !data) return { ok: false, erro: "Não deu para preparar a foto. Confira se este pedido ainda está aberto." };
  const urlPublica = db.storage.from("anuncios").getPublicUrl(caminho).data.publicUrl;
  return { ok: true, urlEnvio: data.signedUrl, urlPublica };
}

export async function enviarProposta(entrada: {
  pedidoId: string;
  anuncioId?: string | null;
  fotoUrl?: string | null;
  preco?: string;
  mensagem?: string;
}): Promise<RespostaProposta> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(entrada.pedidoId)) return { ok: false, erro: "Pedido não encontrado." };

  const db = await createClient();
  const { data, error } = await db
    .rpc("propor_radar", {
      p_pedido_id: entrada.pedidoId,
      p_anuncio_id: entrada.anuncioId && ehUuid(entrada.anuncioId) ? entrada.anuncioId : null,
      p_foto_url: typeof entrada.fotoUrl === "string" && entrada.fotoUrl ? entrada.fotoUrl.slice(0, 500) : null,
      p_preco_centavos: centavosDoTexto(entrada.preco),
      p_mensagem: entrada.mensagem ? String(entrada.mensagem).slice(0, 600) : null,
    })
    .single<{ modo: ModoContato; whatsapp: string | null; mensagem: string; editada: boolean }>();

  if (error || !data) {
    const m = mensagemDe(error);
    // 42501 sem campo = plano/propostas (região e "proposta tirada" têm mensagem própria e não pedem plano)
    const precisaPlano = error?.code === "42501" && /plano/i.test(error.message ?? "");
    return { ok: false, ...m, precisaPlano };
  }
  revalidatePath(`/radar/${entrada.pedidoId}`);
  revalidatePath("/radar");
  if (data.modo === "propostas_prazo") return { ok: true, modo: "propostas_prazo", mensagem: data.mensagem, editada: data.editada };
  if (!data.whatsapp) return { ok: false, erro: "O comprador ainda não confirmou o celular. Tente mais tarde." };
  return { ok: true, modo: "whatsapp_direto", linkWhatsapp: linkWa(data.whatsapp, data.mensagem), editada: data.editada };
}

/** Comprador escolhe uma proposta: o banco confere que o pedido é dele e devolve o WhatsApp da loja. */
export async function escolherProposta(propostaId: string): Promise<RespostaEscolher> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(propostaId)) return { ok: false, erro: "Proposta não encontrada." };
  const db = await createClient();
  const { data, error } = await db.rpc("escolher_proposta", { p_proposta_id: propostaId }).single<{ whatsapp: string; mensagem: string }>();
  if (error || !data?.whatsapp) return { ok: false, erro: mensagemDe(error).erro };
  return { ok: true, linkWhatsapp: linkWa(data.whatsapp, data.mensagem) };
}

/** "Já resolvi" ou "Cancelar pedido". */
export async function fecharPedido(pedidoId: string, motivo: "resolvido" | "cancelado"): Promise<RespostaSimples> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(pedidoId) || (motivo !== "resolvido" && motivo !== "cancelado")) return { ok: false, erro: "Pedido não encontrado." };
  const db = await createClient();
  const { error } = await db.rpc("fechar_pedido_radar", { p_pedido: pedidoId, p_motivo: motivo });
  if (error) return { ok: false, erro: mensagemDe(error).erro };
  revalidatePath(`/radar/pedido/${pedidoId}`);
  revalidatePath("/radar");
  return { ok: true, mensagem: motivo === "resolvido" ? "Que bom! Pedido marcado como resolvido." : "Pedido cancelado." };
}
