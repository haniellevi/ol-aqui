"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/botao";
import { useConfirmar } from "@/components/ui/confirmar";
import { descartarLojaIa, sairDaLoja } from "@/app/(conta)/minha-conta/lojas/autosservico-actions";
import { Aviso } from "./aviso";

export function EncerrarAcesso({ id, revisao }: { id: string; revisao?: number }) {
  const confirmar = useConfirmar();
  const router = useRouter();
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);
  const rascunho = revisao !== undefined;
  const acao = rascunho ? "Descartar rascunho" : "Sair desta loja";
  if (feito) return <Aviso tipo="ok">{rascunho ? "Rascunho descartado. Você pode começar outro." : "Você saiu da equipe desta loja."}</Aviso>;
  async function executar() {
    if (trava.current) return;
    trava.current = true;
    try {
      if (!await confirmar({ titulo: `${acao}?`, texto: rascunho
        ? "As informações e imagens deste rascunho serão apagadas. Você pode começar outro depois."
        : "Você perderá o acesso a esta loja. Os anúncios e o acesso das outras pessoas continuam. Para voltar, peça um novo convite ao dono.", acao, perigo: true })) return;
      setOcupado(true);
      setErro("");
      const resultado = rascunho ? await descartarLojaIa(id, revisao!) : await sairDaLoja(id);
      if (resultado.erro) setErro(resultado.erro);
      else { setFeito(true); router.refresh(); }
    } catch { setErro("Não foi possível concluir. Tente novamente."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <div className="flex flex-col gap-2">
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    <Botao variante="perigo" carregando={ocupado} textoCarregando="Aguarde..." onClick={executar}>{acao}</Botao>
  </div>;
}
