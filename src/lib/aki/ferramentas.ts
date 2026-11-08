import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarAnuncios, faixaPreco, meuAnuncio, meusAnuncios } from "@/lib/dados/anuncios";
import { categoriaPorSlug, listarCategorias } from "@/lib/dados/categorias";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { traduzirErro } from "@/lib/erros";
import { linkAnuncio, preco as precoTexto } from "@/lib/formato";
import { LINK_PLANOS, linkPedirRadar } from "@/lib/rotas";
import { filtrarAtributos } from "@/components/anunciar/atributos";
import { urlPasso } from "@/components/anunciar/passos";
import { CHAVE_DADOS } from "@/lib/aki/sistema";
import { centavosDeReais, ehId, escolha, texto, validarPedidoRadar, URGENCIAS_RADAR } from "@/lib/aki/validar";
import type { AcaoAki, CartaoAki } from "@/lib/aki/tipos";
import type { FerramentaIA } from "@/lib/aki/provedores";
import type { AnuncioCard, Atributos, CampoCategoria } from "@/lib/tipos";

// Funções que o Aki pode usar. Todas rodam com o cliente Supabase DA PRÓPRIA PESSOA
// (createClient com o token do Clerk), então a RLS do banco vale como no site.
// Não existe função que publique, pague, apague ou mostre contato.
// Tudo que veio de anúncio ou de usuário volta dentro de CHAVE_DADOS (é dado, não ordem).

export type ContextoFerramentas = {
  db: SupabaseClient;
  userId: string;
  regiao: { id: string; slug: string | null; nome: string };
  cidades: string[];
  cidadePerfil: string | null;
  /**
   * Rascunhos que o Aki pode alterar nesta conversa: o que a pessoa abriu (passo Fotos), os que o
   * próprio Aki criou antes nesta conversa e os que criar agora. Outro id (por exemplo, vindo de texto
   * de anúncio) não é aceito: assim nada de fora reescreve um rascunho que a pessoa está fazendo.
   */
  rascunhosPermitidos: Set<string>;
  /** Cartões e botões que a tela mostra embaixo da resposta. */
  saida: { cartoes: CartaoAki[]; acoes: AcaoAki[]; usadas: string[] };
  /** Conta uma busca sem resultado (feita pelo servidor, sem dados pessoais). */
  registrarBuscaVazia: (termo: string, categoria: string | null) => Promise<void>;
};

const MAX_CARTOES = 6;
const MAX_PRECO_REAIS = 1_000_000_000;

const ROTULOS: Record<string, string> = {
  buscar_anuncios: "Procurando anúncios…",
  listar_categorias: "Vendo as categorias…",
  campos_da_categoria: "Vendo o que a categoria pede…",
  faixa_de_preco_regiao: "Vendo os preços da região…",
  salvar_rascunho_anuncio: "Guardando o rascunho…",
  preparar_pedido_radar: "Preparando o pedido no Radar…",
  meus_anuncios: "Vendo seus anúncios…",
  consultar_planos: "Vendo os planos e preços…",
  gerar_link_destaque: "Preparando o destaque…",
  pedidos_radar_da_regiao: "Vendo os pedidos do Radar…",
};
export const rotuloFerramenta = (nome: string) => ROTULOS[nome] ?? "Pensando…";

