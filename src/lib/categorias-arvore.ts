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

type ComFilhas = { filhas: ComFilhas[] };

/** Quantos níveis abaixo da categoria (0 = folha; 1 = tem filhas que são folhas; 2 = tem netas...). */
export function alturaDe(no: ComFilhas): number {
  return no.filhas.length ? 1 + Math.max(...no.filhas.map(alturaDe)) : 0;
}
