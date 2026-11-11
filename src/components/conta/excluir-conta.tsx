"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { excluirConta, type EstadoExcluir } from "@/app/(conta)/minha-conta/privacidade/actions";
import { Aviso } from "./aviso";

const PALAVRA = "EXCLUIR";

function dataCurta(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Fortaleza" })
    : "30 dias";
}

// LGPD · Excluir minha conta: confirmação forte (escrever EXCLUIR) e depois sai da conta.
export function ExcluirConta({ temPagamentos }: { temPagamentos: boolean }) {
  const { signOut } = useClerk();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, acao, enviando] = useActionState<EstadoExcluir, FormData>(excluirConta, null);
  const campo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!estado?.ok) return;
    // A conta foi para a lixeira: encerra a sessão neste aparelho depois de mostrar o prazo.
    const t = setTimeout(() => {
      signOut({ redirectUrl: "/" }).catch(() => {
        window.location.assign("/");
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [estado, signOut]);

  useEffect(() => {
    if (aberto) campo.current?.querySelector("input")?.focus();
  }, [aberto]);

  if (estado?.ok) {
    return (
      <Aviso tipo="ok">
        Sua conta saiu do ar e será apagada em {dataCurta(estado.apagarApos)}. Se mudar de ideia, é só entrar de novo até lá.
        Saindo...
      </Aviso>
    );
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
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-perigo bg-perigo-fundo p-4">
      <h3 className="text-lg font-bold text-perigo">Tem certeza?</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
        <li>Sua conta, sua loja e seus anúncios saem do ar na hora.</li>
        <li>Tudo fica guardado por 30 dias. Para desistir, é só entrar de novo nesse prazo.</li>
        <li>Depois de 30 dias, seus dados são apagados de vez.</li>
        {temPagamentos && <li>Registros de pagamento ficam guardados pelo prazo da lei, sem seus dados pessoais.</li>}
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
        Excluir minha conta
      </Botao>
      <Botao variante="secundario" larguraTotal disabled={enviando} onClick={() => { setAberto(false); setTexto(""); }}>
        Não, manter minha conta
      </Botao>
    </form>
  );
}
