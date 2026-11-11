import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reais } from "@/lib/admin/formato";

// Tela "Hoje": as tarefas do dia, montadas na hora a partir do banco.
// Os limites (dias, horas, quantas tarefas) vêm de Configurações (grupo "hoje").

export type TipoTarefa = "moderacao" | "atendimento" | "verificacao" | "cobranca_vencida" | "teste_acabando" | "funil" | "radar_sem_proposta" | "loja_sem_anuncio";

export type Tarefa = {
  tipo: TipoTarefa;
  /** id do que a tarefa fala (loja, cobrança, pedido...), para o "Feito" */
  alvo: string;
  titulo: string;
  detalhe: string;
  /** botão principal */
  acao: { rotulo: string; href: string; externo?: boolean };
  /** link de apoio (ex.: abrir a loja no painel) */
  apoio?: { rotulo: string; href: string };
  urgente?: boolean;
  adiavel?: boolean;
};

export const NOME_TIPO: Record<TipoTarefa, string> = {
  moderacao: "Moderação",
  atendimento: "Atendimento",
  verificacao: "Documentos",
  cobranca_vencida: "Cobrança vencida",
  teste_acabando: "Teste acabando",
  funil: "Funil",
  radar_sem_proposta: "Radar sem proposta",
  loja_sem_anuncio: "Loja sem anúncio",
};

type Config = {
  max: number;
  testeDias: number;
  radarHoras: number;
  semAnuncioDias: number;
  vencidasDias: number;
};

const PADRAO: Config = {
  max: 10,
  testeDias: 2,
  radarHoras: 12,
  semAnuncioDias: 3,
  vencidasDias: 30,
};

const CHAVES: Record<keyof Config, string> = {
  max: "hoje.max_tarefas",
  testeDias: "hoje.teste_acabando_dias",
  radarHoras: "hoje.radar_sem_proposta_horas",
  semAnuncioDias: "hoje.loja_sem_anuncio_dias",
  vencidasDias: "hoje.vencidas_dias",
};

async function lerConfig(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("configuracoes").select("chave, valor").is("microrregiao_id", null).in("chave", Object.values(CHAVES));
  const valores = new Map((data ?? []).map((c) => [c.chave as string, c.valor as unknown]));
  const cfg = { ...PADRAO };
  for (const [campo, chave] of Object.entries(CHAVES) as [keyof Config, string][]) {
    const v = valores.get(chave);
    const n = typeof v === "number" ? v : Number(v);
    if (v != null && Number.isFinite(n) && n >= 0) cfg[campo] = Math.floor(n);
  }
  cfg.max = Math.min(Math.max(cfg.max, 1), 50);
  return { cfg, error };
}

/** Dia de hoje no fuso do Piauí (AAAA-MM-DD). */
export function hojeLocal(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(agora);
}

function quandoAcaba(fim: Date, agora: Date): string {
  const dias = Math.round((Date.parse(hojeLocal(fim)) - Date.parse(hojeLocal(agora))) / 86_400_000);
  return dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
}

export type ResultadoHoje = { tarefas: Tarefa[]; total: number; feitas: number; erro: boolean; falhas: string[]; max: number };

/**
 * Monta as tarefas do dia em ordem de prioridade e tira os acompanhamentos adiados até amanhã.
 * `total` conta todas as pendentes (a tela mostra só as primeiras `max`).
 */
