"use client";

import { useActionState, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarPreco } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { aoEnviar } from "./enviar";
import { BarraContinuar } from "./barra-continuar";
import type { EstadoForm } from "./passos";

// Passo 4 · Preço: teclado de número com "R$" fixo, "A combinar" e "Aceito troca".
// A dica "Parecidos na região" só aparece quando o banco tem anúncios suficientes.

const CAIXA =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-card border-2 border-borda bg-cartao px-3 py-2 text-base font-semibold " +
  "text-beringela hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-laranja-claro has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

/** Digitação → "8.500" ou "8.500,50" (agrupa milhar, no máximo 2 casas depois da vírgula). */
function mascara(t: string): string {
  const limpo = t.replace(/[^\d,]/g, "");
  const [inteiro = "", ...resto] = limpo.split(",");
  const int = inteiro.replace(/^0+(?=\d)/, "").slice(0, 12);
  const agrupado = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return resto.length ? `${agrupado || "0"},${resto.join("").slice(0, 2)}` : agrupado;
}

/** Centavos → texto do campo. */
function paraTexto(centavos: number | null): string {
  if (centavos == null) return "";
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  return mascara(cent ? `${reais},${String(cent).padStart(2, "0")}` : String(reais));
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
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarPreco, null);
  const [preco, setPreco] = useState(paraTexto(precoInicial));
  const [aCombinar, setACombinar] = useState(aCombinarInicial);
  const [troca, setTroca] = useState(aceitaTrocaInicial);

  return (
    <form id={formId} onSubmit={aoEnviar(acao)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <Campo
        rotulo="Preço"
        name="preco"
        prefixo="R$"
        value={aCombinar ? "" : preco}
        onChange={(e) => setPreco(mascara(e.target.value))}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={aCombinar ? "A combinar" : "0"}
        disabled={aCombinar}
        erro={estado?.campos?.preco}
        className="[&_input]:text-xl [&_input]:font-bold"
      />

      {dicaFaixa && (
        <p className="flex gap-2 rounded-card bg-laranja-claro p-3 text-base">
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
