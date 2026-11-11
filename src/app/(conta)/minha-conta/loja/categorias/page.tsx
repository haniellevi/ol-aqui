import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles, Store } from "lucide-react";
import { minhaVitrineCompleta, vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { minhaSugestaoNicho, minhasSugestoesCategoria, nichosDisponiveis } from "@/lib/dados/categorias-ia";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { Aviso } from "@/components/conta/aviso";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { EscolherNicho, RevisarCategorias } from "@/components/conta/revisar-categorias";

export const metadata: Metadata = { title: "Revise suas categorias" };
export const dynamic = "force-dynamic";

// Vitrine com IA, etapa 4: a IA sugere o nicho da loja e a categoria dos produtos; o lojista confirma.
// Só aparece com a vitrine nova ligada (vitrine_ia.ativa).
export default async function PaginaCategoriasLoja() {
  const v = await minhaVitrineCompleta();
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Revise suas categorias" />
        <Vazio titulo="Você ainda não tem uma loja" texto="Abra sua loja para organizar seus produtos.">
          <Botao href="/quero-vender/loja" larguraTotal>Abrir minha loja</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  if (!(await vitrineNovaAtiva(v.microrregiao_id).catch(() => false))) notFound();
  const [sugestoes, nicho, nichos] = await Promise.all([minhasSugestoesCategoria(v.id), minhaSugestaoNicho(v.id), nichosDisponiveis()]);

  return (
    <PaginaConta>
      <TopoConta
        titulo="Revise suas categorias"
        texto="A IA olha seus produtos e sugere onde cada um fica melhor. Nada muda sem o seu toque."
        voltar={LINK_MINHA_LOJA}
        textoVoltar="Minha loja"
      />
      <section aria-labelledby="titulo-nicho" className="flex flex-col gap-3">
        <h2 id="titulo-nicho" className="flex items-center gap-2 text-lg font-bold">
          <Store className="size-5 text-laranja-escuro" aria-hidden />
          Nicho da loja
        </h2>
        {nicho ? <EscolherNicho sugestao={nicho} nichos={nichos} /> : (
          <Aviso tipo="atencao">Não conseguimos carregar o nicho agora. Atualize a página.</Aviso>
        )}
      </section>
      <section aria-labelledby="titulo-sugestoes" className="flex flex-col gap-3">
        <h2 id="titulo-sugestoes" className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
          Categorias dos produtos
        </h2>
        {sugestoes === null ? (
          <Aviso tipo="atencao">Não conseguimos carregar as sugestões agora. Atualize a página.</Aviso>
        ) : sugestoes.length === 0 ? (
          <Vazio titulo="Tudo organizado" texto="Não há sugestões para revisar. Quando você cadastrar produtos novos, a IA confere a categoria e avisa aqui." icone={<Sparkles />} />
        ) : (
          <RevisarCategorias itens={sugestoes} />
        )}
      </section>
    </PaginaConta>
  );
}
