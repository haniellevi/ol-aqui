import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { lerHistorico } from "@/lib/dados/historico";
import { ehUuid } from "@/lib/formato";
import { linkHistoricoAnuncio } from "@/lib/rotas";
import { ListaHistorico } from "@/components/conta/lista-historico";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Histórico do anúncio" };
export const dynamic = "force-dynamic";

// Etapa P5a: quem mexeu no anúncio e quando (dono, ajudante ou Equipe Mercado da Região). Só o dono vê.
export default async function HistoricoAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { userId } = await auth();
  if (!userId) redirect(`/entrar?redirect_url=${encodeURIComponent(linkHistoricoAnuncio(id))}`);
  const anuncio = await meuAnuncio(id);
  if (!anuncio) notFound();
  const linhas = await lerHistorico({ anuncio: id });
  if (!linhas) notFound();
  const titulo = anuncio.titulo?.trim() || "Anúncio sem título";
  return (
    <PaginaConta>
      <TopoConta titulo="Histórico do anúncio" texto={titulo} voltar="/minha-conta/anuncios" textoVoltar="Meus anúncios" />
      <ListaHistorico linhas={linhas} vazio="As mudanças aparecem aqui depois que o anúncio for publicado." />
    </PaginaConta>
  );
}
