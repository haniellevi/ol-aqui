import "server-only";
import { headers } from "next/headers";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { categoriaPorSlug, listarCategorias } from "@/lib/dados/categorias";
import { enxugarArvore, semAcento } from "@/lib/categorias-arvore";
import { centavosDoTexto } from "@/lib/formato";
import { arvoreParaIA, limparTextoBusca } from "@/lib/sugestao-categoria-ia";
import { dentroDoLimiteBusca, entenderBusca, frasesDaCategoria, textoRestante } from "@/lib/busca-entendida";
import { comParametros, type ParametrosUrl } from "@/components/busca/parametros";

// Liga a "busca que entende" na tela de busca: só na 1ª vez que a pessoa envia o texto (sem filtros no
// endereço). Devolve o endereço já com categoria, estado e preço máximo (a tela mostra cada um como chip
// que se remove), ou null para seguir com a busca normal por texto. O endereço novo leva ia=<texto original>:
// isso evita perguntar de novo e deixa mostrar o que a pessoa escreveu.

const PERMITIDOS = new Set(["q", "cidade", "ordem", "visualizacao"]);

export function podeEntender(sp: ParametrosUrl): boolean {
  return Object.keys(sp).every((k) => PERMITIDOS.has(k) || (k === "pagina" && sp.pagina === "1"));
}

async function quemPergunta(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "anonimo").trim().slice(0, 64);
}

export async function enderecoEntendido(sp: ParametrosUrl, original: string): Promise<string | null> {
  const texto = limparTextoBusca(original);
  if (!texto || !process.env.TYPESAFE_API_KEY || !podeEntender(sp)) return null;
  if (!dentroDoLimiteBusca(await quemPergunta())) return null;
  try {
    const arvore = enxugarArvore(await arvoreParaIA(async () => enxugarArvore(await listarCategorias())));
    const e = await entenderBusca(arvore, texto);
    if (!e) return null;
    const cat = e.categoriaSlug ? await categoriaPorSlug(e.categoriaSlug) : null;
    const folha = cat && !cat.filhas.length ? cat : null;
    const campo = e.estado && folha ? folha.categoria.campos.find((c) => c.chave === "estado" && c.tipo === "lista" && c.filtro) : undefined;
    const opcao = campo?.opcoes?.find((o) => semAcento(o) === e.estado);
    const estado = e.estado && opcao ? e.estado : null;
    const precoTexto = e.precoMaxReais != null ? String(e.precoMaxReais).replace(".", ",") : null;
    if (!folha && !estado && !precoTexto) return null;

    const palavras = folha ? frasesDaCategoria(folha.categoria.nome, folha.categoria.slug) : [];
    const restante = textoRestante(texto, { estado, numero: precoTexto ? e.numero : null }, palavras);
    const mudar = (q: string): Record<string, string | null> => ({
      q: q || null,
      categoria: folha?.categoria.slug ?? null,
      preco_max: precoTexto,
      c_estado: estado ? opcao! : null,
      ia: texto,
    });
    const base = { cidade: sp.cidade, ordem: sp.ordem, visualizacao: sp.visualizacao };
    // Com o texto que sobrou a busca pode ficar vazia (a busca por texto exige todas as palavras): confere antes.
    let q = restante;
    if (q) {
      const { total } = await buscarAnuncios({
        q, categoria: folha?.categoria.slug ?? null, cidade: typeof sp.cidade === "string" ? sp.cidade : null, precoMax: precoTexto ? centavosDoTexto(precoTexto) : null,
        filtros: estado && campo ? { estado: [opcao!] } : undefined, limite: 1,
      });
      if (total === 0) q = "";
    }
    return comParametros("/busca", base, mudar(q));
  } catch {
    return null;
  }
}
