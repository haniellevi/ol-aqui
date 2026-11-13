import type { Metadata } from "next";
import { lerConfigNumero } from "@/lib/dados/config";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { DescartarAnuncio } from "@/components/anunciar/descartar-anuncio";
import { EnvioFotos } from "@/components/anunciar/envio-fotos";
import { BotaoAbrirAki } from "@/components/aki/botao-abrir-aki";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Fotos" };

const MAX_FOTOS_BANCO = 12; // check de anuncios.fotos no banco

// T17 · Passo 1: fotos (tirar ou escolher, até o máximo, a primeira é a capa).
export default async function PassoFotos({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar, daRevisao, equipe } = await carregarPasso(searchParams);
  const regiao = conta.vitrine.microrregiao_id;
  const [minimo, maximoConfig] = await Promise.all([
    lerConfigNumero("anuncio.fotos_minimo", regiao),
    lerConfigNumero("anuncio.fotos_maximo", regiao),
  ]);
  const maximo = Math.min(maximoConfig ?? MAX_FOTOS_BANCO, MAX_FOTOS_BANCO);

  return (
    <CorpoPasso>
      <CabecalhoPasso equipe={equipe} daRevisao={daRevisao}
        passo="fotos"
        formId="form-fotos"
        id={anuncio.id}
        editar={editar}
        titulo={editar ? "Fotos do anúncio" : "Adicione fotos"}
        subtitulo="A primeira foto será a capa do anúncio."
      />
      {/* O Merc só cadastra na loja própria (P5b): o ajudante não vê o botão. */}
      {!editar && !conta.ajudante && (
        <BotaoAbrirAki pedido={{ foto: true, rascunhoId: anuncio.id }}>Cadastrar com o Merc pela foto</BotaoAbrirAki>
      )}
      <EnvioFotos id={anuncio.id} editar={editar} daRevisao={daRevisao} fotosIniciais={anuncio.fotos} maximo={maximo} minimo={minimo ?? 0} podeEditarComAki={conta.vitrine.tipo === "loja" && !conta.ajudante} />
      {!equipe && anuncio.status === "rascunho" && <DescartarAnuncio id={anuncio.id} titulo={anuncio.titulo} rascunho />}
    </CorpoPasso>
  );
}
