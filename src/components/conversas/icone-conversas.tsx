"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { LINK_CONVERSAS } from "@/lib/rotas";

/** Evento que a conversa aberta dispara depois de marcar como lida: a bolinha atualiza na hora. */
export const EVENTO_CONVERSAS = "olaki:conversas";

// Ícone "Conversas" do topo (ao lado do sino), com a bolinha de conversas não lidas.
// Mesmo comportamento do SinoAvisos: consulta a cada 60 s, ao voltar para a aba e no evento acima.
export function IconeConversas() {
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
        const resposta = await fetch("/api/conversas/resumo", { cache: "no-store", signal: controlador.signal });
        if (!resposta.ok) throw new Error("Contagem indisponível");
        const dados = await resposta.json();
        if (!Number.isSafeInteger(dados.naoLidas) || dados.naoLidas < 0) throw new Error("Contagem inválida");
        if (ativo) {
          setTotal(dados.naoLidas);
          setFalhou(false);
          if (anterior !== null && anterior !== dados.naoLidas && caminho === LINK_CONVERSAS) router.refresh();
          anterior = dados.naoLidas;
        }
      } catch { if (ativo) setFalhou(true); }
      finally { window.clearTimeout(prazo); emCurso = false; }
    }
    void atualizar();
    const intervalo = window.setInterval(atualizar, 60000);
    window.addEventListener("focus", atualizar);
    window.addEventListener(EVENTO_CONVERSAS, atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      ativo = false;
      controlador?.abort();
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener(EVENTO_CONVERSAS, atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [caminho, router]);
  const nome = falhou ? "Conversas. Não foi possível atualizar a contagem." : total === null || total === 0 ? "Conversas" : `Conversas: ${total} ${total === 1 ? "não lida" : "não lidas"}`;
  return <Link href={LINK_CONVERSAS} aria-label={nome} title={nome} className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-card px-2.5 text-rotulo font-semibold text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro">
    <MessageSquare className="size-5" aria-hidden />
    <span className="hidden sm:max-md:inline lg:inline" aria-hidden>Conversas</span>
    {!falhou && total !== null && total > 0 && <span aria-hidden className="absolute top-0 left-6 min-w-5 rounded-full bg-laranja-escuro px-1 text-center text-legenda leading-5 font-bold text-white tabular-nums">{total > 99 ? "99+" : total}</span>}
  </Link>;
}
