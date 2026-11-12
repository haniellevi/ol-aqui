"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { removerFavorito } from "@/app/(conta)/minha-conta/favoritos/actions";

// Coração cheio no canto do card: tocar tira dos favoritos. Área de toque de 48px.
export function BotaoRemoverFavorito({ anuncioId, titulo, comTexto = false, onRemovido }: { anuncioId: string; titulo: string; comTexto?: boolean; onRemovido?: () => void }) {
  const router = useRouter();
  const trava = useRef(false);
  const [precisaEntrar, setPrecisaEntrar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function remover() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    setPrecisaEntrar(false);
    iniciar(async () => {
      try {
        const r = await removerFavorito(anuncioId);
        if (!r.ok) { setErro(r.erro.mensagem); setPrecisaEntrar(r.erro.codigo === "28000"); }
        else { onRemovido?.(); router.refresh(); }
      } catch { setErro("A conexão falhou. Tente novamente; repetir a remoção é seguro."); }
      finally { trava.current = false; }
    });
  }

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        onClick={remover}
        disabled={pendente}
        aria-label={comTexto ? undefined : `Remover "${titulo}" dos favoritos`}
        aria-busy={pendente || undefined}
        className={
          comTexto
            ? "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-campo px-3 text-base font-semibold text-perigo hover:bg-perigo-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:opacity-60"
            : "grid size-12 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:opacity-60"
        }
      >
        <span className={comTexto ? "inline-flex" : "grid size-10 place-items-center rounded-full bg-cartao/95 shadow-1"}>
          {pendente ? (
            <Loader2 className="size-5 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />
          ) : (
            <Heart className="size-5 fill-coracao text-coracao" aria-hidden />
          )}
        </span>
        {comTexto && (
          <>
            Remover<span className="sr-only"> &quot;{titulo}&quot; dos favoritos</span>
          </>
        )}
      </button>
      {precisaEntrar && <Link href="/entrar?redirect_url=%2Fminha-conta%2Ffavoritos" className="inline-flex min-h-11 items-center text-sm font-semibold text-laranja-escuro underline">Entrar novamente</Link>}
      {erro && (
        <p role="alert" className="rounded-card bg-cartao px-2 py-1 text-sm font-semibold text-perigo shadow-1">
          {erro}
        </p>
      )}
    </div>
  );
}
