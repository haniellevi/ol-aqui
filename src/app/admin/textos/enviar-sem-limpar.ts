"use client";

import { startTransition, type FormEvent } from "react";

// O React 19 limpa os campos do <form action={...}> quando a ação termina, mesmo quando ela
// devolve { erro }. Aqui o envio vai pelo onSubmit: o que a pessoa digitou continua no lugar
// se der erro. O "pendente" do useActionState continua funcionando (sem envio duplo).
export function enviarSemLimpar(acao: (dados: FormData) => void, antes?: (e: FormEvent<HTMLFormElement>) => boolean) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (antes && !antes(e)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const dados = new FormData(e.currentTarget, submitter);
    startTransition(() => acao(dados));
  };
}
