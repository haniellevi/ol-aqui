"use client";

import { useFormStatus } from "react-dom";
import { Check, ChevronRight, Loader2 } from "lucide-react";

// Botões da tela de avisos que travam e giram enquanto o servidor trabalha (sem toque duplo).

/** A linha inteira do aviso é o botão: toque abre a tela do aviso. */
export function BotaoLinhaAviso({ lido, temLink, children }: { lido: boolean; temLink: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro disabled:cursor-wait ${
        lido ? "" : "bg-laranja-claro/60"
      }`}
    >
      {children}
      {pending ? (
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-texto-suave">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Abrindo...
        </span>
      ) : (
        temLink && <ChevronRight className="mt-1 size-5 shrink-0 text-texto-suave" aria-hidden />
      )}
    </button>
  );
}

/** Liga/desliga um aviso. Ligado = laranja-claro com borda laranja-escuro e ✓ (igual aos chips). */
export function BotaoPreferencia({ ligado, nome, explicacao }: { ligado: boolean; nome: string; explicacao: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={ligado}
      aria-busy={pending}
      className={`flex min-h-14 w-full items-center gap-3 rounded-campo border px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:cursor-wait ${
        ligado ? "border-laranja-escuro bg-laranja-claro" : "border-borda bg-cartao hover:bg-fundo"
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-beringela">{nome}</span>
        {explicacao && <span className="text-[13px] text-texto-suave">{explicacao}</span>}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-beringela">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Salvando...
          </>
        ) : ligado ? (
          <>
            <Check className="size-4" aria-hidden />
            Ligado
          </>
        ) : (
          "Desligado"
        )}
      </span>
    </button>
  );
}
