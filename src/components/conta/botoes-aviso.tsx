"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronRight, Loader2, MessageCircle, Star } from "lucide-react";
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
  return <div className="flex flex-col">
    <button type="button" disabled={desabilitado || pendente} aria-busy={pendente}
      onClick={() => executar(marcarTodasLidas)}
      className="olaki-controle min-h-10 rounded-campo px-2 text-legenda font-semibold text-texto-suave underline-offset-4 hover:text-beringela hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:cursor-not-allowed disabled:opacity-50">
      {pendente ? "Marcando..." : "Marcar lidas"}
      <span className="sr-only">: todas as notificações</span>
    </button>
    {erro && <p role="alert" className="max-w-56 text-legenda font-semibold text-perigo">{erro}</p>}
    {mensagem && <p role="status" className="sr-only">{mensagem}</p>}
  </div>;
}

export function LinhaAviso({ aviso: a }: { aviso: Notificacao }) {
  const { executar, pendente, erro, mensagem } = useAcaoAviso();
  const lido = !!a.lida_em;
  const Icone = a.tipo === "proposta_nova" ? MessageCircle : a.tipo === "proposta_escolhida" ? Star : Bell;
  return <>
    <button type="button" disabled={pendente} aria-busy={pendente} onClick={() => executar(() => abrirAviso(a.id))}
      className={`flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:cursor-wait max-[360px]:min-h-14 max-[360px]:gap-1.5 max-[360px]:p-2 ${lido ? "" : "bg-selecao/40"}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fundo text-beringela max-[360px]:size-6"><Icone className="size-4" aria-hidden /></span>
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 max-[360px]:gap-x-2 max-[360px]:gap-y-0.5">
        <span className={`min-w-0 break-words text-rotulo max-[360px]:col-span-2 ${lido ? "font-normal" : "font-semibold text-beringela"}`}>{a.titulo}</span>
        <time className="text-legenda text-texto-suave max-[360px]:col-start-2 max-[360px]:row-start-2" dateTime={a.criado_em} title={dataHoraCurta(a.criado_em)}>{tempoRelativo(a.criado_em)}</time>
        <span className={`col-span-2 min-w-0 text-legenda text-texto-suave max-[360px]:col-span-1 max-[360px]:col-start-1 max-[360px]:row-start-2 ${a.link ? "line-clamp-1" : "break-words"}`}>{a.texto}</span>
        <span className="sr-only">{lido ? "Lido." : "Não lido."} {pendente ? "Abrindo..." : a.link ? "Abrir aviso." : lido ? "" : "Marcar como lido."}</span>
      </span>
      <span className="flex w-4 shrink-0 flex-col items-center gap-2 max-[360px]:w-3" aria-hidden>
        {pendente ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-texto-suave" /> : <>
          {!lido && <span className="size-1.5 rounded-full bg-beringela" />}
          {a.link && <ChevronRight className="size-4 text-texto-suave" />}
        </>}
      </span>
    </button>
    {erro && <p role="alert" className="px-4 pb-3 text-sm font-semibold text-perigo">{erro}</p>}
    {mensagem && !a.link && <p role="status" className="sr-only">{mensagem}</p>}
  </>;
}

export function PreferenciaAvisoBotao({ preferencia: p }: { preferencia: PreferenciaAviso }) {
  const { executar, pendente, erro, mensagem } = useAcaoAviso();
  return <div className="flex flex-col">
    <button type="button" disabled={pendente} aria-pressed={p.ligado} aria-busy={pendente}
      onClick={() => executar(() => salvarPreferenciaAviso(p.tipo, !p.ligado))}
      className="flex min-h-10 w-full items-center gap-3 px-3 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:cursor-wait">
      <span className="min-w-0 flex-1 break-words text-rotulo font-normal text-texto">{p.nome}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 text-legenda ${p.ligado ? "font-semibold text-beringela" : "text-texto-suave"}`}>
        {pendente ? "Salvando..." : p.ligado ? <><Check className="size-3.5" aria-hidden />Ligado</> : "Desligado"}
      </span>
    </button>
    {erro && <p role="alert" className="px-3 pb-3 text-legenda font-semibold text-perigo">{erro}</p>}
    {mensagem && <p role="status" className="sr-only">{mensagem}</p>}
  </div>;
}
