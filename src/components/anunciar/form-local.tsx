"use client";

import { useState } from "react";
import { Campo } from "@/components/ui/campo";
import { Seletor } from "@/components/conta/seletor";
import { salvarLocal } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";
import { BarraContinuar, BotaoPasso } from "./barra-continuar";

// Passo 5 · Local: cidade (lista da região) e bairro, já preenchidos do perfil.
// Nunca pede endereço exato: só o bairro aparece no anúncio.

export function FormLocal({
  id,
  editar,
  daRevisao,
  assistente,
  formId,
  cidades,
  cidadeInicial,
  bairroInicial,
}: {
  id: string;
  editar: boolean;
  daRevisao?: boolean;
  assistente?: string;
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
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-3 md:gap-4" noValidate>
      {assistente && <input type="hidden" name="assistente" value={assistente} />}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />

      <AvisoErro mensagem={estado?.erro?.mensagem} />

      {cidades.length ? (
        <Seletor
          tamanho="toque"
          rotulo="Cidade"
          id="campo-cidade"
          name="cidade"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          erro={erroCidade}
        >
          <option value="">Escolha a cidade</option>
          {cidades.map((c) => (
            <option key={c.nome} value={c.nome}>
              {c.nome} – {c.uf}
            </option>
          ))}
        </Seletor>
      ) : (
        <>
          <input type="hidden" name="cidade" value={cidade} />
          <AvisoErro mensagem="Não há cidades disponíveis para esta região agora. Seu rascunho continua guardado. Tente abrir esta etapa novamente mais tarde." />
        </>
      )}

      <Campo

        tamanho="toque"
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
        <BotaoPasso editar={editar} daRevisao={daRevisao} salvando={enviando} disabled={!cidades.length} />
      </BarraContinuar>
    </form>
  );
}
