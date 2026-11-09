import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { regiaoAtual } from "@/lib/dados/regiao";
import { ehUuid } from "@/lib/formato";
import type {
  AnuncioCard,
  AnuncioPublico,
  FaixaPreco,
  MeuAnuncio,
  ParametrosBusca,
  ResultadoBusca,
  Vitrine,
} from "@/lib/tipos";

/**
 * Busca de anúncios (public.buscar_anuncios). Só anúncios ativos de vendedores ativos.
 * Sem `regiao` usa a região do visitante; passe `regiao: null` para buscar em todas.
 * Falhas são tratadas pela tela de erro, sem simular catálogo vazio.
 */
export async function buscarAnuncios(p: ParametrosBusca = {}): Promise<ResultadoBusca> {
  return lerBusca(p);
}

async function lerBusca(p: ParametrosBusca): Promise<ResultadoBusca> {
  const regiao = p.regiao === undefined ? (await regiaoAtual())?.slug ?? null : p.regiao;
  const args: Record<string, unknown> = {
    q: limpo(p.q),
    categoria_slug: limpo(p.categoria),
    cidade: limpo(p.cidade),
    preco_min: p.precoMin ?? null,
    preco_max: p.precoMax ?? null,
    filtros: p.filtros && Object.keys(p.filtros).length ? p.filtros : null,
    ordem: p.ordem ?? null,
    microrregiao_slug: regiao,
    limite: p.limite ?? null,
    deslocamento: p.deslocamento ?? null,
  };
  // manda só o que foi preenchido (o resto fica com o padrão da função no banco)
  for (const k of Object.keys(args)) if (args[k] == null) delete args[k];

  const db = await createClient();
  const { data, error } = await db.rpc("buscar_anuncios", args);
  if (error || !Array.isArray(data)) throw new Error("Não foi possível consultar os anúncios.");
  const anuncios = (data as AnuncioCard[]).map((a) => ({ ...a, atributos: a.atributos ?? {}, total: Number(a.total) }));
  return { anuncios, total: anuncios[0]?.total ?? 0 };
}

/**
 * Anúncio para a página pública (ou prévia "Revisar" do dono).
 * Visitante só vê ativo/vendido; dono e admin veem qualquer status. Não achou → null.
 */
export const anuncioPublico = cache(async (id: string): Promise<AnuncioPublico | null> => {
  if (!ehUuid(id)) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("anuncio_publico", { anuncio_id: id });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar o anúncio. Tente novamente.");
  if (!data[0] || data[0].status === "excluido") return null;
  const a = data[0] as AnuncioPublico;
  return { ...a, fotos: a.fotos ?? [], atributos: a.atributos ?? {}, campos: a.campos ?? [] };
});

/** Faixa de preço dos anúncios parecidos na região (25% a 75%). minimo/maximo null = poucos anúncios. */
export async function faixaPreco(categoriaId: string, microrregiaoId: string | null = null): Promise<FaixaPreco | null> {
  if (!ehUuid(categoriaId)) return null;
  return seguro(() => lerFaixa(categoriaId, microrregiaoId), null);
}

async function lerFaixa(categoriaId: string, microrregiaoId: string | null): Promise<FaixaPreco | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("faixa_preco_regiao", { categoria_id: categoriaId, microrregiao_id: microrregiaoId });
  const linha = Array.isArray(data) ? data[0] : data;
  if (error || !linha) return null;
  return {
    minimo: linha.minimo == null ? null : Number(linha.minimo),
    maximo: linha.maximo == null ? null : Number(linha.maximo),
    quantidade: Number(linha.quantidade ?? 0),
  };
}

const COLUNAS_CARD =
  "id, titulo, preco_centavos, aceita_troca, cidade, bairro, fotos, atributos, publicado_em, criado_em, destaque_ate, categorias(slug, nome)";