export const FERRAMENTAS: FerramentaIA[] = [
  {
    nome: "buscar_anuncios",
    descricao:
      "Procura anúncios ativos na região da pessoa. Os achados aparecem como cartões na tela. Use palavras simples no texto (ex.: 'moto', 'geladeira frost free').",
    parametros: {
      type: "object",
      properties: {
        texto: { type: "string", description: "O que a pessoa procura, em poucas palavras." },
        categoria_slug: { type: "string", description: "Slug da categoria (de listar_categorias), opcional." },
        cidade: { type: "string", description: "Nome da cidade da região, opcional." },
        preco_min_reais: { type: "number", description: "Preço mínimo em reais, opcional." },
        preco_max_reais: { type: "number", description: "Preço máximo em reais, opcional." },
        ordem: { type: "string", enum: ["relevancia", "recentes", "menor_preco", "maior_preco"] },
      },
      additionalProperties: false,
    },
  },
  {
    nome: "listar_categorias",
    descricao: "Lista as categorias e subcategorias do site (nome e slug). Anúncio precisa de subcategoria.",
    parametros: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    nome: "campos_da_categoria",
    descricao: "Mostra os campos que uma subcategoria pede no anúncio (ex.: marca, ano, km), com as opções de cada um.",
    parametros: {
      type: "object",
      properties: { categoria_slug: { type: "string" } },
      required: ["categoria_slug"],
      additionalProperties: false,
    },
  },
  {
    nome: "faixa_de_preco_regiao",
    descricao: "Faixa de preço dos anúncios parecidos na região (calculada de anúncios reais). Pode não ter dados suficientes.",
    parametros: {
      type: "object",
      properties: { categoria_slug: { type: "string" } },
      required: ["categoria_slug"],
      additionalProperties: false,
    },
  },
  {
    nome: "salvar_rascunho_anuncio",
    descricao:
      "Cria ou altera um RASCUNHO de anúncio da pessoa (nunca publica). Mande só o que já sabe. Para alterar, mande o rascunho_id que voltou antes. Depois aparecem os botões para colocar fotos e publicar.",
    parametros: {
      type: "object",
      properties: {
        rascunho_id: { type: "string", description: "Id do rascunho já criado (para alterar)." },
        categoria_slug: { type: "string", description: "Slug da SUBcategoria." },
        titulo: { type: "string", description: "Título curto, 5 a 90 letras. Ex.: Geladeira Consul Frost Free 340L" },
        descricao: { type: "string", description: "Descrição simples e honesta, até 4000 letras." },
        preco_reais: { type: "number", description: "Preço em reais." },
        a_combinar: { type: "boolean", description: "true se a pessoa quer preço a combinar." },
        aceita_troca: { type: "boolean" },
        atributos: {
          type: "object",
          description: "Campos da categoria (chave do campo → valor), ex.: {\"marca\":\"Consul\",\"estado\":\"Usado\"}.",
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        cidade: { type: "string", description: "Cidade da região onde o produto está." },
        bairro: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    nome: "preparar_pedido_radar",
    descricao:
      "Prepara um pedido no Radar (as lojas da região mandam propostas). NÃO cria o pedido: aparece um botão para a pessoa confirmar.",
    parametros: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "O que procura, 8 a 120 letras. Ex.: Procuro moto para roça até 10 mil" },
        detalhes: { type: "string", description: "Detalhes, até 1000 letras." },
        preco_max_reais: { type: "number" },
        cidade: { type: "string" },
        urgencia: { type: "string", enum: [...URGENCIAS_RADAR] },
        categoria_slug: { type: "string" },
      },
      required: ["titulo"],
      additionalProperties: false,
    },
  },
  {
    nome: "meus_anuncios",
    descricao: "Lista os anúncios da própria pessoa com status, visualizações e cliques no WhatsApp.",
    parametros: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    nome: "consultar_planos",
    descricao: "Lê os planos, o preço do anúncio avulso e do destaque, direto das tabelas do painel. Única fonte de preços.",
    parametros: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    nome: "pedidos_radar_da_regiao",
    descricao:
      "Lista os pedidos abertos no Radar da região (o que os compradores estão procurando), para quem vende ver se combina com o estoque. Detalhes e nome do comprador só aparecem para quem tem plano com Radar; contato nunca.",
    parametros: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Palavra para filtrar os pedidos (ex.: 'moto', 'geladeira'), opcional." },
      },
      additionalProperties: false,
    },
  },
  {
    nome: "gerar_link_destaque",
    descricao: "Mostra o botão para a pessoa destacar um anúncio dela que está no ar. Não cobra nada: a pessoa paga na tela de destaque.",
    parametros: {
      type: "object",
      properties: { anuncio_id: { type: "string" } },
      required: ["anuncio_id"],
      additionalProperties: false,
    },
  },
];

type Resultado = { conteudo: string; erro?: boolean };

const ok = (dados: Record<string, unknown>): Resultado => ({ conteudo: JSON.stringify(dados) });
const falha = (mensagem: string): Resultado => ({ conteudo: JSON.stringify({ erro: mensagem }), erro: true });
const reais = (c: number | null | undefined) => (c == null ? null : precoTexto(c));

