import "server-only";
import { ehFolha, nomeCaminho, percorrerLeve, semAcento, type CategoriaLeve } from "@/lib/categorias-arvore";
import { PALAVRAS_CATEGORIA } from "@/lib/categorias-palavras";
import { limparTextoBusca } from "@/lib/sugestao-categoria-ia";

// Etapa 3 das categorias: "busca que entende". Ao ENVIAR a busca (nunca a cada tecla), a JEV (TypeSafe)
// lê frases como "geladeira usada até 800" e responde 3 coisas: a categoria, o estado (novo/seminovo/usado)
// e se um número do texto é preço máximo. O código só usa o que a pessoa escreveu: o número vem do texto
// (a JEV só diz o que ele significa) e o estado só vira filtro se a categoria tiver o campo "Estado".
// Sem chave, com erro, demora ou dúvida: nada muda e fica a busca normal por texto.

export const MODELO_BUSCA = "jev-latest";
const ENDERECO = "https://api.typesafe.ai/v1/systemone";
const PRAZO_MS = 2500;
const CHANCE_CATEGORIA = 0.5;
const CHANCE_ESTADO = 0.7;
const CHANCE_PRECO = 0.7;
const MAX_NUMEROS = 3;
const MAX_REAIS = 10_000_000;
const NENHUMA = "_nenhuma";

export type NumeroBusca = { reais: number; inicio: number; fim: number };
export type EstadoProduto = "novo" | "seminovo" | "usado";
export type BuscaEntendida = {
  categoriaId: string | null;
  categoriaSlug: string | null;
  estado: EstadoProduto | null;
  precoMaxReais: number | null;
  /** Posição do número que virou preço máximo (para tirar do texto). */
  numero: NumeroBusca | null;
};

