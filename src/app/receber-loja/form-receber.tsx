"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { Aviso } from "@/components/conta/aviso";
import { aceitarLoja, terminarRecebimento } from "./actions";

const CAIXA =
  "flex min-h-10 cursor-pointer items-center gap-3 rounded-card border border-borda bg-cartao px-3 py-2 text-base font-semibold " +
  "text-beringela hover:bg-fundo has-[:checked]:border-beringela has-[:checked]:bg-selecao has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-laranja-escuro";

export function FormReceberLoja({ codigo }: { codigo: string }) {
  const [erro, acao, pendente] = useActionState(aceitarLoja.bind(null, codigo), null);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <label className={CAIXA}>
        <input type="checkbox" name="manter_equipe" className="size-6 shrink-0 accent-beringela" />
        Manter a equipe Mercado da Região como ajudante
      </label>
      <p className="text-sm text-texto-suave">Se marcar, a equipe continua ajudando nos produtos e na vitrine. Você pode remover depois em Minhas lojas.</p>
      <Botao type="submit" larguraTotal carregando={pendente} textoCarregando="Recebendo a loja...">Receber minha loja</Botao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </form>
  );
}

export function FormTerminarRecebimento({ loja }: { loja: string }) {
  const [erro, acao, pendente] = useActionState(terminarRecebimento.bind(null, loja), null);
  return (
    <form action={acao} className="flex flex-col gap-2">
      <Botao type="submit" carregando={pendente} textoCarregando="Terminando..." className="sm:w-fit">Terminar de receber a loja</Botao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </form>
  );
}
