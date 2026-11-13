"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell } from "lucide-react";
import { LINK_AVISOS } from "@/lib/rotas";
import type { Notificacao } from "@/lib/tipos-radar";
import { LinhaAviso } from "./botoes-aviso";

export function SinoAvisos() {
  const caminho = usePathname();
  const router = useRouter();
  const [total, setTotal] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let ativo = true;
    let emCurso = false;
    let anterior: number | null = null;
    let controlador: AbortController | null = null;
    async function atualizar() {
      if (document.visibilityState !== "visible" || emCurso) return;
      emCurso = true;
      controlador = new AbortController();
      const requisicao = controlador;
      const prazo = window.setTimeout(() => requisicao.abort(), 15000);
      try {
        const resposta = await fetch("/api/notificacoes/resumo", { cache: "no-store", signal: controlador.signal });
        if (!resposta.ok) throw new Error("Contagem indisponível");
        const dados = await resposta.json();
        if (!Number.isSafeInteger(dados.naoLidas) || dados.naoLidas < 0) throw new Error("Contagem inválida");
        if (ativo) {
          setTotal(dados.naoLidas);
          setFalhou(false);
          if (anterior !== null && anterior !== dados.naoLidas && caminho === LINK_AVISOS) router.refresh();
          anterior = dados.naoLidas;
        }
      } catch { if (ativo) setFalhou(true); }
      finally { window.clearTimeout(prazo); emCurso = false; }
    }
    void atualizar();
    const intervalo = window.setInterval(atualizar, 60000);
    window.addEventListener("focus", atualizar);
    window.addEventListener("olaki:avisos", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      ativo = false;
      controlador?.abort();
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("olaki:avisos", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [caminho, router]);
  const nome = falhou ? "Notificações. Não foi possível atualizar a contagem." : total === null ? "Notificações" : `Notificações: ${total} ${total === 1 ? "não lida" : "não lidas"}`;
  return <PreviaAvisos key={caminho} nome={nome} total={falhou ? null : total} />;
}

function PreviaAvisos({ nome, total }: { nome: string; total: number | null }) {
  const [aberto, setAberto] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger aria-label={nome} className="relative grid size-10 shrink-0 place-items-center rounded-card text-texto hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro">
        <Bell className="size-5" aria-hidden />
        {total !== null && total > 0 && <span aria-hidden className="absolute top-0 right-0 min-w-5 rounded-full bg-laranja-escuro px-1 text-center text-legenda leading-5 font-bold text-white tabular-nums">{total > 99 ? "99+" : total}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6} collisionPadding={8} className="z-50">
          <Popover.Popup initialFocus={titulo} className="flex max-h-[var(--available-height)] w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-card border border-borda bg-cartao shadow-2">
            <Popover.Title ref={titulo} tabIndex={-1} className="shrink-0 border-b border-borda px-3 py-2.5 text-sm font-semibold text-beringela">Notificações recentes</Popover.Title>
            <ListaPrevia fechar={() => setAberto(false)} />
            <Link
              href={LINK_AVISOS}
              onClick={() => setAberto(false)}
              className="flex min-h-11 shrink-0 items-center justify-center border-t border-borda px-3 text-sm font-semibold text-beringela hover:bg-fundo hover:underline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
            >
              Ver todas
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ListaPrevia({ fechar }: { fechar: () => void }) {
  const [avisos, setAvisos] = useState<Notificacao[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let atual: AbortController | undefined;
    async function carregar() {
      atual?.abort();
      const pedido = new AbortController();
      atual = pedido;
      const prazo = window.setTimeout(() => pedido.abort(), 15000);
      try {
        const resposta = await fetch("/api/notificacoes/resumo?previa=1", { cache: "no-store", signal: pedido.signal });
        if (!resposta.ok) throw new Error("Avisos indisponíveis");
        const dados = await resposta.json();
        if (!Array.isArray(dados.avisos)) throw new Error("Avisos inválidos");
        if (atual === pedido) {
          setAvisos(dados.avisos);
          setFalhou(false);
        }
      } catch {
        if (atual === pedido) setFalhou(true);
      } finally {
        window.clearTimeout(prazo);
      }
    }
    void carregar();
    window.addEventListener("olaki:avisos", carregar);
    return () => {
      atual?.abort();
      atual = undefined;
      window.removeEventListener("olaki:avisos", carregar);
    };
  }, []);

  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {falhou ? (
        <p role="status" className="px-3 py-3 text-sm text-texto-suave">Não foi possível carregar as notificações.</p>
      ) : avisos === null ? (
        <p role="status" className="px-3 py-3 text-sm text-texto-suave">Carregando notificações…</p>
      ) : avisos.length === 0 ? (
        <p className="px-3 py-3 text-sm text-texto-suave">Você ainda não tem notificações.</p>
      ) : (
        <ul className="divide-y divide-borda">
          {avisos.map((aviso) => <li key={aviso.id}><LinhaAviso aviso={aviso} compacto aoNavegar={fechar} /></li>)}
        </ul>
      )}
    </div>
  );
}
