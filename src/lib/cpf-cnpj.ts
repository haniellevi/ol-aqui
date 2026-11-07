// CPF/CNPJ: confere os dígitos verificadores (serve no navegador e no servidor).
// O número só é enviado ao Asaas na hora de pagar; o OLAKI nunca guarda.

/** Só os números. */
export const soDigitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "");

function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(d[tamanho])) return false;
  }
  return true;
}

function cnpjValido(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (const tamanho of [12, 13]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * pesos[i + (13 - tamanho)];
    const resto = soma % 11;
    if ((resto < 2 ? 0 : 11 - resto) !== Number(d[tamanho])) return false;
  }
  return true;
}

/** true se for um CPF (11 números) ou CNPJ (14 números) com os dígitos certos. */
export function documentoValido(t: string | null | undefined): boolean {
  const d = soDigitos(t);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

/** Máscara enquanto digita: 000.000.000-00 ou 00.000.000/0000-00. */
export function mascaraDocumento(t: string): string {
  const d = soDigitos(t).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
