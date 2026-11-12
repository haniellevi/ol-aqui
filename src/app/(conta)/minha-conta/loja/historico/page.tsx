import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { lerHistorico } from "@/lib/dados/historico";
import { LINK_LOJA_HISTORICO, LINK_MINHA_LOJA } from "@/lib/rotas";
import { ListaHistorico } from "@/components/conta/lista-historico";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";

export const metadata: Metadata = { title: "Histórico da loja" };
export const dynamic = "force-dynamic";

// Etapa P5a: quem mexeu nos dados da loja e quando. Só o dono vê.
export default async function HistoricoLojaPage() {
  const conta = await meuPerfilEVitrine();
  if (!conta) redirect(`/entrar?redirect_url=${encodeURIComponent(LINK_LOJA_HISTORICO)}`);
  if (!conta.vitrine) notFound();
  const linhas = await lerHistorico({ loja: conta.vitrine.id });
  if (!linhas) notFound();
  return (
    <PaginaConta>
      <TopoConta titulo="Histórico da loja" texto="Quem mudou nome, textos, fotos, contato ou endereço da loja." voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
      <ListaHistorico linhas={linhas} vazio="Quando alguém mudar os dados da loja, a mudança aparece aqui." />
    </PaginaConta>
  );
}
