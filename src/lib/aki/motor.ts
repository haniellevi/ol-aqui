import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades, regiaoAtual } from "@/lib/dados/regiao";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { adaptador, ErroProvedor, lerArgumentos, somarUso, usoVazio, type MensagemIA, type ParteIA, type UsoIA } from "@/lib/aki/provedores";
import { executarFerramenta, FERRAMENTAS, rotuloFerramenta, type ContextoFerramentas } from "@/lib/aki/ferramentas";
import { criarFiltroStream, criarModerador } from "@/lib/aki/moderacao";
import { sistemaFixo, sistemaVariavel } from "@/lib/aki/sistema";
import { ehId } from "@/lib/aki/validar";
import {
  ERROS_PROVEDOR,
  RESPOSTA_BLOQUEADA,
  RESPOSTA_RECUSA,
  RESPOSTA_SEM_FIM,
  mensagemBloqueio,
} from "@/lib/aki/textos";
import type {
  AcaoAki,
  ConteudoAssistente,
  ConteudoUsuario,
  EstadoAki,
  EventoAki,
  MensagemAki,
  MotivoBloqueio,
  PedidoAki,
  PodeEnviar,
} from "@/lib/aki/tipos";

// Motor da conversa: confere se pode, reserva a vez, chama a IA com as ferramentas,
// modera o texto, manda os eventos e grava pergunta + resposta + custo no fim.

export type Ajustes = Record<string, unknown>;

