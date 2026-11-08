// Diferença linha a linha entre dois textos (prévia do painel antes de publicar uma versão nova
// dos termos). Algoritmo da maior subsequência comum; textos muito grandes são comparados
// só pelo começo e pelo fim iguais, para não travar o navegador.

export type LinhaDiff = { tipo: "igual" | "mais" | "menos"; texto: string };

const LIMITE_CELULAS = 4_000_000; // ~ 2000 x 2000 linhas

export function diffLinhas(antes: string, depois: string): LinhaDiff[] {
  const a = antes.replace(/\r\n?/g, "\n").split("\n");
  const b = depois.replace(/\r\n?/g, "\n").split("\n");

  // começo e fim iguais saem da conta (é o caso comum: mudou um trecho no meio)
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > ini && fimB > ini && a[fimA - 1] === b[fimB - 1]) {
    fimA--;
    fimB--;
  }
  const meioA = a.slice(ini, fimA);
  const meioB = b.slice(ini, fimB);
  const saida: LinhaDiff[] = a.slice(0, ini).map((texto) => ({ tipo: "igual", texto }));

  if (meioA.length * meioB.length > LIMITE_CELULAS) {
    saida.push(...meioA.map((texto) => ({ tipo: "menos" as const, texto })), ...meioB.map((texto) => ({ tipo: "mais" as const, texto })));
  } else {
    const n = meioA.length;
    const m = meioB.length;
    // tabela de tamanhos da maior subsequência comum (de trás para frente)
    const t: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) t[i][j] = meioA[i] === meioB[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (meioA[i] === meioB[j]) {
        saida.push({ tipo: "igual", texto: meioA[i] });
        i++;
        j++;
      } else if (t[i + 1][j] >= t[i][j + 1]) {
        saida.push({ tipo: "menos", texto: meioA[i++] });
      } else {
        saida.push({ tipo: "mais", texto: meioB[j++] });
      }
    }
    while (i < n) saida.push({ tipo: "menos", texto: meioA[i++] });
    while (j < m) saida.push({ tipo: "mais", texto: meioB[j++] });
  }

  saida.push(...a.slice(fimA).map((texto) => ({ tipo: "igual" as const, texto })));
  return saida;
}

/** Quantas linhas entraram e saíram. */
export function contarMudancas(d: LinhaDiff[]) {
  return { mais: d.filter((l) => l.tipo === "mais").length, menos: d.filter((l) => l.tipo === "menos").length };
}