const chaveAcao = (a: AcaoAki) => (a.tipo === "link" ? a.href : a.tipo === "rascunho" ? `rascunho:${a.id}` : `radar:${a.dados.titulo}`);

function addAcao(ctx: ContextoFerramentas, acao: AcaoAki) {
  const chave = chaveAcao(acao);
  const i = ctx.saida.acoes.findIndex((a) => chaveAcao(a) === chave);
  if (i >= 0) {
    if (acao.tipo === "rascunho") ctx.saida.acoes[i] = acao; // prévia do rascunho sempre com os dados mais novos
    return;
  }
  if (ctx.saida.acoes.length < 4) ctx.saida.acoes.push(acao);
}

function paraCartao(a: AnuncioCard): CartaoAki {
  return {
    id: a.id,
    titulo: a.titulo,
    preco_centavos: a.preco_centavos,
    cidade: a.cidade,
    capa: a.capa,
    criado_em: a.criado_em,
    destaque: a.destaque,
    vitrine_nome: a.vitrine_nome,
    vitrine_selo: a.vitrine_selo,
    vitrine_tipo: a.vitrine_tipo,
    aceita_troca: a.aceita_troca,
  };
}

/** Roda uma ferramenta. Argumento inválido nunca vira exceção: volta erro para a IA explicar. */
export async function executarFerramenta(nome: string, args: Record<string, unknown> | null, ctx: ContextoFerramentas): Promise<Resultado> {
  if (!args) return falha("Argumentos inválidos.");
  ctx.saida.usadas.push(nome);
  try {
    switch (nome) {
      case "buscar_anuncios":
        return await buscar(args, ctx);
      case "listar_categorias":
        return await categorias();
      case "campos_da_categoria":
        return await campos(args);
      case "faixa_de_preco_regiao":
        return await faixa(args, ctx);
      case "salvar_rascunho_anuncio":
        return await salvarRascunho(args, ctx);
      case "preparar_pedido_radar":
        return await prepararRadar(args, ctx);
      case "meus_anuncios":
        return await meus();
      case "consultar_planos":
        return await planos(ctx);
      case "gerar_link_destaque":
        return await destaque(args, ctx);
      case "pedidos_radar_da_regiao":
        return await pedidosRadar(args, ctx);
      default:
        return falha("Essa função não existe.");
    }
  } catch {
    return falha("A função falhou agora. Tente de novo daqui a pouco.");
  }
}

/* ------------------------------ Busca ------------------------------ */

async function buscar(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  const termo = texto(args.texto, 80);
  const avisos: string[] = [];
  let categoria: string | null = null;
  const slug = texto(args.categoria_slug, 60);
  if (slug) {
    if (await categoriaPorSlug(slug)) categoria = slug;
    else avisos.push(`categoria "${slug}" não existe; busquei sem categoria`);
  }
  let cidade: string | null = null;
  const c = texto(args.cidade, 80);
  if (c) {
    const achada = ctx.cidades.find((x) => x.toLowerCase() === c.toLowerCase());
    if (achada) cidade = achada;
    else avisos.push(`cidade "${c}" não é da região; busquei na região toda`);
  }
  const precoMin = centavosDeReais(args.preco_min_reais, MAX_PRECO_REAIS);
  const precoMax = centavosDeReais(args.preco_max_reais, MAX_PRECO_REAIS);
  const ordem = escolha(args.ordem, ["relevancia", "recentes", "menor_preco", "maior_preco"] as const);

  const r = await buscarAnuncios({
    q: termo,
    categoria,
    cidade,
    precoMin,
    precoMax,
    ordem,
    regiao: ctx.regiao.slug,
    limite: MAX_CARTOES,
  });
  if (r.total === 0 && (termo || categoria)) {
    await ctx.registrarBuscaVazia(termo ?? categoria ?? "", categoria).catch(() => undefined);
  }
  for (const a of r.anuncios) {
    if (!ctx.saida.cartoes.some((x) => x.id === a.id) && ctx.saida.cartoes.length < MAX_CARTOES) ctx.saida.cartoes.push(paraCartao(a));
  }
  return ok({
    total_encontrado: r.total,
    mostrando_na_tela: r.anuncios.length,
    avisos,
    [CHAVE_DADOS]: r.anuncios.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      preco: a.preco_centavos == null ? "a combinar" : reais(a.preco_centavos),
      aceita_troca: a.aceita_troca,
      cidade: a.cidade,
      categoria: a.categoria_nome,
      vendedor: a.vitrine_nome,
      loja_verificada: a.vitrine_selo,
      patrocinado: a.destaque,
      link: linkAnuncio(a.id, a.titulo),
    })),
  });
}

