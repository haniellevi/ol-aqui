// Lê e confere os campos da categoria vindos do formulário (passo Detalhes).
// O banco confere de novo (validar atributos), isto só dá a mensagem certa no campo certo.
import type { Atributos, CampoCategoria } from "@/lib/tipos";
import { numeroDoTexto } from "@/lib/formato";

/** name do input de um campo da categoria. */
export const nomeAtributo = (chave: string) => `attr_${chave}`;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();


export type LeituraAtributos = { atributos: Atributos; erros: Record<string, string> };

/**
 * Converte o formulário em atributos. `exigir` = conferir os obrigatórios (ao Continuar).
 * Campos vazios ficam de fora.
 */
export function lerAtributos(campos: CampoCategoria[], form: FormData, exigir: boolean): LeituraAtributos {
  const atributos: Atributos = {};
  const erros: Record<string, string> = {};
  for (const c of campos) {
    const nome = nomeAtributo(c.chave);
    const bruto = String(form.get(nome) ?? "").trim();
    if (!bruto) {
      if (exigir && c.obrigatorio) erros[nome] = `Preencha o campo "${c.rotulo}".`;
      continue;
    }
    if (c.tipo === "numero") {
      const n = numeroDoTexto(bruto);
      if (n === null) erros[nome] = `"${c.rotulo}" precisa ser um número.`;
      else if (c.min != null && n < c.min) erros[nome] = `"${c.rotulo}" precisa ser pelo menos ${c.min}.`;
      else if (c.max != null && n > c.max) erros[nome] = `"${c.rotulo}" pode ser no máximo ${c.max}.`;
      else atributos[c.chave] = n;
    } else if (c.tipo === "lista") {
      const opcao = (c.opcoes ?? []).find((o) => semAcento(o) === semAcento(bruto));
      if (!opcao) erros[nome] = `Escolha uma opção em "${c.rotulo}".`;
      else atributos[c.chave] = opcao;
    } else if (c.tipo === "sim_nao") {
      const v = semAcento(bruto);
      if (v === "sim" || v === "true") atributos[c.chave] = true;
      else if (v === "nao" || v === "false") atributos[c.chave] = false;
      else erros[nome] = `Responda "Sim" ou "Não" em "${c.rotulo}".`;
    } else {
      if (bruto.length > 120) erros[nome] = `"${c.rotulo}" pode ter no máximo 120 letras.`;
      else atributos[c.chave] = bruto;
    }
  }
  return { atributos, erros };
}

/** Na troca de categoria, conserva apenas valores compatíveis com o campo de destino. */
export function filtrarAtributos(atributos: Atributos, campos: CampoCategoria[], origem?: CampoCategoria[]): Atributos {
  const chaves = new Set(campos.filter((campo) => {
    if (!origem) return true;
    const anterior = origem.find((c) => c.chave === campo.chave);
    if (!anterior || anterior.tipo !== campo.tipo || anterior.unidade !== campo.unidade) return false;
    const valor = atributos[campo.chave];
    if (campo.tipo === "numero") {
      return typeof valor === "number" && Number.isFinite(valor)
        && (campo.min == null || valor >= campo.min) && (campo.max == null || valor <= campo.max);
    }
    if (campo.tipo === "sim_nao") return typeof valor === "boolean";
    if (typeof valor !== "string") return false;
    if (campo.tipo === "lista") return campo.opcoes?.some((opcao) => semAcento(opcao) === semAcento(valor));
    return !!valor.trim() && valor.length <= 120;
  }).map((c) => c.chave));
  return Object.fromEntries(Object.entries(atributos).filter(([k]) => chaves.has(k)));
}
