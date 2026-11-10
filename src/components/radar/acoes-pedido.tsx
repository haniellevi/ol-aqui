"use client";
import { useRef, useState, useTransition } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
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
  const [janela, setJanela] = useState(false);
  const trava = useRef(false);
  const [acao, setAcao] = useState<Acao>("arquivar");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrir(motivo: Acao) {
    setErro(null);
    setAcao(motivo);
    setJanela(true);
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
        setJanela(false);
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
    <AlertDialog open={janela} onOpenChange={(abrir) => { if (!abrir && !trava.current) setJanela(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{textos.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{textos.detalhe}</AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <Alert variant="destructive">{erro}</Alert>}
        <AlertDialogFooter>
          <Botao variante="secundario" disabled={pendente} onClick={() => setJanela(false)}>Voltar</Botao>
          <Botao variante={acao === "cancelado" ? "perigo" : "primario"} carregando={pendente} textoCarregando="Salvando..." onClick={confirmar}>{textos.botao}</Botao>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
