"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { alternarFavorito, registrarEvento } from "./actions";

// Barra fixa embaixo (T7, item 10): "Chamar no WhatsApp" verde + coração.
// No computador vira uma caixa normal ao lado das fotos.
// O WhatsApp é um link comum: funciona sem JavaScript; com JavaScript também conta o clique.

const CORACAO =
  "grid size-[52px] shrink-0 place-items-center rounded-card border-2 border-borda bg-cartao text-beringela hover:bg-fundo " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:opacity-60";

export function BarraContato({
  anuncioId,
  whatsappHref,
  podeFavoritar,
  favoritoInicial,
  logado,
  entrarHref,
}: {
  anuncioId: string;
  /** Link wa.me com a mensagem pronta (null = vendedor sem WhatsApp). */
  whatsappHref: string | null;
  podeFavoritar: boolean;
  favoritoInicial: boolean;
  logado: boolean;
  /** /entrar com a volta para este anúncio. */
  entrarHref: string;
}) {
  const router = useRouter();
  const [favorito, setFavorito] = useState(favoritoInicial);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [pendente, iniciar] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function mostrar(texto: string, erro = false) {
    setAviso({ texto, erro });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 4000);
  }

  function alternar() {
    const novo = !favorito;
    setFavorito(novo); // mostra na hora; volta se der erro
    iniciar(async () => {
      const r = await alternarFavorito(anuncioId, novo);
      if (r.ok) {
        mostrar(novo ? "Salvo nos seus favoritos." : "Tirado dos favoritos.");
        return;
      }
      setFavorito(!novo);
      if (r.erro.codigo === "28000") router.push(entrarHref);
      else mostrar(r.erro.mensagem, true);
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-borda bg-cartao px-4 py-2 shadow-2 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void registrarEvento(anuncioId, "clique_whatsapp")}
            className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-card bg-verde-escuro px-5 text-base font-semibold text-white hover:bg-[#0c6a35] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
          >
            <MessageCircle className="size-5" aria-hidden />
            Chamar no WhatsApp
          </a>
        ) : (
          <p className="flex min-h-[52px] flex-1 items-center text-[15px] text-texto-suave">Este vendedor ainda não colocou o WhatsApp.</p>
        )}

        {podeFavoritar &&
          (logado ? (
            <button
              type="button"
              onClick={alternar}
              disabled={pendente}
              aria-pressed={favorito}
              aria-label={favorito ? "Tirar dos favoritos" : "Salvar nos favoritos"}
              className={CORACAO}
            >
              <Heart className={`size-6 ${favorito ? "fill-laranja-escuro text-laranja-escuro" : ""}`} aria-hidden />
            </button>
          ) : (
            <Link href={entrarHref} aria-label="Entre para salvar nos favoritos" className={CORACAO}>
              <Heart className="size-6" aria-hidden />
            </Link>
          ))}
      </div>
      <p
        role="status"
        className={aviso ? `mx-auto max-w-6xl pt-1 text-[15px] font-semibold ${aviso.erro ? "text-perigo" : "text-verde-escuro"}` : "sr-only"}
      >
        {aviso?.texto}
      </p>
    </div>
  );
}