/* ---------------------------- Categorias ---------------------------- */

async function categorias(): Promise<Resultado> {
  const arvore = await listarCategorias();
  return ok({
    categorias: arvore.map((p) => ({
      nome: p.nome,
      slug: p.slug,
      subcategorias: p.filhas.map((f) => ({ nome: f.nome, slug: f.slug })),
    })),
  });
}

async function campos(args: Record<string, unknown>): Promise<Resultado> {
  const slug = texto(args.categoria_slug, 60);
  const achada = slug ? await categoriaPorSlug(slug) : null;
  if (!achada) return falha("Categoria não encontrada. Use listar_categorias.");
  if (!achada.pai) {
    return ok({ aviso: "É categoria-mãe: escolha uma subcategoria.", subcategorias: achada.filhas.map((f) => ({ nome: f.nome, slug: f.slug })) });
  }
  return ok({
    categoria: achada.categoria.nome,
    campos: achada.categoria.campos.map((c) => ({
      chave: c.chave,
      rotulo: c.rotulo,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      opcoes: c.opcoes,
      min: c.min,
      max: c.max,
      unidade: c.unidade,
    })),
  });
}

async function faixa(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  const slug = texto(args.categoria_slug, 60);
  const achada = slug ? await categoriaPorSlug(slug) : null;
  if (!achada) return falha("Categoria não encontrada. Use listar_categorias.");
  const f = await faixaPreco(achada.categoria.id, ctx.regiao.id);
  if (!f || f.minimo == null || f.maximo == null) {
    return ok({ faixa: null, anuncios_parecidos: f?.quantidade ?? 0, aviso: "Poucos anúncios parecidos na região para calcular a faixa. Não invente preço." });
  }
  return ok({ faixa: { de: reais(f.minimo), ate: reais(f.maximo) }, anuncios_parecidos: f.quantidade });
}

/* ----------------------------- Rascunho ----------------------------- */

