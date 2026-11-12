import { ehFolha, linkCanonico, nomeCaminho, percorrerLeve, semAcento, sugerirPorTexto, type CategoriaLeve, type NoLeve } from "@/lib/categorias-arvore";
import { PALAVRAS_CATEGORIA } from "@/lib/categorias-palavras";

// Sugestões da busca do topo enquanto a pessoa digita. Sem IA: só compara letras (sem acento,
// sem diferenciar maiúscula). A "busca que entende" frases inteiras é outro trabalho (Etapa 3).

export const MINIMO_LETRAS = 2;
export const LIMITE_CATEGORIAS = 3;
export const LIMITE_LOJAS = 3;
export const LIMITE_ANUNCIOS = 5;

export type Sugestao = { tipo: "categoria" | "loja" | "anuncio"; nome: string; detalhe?: string; href: string };
export type SugestoesBusca = { categorias: Sugestao[]; lojas: Sugestao[]; anuncios: Sugestao[] };
export const SEM_SUGESTOES: SugestoesBusca = { categorias: [], lojas: [], anuncios: [] };

/** Texto da busca já limpo (até 120 letras, como o campo), ou "" se ainda é curto demais. */
export function termoSugestao(texto: string | null | undefined): string {
  const t = (texto ?? "").trim().slice(0, 120);
  return semAcento(t).replace(/[^a-z0-9]/g, "").length >= MINIMO_LETRAS ? t : "";
}

/** Pedaços do texto para comparar pelo começo das palavras: "Gela" → ["gela"]. */
const pedacos = (texto: string) => semAcento(texto).split(/[^a-z0-9]+/).filter(Boolean);

/** Toda palavra digitada é o começo de alguma palavra do nome: "pad pao" acha "Padaria Pão Quente". */
export function combina(nome: string, texto: string): boolean {
  const busca = pedacos(texto);
  if (!busca.length) return false;
  const doNome = pedacos(nome);
  return busca.every((b) => doNome.some((n) => n.startsWith(b)));
}

/**
 * Categorias finais para a busca: primeiro as que o sugerirPorTexto acha pelo nome; depois as
 * que têm uma palavra de exemplo começando pelo que foi digitado ("frigo" → Geladeiras e freezers).
 */
export function sugerirCategorias(arvore: CategoriaLeve[], texto: string, limite = LIMITE_CATEGORIAS): Sugestao[] {
  const propria = ({ no }: NoLeve) => combina(no.nome, texto) || (PALAVRAS_CATEGORIA[no.slug] ?? []).some((p) => combina(p, texto));
  // sugerirPorTexto também pontua pelo nome da categoria de cima; aqui só vale a que combina com o próprio nome
  const achadas: NoLeve[] = sugerirPorTexto(arvore, texto, 50).filter(propria).slice(0, limite);
  if (achadas.length < limite) {
    const ja = new Set(achadas.map((x) => x.no.id));
    for (const x of percorrerLeve(arvore)) {
      if (achadas.length >= limite) break;
      if (ja.has(x.no.id) || !ehFolha(x.no)) continue;
      const palavras = PALAVRAS_CATEGORIA[x.no.slug] ?? [];
      if (palavras.some((p) => combina(p, texto))) achadas.push(x);
    }
  }
  return achadas.map(({ caminho, no }) => ({
    tipo: "categoria",
    nome: no.nome,
    detalhe: caminho.length > 1 ? nomeCaminho(caminho.slice(0, -1)) : undefined,
    href: linkCanonico(caminho),
  }));
}

/** Lojas cujo nome combina com o texto, na ordem em que vieram (a da cidade escolhida primeiro). */
export function filtrarLojas<T extends { nome: string; cidade?: string | null; href: string }>(
  lojas: T[],
  texto: string,
  limite = LIMITE_LOJAS,
): Sugestao[] {
  return lojas
    .filter((l) => combina(l.nome, texto))
    .slice(0, limite)
    .map((l) => ({ tipo: "loja", nome: l.nome, detalhe: l.cidade || undefined, href: l.href }));
}

/**
 * O que perguntar ao banco para achar anúncios. A busca do banco não garante achar vários
 * começos de palavra juntos ("ge br" → "Geladeira Brastemp"); com mais de uma palavra, pergunta
 * também só pela maior delas (um começo de palavra sozinho o banco acha) e o filtro daqui confere o resto.
 */
export function consultasAnuncios(texto: string): string[] {
  const t = texto.trim();
  const partes = pedacos(t);
  if (partes.length < 2) return [t];
  const maior = partes.reduce((a, b) => (b.length > a.length ? b : a));
  return [t, maior];
}

/** Anúncios cujo título combina com o texto (a busca do banco também olha a descrição). */
export function filtrarAnuncios<T extends { titulo: string }>(anuncios: T[], texto: string, limite = LIMITE_ANUNCIOS): T[] {
  return anuncios.filter((a) => combina(a.titulo, texto)).slice(0, limite);
}

/** Quantas sugestões há no total (para o aviso do leitor de tela). */
export const totalSugestoes = (s: SugestoesBusca) => s.categorias.length + s.lojas.length + s.anuncios.length;
