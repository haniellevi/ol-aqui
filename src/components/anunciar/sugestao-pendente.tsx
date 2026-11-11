"use client";

import { Tags } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { cancelarSugestaoCategoria } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { useEnvioAnuncio } from "./enviar";

// Mostra a sugestão de categoria que a equipe ainda não decidiu, com o botão para cancelar.
export function SugestaoPendente({ id, editar, texto }: { id: string; editar: boolean; texto: string }) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(cancelarSugestaoCategoria);
  if (estado?.ok) return null;
  return (
    <section aria-labelledby="sugestao-pendente" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-3">
      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <form action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="editar" value={editar ? "1" : ""} />
        <p id="sugestao-pendente" className="flex items-start gap-2 text-base">
          <Tags className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <span>Você sugeriu “{texto}”. A equipe vai analisar.</span>
        </p>
        <Botao type="submit" variante="texto" carregando={enviando} textoCarregando="Cancelando...">
          Cancelar sugestão
        </Botao>
      </form>
    </section>
  );
}
