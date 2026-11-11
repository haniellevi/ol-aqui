"use client";

import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { pedirAoAki, type RespostaCadastroAki, type SugestaoLoja } from "@/lib/aki/lojista";

export function CadastroLojaAki({ nome, aplicar }: { nome: string; aplicar: (dados: SugestaoLoja) => void }) {
  const [contexto, setContexto] = useState("");
  const [resposta, setResposta] = useState<RespostaCadastroAki | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function sugerir() {
    setOcupado(true);
    setErro("");
    setResposta(null);
    try {
      setResposta(await pedirAoAki<RespostaCadastroAki>({ tipo: "cadastro", nome, contexto }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "O Merc está indisponível. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <details className="rounded-card border border-borda bg-cartao px-4 py-3">
      <summary className="cursor-pointer font-semibold text-beringela">Pedir ajuda ao Merc</summary>
      <div className="mt-3 flex flex-col gap-3">
        <Campo name="contexto_aki" rotulo="O que sua loja vende ou faz?" placeholder="Ex.: Vendo peças e acessórios para motos"
          value={contexto} onChange={(e) => { setContexto(e.target.value); setResposta(null); }}
          maxLength={1500} disabled={ocupado} dica="Conte um pouco sobre a loja para o Merc sugerir uma categoria e uma descrição." />
        <Botao type="button" variante="secundario" disabled={!contexto.trim()} carregando={ocupado}
          textoCarregando="Merc está preparando..." onClick={sugerir}>Pedir sugestões</Botao>
        {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
        <div aria-live="polite">
          {resposta && "pergunta" in resposta && <p>{resposta.pergunta} Acrescente a resposta ao texto acima.</p>}
          {resposta && "sugestao" in resposta && (
            <div className="flex flex-col gap-2 rounded-campo bg-fundo p-3">
              <p><strong>Categoria:</strong> {resposta.sugestao.categoria}</p>
              <p><strong>Descrição:</strong> {resposta.sugestao.descricao}</p>
              <Botao type="button" variante="secundario" onClick={() => { aplicar(resposta.sugestao); setResposta(null); }}>Aplicar sugestões</Botao>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
