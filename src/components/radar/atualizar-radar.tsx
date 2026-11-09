"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";

export function AtualizarRadar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return <Botao variante="secundario" icone={<RefreshCw />} carregando={pendente} textoCarregando="Atualizando..." onClick={() => {
    window.dispatchEvent(new Event("olaki:avisos"));
    iniciar(() => router.refresh());
  }}>Atualizar</Botao>;
}
