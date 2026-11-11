"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarPerfilClerk } from "@/app/(conta)/minha-conta/dados/actions";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "./aviso";

export function ConcluirDadosClerk() {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const trava = useRef(false);
  const router = useRouter();
  return <div className="flex flex-col gap-3">
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    <Botao carregando={pendente} textoCarregando="Atualizando..." larguraTotal onClick={() => {
      if (trava.current) return;
      trava.current = true; setErro(null);
      iniciar(async () => {
        try {
          const r = await atualizarPerfilClerk();
          if (!r?.ok) { setErro(r?.erro ?? "Não conseguimos atualizar seus dados. Tente novamente."); return; }
          router.push(r.whatsappVinculado ? "/confirmar-celular?aviso=numero_vinculado" : "/minha-conta/dados");
          router.refresh();
        } catch { setErro("A conexão falhou. Tente concluir novamente para atualizar o Mercado da Região."); }
        finally { trava.current = false; }
      });
    }}>Concluir e voltar ao perfil</Botao>
  </div>;
}
