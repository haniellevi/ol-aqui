"use client";
import { useState } from "react";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { NativeSelect } from "@/components/ui/native-select";
import { configuracaoGa4 } from "@/lib/metricas/ga4";

export function PreparacaoGa4() {
  const [id,setId] = useState("");
  const [ambiente,setAmbiente] = useState("homologacao");
  const config = configuracaoGa4(id,ambiente);
  return <Cartao aria-labelledby="preparacao-ga4">
    <h2 id="preparacao-ga4" className="text-lg font-semibold text-beringela">Medição externa</h2>
    <p className="mt-2 text-base">GA4: {config.status === "nao_configurado" ? "não configurado" : config.status === "invalido" ? "ID ou ambiente inválido" : "desligado"}. Meta: módulo futuro, desligado.</p>
    <p className="mt-2 text-sm text-texto-suave">Confira o formato antes da homologação. Estes campos são um rascunho desta tela, não são salvos nem ativam coleta.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-beringela">ID de medição GA4
        <input value={id} onChange={e=>setId(e.target.value)} placeholder="G-XXXXXXXXXX" maxLength={22} spellCheck={false} className={estiloCampo} aria-describedby="status-ga4" />
      </label>
      <label className="text-sm text-beringela">Ambiente previsto
        <NativeSelect value={ambiente} onChange={e=>setAmbiente(e.target.value)} className="mt-1">
          <option value="homologacao">Homologação</option><option value="producao">Produção</option>
        </NativeSelect>
      </label>
    </div>
    <p id="status-ga4" role="status" className="mt-3 text-sm text-texto-suave">{config.status === "invalido" ? "Use G- seguido de letras maiúsculas e números." : "Envio bloqueado em todos os ambientes. Nenhuma tag externa é carregada."}</p>
    <p className="mt-2 text-sm text-texto-suave">Propriedade, política ativa, retenção, consentimento e catálogo de campanhas precisam de decisão e homologação antes de qualquer ativação. Os fatos internos continuam disponíveis.</p>
  </Cartao>;
}