type LinhaCard = {
  id: string;
  titulo: string;
  preco_centavos: number | null;
  aceita_troca: boolean;
  cidade: string;
  bairro: string | null;
  fotos: string[] | null;
  atributos: AnuncioCard["atributos"] | null;
  publicado_em: string | null;
  criado_em: string;
  destaque_ate: string | null;
  categorias: { slug: string; nome: string } | null;
};

/** Anúncios ativos de uma vitrine (página /loja/[slug]), destaques primeiro e depois os mais novos. */
export async function anunciosDaVitrine(v: Vitrine, limite = 48): Promise<AnuncioCard[]> {
  return seguro(() => lerDaVitrine(v, limite), []);
}

async function lerDaVitrine(v: Vitrine, limite: number): Promise<AnuncioCard[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("anuncios")
    .select(COLUNAS_CARD)
    .eq("vitrine_id", v.id)
    .eq("status", "ativo")
    .order("publicado_em", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limite, 1), 96));
  if (error || !data) return [];
  const agora = Date.now();
  const cards = (data as unknown as LinhaCard[]).map<AnuncioCard>((a) => ({
    id: a.id,
    titulo: a.titulo,
    preco_centavos: a.preco_centavos,
    aceita_troca: a.aceita_troca,
    cidade: a.cidade,
    bairro: a.bairro,
    capa: a.fotos?.[0] ?? null,
    atributos: a.atributos ?? {},
    criado_em: a.publicado_em ?? a.criado_em,
    categoria_slug: a.categorias?.slug ?? null,
    categoria_nome: a.categorias?.nome ?? null,
    vitrine_nome: v.nome,
    vitrine_slug: v.slug,
    vitrine_selo: v.selo_loja_verificada,
    vitrine_tipo: v.tipo,
    destaque: !!a.destaque_ate && new Date(a.destaque_ate).getTime() > agora,
    total: data.length,
  }));
  return cards.sort((x, y) => Number(y.destaque) - Number(x.destaque));
}

const COLUNAS_MEU =
  "id, vitrine_id, categoria_id, titulo, descricao, preco_centavos, aceita_troca, cidade, bairro, fotos, atributos, status, visualizacoes, cliques_whatsapp, total_favoritos, destaque_ate, pago_ate, motivo_analise, excluido_em, status_antes_exclusao, publicado_em, vendido_em, criado_em, atualizado_em, vitrines_lojas!inner(dono_id)";

function semDono(a: MeuAnuncio & { vitrines_lojas?: unknown }): MeuAnuncio {
  const { vitrines_lojas: _dono, ...resto } = a;
  void _dono;
  return { ...resto, fotos: resto.fotos ?? [], atributos: resto.atributos ?? {} };
}

/**
 * Um anúncio do usuário logado (rascunho para continuar, editar, prévia).
 * Confere o dono pela vitrine: anúncio de outra pessoa ou sem login → null.
 */
export const meuAnuncio = cache(async (id: string): Promise<MeuAnuncio | null> => {
  const { userId } = await auth();
  if (!userId || !ehUuid(id)) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("anuncios")
    .select(COLUNAS_MEU)
    .eq("id", id)
    .eq("vitrines_lojas.dono_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar seu rascunho. Tente de novo.");
  if (!data) return null;
  return semDono(data as unknown as MeuAnuncio);
});

/** Todos os anúncios do usuário logado (tela "Meus anúncios"), mais novos primeiro. */
export async function meusAnuncios(): Promise<MeuAnuncio[]> {
  return lerMeus();
}

async function lerMeus(): Promise<MeuAnuncio[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const db = await createClient();
  const { data, error } = await db
    .from("anuncios")
    .select(COLUNAS_MEU)
    .eq("vitrines_lojas.dono_id", userId)
    .order("atualizado_em", { ascending: false })
    .limit(500);
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar seus anúncios. Tente de novo.");
  return (data as unknown as MeuAnuncio[]).map(semDono);
}

function limpo(t: string | null | undefined) {
  const s = (t ?? "").trim();
  return s ? s.slice(0, 120) : null;
}
