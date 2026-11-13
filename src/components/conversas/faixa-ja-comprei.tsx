"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { FolhaResolver, type LojaComProposta } from "@/components/radar/folha-resolver";
import { jaCompreiRecusar } from "@/app/(conta)/conversas/actions";

// "Já comprei" (IA do Radar): só o cliente vê. Mesmo desenho do cartão "Você achou o que procurava?"
// (DestaquePrazo, src/components/radar/acoes-pedido.tsx). "Sim" só abre a folha: o pedido sai do ar
// quando ele escolhe com quem resolveu. "Não" grava e a IA nunca mais pergunta sobre esse pedido.
export function FaixaJaComprei({ conversaId, pedidoId, pedidoTitulo, lojas }: {
  conversaId: string;
  pedidoId: string;
  pedidoTitulo: string;
  lojas: LojaComProposta[];
}) {
  const router = useRouter();
  const trava = useRef(false);
  const [escondida, setEscondida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function aindaPreciso() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    iniciar(async () => {
      try {
        const r = await jaCompreiRecusar(conversaId, pedidoId);
        if (!r.ok) { setErro(r.erro.mensagem); return; }
        setEscondida(true);
        router.refresh();
      } catch { setErro("Não conseguimos salvar. Tente novamente."); }
      finally { trava.current = false; }
    });
  }

  if (escondida) return null;
  return (
    <section aria-labelledby="titulo-ja-comprei" className="flex flex-col gap-3 rounded-card border border-laranja-escuro bg-cartao p-4 shadow-1">
      <h2 id="titulo-ja-comprei" className="text-3xl font-semibold text-beringela">Parece que você já resolveu “{pedidoTitulo}”.</h2>
      <p className="text-facil text-texto">Posso tirar o pedido do Radar?</p>
      <FolhaResolver pedidoId={pedidoId} propostas={lojas} variante="primario" rotulo="Sim, pode tirar" />
      <Botao variante="secundario" larguraTotal icone={<Search />} carregando={pendente} textoCarregando="Salvando..." onClick={aindaPreciso} tamanho="grande">
        Não, ainda preciso
      </Botao>
      {erro && <p role="alert" className="text-facil font-semibold text-perigo">{erro}</p>}
    </section>
  );
}
