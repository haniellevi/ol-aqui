"use client";

import { startTransition, type FormEvent } from "react";

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
