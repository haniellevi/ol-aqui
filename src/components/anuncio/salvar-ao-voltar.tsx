"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { alternarFavorito } from "@/app/(anuncio-publico)/anuncio/[idslug]/actions";
import { ehUuid } from "@/lib/formato";
import { avisarFavorito } from "@/components/anuncio/coracao-card";
import { lerPendente, limparPendente } from "@/lib/salvar-pendente";

// Volta do "Entrar para salvar": o Início chega com ?salvar=<id> ou, se o endereço se perdeu
// no login, com o pedido guardado no aparelho. Salva o anúncio uma vez, limpa o pedido e o
// parâmetro do endereço e avisa o resultado. Sem login, não faz nada (o pedido espera).
export function SalvarAoVoltar({ logado }: { logado: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const feito = useRef(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const doEndereco = params.get("salvar");

  useEffect(() => {
    if (!logado || feito.current) return;
    const id = doEndereco ?? lerPendente();
    if (!id) return;
    feito.current = true;
    limparPendente();
    const limpar = () => {
      if (!doEndereco) return;
      const resto = new URLSearchParams(params.toString());
      resto.delete("salvar");
      router.replace(resto.size ? `${caminho}?${resto}` : caminho, { scroll: false });
    };
    if (!ehUuid(id)) return limpar();
    alternarFavorito(id, true)
      .then((r) => {
        if (r.ok) avisarFavorito(id, r.dados.favorito);
        setAviso(r.ok ? { texto: "Pronto: o anúncio ficou salvo nos seus favoritos.", erro: false } : { texto: r.erro.mensagem, erro: true });
      })
      .catch(() => setAviso({ texto: "Não conseguimos salvar o favorito. Tente pelo coração do anúncio.", erro: true }))
      .finally(limpar); // trocar o endereço já busca a página de novo (corações vêm salvos)
  }, [logado, doEndereco, params, router, caminho]);

  useEffect(() => {
    if (!aviso || aviso.erro) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;
  return (
    <p role={aviso.erro ? "alert" : "status"} className={`rounded-card px-4 py-3 text-sm font-semibold ${aviso.erro ? "bg-perigo-fundo text-perigo" : "bg-sucesso-fundo text-verde-escuro"}`}>
      {aviso.texto}
    </p>
  );
}
