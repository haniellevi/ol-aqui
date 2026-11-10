"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";

export function AtualizarConversa({ recentes }: { recentes: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (!recentes) return;
    const atualizar = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const timer = window.setInterval(atualizar, 15_000);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [recentes, router]);

  return <Botao variante="secundario" icone={<RefreshCw />} carregando={pendente} textoCarregando="Atualizando..."
    onClick={() => iniciar(() => router.refresh())}>Atualizar</Botao>;
}
