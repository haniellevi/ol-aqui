"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarPreco } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar } from "./barra-continuar";

// Passo 4 · Preço: teclado de número com "R$" fixo, "A combinar" e "Aceito troca".
// A dica "Parecidos na região" só aparece quando o banco tem anúncios suficientes.

const CAIXA =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-card border-2 border-borda bg-cartao px-3 py-2 text-base font-semibold " +
  "text-beringela hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

function paraTexto(centavos: number | null): string {
  return centavos == null ? "" : (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FormPreco({
  id,
  editar,
  formId,
  precoInicial,
  aCombinarInicial,
  aceitaTrocaInicial,
  dicaFaixa,
}: {
  id: string;
  editar: boolean;
  formId: string;
  precoInicial: number | null;
  aCombinarInicial: boolean;
  aceitaTrocaInicial: boolean;
  /** Texto pronto, ex.: "R$ 8 mil a R$ 11 mil" (null = sem dados suficientes). */
  dicaFaixa: string | null;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarPreco);
  const [preco, setPreco] = useState(paraTexto(precoInicial));
  const [aCombinar, setACombinar] = useState(aCombinarInicial);
  const [troca, setTroca] = useState(aceitaTrocaInicial);

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <Campo
        rotulo="Preço"
        name="preco"
        prefixo="R$"
        value={aCombinar ? "" : preco}
        onChange={(e) => setPreco(e.target.value)}
        maxLength={30}
        dica="Ex.: 1.500,50. Confira o valor antes de continuar."
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={aCombinar ? "A combinar" : "0"}
        disabled={aCombinar}
        erro={estado?.campos?.preco}
        className="[&_input]:text-xl [&_input]:font-bold"
      />

      {dicaFaixa && (
        <p className="flex gap-2 rounded-card bg-fundo p-3 text-base">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <span>
            Parecidos na região: <strong>{dicaFaixa}</strong>
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label className={CAIXA}>
          <input
            type="checkbox"
            name="a_combinar"
            checked={aCombinar}
            onChange={(e) => setACombinar(e.target.checked)}
            className="size-6 shrink-0 accent-beringela"
          />
          A combinar
        </label>
        <label className={CAIXA}>
          <input
            type="checkbox"
            name="aceita_troca"
            checked={troca}
            onChange={(e) => setTroca(e.target.checked)}
            className="size-6 shrink-0 accent-beringela"
          />
          Aceito troca
        </label>
      </div>

      <BarraContinuar>
        <Botao type="submit" name="acao" value="seguir" larguraTotal carregando={enviando} textoCarregando="Salvando...">
          Continuar
        </Botao>
      </BarraContinuar>
    </form>
  );
}
