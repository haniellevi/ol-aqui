import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import type {
  AjudaCompleta,
  AvisoTermos,
  BlocoHome,
  ContatoEquipe,
  DocumentoLegal,
  PrecoDestaqueAjuda,
  TermoPendente,
  TipoDocumento,
  VersaoDocumento,
} from "@/lib/tipos-paginas";

// Leituras editoriais têm padrões; consulta de aceite propaga falhas para permitir nova tentativa.

const COLUNAS_VERSAO = "id, tipo, versao, titulo, resumo_mudancas, revisado_advogado, ativo, publicado_em";

/** Versão no ar dos termos ou da privacidade. */
export const documentoAtivo = cache(
  (tipo: TipoDocumento): Promise<DocumentoLegal | null> =>
    seguro(async () => {
      const db = await createClient();
      const { data, error } = await db.from("documentos_legais").select(`${COLUNAS_VERSAO}, conteudo`).eq("tipo", tipo).eq("ativo", true).maybeSingle();
      return error ? null : ((data as DocumentoLegal | null) ?? null);
    }, null),
);

/** Uma versão específica (as antigas continuam públicas). */
export async function documentoVersao(tipo: TipoDocumento, versao: number): Promise<DocumentoLegal | null> {
  if (!Number.isInteger(versao) || versao < 1) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("documentos_legais").select(`${COLUNAS_VERSAO}, conteudo`).eq("tipo", tipo).eq("versao", versao).maybeSingle();
    return error ? null : ((data as DocumentoLegal | null) ?? null);
  }, null);
}

/** Todas as versões de um tipo, da mais nova para a mais velha (sem o texto). */
export async function versoesDocumento(tipo: TipoDocumento): Promise<VersaoDocumento[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("documentos_legais").select(COLUNAS_VERSAO).eq("tipo", tipo).order("versao", { ascending: false });
    return error ? [] : ((data ?? []) as VersaoDocumento[]);
  }, []);
}

/** Versões no ar que a pessoa logada ainda não aceitou (visitante: nenhuma). */
export const termosPendentes = cache(
  async (): Promise<TermoPendente[]> => {
    const { userId } = await auth();
    if (!userId) return [];
    const db = await createClient();
    const { data, error } = await db.rpc("termos_pendentes");
    if (error) throw new Error("Não foi possível consultar os termos pendentes.");
    return (data ?? []) as TermoPendente[];
  },
);

/**
 * Configurações públicas lidas pela tabela (visitante não chama config()): região primeiro,
 * depois a global. Uma ida ao banco para várias chaves.
 */
async function configsPublicas(chaves: string[], microrregiaoId: string | null): Promise<Map<string, unknown>> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("configuracoes").select("chave, valor, microrregiao_id").in("chave", chaves);
    const mapa = new Map<string, unknown>();
    if (error || !data) return mapa;
    const linhas = data as { chave: string; valor: unknown; microrregiao_id: string | null }[];
    for (const chave of chaves) {
      const daRegiao = microrregiaoId ? linhas.find((l) => l.chave === chave && l.microrregiao_id === microrregiaoId) : undefined;
      const global = linhas.find((l) => l.chave === chave && l.microrregiao_id === null);
      const valor = (daRegiao ?? global)?.valor;
      if (valor !== undefined && valor !== null) mapa.set(chave, valor);
    }
    return mapa;
  }, new Map());
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Faixa "Atualizamos os termos": textos do painel + o que falta aceitar. Nada pendente = null. */
export async function avisoTermos(): Promise<AvisoTermos | null> {
  const pendentes = await termosPendentes();
  if (pendentes.length === 0) return null;
  // conta nova (nunca aceitou nada) vê "Falta aceitar"; quem já tinha aceitado vê "Atualizamos"
  const novo = pendentes.every((p) => p.primeira_vez);
  const c = await configsPublicas(["termos.aviso_titulo", "termos.aviso_texto", "termos.aviso_novo_titulo", "termos.aviso_novo_texto"], null);
  return {
    titulo: (novo ? texto(c.get("termos.aviso_novo_titulo")) : null) ?? texto(c.get("termos.aviso_titulo")) ?? "Atualizamos os termos",
    texto: (novo ? texto(c.get("termos.aviso_novo_texto")) : null) ?? texto(c.get("termos.aviso_texto")) ?? "Leia o resumo e toque em Aceitar.",
    pendentes,
  };
}

