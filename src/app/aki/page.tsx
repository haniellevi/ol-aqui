import type { Metadata } from "next";
import { BalaoAki } from "@/components/aki/balao-aki";
import { caminhoInterno } from "@/lib/caminho-seguro";

// T39 · Aki em tela cheia. É a mesma conversa do balão (mesmo componente, mesma API /api/aki,
// mesmas regras e limites do painel), só que ocupando a tela. Fica fora do layout público para o
// campo de escrever ficar embaixo, sem a barra de navegação por cima; a seta do topo volta ao Início.

export const metadata: Metadata = {
  title: "Aki, o ajudante do OLAKI",
  description: "Converse com o Aki: ele ajuda a achar coisas à venda na região e a montar seu anúncio.",
  alternates: { canonical: "/aki" },
};

export default async function PaginaAki({ searchParams }: { searchParams: Promise<{ ajuda?: string | string[]; voltar?: string | string[] }> }) {
  const { ajuda, voltar } = await searchParams;
  const caminho = typeof voltar === "string" ? caminhoInterno(voltar) : null;
  const retorno = caminho?.startsWith("/confirmar-celular?") ? caminho : "/confirmar-celular";
  return (
    <main className="min-h-dvh bg-fundo">
      <BalaoAki modo="pagina" voltarDaAjuda={ajuda === "whatsapp" ? retorno : undefined} />
    </main>
  );
}
