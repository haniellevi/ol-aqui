"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { alternarFavorito, registrarEvento } from "./actions";

// Barra fixa embaixo (T7, item 10): "Chamar no WhatsApp" verde + coração.
// No computador vira uma caixa normal ao lado das fotos.
// O WhatsApp é um link comum: funciona sem JavaScript; com JavaScript também conta o clique.

const CORACAO =
  "grid size-13 shrink-0 place-items-center rounded-card border-2 border-borda bg-cartao text-beringela hover:bg-fundo active:brightness-90 " +
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
  favoritoInicial: boolean | null;
  logado: boolean;
  /** /entrar com a volta para este anúncio. */
  entrarHref: string;
}) {
  const router = useRouter();
  const [favorito, setFavorito] = useState(favoritoInicial);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  useEffect(() => { setFavorito(favoritoInicial); }, [favoritoInicial]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function mostrar(texto: string, erro = false) {
    setAviso({ texto, erro });
    clearTimeout(timer.current);
    if (!erro) timer.current = setTimeout(() => setAviso(null), 6000);
  }

  function alternar() {
    if (trava.current || favorito === null) return;
    trava.current = true;
    const novo = !favorito;
    setFavorito(novo); // mostra na hora; volta se der erro
    iniciar(async () => {
      try {
        const r = await alternarFavorito(anuncioId, novo);
        if (r.ok && r.dados.favorito === novo) {
          mostrar(novo ? "Salvo nos seus favoritos." : "Tirado dos favoritos.");
          return;
        }
        setFavorito(!novo);
        if (!r.ok && r.erro.codigo === "28000") router.push(entrarHref);
        else mostrar(!r.ok ? r.erro.mensagem : "Não conseguimos confirmar a alteração. Atualize a página.", true);
      } catch {
        setFavorito(!novo);
        mostrar("Não foi possível atualizar o favorito. Tente novamente.", true);
      } finally { trava.current = false; }
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
            onClick={() => void registrarEvento(anuncioId, "clique_whatsapp").catch(() => undefined)}
            aria-label="Chamar o vendedor no WhatsApp (abre em nova aba)"
            className={classesBotao("whatsapp", false, "min-w-0 flex-1 px-3")}
          >
            <MessageCircle className="size-5" aria-hidden />
            Chamar no WhatsApp
          </a>
        ) : (
          <p className="flex min-h-13 min-w-0 flex-1 items-center text-[15px] text-texto-suave">Contato por WhatsApp indisponível neste anúncio.</p>
        )}

        {podeFavoritar &&
          (logado ? (
            <button
              type="button"
              onClick={alternar}
              disabled={pendente || favorito === null}
              aria-busy={pendente}
              aria-pressed={favorito ?? undefined}
              aria-label={favorito === null ? "Favorito indisponível" : favorito ? "Tirar dos favoritos" : "Salvar nos favoritos"}
              className={CORACAO}
            >
              <Heart className={`size-6 ${favorito ? "fill-coracao text-coracao" : ""}`} aria-hidden />
            </button>
          ) : (
            <Link href={entrarHref} aria-label="Entre para salvar nos favoritos" className={CORACAO}>
              <Heart className="size-6" aria-hidden />
            </Link>
          ))}
      </div>
      {podeFavoritar && logado && <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 text-sm">
        {favorito === null && <><span role="alert" className="text-perigo">Não conseguimos consultar seu favorito.</span><button type="button" onClick={() => router.refresh()} className="min-h-11 rounded-campo font-semibold text-laranja-escuro underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">Tentar novamente</button></>}
        <Link href="/minha-conta/favoritos" className="inline-flex min-h-11 items-center rounded-campo font-semibold text-laranja-escuro underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">Ver meus favoritos</Link>
      </div>}
      <p
        role={aviso?.erro ? "alert" : "status"}
        className={aviso ? `mx-auto max-w-6xl pt-1 text-[15px] font-semibold ${aviso.erro ? "text-perigo" : "text-verde-escuro"}` : "sr-only"}
      >
        {aviso?.texto}
      </p>
    </div>
  );
}
