"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronRight, MessageCircle, Star } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { abrirAviso, marcarTodasLidas, salvarPreferenciaAviso } from "@/app/(conta)/minha-conta/notificacoes/actions";
import { tempoRelativo } from "@/lib/formato";
import { dataHoraCurta } from "@/components/radar/util";
import type { Notificacao, PreferenciaAviso } from "@/lib/tipos-radar";

type Resposta = Awaited<ReturnType<typeof abrirAviso>>;
function useAcaoAviso() {
  const router = useRouter();
  const trava = useRef(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  function executar(acao: () => Promise<Resposta>) {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = await acao();
        if (!r.ok) { setErro(r.erro); return; }
        setMensagem(r.mensagem);
        window.dispatchEvent(new Event("olaki:avisos"));
        if (r.destino) router.push(r.destino);
        else router.refresh();
      } catch { setErro("Não conseguimos confirmar a alteração. Tente novamente."); }
      finally { trava.current = false; }
    });
  }
  return { executar, pendente, erro, mensagem };
}

export function MarcarAvisos({ desabilitado }: { desabilitado: boolean }) {
  const { executar, pendente, erro, mensagem } = useAcaoAviso();
  return <div className="flex flex-col gap-2">
    <Botao variante="texto" disabled={desabilitado} carregando={pendente} textoCarregando="Marcando..." onClick={() => executar(marcarTodasLidas)}>Marcar todas como lidas</Botao>
    {erro && <p role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
    {mensagem && <p role="status" className="text-sm text-verde-escuro">{mensagem}</p>}
  </div>;
}

export function LinhaAviso({ aviso: a }: { aviso: Notificacao }) {
  const { executar, pendente, erro, mensagem } = useAcaoAviso();
  const lido = !!a.lida_em;
  const Icone = a.tipo === "proposta_nova" ? MessageCircle : a.tipo === "proposta_escolhida" ? Star : Bell;
  return <>
    <button type="button" disabled={pendente} aria-busy={pendente} onClick={() => executar(() => abrirAviso(a.id))}
      className={`flex min-h-14 w-full items-start gap-3 px-4 py-4 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:cursor-wait ${lido ? "" : "bg-laranja-claro/60"}`}>
      <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-fundo text-beringela"><Icone className="size-5" aria-hidden /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`break-words text-base ${lido ? "font-semibold" : "font-bold"}`}>{a.titulo}</span>
        <span className="break-words text-[15px] text-texto-suave">{a.texto}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-texto-suave">
          <span className={lido ? "" : "font-semibold text-laranja-escuro"}>{lido ? "Lido" : "Não lido"}</span>
          <time dateTime={a.criado_em} title={dataHoraCurta(a.criado_em)}>{tempoRelativo(a.criado_em)}</time>
        </span>
        <span className="mt-1 text-sm font-semibold text-laranja-escuro">{pendente ? "Abrindo..." : a.link ? "Abrir aviso" : lido ? "Já lido" : "Marcar como lido"}</span>
      </span>
      {a.link && <ChevronRight className="mt-1 size-5 shrink-0 text-texto-suave" aria-hidden />}
    </button>
    {erro && <p role="alert" className="px-4 pb-3 text-sm font-semibold text-perigo">{erro}</p>}
    {mensagem && !a.link && <p role="status" className="px-4 pb-3 text-sm text-verde-escuro">{mensagem}</p>}
  </>;
}

export function PreferenciaAvisoBotao({ preferencia: p }: { preferencia: PreferenciaAviso }) {
  const { executar, pendente, erro, mensagem } = useAcaoAviso();
  return <div className="flex flex-col gap-2">
    <button type="button" disabled={pendente} aria-pressed={p.ligado} aria-busy={pendente}
      onClick={() => executar(() => salvarPreferenciaAviso(p.tipo, !p.ligado))}
      className={`flex min-h-14 w-full flex-wrap items-center gap-3 rounded-campo border px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:cursor-wait ${p.ligado ? "border-laranja-escuro bg-laranja-claro" : "border-borda bg-cartao hover:bg-fundo"}`}>
      <span className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="break-words text-base font-semibold text-beringela">{p.nome}</span>
        {p.explicacao && <span className="text-[13px] text-texto-suave">{p.explicacao}</span>}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-beringela">
        {pendente ? "Salvando..." : p.ligado ? <><Check className="size-4" aria-hidden />Ligado</> : "Desligado"}
      </span>
    </button>
    {erro && <p role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
    {mensagem && <p role="status" className="text-sm text-verde-escuro">{mensagem}</p>}
  </div>;
}
