"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { novoRascunho } from "@/app/(conta)/anunciar/actions";
import { AvisoErro } from "./aviso-erro";
import type { EstadoForm } from "./passos";

// "Começar um anúncio novo": cria o rascunho no servidor e abre o passo 1.
// `avulso`: caminho do anúncio avulso na tela de limite (cria o rascunho mesmo no limite do plano).
export function BotaoNovoRascunho({
  variante = "primario",
  texto = "Começar um anúncio novo",
  avulso = false,
}: {
  variante?: "primario" | "secundario";
  texto?: string;
  avulso?: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(async () => novoRascunho({ avulso }), null);
  return (
    <form action={acao} className="flex flex-col gap-2">
      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <Botao type="submit" variante={variante} larguraTotal carregando={enviando} textoCarregando="Abrindo..." icone={<Plus />}>
        {texto}
      </Botao>
    </form>
  );
}
