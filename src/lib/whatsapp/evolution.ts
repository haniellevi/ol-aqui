import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Webhook de entrada da Evolution (WhatsApp): quem pede para sair deixa de receber o aviso do Radar.
// O segredo vem em Authorization: Bearer <EVOLUTION_WEBHOOK_SEGREDO> (32 caracteres ou mais).

export const COMANDOS_SAIDA = ["SAIR", "PARAR", "STOP", "CANCELAR"] as const;
export type ComandoSaida = (typeof COMANDOS_SAIDA)[number];

const MAX_CARACTERES_SAIDA = 80;

// Palavras de cortesia ou de tempo que não mudam o pedido: "sair, por favor, obrigado" é "sair".
const ENFEITES = new Set(["por", "favor", "pfv", "pf", "obrigado", "obrigada", "agora", "daqui", "muito", "please", "gentileza"]);

// Verbo de saída → comando guardado no banco (whatsapp_sair).
const VERBO_SAIDA: Readonly<Record<string, ComandoSaida>> = {
  sair: "SAIR", sai: "SAIR", saia: "SAIR",
  remover: "SAIR", remova: "SAIR", remove: "SAIR",
  tirar: "SAIR", tira: "SAIR", tire: "SAIR",
  retirar: "SAIR", retira: "SAIR", retire: "SAIR",
  descadastrar: "SAIR", descadastra: "SAIR", descadastre: "SAIR",
  desinscrever: "SAIR", desinscreva: "SAIR", desinscreve: "SAIR",
  parar: "PARAR", pare: "PARAR",
  stop: "STOP",
  cancelar: "CANCELAR", cancela: "CANCELAR", cancele: "CANCELAR",
};

// Só estas palavras podem vir depois do verbo: "remover meu número", "tira da lista", "sair do radar".
// Qualquer outra (anúncio, casa, loja) tira a mensagem do pedido de saída.
const COMPLEMENTO = "me|meu|minha|nome|numero|contato|da|do|dos|das|lista|listagem|aviso|avisos|radar|mensagem|mensagens|mais|pelo|whatsapp|zap";
const SUFIXO = "(?: (?:mais|mensagem|mensagens|avisos?|pedidos?|pelo whatsapp|no whatsapp))*";
const PEDIDO_COM_VERBO = new RegExp(
  `^(?:(?:quero|queria|eu quero|gostaria de|pode|podem) )?(?:me )?(${Object.keys(VERBO_SAIDA).join("|")})(?: (?:${COMPLEMENTO}))*$`,
);
// "para de mandar", "pare de me mandar mensagem"
const PARAR_DE = new RegExp(
  `^(?:(?:quero|queria|pode|podem) )?(?:parar|pare|para) de (?:me )?(?:mandar|mande|enviar|envie|mandando|enviando|incomodar)${SUFIXO}$`,
);
// "não quero mais receber", "nao quero mais", "nao quero receber mais"
const NAO_QUERO = new RegExp(`^nao quero mais(?: receber)?${SUFIXO}$|^nao quero receber(?: mais)?${SUFIXO}$`);
// "não me mande mais"
const NAO_ME_MANDE = new RegExp(`^nao me (?:mande|mandem|manda|mandar|envie|enviem|envia|enviar)(?: mais)?${SUFIXO}$`);

/** Segredo do webhook. Sem ele, ou curto demais, o webhook responde 503 e não aceita nada. */
export function segredoEvolution(): string | null {
  const segredo = process.env.EVOLUTION_WEBHOOK_SEGREDO?.trim();
  return segredo && segredo.length >= 32 ? segredo : null;
}

/** Confere o cabeçalho em tempo constante (resumo sha256: mesmo tamanho sempre). */
export function cabecalhoEvolutionConfere(recebido: string | null, segredo: string | null): boolean {
  if (!segredo || !recebido) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(recebido), hash(`Bearer ${segredo}`));
}

/** Sem acento, minúsculo, pontuação e símbolos viram espaço. "SAIR!" vira "sair"; "Pare, por favor" vira "pare por favor". */
export function normalizarTextoSaida(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function comandoDoTextoNormalizado(normal: string): ComandoSaida | null {
  const verbo = PEDIDO_COM_VERBO.exec(normal);
  if (verbo) return VERBO_SAIDA[verbo[1]] ?? null;
  if (PARAR_DE.test(normal)) return "PARAR";
  if (NAO_QUERO.test(normal) || NAO_ME_MANDE.test(normal)) return "SAIR";
  return null;
}

/**
 * Pedido de saída: a mensagem inteira tem de ser um pedido. Valem "sair", "SAIR!", "quero sair", "quero sair daqui",
 * "pare por favor", "para de mandar", "não quero mais receber", "remover meu número".
 * Não valem quando o verbo aparece dentro de uma conversa: "vou sair de casa", "posso remover o anúncio",
 * "quero cancelar meu anúncio", "não quero sair", "sairia", "parabéns", "stopwatch". Texto acima de 80 caracteres: não.
 */
export function comandoDeSaida(texto: unknown): ComandoSaida | null {
  if (typeof texto !== "string" || texto.length > MAX_CARACTERES_SAIDA) return null;
  const palavras = normalizarTextoSaida(texto).split(" ").filter((p) => p && !ENFEITES.has(p));
  if (palavras.length === 0) return null;
  return comandoDoTextoNormalizado(palavras.join(" "));
}

/** Só conversa de pessoa (@s.whatsapp.net) com celular brasileiro. Grupo, lista ou número estranho: null. */
export function numeroDoRemetente(remoteJid: unknown): string | null {
  if (typeof remoteJid !== "string") return null;
  const m = /^(\d+)@s\.whatsapp\.net$/.exec(remoteJid);
  if (!m) return null;
  return /^55[1-9]\d9?\d{8}$/.test(m[1]) ? m[1] : null;
}

/** Número de um campo alternativo: "5589...@s.whatsapp.net" ou só os dígitos. Mesma regra de numeroDoRemetente. */
function numeroDeCampoAlternativo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return numeroDoRemetente(`${valor.trim().replace(/@s\.whatsapp\.net$/, "")}@s.whatsapp.net`);
}

