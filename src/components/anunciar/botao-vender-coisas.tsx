"use client";

import { useActionState } from "react";
import { Package } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { queroVenderPf } from "@/app/(conta)/quero-vender/actions";
import { AvisoErro } from "./aviso-erro";
import type { EstadoForm } from "./passos";

// "Vender minhas coisas": liga a conta de vendedor e já abre o Anunciar.
export function BotaoVenderCoisas() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(async () => queroVenderPf(), null);
  return (
    <form action={acao} className="flex flex-col gap-2">
      <AvisoErro mensagem={estado?.erro?.mensagem} />
      <Botao type="submit" larguraTotal carregando={enviando} textoCarregando="Abrindo..." icone={<Package />}>
        Vender minhas coisas
      </Botao>
    </form>
  );
}
