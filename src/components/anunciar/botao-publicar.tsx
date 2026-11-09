"use client";

import { Send, Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { publicarAnuncio } from "@/app/(conta)/anunciar/actions";
import { useEnvioAnuncio } from "./enviar";
import { AvisoErro } from "./aviso-erro";
import { BarraContinuar } from "./barra-continuar";
import { passoDoCampo, urlPasso } from "./passos";
import { LINK_PLANOS } from "@/lib/rotas";

// Botão final do Revisar: "Publicar anúncio" (rascunho), "Publicar de novo" (pausado/expirado)
// ou "Salvar alterações" (anúncio que já está no ar). O erro do banco aponta o passo para corrigir.
export function BotaoPublicar({
  id,
  editar,
  formId,
  modo,
  linkAvulso,
}: {
  id: string;
  editar: boolean;
  formId: string;
  modo: "publicar" | "republicar" | "salvar";
  /** Pessoa física no limite com avulso ligado: o aviso de limite oferece "Pagar anúncio avulso". */
  linkAvulso?: string | null;
}) {
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(publicarAnuncio);
  const passo = passoDoCampo(estado?.erro?.campo);
  const limite = estado?.erro?.codigo === "P0001";
  const link = passo
    ? { href: urlPasso(passo, id, editar), texto: "Corrigir agora" }
    : limite
      ? linkAvulso
        ? { href: linkAvulso, texto: "Pagar anúncio avulso" }
        : { href: LINK_PLANOS, texto: "Ver planos" }
      : null;

  const texto = modo === "salvar" ? "Salvar alterações" : modo === "republicar" ? "Publicar de novo" : "Publicar anúncio";

  return (
    <form id={formId} action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col gap-3">
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
