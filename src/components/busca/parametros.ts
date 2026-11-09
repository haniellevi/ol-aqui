// Lê e monta os parâmetros da busca no endereço (?q=&cidade=&preco_min=...).
// Tudo vai pela URL (GET): a página pode ser compartilhada e funciona sem JavaScript.
// Serve no servidor e no navegador (sem acesso a banco).
import { centavosDoTexto, numeroDoTexto, precoFalado } from "@/lib/formato";
import type { CampoCategoria, FiltrosBusca, OrdemBusca } from "@/lib/tipos";

export type ParametrosUrl = Record<string, string | string[] | undefined>;

export const POR_PAGINA = 24;
export const ID_FOLHA = "filtros";
export const ID_RESULTADOS = "resultados";

export const ORDENS: { valor: OrdemBusca; rotulo: string }[] = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "recentes", rotulo: "Mais novos" },
  { valor: "menor_preco", rotulo: "Menor preço" },
  { valor: "maior_preco", rotulo: "Maior preço" },
];

/** Nomes dos parâmetros dos campos da categoria: c_<chave> (ou c_<chave>_min / _max para números). */
export const paramCampo = (chave: string, parte?: "min" | "max") => (parte ? `c_${chave}_${parte}` : `c_${chave}`);

/** Valores digitados nos campos da categoria (para preencher o formulário de volta). */
export type ValoresCampos = Record<string, string | string[]>;

export type EstadoBusca = {
  q: string;
  categoria: string; // slug (só na /busca; nas páginas /c vem do endereço)
  cidade: string;
  precoMinTexto: string;
  precoMaxTexto: string;
  precoMin: number | null; // centavos
  precoMax: number | null;
  ordem: OrdemBusca;
  pagina: number;
  valores: ValoresCampos;
  filtros: FiltrosBusca;
  /** Valores inválidos não podem ampliar a busca silenciosamente. Chave = nome do campo. */
  erros: Record<string, string>;
  /** Quantos filtros estão ligados (para o chip "Filtros (n)"). */
  quantos: number;
};

function um(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim().slice(0, 120);
}

/** Só filtros conhecidos seguem ao trocar o termo; a nova busca começa na primeira página. */
export function manterFiltros(sp: ParametrosUrl): ParametrosUrl {
  return Object.fromEntries(Object.entries(sp).filter(([k]) =>
    ["categoria", "cidade", "preco_min", "preco_max", "ordem"].includes(k) || /^c_[a-z0-9_]+$/.test(k),
  ));
}

