"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Botao, type TamanhoBotao } from "@/components/ui/botao";

export function AtualizarRadar({ tamanho = "normal" }: { tamanho?: TamanhoBotao } = {}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return <Botao variante="secundario" tamanho={tamanho} icone={<RefreshCw />} carregando={pendente} textoCarregando="Atualizando..." onClick={() => {
    window.dispatchEvent(new Event("olaki:avisos"));
    iniciar(() => router.refresh());
  }}>Atualizar</Botao>;
}
