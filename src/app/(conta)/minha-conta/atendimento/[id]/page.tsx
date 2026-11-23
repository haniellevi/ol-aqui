import { formatarNome } from "@/lib/formatar-nome";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ConversaAtendimento } from "@/components/atendimento/conversa";
import { Botao } from "@/components/ui/botao";
import { meuAtendimento } from "@/lib/dados/atendimento";
import { ehUuid } from "@/lib/formato";
import { LINK_ATENDIMENTO, linkAtendimento } from "@/lib/rotas";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Conversa privada" };

export default async function ConversaConta({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ antes?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/entrar");
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { antes } = await searchParams;
  const { data, error } = await meuAtendimento(await createClient(), id, userId);
  if (error) return <PaginaConta>
    <TopoConta titulo="Conversa privada" voltar={LINK_ATENDIMENTO} textoVoltar="Atendimento" />
    <Aviso tipo="erro">
      <span>Não foi possível carregar a conversa. Atualize a página.</span>
      <Botao href={linkAtendimento(id)} variante="secundario" tamanho="toque" className="w-fit">Tentar de novo</Botao>
    </Aviso>
  </PaginaConta>;
  if (!data) notFound();
  if (!data.anuncio_id) redirect("/aki?ajuda=whatsapp&atendimento=1");
  return <PaginaConta>
    <TopoConta titulo={formatarNome(data.anuncios?.titulo) || "Anúncio sem título"}
      texto={data.aguarda_equipe ? "Aguardando resposta da equipe do Mercado da Região." : "Atendimento do Mercado da Região"}
      voltar={LINK_ATENDIMENTO} textoVoltar="Atendimento" />
    <ConversaAtendimento id={id} caminho={linkAtendimento(id)} antes={antes} aki={data.aki_ativo} />
  </PaginaConta>;
}
