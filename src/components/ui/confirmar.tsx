"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Botao } from "@/components/ui/botao";

// Confirmação em janela própria, no lugar do window.confirm do navegador.
// Uso: const confirmar = useConfirmar(); if (await confirmar({ titulo: "Apagar?" })) ...
export type PedidoConfirmacao = {
  titulo: string;
  texto?: ReactNode;
  /** Texto do botão que confirma. Padrão: "Confirmar". */
  acao?: string;
  /** Ação que apaga ou não tem volta: botão vermelho. */
  perigo?: boolean;
};
type Confirmar = (pedido: PedidoConfirmacao) => Promise<boolean>;

// Sem contexto de propósito: a janela fica montada uma vez no layout, ao lado do conteúdo.
// Embrulhar as páginas num componente de cliente faria o React serializar o que elas recebem.
let abrirJanela: Confirmar | null = null;

/** Monte uma vez por layout (ex.: no painel). É ela que mostra as perguntas do useConfirmar. */
export function JanelaConfirmar() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const [aberto, setAberto] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const responder = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAberto(false);
  }, []);

  useEffect(() => {
    const abrir: Confirmar = (novo) => {
      resolver.current?.(false);
      setPedido(novo);
      setAberto(true);
      return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    };
    abrirJanela = abrir;
    return () => {
      if (abrirJanela === abrir) abrirJanela = null;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => { if (!abrir) responder(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
          {pedido?.texto && <AlertDialogDescription>{pedido.texto}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Botao variante="secundario" onClick={() => responder(false)}>Cancelar</Botao>
          <Botao variante={pedido?.perigo ? "perigo" : "primario"} onClick={() => responder(true)}>{pedido?.acao ?? "Confirmar"}</Botao>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Se a janela não estiver montada, cai na pergunta do navegador: nunca apaga sem perguntar.
const confirmar: Confirmar = (pedido) =>
  abrirJanela ? abrirJanela(pedido) : Promise.resolve(window.confirm(pedido.titulo));

export function useConfirmar(): Confirmar {
  return confirmar;
}

/**
 * onSubmit que pergunta antes de enviar. Segura o envio, abre a janela e, com o "sim",
 * reenvia o mesmo formulário (com o mesmo botão). `depois` roda no envio confirmado
 * (ex.: enviarSemLimpar); sem ele, vale o `action` do próprio <form>.
 */
export function confirmarAntes(
  confirmar: Confirmar,
  pedido: PedidoConfirmacao | (() => PedidoConfirmacao | null),
  depois?: (e: FormEvent<HTMLFormElement>) => void,
) {
  return (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    if (form.dataset.confirmado === "1") {
      delete form.dataset.confirmado;
      depois?.(e);
      return;
    }
    const p = typeof pedido === "function" ? pedido() : pedido;
    if (!p) { depois?.(e); return; }
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    void confirmar(p).then((ok) => {
      if (!ok || !form.isConnected) return;
      form.dataset.confirmado = "1";
      form.requestSubmit(submitter);
    });
  };
}
