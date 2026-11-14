"use server";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { garantirPerfil } from "@/lib/perfil";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";
import { dddDoPerfil, numeroComRegiao } from "@/lib/telefone-regiao";
import { WHATSAPP_JA_VINCULADO, whatsappJaVinculado } from "@/lib/erros";
import { configuracaoWhatsapp, enviarCodigo, novoCodigo, numeroWhatsapp, resumoCodigo, validarTurnstile } from "@/lib/whatsapp/servico";

export type EstadoCodigo = { erro?: string; aviso?: string; desafio?: string; confirmado?: boolean; encerrado?: boolean; aguardar?: number };
export async function solicitarCodigo(numero: unknown, token: unknown): Promise<EstadoCodigo> {
  try {
    const { userId } = await auth();
    if (!userId) return { erro: "Entre na sua conta para confirmar o celular." };
    const fone = await numeroComRegiao(numero, () => dddDoPerfil(userId), numeroWhatsapp);
    if (!fone) return { erro: "Informe um celular brasileiro com DDD." };
    const config = configuracaoWhatsapp();
    if (!await validarTurnstile(token, config)) return { erro: "Refaça a verificação de segurança e tente novamente." };
    if (await garantirPerfil() !== userId) return { erro: "Não conseguimos confirmar sua conta." };
    const codigo = novoCodigo(userId, config.segredo), db = supabaseAdmin();
    const { data, error } = await db.rpc("reservar_codigo_whatsapp", { p_usuario: userId, p_id: codigo.id, p_numero: fone, p_resumo: codigo.resumo });
    if (error) return { erro: "Não conseguimos preparar o código. Tente novamente mais tarde." };
    if (data === "aguarde") return { erro: "Aguarde um minuto antes de pedir outro código.", aguardar: 60 };
    if (data !== "reservado") return { erro: "Não conseguimos preparar o código." };
    const envio = await enviarCodigo(fone, codigo.codigo, config);
    const { error: erroRegistro } = await db.from("whatsapp_desafios").update({ envio }).eq("id", codigo.id).eq("usuario_id", userId);
    if (envio === "falha") return { erro: "O WhatsApp de verificação está indisponível. Confira o número e tente mais tarde.", aguardar: 60 };
    return { desafio: codigo.id, aguardar: 60, aviso: envio === "incerto" || erroRegistro
      ? "Não conseguimos confirmar o envio. Se o código chegar ao seu WhatsApp, digite-o abaixo."
      : "Código solicitado. Confira as mensagens no seu WhatsApp; a entrega pode levar alguns instantes." };
  } catch { return { erro: "Não foi possível solicitar o código agora. Tente novamente mais tarde." }; }
}

export async function confirmarCodigo(desafio: unknown, codigo: unknown): Promise<EstadoCodigo> {
  try {
    const { userId } = await auth();
    if (!userId) return { erro: "Entre na sua conta para confirmar o celular." };
    if (typeof desafio !== "string" || !ehUuid(desafio) || typeof codigo !== "string" || !/^\d{6}$/.test(codigo)) return { erro: "Digite os seis números do código recebido." };
    const segredo = process.env.WHATSAPP_OTP_SECRET;
    if (!segredo || segredo.length < 32) return { erro: "A confirmação está indisponível. Tente mais tarde." };
    const { data, error } = await supabaseAdmin().rpc("confirmar_codigo_whatsapp", { p_usuario: userId, p_id: desafio, p_resumo: resumoCodigo(userId, desafio, codigo, segredo) });
    if (data === "numero_vinculado" || whatsappJaVinculado(error)) {
      return { encerrado: true, erro: `${WHATSAPP_JA_VINCULADO} Use outro número ou procure o suporte.` };
    }
    if (error) return { erro: "Não conseguimos conferir o código. Tente novamente." };
    if (data !== "confirmado") return { encerrado: data !== "incorreto", erro: data === "bloqueado" ? "Você atingiu três erros. Solicite um novo código." : data === "expirado" ? "Este código expirou. Solicite um novo código." : data === "incorreto" ? "Código incorreto. Confira a mensagem recebida." : "Este código não pode ser usado. Solicite um novo código." };
    revalidatePath("/minha-conta", "layout"); revalidatePath("/radar", "layout");
    return { confirmado: true };
  } catch { return { erro: "Não conseguimos conferir o código. Tente novamente." }; }
}
