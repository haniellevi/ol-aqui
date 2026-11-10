import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { lerConfig } from "@/lib/dados/config";
import { ehUuid, numeroDoTexto } from "@/lib/formato";
import type {
  AnuncioVitrine,
  MeuAnuncioVitrine,
  MinhaSecao,
  MinhaVitrineCompleta,
  OpcoesVitrine,
  OrdemVitrine,
  PerguntaFrequente,
  PlanoPublico,
  RecursosVitrine,
  VitrinePublica,
} from "@/lib/tipos-vitrine";

// Leituras da vitrine completa (página /loja/[slug], telas "Minha loja" e página /planos).
// Quem garante o que cada um vê é o banco: funções vitrine_publica/anuncios_vitrine (só campos
// públicos, regras do plano) e RLS (o dono só lê o que é dele). A página pública distingue erro de vazio.

const SLUG = /^[a-z0-9-]{3,60}$/;

/** Página pública da loja. Pessoa física, loja inexistente ou fora do ar (para quem não é o dono) → null. */
export const vitrinePublica = cache(async (slug: string): Promise<VitrinePublica | null> => {
  const s = slug.trim().toLowerCase();
  if (!SLUG.test(s)) return null;
  {
    const db = await createClient();
    const { data, error } = await db.rpc("vitrine_publica", { p_slug: s });
    if (error) throw new Error("Não foi possível carregar a loja.");
    if (data === null) return null;
    const v = data as VitrinePublica;
    if (!v || !ehUuid(v.id) || v.slug !== s || typeof v.nome !== "string" || !["ativa", "suspensa", "inadimplente"].includes(v.status) || !Number.isSafeInteger(v.total_anuncios) || v.total_anuncios < 0 || !Array.isArray(v.secoes)) throw new Error("Resposta da loja inválida.");
    return {
      ...v,
      lat: v.lat == null ? null : Number(v.lat),
      lng: v.lng == null ? null : Number(v.lng),
      formas_pagamento: Array.isArray(v.formas_pagamento) ? v.formas_pagamento : [],
      secoes: Array.isArray(v.secoes) ? v.secoes : [],
    };
  }
});

/**
 * Anúncios no ar da loja, uma página por vez (tamanho da página no painel: vitrine.anuncios_por_pagina):
 * fixados (do plano) primeiro e mais novos, ou do menor preço. Os produtos das seções vêm sempre
 * (na_pagina = false quando estão fora desta página).
 */
export const anunciosVitrine = cache(async (vitrineId: string, ordem: OrdemVitrine = "recentes", pagina = 1): Promise<AnuncioVitrine[]> => {
    if (!ehUuid(vitrineId) || !["recentes", "menor_preco"].includes(ordem) || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000) throw new Error("Consulta de produtos inválida.");
    const db = await createClient();
    const { data, error } = await db.rpc("anuncios_vitrine", { p_vitrine_id: vitrineId, p_ordem: ordem, p_pagina: pagina });
    if (error || !Array.isArray(data) || data.some((a) => !a || !ehUuid(a.id) || typeof a.na_pagina !== "boolean")) throw new Error("Não foi possível carregar os produtos.");
    return data as AnuncioVitrine[];
});

const COLUNAS_MINHA =
  "id, dono_id, cidade, bairro, slug, nome, tipo, status, microrregiao_id, logo_url, capa_url, descricao, banner_tipo, banner_url, banner_modelo, banner_cor, " +
  "endereco, lat, lng, horarios, sobre, formas_pagamento, faz_entrega, entrega_obs";