export async function tarefasDeHoje(supabase: SupabaseClient, agora = new Date()): Promise<ResultadoHoje> {
  const { cfg, error: configErro } = await lerConfig(supabase);
  const instante = agora.toISOString();
  const dia = hojeLocal(agora);
  const limiteTeste = new Date(agora.getTime() + cfg.testeDias * 86_400_000).toISOString();
  const radarAntes = new Date(agora.getTime() - cfg.radarHoras * 3_600_000).toISOString();
  const lojaAntes = new Date(agora.getTime() - cfg.semAnuncioDias * 86_400_000).toISOString();
  const lojaDepois = new Date(agora.getTime() - (cfg.semAnuncioDias + 14) * 86_400_000).toISOString();
  const vencidasDesde = new Date(agora.getTime() - cfg.vencidasDias * 86_400_000).toISOString().slice(0, 10);
  const LIM = 50;

  const [feitasR, anunciosFila, pedidosFila, denuncias, vencidasR, testesR, funilR, radarR, lojasR, atendimentosR, documentosR] = await Promise.all([
    supabase.from("hoje_feitas").select("tipo, alvo_id").eq("dia", dia),
    supabase.from("anuncios").select("id", { count: "exact", head: true }).eq("status", "em_analise"),
    supabase.from("radar_pedidos").select("id", { count: "exact", head: true }).eq("status", "em_analise"),
    supabase.from("denuncias").select("id", { count: "exact", head: true }).eq("status", "aberta"),
    supabase.from("pagamentos").select("id, valor_centavos, vencimento, vitrine_id, vitrines_lojas(nome), asaas_criacoes!inner(ambiente)")
      .eq("asaas_criacoes.ambiente", "producao").eq("status", "vencido").gte("vencimento", vencidasDesde).order("vencimento", { ascending: true }).limit(LIM),
    supabase.from("vitrines_lojas").select("id, nome, teste_expira_em")
      .eq("plano", "teste").eq("status", "ativa").gt("teste_expira_em", instante).lte("teste_expira_em", limiteTeste)
      .order("teste_expira_em", { ascending: true }).limit(LIM),
    supabase.from("funil_lojistas").select("id, nome_loja, whatsapp, proximo_passo, proximo_em, funil_etapas(nome, tipo)")
      .lte("proximo_em", dia).order("proximo_em", { ascending: true }).limit(LIM),
    supabase.from("radar_pedidos").select("id, titulo, cidade, criado_em")
      .eq("status", "aberto").eq("total_propostas", 0).lt("criado_em", radarAntes).gt("expira_em", instante)
      .order("criado_em", { ascending: true }).limit(LIM),
    supabase.from("vitrines_lojas").select("id, nome, criado_em, anuncios(count)")
      .eq("status", "ativa").lt("criado_em", lojaAntes).gt("criado_em", lojaDepois)
      .order("criado_em", { ascending: true }).limit(LIM),
    supabase.from("atendimentos_anuncio").select("id", { count: "exact", head: true }).eq("aguarda_equipe", true),
    supabase.rpc("admin_fila_verificacao_pf"),
  ]);

  const fontes = [
    ["Preferências de tarefas", configErro], ["Tarefas adiadas", feitasR.error],
    ["Anúncios em análise", anunciosFila.error], ["Pedidos em análise", pedidosFila.error], ["Denúncias", denuncias.error],
    ["Cobranças", vencidasR.error], ["Testes grátis", testesR.error], ["Captação", funilR.error],
    ["Radar", radarR.error], ["Lojas", lojasR.error], ["Atendimentos", atendimentosR.error], ["Documentos", documentosR.error],
  ] as const;
  const falhas = fontes.filter(([, error]) => error).map(([nome]) => nome);
  const feitas = new Set((feitasR.data ?? []).map((f) => `${f.tipo}:${f.alvo_id}`));
  const tarefas: Tarefa[] = [];

  // 1. Fila de moderação (uma tarefa só, com o total)
  const fila = (anunciosFila.count ?? 0) + (pedidosFila.count ?? 0) + (denuncias.count ?? 0);
  if (fila > 0) {
    tarefas.push({
      tipo: "moderacao",
      alvo: dia,
      titulo: `${fila} ${fila === 1 ? "item espera" : "itens esperam"} revisão`,
      detalhe: `${anunciosFila.count ?? 0} anúncios, ${pedidosFila.count ?? 0} pedidos do Radar e ${denuncias.count ?? 0} denúncias.`,
      acao: { rotulo: "Revisar agora", href: "/admin/moderacao" },
      urgente: true,
      adiavel: false,
    });
  }

  if ((atendimentosR.count ?? 0) > 0) tarefas.push({
    tipo: "atendimento", alvo: dia, titulo: `${atendimentosR.count} atendimentos aguardam a equipe`,
    detalhe: "Responda às conversas que precisam de ajuda.", acao: { rotulo: "Ver atendimentos", href: "/admin/anuncios/conversas" },
    urgente: true, adiavel: false,
  });
  if (documentosR.data?.length) tarefas.push({
    tipo: "verificacao", alvo: dia, titulo: `${documentosR.data.length} envios de documentos para conferir`,
    detalhe: "Verificação de vendedores individuais.", acao: { rotulo: "Conferir documentos", href: "/admin/lojas#fila-pf" },
    adiavel: false,
  });

  // 2. Cobranças vencidas
  for (const p of vencidasR.data ?? []) {
    const loja = (Array.isArray(p.vitrines_lojas) ? p.vitrines_lojas[0] : p.vitrines_lojas) as { nome: string } | null;
    if (!loja) continue;
    const valor = reais(p.valor_centavos as number);
    tarefas.push({
      tipo: "cobranca_vencida",
      alvo: p.id as string,
      titulo: `Cobrança vencida: ${loja.nome}`,
      detalhe: `${valor}, venceu em ${new Date(`${p.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}.`,
      acao: { rotulo: "Ver cobrança", href: `/admin/pagamentos?status=vencido&loja=${p.vitrine_id}` },
      urgente: true,
    });
  }

  // 3. Teste grátis acabando
  for (const v of testesR.data ?? []) {
    const fim = new Date(v.teste_expira_em as string);
    const quando = quandoAcaba(fim, agora);
    tarefas.push({
      tipo: "teste_acabando",
      alvo: v.id as string,
      titulo: `Teste acaba ${quando}: ${v.nome}`,
      detalhe: "Hora de oferecer um plano antes de a loja sair do ar.",
      acao: { rotulo: "Abrir loja", href: `/admin/lojas/${v.id}` },
    });
  }

  // 4. Próximos passos do funil marcados para hoje (ou atrasados)
  for (const f of funilR.data ?? []) {
    const etapa = (Array.isArray(f.funil_etapas) ? f.funil_etapas[0] : f.funil_etapas) as { nome: string; tipo: string } | null;
    if (etapa?.tipo === "perdido") continue;
    const atrasado = (f.proximo_em as string) < dia;
    tarefas.push({
      tipo: "funil",
      alvo: f.id as string,
      titulo: `${f.proximo_passo || "Falar com a loja"}: ${f.nome_loja}`,
      detalhe: `${etapa?.nome ?? "Funil"}${atrasado ? ` · atrasado desde ${new Date(`${f.proximo_em}T12:00:00`).toLocaleDateString("pt-BR")}` : " · para hoje"}.`,
      acao: { rotulo: "Abrir no funil", href: `/admin/funil/${f.id}` },
      apoio: f.whatsapp ? { rotulo: "WhatsApp", href: `https://wa.me/${(f.whatsapp as string).replace(/\D/g, "")}` } : undefined,
      urgente: atrasado,
    });
  }

  // 5. Pedidos do Radar sem nenhuma proposta
  for (const r of radarR.data ?? []) {
    const horas = Math.floor((agora.getTime() - Date.parse(r.criado_em as string)) / 3_600_000);
    tarefas.push({
      tipo: "radar_sem_proposta",
      alvo: r.id as string,
      titulo: `Ninguém respondeu: ${r.titulo}`,
      detalhe: `${r.cidade}, há ${horas >= 48 ? `${Math.floor(horas / 24)} dias` : `${horas} horas`}. Avise uma loja que vende isso.`,
      acao: { rotulo: "Ver pedido", href: `/radar/${r.id}` },
    });
  }

  // 6. Loja nova que ainda não pôs nenhum anúncio
  for (const v of lojasR.data ?? []) {
    const anuncios = (v.anuncios as { count: number }[] | null)?.[0]?.count ?? 0;
    if (anuncios > 0) continue;
    tarefas.push({
      tipo: "loja_sem_anuncio",
      alvo: v.id as string,
      titulo: `Loja sem nenhum anúncio: ${v.nome}`,
      detalhe: "Ajudar a pôr os primeiros produtos faz a loja ficar.",
      acao: { rotulo: "Abrir loja", href: `/admin/lojas/${v.id}` },
    });
  }

  const pendentes = tarefas.filter((t) => t.adiavel === false || !feitas.has(`${t.tipo}:${t.alvo}`));
  return { tarefas: pendentes.slice(0, cfg.max), total: pendentes.length, feitas: tarefas.length - pendentes.length, erro: falhas.length > 0, falhas, max: cfg.max };
}
