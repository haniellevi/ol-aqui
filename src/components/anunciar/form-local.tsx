"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { salvarLocal } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar } from "./barra-continuar";

// Passo 5 · Local: cidade (lista da região) e bairro, já preenchidos do perfil.
// Nunca pede endereço exato: só o bairro aparece no anúncio.

export function FormLocal({
  id,
  editar,
  formId,
  cidades,
  cidadeInicial,
  bairroInicial,
}: {
  id: string;
  editar: boolean;
  formId: string;
  cidades: { nome: string; uf: string }[];
  cidadeInicial: string;
  bairroInicial: string;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(salvarLocal);
  const [cidade, setCidade] = useState(cidadeInicial);
  const [bairro, setBairro] = useState(bairroInicial);
  const erroCidade = estado?.campos?.cidade;

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      {cidades.length ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-cidade" className="text-base font-semibold">
            Cidade
          </label>
          <div className="relative">
            <select
              id="campo-cidade"
              name="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              aria-invalid={erroCidade ? true : undefined}
              aria-describedby={erroCidade ? "campo-cidade-erro" : undefined}
              className={`h-12 w-full appearance-none rounded-campo border-2 bg-cartao pl-3 pr-10 text-base focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30 ${erroCidade ? "border-perigo" : "border-borda"}`}
            >
              <option value="">Escolha a cidade</option>
              {cidades.map((c) => (
                <option key={c.nome} value={c.nome}>
                  {c.nome} – {c.uf}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-texto-suave" aria-hidden />
          </div>
          {erroCidade && (
            <p id="campo-cidade-erro" role="alert" className="text-sm font-semibold text-perigo">
              {erroCidade}
            </p>
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="cidade" value={cidade} />
          <AvisoErro mensagem="Não há cidades disponíveis para esta região agora. Seu rascunho continua guardado. Tente abrir esta etapa novamente mais tarde." />
        </>
      )}

      <Campo
        rotulo="Bairro"
        name="bairro"
        value={bairro}
        onChange={(e) => setBairro(e.target.value)}
        maxLength={80}
        opcional
        autoComplete="off"
        placeholder="Ex.: Centro"
        erro={estado?.campos?.bairro}
        dica="Não coloque rua nem número. O endereço exato você combina no WhatsApp."
      />

      <BarraContinuar>
        <Botao type="submit" name="acao" value="seguir" disabled={!cidades.length} larguraTotal carregando={enviando} textoCarregando="Salvando...">
          Continuar
        </Botao>
      </BarraContinuar>
    </form>
  );
}