async function salvarRascunho(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  const conta = await meuPerfilEVitrine();
  if (!conta) return falha("A pessoa precisa entrar na conta.");
  if (!conta.vitrine) {
    addAcao(ctx, { tipo: "link", rotulo: "Quero vender", href: "/quero-vender", icone: "vender" });
    return falha('A pessoa ainda não ativou a venda. Peça para ela tocar no botão "Quero vender" e depois voltar.');
  }
  if (conta.vitrine.status === "suspensa") return falha("A vitrine da pessoa está suspensa. Ela deve falar com o suporte.");

  const id = args.rascunho_id;
  let categoriaAtual: string | null = null;
  if (id !== undefined && id !== null && id !== "") {
    if (!ehId(id)) return falha("rascunho_id inválido.");
    if (!ctx.rascunhosPermitidos.has(id)) {
      return falha("Esse rascunho não foi aberto nesta conversa. Não mude: crie um rascunho novo (sem rascunho_id) ou peça para a pessoa abrir o Aki pelo passo Fotos do anúncio.");
    }
    const a = await meuAnuncio(id);
    if (!a) return falha("Rascunho não encontrado.");
    if (a.status !== "rascunho") {
      return falha("Esse anúncio já foi publicado. O Aki só mexe em rascunho: a pessoa edita pelo botão Editar em Meus anúncios.");
    }
    categoriaAtual = a.categoria_id;
  } else if (!conta.podePublicar) {
    addAcao(ctx, { tipo: "link", rotulo: "Ver planos", href: LINK_PLANOS, icone: "planos" });
    return falha("A pessoa chegou no limite de anúncios do plano. Mostre as opções: anúncio avulso ou trocar de plano (consultar_planos).");
  }

  const colunas: Record<string, unknown> = {};
  const avisos: string[] = [];
  let camposCategoria: CampoCategoria[] | null = null;

  const slug = texto(args.categoria_slug, 60);
  if (slug) {
    const achada = await categoriaPorSlug(slug);
    if (!achada) return falha("Categoria não encontrada. Use listar_categorias.");
    if (!achada.pai) return falha(`"${achada.categoria.nome}" é categoria-mãe: escolha uma subcategoria.`);
    colunas.categoria_id = achada.categoria.id;
    camposCategoria = achada.categoria.campos;
  } else if (categoriaAtual) {
    const lista = await listarCategorias();
    camposCategoria = lista.flatMap((p) => p.filhas).find((f) => f.id === categoriaAtual)?.campos ?? null;
  }

  if (args.titulo !== undefined) {
    const t = texto(args.titulo, 90);
    if (!t || t.length < 5) return falha("O título precisa de 5 a 90 letras.");
    colunas.titulo = t;
  }
  if (args.descricao !== undefined) colunas.descricao = texto(args.descricao, 4000, true);
  if (args.a_combinar === true) colunas.preco_centavos = null;
  else if (args.preco_reais !== undefined) {
    const c = centavosDeReais(args.preco_reais, MAX_PRECO_REAIS);
    if (c === null) return falha("Preço inválido. Use só o valor em reais, maior que zero.");
    colunas.preco_centavos = c;
  }
  if (typeof args.aceita_troca === "boolean") colunas.aceita_troca = args.aceita_troca;
  if (args.cidade !== undefined) {
    const c = texto(args.cidade, 80);
    const achada = c ? ctx.cidades.find((x) => x.toLowerCase() === c.toLowerCase()) : null;
    if (achada) colunas.cidade = achada;
    else avisos.push(`a cidade "${c ?? ""}" não é da região; a pessoa escolhe a cidade no passo Local`);
  }
  if (args.bairro !== undefined) colunas.bairro = texto(args.bairro, 80);
  if (args.atributos !== undefined) {
    const brutos = args.atributos && typeof args.atributos === "object" && !Array.isArray(args.atributos) ? (args.atributos as Record<string, unknown>) : {};
    const limpos: Atributos = {};
    for (const [k, v] of Object.entries(brutos).slice(0, 30)) {
      if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
      if (typeof v === "string") {
        const t = texto(v, 120);
        if (t) limpos[k] = t;
      } else if (typeof v === "number" && Number.isFinite(v)) limpos[k] = v;
      else if (typeof v === "boolean") limpos[k] = v;
    }
    if (camposCategoria) colunas.atributos = filtrarAtributos(limpos, camposCategoria);
    else avisos.push("os campos da categoria só são guardados depois de escolher a subcategoria");
  }

  let rascunhoId = typeof id === "string" && ehId(id) ? id : null;
  if (rascunhoId) {
    if (Object.keys(colunas).length) {
      const { data, error } = await ctx.db
        .from("anuncios")
        .update(colunas)
        .eq("id", rascunhoId)
        .eq("status", "rascunho") // nunca mexe em anúncio publicado
        .select("id")
        .maybeSingle();
      if (error) return falha(traduzirErro(error).mensagem);
      if (!data) return falha("Rascunho não encontrado.");
    }
  } else {
    const { data, error } = await ctx.db
      .from("anuncios")
      .insert({ ...colunas, vitrine_id: conta.vitrine.id, status: "rascunho" })
      .select("id")
      .single();
    if (error || !data) return falha(traduzirErro(error).mensagem);
    rascunhoId = String(data.id);
    ctx.rascunhosPermitidos.add(rascunhoId);
  }

  const atual = await meuAnuncio(rascunhoId);
  const falta: string[] = [];
  if (!atual?.fotos?.length) falta.push("fotos (a pessoa coloca pelo botão)");
  if (!atual?.categoria_id) falta.push("categoria");
  if (!atual?.titulo) falta.push("título");
  if (atual && atual.preco_centavos == null && args.a_combinar !== true) falta.push("preço (ou a combinar)");
  if (!atual?.cidade) falta.push("cidade");

  // card pronto: a pessoa vê foto, título e preço e toca em "Revisar e publicar" (o Aki nunca publica)
  addAcao(ctx, {
    tipo: "rascunho",
    id: rascunhoId,
    titulo: atual?.titulo ?? null,
    preco_centavos: atual?.preco_centavos ?? null,
    capa: atual?.fotos?.[0] ?? null,
    fotos: atual?.fotos?.length ?? 0,
    href: urlPasso("revisar", rascunhoId),
  });
  if (!atual?.fotos?.length) addAcao(ctx, { tipo: "link", rotulo: "Colocar as fotos", href: urlPasso("fotos", rascunhoId), icone: "vender" });
  return ok({ rascunho_id: rascunhoId, salvo: true, publicado: false, falta, avisos });
}

