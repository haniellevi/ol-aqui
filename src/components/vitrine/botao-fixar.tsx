"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pin, PinOff } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { fixarNaLoja, moverFixado } from "@/app/(conta)/minha-conta/loja/vitrine-actions";
import type { Resultado } from "@/lib/tipos";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Fixar/tirar do topo da loja (Meus anúncios e Produtos no topo). O limite do plano é do banco:
// se passar, a mensagem dele aparece aqui embaixo.
export function BotaoFixar({ anuncioId, fixado, className = "", comoItemDeMenu = false }: { anuncioId: string; fixado: boolean; className?: string; comoItemDeMenu?: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await fixarNaLoja(anuncioId, !fixado);
      if (!r.ok) setErro(r.erro.mensagem);
      else router.refresh();
    });
  }

  if (comoItemDeMenu) {
    return (
      <>
        <DropdownMenuItem onClick={alternar} disabled={pendente} closeOnClick={false} aria-busy={pendente || undefined}>
          {fixado ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          {pendente ? (fixado ? "Tirando..." : "Fixando...") : fixado ? "Tirar do topo da loja" : "Fixar no topo da loja"}
        </DropdownMenuItem>
        {erro && <p role="alert" className="max-w-56 px-3 pb-1 text-legenda text-perigo">{erro}</p>}
      </>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Botao
        variante="secundario"
        icone={fixado ? <PinOff /> : <Pin />}
        className="px-3"
        carregando={pendente}
        textoCarregando={fixado ? "Tirando..." : "Fixando..."}
        onClick={alternar}
      >
        {fixado ? "Tirar do topo da loja" : "Fixar no topo da loja"}
      </Botao>
      <div aria-live="polite">
        {erro && (
          <p role="alert" className="text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

/** Subir/descer um produto fixado. */
export function MoverFixado({ anuncioId, titulo, primeiro, ultimo }: { anuncioId: string; titulo: string; primeiro: boolean; ultimo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [emCurso, setEmCurso] = useState<"subir" | "descer" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function mover(d: "subir" | "descer") {
    setErro(null);
    setEmCurso(d);
    iniciar(async () => {
      const r: Resultado = await moverFixado(anuncioId, d);
      if (!r.ok) setErro(r.erro.mensagem);
      else router.refresh();
      setEmCurso(null);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" icone={<ArrowUp />} className="px-3" aria-label={`Subir ${titulo}`} disabled={pendente || primeiro} carregando={emCurso === "subir"} onClick={() => mover("subir")}>
          Subir
        </Botao>
        <Botao variante="secundario" icone={<ArrowDown />} className="px-3" aria-label={`Descer ${titulo}`} disabled={pendente || ultimo} carregando={emCurso === "descer"} onClick={() => mover("descer")}>
          Descer
        </Botao>
      </div>
      {erro && (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}
