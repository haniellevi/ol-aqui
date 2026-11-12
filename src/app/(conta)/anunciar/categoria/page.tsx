import type { Metadata } from "next";
import { listarCategorias } from "@/lib/dados/categorias";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { EscolhaCategoria } from "@/components/anunciar/escolha-categoria";
import { SugestaoPendente } from "@/components/anunciar/sugestao-pendente";
import { minhaSugestaoCategoria } from "@/lib/dados/sugestoes-categoria";
import { urlPasso } from "@/components/anunciar/passos";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Categoria" };

const FORM = "form-categoria";

// T18 · Passo 2: categoria em até 3 níveis (grande → sub → tipo), com busca.
export default async function PassoCategoria({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, editar, equipe } = await carregarPasso(searchParams);
  const arvore = await listarCategorias();
  const sugestao = await minhaSugestaoCategoria(anuncio.id);

  return (
    <CorpoPasso>
      <CabecalhoPasso equipe={equipe}
        passo="categoria"
        id={anuncio.id}
        editar={editar}
        formId={arvore.length ? FORM : undefined}
        titulo="O que você está vendendo?"
        subtitulo="Escolha a categoria. Assim quem procura acha seu anúncio."
      />
      {sugestao && <SugestaoPendente id={anuncio.id} editar={editar} texto={sugestao.texto} />}
      {arvore.length ? (
        <EscolhaCategoria id={anuncio.id} editar={editar} formId={FORM} arvore={arvore} selecionadaId={anuncio.categoria_id} />
      ) : (
        <Vazio titulo="Não conseguimos abrir as categorias" texto="Confira sua internet e tente de novo. O que você já fez está salvo.">
          <Botao href={urlPasso("categoria", anuncio.id, editar)} larguraTotal>
            Tentar de novo
          </Botao>
        </Vazio>
      )}
    </CorpoPasso>
  );
}
