"use client";

import { useActionState } from "react";
import { Aviso, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import type { EstadoForm } from "@/lib/admin/estado";
import { darCortesiaRadar, tirarCortesiaRadar } from "../actions";

// Cortesia do Radar: a loja recebe os pedidos "Só lojas" sem plano Full até a data. O banco confere tudo.
export function FormCortesiaRadar({ vitrineId, ativa }: { vitrineId: string; ativa: boolean }) {
  const [estadoDar, dar, daPendente] = useActionState(
    async (_: EstadoForm, dados: FormData): Promise<EstadoForm> =>
      darCortesiaRadar(vitrineId, String(dados.get("ate") ?? ""), String(dados.get("motivo") ?? "")).catch(() => ({ erro: "Não foi possível confirmar a ação. Atualize a ficha antes de tentar novamente." })),
    null,
  );
  const [estadoTirar, tirar, tiraPendente] = useActionState(
    async (): Promise<EstadoForm> =>
      tirarCortesiaRadar(vitrineId).catch(() => ({ erro: "Não foi possível confirmar a ação. Atualize a ficha antes de tentar novamente." })),
    null,
  );
  const estado = estadoDar ?? estadoTirar;

  return (
    <div className="flex flex-col gap-3">
      <form action={dar} className="grid grid-cols-2 items-end gap-3">
        <label className="col-span-2 text-sm font-medium sm:col-span-1">
          Até
          <input name="ate" type="date" required className={estiloCampo} />
        </label>
        <label className="col-span-2 text-sm font-medium">
          Motivo (fica no histórico)
          <input name="motivo" required minLength={3} maxLength={300} placeholder="Ex.: teste do Radar com a loja" className={estiloCampo} />
        </label>
        <div className="col-span-2 flex flex-wrap justify-end gap-2">
          <Botao type="submit" variante="secundario" carregando={daPendente} textoCarregando="Salvando...">
            {ativa ? "Mudar a data da cortesia" : "Dar cortesia"}
          </Botao>
        </div>
      </form>
      {ativa && (
        <form action={tirar} className="flex justify-end">
          <Botao type="submit" variante="perigo" carregando={tiraPendente} textoCarregando="Salvando...">
            Tirar cortesia
          </Botao>
        </form>
      )}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
    </div>
  );
}
