import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { ehUuid } from "@/lib/formato";
import { meusAnunciosParaVitrine, minhaVitrineCompleta, minhasSecoes, opcoesVitrine } from "@/lib/dados/vitrine-completa";
import { LINK_LOJA_SECOES } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { EscolherProdutos } from "@/components/vitrine/escolher-produtos";

export const metadata: Metadata = { title: "Produtos da seção" };

// Escolher os produtos de uma seção própria. Só os anúncios da própria loja (o banco confere).
export default async function PaginaProdutosSecao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") notFound();
  const [secoes, anuncios, opcoes] = await Promise.all([minhasSecoes(v.id), meusAnunciosParaVitrine(v.id), opcoesVitrine(v.microrregiao_id)]);
  const secao = secoes.find((s) => s.id === id);
  if (!secao) notFound();

  return (
    <PaginaConta>
      <TopoConta titulo={secao.nome} texto="Marque os produtos que entram nesta seção." voltar={LINK_LOJA_SECOES} textoVoltar="Seções da loja" />
      {anuncios.length === 0 ? (
        <Vazio icone={<Package />} titulo="Você ainda não tem anúncios no ar" texto="Ponha um anúncio no ar e depois volte aqui para colocar na seção.">
          <Botao href="/anunciar" larguraTotal icone={<Plus />}>
            Criar anúncio
          </Botao>
        </Vazio>
      ) : (
        <EscolherProdutos secaoId={secao.id} anuncios={anuncios} escolhidos={secao.anuncios} maximo={opcoes.anunciosPorSecao} />
      )}
    </PaginaConta>
  );
}
