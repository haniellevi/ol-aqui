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

// Revise suas categorias: as categorias sugeridas para os anúncios (loja ou pessoa física).
// Abre sempre que há sugestão pendente. Sem sugestão, só abre com a vitrine com IA ligada (vitrine_ia.ativa).
// O nicho da loja é da vitrine com IA e só aparece para loja.
export default async function PaginaCategoriasLoja() {
  const v = await minhaVitrineCompleta();
  // P5b-2b: o que usa a IA do plano fica com o dono da loja.
  if (v?.ajudante) notFound();
  if (!v) {
    return (
      <PaginaConta>
        <TopoConta titulo="Revise suas categorias" />
        <Vazio titulo="Você ainda não tem anúncios" texto="Publique um anúncio para ver as categorias sugeridas aqui.">
          <Botao href="/anunciar" larguraTotal>Anunciar</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const iaAtiva = await vitrineNovaAtiva(v.microrregiao_id).catch(() => false);
  const sugestoes = await minhasSugestoesCategoria(v.id);
  if (!iaAtiva && !sugestoes?.length) notFound();
  const loja = v.tipo === "loja";
  const [nicho, nichos] = loja && iaAtiva ? await Promise.all([minhaSugestaoNicho(v.id), nichosDisponiveis()]) : [undefined, []];

  return (
    <PaginaConta>
      <TopoConta
        titulo="Revise suas categorias"
        texto="Confira a categoria sugerida para cada anúncio. Nada muda sem o seu toque."
        voltar={loja ? LINK_MINHA_LOJA : "/minha-conta/anuncios"}
        textoVoltar={loja ? "Minha loja" : "Meus anúncios"}
      />
      {loja && iaAtiva && (
        <section aria-labelledby="titulo-nicho" className="flex flex-col gap-3">
          <h2 id="titulo-nicho" className="flex items-center gap-2 text-lg font-bold">
            <Store className="size-5 text-laranja-escuro" aria-hidden />
            Nicho da loja
          </h2>
          {nicho ? <EscolherNicho sugestao={nicho} nichos={nichos} /> : (
            <Aviso tipo="atencao">Não conseguimos carregar o nicho agora. Atualize a página.</Aviso>
          )}
        </section>
      )}
      <section aria-labelledby="titulo-sugestoes" className="flex flex-col gap-3">
        <h2 id="titulo-sugestoes" className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
          Categorias dos anúncios
        </h2>
        {sugestoes === null ? (
          <Aviso tipo="atencao">Não conseguimos carregar as sugestões agora. Atualize a página.</Aviso>
        ) : sugestoes.length === 0 ? (
          <Vazio titulo="Tudo organizado" texto="Não há sugestões para revisar. Quando um anúncio precisar de outra categoria, aparece aqui." icone={<Sparkles />} />
        ) : (
          <RevisarCategorias itens={sugestoes} />
        )}
      </section>
    </PaginaConta>
  );
}
