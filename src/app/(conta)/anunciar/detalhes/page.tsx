import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { categoriaDoAnuncio, categoriaPorId } from "@/lib/dados/categorias";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { FormDetalhes } from "@/components/anunciar/form-detalhes";
import { urlPasso } from "@/components/anunciar/passos";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Detalhes" };

const FORM = "form-detalhes";

// T19 · Passo 3: título, descrição e os campos da subcategoria (vindos do banco).
export default async function PassoDetalhes({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, editar } = await carregarPasso(searchParams);
  // nunca esteve no ar: só categoria visível (escondida no painel = escolhe outra); já esteve: a dele, mesmo escondida
  const nuncaNoAr = !anuncio.publicado_em;
  const achada = anuncio.categoria_id
    ? await (nuncaNoAr ? categoriaPorId(anuncio.categoria_id) : categoriaDoAnuncio(anuncio.categoria_id))
    : null;
  // sem categoria (ou com uma que sumiu): os campos dependem dela, então escolhe primeiro
  if (!achada && nuncaNoAr) redirect(urlPasso("categoria", anuncio.id, editar));

  const campos = achada?.pai ? achada.categoria.campos : [];
  const nome = achada?.pai ? `${achada.pai.nome} › ${achada.categoria.nome}` : null;

  return (
    <CorpoPasso>
      <CabecalhoPasso
        passo="detalhes"
        id={anuncio.id}
        editar={editar}
        formId={FORM}
        titulo="Conte como é"
        subtitulo={nome ? `Categoria: ${nome}. Os campos sem "(opcional)" são obrigatórios.` : 'Os campos sem "(opcional)" são obrigatórios.'}
      />
      <FormDetalhes
        id={anuncio.id}
        categoriaId={anuncio.categoria_id}
        editar={editar}
        formId={FORM}
        tituloInicial={anuncio.titulo ?? ""}
        descricaoInicial={anuncio.descricao ?? ""}
        campos={campos}
        atributos={anuncio.atributos}
      />
    </CorpoPasso>
  );
}
