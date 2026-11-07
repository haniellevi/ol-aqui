"use server";
// Server Actions do Radar do comprador: fazer o pedido, chamar a loja de uma proposta,
// marcar como resolvido ou encerrar. Tudo com o cliente do usuário: quem barra de verdade
// é o banco (RLS "radar criar", celular confirmado, moderação e gatilhos de proteção).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { lerConfig } from "@/lib/dados/config";
import { traduzirErro } from "@/lib/erros";
import { centavosDoTexto, ehUuid } from "@/lib/formato";
import {
  CATEGORIAS_PEDIDO,
  DETALHES_MAX,
  PRAZOS_PADRAO,
  TITULO_MAX,
  TITULO_MIN,
  URGENCIAS,
  linkPedido,
  type ModoContato,
} from "@/lib/radar";
import type { ErroTela } from "@/lib/tipos";

export type EstadoPedido = { erro?: ErroTela; campos?: Record<string, string> } | null;

const MAX_PRECO_CENTAVOS = 100_000_000_000; // R$ 1 bilhão: acima disso é erro de digitação

/** Prazos permitidos no modo "propostas aqui" (painel: radar.prazos_horas). */
async function prazosPermitidos(microrregiaoId: string): Promise<number[]> {
  const v = await lerConfig<unknown>("radar.prazos_horas", microrregiaoId, PRAZOS_PADRAO);
  const lista = Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  return lista.length ? lista : PRAZOS_PADRAO;
}

export async function criarPedido(_antes: EstadoPedido, form: FormData): Promise<EstadoPedido> {
  const { userId } = await auth();
  if (!userId) return { erro: { mensagem: "Entre na sua conta para continuar." } };
  const conta = await meuPerfilEVitrine();
  if (!conta) return { erro: { mensagem: "Algo deu errado. Tente de novo." } };
  const perfil = conta.perfil;

  const titulo = String(form.get("titulo") ?? "").replace(/\s+/g, " ").trim();
  const detalhes = String(form.get("detalhes") ?? "").trim();
  const categoria = String(form.get("categoria") ?? "geral");
  const urgencia = String(form.get("urgencia") ?? "normal");
  const cidade = String(form.get("cidade") ?? "").trim();
  const modo = String(form.get("modo") ?? "whatsapp_direto") as ModoContato;
  const horas = Number(form.get("prazo") ?? 0);
  const precoTexto = String(form.get("preco") ?? "").trim();
  const preco = centavosDoTexto(precoTexto);

  const campos: Record<string, string> = {};
  if (titulo.length < TITULO_MIN) campos.titulo = `Escreva um pouco mais (pelo menos ${TITULO_MIN} letras). Ex.: "Geladeira frost free usada".`;
  else if (titulo.length > TITULO_MAX) campos.titulo = `Use no máximo ${TITULO_MAX} letras. O resto vai nos detalhes.`;
  if (detalhes.length > DETALHES_MAX) campos.detalhes = `Use no máximo ${DETALHES_MAX} letras.`;
  if (precoTexto && (preco == null || preco > MAX_PRECO_CENTAVOS)) campos.preco = "Digite só o valor, por exemplo 2000.";

  const cidades = await listarCidades(perfil.microrregiao_id);
  if (!cidade) campos.cidade = "Escolha a cidade.";
  else if (cidades.length && !cidades.some((c) => c.nome === cidade)) campos.cidade = "Escolha uma cidade da lista.";

  let propostasAte: string | null = null;
  if (modo === "propostas_prazo") {
    const prazos = await prazosPermitidos(perfil.microrregiao_id);
    if (!prazos.includes(horas)) campos.prazo = "Escolha até quando quer receber propostas.";
    else propostasAte = new Date(Date.now() + horas * 3_600_000).toISOString();
  } else if (modo !== "whatsapp_direto") {
    campos.modo = "Escolha como quer ser chamado.";
  }
  if (Object.keys(campos).length) return { campos, erro: { mensagem: "Confira o que está marcado em vermelho." } };

  const db = await createClient();
  const { data, error } = await db
    .from("radar_pedidos")
    .insert({
      comprador_id: userId,
      microrregiao_id: perfil.microrregiao_id,
      categoria: CATEGORIAS_PEDIDO.some((c) => c.valor === categoria) ? categoria : "geral",
      urgencia: URGENCIAS.some((u) => u.valor === urgencia) ? urgencia : "normal",
      titulo,
      detalhes: detalhes || null,
      preco_max_centavos: preco,
      cidade,
      modo_contato: modo,
      propostas_ate: propostasAte,
    })
    .select("id")
    .single();

  if (error) {
    // A regra "radar criar" barra quem ainda não confirmou o celular.
    if (error.code === "42501" && !conta.perfil.whatsapp_verificado_em) {
      return { erro: { mensagem: "Confirme seu celular antes de pedir no Radar." } };
    }
    return { erro: traduzirErro(error) };
  }
  revalidatePath("/radar");
  redirect(`${linkPedido(data.id)}?novo=1`);
}

export type ResultadoChamar = { ok: true; link: string } | { ok: false; erro: string };

/** "Chamar esta loja": o banco marca a proposta como escolhida e devolve o WhatsApp da loja. */
export async function chamarLoja(propostaId: string): Promise<ResultadoChamar> {
  if (!ehUuid(propostaId)) return { ok: false, erro: "Proposta não encontrada." };
  const db = await createClient();
  const { data, error } = await db
    .rpc("escolher_proposta", { p_proposta_id: propostaId })
    .single<{ whatsapp: string | null; mensagem: string }>();
  if (error) return { ok: false, erro: traduzirErro(error).mensagem };
  const numero = (data?.whatsapp ?? "").replace(/\D/g, "");
  if (!numero) return { ok: false, erro: "Esta loja ainda não cadastrou o WhatsApp." };
  return { ok: true, link: `https://wa.me/${numero}?text=${encodeURIComponent(data.mensagem)}` };
}

/** Fecha o pedido: "atendido" (já resolvi) ou "encerrado" (não quero mais). */
export async function fecharPedido(pedidoId: string, motivo: "atendido" | "encerrado"): Promise<{ ok: boolean; erro?: string }> {
  if (!ehUuid(pedidoId) || (motivo !== "atendido" && motivo !== "encerrado")) return { ok: false, erro: "Pedido não encontrado." };
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: "Entre na sua conta para continuar." };
  const db = await createClient();
  const { data, error } = await db
    .from("radar_pedidos")
    .update({ status: motivo })
    .eq("id", pedidoId)
    .eq("comprador_id", userId)
    .eq("status", "aberto")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: traduzirErro(error).mensagem };
  if (!data) return { ok: false, erro: "Este pedido já não está aberto." };
  revalidatePath("/radar");
  revalidatePath(linkPedido(pedidoId));
  return { ok: true };
}
