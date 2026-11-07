import "server-only";
import type { ProvedorIA } from "@/lib/aki/tipos";

// Uma interface só para os três provedores de IA. Cada adaptador fala com a API do provedor
// por fetch (sem pacote extra), manda o texto aos pedaços (streaming) e devolve as chamadas de
// ferramenta e o uso de tokens. Quem calcula o custo é o banco (robo_registrar_resposta).

/** Parte de uma mensagem neutra (sem formato de provedor). */
export type ParteIA =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; base64: string; mime: "image/webp" | "image/jpeg" | "image/png" }
  | { tipo: "chamada"; id: string; nome: string; argumentos: unknown }
  | { tipo: "resultado"; id: string; conteudo: string; erro?: boolean };

export type MensagemIA = {
  papel: "usuario" | "assistente";
  partes: ParteIA[];
  /**
   * Conteúdo da resposta no formato do próprio provedor (ex.: blocos "thinking" da Anthropic),
   * devolvido sem mudança dentro do laço de ferramentas da mesma resposta.
   */
  nativo?: { provedor: ProvedorIA; dados: unknown };
};

export type FerramentaIA = {
  nome: string;
  descricao: string;
  /** JSON Schema dos argumentos (objeto). */
  parametros: Record<string, unknown>;
};

export type PedidoIA = {
  modelo: string;
  /** Parte fixa das instruções (vai para o cache de prompt quando o provedor tem). */
  sistemaFixo: string;
  /** Parte que muda (data, região, nome da pessoa): fica depois do cache. */
  sistemaVariavel?: string;
  mensagens: MensagemIA[];
  ferramentas?: FerramentaIA[];
  maxTokens: number;
  /** Só Anthropic: low | medium | high (null = padrão do modelo). */
  esforco?: string | null;
  /** Só Anthropic: outro modelo responde se este recusar (beta do servidor). */
  fallbackServidor?: boolean;
  sinal?: AbortSignal;
};

export type UsoIA = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };

export type ChamadaIA = { id: string; nome: string; argumentosBrutos: string };

export type RespostaIA = {
  texto: string;
  chamadas: ChamadaIA[];
  uso: UsoIA;
  /** fim = acabou; ferramenta = quer usar ferramentas; limite = cortou no máximo de tokens; recusa = a IA recusou. */
  parada: "fim" | "ferramenta" | "limite" | "recusa";
  /** Mensagem do assistente pronta para voltar ao provedor no laço de ferramentas. */
  mensagem: MensagemIA;
  modeloUsado: string;
};

export interface ProvedorIAAdaptador {
  nome: ProvedorIA;
  /** A chave de API está na variável de ambiente? */
  temChave(): boolean;
  /** Chama a IA com streaming. `aoTexto` recebe cada pedaço de texto. */
  conversar(pedido: PedidoIA, aoTexto: (pedaco: string) => void): Promise<RespostaIA>;
}

/** Erro do provedor já classificado (a tela mostra uma frase amigável, nunca o detalhe). */
export class ErroProvedor extends Error {
  constructor(
    public readonly tipo: "sem_chave" | "limite" | "sobrecarga" | "requisicao" | "rede" | "tempo",
    detalhe: string,
    public readonly status?: number,
  ) {
    super(detalhe);
    this.name = "ErroProvedor";
  }
}

export const usoVazio = (): UsoIA => ({ entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 });

export function somarUso(a: UsoIA, b: UsoIA): UsoIA {
  return {
    entrada: a.entrada + b.entrada,
    saida: a.saida + b.saida,
    cacheLeitura: a.cacheLeitura + b.cacheLeitura,
    cacheEscrita: a.cacheEscrita + b.cacheEscrita,
  };
}

/** Classifica um status HTTP de erro do provedor. */
export function erroDeStatus(status: number, corpo: string): ErroProvedor {
  const detalhe = `HTTP ${status}: ${corpo.slice(0, 300)}`;
  if (status === 401 || status === 403) return new ErroProvedor("sem_chave", detalhe, status);
  if (status === 429) return new ErroProvedor("limite", detalhe, status);
  if (status >= 500) return new ErroProvedor("sobrecarga", detalhe, status);
  return new ErroProvedor("requisicao", detalhe, status);
}

/**
 * Lê uma resposta em Server-Sent Events e chama `aoEvento` com o nome do evento e o texto do "data".
 * Funciona com os dois formatos (Anthropic usa "event:" + "data:"; OpenAI só "data:").
 */
export async function lerSSE(
  resposta: Response,
  aoEvento: (evento: string | null, dados: string) => void,
): Promise<void> {
  if (!resposta.body) throw new ErroProvedor("rede", "Resposta sem corpo.");
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  const processar = (bloco: string) => {
    let evento: string | null = null;
    const dados: string[] = [];
    for (const linha of bloco.split(/\r?\n/)) {
      if (linha.startsWith("event:")) evento = linha.slice(6).trim();
      else if (linha.startsWith("data:")) dados.push(linha.slice(5).replace(/^ /, ""));
    }
    if (dados.length) aoEvento(evento, dados.join("\n"));
  };
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    resto += decodificador.decode(value, { stream: true });
    let fim: number;
    while ((fim = resto.search(/\r?\n\r?\n/)) >= 0) {
      const bloco = resto.slice(0, fim);
      resto = resto.slice(fim).replace(/^\r?\n\r?\n/, "");
      processar(bloco);
    }
  }
  resto += decodificador.decode();
  if (resto.trim()) processar(resto);
}

/** Lê o JSON dos argumentos de uma ferramenta. Inválido → null (a ferramenta responde com erro). */
export function lerArgumentos(bruto: string): Record<string, unknown> | null {
  if (!bruto.trim()) return {};
  try {
    const v = JSON.parse(bruto);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const numeroOuZero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
