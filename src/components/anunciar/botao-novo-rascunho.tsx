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
  assistente,
  sugestao,
}: {
  variante?: "primario" | "secundario";
  texto?: string;
  avulso?: boolean;
  assistente?: string;
  sugestao?: { vitrineId: string; titulo: string; categoriaId?: string };
}) {
  const chave = useRef<string | null>(null);
  const [estado, onSubmit, enviando, enviar] = useEnvioAnuncio(async (_antes, dados) => {
    chave.current ??= crypto.randomUUID();
    return novoRascunho({ avulso, chave: chave.current, assistente: assistente ?? String(dados.get("assistente") ?? ""), sugestao });
  });
  return (
    <form action={enviar} onSubmit={onSubmit} aria-busy={enviando} inert={enviando} className="flex flex-col has-[[role=alert]]:gap-2">
      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <Botao type="submit" variante={variante} tamanho="toque" larguraTotal carregando={enviando} textoCarregando="Abrindo..." icone={<Plus />}>
        {texto}
      </Botao>
    </form>
  );
}
