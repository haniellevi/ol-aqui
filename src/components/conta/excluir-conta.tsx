"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { excluirConta, type EstadoExcluir } from "@/app/(conta)/minha-conta/privacidade/actions";
import { Aviso } from "./aviso";

const PALAVRA = "EXCLUIR";

// LGPD · Excluir minha conta: confirmação forte (escrever EXCLUIR) e depois sai da conta.
export function ExcluirConta({ temPagamentos }: { temPagamentos: boolean }) {
  const { signOut } = useClerk();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, acao, enviando] = useActionState<EstadoExcluir, FormData>(excluirConta, null);
  const campo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!estado?.ok) return;
    // A conta já foi apagada no Clerk: encerra a sessão neste aparelho e volta para o início.
    signOut({ redirectUrl: "/" }).catch(() => {
      window.location.assign("/");
    });
  }, [estado, signOut]);

  useEffect(() => {
    if (aberto) campo.current?.querySelector("input")?.focus();
  }, [aberto]);

  if (estado?.ok) {
    return <Aviso tipo="ok">Seu acesso foi encerrado. A exclusão dos dados será processada. Saindo...</Aviso>;
  }

  if (!aberto) {
    return (
      <Botao variante="perigo" larguraTotal icone={<Trash2 />} onClick={() => setAberto(true)}>
        Excluir minha conta
      </Botao>
    );
  }

  const confere = texto.trim().toUpperCase() === PALAVRA;
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border-2 border-perigo bg-perigo-fundo p-4">
      <h3 className="text-lg font-bold text-perigo">Tem certeza?</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
        <li>Seus anúncios saem do ar e sua loja fecha.</li>
        <li>A exclusão dos dados é processada após o encerramento do acesso.</li>
        {temPagamentos && <li>Registros financeiros e de segurança podem ser mantidos conforme a política de privacidade.</li>}
        <li>Não dá para desfazer.</li>
      </ul>
      <div ref={campo}>
        <Campo
          rotulo={`Para confirmar, escreva ${PALAVRA}`}
          name="confirmacao"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          erro={estado?.erro}
        />
      </div>
      <Botao type="submit" variante="perigo" larguraTotal icone={<Trash2 />} disabled={!confere} carregando={enviando} textoCarregando="Excluindo...">
        Excluir minha conta para sempre
      </Botao>
      <Botao variante="secundario" larguraTotal disabled={enviando} onClick={() => { setAberto(false); setTexto(""); }}>
        Não, manter minha conta
      </Botao>
    </form>
  );
}
