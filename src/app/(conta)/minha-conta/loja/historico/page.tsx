import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { minhaVitrineCompleta } from "@/lib/dados/vitrine-completa";
import { lerHistorico } from "@/lib/dados/historico";
import { LINK_LOJA_HISTORICO, LINK_MINHA_LOJA } from "@/lib/rotas";
import { ListaHistorico } from "@/components/conta/lista-historico";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Histórico da loja" };
export const dynamic = "force-dynamic";

// Etapa P5a: quem mexeu nos dados da loja e quando. O dono vê; na P5b-2b, o ajudante também (o banco confere).
export default async function HistoricoLojaPage() {
  const { userId } = await auth();
  if (!userId) redirect(`/entrar?redirect_url=${encodeURIComponent(LINK_LOJA_HISTORICO)}`);
  const v = await minhaVitrineCompleta();
  if (!v) notFound();
  const linhas = await lerHistorico({ loja: v.id });
  if (!linhas) notFound();
  return (
    <PaginaConta>
      <TopoConta titulo="Histórico da loja" texto="Quem mudou nome, textos, fotos, contato ou endereço da loja." voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
      <ListaHistorico linhas={linhas} vazio="Quando alguém mudar os dados da loja, a mudança aparece aqui." />
    </PaginaConta>
  );
}
