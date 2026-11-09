"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { fecharPedido } from "@/app/radar/actions";

export function AcoesPedido({ pedidoId, podeResolver = true }: { pedidoId: string; podeResolver?: boolean }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const trava = useRef(false);
  const [acao, setAcao] = useState<"resolvido" | "cancelado">("resolvido");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrir(motivo: typeof acao) {
    setErro(null);
    setAcao(motivo);
    dialogo.current?.showModal();
    cancelar.current?.focus();
  }
  function confirmar() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await fecharPedido(pedidoId, acao);
        if (!r.ok) { setErro(r.erro); return; }
        dialogo.current?.close();
        router.refresh();
      } catch { setErro("Não conseguimos confirmar o encerramento. Tente novamente."); }
      finally { trava.current = false; }
    });
  }
  return <section className="flex flex-col gap-2 border-t border-borda pt-4" aria-label="Encerrar pedido">
    {podeResolver && <Botao variante="secundario" larguraTotal icone={<CheckCircle2 />} disabled={pendente} onClick={() => abrir("resolvido")}>Já resolvi</Botao>}
    <Botao variante="texto" icone={<XCircle />} disabled={pendente} onClick={() => abrir("cancelado")}>Cancelar pedido</Botao>
    <dialog ref={dialogo} role="alertdialog" aria-labelledby="encerrar-titulo" aria-describedby="encerrar-texto"
      onCancel={(e) => { if (trava.current) e.preventDefault(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-card bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
      <h2 id="encerrar-titulo" className="text-xl font-bold">{acao === "resolvido" ? "Já encontrou o que procurava?" : "Cancelar este pedido?"}</h2>
      <p id="encerrar-texto" className="mt-2 text-base text-texto-suave">{acao === "resolvido" ? "O pedido ficará como resolvido e deixará de receber propostas. Você poderá consultar as ofertas recebidas." : "O pedido sairá do Radar e o acesso aos contatos será encerrado."} Para pedir novamente, será preciso criar outro pedido.</p>
      {erro && <p role="alert" className="mt-3 text-sm font-semibold text-perigo">{erro}</p>}
      <div className="mt-4 flex flex-col gap-2">
        <Botao larguraTotal variante={acao === "cancelado" ? "perigo" : "primario"} carregando={pendente} textoCarregando="Salvando..." onClick={confirmar}>{acao === "resolvido" ? "Sim, já resolvi" : "Sim, cancelar pedido"}</Botao>
        <Botao ref={cancelar} larguraTotal variante="secundario" disabled={pendente} onClick={() => dialogo.current?.close()}>Manter pedido</Botao>
      </div>
    </dialog>
  </section>;
}
