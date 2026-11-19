"use client";

import { useActionState } from "react";
import { Aviso, Cartao } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { diaLimiteCupom } from "@/lib/cupons";
import { salvarVoucher } from "./voucher-actions";

export type CampanhaVoucher = { id: string; codigo: string; valido_ate: string | null; duracao_dias: number; ativo: boolean };

export function FormVoucher({ campanha }: { campanha?: CampanhaVoucher }) {
  const [estado, acao, pendente] = useActionState(salvarVoucher, null);
  const chave = campanha?.id ?? "novo";
  const dia = diaLimiteCupom(campanha?.valido_ate ?? null);

  return (
    <Cartao aria-labelledby={`cupom-${chave}`}>
      <form action={acao} className="grid gap-3 sm:grid-cols-2">
        <h3 id={`cupom-${chave}`} className="font-semibold [overflow-wrap:anywhere] text-beringela sm:col-span-2">{campanha?.codigo ?? "Novo cupom"}</h3>
        {campanha
          ? <input type="hidden" name="id" value={campanha.id} />
          : <Campo id="cupom-novo-codigo" rotulo="Código do cupom" name="codigo" required minLength={4} maxLength={32} autoComplete="off" tamanho="toque" className="sm:col-span-2" />}
        <Campo
          id={`cupom-${chave}-dias`}
          rotulo="Dias de acesso após ativar"
          name="duracao_dias"
          type="number"
          min={1}
          max={2_147_483_647}
          step={1}
          required
          defaultValue={campanha?.duracao_dias}
          tamanho="toque"
        />
        <Campo id={`cupom-${chave}-validade`} rotulo="Pode ser ativado até" name="validade" type="date" opcional defaultValue={dia} tamanho="toque" />
        {campanha
          ? <label className="flex min-h-toque items-center gap-2 text-base sm:col-span-2">
            <input name="ativo" type="checkbox" defaultChecked={campanha.ativo} className="size-5 accent-laranja-escuro" /> Ativo
          </label>
          : <p className="text-sm text-texto-suave sm:col-span-2">O cupom já pode ser usado assim que for criado.</p>}
        <Botao type="submit" variante="secundario" tamanho="toque" carregando={pendente} className="justify-self-start sm:col-span-2">
          {campanha ? "Salvar cupom" : "Criar cupom"}
        </Botao>
        {(estado?.erro || estado?.ok) && <div className="sm:col-span-2">
          <Aviso tipo={estado.erro ? "erro" : "ok"}>{estado.erro ?? estado.ok}</Aviso>
        </div>}
      </form>
    </Cartao>
  );
}
