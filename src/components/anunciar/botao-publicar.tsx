"use client";

import { useActionState } from "react";
import { Send, Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { publicarAnuncio } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import { BarraContinuar } from "./barra-continuar";
import { passoDoCampo, urlPasso, type EstadoForm } from "./passos";
import { LINK_PLANOS } from "@/lib/rotas";

// Botão final do Revisar: "Publicar anúncio" (rascunho), "Publicar de novo" (pausado/expirado)
// ou "Salvar alterações" (anúncio que já está no ar). O erro do banco aponta o passo para corrigir.
export function BotaoPublicar({
  id,
  editar,
  formId,
  modo,
}: {
  id: string;
  editar: boolean;
  formId: string;
  modo: "publicar" | "republicar" | "salvar";
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(publicarAnuncio, null);
  const passo = passoDoCampo(estado?.erro?.campo);
  const limite = estado?.erro?.codigo === "P0001";
  const link = passo
    ? { href: urlPasso(passo, id, editar), texto: "Corrigir agora" }
    : limite
      ? { href: LINK_PLANOS, texto: "Ver planos" }
      : null;

  const texto = modo === "salvar" ? "Salvar alterações" : modo === "republicar" ? "Publicar de novo" : "Publicar anúncio";

  return (
    <form id={formId} action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="editar" value={editar ? "1" : ""} />
      <AvisoErro mensagem={estado?.erro?.mensagem} link={link} />
      <BarraContinuar aviso={modo === "salvar" ? "As mudanças de cada passo já foram salvas." : undefined}>
        <Botao
          type="submit"
          larguraTotal
         
          carregando={enviando}
          textoCarregando={modo === "salvar" ? "Salvando..." : "Publicando..."}
          icone={modo === "salvar" ? <Save /> : <Send />}
        >
          {texto}
        </Botao>
      </BarraContinuar>
    </form>
  );
}
