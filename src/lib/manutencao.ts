// Modo de manutenção (docs/PLANO-CLERK-PRODUCAO.md, Fase 4).
// Ligado com MANUTENCAO=1 na Vercel (vale no próximo deploy). Enquanto ligado, ninguém usa o site:
// páginas mostram /manutencao e as APIs respondem 503. A equipe entra com o código de MANUTENCAO_CODIGO,
// que vira um cookie assinado (o código em si nunca vai para o cookie nem para a URL).
// Usa só Web Crypto: roda igual no middleware e nas ações do servidor.

export const COOKIE_MANUTENCAO = "mdr_manutencao";
export const PAGINA_MANUTENCAO = "/manutencao";
/** O cookie da equipe dura 12 horas. */
export const DURACAO_LIBERACAO_S = 12 * 60 * 60;
const MINIMO_CODIGO = 16;

type Env = Record<string, string | undefined>;

export function manutencaoLigada(env: Env = process.env): boolean {
  return env.MANUTENCAO === "1";
}

/** Código da equipe, só se for forte o bastante. Sem código válido, ninguém passa. */
function codigoEquipe(env: Env): string | null {
  const codigo = env.MANUTENCAO_CODIGO?.trim();
  return codigo && codigo.length >= MINIMO_CODIGO ? codigo : null;
}

/** A equipe consegue entrar? (MANUTENCAO_CODIGO existe e tem 16 caracteres ou mais.) */
export function codigoEquipeConfigurado(env: Env = process.env): boolean {
  return codigoEquipe(env) !== null;
}

/** Caminhos que funcionam mesmo em manutenção. */
function liberadoSempre(caminho: string): boolean {
  return (
    caminho === PAGINA_MANUTENCAO ||
    caminho === "/robots.txt" ||
    // Pagamentos: o Asaas pausa a fila de avisos se receber muitos erros seguidos.
    // Não depende do Clerk nem cria perfil.
    caminho === "/api/asaas/webhook" ||
    // WhatsApp de entrada (Evolution): responde SAIR/PARAR; o próprio webhook confere o segredo.
    caminho === "/api/whatsapp/evolution"
  );
}

/**
 * "seguir": site normal (com Clerk). "livre": passa sem o Clerk (nenhum login, nenhum handshake).
 * "pagina": mostra /manutencao. "api": responde 503.
 */
export type Decisao = "seguir" | "livre" | "pagina" | "api";

/** O que o middleware faz com o pedido. */
export function decidirManutencao(caminho: string, ligada: boolean, equipe: boolean): Decisao {
  if (!ligada || equipe) return "seguir";
  if (liberadoSempre(caminho)) return "livre";
  return caminho === "/api" || caminho.startsWith("/api/") || caminho.startsWith("/trpc/") ? "api" : "pagina";
}

const codificador = new TextEncoder();

async function assinar(codigo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", codificador.encode(codigo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, codificador.encode(mensagem));
  return Array.from(new Uint8Array(assinatura), (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Valor do cookie da equipe: validade + assinatura. Null se não há código configurado. */
export async function criarLiberacao(agoraMs: number, env: Env = process.env): Promise<string | null> {
  const codigo = codigoEquipe(env);
  if (!codigo) return null;
  const validade = Math.floor(agoraMs / 1000) + DURACAO_LIBERACAO_S;
  return `${validade}.${await assinar(codigo, `manutencao:${validade}`)}`;
}

/** O cookie é da equipe e ainda vale? */
export async function liberacaoValida(valor: string | undefined, agoraMs: number, env: Env = process.env): Promise<boolean> {
  const codigo = codigoEquipe(env);
  if (!codigo || !valor) return false;
  const [validadeTexto, assinatura, sobra] = valor.split(".");
  if (sobra !== undefined || !/^\d{1,12}$/.test(validadeTexto ?? "") || !/^[0-9a-f]{64}$/.test(assinatura ?? "")) return false;
  const validade = Number(validadeTexto);
  const agora = Math.floor(agoraMs / 1000);
  if (validade <= agora || validade > agora + DURACAO_LIBERACAO_S) return false;
  return iguais(assinatura, await assinar(codigo, `manutencao:${validade}`));
}

/** O código digitado confere com MANUTENCAO_CODIGO? Compara as assinaturas, nunca o texto direto. */
export async function codigoConfere(digitado: string, env: Env = process.env): Promise<boolean> {
  const codigo = codigoEquipe(env);
  if (!codigo || !digitado) return false;
  const [a, b] = await Promise.all([assinar(codigo, digitado.trim()), assinar(codigo, codigo)]);
  return iguais(a, b);
}
