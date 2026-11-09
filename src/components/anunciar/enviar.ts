"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import type { EstadoForm } from "./passos";

/** Mantém os campos na tela e permite repetir uma ação cuja resposta se perdeu. */
export async function envioRecuperavel(acao: (antes: EstadoForm, dados: FormData) => Promise<EstadoForm>, antes: EstadoForm, dados: FormData): Promise<EstadoForm> {
  try {
    return await acao(antes, dados);
  } catch (erro) {
    unstable_rethrow(erro);
    return { erro: { mensagem: "Não conseguimos confirmar o salvamento. Seus dados continuam nesta tela. Confira a conexão e tente de novo." } };
  }
}

export function useEnvioAnuncio(acao: (antes: EstadoForm, dados: FormData) => Promise<EstadoForm>) {
  const ocupado = useRef(false);
  const formulario = useRef<HTMLFormElement | null>(null);
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(async (antes, dados) => {
    try { return await envioRecuperavel(acao, antes, dados); }
    finally { ocupado.current = false; }
  }, null);
  useEffect(() => {
    if (!estado?.erro) return;
    const alvo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formulario.current?.querySelector<HTMLElement>('[role="alert"]');
    alvo?.focus();
    alvo?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [estado]);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    formulario.current = e.currentTarget;
    aoEnviar(enviar)(e);
  }
  return [estado, onSubmit, enviando, enviar] as const;
}

/**
 * onSubmit que manda o formulário para a action do useActionState sem o React limpar os campos
 * depois (no erro, o que a pessoa digitou continua lá). Inclui o botão que enviou
 * (ex.: name="acao" value="sair" do "Salvar e sair", que fica fora do <form>).
 */
export function aoEnviar(acao: (dados: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const botao = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (botao?.name) dados.set(botao.name, botao.value);
    startTransition(() => acao(dados));
  };
}
