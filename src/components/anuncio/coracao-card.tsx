"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { alternarFavorito } from "@/app/(publico)/anuncio/[idslug]/actions";
import { guardarPendente } from "@/lib/salvar-pendente";

// Coração no canto da foto do card. Logado: salva/tira na hora (volta se der erro).
// Sem conta: leva para Entrar e, na volta ao Início, o anúncio já fica salvo (?salvar=<id>).
const ALVO = "grid size-12 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-laranja-escuro disabled:opacity-60";
const BOLA = "grid size-9 place-items-center rounded-full bg-cartao/95 text-beringela shadow-1";

/** Avisa os outros corações do mesmo anúncio na tela (destaque e feed) que o favorito mudou. */
const EVENTO = "favorito-mudou";
type Mudanca = { id: string; favorito: boolean };
export function avisarFavorito(id: string, favorito: boolean) {
  window.dispatchEvent(new CustomEvent<Mudanca>(EVENTO, { detail: { id, favorito } }));
}

export function CoracaoCard({ anuncioId, titulo, logado, inicial }: { anuncioId: string; titulo: string; logado: boolean; inicial: boolean }) {
  const [favorito, setFavorito] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);

  // Nova leitura do servidor (ex.: depois de entrar e salvar na volta) vence o valor antigo.
  useEffect(() => setFavorito(inicial), [inicial]);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const { id, favorito: valor } = (e as CustomEvent<Mudanca>).detail;
      if (id === anuncioId) setFavorito(valor);
    };
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, [anuncioId]);

  if (!logado) {
    const volta = `/?salvar=${anuncioId}`;
    return (
      <Link href={`/entrar?redirect_url=${encodeURIComponent(volta)}`} onClick={() => guardarPendente(anuncioId)} aria-label={`Entre para salvar "${titulo}" nos favoritos`} className={ALVO}>
        <span className={BOLA}><Heart className="size-5" aria-hidden /></span>
      </Link>
    );
  }

  function alternar() {
    if (trava.current) return;
    trava.current = true;
    const novo = !favorito;
    avisarFavorito(anuncioId, novo);
    setErro(null);
    iniciar(async () => {
      try {
        const r = await alternarFavorito(anuncioId, novo);
        if (!r.ok || r.dados.favorito !== novo) {
          avisarFavorito(anuncioId, !novo);
          setErro(!r.ok ? r.erro.mensagem : "Não conseguimos confirmar. Atualize a página.");
        }
      } catch {
        avisarFavorito(anuncioId, !novo);
        setErro("A conexão falhou. Tente novamente.");
      } finally {
        trava.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        aria-pressed={favorito}
        aria-busy={pendente || undefined}
        aria-label={favorito ? `Tirar "${titulo}" dos favoritos` : `Salvar "${titulo}" nos favoritos`}
        className={ALVO}
      >
        <span className={BOLA}>
          {pendente ? (
            <Loader2 className="size-5 animate-spin text-texto-suave motion-reduce:animate-none" aria-hidden />
          ) : (
            <Heart className={`size-5 ${favorito ? "fill-laranja text-laranja-escuro" : ""}`} aria-hidden />
          )}
        </span>
      </button>
      {erro && <p role="alert" className="mr-1 max-w-40 rounded-card bg-cartao px-2 py-1 text-legenda font-semibold text-perigo shadow-1">{erro}</p>}
    </div>
  );
}
