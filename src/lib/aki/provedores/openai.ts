import "server-only";
import { SITE } from "@/lib/formato";
import {
  ErroProvedor,
  comUso,
  erroDeStatus,
  lerSSE,
  numeroOuZero,
  usoAposFalha,
  usoVazio,
  type ChamadaIA,
  type MensagemIA,
  type PedidoIA,
  type ProvedorIAAdaptador,
  type RespostaIA,
  type UsoIA,
} from "./base";
import type { ProvedorIA } from "@/lib/aki/tipos";

// Formato "Chat Completions" (OpenAI). O OpenRouter usa o mesmo formato com outro endereço,
// então os dois adaptadores saem desta mesma função.

type MensagemOA = Record<string, unknown> & { role: string };

function paraOpenAI(m: MensagemIA): MensagemOA[] {
  if (m.papel === "assistente") {
    const texto = m.partes.filter((p) => p.tipo === "texto").map((p) => (p.tipo === "texto" ? p.texto : "")).join("");
    const chamadas = m.partes.flatMap((p) =>
      p.tipo === "chamada"
        ? [{ id: p.id, type: "function", function: { name: p.nome, arguments: JSON.stringify(p.argumentos ?? {}) } }]
        : [],
    );
    const msg: MensagemOA = { role: "assistant", content: texto || null };
    if (chamadas.length) msg.tool_calls = chamadas;
    return [msg];
  }
  // usuário: resultados de ferramenta viram mensagens "tool"; texto e imagem vão juntos
  const saida: MensagemOA[] = [];
  const conteudo: Record<string, unknown>[] = [];
  for (const p of m.partes) {
    if (p.tipo === "resultado") saida.push({ role: "tool", tool_call_id: p.id, content: p.conteudo });
    else if (p.tipo === "texto" && p.texto) conteudo.push({ type: "text", text: p.texto });
    else if (p.tipo === "imagem") conteudo.push({ type: "image_url", image_url: { url: `data:${p.mime};base64,${p.base64}` } });
  }
  if (conteudo.length) saida.push({ role: "user", content: conteudo });
  return saida;
}

