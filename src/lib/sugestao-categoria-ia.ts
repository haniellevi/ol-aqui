import "server-only";
import { ehFolha, nomeCaminho, percorrerLeve, semAcento, type CategoriaLeve } from "@/lib/categorias-arvore";
import { PALAVRAS_CATEGORIA } from "@/lib/categorias-palavras";

// Etapa 2 das categorias: enquanto a pessoa escreve "O que você está anunciando?", o JEV (TypeSafe)
// escolhe entre as categorias finais e devolve a chance de cada uma. As 3 mais prováveis vão para o
// topo da lista da busca local (que continua igual). Sem chave, com erro ou demora: nada, fica a busca local.
// Configuração igual à do teste da Etapa 2 (12/11/2026): caminho da categoria + dica de Serviços/Empregos
// + palavras de exemplo; 78 de 80 na 1ª opção e 80 de 80 entre as 3 primeiras.

export const MODELO_SUGESTAO = "jev-latest";
const ENDERECO = "https://api.typesafe.ai/v1/systemone";
const PRAZO_MS = 2500; // no teste: metade em até ~0,46 s, a mais lenta 0,73 s
const MAX_SUGESTOES = 3;
const CHANCE_MINIMA = 0.05; // abaixo disso a 2ª/3ª opção só atrapalha
export const MIN_TEXTO = 3;
export const MAX_TEXTO = 90; // mesmo limite do título
const LIMITE_POR_MINUTO = 30; // por pessoa, em cada servidor: a busca chama ~1 vez por pausa na digitação
const LIMITE_GERAL_POR_MINUTO = 300; // todas as pessoas juntas, em cada servidor (~US$ 0,06 por minuto no máximo)

const INSTRUCAO =
  "Em qual categoria do Mercado da Região (classificados de Corrente, Piauí, e cidades vizinhas) " +
  "este anúncio deve ficar? Escolha a categoria mais específica que combina com o que está sendo " +
  "vendido, alugado, oferecido como serviço ou procurado.";

const DICA_RAIZ: Record<string, string> = {
  servicos: "Serviço oferecido por alguém (mão de obra ou atendimento), não a venda de um produto",
  empregos: "Vaga de trabalho ou pessoa procurando trabalho",
};

export type SugestaoCategoria = { id: string; chance: number };

/** Texto que vale a pena mandar: espaços juntados, até 90 letras, com pelo menos 3 e alguma letra. */
export function limparTextoBusca(texto: unknown): string | null {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
  return t.length >= MIN_TEXTO && /[a-z]/.test(semAcento(t)) ? t : null;
}

/** Uma opção por categoria final (slug → descrição) e o id de cada slug. Mãe não entra: só a folha recebe anúncio. */
export function criteriosCategorias(arvore: CategoriaLeve[]): { criterios: Record<string, string>; ids: Map<string, string> } {
  const criterios: Record<string, string> = {};
  const ids = new Map<string, string>();
  for (const { no, caminho } of percorrerLeve(arvore)) {
    if (!ehFolha(no) || ids.has(no.slug)) continue;
    let d = nomeCaminho(caminho);
    const dica = DICA_RAIZ[caminho[0].slug];
    if (dica) d += `. ${dica}`;
    const palavras = PALAVRAS_CATEGORIA[no.slug];
    if (palavras?.length) d += `. Ex.: ${palavras.join(", ")}`;
    criterios[no.slug] = d;
    ids.set(no.slug, no.id);
  }
  return { criterios, ids };
}

/** Das chances devolvidas, ficam só categorias da lista, da mais para a menos provável, até 3. */
export function lerChances(valor: unknown, ids: Map<string, string>): SugestaoCategoria[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const saida: SugestaoCategoria[] = [];
  for (const [slug, chance] of Object.entries(valor as Record<string, unknown>)) {
    const id = ids.get(slug);
    if (!id || typeof chance !== "number" || !Number.isFinite(chance) || chance < CHANCE_MINIMA || chance > 1) continue;
    saida.push({ id, chance });
  }
  return saida.sort((a, b) => b.chance - a.chance).slice(0, MAX_SUGESTOES);
}