/** Vitrine do usuário logado com os campos da vitrine completa. Sem login ou sem vitrine → null. */
export const minhaVitrineCompleta = cache(async (exigirLeitura = false): Promise<MinhaVitrineCompleta | null> => {
  const ler = async () => {
    const { userId } = await auth();
    if (!userId) return null;
    const db = await createClient();
    const [{ data, error }, contatos] = await Promise.all([
      db.from("vitrines_lojas").select(COLUNAS_MINHA).eq("dono_id", userId).maybeSingle(),
      db.rpc("meus_contatos_vitrine").maybeSingle<{ whatsapp: string | null; instagram: string | null; site_url?: string | null; telefone_publico?: string | null }>(),
    ]);
    if (error || contatos.error) throw new Error("Não foi possível carregar sua loja. Tente novamente.");
    if (!data) return null;
    const v = {
      ...(data as unknown as Omit<MinhaVitrineCompleta, "whatsapp" | "instagram">),
      whatsapp: contatos.data?.whatsapp ?? null,
      instagram: contatos.data?.instagram ?? null,
      site_url: contatos.data?.site_url ?? null,
      telefone_publico: contatos.data?.telefone_publico ?? null,
    };
    if (exigirLeitura && (v.dono_id !== userId || !ehUuid(v.id))) throw new Error("Não foi possível confirmar sua loja.");
    return {
      ...v,
      lat: v.lat == null ? null : Number(v.lat),
      lng: v.lng == null ? null : Number(v.lng),
      formas_pagamento: v.formas_pagamento ?? [],
    };
  };
  return exigirLeitura ? ler() : seguro(ler, null);
});

const SEM_RECURSOS: RecursosVitrine = {
  foto_fachada: false,
  secoes_max: 0,
  fixados_max: 0,
  secoes_total: 0,
  fixados_total: 0,
  banner_moderado_em: null,
  banner_moderado_motivo: null,
};

/** O que o plano de agora libera na minha vitrine e quanto já uso (calculado pelo banco). */
export const meusRecursosVitrine = cache(async (exigirLeitura = false): Promise<RecursosVitrine> => {
  const ler = async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_vitrine_recursos");
    if (error) throw new Error("Não foi possível carregar os recursos do plano.");
    const linha = (Array.isArray(data) ? data[0] : data) as RecursosVitrine | undefined;
    if (exigirLeitura && (!linha || typeof linha.foto_fachada !== "boolean")) throw new Error("Não foi possível confirmar os recursos da loja.");
    return linha ?? SEM_RECURSOS;
  };
  return exigirLeitura ? ler() : seguro(ler, SEM_RECURSOS);
});

/** Minhas seções (todas, inclusive escondidas), na ordem, com os anúncios de cada uma. */
export const minhasSecoes = cache(async (vitrineId: string): Promise<MinhaSecao[]> =>
  seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("loja_secoes")
      .select("id, nome, ordem, ativa, criado_em, loja_secao_anuncios(anuncio_id, ordem)")
      .eq("vitrine_id", vitrineId)
      .order("ordem")
      .order("criado_em");
    if (error || !data) return [];
    type Linha = { id: string; nome: string; ordem: number; ativa: boolean; loja_secao_anuncios: { anuncio_id: string; ordem: number }[] | null };
    return (data as unknown as Linha[]).map((s) => ({
      id: s.id,
      nome: s.nome,
      ordem: s.ordem,
      ativa: s.ativa,
      anuncios: [...(s.loja_secao_anuncios ?? [])].sort((a, b) => a.ordem - b.ordem).map((x) => x.anuncio_id),
    }));
  }, []),
);

/** Meus anúncios que podem ir para a vitrine (no ar ou pausados), mais novos primeiro. */
export const meusAnunciosParaVitrine = cache(async (vitrineId: string): Promise<MeuAnuncioVitrine[]> =>
  seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("anuncios")
      .select("id, titulo, preco_centavos, fotos, status, fixado_na_loja, publicado_em, criado_em")
      .eq("vitrine_id", vitrineId)
      .in("status", ["ativo", "pausado"])
      .order("publicado_em", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error || !data) return [];
    type Linha = { id: string; titulo: string | null; preco_centavos: number | null; fotos: string[] | null; status: string; fixado_na_loja: number | null };
    return (data as unknown as Linha[]).map((a) => ({
      id: a.id,
      titulo: a.titulo?.trim() || "Anúncio sem título",
      preco_centavos: a.preco_centavos,
      capa: a.fotos?.[0] ?? null,
      status: a.status,
      fixado_na_loja: a.fixado_na_loja,
    }));
  }, []),
);

