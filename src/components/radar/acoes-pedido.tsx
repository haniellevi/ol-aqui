"use client";
import { useRef, useState, useTransition } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { estenderPedido, fecharPedido, mudarArquivoPedido } from "@/app/radar/actions";
import { FolhaResolver, type LojaComProposta } from "./folha-resolver";
import { linkMeuPedidoRadar } from "@/lib/rotas";

type Acao = "cancelado" | "arquivar" | "desarquivar";

/** Cartão de destaque perto do vencimento: "Ainda preciso" (mais um prazo) ou "Já resolvi". */
export function DestaquePrazo({ pedidoId, propostas, vencimento }: { pedidoId: string; propostas: LojaComProposta[]; vencimento: string }) {
  const router = useRouter();
  const trava = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Depois de estender, o cartão some (pode_estender vira false). A confirmação fica na página,
  // num lugar que não some: ?estendido=1 (ver radar/pedido/[id]/page.tsx).
  function aindaPreciso() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await estenderPedido(pedidoId);
        if (!r.ok) { setErro(r.erro); return; }
        router.replace(`${linkMeuPedidoRadar(pedidoId)}?estendido=1`, { scroll: false });
        router.refresh();
      } catch { setErro("Não conseguimos salvar. Tente novamente."); }
      finally { trava.current = false; }
    });
  }

  return (
    <section aria-labelledby="titulo-achou" className="flex flex-col gap-3 rounded-card border border-laranja-escuro bg-cartao p-4 shadow-1">
      <h2 id="titulo-achou" className="text-3xl font-semibold text-beringela">Você achou o que procurava?</h2>
      <p className="text-facil text-texto">{vencimento}. Se ainda precisa, ele fica mais 15 dias no ar.</p>
      <Botao larguraTotal icone={<CalendarPlus />} carregando={pendente} textoCarregando="Salvando..." onClick={aindaPreciso} tamanho="grande">
        Ainda preciso
      </Botao>
      <FolhaResolver pedidoId={pedidoId} propostas={propostas} />
      {erro && <p role="alert" className="text-facil font-semibold text-perigo">{erro}</p>}
    </section>
  );
}

export function AcoesPedido({
  pedidoId, podeResolver, propostas = [], podeCancelar, podeArquivar, arquivado, aberto,
}: {
  pedidoId: string;
  /** "Já resolvi" aqui embaixo (fica fora quando o cartão "Você achou o que procurava?" já mostra). */
  podeResolver: boolean;
  propostas?: LojaComProposta[];
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
          : await fecharPedido(pedidoId, "cancelado");
        if (!r.ok) { setErro(r.erro); return; }
        setJanela(false);
        router.refresh();
      } catch { setErro("Não conseguimos salvar a mudança. Tente novamente."); }
      finally { trava.current = false; }
    });
  }

  if (!(podeResolver || podeCancelar || podeArquivar)) return null;

  const textos = {
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
    {podeResolver && <FolhaResolver pedidoId={pedidoId} propostas={propostas} />}
    {podeArquivar && (
      <Botao variante="secundario" larguraTotal icone={arquivado ? <ArchiveRestore /> : <Archive />} disabled={pendente} tamanho="grande"
        onClick={() => abrir(arquivado ? "desarquivar" : "arquivar")}>
        {arquivado ? "Retirar do arquivo" : aberto ? "Encerrar e arquivar" : "Arquivar pedido"}
      </Botao>
    )}
    {podeCancelar && <Botao variante="texto" icone={<XCircle />} disabled={pendente} onClick={() => abrir("cancelado")} tamanho="grande">Cancelar pedido</Botao>}
    <AlertDialog open={janela} onOpenChange={(abrir) => { if (!abrir && !trava.current) setJanela(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-3xl">{textos.titulo}</AlertDialogTitle>
          <AlertDialogDescription className="text-facil">{textos.detalhe}</AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <Alert variant="destructive" className="text-facil">{erro}</Alert>}
        <AlertDialogFooter>
          <Botao variante="secundario" disabled={pendente} onClick={() => setJanela(false)} tamanho="grande">Voltar</Botao>
          <Botao variante={acao === "cancelado" ? "perigo" : "primario"} carregando={pendente} textoCarregando="Salvando..." onClick={confirmar} tamanho="grande">{textos.botao}</Botao>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
