import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decidir } from "./decidir";
import { lerComprovante, lerFachada, type ArquivoVerificacao } from "./ia";
import { consultarCnpj } from "./receita";
import type { Contexto, Decisao, LeituraComprovante, LeituraFachada } from "./tipos";

// Pedido reservado pelo banco (verificacao_loja_reservar). Os arquivos chegam em base64 e só vivem em memória.
type Pedido = {
  id: string; reserva: string; cnpj: string; comprovante: string; tipo_comprovante: ArquivoVerificacao["tipo"];
  fachada: string | null; tipo_fachada: ArquivoVerificacao["tipo"] | null;
  loja_nome: string; cidade: string; endereco: string | null; cnpj_em_outra_loja: boolean;
};
// custo null = não dá para saber (o banco mantém a reserva do orçamento).
type Uso = { custo: number | null; entrada: number; saida: number };

const DECISAO_FALHA: Decisao = {
  decisao: "equipe", motivo: null, motivosEquipe: ["ia_falhou"], parecer: [{ item: "analise", ok: null, nota: "análise falhou" }],
};

async function analisar(db: SupabaseClient, p: Pedido, uso: Uso): Promise<Decisao> {
  const cadastro = { nome: p.loja_nome, cidade: p.cidade, endereco: p.endereco };
  const receita = await consultarCnpj(p.cnpj);
  // Receita fora do ar ou CNPJ inexistente: a IA nem é chamada (não gasta orçamento).
  if (receita.estado !== "ok") {
    uso.custo = 0;
    return decidir({ receita, comprovante: null, pdfSemTexto: false, fachada: null, cadastro, cnpjEmOutraLoja: p.cnpj_em_outra_loja, cidadeNaRegiao: null });
  }

  let cidadeNaRegiao: boolean | null = null;
  const { data: regiao, error: erroRegiao } = await db.rpc("verificacao_loja_cidade_na_regiao", { p_id: p.id, p_ibge: receita.dados.municipioIbge });
  if (!erroRegiao && typeof regiao === "boolean") cidadeNaRegiao = regiao;

  const [comp, fach] = await Promise.all([
    lerComprovante({ base64: p.comprovante, tipo: p.tipo_comprovante }),
    p.fachada && p.tipo_fachada ? lerFachada({ base64: p.fachada, tipo: p.tipo_fachada }) : Promise.resolve(null),
  ]);

  let custo: number | null = 0;
  for (const r of [comp, fach]) {
    if (!r) continue;
    if (r.custoUsd === null) custo = null;
    else if (custo !== null) custo += r.custoUsd;
    if (r.ok) { uso.entrada += r.tokensEntrada; uso.saida += r.tokensSaida; }
  }
  uso.custo = custo;

  let comprovante: LeituraComprovante | null = null;
  let pdfSemTexto = false;
  if (comp.ok) comprovante = comp.leitura;
  else if (comp.falha === "pdf_sem_texto" || comp.falha === "pdf_ilegivel") pdfSemTexto = true;
  // Qualquer outra falha no comprovante deixa comprovante = null: decidir() manda para a equipe (ia_falhou).

  // Falha na fachada (inclusive fachada em PDF, que não é lida) é ignorada.
  const fachada: LeituraFachada | null = fach && fach.ok ? fach.leitura : null;

  const ctx: Contexto = { receita, comprovante, pdfSemTexto, fachada, cadastro, cnpjEmOutraLoja: p.cnpj_em_outra_loja, cidadeNaRegiao };
  return decidir(ctx);
}

async function processarPedido(db: SupabaseClient, p: Pedido): Promise<void> {
  const uso: Uso = { custo: null, entrada: 0, saida: 0 };
  let d: Decisao;
  try {
    d = await analisar(db, p, uso);
  } catch {
    d = DECISAO_FALHA;
  }
  try {
    // Só o parecer fixo de decidir() vai ao banco: nada de titular, endereço, razão social ou arquivo.
    await db.rpc("verificacao_loja_concluir", {
      p_id: p.id, p_reserva: p.reserva, p_decisao: d.decisao, p_motivo: d.motivo, p_motivos_equipe: d.motivosEquipe,
      p_parecer: d.parecer, p_custo_usd: uso.custo, p_tokens_entrada: uso.entrada, p_tokens_saida: uso.saida,
    });
  } catch {
    // Sem resultado salvo, o pedido fica "analisando" e o banco o manda para a equipe depois de 10 minutos.
  }
}

export async function processarFilaVerificacao(db?: SupabaseClient): Promise<{ processados: number }> {
  try {
    const cliente = db ?? supabaseAdmin();
    const { data, error } = await cliente.rpc("verificacao_loja_reservar");
    if (error || !Array.isArray(data)) return { processados: 0 };
    const pedidos = (data as Pedido[]).slice(0, 2);
    await Promise.all(pedidos.map((p) => processarPedido(cliente, p).catch(() => undefined)));
    return { processados: pedidos.length };
  } catch {
    return { processados: 0 };
  }
}