/* ------------------------------- Radar ------------------------------- */

async function prepararRadar(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  let categoria: string = "geral";
  const slug = texto(args.categoria_slug, 60);
  if (slug) {
    const achada = await categoriaPorSlug(slug);
    if (achada) categoria = achada.categoria.tipo_legado;
  }
  const cidadeArg = texto(args.cidade, 80);
  const cidade =
    (cidadeArg && ctx.cidades.find((x) => x.toLowerCase() === cidadeArg.toLowerCase())) ?? ctx.cidadePerfil ?? ctx.cidades[0] ?? null;
  const v = validarPedidoRadar({
    titulo: args.titulo,
    detalhes: args.detalhes,
    preco_max_centavos: centavosDeReais(args.preco_max_reais, MAX_PRECO_REAIS),
    cidade,
    urgencia: args.urgencia,
    categoria,
  });
  if (!v.ok) return falha(v.erro);

  const { data: confirmado } = await ctx.db.rpc("whatsapp_confirmado");
  if (confirmado !== true) {
    addAcao(ctx, { tipo: "link", rotulo: "Confirmar meu celular", href: "/minha-conta/dados", icone: "celular" });
    return falha("Para pedir no Radar a pessoa precisa confirmar o celular primeiro (botão na tela). Depois é só pedir de novo.");
  }
  addAcao(ctx, { tipo: "pedido_radar", rotulo: "Confirmar pedido no Radar", dados: v.dados });
  // quem prefere escolher prazo e faixa de preço abre o formulário com o texto já preenchido
  addAcao(ctx, { tipo: "link", rotulo: "Mudar detalhes ou prazo", href: linkPedirRadar(v.dados.titulo), icone: "radar" });
  return ok({ preparado: true, criado: false, aviso: 'O pedido só vai para o Radar quando a pessoa tocar em "Confirmar pedido no Radar".', pedido: v.dados });
}

/* -------------------------- Pedidos do Radar -------------------------- */

type LinhaRadar = {
  id: string;
  categoria: string;
  titulo: string;
  detalhes: string | null;
  preco_max_centavos: number | null;
  cidade: string | null;
  urgencia: string;
  total_propostas: number;
  max_propostas: number | null;
  criado_em: string;
  comprador_primeiro_nome: string | null;
  ja_propus: boolean;
};

async function pedidosRadar(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  if (!ctx.regiao.id) return falha("A pessoa precisa terminar o cadastro (região) para ver o Radar.");
  // radar_feed() roda com a sessão da pessoa: detalhes e nome só para quem tem plano com Radar; contato nunca
  const [{ data, error }, { data: acesso }] = await Promise.all([
    ctx.db
      .rpc("radar_feed")
      .eq("microrregiao_id", ctx.regiao.id)
      .select("id, categoria, titulo, detalhes, preco_max_centavos, cidade, urgencia, total_propostas, max_propostas, criado_em, comprador_primeiro_nome, ja_propus")
      .order("criado_em", { ascending: false })
      .limit(40),
    ctx.db.rpc("tem_plano_pago"),
  ]);
  if (error) return falha("Não consegui ler o Radar agora.");
  const termo = texto(args.texto, 60);
  const t = termo ? termo.toLowerCase() : null;
  const lista = ((data ?? []) as LinhaRadar[])
    .filter((p) => !t || p.titulo.toLowerCase().includes(t) || (p.detalhes ?? "").toLowerCase().includes(t))
    .slice(0, 10);
  addAcao(ctx, { tipo: "link", rotulo: "Abrir o Radar", href: "/radar", icone: "radar" });
  if (acesso !== true) addAcao(ctx, { tipo: "link", rotulo: "Ver planos", href: LINK_PLANOS, icone: "planos" });
  return ok({
    total: lista.length,
    tem_plano_com_radar: acesso === true,
    aviso:
      acesso === true
        ? "Para mandar proposta a pessoa toca em Abrir o Radar."
        : "Sem plano com Radar a pessoa vê só o título; para ver detalhes e mandar proposta precisa de um plano (consultar_planos).",
    [CHAVE_DADOS]: lista.map((p) => ({
      titulo: p.titulo,
      detalhes: p.detalhes,
      preco_maximo: p.preco_max_centavos == null ? null : reais(p.preco_max_centavos),
      cidade: p.cidade,
      urgencia: p.urgencia,
      propostas: `${p.total_propostas}${p.max_propostas ? ` de ${p.max_propostas}` : ""}`,
      ja_mandei_proposta: p.ja_propus,
      comprador: p.comprador_primeiro_nome,
    })),
  });
}

