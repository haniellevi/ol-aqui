"use client";

import { useActionState, useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Aviso, estiloBotaoPerigo, estiloCampo } from "@/components/admin/ui";
import { Botao } from "@/components/ui/botao";
import type { EstadoForm } from "@/lib/admin/estado";
import { darCortesiaRadar, tirarCortesiaRadar } from "../actions";

// Cortesia do Radar: libera tudo do Radar (ver pedidos "Só lojas", mandar ofertas e receber aviso na hora), mesmo sem selo ou plano pago, até a data. O banco confere tudo.
export function FormCortesiaRadar({ vitrineId, ativa }: { vitrineId: string; ativa: boolean }) {
  // Só a última ação mostra o resultado (um erro antigo de "Dar" não fica na tela depois de "Tirar").
  const [ultima, setUltima] = useState<"dar" | "tirar" | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [estadoDar, dar, daPendente] = useActionState(
    async (_: EstadoForm, dados: FormData): Promise<EstadoForm> => {
      setUltima("dar");
      return darCortesiaRadar(vitrineId, String(dados.get("ate") ?? ""), String(dados.get("motivo") ?? "")).catch(() => ({ erro: "Não foi possível confirmar a ação. Atualize a ficha antes de tentar novamente." }));
    },
    null,
  );
  const [estadoTirar, tirar, tiraPendente] = useActionState(
    async (): Promise<EstadoForm> => {
      setUltima("tirar");
      const resultado: EstadoForm = await tirarCortesiaRadar(vitrineId).catch(() => ({ erro: "Não foi possível confirmar a ação. Atualize a ficha antes de tentar novamente." }));
      if (resultado?.ok) setConfirmar(false);
      return resultado;
    },
    null,
  );
  const estado = ultima === "tirar" ? estadoTirar : ultima === "dar" ? estadoDar : null;

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
        <div className="flex justify-end">
          <AlertDialog open={confirmar} onOpenChange={(valor) => { if (!tiraPendente) setConfirmar(valor); }}>
            <AlertDialogTrigger className={estiloBotaoPerigo}>Tirar cortesia</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tirar a cortesia do Radar?</AlertDialogTitle>
                <AlertDialogDescription>
                  A loja deixa de ver os pedidos &quot;Só lojas&quot;, de mandar ofertas e de receber aviso na hora, a não ser que tenha selo e plano pago.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form action={tirar}>
                {ultima === "tirar" && estadoTirar?.erro && <Aviso tipo="erro">{estadoTirar.erro}</Aviso>}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={tiraPendente}>Cancelar</AlertDialogCancel>
                  <Botao type="submit" variante="perigo" carregando={tiraPendente} textoCarregando="Salvando…">
                    Confirmar
                  </Botao>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
    </div>
  );
}
