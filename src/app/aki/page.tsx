import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { ConversaAtendimento } from "@/components/atendimento/conversa";
import { BalaoAki } from "@/components/aki/balao-aki";
import { Botao } from "@/components/ui/botao";
import { caminhoInterno } from "@/lib/caminho-seguro";
import { atendimentoCadastro } from "@/lib/dados/atendimento";
import { createClient } from "@/lib/supabase/server";

// T39 · Aki em tela cheia. É a mesma conversa do balão (mesmo componente, mesma API /api/aki,
// mesmas regras e limites do painel), só que ocupando a tela. Fica fora do layout público para o
// campo de escrever ficar embaixo, sem a barra de navegação por cima; a seta do topo volta ao Início.

export const metadata: Metadata = {
  title: "Aki, o ajudante do Mercado da Região",
  description: "Converse com o Aki: ele ajuda a achar coisas à venda na região e a montar seu anúncio.",
  alternates: { canonical: "/aki" },
};

export default async function PaginaAki({ searchParams }: {
  searchParams: Promise<{ ajuda?: string | string[]; voltar?: string | string[]; atendimento?: string; antes?: string }>;
}) {
  const { ajuda, voltar, atendimento, antes } = await searchParams;
  if (ajuda !== "whatsapp") return <main className="min-h-dvh bg-fundo"><BalaoAki modo="pagina" /></main>;

  const caminho = typeof voltar === "string" ? caminhoInterno(voltar) : null;
  const retorno = caminho?.startsWith("/confirmar-celular?") ? caminho : "/confirmar-celular";
  const parametros = new URLSearchParams({ ajuda, voltar: retorno });
  const chat = `/aki?${parametros}`;
  parametros.set("atendimento", "1");
  const equipe = `/aki?${parametros}`;
  const { userId } = await auth();
  const conversa = userId ? await atendimentoCadastro(await createClient(), { dono: userId }) : null;
  if (atendimento === "1" && (conversa?.data || conversa?.error)) {
    return <main className="mx-auto min-h-dvh w-full max-w-xl flex flex-col gap-5 bg-fundo p-4">
      <Botao href={chat} variante="texto">Voltar ao Aki</Botao>
      <h1 className="text-xl font-semibold">Atendimento com a equipe</h1>
      {conversa.data ? <>
        <p role="status">{conversa.data.aguarda_equipe ? "Aguardando resposta da equipe." : "A equipe respondeu."}</p>
        <ConversaAtendimento id={conversa.data.id} caminho={equipe} antes={antes} aki={false} cadastro />
      </> : <p role="alert">Não foi possível carregar o atendimento. Atualize a página.</p>}
    </main>;
  }
  return (
    <main className="min-h-dvh bg-fundo">
      <BalaoAki modo="pagina" voltarDaAjuda={retorno} atendimentoHref={equipe} atendimentoAberto={!!conversa?.data} />
    </main>
  );
}