/* ---------------------------- Meus anúncios --------------------------- */

async function meus(): Promise<Resultado> {
  const lista = (await meusAnuncios()).slice(0, 20);
  return ok({
    total: lista.length,
    [CHAVE_DADOS]: lista.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      status: a.status,
      preco: a.preco_centavos == null ? "a combinar" : reais(a.preco_centavos),
      visualizacoes: a.visualizacoes,
      cliques_whatsapp: a.cliques_whatsapp,
      favoritos: a.total_favoritos,
      em_destaque: !!a.destaque_ate && new Date(a.destaque_ate).getTime() > Date.now(),
      motivo_analise: a.motivo_analise,
    })),
  });
}

/* ------------------------------- Planos ------------------------------- */

async function planos(ctx: ContextoFerramentas): Promise<Resultado> {
  const [{ data, error }, ...configs] = await Promise.all([
    ctx.db
      .from("planos")
      .select("codigo, nome, descricao, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste")
      .eq("ativo", true)
      .order("ordem"),
    ...["avulso.preco_centavos", "avulso.dias", "destaque.preco_centavos", "destaque.dias"].map((chave) =>
      ctx.db.rpc("config", { p_chave: chave, p_microrregiao: ctx.regiao.id, p_padrao: null }),
    ),
  ]);
  if (error) return falha("Não consegui ler os planos agora.");
  const num = (r: { data: unknown }) => (typeof r.data === "number" ? r.data : null);
  addAcao(ctx, { tipo: "link", rotulo: "Ver planos", href: LINK_PLANOS, icone: "planos" });
  return ok({
    planos: (data ?? []).map((p) => ({
      nome: p.nome,
      descricao: p.descricao,
      para: p.publico === "pf" ? "pessoa física" : p.publico === "pj" ? "lojas" : "todos",
      preco: p.preco_centavos > 0 ? reais(p.preco_centavos) : "grátis",
      dias: p.periodo_dias,
      limite_anuncios: p.limite_anuncios ?? "ilimitado",
      radar: p.acesso_radar,
      propostas_radar_por_mes: p.acesso_radar ? p.propostas_radar_mes ?? "ilimitado" : 0,
      teste_gratis: p.e_teste,
    })),
    anuncio_avulso: { preco: reais(num(configs[0])), dias: num(configs[1]) },
    destaque: { preco: reais(num(configs[2])), dias: num(configs[3]) },
    aviso: "Preços lidos agora das tabelas do painel. Valor vazio = não configurado (não invente).",
  });
}

/* ------------------------------ Destaque ------------------------------ */

async function destaque(args: Record<string, unknown>, ctx: ContextoFerramentas): Promise<Resultado> {
  if (!ehId(args.anuncio_id)) return falha("anuncio_id inválido. Use meus_anuncios para achar o id.");
  const a = await meuAnuncio(args.anuncio_id);
  if (!a) return falha("Anúncio não encontrado entre os anúncios da pessoa.");
  if (a.status !== "ativo") return falha("Só dá para destacar anúncio que está no ar.");
  const link = `/destacar/${a.id}`;
  addAcao(ctx, { tipo: "link", rotulo: "Destacar", href: link, icone: "destacar" });
  return ok({ link, aviso: 'A pessoa escolhe o destaque e paga na tela que abre no botão "Destacar".' });
}
