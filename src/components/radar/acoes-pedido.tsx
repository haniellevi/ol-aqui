"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCircle2, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { fecharPedido, mudarArquivoPedido } from "@/app/radar/actions";

type Acao = "resolvido" | "cancelado" | "arquivar" | "desarquivar";

export function AcoesPedido({
  pedidoId, podeResolver, podeCancelar, podeArquivar, arquivado, aberto,
}: {
  pedidoId: string;
  podeResolver: boolean;
  podeCancelar: boolean;
  podeArquivar: boolean;
  arquivado: boolean;
  aberto: boolean;
}) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const voltar = useRef<HTMLButtonElement>(null);
  const trava = useRef(false);
  const [acao, setAcao] = useState<Acao>("arquivar");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrir(motivo: Acao) {
    setErro(null);
    setAcao(motivo);
    dialogo.current?.showModal();
    voltar.current?.focus();
  }
  function confirmar() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    iniciar(async () => {
      try {
        const r = acao === "arquivar" || acao === "desarquivar"
          ? await mudarArquivoPedido(pedidoId, acao === "arquivar")
          : await fecharPedido(pedidoId, acao);
        if (!r.ok) { setErro(r.erro); return; }
        dialogo.current?.close();
        router.refresh();
      } catch { setErro("Não conseguimos salvar a mudança. Tente novamente."); }
      finally { trava.current = false; }
    });
  }

  if (!(podeResolver || podeCancelar || podeArquivar)) return null;

  const textos = {
    resolvido: {
      titulo: "Já encontrou o que procurava?",
      detalhe: "O pedido ficará como resolvido e deixará de receber propostas. Você poderá consultar as ofertas recebidas. Para pedir novamente, será preciso criar outro pedido.",
      botao: "Sim, já resolvi",
    },
    cancelado: {
      titulo: "Cancelar este pedido?",
      detalhe: "O pedido sairá do Radar e o acesso aos contatos será encerrado. Para pedir novamente, será preciso criar outro pedido.",
      botao: "Sim, cancelar pedido",
    },
    arquivar: {
      titulo: aberto ? "Encerrar e arquivar o pedido?" : "Arquivar este pedido?",
      detalhe: aberto
        ? "O pedido deixará de receber propostas. Você poderá consultar o histórico em Arquivados."
        : "O pedido e suas ofertas ficarão disponíveis em Arquivados.",
      botao: aberto ? "Encerrar e arquivar" : "Arquivar pedido",
    },
    desarquivar: {
      titulo: "Retirar este pedido do arquivo?",
      detalhe: "Ele voltará para a lista de pedidos e continuará encerrado.",
      botao: "Retirar do arquivo",
    },
  }[acao];

  return <section className="flex flex-col gap-2 border-t border-borda pt-4" aria-label="Ações do pedido">
    {podeResolver && <Botao variante="secundario" larguraTotal icone={<CheckCircle2 />} disabled={pendente} onClick={() => abrir("resolvido")}>Já resolvi</Botao>}
    {podeArquivar && (
      <Botao variante="secundario" larguraTotal icone={arquivado ? <ArchiveRestore /> : <Archive />} disabled={pendente}
        onClick={() => abrir(arquivado ? "desarquivar" : "arquivar")}>
        {arquivado ? "Retirar do arquivo" : aberto ? "Encerrar e arquivar" : "Arquivar pedido"}
      </Botao>
    )}
    {podeCancelar && <Botao variante="texto" icone={<XCircle />} disabled={pendente} onClick={() => abrir("cancelado")}>Cancelar pedido</Botao>}
    <dialog ref={dialogo} role="alertdialog" aria-labelledby="acao-pedido-titulo" aria-describedby="acao-pedido-detalhe"
      onCancel={(e) => { if (trava.current) e.preventDefault(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-card bg-cartao p-5 text-texto shadow-2 backdrop:bg-beringela/50">
      <h2 id="acao-pedido-titulo" className="text-xl font-semibold">{textos.titulo}</h2>
      <p id="acao-pedido-detalhe" className="mt-2 text-base text-texto-suave">{textos.detalhe}</p>
      {erro && <p role="alert" className="mt-3 text-sm font-semibold text-perigo">{erro}</p>}
      <div className="mt-4 flex flex-col gap-2">
        <Botao larguraTotal variante={acao === "cancelado" ? "perigo" : "primario"} carregando={pendente} textoCarregando="Salvando..." onClick={confirmar}>{textos.botao}</Botao>
        <Botao ref={voltar} larguraTotal variante="secundario" disabled={pendente} onClick={() => dialogo.current?.close()}>Voltar</Botao>
      </div>
    </dialog>
  </section>;
}
