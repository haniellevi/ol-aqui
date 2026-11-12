// app/radar/actions.ts
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sincronizarPerfil } from "@/lib/perfil";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { traduzirErro } from "@/lib/erros";
import { centavosDoTexto, ehUuid } from "@/lib/formato";
import { validarPedido, validarProposta, type EntradaPedido, type EntradaProposta } from "@/components/radar/validacao";
import type {
  EnvioFotoProposta,
  ModoContato,
  RespostaCriarPedido,
  RespostaEscolher,
  RespostaProposta,
  RespostaSimples,
  Resultado,
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

function linkWa(numero: unknown, texto: unknown): string | null {
  if (typeof numero !== "string" || typeof texto !== "string") return null;
  const digitos = numero.replace(/\D/g, "");
  return /^55[1-9][0-9][0-9]{8,9}$/.test(digitos) ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : null;
}

/** Celular confirmado: a fonte é o Clerk. Atualiza o perfil antes de o banco conferir. */
async function atualizarCelularDoClerk() {
  const u = await currentUser();
  if (!u) throw new Error(SEM_LOGIN);
  await sincronizarPerfil(u);
}

/** O contato do Radar vem exclusivamente do perfil confirmado. */
async function guardarWhatsappDigitado(userId: string): Promise<{ erro: string; campo?: string; precisaCelular?: boolean } | null> {
  const conta = await meuPerfilEVitrine();
  if (conta?.perfil.id !== userId) return { erro: "Termine seu cadastro antes de pedir no Radar." };
  return conta.perfil.whatsapp && conta.perfil.whatsapp_verificado_em ? null
    : { erro: "Confirme seu WhatsApp para pedir no Radar.", campo: "celular", precisaCelular: true };
}

export async function criarPedido(entrada: EntradaPedido): Promise<RespostaCriarPedido> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  const invalida = validarPedido(entrada);
  if (invalida) return { ok: false, ...invalida };
  try {
    await atualizarCelularDoClerk();
  } catch {
    return { ok: false, erro: "Não conseguimos confirmar seus dados agora. Tente novamente." };
  }
  const semCelular = await guardarWhatsappDigitado(userId);
  if (semCelular) return { ok: false, ...semCelular };

  const db = await createClient();
  const { data, error } = await db.rpc("criar_pedido_radar_site", {
    p_chave: entrada.chaveEnvio,
    p_titulo: String(entrada.titulo ?? "").slice(0, 200),
    p_cidade: entrada.cidade ? String(entrada.cidade).slice(0, 80) : null,
    p_cidades_ids: entrada.cidadesIds && entrada.cidadesIds.length > 0 ? entrada.cidadesIds : null,
    p_visibilidade: entrada.visibilidade,
    p_modo: entrada.modo === "propostas_prazo" ? "propostas_prazo" : "whatsapp_direto",
    p_prazo_horas: entrada.modo === "propostas_prazo" && Number.isInteger(entrada.prazoHoras) ? entrada.prazoHoras : null,
    p_detalhes: entrada.detalhes ? String(entrada.detalhes).slice(0, 1200) : null,
    p_categoria_id: entrada.categoriaId && ehUuid(entrada.categoriaId) ? entrada.categoriaId : null,
    p_preco_min_centavos: centavosDoTexto(entrada.precoMin),
    p_preco_max_centavos: centavosDoTexto(entrada.precoMax),
  });
  if (error || !data) {
    const m = mensagemDe(error);
    return { ok: false, ...m, precisaCelular: m.campo === "celular" };
  }
  const r = data as { id: string; status: "aberto" | "em_analise" };
  if (!ehUuid(r.id) || !["aberto", "em_analise"].includes(r.status)) return { ok: false, erro: "Não foi possível confirmar o pedido. Tente novamente." };
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

export async function enviarProposta(entrada: EntradaProposta): Promise<RespostaProposta> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  const invalida = validarProposta(entrada);
  if (invalida) return { ok: false, ...invalida };
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
  revalidatePath(`/radar/pedido/${entrada.pedidoId}`);
  revalidatePath("/radar");
  if (data.modo === "propostas_prazo") return {
    ok: true, modo: "propostas_prazo", editada: data.editada,
    mensagem: "Sua proposta está disponível. O comprador já pode comparar as ofertas e escolher com quem falar.",
  };
  const linkWhatsapp = data.modo === "whatsapp_direto" ? linkWa(data.whatsapp, data.mensagem) : null;
  if (!linkWhatsapp) return { ok: false, erro: "Não foi possível confirmar o contato do comprador. Atualize o pedido e tente novamente." };
  return { ok: true, modo: "whatsapp_direto", linkWhatsapp, editada: data.editada };
}

/** Comprador escolhe uma proposta: o banco confere que o pedido é dele e devolve o WhatsApp da loja. */
export async function escolherProposta(propostaId: string): Promise<RespostaEscolher> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(propostaId)) return { ok: false, erro: "Proposta não encontrada." };
  const db = await createClient();
  const { data, error } = await db.rpc("escolher_proposta", { p_proposta_id: propostaId }).single<{ whatsapp: string; mensagem: string }>();
  if (error || !data?.whatsapp) return { ok: false, erro: mensagemDe(error).erro };
  revalidatePath("/radar/pedido/[id]", "page");
  const linkWhatsapp = linkWa(data.whatsapp, data.mensagem);
  if (!linkWhatsapp) return { ok: false, erro: "O contato da loja está indisponível. Tente novamente mais tarde." };
  revalidatePath("/radar");
  return { ok: true, linkWhatsapp };
}