export type ChaveDaMensagem = { remoteJid?: unknown; remoteJidAlt?: unknown; senderPn?: unknown; senderPN?: unknown };

/**
 * Número da conversa. Conversa com identificador @lid (a Evolution v2 pode mandar só o identificador oculto):
 * o número real vem em remoteJidAlt, senderPn ou senderPN (a grafia muda entre versões), nessa ordem. Grupo (@g.us) não entra.
 */
export function numeroDaConversa(key: ChaveDaMensagem): string | null {
  if (typeof key.remoteJid === "string" && key.remoteJid.endsWith("@lid")) {
    return numeroDeCampoAlternativo(key.remoteJidAlt) ?? numeroDeCampoAlternativo(key.senderPn) ?? numeroDeCampoAlternativo(key.senderPN);
  }
  return numeroDoRemetente(key.remoteJid);
}

type MensagemRecebida = { key: ChaveDaMensagem & { fromMe?: unknown }; texto: unknown };

/** Lê o evento só se for mensagem recebida (messages.upsert, fromMe falso). Outros eventos e mensagens nossas: null. */
function mensagemRecebida(corpo: unknown): MensagemRecebida | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { event, data } = corpo as { event?: unknown; data?: unknown };
  if (typeof event !== "string" || event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;
  if (!data || typeof data !== "object") return null;
  const { key, message } = data as {
    key?: ChaveDaMensagem & { fromMe?: unknown };
    message?: { conversation?: unknown; extendedTextMessage?: { text?: unknown } };
  };
  if (!key || key.fromMe !== false) return null;
  return { key, texto: message?.conversation ?? message?.extendedTextMessage?.text };
}

/** Pedido de saída com número legível: { numero, comando }. Qualquer outra coisa: null. */
export function pedidoDeSaida(corpo: unknown): { numero: string; comando: ComandoSaida } | null {
  const msg = mensagemRecebida(corpo);
  if (!msg) return null;
  const comando = comandoDeSaida(msg.texto);
  const numero = numeroDaConversa(msg.key);
  return comando && numero ? { numero, comando } : null;
}

/**
 * Diagnóstico para o log: a frase é um pedido de saída, mas o número não pode ser lido (conversa @lid sem campo de número).
 * Não devolve número nem texto; a rota só registra o fato, para o teste real mostrar o problema logo.
 */
export function saidaSemNumeroLegivel(corpo: unknown): boolean {
  const msg = mensagemRecebida(corpo);
  if (!msg || typeof msg.key.remoteJid !== "string" || msg.key.remoteJid.endsWith("@g.us")) return false;
  return comandoDeSaida(msg.texto) !== null && numeroDaConversa(msg.key) === null;
}

// VOLTAR, SIM e outras mensagens: o banco (whatsapp_mensagem_recebida) decide a resposta. Aqui só se lê o que a pessoa pediu.
export type IntencaoMensagem = "sair" | "voltar" | "sim" | "outra";

// Frase inteira, depois de tirar acento, caixa, pontuação e as palavras de cortesia. "voltar amanhã na loja" não vale.
const FRASES_VOLTAR = new Set([
  "voltar", "volta", "quero voltar", "ativar", "ativa", "reativar", "quero receber", "quero receber de novo", "voltar a receber", "ligar", "religar",
]);
// "sim" só conta como volta quando há uma pergunta de volta pendente (decide o banco). Fora disso é outra mensagem.
const FRASES_SIM = new Set(["sim", "s", "sim quero", "pode", "quero"]);

function fraseDaMensagem(texto: string): string {
  return normalizarTextoSaida(texto).split(" ").filter((p) => p && !ENFEITES.has(p)).join(" ");
}

/** Intenção de uma mensagem recebida: "sair" (mesmas regras de comandoDeSaida), "voltar", "sim" ou "outra". Sem texto: "outra". */
export function intencaoDaMensagem(texto: unknown): IntencaoMensagem {
  if (comandoDeSaida(texto)) return "sair";
  if (typeof texto !== "string" || texto.length > MAX_CARACTERES_SAIDA) return "outra";
  const frase = fraseDaMensagem(texto);
  if (FRASES_VOLTAR.has(frase)) return "voltar";
  if (FRASES_SIM.has(frase)) return "sim";
  return "outra";
}

export type PedidoDeMensagem =
  | { numero: string; intencao: "sair"; comando: ComandoSaida }
  | { numero: string; intencao: "voltar" | "sim" | "outra" };

/** Mensagem recebida de pessoa com número legível, com a intenção dela. Mensagem nossa, de grupo ou sem número: null. */
export function pedidoDeMensagem(corpo: unknown): PedidoDeMensagem | null {
  const msg = mensagemRecebida(corpo);
  if (!msg) return null;
  const numero = numeroDaConversa(msg.key);
  if (!numero) return null;
  const intencao = intencaoDaMensagem(msg.texto);
  if (intencao === "sair") {
    const comando = comandoDeSaida(msg.texto);
    return comando ? { numero, intencao, comando } : null;
  }
  return { numero, intencao };
}
