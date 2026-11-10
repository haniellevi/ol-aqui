"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { LINK_AVISOS } from "@/lib/rotas";

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
  return <Link href={LINK_AVISOS} aria-label={nome} title={nome} className="relative grid size-12 shrink-0 place-items-center rounded-card text-texto hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro">
    <Bell className="size-5" aria-hidden />
    {!falhou && total !== null && total > 0 && <span aria-hidden className="absolute right-0 top-0 min-w-5 rounded-full bg-laranja-escuro px-1 text-center text-legenda font-bold leading-5 text-white tabular-nums">{total > 99 ? "99+" : total}</span>}
  </Link>;
}
