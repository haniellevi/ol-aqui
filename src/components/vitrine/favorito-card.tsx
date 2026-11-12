"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { definirFavorito } from "@/app/(conta)/minha-conta/favoritos/actions";

// Coração no canto da foto do card da vitrine (vitrine com IA, etapa 2).
// Mesma ação da página do anúncio: mostra na hora e volta se o banco recusar.
// Sem login vira link para entrar e voltar à loja.
// O mesmo produto pode aparecer em uma seção e na categoria: os corações conversam por um aviso na janela.

const EVENTO = "olaki-favorito";
type Aviso = { anuncioId: string; favorito: boolean };

const CORACAO =
  "grid size-10 place-items-center rounded-full bg-cartao/90 text-beringela shadow-1 hover:bg-cartao active:brightness-90 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:opacity-60";

export function FavoritoCard({
  anuncioId,
  titulo,
  inicial,
  logado,
  entrarHref,
}: {
  anuncioId: string;
  titulo: string;
  /** null = não conseguimos consultar (o botão fica desligado). */
  inicial: boolean | null;
  logado: boolean;
  entrarHref: string;
}) {
  const router = useRouter();
  const [favorito, setFavorito] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<Aviso>).detail;
      if (d?.anuncioId === anuncioId) setFavorito(d.favorito);
    };
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, [anuncioId]);

  /** Muda este coração e os outros do mesmo produto na página. */
  function aplicar(valor: boolean) {
    setFavorito(valor);
    window.dispatchEvent(new CustomEvent<Aviso>(EVENTO, { detail: { anuncioId, favorito: valor } }));
  }

  if (!logado) {
    return (
      <Link href={entrarHref} aria-label={`Entre para salvar ${titulo} nos favoritos`} className={CORACAO}>
        <Heart className="size-5" aria-hidden />
      </Link>
    );
  }

  function alternar() {
    if (trava.current || favorito === null) return;
    trava.current = true;
    const novo = !favorito;
    aplicar(novo);
    setErro(null);
    iniciar(async () => {
      try {
        const r = await definirFavorito(anuncioId, novo);
        if (r.ok && r.dados.favorito === novo) return;
        aplicar(!novo);
        if (!r.ok && r.erro.codigo === "28000") router.push(entrarHref);
        else setErro(!r.ok ? r.erro.mensagem : "Não conseguimos confirmar. Atualize a página.");
      } catch {
        aplicar(!novo);
        setErro("Não foi possível atualizar o favorito. Tente novamente.");
      } finally {
        trava.current = false;
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        disabled={pendente || favorito === null}
        aria-busy={pendente}
        aria-pressed={favorito ?? undefined}
        aria-label={favorito === null ? "Favorito indisponível" : favorito ? `Tirar ${titulo} dos favoritos` : `Salvar ${titulo} nos favoritos`}
        className={CORACAO}
      >
        <Heart className={`size-5 ${favorito ? "fill-coracao text-coracao" : ""}`} aria-hidden />
      </button>
      <span role="alert" className="sr-only">{erro}</span>
    </>
  );
}