function criarAdaptador(nome: ProvedorIA, url: string, variavel: string, extras?: () => Record<string, string>): ProvedorIAAdaptador {
  return {
    nome,
    temChave: () => !!process.env[variavel],

    async conversar(pedido: PedidoIA, aoTexto: (pedaco: string) => void): Promise<RespostaIA> {
      const chave = process.env[variavel];
      if (!chave) throw new ErroProvedor("sem_chave", `${variavel} ausente`);

      const sistema = [pedido.sistemaFixo, pedido.sistemaVariavel].filter(Boolean).join("\n\n");
      const corpo: Record<string, unknown> = {
        model: pedido.modelo,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "system", content: sistema }, ...pedido.mensagens.flatMap(paraOpenAI)],
      };
      // OpenAI usa max_completion_tokens; o OpenRouter aceita max_tokens
      corpo[nome === "openai" ? "max_completion_tokens" : "max_tokens"] = pedido.maxTokens;
      if (pedido.ferramentas?.length) {
        corpo.tools = pedido.ferramentas.map((f) => ({
          type: "function",
          function: { name: f.nome, description: f.descricao, parameters: f.parametros },
        }));
        corpo.tool_choice = "auto";
      }

      // cancelado antes de sair: nada foi mandado, nada é cobrado
      if (pedido.sinal?.aborted) throw new ErroProvedor("tempo", "cancelado antes de enviar");
      let resposta: Response;
      try {
        resposta = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${chave}`, ...(extras?.() ?? {}) },
          body: JSON.stringify(corpo),
          signal: pedido.sinal,
        });
      } catch (e) {
        // o pedido pode ter chegado ao provedor antes de cair: cobra a entrada estimada
        throw comUso(e, usoAposFalha(pedido, usoVazio(), false, false), !!pedido.sinal?.aborted, "falha de rede");
      }
      // erro HTTP (chave, limite, sobrecarga): o provedor não cobra
      if (!resposta.ok) throw erroDeStatus(resposta.status, await resposta.text().catch(() => ""));

      let texto = "";
      let parada: RespostaIA["parada"] = "fim";
      let modeloUsado = pedido.modelo;
      const uso: UsoIA = usoVazio();
      let viuUso = false; // neste formato o uso só chega no fim
      const chamadasPorIndice = new Map<number, { id: string; nome: string; args: string }>();
      let erroStream: string | null = null;

      try {
        await lerSSE(resposta, (_evento, dados) => {
          if (dados.trim() === "[DONE]") return;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(dados);
          } catch {
            return;
          }
          if (ev.error) {
            const err = ev.error as Record<string, unknown>;
            erroStream = String(err.message ?? "erro do provedor").slice(0, 300);
            return;
          }
          if (typeof ev.model === "string") modeloUsado = ev.model;
          const u = ev.usage as Record<string, unknown> | undefined | null;
          if (u) {
            viuUso = true;
            const detalhes = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
            const cache = numeroOuZero(detalhes.cached_tokens);
            uso.entrada = Math.max(0, numeroOuZero(u.prompt_tokens) - cache);
            uso.cacheLeitura = cache;
            uso.saida = numeroOuZero(u.completion_tokens);
          }
          const escolha = Array.isArray(ev.choices) ? (ev.choices[0] as Record<string, unknown> | undefined) : undefined;
          if (!escolha) return;
          const delta = (escolha.delta ?? {}) as Record<string, unknown>;
          if (typeof delta.content === "string" && delta.content) {
            texto += delta.content;
            aoTexto(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls as Record<string, unknown>[]) {
              const i = Number(tc.index ?? 0);
              const atual = chamadasPorIndice.get(i) ?? { id: "", nome: "", args: "" };
              const fn = (tc.function ?? {}) as Record<string, unknown>;
              if (typeof tc.id === "string" && tc.id) atual.id = tc.id;
              if (typeof fn.name === "string" && fn.name) atual.nome = fn.name;
              if (typeof fn.arguments === "string") atual.args += fn.arguments;
              chamadasPorIndice.set(i, atual);
            }
          }
          const fim = escolha.finish_reason;
          if (fim === "tool_calls") parada = "ferramenta";
          else if (fim === "length") parada = "limite";
          else if (fim === "content_filter") parada = "recusa";
          else if (typeof fim === "string") parada = "fim";
        });
      } catch (e) {
        // cortado no meio (tela fechada, tempo, resposta grande demais): cobra o que já foi lido
        throw comUso(e, usoAposFalha(pedido, uso, viuUso, true), !!pedido.sinal?.aborted, "falha no streaming");
      }
      if (erroStream) throw new ErroProvedor("requisicao", erroStream, undefined, usoAposFalha(pedido, uso, viuUso, true));

      const chamadas: ChamadaIA[] = [...chamadasPorIndice.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, c]) => ({ id: c.id || `chamada_${i}`, nome: c.nome, argumentosBrutos: c.args }));
      if (chamadas.length && parada === "fim") parada = "ferramenta";

      const partes: MensagemIA["partes"] = [{ tipo: "texto", texto }];
      for (const c of chamadas) {
        let argumentos: unknown = {};
        try {
          argumentos = c.argumentosBrutos.trim() ? JSON.parse(c.argumentosBrutos) : {};
        } catch {
          argumentos = {};
        }
        partes.push({ tipo: "chamada", id: c.id, nome: c.nome, argumentos });
      }
      return { texto, chamadas, uso, parada, modeloUsado, mensagem: { papel: "assistente", partes } };
    },
  };
}

export const openai = criarAdaptador("openai", "https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY");

export const openrouter = criarAdaptador("openrouter", "https://openrouter.ai/api/v1/chat/completions", "OPENROUTER_API_KEY", () => ({
  // identificação opcional do site no OpenRouter
  "HTTP-Referer": SITE,
  "X-Title": "Mercado da Região",
}));
