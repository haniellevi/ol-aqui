import { notFound } from "next/navigation";
import { Aviso, Titulo } from "@/components/admin/ui";
import { ConversaAtendimento } from "@/components/atendimento/conversa";
import { Botao } from "@/components/ui/botao";
import { exigirTela } from "@/lib/admin/equipe";
import { atendimentoCadastro } from "@/lib/dados/atendimento";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_ATENDIMENTOS } from "@/lib/rotas";

export const metadata = { title: "Atendimento de confirmação do WhatsApp" };

export default async function ConversaCadastroAdmin({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ antes?: string }>;
}) {
  const { supabase } = await exigirTela("anuncios");
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data, error } = await atendimentoCadastro(supabase, { id });
  if (error) return <Aviso tipo="erro">Não foi possível carregar a conversa. Atualize a página.</Aviso>;
  if (!data) notFound();
  const { antes } = await searchParams;

  return <div className="space-y-4">
    <Botao href={LINK_ADMIN_ATENDIMENTOS} variante="texto" prefetch={false}>Voltar aos atendimentos</Botao>
    <Titulo sub={data.aguarda_equipe ? "Aguardando resposta da equipe." : "A equipe já respondeu."}>Confirmação do WhatsApp</Titulo>
    <ConversaAtendimento id={id} caminho={`${LINK_ADMIN_ATENDIMENTOS}/${id}`} antes={antes} equipe aki={false} cadastro />
  </div>;
}
