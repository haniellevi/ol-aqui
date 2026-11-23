"use client";

import { useActionState, useState } from "react";
import { Aviso, Cartao } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import type { Plano } from "./form-plano";
import { salvarPromocional } from "./actions";

export function FormPromocional({ plano }: { plano: Plano }) {
  const [estado, acao, pendente] = useActionState(salvarPromocional, null);
  const [radar, setRadar] = useState(plano.acesso_radar);

  return (
    <Cartao aria-labelledby="titulo-promocional" className="space-y-3">
      <h2 id="titulo-promocional" className="text-lg font-semibold text-beringela">Plano {plano.nome}</h2>
      <p className="text-base text-texto-suave">
        Os recursos valem para todos os cupons, inclusive os já ativados. Deixe o limite em branco para liberar sem limite.
      </p>
      <form action={acao} className="grid gap-3">
        <Limite recurso="Publicar anúncios" permissao="publicar_anuncios" nome="limite_anuncios" rotulo="Limite de anúncios" valor={plano.limite_anuncios} />
        <fieldset className="grid min-w-0 gap-2">
          <legend className="text-sm font-semibold text-beringela">Radar de Negócios</legend>
          <label className="flex min-h-toque items-center gap-2 text-base">
            <input type="checkbox" name="acesso_radar" checked={radar} onChange={(e) => setRadar(e.target.checked)} className="size-5 shrink-0 accent-laranja-escuro" />
            Acessar o Radar
          </label>
          <Campo rotulo="Propostas por mês" name="propostas_radar_mes" type="number" min={0} step={1} tamanho="toque" disabled={!radar} defaultValue={plano.propostas_radar_mes ?? ""} />
          <label className="flex min-h-toque items-center gap-2 text-base">
            <input type="checkbox" name="aviso_radar_na_hora" defaultChecked={plano.aviso_radar_na_hora} disabled={!radar} className="size-5 shrink-0 accent-laranja-escuro" />
            Receber aviso na hora de um novo pedido
          </label>
          <p className="text-sm text-texto-suave">Continuam valendo as regras de verificação do Radar.</p>
        </fieldset>
        <fieldset className="grid min-w-0 gap-2">
          <legend className="text-sm font-semibold text-beringela">Vitrine da loja</legend>
          <label className="flex min-h-toque items-center gap-2 text-base">
            <input type="checkbox" name="vitrine_foto_fachada" defaultChecked={plano.vitrine_foto_fachada} className="size-5 shrink-0 accent-laranja-escuro" />
            Mostrar foto da fachada
          </label>
          <Limite recurso="Criar seções próprias" permissao="vitrine_secoes" nome="vitrine_secoes_max" rotulo="Limite de seções" valor={plano.vitrine_secoes_max} />
          <Limite recurso="Fixar produtos no topo" permissao="vitrine_fixados" nome="vitrine_fixados_max" rotulo="Limite de produtos fixados" valor={plano.vitrine_fixados_max} />
        </fieldset>
        <Botao type="submit" variante="secundario" tamanho="toque" className="justify-self-start" carregando={pendente}>Salvar recursos</Botao>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      </form>
    </Cartao>
  );
}

function Limite({ recurso, permissao, nome, rotulo, valor }: { recurso: string; permissao: string; nome: string; rotulo: string; valor: number | null }) {
  const [habilitado, setHabilitado] = useState(valor !== 0);
  return (
    <div className="grid gap-2">
      <label className="flex min-h-toque items-center gap-2 text-base">
        <input type="checkbox" name={permissao} checked={habilitado} onChange={(e) => setHabilitado(e.target.checked)} className="size-5 shrink-0 accent-laranja-escuro" />
        {recurso}
      </label>
      <Campo rotulo={rotulo} name={nome} type="number" min={1} step={1} tamanho="toque" disabled={!habilitado} defaultValue={valor || ""} />
    </div>
  );
}
