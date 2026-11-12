"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { novoRascunho } from "@/app/(conta)/anunciar/actions";
import { useEnvioAnuncio } from "./enviar";
import { AvisoErro } from "./aviso-erro";

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
  const chave = useRef<string | null>(null);
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(async () => {
    chave.current ??= crypto.randomUUID();
    return novoRascunho({ avulso, chave: chave.current });
  });
  return (
    <form action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col has-[[role=alert]]:gap-2">
      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <Botao type="submit" variante={variante} larguraTotal carregando={enviando} textoCarregando="Abrindo..." icone={<Plus />}>
        {texto}
      </Botao>
    </form>
  );
}
