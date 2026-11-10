"use client";

import { useState, type ChangeEvent } from "react";
import { mascaraCelular } from "@/lib/formato";

const CELULAR = String.raw`\([1-9][0-9]\) 9[0-9]{4}-[0-9]{4}`;
const FIXO = String.raw`\([1-9][0-9]\) [0-9]{4}-[0-9]{4}`;

export function useCampoTelefone(inicial = "", { aceitaFixo = false, obrigatorio = false } = {}) {
  const [valor, setValor] = useState(() => mascaraCelular(inicial, aceitaFixo));
  const [visitado, setVisitado] = useState(false);
  const pattern = aceitaFixo ? `${CELULAR}|${FIXO}` : CELULAR;
  const valido = (!obrigatorio && !valor) || new RegExp(`^(?:${pattern})$`).test(valor);
  const erro = visitado && !valido
    ? aceitaFixo
      ? "Digite o DDD e o telefone. Ex.: (89) 3333-0000 ou (89) 99999-0000."
      : "Digite o DDD e os 9 dígitos do celular. Ex.: (89) 99999-0000."
    : undefined;

  function mudarFone(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    let texto = campo.value, cursor = campo.selectionStart ?? texto.length;
    const tipo = (e.nativeEvent as InputEvent).inputType;
    // Ao apagar um separador, apaga o dígito vizinho para a máscara não prender o cursor.
    if (texto !== valor && mascaraCelular(texto, aceitaFixo) === valor && tipo?.startsWith("deleteContent")) {
      const passo = tipo === "deleteContentBackward" ? -1 : 1;
      let indice = passo < 0 ? cursor - 1 : cursor;
      while (indice >= 0 && indice < texto.length && /\D/.test(texto[indice])) indice += passo;
      if (indice >= 0 && indice < texto.length) {
        texto = texto.slice(0, indice) + texto.slice(indice + 1);
        if (indice < cursor) cursor--;
      }
    }
    const formatado = mascaraCelular(texto, aceitaFixo);
    const removidos = texto.replace(/\D/g, "").length - formatado.replace(/\D/g, "").length;
    let faltam = Math.max(0, texto.slice(0, cursor).replace(/\D/g, "").length - removidos), posicao = 0;
    while (posicao < formatado.length && faltam > 0) if (/\d/.test(formatado[posicao++])) faltam--;
    setValor(formatado);
    requestAnimationFrame(() => { if (document.activeElement === campo) campo.setSelectionRange(posicao, posicao); });
  }
  return {
    valido,
    erro,
    marcarVisitado: () => setVisitado(true),
    campo: {
      type: "tel",
      inputMode: "numeric" as const,
      autoComplete: "tel-national",
      prefixo: "+55",
      placeholder: "(89) 99999-0000",
      maxLength: 30,
      required: obrigatorio,
      pattern,
      value: valor,
      onChange: mudarFone,
      onBlur: () => setVisitado(true),
    },
  };
}
