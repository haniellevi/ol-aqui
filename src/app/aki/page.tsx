import type { Metadata } from "next";
import { BalaoAki } from "@/components/aki/balao-aki";

// T39 · Aki em tela cheia. É a mesma conversa do balão (mesmo componente, mesma API /api/aki,
// mesmas regras e limites do painel), só que ocupando a tela. Fica fora do layout público para o
// campo de escrever ficar embaixo, sem a barra de navegação por cima; a seta do topo volta ao Início.

export const metadata: Metadata = {
  title: "Aki, o ajudante do OLAKI",
  description: "Converse com o Aki: ele ajuda a achar coisas à venda na região e a montar seu anúncio.",
  alternates: { canonical: "/aki" },
};

export default function PaginaAki() {
  return (
    <main className="min-h-dvh bg-fundo">
      <BalaoAki modo="pagina" />
    </main>
  );
}