/** Ids dos meus anúncios fixados no topo da loja (tela "Meus anúncios"). */
export async function meusFixados(vitrineId: string): Promise<Set<string>> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("anuncios").select("id").eq("vitrine_id", vitrineId).not("fixado_na_loja", "is", null);
    return new Set(error ? [] : (data ?? []).map((a) => String((a as { id: string }).id)));
  }, new Set<string>());
}

/** Cores do banner, formas de pagamento e produtos por seção (painel → configurações). */
export async function opcoesVitrine(microrregiaoId: string | null): Promise<OpcoesVitrine> {
  const [cores, formas, porSecao] = await Promise.all([
    lerConfig<unknown>("vitrine.banner_cores", microrregiaoId, []),
    lerConfig<unknown>("vitrine.formas_pagamento", microrregiaoId, []),
    lerConfig<unknown>("vitrine.anuncios_por_secao_max", microrregiaoId, null),
  ]);
  const listaTexto = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
  const n = typeof porSecao === "number" ? porSecao : typeof porSecao === "string" ? Number(porSecao) : NaN;
  return {
    cores: listaTexto(cores).map((c) => c.trim().toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c)),
    formasPagamento: listaTexto(formas).map((f) => f.trim()),
    anunciosPorSecao: Number.isFinite(n) && n >= 0 ? n : null,
  };
}

const COLUNAS_PLANO_PUBLICO =
  "codigo, nome, descricao, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem, " +
  "vitrine_foto_fachada, vitrine_secoes_max, vitrine_fixados_max, recomendado";

/** Planos à venda (tabela planos, só os ativos), na ordem do painel. */
export const planosPublicos = cache(async (): Promise<PlanoPublico[]> =>
  seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("planos").select(COLUNAS_PLANO_PUBLICO).eq("ativo", true).order("ordem").order("nome");
    return error ? [] : ((data ?? []) as unknown as PlanoPublico[]);
  }, []),
);

/**
 * Configuração marcada como pública no painel, lida pela tabela (o visitante sem login não usa a
 * função config(), só lê as linhas públicas). Região primeiro, depois a global; senão o padrão.
 */
async function lerConfigPublica<T>(chave: string, microrregiaoId: string | null, padrao: T): Promise<T | unknown> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("configuracoes").select("valor, microrregiao_id").eq("chave", chave);
    if (error || !data) return padrao;
    const linhas = data as { valor: unknown; microrregiao_id: string | null }[];
    const daRegiao = microrregiaoId ? linhas.find((l) => l.microrregiao_id === microrregiaoId) : undefined;
    const global = linhas.find((l) => l.microrregiao_id === null);
    return (daRegiao ?? global)?.valor ?? padrao;
  }, padrao);
}

/** Produtos por página na vitrine (painel → configurações: vitrine.anuncios_por_pagina). Mesmo padrão do banco. */
export async function anunciosPorPaginaVitrine(microrregiaoId: string | null): Promise<number> {
  const db = await createClient();
  const { data, error } = await db.from("configuracoes").select("valor, microrregiao_id").eq("chave", "vitrine.anuncios_por_pagina");
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar a paginação.");
  const v = (data.find((l) => l.microrregiao_id === microrregiaoId) ?? data.find((l) => l.microrregiao_id === null))?.valor ?? 120;
  const n = typeof v === "number" ? v : typeof v === "string" ? numeroDoTexto(v) : null;
  return n !== null && Number.isFinite(n) ? Math.max(Math.round(n), 1) : 120;
}

/** Perguntas da página de planos: cada linha da configuração é "Pergunta | Resposta". */
export async function perguntasDosPlanos(): Promise<PerguntaFrequente[]> {
  const v = await lerConfigPublica<unknown>("planos.perguntas_frequentes", null, []);
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((linha) => {
      const i = linha.indexOf("|");
      return i < 0 ? null : { pergunta: linha.slice(0, i).trim(), resposta: linha.slice(i + 1).trim() };
    })
    .filter((p): p is PerguntaFrequente => !!p && !!p.pergunta && !!p.resposta);
}
