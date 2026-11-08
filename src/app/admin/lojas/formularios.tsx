"use client";

import { useActionState, useState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { acaoLoja, analisarVerificacao } from "./actions";
import type { AcaoLoja, LojaAdmin } from "@/lib/tipos-cobranca";

// Formulários da tela 5. Cada ação pede o motivo (fica no histórico) e mostra "carregando".

function Retorno({ estado }: { estado: { ok?: string; erro?: string } | null }) {
  if (!estado) return null;
  return estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
}

const ROTULO: Record<AcaoLoja, string> = {
  cortesia: "Dar dias de cortesia",
  trocar_plano: "Trocar o plano",
  suspender: "Suspender",
  reativar: "Reativar",
  dar_selo: "Dar Selo Loja Verificada",
  tirar_selo: "Tirar Selo Loja Verificada",
};

export function FormAcaoLoja({ loja, planos }: { loja: LojaAdmin; planos: { codigo: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState(acaoLoja, null);
  const opcoes: AcaoLoja[] = [
    "cortesia",
    "trocar_plano",
    loja.status === "suspensa" ? "reativar" : "suspender",
    ...(loja.tipo === "loja" ? [loja.selo_loja_verificada ? ("tirar_selo" as const) : ("dar_selo" as const)] : []),
  ];
  const [escolha, setEscolha] = useState<AcaoLoja>("cortesia");
  const perigo = escolha === "suspender" || escolha === "tirar_selo";

  return (
    <form action={acao} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <input type="hidden" name="vitrine" value={loja.id} />
      <label className="col-span-2 text-sm font-semibold">
        O que fazer
        <select name="acao" value={escolha} onChange={(e) => setEscolha(e.target.value as AcaoLoja)} className={estiloCampo}>
          {opcoes.map((a) => (
            <option key={a} value={a}>
              {ROTULO[a]}
            </option>
          ))}
        </select>
      </label>
      {escolha === "trocar_plano" && (
        <label className="text-sm font-semibold">
          Plano
          <select name="plano" required className={estiloCampo} defaultValue="">
            <option value="" disabled>
              Escolha
            </option>
            {planos.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {(escolha === "cortesia" || escolha === "trocar_plano") && (
        <label className="text-sm font-semibold">
          {escolha === "cortesia" ? "Quantos dias" : "Vale por (dias)"}
          <input name="dias" type="number" min={1} max={365} required={escolha === "cortesia"} placeholder={escolha === "trocar_plano" ? "grátis: vazio" : ""} className={estiloCampo} />
        </label>
      )}
      <label className="col-span-2 text-sm font-semibold md:col-span-4">
        Motivo (fica no histórico)
        <input name="motivo" required minLength={3} maxLength={300} placeholder="Ex.: compensação pela queda do site" className={estiloCampo} />
      </label>
      {escolha === "trocar_plano" && loja.plano_proximo && (
        <p className="col-span-2 text-[13px] text-aviso md:col-span-4">
          Esta loja tem uma troca já paga para {loja.plano_proximo_nome ?? loja.plano_proximo}. Trocar o plano aqui desfaz essa troca marcada.
        </p>
      )}
      {escolha === "trocar_plano" && (
        <p className="col-span-2 text-[13px] text-texto-suave md:col-span-4">
          Plano pago ou teste: diga por quantos dias vale. Plano grátis não vence (deixe os dias em branco). Nada é cobrado.
        </p>
      )}
      <div className="col-span-2 flex justify-end md:col-span-4">
        <Botao type="submit" variante={perigo ? "perigo" : "secundario"} carregando={pendente} textoCarregando="Salvando...">
          {ROTULO[escolha]}
        </Botao>
      </div>
      <div className="col-span-2 md:col-span-4">
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormVerificacao({ id }: { id: string }) {
  const [estado, acao, pendente] = useActionState(analisarVerificacao, null);
  const [decisao, setDecisao] = useState<"aprovar" | "recusar">("aprovar");
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm font-semibold">
        Motivo (obrigatório para recusar)
        <input name="motivo" maxLength={300} className={estiloCampo} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="secundario" carregando={pendente && decisao === "aprovar"} textoCarregando="Salvando..." disabled={pendente} name="decisao" value="aprovar" onClick={() => setDecisao("aprovar")}>
          Aprovar
        </Botao>
        <Botao type="submit" variante="perigo" carregando={pendente && decisao === "recusar"} textoCarregando="Salvando..." disabled={pendente} name="decisao" value="recusar" onClick={() => setDecisao("recusar")}>
          Recusar
        </Botao>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}
