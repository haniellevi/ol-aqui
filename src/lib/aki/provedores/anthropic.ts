import "server-only";
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

// Anthropic Messages API por fetch, com streaming (SSE).
// Cache de prompt: o bloco fixo do sistema leva cache_control, então ferramentas + instruções fixas
// (que vêm antes dele) ficam no cache; o cache automático do topo cobre a conversa.
// No laço de ferramentas, os blocos da resposta (inclusive "thinking") voltam sem mudança.

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSAO_API = "2023-06-01";
const BETA_FALLBACK = "server-side-fallback-2026-07-01";

type Bloco = Record<string, unknown> & { type: string };

function paraAnthropic(m: MensagemIA): { role: "user" | "assistant"; content: Bloco[] } {
  if (m.papel === "assistente" && m.nativo?.provedor === "anthropic" && Array.isArray(m.nativo.dados)) {
    return { role: "assistant", content: m.nativo.dados as Bloco[] };
  }
  const content: Bloco[] = [];
  for (const p of m.partes) {
    if (p.tipo === "texto") {
      if (p.texto) content.push({ type: "text", text: p.texto });
    } else if (p.tipo === "imagem") {
      content.push({ type: "image", source: { type: "base64", media_type: p.mime, data: p.base64 } });
    } else if (p.tipo === "chamada") {
      content.push({ type: "tool_use", id: p.id, name: p.nome, input: p.argumentos ?? {} });
    } else if (p.tipo === "resultado") {
      content.push({ type: "tool_result", tool_use_id: p.id, content: p.conteudo, ...(p.erro ? { is_error: true } : {}) });
    }
  }
  if (!content.length) content.push({ type: "text", text: "…" });
  return { role: m.papel === "usuario" ? "user" : "assistant", content };
}