/** WhatsApp e e-mail da equipe (painel → Configurações → Geral). */
export async function contatoEquipe(microrregiaoId: string | null): Promise<ContatoEquipe> {
  const c = await configsPublicas(["contato.whatsapp_suporte", "contato.email_suporte", "ajuda.texto_contato"], microrregiaoId);
  const zap = String(c.get("contato.whatsapp_suporte") ?? "").replace(/\D/g, "");
  const email = texto(c.get("contato.email_suporte"));
  return {
    whatsapp: /^55[1-9][0-9]9?[0-9]{8}$/.test(zap) ? zap : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    texto: texto(c.get("ajuda.texto_contato")),
  };
}

/** Categorias e perguntas da Central de ajuda (só as ativas, pela RLS; admin vê tudo). */
export async function ajudaCompleta(): Promise<AjudaCompleta> {
  return seguro(async () => {
    const db = await createClient();
    const [cats, pergs] = await Promise.all([
      db.from("ajuda_categorias").select("slug, nome, descricao, ordem, ativa").order("ordem").order("nome"),
      db.from("ajuda_perguntas").select("id, categoria, pergunta, resposta, ordem, ativo").order("ordem").order("pergunta"),
    ]);
    if (cats.error || pergs.error) return { categorias: [], perguntas: [] };
    return { categorias: cats.data ?? [], perguntas: pergs.data ?? [] } as AjudaCompleta;
  }, { categorias: [], perguntas: [] });
}

/** Tipos de destaque à venda, com o preço da região (exceção do painel), para a ajuda. */
export async function precosDestaqueAjuda(microrregiaoId: string | null): Promise<PrecoDestaqueAjuda[]> {
  return seguro(async () => {
    const db = await createClient();
    const [tipos, regiao] = await Promise.all([
      db.from("destaque_tipos").select("slug, nome, descricao, preco_centavos, dias").eq("ativo", true).order("ordem"),
      microrregiaoId
        ? db.from("destaque_precos_regiao").select("tipo, preco_centavos, dias").eq("microrregiao_id", microrregiaoId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (tipos.error) return [];
    const excecoes = new Map(((regiao.data ?? []) as { tipo: string; preco_centavos: number | null; dias: number | null }[]).map((r) => [r.tipo, r]));
    return ((tipos.data ?? []) as PrecoDestaqueAjuda[]).map((t) => {
      const e = excecoes.get(t.slug);
      return { ...t, preco_centavos: e?.preco_centavos ?? t.preco_centavos, dias: t.slug === "subir" ? null : (e?.dias ?? t.dias) };
    });
  }, []);
}

/** Blocos da página inicial na ordem do painel. Sem banco: a ordem de sempre, com os textos de sempre. */
const BLOCOS_PADRAO: BlocoHome[] = [
  { chave: "destaques", nome: "", ordem: 10, ativo: true, pode_desligar: false, pago: true, campos: ["titulo"], titulo: null, texto: null, botao: null },
  { chave: "lojas_destaque", nome: "", ordem: 20, ativo: true, pode_desligar: false, pago: true, campos: ["titulo"], titulo: null, texto: null, botao: null },
  { chave: "radar", nome: "", ordem: 30, ativo: true, pode_desligar: true, pago: false, campos: ["titulo", "texto", "botao"], titulo: null, texto: null, botao: null },
  { chave: "lojas_regiao", nome: "", ordem: 40, ativo: true, pode_desligar: true, pago: false, campos: ["titulo"], titulo: null, texto: null, botao: null },
  { chave: "recentes", nome: "", ordem: 50, ativo: true, pode_desligar: false, pago: false, campos: ["titulo", "texto"], titulo: null, texto: null, botao: null },
];

export async function blocosHome(): Promise<BlocoHome[]> {
  const lidos = await seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("home_blocos")
      .select("chave, nome, ordem, ativo, pode_desligar, pago, campos, titulo, texto, botao")
      .order("ordem")
      .order("chave");
    return error ? null : ((data ?? []) as BlocoHome[]);
  }, null);
  if (!lidos || lidos.length === 0) return BLOCOS_PADRAO;
  // bloco que não pode desligar continua aparecendo mesmo que a linha suma (anúncio pago)
  const faltando = BLOCOS_PADRAO.filter((p) => !p.pode_desligar && !lidos.some((l) => l.chave === p.chave));
  return [...lidos, ...faltando];
}

/** Anúncio expirado ou de loja fora do ar: só a categoria, para mostrar parecidos (T44). */
export const anuncioForaDoAr = cache(async (id: string): Promise<{ categoria_slug: string | null; categoria_nome: string | null } | null> =>
  {
    const db = await createClient();
    const { data, error } = await db.rpc("anuncio_fora_do_ar", { p_anuncio_id: id });
    if (error) throw new Error("Não foi possível verificar este anúncio. Tente novamente.");
    const linha = (Array.isArray(data) ? data[0] : data) as { categoria_slug: string | null; categoria_nome: string | null } | undefined;
    return linha ?? null;
  },
);
