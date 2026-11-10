"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarDetalhes } from "@/app/(conta)/anunciar/actions";
import type { Atributos, CampoCategoria } from "@/lib/tipos";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar } from "./barra-continuar";
import { nomeAtributo } from "./atributos";

// Passo 3 · Detalhes: título, descrição e só os campos da categoria.
// Lista e sim/não viram botões grandes (menos digitação). Os campos são controlados para não
// sumirem quando o servidor devolve um erro.

const OPCAO =
  "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-card border-2 border-borda bg-cartao px-3 py-2 text-center " +
  "text-base font-semibold text-beringela hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao " +
  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

const NAO_INFORMAR = "";

/** Valor salvo → texto do formulário. */
function paraTexto(c: CampoCategoria, v: Atributos[string] | undefined): string {
  if (v == null) return "";
  if (c.tipo === "sim_nao") return v === true ? "sim" : v === false ? "nao" : "";
  if (c.tipo === "numero" && typeof v === "number") return String(v).replace(".", ",");
  return String(v);
}

export function FormDetalhes({
  id,
  categoriaId,
  editar,
  formId,
  tituloInicial,
  descricaoInicial,
  campos,
  atributos,
}: {
  id: string;
  categoriaId: string | null;
  editar: boolean;
  formId: string;
  tituloInicial: string;
  descricaoInicial: string;
  campos: CampoCategoria[];
  atributos: Atributos;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarDetalhes);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.chave, paraTexto(c, atributos[c.chave])])),
  );
  const erroDe = (nome: string) => estado?.campos?.[nome];
  const mudar = (chave: string, v: string) => setValores((a) => ({ ...a, [chave]: v }));

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="categoria_id" value={categoriaId ?? ""} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      <Campo
        rotulo="Título"
        name="titulo"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={90}
        autoComplete="off"
        enterKeyHint="next"
        placeholder="Ex.: Moto Titan 150 2015"
        aria-required
        erro={erroDe("titulo")}
        dica={`${titulo.trim().length} de 90 letras. Diga o que é, a marca e o modelo.`}
      />

      {campos.map((c) => {
        const nome = nomeAtributo(c.chave);
        const erro = erroDe(nome);
        const valor = valores[c.chave] ?? "";
        const rotulo = c.unidade ? `${c.rotulo} (${c.unidade})` : c.rotulo;

        if (c.tipo === "lista" || c.tipo === "sim_nao") {
          const opcoes: { valor: string; texto: string }[] =
            c.tipo === "sim_nao"
              ? [
                  { valor: "sim", texto: "Sim" },
                  { valor: "nao", texto: "Não" },
                ]
              : (c.opcoes ?? []).map((o) => ({ valor: o, texto: o }));
          if (!c.obrigatorio) opcoes.push({ valor: NAO_INFORMAR, texto: "Não informar" });
          const idErro = erro ? `erro-${nome}` : undefined;
          return (
            <fieldset key={c.chave} className="flex flex-col gap-2" aria-describedby={idErro} aria-invalid={erro ? true : undefined}>
              <legend className="mb-2 text-base font-semibold">
                {rotulo}
                {!c.obrigatorio && <span className="ml-1 font-normal text-texto-suave">(opcional)</span>}
              </legend>
              <div className={`grid gap-2 ${opcoes.length > 4 ? "grid-cols-2" : opcoes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {opcoes.map((o) => (
                  <label key={o.valor || "nao-informar"} className={OPCAO}>
                    <input
                      type="radio"
                      name={nome}
                      value={o.valor}
                      checked={valor === o.valor}
                      onChange={() => mudar(c.chave, o.valor)}
                      className="sr-only"
                    />
                    {valor === o.valor && <Check className="size-5 shrink-0" aria-hidden />}
                    <span className={o.valor === NAO_INFORMAR ? "font-normal" : undefined}>{o.texto}</span>
                  </label>
                ))}
              </div>
              {erro && (
                <p id={idErro} role="alert" className="text-sm font-semibold text-perigo">
                  {erro}
                </p>
              )}
            </fieldset>
          );
        }

        if (c.tipo === "numero") {
          const decimal = (c.min != null && !Number.isInteger(c.min)) || (c.max != null && !Number.isInteger(c.max));
          return (
            <Campo
              key={c.chave}
              rotulo={rotulo}
              name={nome}
              value={valor}
              onChange={(e) => mudar(c.chave, e.target.value.replace(/[^\d.,]/g, ""))}
              inputMode={decimal ? "decimal" : "numeric"}
              autoComplete="off"
              enterKeyHint="next"
              opcional={!c.obrigatorio}
              aria-required={c.obrigatorio || undefined}
              erro={erro}
              dica={c.min != null && c.max != null ? `De ${c.min} a ${c.max}.` : undefined}
            />
          );
        }

        return (
          <Campo
            key={c.chave}
            rotulo={rotulo}
            name={nome}
            value={valor}
            onChange={(e) => mudar(c.chave, e.target.value)}
            maxLength={120}
            autoComplete="off"
            enterKeyHint="next"
            opcional={!c.obrigatorio}
            aria-required={c.obrigatorio || undefined}
            erro={erro}
          />
        );
      })}

      <Campo
        multilinha
        rotulo="Descrição"
        name="descricao"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={4000}
        rows={5}
        opcional
        placeholder="Conte o estado, o tempo de uso, se tem nota ou garantia..."
        erro={erroDe("descricao")}
      />

      <BarraContinuar>
        <Botao type="submit" name="acao" value="seguir" larguraTotal carregando={enviando} textoCarregando="Salvando...">
          Continuar
        </Botao>
      </BarraContinuar>
    </form>
  );
}
