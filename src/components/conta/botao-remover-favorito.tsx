"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { removerFavorito } from "@/app/(conta)/minha-conta/favoritos/actions";

// Coração cheio no canto do card: tocar tira dos favoritos. Área de toque de 48px.
export function BotaoRemoverFavorito({ anuncioId, titulo, comTexto = false }: { anuncioId: string; titulo: string; comTexto?: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function remover() {
    setErro(null);
    iniciar(async () => {
      const r = await removerFavorito(anuncioId);
      if (!r.ok) setErro(r.erro.mensagem);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={remover}
        disabled={pendente}
        aria-label={comTexto ? undefined : `Tirar "${titulo}" dos favoritos`}
        aria-busy={pendente || undefined}
        className={
          comTexto
            ? "inline-flex min-h-12 items-center gap-2 rounded-campo px-3 text-base font-semibold text-perigo hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:opacity-60"
            : "grid size-12 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:opacity-60"
        }
      >
        <span className={comTexto ? "inline-flex" : "grid size-10 place-items-center rounded-full bg-cartao/95 shadow-1"}>
          {pendente ? (
            <Loader2 className="size-5 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />
          ) : (
            <Heart className="size-5 fill-laranja text-laranja-escuro" aria-hidden />
          )}
        </span>
        {comTexto && (
          <>
            Tirar<span className="sr-only"> &quot;{titulo}&quot; dos favoritos</span>
          </>
        )}
      </button>
      {erro && (
        <p role="alert" className="rounded-campo bg-cartao px-2 py-1 text-sm font-semibold text-perigo shadow-1">
          {erro}
        </p>
      )}
    </div>
  );
}
