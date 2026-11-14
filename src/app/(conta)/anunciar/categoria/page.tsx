import { RegistrarAnuncio } from "@/components/assistente/retomar";
import type { Metadata } from "next";
import { listarCategorias } from "@/lib/dados/categorias";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { DescartarAnuncio } from "@/components/anunciar/descartar-anuncio";
import { EscolhaCategoria } from "@/components/anunciar/escolha-categoria";
import { SugestaoPendente } from "@/components/anunciar/sugestao-pendente";
import { minhaSugestaoCategoria } from "@/lib/dados/sugestoes-categoria";
import { urlPasso } from "@/components/anunciar/passos";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Categoria" };

const FORM = "form-categoria";

// T18 · Passo 2: categoria em até 3 níveis (grande → sub → tipo), com busca.
export default async function PassoCategoria({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar, daRevisao, equipe , assistente } = await carregarPasso(searchParams);
  const arvore = await listarCategorias();
  const sugestao = await minhaSugestaoCategoria(anuncio.id);

  return (
    <CorpoPasso>
      {assistente && !editar && !equipe && <RegistrarAnuncio dono={conta.perfil.id} tentativa={assistente} id={anuncio.id} passo="categoria" />}
      <CabecalhoPasso assistente={assistente} equipe={equipe} daRevisao={daRevisao}
        passo="categoria"
        id={anuncio.id}
        editar={editar}
        formId={arvore.length ? FORM : undefined}
        titulo="Qual é a categoria?"
        subtitulo="Assim quem procura acha seu anúncio."
      />
      {sugestao && <SugestaoPendente id={anuncio.id} editar={editar} texto={sugestao.texto} />}
      {arvore.length ? (
        <EscolhaCategoria assistente={assistente} id={anuncio.id} editar={editar} daRevisao={daRevisao} formId={FORM} arvore={arvore} selecionadaId={anuncio.categoria_id} tituloAtual={anuncio.titulo} />
      ) : (
        <Vazio titulo="Não conseguimos abrir as categorias" texto="Confira sua internet e tente de novo. O que você já fez está salvo.">
          <Botao tamanho="toque" href={urlPasso("categoria", anuncio.id, editar, daRevisao, assistente)} larguraTotal>
            Tentar de novo
          </Botao>
        </Vazio>
      )}
      {!equipe && anuncio.status === "rascunho" && <DescartarAnuncio tamanho="toque" id={anuncio.id} titulo={anuncio.titulo} rascunho />}
    </CorpoPasso>
  );
}
