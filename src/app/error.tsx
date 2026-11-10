"use client";
import { useEffect } from "react";
import { Botao } from "@/components/ui/botao";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Falha ao carregar a página", error.digest ?? "sem referência"); }, [error]);
  return <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
    <h1 className="text-titulo font-semibold">Não foi possível carregar agora</h1>
    <p>O serviço pode estar temporariamente indisponível. Tente novamente em instantes.</p>
    <Botao onClick={reset}>Tentar novamente</Botao>
    <Botao href="/" variante="secundario">Voltar ao início</Botao>
  </main>;
}
