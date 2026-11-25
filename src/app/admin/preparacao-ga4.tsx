"use client";
import { useState } from "react";
import { Cartao, estiloCampo } from "@/components/admin/ui";
import { NativeSelect } from "@/components/ui/native-select";
import { configuracaoExterna, type AmbienteExterno, type DestinoExterno, type EstadoExterno } from "@/lib/metricas/externos";

const estados: Record<EstadoExterno, string> = { nao_configurado: "não configurado", invalido: "ID ou ambiente inválido", desativado: "desativado", pronto_para_homologar: "pronto para homologar, envio bloqueado" };

export function PreparacaoGa4() {
  const [ids,setIds] = useState({ ga4: "", meta: "" });
  const [preparar,setPreparar] = useState({ ga4: false, meta: false });
  const [ambiente,setAmbiente] = useState<AmbienteExterno>("homologacao");
  return <Cartao aria-labelledby="preparacao-ga4">
    <h2 id="preparacao-ga4" className="text-lg font-semibold text-beringela">Medição externa</h2>
    <p className="mt-2 text-base">Envio bloqueado em todos os ambientes. Nenhuma tag externa é carregada.</p>
    <p className="mt-2 text-sm text-texto-suave">Estes campos são um rascunho desta tela, não são salvos nem ativam coleta. Formato válido não confirma a conta ou a propriedade do ID.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-beringela">Ambiente previsto
        <NativeSelect value={ambiente} onChange={e=>{setAmbiente(e.target.value as AmbienteExterno);setPreparar({ga4:false,meta:false});}} className="mt-1">
          <option value="local">Local</option><option value="homologacao">Homologação</option><option value="producao">Produção</option>
        </NativeSelect>
      </label>
      {(["ga4", "meta"] as DestinoExterno[]).map(destino=>{
        const config = configuracaoExterna(destino,ambiente,{id:ids[destino],solicitarHomologacao:preparar[destino]});
        const titulo = destino === "ga4" ? "GA4" : "Meta";
        return <div key={destino} className="min-w-0 space-y-3 sm:col-span-2">
          <label className="block text-sm text-beringela">{destino === "ga4" ? "ID de medição GA4" : "Pixel ID Meta"}
            <input value={ids[destino]} onChange={e=>{setIds({...ids,[destino]:e.target.value});setPreparar({...preparar,[destino]:false});}} placeholder={destino === "ga4" ? "G-XXXXXXXXXX" : "Somente números"} maxLength={destino === "ga4" ? 22 : 25} spellCheck={false} autoComplete="off" className={estiloCampo} aria-invalid={config.status === "invalido"} aria-describedby={`status-${destino} formato-${destino}`} />
          </label>
          <p id={`formato-${destino}`} className="text-sm text-texto-suave">{destino === "ga4" ? "Use G- seguido de letras maiúsculas e números. Consentimento de estatística obrigatório." : "Use o identificador numérico do Pixel, sem tokens. Consentimento de marketing obrigatório."}</p>
          <label className="block text-sm text-beringela">Preparação {titulo}
            <NativeSelect value={String(preparar[destino])} onChange={e=>setPreparar({...preparar,[destino]:e.target.value === "true"})} className="mt-1">
              <option value="false">Desativada</option><option value="true">Preparar homologação</option>
            </NativeSelect>
          </label>
          <p id={`status-${destino}`} role="status" className="text-sm text-texto-suave">{titulo}: {estados[config.status]}.</p>
        </div>;
      })}
    </div>
    <p className="mt-3 text-sm text-texto-suave">A homologação depende de domínio, propriedade ou Pixel próprios, política ativa, retenção e revisão dos dados enviados. Não houve conexão com Google ou Meta. Os fatos internos continuam disponíveis.</p>
  </Cartao>;
}
