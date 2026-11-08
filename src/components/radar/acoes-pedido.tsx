"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { fecharPedido } from "@/app/radar/actions";

// "Já resolvi" e "Cancelar pedido" (com confirmação). O banco confere que o pedido é seu.
export function AcoesPedido({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [acao, setAcao] = useState<"resolvido" | "cancelado" | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function fechar(motivo: "resolvido" | "cancelado") {
    setAviso(null);
    setAcao(motivo);
    iniciar(async () => {
      const r = await fecharPedido(pedidoId, motivo);
      // deu certo: a página recarrega e mostra o pedido fechado (este bloco some)
      if (r.ok) router.refresh();
      else setAviso({ ok: false, texto: r.erro });
    });
  }

  return (
    <section className="flex flex-col gap-2 border-t border-borda pt-4" aria-label="Encerrar pedido">
      {aviso && (
        <p role={aviso.ok ? "status" : "alert"} className={`text-base font-semibold ${aviso.ok ? "text-verde-escuro" : "text-perigo"}`}>
          {aviso.texto}
        </p>
      )}
      <Botao
        variante="secundario"
        larguraTotal
        icone={<CheckCircle2 />}
        onClick={() => fechar("resolvido")}
        carregando={pendente && acao === "resolvido"}
        disabled={pendente}
        textoCarregando="Salvando..."
      >
        Já resolvi
      </Botao>
      {confirmarCancelar ? (
        <div className="flex flex-col gap-2 rounded-card bg-perigo-fundo p-4">
          <p className="text-base font-semibold text-perigo">Cancelar este pedido? As lojas não vão mais ver.</p>
          <Botao
            variante="perigo"
            larguraTotal
            onClick={() => fechar("cancelado")}
            carregando={pendente && acao === "cancelado"}
            disabled={pendente}
            textoCarregando="Cancelando..."
          >
            Sim, cancelar
          </Botao>
          <Botao variante="texto" onClick={() => setConfirmarCancelar(false)} disabled={pendente}>
            Não, manter
          </Botao>
        </div>
      ) : (
        <Botao variante="texto" icone={<XCircle />} onClick={() => setConfirmarCancelar(true)}>
          Cancelar pedido
        </Botao>
      )}
    </section>
  );
}
