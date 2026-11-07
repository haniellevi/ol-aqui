import type { Metadata } from "next";
import { lerConfigNumero } from "@/lib/dados/config";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { EnvioFotos } from "@/components/anunciar/envio-fotos";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Fotos" };

const MAX_FOTOS_BANCO = 12; // check de anuncios.fotos no banco

// T17 · Passo 1: fotos (tirar ou escolher, até o máximo, a primeira é a capa).
export default async function PassoFotos({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar } = await carregarPasso(searchParams);
  const regiao = conta.vitrine.microrregiao_id;
  const [minimo, maximoConfig] = await Promise.all([
    lerConfigNumero("anuncio.fotos_minimo", regiao),
    lerConfigNumero("anuncio.fotos_maximo", regiao),
  ]);
  const maximo = Math.min(maximoConfig ?? MAX_FOTOS_BANCO, MAX_FOTOS_BANCO);

  return (
    <CorpoPasso>
      <CabecalhoPasso
        passo="fotos"
        id={anuncio.id}
        editar={editar}
        titulo={editar ? "Fotos do anúncio" : "Tire fotos do que você quer vender"}
        subtitulo="As fotos ficam salvas assim que terminam de enviar."
      />
      <EnvioFotos id={anuncio.id} editar={editar} fotosIniciais={anuncio.fotos} maximo={maximo} minimo={minimo ?? 0} />
    </CorpoPasso>
  );
}