// Freio na memória de cada servidor: 30 por minuto por pessoa e 300 por minuto no total (com vários servidores
// no ar, cada um conta o seu; cada chamada custa ~US$ 0,0002). Evita gasto à toa. A ação confere antes de ler o banco.
const MINUTO_MS = 60_000;
const MAX_PESSOAS = 5000;
const chamadas = new Map<string, number[]>();
let geral = { inicio: 0, total: 0 };
export function dentroDoLimite(pessoa: string, agora = Date.now()): boolean {
  const recentes = (chamadas.get(pessoa) ?? []).filter((t) => agora - t < MINUTO_MS);
  if (agora - geral.inicio >= MINUTO_MS) geral = { inicio: agora, total: 0 };
  const cabe = recentes.length < LIMITE_POR_MINUTO && geral.total < LIMITE_GERAL_POR_MINUTO;
  if (cabe) {
    recentes.push(agora);
    geral.total++;
  }
  // Reinsere no fim: o Map fica na ordem do último uso.
  chamadas.delete(pessoa);
  chamadas.set(pessoa, recentes);
  // Muita gente: esquece só quem usou há mais tempo (nunca zera o freio de todo mundo).
  for (const [quem] of chamadas) {
    if (chamadas.size <= MAX_PESSOAS) break;
    chamadas.delete(quem);
  }
  return cabe;
}

// A árvore muda pouco: cada servidor guarda por 5 min, para não ler o banco a cada pausa na digitação.
// Categoria nova entra na IA em até 5 min.
const VALIDADE_ARVORE_MS = 5 * MINUTO_MS;
let arvoreGuardada: { arvore: CategoriaLeve[]; ate: number } | null = null;
export async function arvoreParaIA(ler: () => Promise<CategoriaLeve[]>, agora = Date.now()): Promise<CategoriaLeve[]> {
  if (arvoreGuardada && arvoreGuardada.ate > agora) return arvoreGuardada.arvore;
  const arvore = await ler();
  if (Array.isArray(arvore) && arvore.length) arvoreGuardada = { arvore, ate: agora + VALIDADE_ARVORE_MS };
  return arvore;
}

/** Até 3 categorias finais para o texto, com a chance de cada. Qualquer problema: lista vazia. */
export async function categoriasMaisProvaveis(arvore: CategoriaLeve[], texto: unknown): Promise<SugestaoCategoria[]> {
  return (await perguntarCategorias(arvore, texto)) ?? [];
}

/**
 * Igual a categoriasMaisProvaveis, mas separa os casos: null = a IA não foi chamada ou falhou
 * (sem chave, erro, demora, resposta estranha); [] = a IA respondeu e nenhuma categoria passou de 5%.
 * Só a resposta de verdade (lista, mesmo vazia) é guardada para medir os acertos.
 */
export async function perguntarCategorias(arvore: CategoriaLeve[], texto: unknown): Promise<SugestaoCategoria[] | null> {
  const chave = process.env.TYPESAFE_API_KEY;
  const t = limparTextoBusca(texto);
  if (!chave || !t || !Array.isArray(arvore)) return null;
  const { criterios, ids } = criteriosCategorias(arvore);
  // A escolha do JEV aceita até 255 opções; hoje são ~140.
  if (ids.size < 2 || ids.size > 255) return null;
  try {
    const r = await fetch(ENDERECO, {
      method: "POST", signal: AbortSignal.timeout(PRAZO_MS), cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: MODELO_SUGESTAO,
        state: { titulo_do_anuncio: t },
        questions: { categoria: { type: "choice", instructions: INSTRUCAO, criteria: criterios } },
      }),
    });
    if (!r.ok) return null;
    const corpo = await r.text();
    if (corpo.length > 100_000) return null;
    const probabilidades = JSON.parse(corpo)?.answers?.categoria?.probabilities;
    if (!probabilidades || typeof probabilidades !== "object" || Array.isArray(probabilidades)) return null;
    return lerChances(probabilidades, ids);
  } catch {
    return null;
  }
}
