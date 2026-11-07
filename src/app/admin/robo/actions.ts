"use server";
// Tela 11 · Robô Aki. Tudo grava com a sessão do admin (RLS confere e_admin()) e cai no
// histórico (gatilhos de configuracoes, robo_modelos e robo_buscas_vazias em logs_atividade).

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { centavosDe } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adaptador, ErroProvedor } from "@/lib/aki/provedores";
import { ERROS_PROVEDOR } from "@/lib/aki/textos";
import { ehId } from "@/lib/aki/validar";
import { PROVEDORES, type ProvedorIA, type ResultadoTeste } from "@/lib/aki/tipos";

const CAMINHO = "/admin/robo";
const NOME_CHAVE: Record<ProvedorIA, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

type Supa = Awaited<ReturnType<typeof exigirAdmin>>["supabase"];

async function gravarConfig(supabase: Supa, userId: string, chave: string, valor: unknown) {
  const { data, error } = await supabase
    .from("configuracoes")
    .update({ valor, atualizado_em: new Date().toISOString(), atualizado_por: userId })
    .eq("chave", chave)
    .is("microrregiao_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`A configuração ${chave} não existe no banco.`);
}

function inteiro(form: FormData, campo: string, min: number, max: number, rotulo: string): number {
  const n = Number(String(form.get(campo) ?? "").trim());
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${rotulo}: use um número inteiro de ${min} a ${max}.`);
  return n;
}

function linhas(form: FormData, campo: string, maxItens: number, maxLetras: number): string[] {
  return String(form.get(campo) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxItens)
    .map((s) => s.slice(0, maxLetras));
}

const erroDe = (e: unknown): EstadoForm => ({ erro: e instanceof Error ? e.message : "Erro ao salvar." });

/* --------------------------- Ligar / desligar --------------------------- */

export async function ligarGeral(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const ligar = form.get("ligar") === "1";
    await gravarConfig(supabase, userId, "robo.ativo", ligar);
    revalidatePath(CAMINHO);
    return { ok: ligar ? "Aki ligado para todas as regiões (menos as exceções)." : "Aki desligado (menos nas regiões com exceção ligada)." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Exceção por região do robo.ativo: ligar, desligar ou seguir o geral (remove a exceção). */
export async function ligarRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const regiao = String(form.get("microrregiao_id") ?? "");
    const modo = String(form.get("modo") ?? "");
    if (!ehId(regiao) || !["ligar", "desligar", "geral"].includes(modo)) return { erro: "Escolha a região e o que fazer." };

    const { data: existente } = await supabase
      .from("configuracoes")
      .select("id")
      .eq("chave", "robo.ativo")
      .eq("microrregiao_id", regiao)
      .maybeSingle();
    if (modo === "geral") {
      if (existente) {
        const { error } = await supabase.from("configuracoes").delete().eq("id", existente.id);
        if (error) return { erro: error.message };
      }
    } else if (existente) {
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor: modo === "ligar", atualizado_em: new Date().toISOString(), atualizado_por: userId })
        .eq("id", existente.id);
      if (error) return { erro: error.message };
    } else {
      const { data: base } = await supabase.from("configuracoes").select("grupo, descricao, publico").eq("chave", "robo.ativo").is("microrregiao_id", null).single();
      const { error } = await supabase.from("configuracoes").insert({
        chave: "robo.ativo",
        microrregiao_id: regiao,
        valor: modo === "ligar",
        grupo: base?.grupo ?? "robo",
        descricao: base?.descricao,
        publico: base?.publico ?? true,
        atualizado_por: userId,
      });
      if (error) return { erro: error.message };
    }
    revalidatePath(CAMINHO);
    return { ok: "Região atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/* ---------------------------- Provedor e modelo ---------------------------- */

export async function escolherModelo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const tipo = form.get("tipo") === "foto" ? "foto" : "conversa";
    const [provedor, ...resto] = String(form.get("modelo") ?? "").split("|");
    const modelo = resto.join("|");
    if (!(PROVEDORES as readonly string[]).includes(provedor) || !modelo) return { erro: "Escolha um modelo da lista." };
    const { data: m } = await supabase
      .from("robo_modelos")
      .select("id")
      .eq("provedor", provedor)
      .eq("modelo", modelo)
      .eq("ativo", true)
      .eq("le_imagem", true)
      .eq("usa_ferramentas", true)
      .maybeSingle();
    if (!m) return { erro: "Esse modelo não está ativo ou não lê imagem e usa ferramentas." };
    await gravarConfig(supabase, userId, `robo.provedor_${tipo}`, provedor);
    await gravarConfig(supabase, userId, `robo.modelo_${tipo}`, modelo);
    revalidatePath(CAMINHO);
    const semChave = !adaptador(provedor)?.temChave();
    return { ok: semChave ? `Salvo. Atenção: falta a chave ${NOME_CHAVE[provedor as ProvedorIA]} na Vercel; até lá o Aki descansa.` : "Salvo." };
  } catch (e) {
    return erroDe(e);
  }
}

/** "Testar": manda uma frase curtinha ao modelo escolhido e mostra resposta, tempo e custo. */
export async function testarModelo(tipo: "conversa" | "foto"): Promise<ResultadoTeste> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const ler = async (chave: string) => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).is("microrregiao_id", null).maybeSingle();
      return typeof data?.valor === "string" ? data.valor : null;
    };
    const t = tipo === "foto" ? "foto" : "conversa";
    const provedor = await ler(`robo.provedor_${t}`);
    const modelo = await ler(`robo.modelo_${t}`);
    const prov = adaptador(provedor);
    if (!prov || !modelo) return { ok: false, erro: "Escolha o provedor e o modelo primeiro." };
    if (!prov.temChave()) return { ok: false, erro: `Falta a chave ${NOME_CHAVE[prov.nome]} nas variáveis de ambiente da Vercel. ${ERROS_PROVEDOR.sem_chave}` };
    const { data: linha } = await supabase.from("robo_modelos").select("fallback_servidor").eq("provedor", prov.nome).eq("modelo", modelo).maybeSingle();

    const inicio = Date.now();
    const resp = await prov.conversar(
      {
        modelo,
        sistemaFixo: "Você é o Aki, ajudante do site OLAKI. Responda em português do Brasil, em uma frase curta.",
        mensagens: [{ papel: "usuario", partes: [{ tipo: "texto", texto: "Diga oi e seu nome em uma frase." }] }],
        maxTokens: 300,
        esforco: "low",
        fallbackServidor: linha?.fallback_servidor === true,
        sinal: AbortSignal.timeout(30_000),
      },
      () => undefined,
    );
    const latenciaMs = Date.now() - inicio;

    // grava o custo do teste no livro-caixa (tipo "teste": não conta no limite de ninguém)
    let custoCentavos: number | null = null;
    try {
      const { data } = await supabaseAdmin().rpc("robo_registrar_resposta", {
        p_usuario: userId,
        p_conversa: null,
        p_tipo: "teste",
        p_provedor: prov.nome,
        p_modelo: modelo,
        p_tokens_entrada: resp.uso.entrada,
        p_tokens_saida: resp.uso.saida,
        p_tokens_cache_leitura: resp.uso.cacheLeitura,
        p_tokens_cache_escrita: resp.uso.cacheEscrita,
        p_latencia_ms: latenciaMs,
      });
      const l = Array.isArray(data) ? data[0] : data;
      custoCentavos = l?.custo_centavos == null ? null : Number(l.custo_centavos);
    } catch {
      custoCentavos = null; // sem a chave do servidor o teste funciona, só não grava o custo
    }
    revalidatePath(CAMINHO);
    return { ok: true, resposta: resp.texto.trim().slice(0, 500) || "(resposta vazia)", latenciaMs, custoCentavos, modelo: resp.modeloUsado };
  } catch (e) {
    if (e instanceof ErroProvedor) {
      const detalhe = e.status ? ` (código ${e.status})` : "";
      return { ok: false, erro: `${ERROS_PROVEDOR[e.tipo]}${detalhe} Detalhe: ${e.message.slice(0, 200)}` };
    }
    return { ok: false, erro: e instanceof Error ? e.message : "O teste falhou." };
  }
}

/* --------------------------- Limites e orçamento --------------------------- */

export async function salvarLimites(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const limite = inteiro(form, "limite_diario", 0, 1000, "Mensagens por pessoa por dia");
    const orcamento = centavosDe(form.get("orcamento_reais"));
    if (orcamento === null || orcamento > 100_000_000) throw new Error("Orçamento do mês: digite um valor em reais.");
    const alerta = inteiro(form, "alerta_percentual", 1, 100, "Alerta");
    const cotacao = Number(String(form.get("cotacao_dolar") ?? "").replace(",", "."));
    if (!Number.isFinite(cotacao) || cotacao <= 0 || cotacao > 100) throw new Error("Cotação do dólar inválida. Ex.: 5,50");
    await gravarConfig(supabase, userId, "robo.limite_diario_pessoa", limite);
    await gravarConfig(supabase, userId, "robo.orcamento_mensal_centavos", orcamento);
    await gravarConfig(supabase, userId, "robo.alerta_percentual", alerta);
    await gravarConfig(supabase, userId, "robo.cotacao_dolar", Math.round(cotacao * 10000) / 10000);
    revalidatePath(CAMINHO);
    return { ok: "Limites salvos." };
  } catch (e) {
    return erroDe(e);
  }
}

/* --------------------------------- Textos --------------------------------- */

export async function salvarTextos(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const boasVindas = String(form.get("boas_vindas") ?? "").trim().slice(0, 600);
    const avisoIa = String(form.get("aviso_ia") ?? "").trim().slice(0, 300);
    if (!boasVindas) throw new Error("Escreva a mensagem de boas-vindas.");
    if (!avisoIa) throw new Error("O aviso de que é uma IA é obrigatório.");
    await gravarConfig(supabase, userId, "robo.boas_vindas", boasVindas);
    await gravarConfig(supabase, userId, "robo.aviso_ia", avisoIa);
    await gravarConfig(supabase, userId, "robo.sugestoes", linhas(form, "sugestoes", 6, 80));
    await gravarConfig(supabase, userId, "robo.temas_proibidos", linhas(form, "temas_proibidos", 30, 120));
    revalidatePath(CAMINHO);
    revalidatePath("/", "layout");
    return { ok: "Textos salvos." };
  } catch (e) {
    return erroDe(e);
  }
}

/* --------------------------- Catálogo de modelos --------------------------- */

function precoUsd(form: FormData, campo: string): number | null {
  const t = String(form.get(campo) ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 10000) throw new Error(`Preço inválido: ${t}`);
  return n;
}

export async function salvarModelo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    const dados = {
      nome: String(form.get("nome") ?? "").trim().slice(0, 80),
      le_imagem: form.get("le_imagem") === "on",
      usa_ferramentas: form.get("usa_ferramentas") === "on",
      preco_entrada_usd: precoUsd(form, "preco_entrada_usd"),
      preco_saida_usd: precoUsd(form, "preco_saida_usd"),
      preco_cache_leitura_usd: precoUsd(form, "preco_cache_leitura_usd"),
      preco_cache_escrita_usd: precoUsd(form, "preco_cache_escrita_usd"),
      fallback_servidor: form.get("fallback_servidor") === "on",
      ativo: form.get("ativo") === "on",
      observacao: String(form.get("observacao") ?? "").trim().slice(0, 300) || null,
      atualizado_por: userId,
    };
    if (dados.nome.length < 2) throw new Error("Dê um nome ao modelo.");
    if (dados.ativo && (dados.preco_entrada_usd === null || dados.preco_saida_usd === null)) {
      throw new Error("Para ativar, preencha o preço de entrada e de saída (confira na página de preços do provedor).");
    }

    if (id) {
      if (!ehId(id)) return { erro: "Modelo inválido." };
      if (!dados.ativo || !dados.le_imagem || !dados.usa_ferramentas) {
        // não deixa tirar de uso o modelo que o Aki está usando agora (ele ficaria sem modelo)
        const { data: m } = await supabase.from("robo_modelos").select("provedor, modelo").eq("id", id).single();
        const { data: emUso } = await supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["robo.modelo_conversa", "robo.modelo_foto"]);
        const { data: provs } = await supabase.from("configuracoes").select("chave, valor").in("chave", ["robo.provedor_conversa", "robo.provedor_foto"]);
        const usado = ["conversa", "foto"].some(
          (t) =>
            (emUso ?? []).some((c) => c.chave === `robo.modelo_${t}` && c.valor === m?.modelo) &&
            (provs ?? []).some((c) => c.chave === `robo.provedor_${t}` && c.valor === m?.provedor),
        );
        if (usado) throw new Error("Esse modelo está em uso pelo Aki. Escolha outro modelo para a conversa e a foto antes de desligar este.");
      }
      const { error } = await supabase.from("robo_modelos").update(dados).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const provedor = String(form.get("provedor") ?? "");
      const modelo = String(form.get("modelo") ?? "").trim();
      if (!(PROVEDORES as readonly string[]).includes(provedor)) throw new Error("Escolha o provedor.");
      if (!/^[A-Za-z0-9._:/-]{2,120}$/.test(modelo)) throw new Error("Id do modelo inválido (use o id exato da página do provedor).");
      const { error } = await supabase.from("robo_modelos").insert({ ...dados, provedor, modelo });
      if (error) throw new Error(error.code === "23505" ? "Esse modelo já está no catálogo." : error.message);
    }
    revalidatePath(CAMINHO);
    return { ok: "Modelo salvo." };
  } catch (e) {
    return erroDe(e);
  }
}

/* ---------------------------- Buscas sem resultado ---------------------------- */

/** Marca uma busca sem resultado como resolvida (apaga da lista; fica no histórico). */
export async function resolverBuscaVazia(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(form.get("id"));
  if (Number.isSafeInteger(id) && id > 0) await supabase.from("robo_buscas_vazias").delete().eq("id", id);
  revalidatePath(CAMINHO);
}
