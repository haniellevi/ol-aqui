import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { COLUNAS_VITRINE } from "@/lib/dados/vitrines";
import { lojaEscolhida } from "@/lib/dados/loja-ativa";
import type { MeuPerfil, MinhaConta, MinhaVitrine, Plano } from "@/lib/tipos";

/**
 * Perfil + vitrine + plano que vale agora + limite e uso de anúncios do usuário logado.
 * Sem login ou sem perfil → null. Guardado durante a requisição.
 * O limite mostrado é só informação: quem barra de verdade é o banco (trigger do limite).
 */
export const meuPerfilEVitrine = cache((exigirLeitura = false): Promise<MinhaConta | null> => exigirLeitura ? lerConta(true) : seguro(() => lerConta(), null));

/**
 * Etapa P5b: a mesma conta, mas com a loja escolhida no seletor (a própria ou uma que a pessoa ajuda).
 * Usada só na área de anúncios (Meus anúncios e Anunciar). Ajudante: `ajudante = true`, sem WhatsApp da loja.
 */
export const contaDaLoja = cache(async (exigirLeitura = false): Promise<MinhaConta | null> => {
  const loja = await lojaEscolhida();
  const ler = () => lerConta(exigirLeitura, loja && !loja.dono ? loja.id : undefined);
  return exigirLeitura ? ler() : seguro(ler, null);
});

async function lerConta(exigirLeitura = false, lojaAjudada?: string): Promise<MinhaConta | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const db = await createClient();

  const consultaVitrine = db.from("vitrines_lojas").select(`${COLUNAS_VITRINE}, dono_id, plano, teste_expira_em, plano_expira_em`);
  const [perfilRes, vitrineRes, contatosRes] = await Promise.all([
    db.rpc("meu_perfil"),
    (lojaAjudada ? consultaVitrine.eq("id", lojaAjudada) : consultaVitrine.eq("dono_id", userId))
      .maybeSingle<Omit<MinhaVitrine, "whatsapp">>(),
    lojaAjudada ? Promise.resolve({ data: null, error: null }) : db.rpc("meus_contatos_vitrine").maybeSingle<{ whatsapp: string | null }>(),
  ]);
  const perfilLinha = Array.isArray(perfilRes.data) ? perfilRes.data[0] : perfilRes.data;
  if (perfilRes.error) throw new Error("Não foi possível carregar sua conta.");
  if (!perfilLinha) return null;
  const perfil = paraPerfil(perfilLinha);
  if (vitrineRes.error || contatosRes.error) throw new Error("Não foi possível carregar sua vitrine.");
  const vitrine = vitrineRes.data ? { ...vitrineRes.data, whatsapp: contatosRes.data?.whatsapp ?? null } : null;
  if (exigirLeitura && (perfil.id !== userId || (vitrine && !lojaAjudada && vitrine.dono_id !== userId))) throw new Error("Não foi possível confirmar sua conta.");

  if (!vitrine) {
    return { perfil, vitrine: null, plano: null, limite: 0, ativos: 0, rascunhos: 0, podePublicar: false };
  }

  const agoraIso = new Date().toISOString();
  const [plano, ativosRes, rascunhosRes] = await Promise.all([
    planoEfetivo(exigirLeitura, lojaAjudada),
    db
      .from("anuncios")
      .select("id", { count: "exact", head: true })
      .eq("vitrine_id", vitrine.id)
      .eq("status", "ativo")
      .or(`pago_ate.is.null,pago_ate.lte.${agoraIso}`), // avulso pago não conta no limite
    db
      .from("anuncios")
      .select("id", { count: "exact", head: true })
      .eq("vitrine_id", vitrine.id)
      .eq("status", "rascunho"),
  ]);
  if (exigirLeitura && (ativosRes.error || rascunhosRes.error || ativosRes.count === null || rascunhosRes.count === null)) throw new Error("Não foi possível carregar o uso do plano.");
  const limite = plano ? plano.limite_anuncios : 0;
  const ativos = ativosRes.count ?? 0;
  return {
    perfil,
    vitrine,
    plano,
    limite,
    ativos,
    rascunhos: rascunhosRes.count ?? 0,
    podePublicar: limite === null || ativos < limite,
    ...(lojaAjudada ? { ajudante: true } : {}),
  };
}

/**
 * Plano que vale agora, calculado pelo banco (public.meu_plano → plano_efetivo). Assim a tela
 * enxerga até o plano contratado que saiu de venda (planos.ativo = false), igual ao limite do banco.
 */
async function planoEfetivo(exigirLeitura = false, loja?: string): Promise<Plano | null> {
  const db = await createClient();
  const { data, error } = loja ? await db.rpc("plano_da_loja", { p_vitrine: loja }) : await db.rpc("meu_plano");
  if (error) {
    if (exigirLeitura) throw new Error("Não foi possível carregar seu plano.");
    return null;
  }
  const linha = (Array.isArray(data) ? data[0] : data) as Plano | null | undefined;
  return linha?.codigo ? linha : null;
}

function paraPerfil(l: Record<string, unknown>): MeuPerfil {
  return {
    id: String(l.id),
    microrregiao_id: String(l.microrregiao_id),
    nome: String(l.nome ?? ""),
    tipo_pessoa: l.tipo_pessoa === "pj" ? "pj" : "pf",
    whatsapp: (l.whatsapp as string | null) ?? null,
    whatsapp_verificado_em: (l.whatsapp_verificado_em as string | null) ?? null,
    cidade: (l.cidade as string | null) ?? null,
    bairro: (l.bairro as string | null) ?? null,
    avatar_url: (l.avatar_url as string | null) ?? null,
    selo_negociador_certificado: l.selo_negociador_certificado === true,
    e_admin: l.e_admin === true,
    aceitou_termos_em: (l.aceitou_termos_em as string | null) ?? null,
  };
}
