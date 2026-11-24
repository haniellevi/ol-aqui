"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { salvarPreferenciaWhatsappRadar } from "@/app/(conta)/minha-conta/notificacoes/actions";
import { Botao } from "@/components/ui/botao";
import { TIPOS_AVISO_WHATSAPP_RADAR, type PreferenciaWhatsappRadar, type TipoAvisoWhatsappRadar } from "@/lib/tipos-radar";

const nomes: Record<TipoAvisoWhatsappRadar, string> = {
  pedido_novo: "Pedidos novos",
  proposta_nova: "Propostas nos meus pedidos",
  proposta_escolhida: "Minha proposta foi escolhida",
};

export function PreferenciaWhatsappRadarBotao({ inicial }: { inicial: PreferenciaWhatsappRadar }) {
  const [tipos, aplicarTipo] = useOptimistic(inicial.tipos, (atuais, mudanca: { tipo: TipoAvisoWhatsappRadar; ligado: boolean }) => ({
    ...atuais,
    [mudanca.tipo]: {
      ligado: mudanca.ligado,
      confirmado_para_piloto: mudanca.ligado || atuais[mudanca.tipo].confirmado_para_piloto,
    },
  }));
  const [retorno, setRetorno] = useState<{ tipo: TipoAvisoWhatsappRadar; ok: boolean; texto: string } | null>(null);
  const trava = useRef(false);
  const rotulos = useRef<Partial<Record<TipoAvisoWhatsappRadar, HTMLParagraphElement | null>>>({});
  const [pendente, iniciar] = useTransition();

  function salvar(tipo: TipoAvisoWhatsappRadar, ligado: boolean, confirmar = false) {
    if (trava.current || (ligado && !inicial.pode_ligar)) return;
    trava.current = true;
    setRetorno(null);
    iniciar(async () => {
      aplicarTipo({ tipo, ligado });
      try {
        const r = await salvarPreferenciaWhatsappRadar(tipo, ligado);
        if (r.ok && confirmar) rotulos.current[tipo]?.focus();
        setRetorno({ tipo, ok: r.ok, texto: r.ok ? r.mensagem : r.erro });
      } catch {
        setRetorno({ tipo, ok: false, texto: "Não conseguimos salvar este aviso. Tente novamente." });
      } finally {
        trava.current = false;
      }
    });
  }

  const indisponivel = inicial.modo === "pausado"
    ? "Os avisos estão pausados. Você ainda pode desligar os avisos que ligou."
    : !inicial.ativo
      ? "Os avisos ainda não estão disponíveis para esta conta."
      : !inicial.confirmado
        ? "Confirme seu WhatsApp em Meus dados para ligar os avisos."
        : null;

  return (
    <div className="space-y-3">
      <p className="text-base text-texto-suave">
        Os avisos chegam das 8h às 20h. Mantenha ligado também o aviso do sino. Para parar todos pelo WhatsApp, responda SAIR.
      </p>
      {indisponivel && <p className="text-base text-texto">{indisponivel}</p>}
      <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
        {TIPOS_AVISO_WHATSAPP_RADAR.map((tipo) => {
          const preferencia = tipos[tipo];
          const confirmar = inicial.modo === "fechado" && preferencia.ligado && !preferencia.confirmado_para_piloto;
          const estado = confirmar ? "Falta confirmar" : preferencia.ligado ? "Ligado" : "Desligado";
          return (
            <li key={tipo} className="space-y-2 px-3 py-3">
              <p tabIndex={-1} ref={(el) => { rotulos.current[tipo] = el; }} className="text-base text-texto">{nomes[tipo]}</p>
              <p className="text-rotulo text-texto-suave">{estado}</p>
              <div className="flex flex-wrap gap-2">
                {confirmar && inicial.pode_ligar && (
                  <Botao variante="secundario" tamanho="toque" disabled={pendente} aria-label={`Confirmar: ${nomes[tipo]}`}
                    onClick={() => salvar(tipo, true, true)}>Confirmar</Botao>
                )}
                <Botao variante="secundario" tamanho="toque" disabled={pendente || (!preferencia.ligado && !inicial.pode_ligar)}
                  aria-label={`${preferencia.ligado ? "Desligar" : "Ligar"}: ${nomes[tipo]}`}
                  onClick={() => salvar(tipo, !preferencia.ligado)}>
                  {preferencia.ligado ? "Desligar" : "Ligar"}
                </Botao>
              </div>
              {retorno?.tipo === tipo && (
                <p role={retorno.ok ? "status" : "alert"} className={retorno.ok ? "text-rotulo text-texto" : "text-rotulo text-perigo"}>
                  {retorno.texto}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
