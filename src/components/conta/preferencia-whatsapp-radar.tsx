"use client";

import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { salvarPreferenciaWhatsappRadar } from "@/app/(conta)/minha-conta/notificacoes/actions";
import type { PreferenciaWhatsappRadar } from "@/lib/tipos-radar";

// Avisos do Radar por WhatsApp (pedidos novos, propostas e escolha): a pessoa liga ou desliga. Desligado por padrão.
export function PreferenciaWhatsappRadarBotao({ inicial }: { inicial: PreferenciaWhatsappRadar }) {
  const [ligado, setLigado] = useState(inicial.ligado);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const trava = useRef(false);
  const [pendente, iniciar] = useTransition();
  // Ligar exige o aviso liberado e o celular confirmado; desligar é sempre permitido.
  const bloqueado = !ligado && (!inicial.ativo || !inicial.confirmado);

  function alternar() {
    if (trava.current || bloqueado) return;
    trava.current = true;
    setErro(null);
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = await salvarPreferenciaWhatsappRadar(!ligado);
        if (!r.ok) setErro(r.erro);
        else {
          setLigado(!ligado);
          setMensagem(r.mensagem);
        }
      } catch {
        setErro("Não conseguimos salvar sua preferência. Tente novamente.");
      } finally {
        trava.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={pendente || bloqueado}
        aria-pressed={ligado}
        aria-busy={pendente}
        onClick={alternar}
        className="flex min-h-toque w-full items-center gap-3 px-3 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="min-w-0 flex-1 text-rotulo font-normal break-words text-texto">Receber avisos do Radar no WhatsApp (8h às 20h)</span>
        <span className={`inline-flex shrink-0 items-center gap-1 text-legenda ${ligado ? "font-semibold text-beringela" : "text-texto-suave"}`}>
          {pendente ? "Salvando..." : ligado ? <><Check className="size-3.5" aria-hidden />Ligado</> : "Desligado"}
        </span>
      </button>
      <p className="px-3 pb-3 text-legenda text-texto-suave">
        {!inicial.ativo && !ligado
          ? "Este aviso ainda não está disponível."
          : !inicial.ativo
            ? "Este aviso está pausado agora. Você pode desligá-lo aqui."
            : !inicial.confirmado && !ligado
              ? "Confirme seu WhatsApp em Meus dados para ligar este aviso."
              : "Avisamos pelo WhatsApp sobre novidades do Radar: pedidos novos na categoria dos seus anúncios (loja verificada com plano que inclui o alerta ou com cortesia), propostas novas nos seus pedidos e proposta da loja escolhida. Só enviamos os avisos que também estiverem ligados acima. Responda SAIR para parar, ou desligue aqui."}
      </p>
      {erro && <p role="alert" className="px-3 pb-3 text-legenda font-semibold text-perigo">{erro}</p>}
      {mensagem && <p role="status" className="sr-only">{mensagem}</p>}
    </div>
  );
}
