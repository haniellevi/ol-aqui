// Regras das telas 7 (Regiões e cidades) e 9 (Categorias e campos) que rodam ANTES de ir ao banco,
// só para mostrar a mensagem certa no painel. O banco confere tudo de novo (validar_campos_categoria,
// conferir_categoria, validar_cidade...). Serve no servidor e no navegador (sem acesso a banco).
import { numeroDoTexto } from "@/lib/formato";
import type { CampoCategoria, TipoCampo } from "@/lib/tipos";
import type { CampoEditado, CamposConferidos } from "@/lib/tipos-cadastros";

/** As 27 siglas (fixas: não mudam com o negócio). */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const TIPOS_CAMPO: { valor: TipoCampo; rotulo: string; dica: string }[] = [
  { valor: "texto", rotulo: "Texto", dica: "A pessoa escreve (ex.: Marca)" },
  { valor: "numero", rotulo: "Número", dica: "Só números (ex.: Ano, Km)" },
  { valor: "lista", rotulo: "Lista", dica: "Escolhe uma opção (ex.: Câmbio)" },
  { valor: "sim_nao", rotulo: "Sim ou não", dica: "Botões Sim e Não (ex.: Aceita troca)" },
];

/** Comparação de nomes sem acento, minúscula e com espaços limpos (mesma do banco: nome_comparavel). */
export const comparavel = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Espaços limpos: "  Santa   Filomena " → "Santa Filomena". */
export const limpo = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();

/** "Casa e Móveis" → "casa-e-moveis" (endereço da categoria e da região). */
export function slugDe(nome: string, max = 60): string {
  return comparavel(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** "Horas de uso" → "horas_de_uso" (chave do campo; começa com letra, até 40). */
export function chaveDe(rotulo: string): string {
  const base = comparavel(rotulo)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9_]+/, "")
    .slice(0, 36)
    .replace(/_+$/g, "");
  return base || "campo";
}

/**
 * Confere e monta a lista de campos que vai para `categorias.campos`.
 * Campo com chave já existente mantém a chave (os dados dos anúncios ficam guardados por ela);
 * campo novo ganha a chave a partir do nome, sem repetir.
 */
export function conferirCampos(editados: unknown): CamposConferidos {
  if (!Array.isArray(editados)) return { ok: false, erro: "Os campos chegaram num formato inválido. Recarregue a página." };
  const tipos = new Set<TipoCampo>(TIPOS_CAMPO.map((t) => t.valor));
  const usadas = new Set<string>();
  const rotulos = new Set<string>();
  // chaves que já existem ficam reservadas primeiro (campo novo não pega a chave de um antigo)
  for (const e of editados as Partial<CampoEditado>[]) {
    const ch = limpo(e?.chave);
    if (ch) usadas.add(ch);
  }
  const campos: CampoCategoria[] = [];
  for (const [i, e] of (editados as Partial<CampoEditado>[]).entries()) {
    const n = i + 1;
    const rotulo = limpo(e?.rotulo);
    if (rotulo.length < 1 || rotulo.length > 60) return { ok: false, erro: `Campo ${n}: escreva o nome (até 60 letras).` };
    if (rotulos.has(comparavel(rotulo))) return { ok: false, erro: `Dois campos com o mesmo nome: "${rotulo}".` };
    rotulos.add(comparavel(rotulo));
    const tipo = e?.tipo as TipoCampo;
    if (!tipos.has(tipo)) return { ok: false, erro: `Campo "${rotulo}": escolha o tipo.` };

    let chave = limpo(e?.chave);
    if (chave && !/^[a-z][a-z0-9_]{0,39}$/.test(chave)) return { ok: false, erro: `Campo "${rotulo}": chave inválida. Recarregue a página.` };
    if (!chave) {
      const base = chaveDe(rotulo);
      chave = base;
      for (let k = 2; usadas.has(chave); k++) chave = `${base}_${k}`;
      usadas.add(chave);
    }

    const campo: CampoCategoria = { chave, rotulo, tipo, obrigatorio: e?.obrigatorio === true, filtro: e?.filtro === true };
    const unidade = limpo(e?.unidade);
    if (unidade.length > 12) return { ok: false, erro: `Campo "${rotulo}": a unidade pode ter até 12 letras (ex.: km, ha).` };
    if (unidade && tipo !== "lista" && tipo !== "sim_nao") campo.unidade = unidade;

    if (tipo === "lista") {
      const opcoes: string[] = [];
      const vistas = new Set<string>();
      for (const linha of String(e?.opcoes ?? "").split(/\r?\n/)) {
        const op = limpo(linha);
        if (!op) continue;
        if (op.length > 60) return { ok: false, erro: `Campo "${rotulo}": cada opção pode ter até 60 letras.` };
        if (vistas.has(comparavel(op))) return { ok: false, erro: `Campo "${rotulo}": a opção "${op}" aparece duas vezes.` };
        vistas.add(comparavel(op));
        opcoes.push(op);
      }
      if (!opcoes.length) return { ok: false, erro: `Campo "${rotulo}" é uma lista: escreva as opções, uma por linha.` };
      campo.opcoes = opcoes;
    }
    if (tipo === "numero") {
      const minT = limpo(e?.min);
      const maxT = limpo(e?.max);
      const min = minT ? numeroDoTexto(minT) : null;
      const max = maxT ? numeroDoTexto(maxT) : null;
      if ((minT && min == null) || (maxT && max == null)) return { ok: false, erro: `Campo "${rotulo}": mínimo e máximo precisam ser números.` };
      if (min != null && max != null && min > max) return { ok: false, erro: `Campo "${rotulo}": o mínimo é maior que o máximo.` };
      if (min != null) campo.min = min;
      if (max != null) campo.max = max;
    }
    campos.push(campo);
  }
  // a busca usa c_<chave>_min e c_<chave>_max nos números
  const numeros = campos.filter((c) => c.tipo === "numero").map((c) => c.chave);
  const confuso = campos.find((c) => numeros.some((n) => c.chave === `${n}_min` || c.chave === `${n}_max`));
  if (confuso) return { ok: false, erro: `O campo "${confuso.rotulo}" confunde o filtro da busca. Mude o nome dele.` };
  return { ok: true, campos };
}

/** Campo salvo → formato do editor. */
export function paraEditor(c: CampoCategoria): CampoEditado {
  return {
    chave: c.chave,
    rotulo: c.rotulo,
    tipo: c.tipo,
    obrigatorio: !!c.obrigatorio,
    filtro: !!c.filtro,
    opcoes: (c.opcoes ?? []).join("\n"),
    unidade: c.unidade ?? "",
    min: c.min == null ? "" : String(c.min).replace(".", ","),
    max: c.max == null ? "" : String(c.max).replace(".", ","),
  };
}

/** "3 anúncios, 1 vendedor" (o que usa a cidade). Vazio = sem uso. */
export function textoUso(u: { anuncios: number; lojas: number; pessoas: number; pedidos: number }): string {
  const partes: string[] = [];
  if (u.anuncios) partes.push(`${u.anuncios} ${u.anuncios === 1 ? "anúncio" : "anúncios"}`);
  if (u.lojas) partes.push(`${u.lojas} ${u.lojas === 1 ? "vendedor" : "vendedores"}`);
  if (u.pessoas) partes.push(`${u.pessoas} ${u.pessoas === 1 ? "pessoa" : "pessoas"}`);
  if (u.pedidos) partes.push(`${u.pedidos} ${u.pedidos === 1 ? "pedido no Radar" : "pedidos no Radar"}`);
  return partes.join(", ");
}
