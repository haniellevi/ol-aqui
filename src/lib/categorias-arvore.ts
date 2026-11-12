// Árvore de categorias em até 3 níveis (Grande › Sub › Tipo). Funções puras: servem no servidor
// (páginas, ações, robô) e no navegador (escolha de categoria, filtros). Sem acesso a banco.
import { linkCategoria } from "@/lib/formato";
import type { Categoria, CategoriaComFilhas } from "@/lib/tipos";

export const NIVEIS_MAXIMOS = 3;
export const SEPARADOR_CAMINHO = " › ";
const NOMES_NIVEL = ["Grande", "Sub", "Tipo"] as const;

/** Nome do nível (1 = grande, 2 = sub, 3 = tipo). Usado em telas e mensagens. */
export const nomeDoNivel = (nivel: number) => NOMES_NIVEL[nivel - 1] ?? `Nível ${nivel}`;

/** Sem acento e sem maiúsculas: a busca acha "racao" e "Ração" igual. */
export const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Monta a árvore a partir da lista plana (pai_id), mantendo a ordem recebida. Filhas de pai ausente somem. */
export function montarArvore(linhas: Categoria[]): CategoriaComFilhas[] {
  const nos = new Map<string, CategoriaComFilhas>();
  for (const c of linhas) nos.set(c.id, { ...c, filhas: [] });
  const raizes: CategoriaComFilhas[] = [];
  for (const c of linhas) {
    const no = nos.get(c.id);
    if (!no) continue;
    if (!c.pai_id) raizes.push(no);
    else nos.get(c.pai_id)?.filhas.push(no);
  }
  return raizes;
}

export type NoCategoria = { no: CategoriaComFilhas; caminho: CategoriaComFilhas[] };

/** Todas as categorias da árvore, cada uma com o caminho do topo até ela (a própria inclusa). */
export function percorrer(arvore: CategoriaComFilhas[]): NoCategoria[] {
  const r: NoCategoria[] = [];
  const andar = (nos: CategoriaComFilhas[], antes: CategoriaComFilhas[]) => {
    for (const no of nos) {
      const caminho = [...antes, no];
      r.push({ no, caminho });
      andar(no.filhas ?? [], caminho);
    }
  };
  andar(arvore, []);
  return r;
}

/** Caminho até a categoria (Grande › Sub › Tipo). Não achou → null. */
export function caminhoAte(arvore: CategoriaComFilhas[], id: string): CategoriaComFilhas[] | null {
  return percorrer(arvore).find((x) => x.no.id === id)?.caminho ?? null;
}

/** "Pet › Produtos para pets › Ração". */
export function nomeCaminho(caminho: Pick<Categoria, "nome">[]): string {
  return caminho.map((c) => c.nome).join(SEPARADOR_CAMINHO);
}

/** Folha = sem filhas ativas. Só a folha recebe anúncio. */
export const ehFolha = (no: { filhas?: unknown[] }) => !no.filhas?.length;

/** Endereço canônico: /c/<slug> para grande; /c/<pai>/<slug> para sub e tipo. */
export function linkCanonico(caminho: Pick<Categoria, "slug">[]): string {
  const n = caminho.length;
  if (n === 0) return "/categorias";
  return n >= 2 ? linkCategoria(caminho[n - 2].slug, caminho[n - 1].slug) : linkCategoria(caminho[0].slug);
}

/** Folhas cujo próprio nome ou algum nome do caminho bate com a busca (sem acento). */
export function buscarFolhas(arvore: CategoriaComFilhas[], busca: string): NoCategoria[] {
  const q = semAcento(busca);
  if (!q) return [];
  return percorrer(arvore).filter(({ no, caminho }) => ehFolha(no) && caminho.some((c) => semAcento(c.nome).includes(q)));
}

/* ------------------------- Painel de categorias ------------------------- */

/** O que o painel precisa de cada categoria (sem campos, preços etc.): menos dados indo para o celular. */
export type CategoriaLeve = { id: string; slug: string; nome: string; icone: string; filhas: CategoriaLeve[] };
export type NoLeve = { no: CategoriaLeve; caminho: CategoriaLeve[] };

/** Copia só id, slug, nome, ícone e filhas. */
export function enxugarArvore(arvore: CategoriaLeve[]): CategoriaLeve[] {
  return arvore.map(({ id, slug, nome, icone, filhas }) => ({ id, slug, nome, icone, filhas: enxugarArvore(filhas ?? []) }));
}

/** Todos os nós da árvore leve, com o caminho do topo até cada um. */
export function percorrerLeve(arvore: CategoriaLeve[]): NoLeve[] {
  const r: NoLeve[] = [];
  const andar = (nos: CategoriaLeve[], antes: CategoriaLeve[]) => {
    for (const no of nos) {
      const caminho = [...antes, no];
      r.push({ no, caminho });
      andar(no.filhas ?? [], caminho);
    }
  };
  andar(arvore, []);
  return r;
}

/**
 * Para quem procura: tira as categorias sem anúncio e põe as com mais anúncios primeiro
 * (empate fica na ordem do painel). Sem contagem (banco fora do ar) → árvore como veio.
 */
export function arvoreComAnuncios<T extends CategoriaLeve>(arvore: T[], totais: Map<string, number> | null): T[] {
  if (!totais) return arvore;
  const total = (c: CategoriaLeve) => totais.get(c.id) ?? 0;
  return arvore
    .filter((c) => total(c) > 0)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => total(b.c) - total(a.c) || a.i - b.i)
    .map(({ c }) => ({ ...c, filhas: arvoreComAnuncios(c.filhas as T[], totais) }));
}

/** Palavras com 3 letras ou mais, sem acento e sem o "s" do plural ("motos" acha "Moto"). */
function palavras(texto: string): string[] {
  return semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3)
    .map((p) => {
      const sem = p.replace(/(es|s)$/, "");
      return sem.length >= 3 ? sem : p;
    });
}

/**
 * Busca local, sem IA, que entende o título do anúncio inteiro ("Geladeira Brastemp 400 litros"):
 * cada palavra que aparece no nome da categoria vale 2 pontos; no caminho (mãe, avó), 1 ponto.
 * Devolve só categorias finais (onde o anúncio pode ficar), da mais parecida para a menos.
 */
export function sugerirPorTexto(arvore: CategoriaLeve[], texto: string, limite = 8): NoLeve[] {
  const busca = palavras(texto);
  if (!busca.length) return [];
  // Compara pelo começo das palavras: "racao" acha "Ração", mas não "Decoração".
  const termos = (nomes: string[]) => nomes.flatMap((n) => semAcento(n).split(/[^a-z0-9]+/)).filter(Boolean);
  const bate = (lista: string[], w: string) => lista.some((t) => t.startsWith(w));
  const pontos = ({ no, caminho }: NoLeve) => {
    const proprio = termos([no.nome]);
    const acima = termos(caminho.slice(0, -1).map((c) => c.nome));
    let p = 0;
    for (const w of busca) p += bate(proprio, w) ? 2 : bate(acima, w) ? 1 : 0;
    return p;
  };
  return percorrerLeve(arvore)
    .filter((x) => ehFolha(x.no))
    .map((x, i) => ({ x, i, p: pontos(x) }))
    .filter((r) => r.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, limite)
    .map((r) => r.x);
}

type ComFilhas = { filhas: ComFilhas[] };

/** Quantos níveis abaixo da categoria (0 = folha; 1 = tem filhas que são folhas; 2 = tem netas...). */
export function alturaDe(no: ComFilhas): number {
  return no.filhas.length ? 1 + Math.max(...no.filhas.map(alturaDe)) : 0;
}