/** "Já resolvi" ou "Cancelar pedido". */
export async function fecharPedido(pedidoId: string, motivo: "resolvido" | "cancelado"): Promise<RespostaSimples> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(pedidoId) || (motivo !== "resolvido" && motivo !== "cancelado")) return { ok: false, erro: "Pedido não encontrado." };
  const db = await createClient();
  const { data, error } = await db.rpc("fechar_pedido_radar", { p_pedido: pedidoId, p_motivo: motivo });
  if (error) return { ok: false, erro: mensagemDe(error).erro };
  if (data !== (motivo === "resolvido" ? "atendido" : "encerrado")) return { ok: false, erro: "Não foi possível confirmar o encerramento. Atualize o pedido e tente novamente." };
  revalidatePath(`/radar/pedido/${pedidoId}`);
  revalidatePath(`/radar/${pedidoId}`);
  revalidatePath("/radar");
  return { ok: true, mensagem: motivo === "resolvido" ? "Que bom! Pedido marcado como resolvido." : "Pedido cancelado." };
}

export async function mudarArquivoPedido(pedidoId: string, arquivar: boolean): Promise<RespostaSimples> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(pedidoId) || typeof arquivar !== "boolean") return { ok: false, erro: "Pedido não encontrado." };

  const db = await createClient();
  const { data, error } = await db.rpc("arquivar_pedido_radar", { p_pedido: pedidoId, p_arquivar: arquivar });
  if (error) return { ok: false, erro: mensagemDe(error).erro };
  if (data !== arquivar) return { ok: false, erro: "Não foi possível confirmar a mudança. Atualize o pedido e tente novamente." };

  revalidatePath(`/radar/pedido/${pedidoId}`);
  revalidatePath(`/radar/${pedidoId}`);
  revalidatePath("/radar");
  return { ok: true, mensagem: arquivar ? "Pedido arquivado." : "Pedido retirado do arquivo." };
}

function atualizarPedido(pedidoId: string) {
  revalidatePath(`/radar/pedido/${pedidoId}`);
  revalidatePath(`/radar/${pedidoId}`);
  revalidatePath("/radar");
}

/** Comprador estende o prazo do pedido (o banco confere dono, limite e situação). */
export async function estenderPedido(id: string): Promise<Resultado<{ expiraEm: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(id)) return { ok: false, erro: "Pedido não encontrado." };
  const db = await createClient();
  const { data, error } = await db.rpc("estender_pedido_radar", { p_id: id });
  if (error) return { ok: false, ...mensagemDe(error) };
  if (typeof data !== "string" || Number.isNaN(Date.parse(data))) return { ok: false, erro: "Não foi possível confirmar o novo prazo. Atualize o pedido e tente novamente." };
  atualizarPedido(id);
  return { ok: true, expiraEm: data };
}

/** Comprador resolve o pedido: com uma loja (propostaId) ou "resolvi fora do Olaki" (fora). */
export async function resolverPedido(id: string, propostaId: string | null, fora: boolean): Promise<Resultado<{ mensagem?: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(id) || (propostaId !== null && !ehUuid(propostaId)) || typeof fora !== "boolean") return { ok: false, erro: "Pedido não encontrado." };
  if (propostaId !== null && fora) return { ok: false, erro: "Escolha uma loja ou \"Resolvi fora do Olaki\", não as duas.", campo: "proposta" };
  const db = await createClient();
  const { error } = await db.rpc("resolver_pedido_radar", { p_id: id, p_proposta_id: propostaId, p_fora: fora });
  if (error) return { ok: false, ...mensagemDe(error) };
  atualizarPedido(id);
  return { ok: true };
}

/** Nota do comprador depois de resolver: 1 = deu certo, -1 = não deu. */
export async function avaliarPedido(id: string, nota: 1 | -1): Promise<Resultado<{ mensagem?: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(id) || (nota !== 1 && nota !== -1)) return { ok: false, erro: "Pedido não encontrado." };
  const db = await createClient();
  const { error } = await db.rpc("avaliar_pedido_radar", { p_id: id, p_avaliacao: nota });
  if (error) return { ok: false, ...mensagemDe(error) };
  atualizarPedido(id);
  return { ok: true };
}

/** "Eu sei onde tem": indica um anúncio para o pedido de outra pessoa. */
export async function indicarAnuncio(pedidoId: string, anuncioId: string): Promise<Resultado<{ id: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(pedidoId) || !ehUuid(anuncioId)) return { ok: false, erro: "Pedido ou anúncio não encontrado." };
  const db = await createClient();
  const { data, error } = await db.rpc("indicar_anuncio_radar", { p_pedido: pedidoId, p_anuncio: anuncioId });
  if (error) return { ok: false, ...mensagemDe(error) };
  if (typeof data !== "string" || !ehUuid(data)) return { ok: false, erro: "Não foi possível confirmar a indicação. Tente novamente." };
  atualizarPedido(pedidoId);
  return { ok: true, id: data };
}
