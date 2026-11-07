"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { chamarLoja, fecharPedido } from "@/app/radar/acoes-comprador";

/** "Chamar no WhatsApp" de uma proposta: o banco marca a escolha e devolve o número da loja. */
export function BotaoChamarLoja({ propostaId, escolhida }: { propostaId: string; escolhida: boolean }) {
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function chamar() {
    setErro(null);
    iniciar(async () => {
      const r = await chamarLoja(propostaId);
      if (r.ok) window.location.href = r.link;
      else setErro(r.erro);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Botao variante="whatsapp" larguraTotal icone={<MessageCircle />} onClick={chamar} carregando={enviando} textoCarregando="Abrindo o WhatsApp...">
        {escolhida ? "Chamar de novo no WhatsApp" : "Chamar no WhatsApp"}
      </Botao>
      <div aria-live="assertive">
        {erro && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Já resolvi" e "Não quero mais": tiram o pedido do Radar. Não tem volta,
 * então pede confirmação (USABILIDADE, regra 12).
 */
export function FecharPedido({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<"atendido" | "encerrado" | null>(null);
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function fechar(motivo: "atendido" | "encerrado") {
    setErro(null);
    iniciar(async () => {
      const r = await fecharPedido(pedidoId, motivo);
      if (r.ok) {
        setConfirmar(null);
        router.refresh();
      } else setErro(r.erro ?? "Algo deu errado. Tente de novo.");
    });
  }

  if (confirmar) {
    return (
      <div role="group" aria-labelledby="confirmar-fechar" className="flex flex-col gap-3 rounded-card border-2 border-borda bg-cartao p-4">
        <p id="confirmar-fechar" className="text-base font-semibold">
          {confirmar === "atendido"
            ? "Que bom! Tirar o pedido do Radar? As lojas param de mandar ofertas."
            : "Tirar o pedido do Radar? As lojas param de mandar ofertas."}
        </p>
        <Botao
          variante={confirmar === "atendido" ? "primario" : "perigo"}
          larguraTotal
          carregando={enviando}
          textoCarregando="Tirando do Radar..."
          onClick={() => fechar(confirmar)}
        >
          Sim, tirar do Radar
        </Botao>
        <Botao variante="secundario" larguraTotal onClick={() => setConfirmar(null)} disabled={enviando}>
          Não, deixar no ar
        </Botao>
        {erro && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Botao variante="secundario" larguraTotal icone={<CheckCircle2 />} onClick={() => setConfirmar("atendido")}>
        Já resolvi, tirar do Radar
      </Botao>
      <Botao variante="texto" icone={<XCircle />} onClick={() => setConfirmar("encerrado")} className="self-center">
        Não quero mais
      </Botao>
    </div>
  );
}
