"use client";

import { ChevronLeft } from "lucide-react";

export function Voltar() {
  function voltar() {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }

  return <button type="button" onClick={voltar} className="olaki-controle -ml-2 inline-flex min-h-controle w-fit items-center gap-1 rounded-campo px-2 text-rotulo font-semibold text-texto-suave hover:text-texto focus-visible:outline-3 focus-visible:outline-laranja-escuro">
    <ChevronLeft className="size-5" aria-hidden /> Voltar
  </button>;
}
