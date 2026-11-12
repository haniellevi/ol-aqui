import type { Metadata } from "next";
import { faixaPreco } from "@/lib/dados/anuncios";
import { precoFalado } from "@/lib/formato";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { DescartarAnuncio } from "@/components/anunciar/descartar-anuncio";
import { FormPreco } from "@/components/anunciar/form-preco";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Preço" };

const FORM = "form-preco";

// T20 · Passo 4: preço, "A combinar", "Aceito troca" e a faixa dos parecidos na região.
export default async function PassoPreco({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar, equipe } = await carregarPasso(searchParams);
  const faixa = anuncio.categoria_id ? await faixaPreco(anuncio.categoria_id, conta.vitrine.microrregiao_id) : null;
  const dica =
    faixa && faixa.minimo != null && faixa.maximo != null
      ? faixa.minimo === faixa.maximo
        ? `por volta de ${precoFalado(faixa.minimo)}`
        : `${precoFalado(faixa.minimo)} a ${precoFalado(faixa.maximo)}`
      : null;
  // preço vazio num anúncio que já passou deste passo = "a combinar"
  const jaPassou = anuncio.status !== "rascunho" || !!anuncio.cidade;

  return (
    <CorpoPasso>
      <CabecalhoPasso equipe={equipe} passo="preco" id={anuncio.id} editar={editar} formId={FORM} titulo="Quanto você quer?" />
      <FormPreco
        id={anuncio.id}
        editar={editar}
        formId={FORM}
        precoInicial={anuncio.preco_centavos}
        aCombinarInicial={anuncio.preco_centavos == null && jaPassou}
        aceitaTrocaInicial={anuncio.aceita_troca}
        dicaFaixa={dica}
      />
      {!equipe && anuncio.status === "rascunho" && <DescartarAnuncio id={anuncio.id} titulo={anuncio.titulo} rascunho />}
    </CorpoPasso>
  );
}
