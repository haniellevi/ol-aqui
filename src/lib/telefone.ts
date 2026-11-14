// Telefone brasileiro: um só normalizador para cadastro, Minha conta, loja, quero-vender, admin, confirmação
// por WhatsApp e webhook. Guarda sempre 55 + DDD + número (celular com 9 dígitos; fixo com 8 quando a tela aceita),
// o mesmo formato que os checks do banco conferem. Pura: roda no servidor e no navegador.

/** DDD que existe no Brasil (11 a 99, sem os que não existem). Mesma regra do check de microrregioes.ddd. */
export const REGEX_DDD = /^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])$/;

/** Formato guardado (mesmo regex dos checks do banco): 55 + DDD + 8 ou 9 dígitos. */
const REGEX_GUARDADO = /^55[1-9][0-9]9?[0-9]{8}$/;
/** Celular guardado: 55 + DDD + 9 dígitos começando com 9. */
const REGEX_CELULAR_GUARDADO = /^55[1-9][0-9]9[0-9]{8}$/;

export type ErroTelefone = "vazio" | "sem_ddd" | "invalido";

export const MENSAGEM_TELEFONE: Record<ErroTelefone, string> = {
  vazio: "Informe o WhatsApp com DDD.",
  sem_ddd: "Digite o DDD. Ex.: (89) 99999-0000.",
  invalido: "WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.",
};

export type ResultadoTelefone = { numero: string; erro?: undefined } | { numero?: undefined; erro: ErroTelefone };

export type OpcoesTelefone = {
  /** DDD da região da pessoa ou da loja (microrregioes.ddd). Usado quando o número vem sem DDD. */
  ddd?: string | null;
  /** Telefone fixo (8 dígitos, começando de 2 a 5) também vale. Padrão: só celular. */
  aceitaFixo?: boolean;
};

/**
 * Normaliza para 55 + DDD + número.
 *  - aceita "(89) 99999-0000", "89 99999 0000", "89999990000", "+55 (89) 99999-0000", "5589999990000", "089..."
 *  - celular de 8 dígitos começando com 6 a 9 ganha o 9 na frente ("9999-0000" → 9 9999 0000)
 *  - sem DDD no número: usa opcoes.ddd (região). Sem ele, devolve "sem_ddd" (a tela pede o DDD).
 *  - DDD que não existe, +55 com outro país, letras ou tamanho errado: "invalido".
 */
export function normalizarTelefone(entrada: unknown, opcoes: OpcoesTelefone = {}): ResultadoTelefone {
  if (entrada == null) return { erro: "vazio" };
  if (typeof entrada !== "string") return { erro: "invalido" };
  const texto = entrada.trim();
  if (!texto) return { erro: "vazio" };
  if (texto.length > 30 || !/^[\d+().\s-]+$/.test(texto)) return { erro: "invalido" };

  const internacional = texto.includes("+");
  if (internacional && !/^\+55[\d().\s-]*$/.test(texto)) return { erro: "invalido" };

  let digitos = texto.replace(/\D/g, "");
  // Zero do tronco da operadora ("089 99999-0000") sai; "00" ou "09" não viram DDD válido.
  if (digitos.startsWith("0") && (digitos.length - 1 === 10 || digitos.length - 1 === 11)) digitos = digitos.slice(1);
  let local: string; // DDD + número, sem o 55
  if (internacional) {
    if (!digitos.startsWith("55")) return { erro: "invalido" };
    local = digitos.slice(2);
  } else if (!texto.startsWith("(") && (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    local = digitos.slice(2); // 55 colado no número: 5589999990000
  } else {
    local = digitos;
  }

  let ddd: string | null;
  let numero: string;
  if (local.length === 10 || local.length === 11) {
    ddd = local.slice(0, 2);
    numero = local.slice(2);
  } else if (local.length === 8 || local.length === 9) {
    ddd = opcoes.ddd ?? null;
    numero = local;
  } else {
    return { erro: "invalido" };
  }

  if (numero.length === 8) {
    if (/^[6-9]/.test(numero)) numero = `9${numero}`; // celular sem o 9 da frente
    else if (!(opcoes.aceitaFixo && /^[2-5]/.test(numero))) return { erro: "invalido" };
  } else if (!numero.startsWith("9")) {
    return { erro: "invalido" }; // 9 dígitos só existem em celular, e celular começa com 9
  }

  if (ddd === null) return { erro: "sem_ddd" };
  if (!REGEX_DDD.test(ddd)) return { erro: "invalido" };

  const guardado = `55${ddd}${numero}`;
  const valido = opcoes.aceitaFixo ? REGEX_GUARDADO.test(guardado) : REGEX_CELULAR_GUARDADO.test(guardado);
  return valido ? { numero: guardado } : { erro: "invalido" };
}

/** Número guardado (ou null se não normaliza). Atalho para quem só quer o resultado. */
export function numeroTelefone(entrada: unknown, opcoes: OpcoesTelefone = {}): string | null {
  return normalizarTelefone(entrada, opcoes).numero ?? null;
}

/** Só o DDD de um número guardado ("5589999990000" → "89"). Fora do formato → null. */
export function dddDoNumero(numero: string | null | undefined): string | null {
  const m = /^55([1-9][0-9])9?[0-9]{8}$/.exec(String(numero ?? ""));
  return m ? m[1] : null;
}

/**
 * Para mostrar: "5589999990000" → "(89) 99999-0000"; fixo "558933334444" → "(89) 3333-4444".
 * Sem o 55 do começo quando ele está lá; o que não tem tamanho de telefone volta só com os dígitos.
 */
export function telefone(numero: string | null | undefined): string {
  const d = String(numero ?? "").replace(/\D/g, "");
  const local = /^55\d{10,11}$/.test(d) ? d.slice(2) : d;
  if (local.length < 10) return local;
  return `(${local.slice(0, 2)}) ${local.slice(2, local.length - 4)}-${local.slice(-4)}`;
}

/** Exemplo de máscara para o campo: "(89) 99999-0000" com o DDD da região; sem região, "(DD) 99999-0000". */
export function exemploTelefone(ddd: string | null | undefined): string {
  return `(${REGEX_DDD.test(String(ddd ?? "")) ? ddd : "DD"}) 99999-0000`;
}
