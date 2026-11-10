"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { useCampoTelefone } from "@/components/ui/use-campo-telefone";
import { Aviso } from "@/components/conta/aviso";
import { convidarGerente, revogarGerente } from "./actions";

export function FormConvidarGerente({ loja }: { loja: string }) {
  const [estado, acao, pendente] = useActionState(convidarGerente.bind(null, loja), null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [copiaManual, setCopiaManual] = useState<{ caminho: string; url: string } | null>(null);
  const telefone = useCampoTelefone("", { obrigatorio: true });
  const link = estado?.link;

  async function copiar(caminho: string) {
    const url = new URL(caminho, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(caminho);
    } catch {
      setCopiaManual({ caminho, url });
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
      <h2 className="text-lg font-semibold">Convidar gerente</h2>
      <p className="text-sm text-texto-suave">
        Informe o WhatsApp da pessoa e compartilhe o link com ela. O convite vale por sete dias e só pode ser aceito pela conta com esse número confirmado.
      </p>
      <form action={acao} className="flex flex-col gap-3">
        <Campo rotulo="WhatsApp da pessoa convidada" name="whatsapp" {...telefone.campo} erro={telefone.erro} />
        <Botao type="submit" carregando={pendente} disabled={!telefone.valido}>Gerar convite</Botao>
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
      {link && (
        <div className="flex flex-col gap-2">
          <Aviso tipo="ok">Convite criado. Copie o link agora para compartilhar.</Aviso>
          <Botao type="button" variante="secundario" onClick={() => copiar(link)}>
            {copiado === link ? "Link copiado" : "Copiar link do convite"}
          </Botao>
          {copiaManual?.caminho === link && (
            <Campo rotulo="Link do convite" name="link_convite" value={copiaManual.url} readOnly onFocus={(e) => e.currentTarget.select()} />
          )}
        </div>
      )}
    </section>
  );
}

export function FormRevogarGerente({ loja, convite, aceito }: { loja: string; convite: string; aceito: boolean }) {
  const [estado, acao, pendente] = useActionState(revogarGerente.bind(null, loja, convite), null);
  const [confirmando, setConfirmando] = useState(false);
  const rotulo = aceito ? "Remover acesso" : "Cancelar convite";
  if (!confirmando) return <Botao type="button" variante="texto" onClick={() => setConfirmando(true)}>{rotulo}</Botao>;
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <Botao type="submit" variante="perigo" carregando={pendente}>Confirmar {aceito ? "remoção" : "cancelamento"}</Botao>
      <Botao type="button" variante="texto" onClick={() => setConfirmando(false)} disabled={pendente}>Voltar</Botao>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </form>
  );
}