function numeroDoFiltro(texto: string): number | null {
  const s = texto.replace(/\s/g, "");
  if (!/^-?(?:(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?|\d+\.\d+)$/.test(s)) return null;
  const n = numeroDoTexto(s);
  return n != null && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : null;
}

function varios(v: string | string[] | undefined): string[] {
  const lista = Array.isArray(v) ? v : v ? [v] : [];
  return lista.map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
}

/**
 * Lê o endereço. `campos` = campos da subcategoria marcados como filtro (os outros são ignorados).
 * `comCategoria` = a categoria vem do parâmetro ?categoria= (tela de busca) e conta como filtro.
 */
export function lerEstadoBusca(sp: ParametrosUrl, campos: CampoCategoria[] = [], comCategoria = false): EstadoBusca {
  const ordemTexto = um(sp.ordem);
  const ordem = (ORDENS.find((o) => o.valor === ordemTexto)?.valor ?? "relevancia") as OrdemBusca;
  const pagina = Math.min(Math.max(Math.floor(Number(um(sp.pagina)) || 1), 1), 500);
  const precoMinTexto = um(sp.preco_min);
  const precoMaxTexto = um(sp.preco_max);
  const cidade = um(sp.cidade);
  const categoria = comCategoria ? um(sp.categoria).toLowerCase() : "";

  const valores: ValoresCampos = {};
  const filtros: FiltrosBusca = {};
  const erros: Record<string, string> = {};
  let quantosCampos = 0;
  for (const c of campos) {
    if (!c.filtro) continue;
    if (c.tipo === "numero") {
      const minT = um(sp[paramCampo(c.chave, "min")]);
      const maxT = um(sp[paramCampo(c.chave, "max")]);
      const min = numeroDoFiltro(minT);
      const max = numeroDoFiltro(maxT);
      for (const [parte, texto, n] of [["min", minT, min], ["max", maxT, max]] as const) {
        const chave = paramCampo(c.chave, parte);
        if (texto && n == null) erros[chave] = `${c.rotulo}: informe um número válido.`;
        else if (n != null && c.min != null && n < c.min) erros[chave] = `${c.rotulo}: o valor mínimo permitido é ${c.min}.`;
        else if (n != null && c.max != null && n > c.max) erros[chave] = `${c.rotulo}: o valor máximo permitido é ${c.max}.`;
      }
      if (min != null && max != null && min > max) erros[paramCampo(c.chave, "max")] = `${c.rotulo}: o valor máximo deve ser maior ou igual ao mínimo.`;
      if (minT) valores[paramCampo(c.chave, "min")] = minT;
      if (maxT) valores[paramCampo(c.chave, "max")] = maxT;
      if (min != null || max != null) {
        filtros[c.chave] = { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
      }
      if (minT || maxT) quantosCampos++;
    } else if (c.tipo === "lista") {
      const opcoes = new Set(c.opcoes ?? []);
      const escolhidos = [...new Set(varios(sp[paramCampo(c.chave)]).filter((v) => opcoes.has(v)))];
      if (escolhidos.length) {
        valores[paramCampo(c.chave)] = escolhidos;
        filtros[c.chave] = escolhidos;
        quantosCampos++;
      }
    } else if (c.tipo === "sim_nao") {
      const v = um(sp[paramCampo(c.chave)]);
      if (v === "sim" || v === "nao") {
        valores[paramCampo(c.chave)] = v;
        filtros[c.chave] = v === "sim";
        quantosCampos++;
      }
    } else {
      const v = um(sp[paramCampo(c.chave)]);
      if (v) {
        valores[paramCampo(c.chave)] = v;
        filtros[c.chave] = v;
        quantosCampos++;
      }
    }
  }

  const precoMin = centavosDoTexto(precoMinTexto);
  const precoMax = centavosDoTexto(precoMaxTexto);
  if (precoMinTexto && precoMin == null) erros.preco_min = "Informe um preço mínimo válido, como 100 ou 1.500,50.";
  if (precoMaxTexto && precoMax == null) erros.preco_max = "Informe um preço máximo válido, como 100 ou 1.500,50.";
  if (precoMin != null && precoMax != null && precoMin > precoMax) erros.preco_max = "O preço máximo deve ser maior ou igual ao mínimo.";
  const quantos =
    quantosCampos +
    (cidade ? 1 : 0) +
    (precoMinTexto || precoMaxTexto ? 1 : 0) +
    (categoria ? 1 : 0) +
    (ordem !== "relevancia" ? 1 : 0);

  return {
    q: um(sp.q),
    categoria,
    cidade,
    precoMinTexto,
    precoMaxTexto,
    precoMin,
    precoMax,
    ordem,
    pagina,
    valores,
    filtros,
    erros,
    quantos,
  };
}

/** Texto curto da faixa de preço para o chip: "Até R$ 60 mil", "De R$ 1 mil a R$ 5 mil". */
export function textoPreco(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${precoFalado(min)} a ${precoFalado(max)}`;
  if (max != null) return `Até ${precoFalado(max)}`;
  if (min != null) return `A partir de ${precoFalado(min)}`;
  return null;
}

/** Copia os parâmetros atuais trocando alguns (null apaga). Sempre tira "pagina" quando não for informada. */
export function comParametros(caminho: string, sp: ParametrosUrl, mudar: Record<string, string | null> = {}): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in mudar || k === "pagina") continue;
    for (const x of Array.isArray(v) ? v : v ? [v] : []) if (x !== "") u.append(k, x);
  }
  for (const [k, v] of Object.entries(mudar)) if (v != null && v !== "") u.set(k, v);
  const s = u.toString();
  return s ? `${caminho}?${s}` : caminho;
}

/** "Corrente e região" (cidade-sede da região) ou o nome da região. */
export function lugarDaRegiao(regiao: { cidadeSede: string | null; nome: string } | null | undefined): string {
  if (!regiao) return "sua região";
  return regiao.cidadeSede ? `${regiao.cidadeSede} e região` : regiao.nome;
}
