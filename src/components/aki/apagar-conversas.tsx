"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { apagarMinhasConversas } from "@/lib/aki/acoes";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Privacidade (LGPD): apagar o histórico com o Merc, com confirmação antes.
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
  return (
    <>
      <Botao variante="perigo" larguraTotal icone={<Trash2 />} onClick={() => { setResultado(null); setConfirmar(true); }}>
        Apagar minhas conversas com o Merc
      </Botao>
      <AlertDialog open={confirmar} onOpenChange={(abrir) => { if (!abrir && !apagando) setConfirmar(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todas as conversas com o Merc?</AlertDialogTitle>
            <AlertDialogDescription>Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          {resultado && !resultado.ok && <Alert variant="destructive">{resultado.texto}</Alert>}
          <AlertDialogFooter>
            <Botao variante="secundario" disabled={apagando} onClick={() => setConfirmar(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              carregando={apagando}
              textoCarregando="Apagando…"
              onClick={async () => {
                setApagando(true);
                const r = await apagarMinhasConversas().catch(() => null);
                setApagando(false);
                if (r?.ok) {
                  setConfirmar(false);
                  setResultado({ ok: true, texto: r.mensagem });
                  router.refresh();
                } else setResultado({ ok: false, texto: r && !r.ok ? r.erro : "Não deu para apagar agora. Tente de novo." });
              }}
            >
              Sim, apagar
            </Botao>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