const RE_NUMERO = /(?<![\p{L}\d.,])(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(?:\s*(mil|k))?(?![\p{L}\d])/giu;

/** Números do texto que podem ser preço: "800", "1.500", "2 mil", "R$ 1,5 mil". "150cc", "ps5" e "a4" não entram. */
export function numerosDoTexto(texto: string): NumeroBusca[] {
  const saida: NumeroBusca[] = [];
  for (const m of texto.matchAll(RE_NUMERO)) {
    const inteiro = m[1].replace(/\./g, "");
    const reais = Number(`${inteiro}${m[2] ? `.${m[2]}` : ""}`) * (m[3] ? 1000 : 1);
    if (!Number.isFinite(reais) || reais <= 0 || reais > MAX_REAIS) continue;
    saida.push({ reais, inicio: m.index ?? 0, fim: (m.index ?? 0) + m[0].length });
    if (saida.length >= MAX_NUMEROS) break;
  }
  return saida;
}

const INSTRUCAO_CATEGORIA =
  "Em qual categoria do Mercado da Região (classificados de Corrente, Piauí, e cidades vizinhas) " +
  "estão os anúncios que a pessoa procura? Escolha a categoria mais específica. " +
  `Se a busca for vaga demais para uma categoria, escolha ${NENHUMA}.`;

const DICA_RAIZ: Record<string, string> = {
  servicos: "Serviço oferecido por alguém (mão de obra ou atendimento), não a venda de um produto",
  empregos: "Vaga de trabalho ou pessoa procurando trabalho",
};

/** Opções da JEV: uma por categoria final, mais a saída "nenhuma". Mesmas descrições da Etapa 2. */
export function criteriosBusca(arvore: CategoriaLeve[]): { criterios: Record<string, string>; ids: Map<string, string> } {
  const criterios: Record<string, string> = {};
  const ids = new Map<string, string>();
  for (const { no, caminho } of percorrerLeve(arvore)) {
    if (!ehFolha(no) || ids.has(no.slug) || no.slug === NENHUMA) continue;
    let d = nomeCaminho(caminho);
    const dica = DICA_RAIZ[caminho[0].slug];
    if (dica) d += `. ${dica}`;
    const palavras = PALAVRAS_CATEGORIA[no.slug];
    if (palavras?.length) d += `. Ex.: ${palavras.join(", ")}`;
    criterios[no.slug] = d;
    ids.set(no.slug, no.id);
  }
  criterios[NENHUMA] = "Nenhuma categoria: a busca é vaga, só descreve qualidade ou não diz o que a pessoa procura";
  return { criterios, ids };
}

const CRITERIOS_ESTADO = {
  usado: "A pessoa quer um produto usado (ex.: usado, usada, de segunda mão)",
  seminovo: "A pessoa quer um produto seminovo",
  novo: "A pessoa quer um produto novo (ex.: novo, nova, zerado, lacrado)",
  nao_disse: "A pessoa não falou se quer novo, seminovo ou usado",
};

const CRITERIOS_NUMERO = {
  preco_maximo: "É o valor máximo que a pessoa quer pagar, em reais (ex.: até 800, menos de 2 mil, no máximo 500)",
  preco_minimo: "É o valor mínimo (ex.: a partir de 500, acima de 1 mil)",
  outra_coisa:
    "Não é um limite de preço: é quantidade, medida, ano, modelo, cilindrada, número de quartos, voltagem, ou um preço exato sem limite",
};

type Resposta = { choice?: unknown; probabilities?: unknown };

function chance(r: Resposta | undefined, opcao: string): number {
  const p = r?.probabilities;
  if (!p || typeof p !== "object" || Array.isArray(p)) return 0;
  const v = (p as Record<string, unknown>)[opcao];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0;
}

function melhor(r: Resposta | undefined, opcoes: string[]): { opcao: string; chance: number } | null {
  let achada: { opcao: string; chance: number } | null = null;
  for (const o of opcoes) {
    const c = chance(r, o);
    if (!achada || c > achada.chance) achada = { opcao: o, chance: c };
  }
  return achada && achada.chance > 0 ? achada : null;
}

/** Lê as respostas da JEV e fica só com o que passou do mínimo de chance. Qualquer coisa estranha vira "nada". */
export function lerRespostas(
  respostas: unknown,
  ids: Map<string, string>,
  numeros: NumeroBusca[],
): BuscaEntendida {
  const r = respostas && typeof respostas === "object" && !Array.isArray(respostas) ? (respostas as Record<string, Resposta>) : {};
  const cat = melhor(r.categoria, [...ids.keys()]);
  const nenhuma = chance(r.categoria, NENHUMA);
  const categoriaOk = cat && cat.chance >= CHANCE_CATEGORIA && cat.chance > nenhuma ? cat : null;
  const est = melhor(r.estado, ["usado", "seminovo", "novo"]);
  const estado = est && est.chance >= CHANCE_ESTADO && est.chance > chance(r.estado, "nao_disse") ? (est.opcao as EstadoProduto) : null;
  let numero: NumeroBusca | null = null;
  numeros.forEach((n, i) => {
    if (numero) return;
    if (chance(r[`numero_${i}`], "preco_maximo") >= CHANCE_PRECO) numero = n;
  });
  const achado = numero as NumeroBusca | null;
  return {
    categoriaId: categoriaOk ? ids.get(categoriaOk.opcao) ?? null : null,
    categoriaSlug: categoriaOk ? categoriaOk.opcao : null,
    estado,
    precoMaxReais: achado ? achado.reais : null,
    numero: achado,
  };
}

/**
 * Pergunta à JEV o que a busca quer dizer. null = não foi possível (sem chave, texto curto, erro, demora,
 * resposta estranha). Objeto com tudo vazio = a JEV respondeu e não achou nada seguro para filtrar.
 */
export async function entenderBusca(arvore: CategoriaLeve[], texto: unknown): Promise<BuscaEntendida | null> {
  const chave = process.env.TYPESAFE_API_KEY;
  const t = limparTextoBusca(texto);
  if (!chave || !t || !Array.isArray(arvore)) return null;
  const { criterios, ids } = criteriosBusca(arvore);
  if (ids.size < 2 || ids.size > 254) return null;
  const numeros = numerosDoTexto(t);
  const questions: Record<string, unknown> = {
    categoria: { type: "choice", instructions: INSTRUCAO_CATEGORIA, criteria: criterios },
    estado: {
      type: "choice",
      instructions: "Na busca, a pessoa pediu o produto novo, seminovo ou usado?",
      criteria: CRITERIOS_ESTADO,
    },
  };
  numeros.forEach((n, i) => {
    const escrito = t.slice(n.inicio, n.fim);
    questions[`numero_${i}`] = {
      type: "choice",
      instructions: `Na busca, o que significa o número «${escrito}»?`,
      criteria: CRITERIOS_NUMERO,
    };
  });
  try {
    const r = await fetch(ENDERECO, {
      method: "POST", signal: AbortSignal.timeout(PRAZO_MS), cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({ model: MODELO_BUSCA, state: { busca_da_pessoa: t }, questions }),
    });
    if (!r.ok) return null;
    const corpo = await r.text();
    if (corpo.length > 200_000) return null;
    const answers = JSON.parse(corpo)?.answers;
    if (!answers || typeof answers !== "object") return null;
    return lerRespostas(answers, ids, numeros);
  } catch {
    return null;
  }
}

/** Frases que identificam a categoria no texto: o nome inteiro, as palavras do nome com 4+ letras e as palavras de exemplo. */
export function frasesDaCategoria(nome: string, slug: string): string[] {
  return [nome, ...nome.split(/\s+/).filter((p) => semAcento(p).length >= 4), ...(PALAVRAS_CATEGORIA[slug] ?? [])];
}

// ---- texto que sobra ----

const LIGACAO_ANTES = new Set(["ate", "por", "no", "maximo", "menos", "de", "abaixo", "ao", "valor", "preco", "r$", "ate", "em", "uns"]);
const LIGACAO_DEPOIS = new Set(["reais", "real", "mil", "k", "r$"]);
const ENFEITES = new Set([
  "barato", "barata", "baratos", "baratas", "bom", "boa", "bons", "boas", "bem", "em", "conta", "urgente", "perto",
  "de", "da", "do", "das", "dos", "para", "pra", "com", "sem", "um", "uma", "uns", "umas", "o", "a", "os", "as", "e", "quero", "procuro", "preciso",
]);
const PALAVRAS_ESTADO = new Set([
  "usado", "usada", "usados", "usadas", "seminovo", "seminova", "seminovos", "seminovas", "novo", "nova", "novos", "novas",
]);

const normal = (p: string) => semAcento(p).replace(/[^a-z0-9$]/g, "");
const igualPlural = (a: string, b: string) => a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;

/**
 * Palavras da frase que o filtro NÃO cobriu, para continuar buscando por texto ("moto honda 150 barata" →
 * "honda 150"). Sai: o preço e as palavras de ligação ("até", "reais"), o estado, as palavras da categoria
 * e enfeites sem conteúdo ("barata", "de"). O que sobrou é só do que a pessoa escreveu.
 */
export function textoRestante(
  texto: string,
  entendida: Pick<BuscaEntendida, "estado" | "numero">,
  palavrasCategoria: string[],
): string {
  const palavras: { texto: string; inicio: number; fim: number }[] = [];
  for (const m of texto.matchAll(/\S+/g)) palavras.push({ texto: m[0], inicio: m.index ?? 0, fim: (m.index ?? 0) + m[0].length });
  const sai = new Array<boolean>(palavras.length).fill(false);
  const alvo = entendida.numero;
  if (alvo) {
    const dentro = palavras.map((p, i) => (p.inicio < alvo.fim && p.fim > alvo.inicio ? i : -1)).filter((i) => i >= 0);
    for (const i of dentro) sai[i] = true;
    if (dentro.length) {
      for (let i = dentro[0] - 1; i >= 0 && LIGACAO_ANTES.has(normal(palavras[i].texto)); i--) sai[i] = true;
      for (let i = dentro[dentro.length - 1] + 1; i < palavras.length && LIGACAO_DEPOIS.has(normal(palavras[i].texto)); i++) sai[i] = true;
    }
  }
  // Palavras da categoria: as de uma palavra só saem onde aparecem; as de várias ("ar condicionado") só saem
  // inteiras e em sequência. Assim o "ar" solto de "ar condicionado split" nunca é arrancado pela metade.
  const normais = palavras.map((p) => normal(p.texto));
  for (const frase of palavrasCategoria) {
    const alvo = semAcento(frase).split(/[^a-z0-9]+/).filter(Boolean);
    if (!alvo.length) continue;
    for (let i = 0; i + alvo.length <= normais.length; i++) {
      if (alvo.every((a, k) => igualPlural(normais[i + k], a))) for (let k = 0; k < alvo.length; k++) sai[i + k] = true;
    }
  }
  const resto = palavras.filter((p, i) => {
    if (sai[i]) return false;
    const n = normal(p.texto);
    if (!n || ENFEITES.has(n)) return false;
    if (entendida.estado && PALAVRAS_ESTADO.has(n)) return false;
    return true;
  });
  return resto.map((p) => p.texto).join(" ");
}

// ---- freio de gasto (memória de cada servidor) ----

const MINUTO_MS = 60_000;
const LIMITE_POR_PESSOA = 10; // buscas com IA por minuto, por pessoa
const LIMITE_GERAL = 200; // todas as pessoas juntas, em cada servidor
const MAX_PESSOAS = 5000;
const chamadas = new Map<string, number[]>();
let geral = { inicio: 0, total: 0 };
export function dentroDoLimiteBusca(pessoa: string, agora = Date.now()): boolean {
  const recentes = (chamadas.get(pessoa) ?? []).filter((t) => agora - t < MINUTO_MS);
  if (agora - geral.inicio >= MINUTO_MS) geral = { inicio: agora, total: 0 };
  const cabe = recentes.length < LIMITE_POR_PESSOA && geral.total < LIMITE_GERAL;
  if (cabe) {
    recentes.push(agora);
    geral.total++;
  }
  chamadas.delete(pessoa);
  chamadas.set(pessoa, recentes);
  for (const [quem] of chamadas) {
    if (chamadas.size <= MAX_PESSOAS) break;
    chamadas.delete(quem);
  }
  return cabe;
}