const num = (v: unknown, padrao: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), min), max) : padrao;
};
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
const textoOuNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Tem a chave do servidor que grava o custo? Sem ela o Aki não responde (nada de uso sem registro). */
export const temChaveServidor = () => !!(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function lerAjustes(db: SupabaseClient): Promise<Ajustes> {
  const { data, error } = await db.rpc("robo_ajustes");
  return !error && data && typeof data === "object" ? (data as Ajustes) : {};
}

export async function lerPodeEnviar(db: SupabaseClient, tipo: "conversa" | "foto"): Promise<PodeEnviar | null> {
  const { data, error } = await db.rpc("robo_pode_enviar", { p_tipo: tipo });
  const linha = Array.isArray(data) ? data[0] : data;
  if (error || !linha) return null;
  return linha as PodeEnviar;
}

export function limitesFoto(ajustes: Ajustes) {
  return {
    ladoMaximo: num(ajustes["robo.foto_lado_maximo"], 1024, 256, 2048),
    maxKb: num(ajustes["robo.foto_max_kb"], 800, 50, 4000),
  };
}

/** Motivo final: o banco diz se pode; aqui confere também a chave do provedor escolhido. */
export function motivoFinal(pode: PodeEnviar | null): MotivoBloqueio | null {
  if (!pode) return "erro";
  if (!pode.pode) return (pode.motivo as MotivoBloqueio) ?? "erro";
  const a = adaptador(pode.provedor);
  if (!a || !a.temChave() || !temChaveServidor()) return "sem_chave";
  return null;
}

/* ------------------------------ Estado (GET) ------------------------------ */

export async function estadoAki(userId: string | null, completo: boolean): Promise<EstadoAki> {
  const base: EstadoAki = {
    logado: !!userId,
    ligado: false,
    pode: false,
    motivo: userId ? "erro" : "sem_login",
    restantes: null,
    boasVindas: null,
    sugestoes: [],
    avisoIa: null,
    fotoLadoMaximo: 1024,
    maxCaracteres: 600,
    conversaId: null,
    mensagens: [],
  };
  const db = await createClient();
  if (!userId) {
    // visitante: só os textos públicos (o pitch e o botão "Entrar para conversar").
    // config() é fechada para anon; robo_publico() devolve só estas três chaves públicas.
    const regiao = await regiaoAtual();
    const { data } = await db.rpc("robo_publico", { p_microrregiao: regiao?.id ?? null });
    const pub = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    return { ...base, ligado: pub["robo.ativo"] === true, boasVindas: textoOuNull(pub["robo.boas_vindas"]), avisoIa: textoOuNull(pub["robo.aviso_ia"]) };
  }

  const [ajustes, pode] = await Promise.all([lerAjustes(db), lerPodeEnviar(db, "conversa")]);
  const motivo = motivoFinal(pode);
  const { data: conversa } = completo
    ? await db.from("robo_conversas").select("id").order("atualizado_em", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const mensagens = conversa ? await mensagensDaConversa(db, String(conversa.id), 40) : [];
  return {
    ...base,
    ligado: motivo !== "desligado",
    pode: motivo === null,
    motivo,
    restantes: pode ? Math.max(0, pode.limite_diario - pode.usadas_hoje) : null,
    boasVindas: textoOuNull(ajustes["robo.boas_vindas"]),
    sugestoes: lista(ajustes["robo.sugestoes"]).slice(0, 6),
    avisoIa: textoOuNull(ajustes["robo.aviso_ia"]),
    fotoLadoMaximo: limitesFoto(ajustes).ladoMaximo,
    maxCaracteres: num(ajustes["robo.max_caracteres_mensagem"], 600, 50, 4000),
    conversaId: conversa ? String(conversa.id) : null,
    mensagens,
  };
}

type LinhaMensagem = { id: number; papel: "usuario" | "assistente"; conteudo: Record<string, unknown>; criado_em: string };

async function mensagensDaConversa(db: SupabaseClient, conversaId: string, limite: number): Promise<MensagemAki[]> {
  const [{ data }, { data: notas }] = await Promise.all([
    db
      .from("robo_mensagens")
      .select("id, papel, conteudo, criado_em")
      .eq("conversa_id", conversaId)
      .order("id", { ascending: false })
      .limit(limite),
    db.from("robo_avaliacoes").select("mensagem_id, nota"),
  ]);
  const porMensagem = new Map((notas ?? []).map((n) => [Number(n.mensagem_id), n.nota as -1 | 1]));
  return ((data ?? []) as LinhaMensagem[]).reverse().map((m) =>
    m.papel === "usuario"
      ? { id: m.id, papel: "usuario", conteudo: m.conteudo as ConteudoUsuario, criado_em: m.criado_em }
      : { id: m.id, papel: "assistente", conteudo: m.conteudo as ConteudoAssistente, criado_em: m.criado_em, nota: porMensagem.get(m.id) ?? null },
  );
}

/** Rascunhos que o Aki guardou numa resposta (prévia do rascunho ou link com ?rascunho=). */
function rascunhosDaResposta(c: ConteudoAssistente): string[] {
  const ids: string[] = [];
  for (const a of c.acoes ?? []) {
    if (a.tipo === "rascunho" && ehId(a.id)) ids.push(a.id);
    else if (a.tipo === "link" && a.href.includes("rascunho=")) {
      const id = new URL(a.href, "https://x").searchParams.get("rascunho");
      if (id && ehId(id)) ids.push(id);
    }
  }
  return ids;
}

/** Histórico para a IA: só texto (fotos antigas não voltam) e um resumo do que foi mostrado. */
function historicoParaIA(mensagens: MensagemAki[]): MensagemIA[] {
  const saida: MensagemIA[] = [];
  for (const m of mensagens) {
    if (m.papel === "usuario") {
      const t = (m.conteudo.texto ?? "").slice(0, 4000) + (m.conteudo.foto ? "\n[a pessoa mandou uma foto nesta mensagem]" : "");
      saida.push({ papel: "usuario", partes: [{ tipo: "texto", texto: t || "…" }] });
    } else {
      const c = m.conteudo;
      const notas: string[] = [];
      if (c.cartoes?.length) notas.push(`anúncios mostrados (ids): ${c.cartoes.map((x) => x.id).join(", ")}`);
      const [rascunho] = rascunhosDaResposta(c);
      if (rascunho) notas.push(`rascunho_id em andamento: ${rascunho}`);
      const t = (c.texto ?? "").slice(0, 4000) + (notas.length ? `\n[${notas.join("; ")}]` : "");
      saida.push({ papel: "assistente", partes: [{ tipo: "texto", texto: t || "…" }] });
    }
  }
  while (saida.length && saida[0].papel !== "usuario") saida.shift(); // a conversa começa pela pessoa
  return saida;
}

/* ------------------------------ Resposta (POST) ------------------------------ */

export type EntradaResposta = {
  userId: string;
  pedido: { texto: string; conversaId: string | null; foto: PedidoAki["foto"]; rascunhoId: string | null };
  ajustes: Ajustes;
  emitir: (e: EventoAki) => void;
  sinal: AbortSignal;
};

export async function responder({ userId, pedido, ajustes, emitir, sinal }: EntradaResposta): Promise<void> {
  const db = await createClient();
  const admin = supabaseAdmin();
  const tipo = pedido.foto ? "foto" : "conversa";

  // 1) reserva a vez (confere de novo limite, orçamento e robô ligado, com trava por pessoa)
  const { data: reservaDados, error: erroReserva } = await admin.rpc("robo_reservar", { p_usuario: userId, p_tipo: tipo });
  const reserva = (Array.isArray(reservaDados) ? reservaDados[0] : reservaDados) as
    | { pode: boolean; motivo: string | null; uso_id: number | null; usadas_hoje: number; limite_diario: number; provedor: string; modelo: string }
    | undefined;
  if (erroReserva || !reserva) {
    emitir({ tipo: "erro", mensagem: ERROS_PROVEDOR.requisicao });
    return;
  }
  if (!reserva.pode || !reserva.uso_id) {
    const motivo = (reserva.motivo as MotivoBloqueio) ?? "erro";
    emitir({ tipo: "bloqueado", motivo, mensagem: mensagemBloqueio(motivo) });
    return;
  }
  const prov = adaptador(reserva.provedor);
  const restantes = Math.max(0, reserva.limite_diario - reserva.usadas_hoje);

  // 2) contexto da pessoa
  const conta = await meuPerfilEVitrine();
  const perfil = conta?.perfil;
  const { data: reg } = perfil
    ? await db.from("microrregioes").select("id, slug, nome").eq("id", perfil.microrregiao_id).maybeSingle()
    : { data: null };
  const regiao = { id: String(reg?.id ?? perfil?.microrregiao_id ?? ""), slug: (reg?.slug as string | undefined) ?? null, nome: String(reg?.nome ?? "sua região") };
  const cidades = regiao.id ? (await listarCidades(regiao.id)).map((c) => c.nome) : [];

  const [{ data: modeloLinha }, { data: palavras }] = await Promise.all([
    admin.from("robo_modelos").select("fallback_servidor").eq("provedor", reserva.provedor).eq("modelo", reserva.modelo).maybeSingle(),
    // lista da moderação não é pública: só o servidor lê (nunca vai para o navegador nem para a IA)
    admin.rpc("config", { p_chave: "moderacao.palavras_bloqueadas", p_microrregiao: regiao.id || null, p_padrao: null }),
  ]);

  // 3) conversa e histórico
  const maxConversa = num(ajustes["robo.max_conversa_mensagens"], 80, 4, 1000);
  let conversaId: string | null = null;
  let historico: MensagemAki[] = [];
  if (pedido.conversaId && ehId(pedido.conversaId)) {
    const { data: conv } = await db.from("robo_conversas").select("id, total_mensagens").eq("id", pedido.conversaId).maybeSingle();
    if (conv && Number(conv.total_mensagens) < maxConversa) {
      conversaId = String(conv.id);
      historico = await mensagensDaConversa(db, conversaId, num(ajustes["robo.historico_mensagens"], 12, 0, 40));
    }
  }

  // rascunho aberto no cadastro: só vale se for rascunho da própria pessoa
  let rascunhoAberto: string | null = null;
  if (pedido.rascunhoId && ehId(pedido.rascunhoId)) {
    const a = await meuAnuncio(pedido.rascunhoId);
    if (a?.status === "rascunho") rascunhoAberto = a.id;
  }

  const partesUsuario: ParteIA[] = [{ tipo: "texto", texto: pedido.texto || "O que é isto na foto? Quero anunciar." }];
  if (pedido.foto) partesUsuario.unshift({ tipo: "imagem", base64: pedido.foto.base64, mime: pedido.foto.tipo });
  const mensagens: MensagemIA[] = [...historicoParaIA(historico), { papel: "usuario", partes: partesUsuario }];

  const moderador = criarModerador(palavras);
  const maxResposta = num(ajustes["robo.max_caracteres_resposta"], 4000, 200, 20000);
  const maxTokens = num(ajustes["robo.max_tokens_resposta"], 1500, 100, 16000);
  const maxFerramentas = num(ajustes["robo.max_ferramentas"], 5, 0, 10);
  const esforco = textoOuNull(ajustes["robo.anthropic_esforco"]);

  const saida: ContextoFerramentas["saida"] = { cartoes: [], acoes: [], usadas: [] };
  const ctx: ContextoFerramentas = {
    db,
    userId,
    regiao,
    cidades,
    cidadePerfil: perfil?.cidade ?? null,
    rascunhosPermitidos: new Set([
      ...(rascunhoAberto ? [rascunhoAberto] : []),
      ...historico.flatMap((m) => (m.papel === "assistente" ? rascunhosDaResposta(m.conteudo) : [])),
    ]),
    saida,
    registrarBuscaVazia: async (termo, categoria) => {
      await admin.rpc("robo_registrar_busca_vazia", { p_termo: termo, p_microrregiao: regiao.id || null, p_categoria: categoria });
    },
  };

  const controle = new AbortController();
  const pararTudo = () => controle.abort();
  sinal.addEventListener("abort", pararTudo, { once: true });
  const tempo = setTimeout(pararTudo, 55_000);

  let cortado = false;
  const filtro = criarFiltroStream(moderador, (pedaco) => emitir({ tipo: "texto", texto: pedaco }));
  const adicionarTexto = (t: string) => {
    if (cortado) return;
    if (filtro.texto.length + t.length > maxResposta) {
      filtro.adicionar(t.slice(0, Math.max(0, maxResposta - filtro.texto.length)) + "…");
      cortado = true;
      controle.abort(); // resposta grande demais: para de gastar
      return;
    }
    filtro.adicionar(t);
  };

  let uso: UsoIA = usoVazio();
  let erro: string | null = null;
  let erroTela: string | null = null;
  const inicio = Date.now();

  try {
    if (!prov || !prov.temChave()) throw new ErroProvedor("sem_chave", "provedor sem chave");
    const fixo = sistemaFixo(lista(ajustes["robo.temas_proibidos"]));
    const variavel = sistemaVariavel({
      hoje: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      regiao: regiao.nome,
      cidade: perfil?.cidade ?? null,
      nome: perfil?.nome ? perfil.nome.split(" ")[0] : null,
      vende: !!conta?.vitrine,
      foto: !!pedido.foto,
      rascunhoId: rascunhoAberto,
    });

    for (let volta = 0; ; volta++) {
      if (controle.signal.aborted) break; // a pessoa fechou ou o tempo acabou entre uma volta e outra
      if (filtro.texto && !/\s$/.test(filtro.texto)) adicionarTexto("\n\n");
      const resp = await prov.conversar(
        {
          modelo: reserva.modelo,
          sistemaFixo: fixo,
          sistemaVariavel: variavel,
          mensagens,
          ferramentas: maxFerramentas > 0 ? FERRAMENTAS : undefined,
          maxTokens,
          esforco,
          fallbackServidor: modeloLinha?.fallback_servidor === true,
          sinal: controle.signal,
        },
        adicionarTexto,
      );
      uso = somarUso(uso, resp.uso);
      if (cortado) break;
      if (resp.parada === "recusa" && !resp.texto.trim()) {
        adicionarTexto(RESPOSTA_RECUSA);
        break;
      }
      if (resp.parada !== "ferramenta" || !resp.chamadas.length) break;
      if (volta >= maxFerramentas) {
        if (!filtro.texto.trim()) adicionarTexto(RESPOSTA_SEM_FIM);
        break;
      }
      mensagens.push(resp.mensagem);
      const resultados: ParteIA[] = [];
      for (const chamada of resp.chamadas.slice(0, 6)) {
        emitir({ tipo: "pensando", rotulo: rotuloFerramenta(chamada.nome) });
        const r = await executarFerramenta(chamada.nome, lerArgumentos(chamada.argumentosBrutos), ctx);
        resultados.push({ tipo: "resultado", id: chamada.id, conteudo: r.conteudo, erro: r.erro });
      }
      for (const chamada of resp.chamadas.slice(6)) {
        resultados.push({ tipo: "resultado", id: chamada.id, conteudo: JSON.stringify({ erro: "Muitas funções de uma vez." }), erro: true });
      }
      mensagens.push({ papel: "usuario", partes: resultados });
    }
  } catch (e) {
    if (e instanceof ErroProvedor) {
      // chamada cortada no meio também custa: soma o que o provedor já cobrou (ou a estimativa)
      if (e.uso) uso = somarUso(uso, e.uso);
      // antes do ":" vai só o tipo (é o que a pessoa pode ler); o detalhe fica no livro-caixa do admin
      erro = cortado
        ? "cortado: a resposta passou do tamanho máximo"
        : `${e.tipo}${e.status ? ` ${e.status}` : ""}: ${e.message}`.slice(0, 300);
      erroTela = cortado ? null : ERROS_PROVEDOR[e.tipo];
    } else {
      erro = (e instanceof Error ? e.message : "erro").slice(0, 300);
      erroTela = ERROS_PROVEDOR.requisicao;
    }
    if (sinal.aborted) erroTela = null; // a pessoa fechou: não há para quem mostrar
  } finally {
    clearTimeout(tempo);
    sinal.removeEventListener("abort", pararTudo);
  }

  filtro.terminar();
  let textoFinal = filtro.texto.trim();
  if (filtro.bloqueado) {
    textoFinal = RESPOSTA_BLOQUEADA;
    emitir({ tipo: "substituir", texto: textoFinal });
  } else if (!textoFinal && !erroTela) {
    textoFinal = saida.cartoes.length ? "Veja o que achei:" : RESPOSTA_SEM_FIM;
    emitir({ tipo: "texto", texto: textoFinal });
  }
  if (saida.cartoes.length) emitir({ tipo: "cartoes", cartoes: saida.cartoes });
  if (saida.acoes.length) emitir({ tipo: "acoes", acoes: saida.acoes });
  if (erroTela) emitir({ tipo: "erro", mensagem: erroTela });

  // 4) grava pergunta, resposta e custo (o custo é calculado no banco)
  const pergunta: ConteudoUsuario = { texto: pedido.texto, foto: !!pedido.foto };
  const resposta: ConteudoAssistente = {
    texto: textoFinal || erroTela || "",
    ...(saida.cartoes.length ? { cartoes: saida.cartoes } : {}),
    ...(saida.acoes.length ? { acoes: saida.acoes as AcaoAki[] } : {}),
    ...(saida.usadas.length ? { ferramentas: [...new Set(saida.usadas)] } : {}),
  };
  let mensagemId: number | null = null;
  try {
    const { data, error } = await admin.rpc("robo_registrar_resposta", {
      p_usuario: userId,
      p_conversa: conversaId,
      p_tipo: tipo,
      p_provedor: reserva.provedor,
      p_modelo: reserva.modelo,
      p_tokens_entrada: uso.entrada,
      p_tokens_saida: uso.saida,
      p_tokens_cache_leitura: uso.cacheLeitura,
      p_tokens_cache_escrita: uso.cacheEscrita,
      p_pergunta: pergunta,
      p_resposta: resposta,
      p_latencia_ms: Date.now() - inicio,
      p_erro: erro,
      p_uso_id: reserva.uso_id,
    });
    const linha = Array.isArray(data) ? data[0] : data;
    if (!error && linha) {
      conversaId = linha.conversa_id ? String(linha.conversa_id) : conversaId;
      mensagemId = linha.mensagem_id == null ? null : Number(linha.mensagem_id);
    }
  } catch {
    // sem registro a resposta já foi mostrada; a reserva fica contando no limite do dia
  }
  emitir({ tipo: "fim", conversaId, mensagemId, restantes });
}

