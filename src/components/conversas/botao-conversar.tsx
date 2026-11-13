"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { abrirConversaAnuncio } from "@/app/(conta)/conversas/actions";
import { linkConversa } from "@/lib/rotas";

// Botão "Conversar" da barra do anúncio: abre (ou reabre) a conversa com quem anunciou.
export function BotaoConversar({ anuncioId, logado, entrarHref, onErro }: {
  anuncioId: string;
  logado: boolean;
  entrarHref: string;
  /** Mostra o erro no aviso que a barra já tem. */
  onErro: (mensagem: string) => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [abrindo, setAbrindo] = useState(false);
  const classe = classesBotao("secundario", false, "min-w-0 flex-1 px-3");
  if (!logado) return <Link href={entrarHref} className={classe}><MessageSquare className="size-5" aria-hidden /> Conversar</Link>;
  return <button type="button" className={classe} disabled={pendente || abrindo} aria-busy={pendente || abrindo}
    onClick={() => iniciar(async () => {
      try {
        const r = await abrirConversaAnuncio(anuncioId);
        if (r.ok) { setAbrindo(true); router.push(linkConversa(r.dados.id)); return; }
        if (r.erro.codigo === "28000") router.push(entrarHref);
        else onErro(r.erro.mensagem);
      } catch { onErro("Não foi possível abrir a conversa. Tente novamente."); }
    })}>
    <MessageSquare className="size-5" aria-hidden /> {pendente || abrindo ? "Abrindo..." : "Conversar"}
  </button>;
}