export const anthropic: ProvedorIAAdaptador = {
  nome: "anthropic",
  temChave: () => !!process.env.ANTHROPIC_API_KEY,

  async conversar(pedido: PedidoIA, aoTexto: (pedaco: string) => void): Promise<RespostaIA> {
    const chave = process.env.ANTHROPIC_API_KEY;
    if (!chave) throw new ErroProvedor("sem_chave", "ANTHROPIC_API_KEY ausente");

    const system: Bloco[] = [{ type: "text", text: pedido.sistemaFixo, cache_control: { type: "ephemeral" } }];
    if (pedido.sistemaVariavel) system.push({ type: "text", text: pedido.sistemaVariavel });

    const corpo: Record<string, unknown> = {
      model: pedido.modelo,
      max_tokens: pedido.maxTokens,
      stream: true,
      system,
      messages: pedido.mensagens.map(paraAnthropic),
      cache_control: { type: "ephemeral" },
    };
    if (pedido.ferramentas?.length) {
      corpo.tools = pedido.ferramentas.map((f) => ({ name: f.nome, description: f.descricao, input_schema: f.parametros }));
      corpo.tool_choice = { type: "auto" };
    }
    if (pedido.esforco && ["low", "medium", "high"].includes(pedido.esforco)) {
      corpo.output_config = { effort: pedido.esforco };
    }
    const cabecalhos: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": chave,
      "anthropic-version": VERSAO_API,
    };
    if (pedido.fallbackServidor) {
      corpo.fallbacks = "default";
      cabecalhos["anthropic-beta"] = BETA_FALLBACK;
    }

    // cancelado antes de sair: nada foi mandado, nada é cobrado
    if (pedido.sinal?.aborted) throw new ErroProvedor("tempo", "cancelado antes de enviar");
    let resposta: Response;
    try {
      resposta = await fetch(URL_API, { method: "POST", headers: cabecalhos, body: JSON.stringify(corpo), signal: pedido.sinal });
    } catch (e) {
      // o pedido pode ter chegado ao provedor antes de cair: cobra a entrada estimada
      throw comUso(e, usoAposFalha(pedido, usoVazio(), false, false), !!pedido.sinal?.aborted, "falha de rede");
    }
    // erro HTTP (chave, limite, sobrecarga): o provedor não cobra
    if (!resposta.ok) throw erroDeStatus(resposta.status, await resposta.text().catch(() => ""));

    const blocos: (Bloco & { _json?: string })[] = [];
    const uso: UsoIA = usoVazio();
    let viuUso = false;
    let texto = "";
    let parada: RespostaIA["parada"] = "fim";
    let modeloUsado = pedido.modelo;
    let erroStream: string | null = null;

    const lerUso = (u: Record<string, unknown> | undefined) => {
      if (!u) return;
      viuUso = true;
      // os números chegam acumulados (message_start e depois message_delta): fica o maior
      uso.entrada = Math.max(uso.entrada, numeroOuZero(u.input_tokens));
      uso.saida = Math.max(uso.saida, numeroOuZero(u.output_tokens));
      uso.cacheLeitura = Math.max(uso.cacheLeitura, numeroOuZero(u.cache_read_input_tokens));
      uso.cacheEscrita = Math.max(uso.cacheEscrita, numeroOuZero(u.cache_creation_input_tokens));
    };

    try {
      await lerSSE(resposta, (_evento, dados) => {
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(dados);
        } catch {
          return;
        }
        switch (ev.type) {
          case "message_start": {
            const msg = ev.message as Record<string, unknown> | undefined;
            if (typeof msg?.model === "string") modeloUsado = msg.model;
            lerUso(msg?.usage as Record<string, unknown> | undefined);
            break;
          }
          case "content_block_start": {
            const i = Number(ev.index);
            const b = { ...(ev.content_block as Bloco) };
            if (b.type === "text") b.text = "";
            if (b.type === "thinking") b.thinking = typeof b.thinking === "string" ? b.thinking : "";
            if (b.type === "tool_use") b._json = "";
            blocos[i] = b;
            break;
          }
          case "content_block_delta": {
            const b = blocos[Number(ev.index)];
            const d = ev.delta as Record<string, unknown> | undefined;
            if (!b || !d) break;
            if (d.type === "text_delta" && typeof d.text === "string") {
              b.text = String(b.text ?? "") + d.text;
              texto += d.text;
              aoTexto(d.text);
            } else if (d.type === "input_json_delta" && typeof d.partial_json === "string") {
              b._json = (b._json ?? "") + d.partial_json;
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string") {
              b.thinking = String(b.thinking ?? "") + d.thinking;
            } else if (d.type === "signature_delta" && typeof d.signature === "string") {
              b.signature = d.signature;
            }
            break;
          }
          case "message_delta": {
            const d = ev.delta as Record<string, unknown> | undefined;
            const motivo = d?.stop_reason;
            if (motivo === "tool_use") parada = "ferramenta";
            else if (motivo === "max_tokens") parada = "limite";
            else if (motivo === "refusal") parada = "recusa";
            else if (motivo) parada = "fim";
            lerUso(ev.usage as Record<string, unknown> | undefined);
            break;
          }
          case "error": {
            const err = ev.error as Record<string, unknown> | undefined;
            erroStream = `${String(err?.type ?? "erro")}: ${String(err?.message ?? "")}`.slice(0, 300);
            break;
          }
        }
      });
    } catch (e) {
      // cortado no meio (tela fechada, tempo, resposta grande demais): cobra o que já foi lido
      throw comUso(e, usoAposFalha(pedido, uso, viuUso, true), !!pedido.sinal?.aborted, "falha no streaming");
    }
    if (erroStream) {
      const sobrecarga = /overloaded|api_error/i.test(erroStream);
      throw new ErroProvedor(sobrecarga ? "sobrecarga" : "requisicao", erroStream, undefined, usoAposFalha(pedido, uso, viuUso, true));
    }

    const chamadas: ChamadaIA[] = [];
    const nativo: Bloco[] = [];
    for (const b of blocos) {
      if (!b) continue;
      if (b.type === "tool_use") {
        const bruto = b._json ?? "";
        let input: unknown = {};
        try {
          input = bruto.trim() ? JSON.parse(bruto) : {};
        } catch {
          input = {};
        }
        chamadas.push({ id: String(b.id), nome: String(b.name), argumentosBrutos: bruto });
        nativo.push({ type: "tool_use", id: b.id, name: b.name, input });
      } else {
        const limpo = { ...b };
        delete limpo._json;
        nativo.push(limpo);
      }
    }
    if (chamadas.length && parada === "fim") parada = "ferramenta";

    return {
      texto,
      chamadas,
      uso,
      parada,
      modeloUsado,
      mensagem: {
        papel: "assistente",
        partes: [{ tipo: "texto", texto }],
        nativo: { provedor: "anthropic", dados: nativo },
      },
    };
  },
};
