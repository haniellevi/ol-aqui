"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { apagarMinhasConversas } from "@/lib/aki/acoes";
import { Alert } from "@/components/ui/alert";

// Privacidade (LGPD): apagar o histórico com o Aki, com confirmação antes.
export function ApagarConversasAki() {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  if (resultado?.ok) {
    return (
      <Alert variant="success" role="status">
        {resultado.texto}
      </Alert>
    );
  }
  if (!confirmar) {
    return (
      <Botao variante="perigo" larguraTotal icone={<Trash2 />} onClick={() => setConfirmar(true)}>
        Apagar minhas conversas com o Aki
      </Botao>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirmar" className="space-y-3 rounded-card bg-perigo-fundo p-4">
      <p className="text-base text-perigo">Apagar todas as conversas com o Aki? Não dá para desfazer.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Botao
          variante="perigo"
          carregando={apagando}
          textoCarregando="Apagando…"
          onClick={async () => {
            setApagando(true);
            const r = await apagarMinhasConversas().catch(() => null);
            setApagando(false);
            if (r?.ok) {
              setResultado({ ok: true, texto: r.mensagem });
              router.refresh();
            } else setResultado({ ok: false, texto: r && !r.ok ? r.erro : "Não deu para apagar agora. Tente de novo." });
          }}
        >
          Sim, apagar
        </Botao>
        <Botao variante="secundario" disabled={apagando} onClick={() => setConfirmar(false)}>
          Cancelar
        </Botao>
      </div>
      {resultado && !resultado.ok && (
        <p role="alert" className="text-sm text-perigo">
          {resultado.texto}
        </p>
      )}
    </div>
  );
}
