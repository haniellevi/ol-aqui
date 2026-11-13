import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { ListaConversas } from "@/components/conversas/lista-conversas";
import { conversasLigadas, minhasConversas } from "@/lib/dados/conversas";

export const metadata: Metadata = { title: "Conversas" };
export const dynamic = "force-dynamic";

export default async function PaginaConversas() {
  if (!(await conversasLigadas())) notFound();
  const conversas = await minhasConversas();
  const novas = conversas.filter((c) => c.nao_lidas > 0).length;
  return <PaginaConta>
    <TopoConta titulo="Conversas" texto={novas > 0 ? `${novas} ${novas === 1 ? "conversa com mensagem nova" : "conversas com mensagem nova"}` : "Suas conversas com lojas e clientes."} />
    {conversas.length === 0
      ? <Vazio tamanho="grande" titulo="Nenhuma conversa ainda." icone={<MessageSquare />}
          texto="Toque em Conversar num anúncio para falar com quem vende. Quando uma loja responder seu pedido no Radar, a conversa aparece aqui." />
      : <ListaConversas conversas={conversas} />}
  </PaginaConta>;
}
