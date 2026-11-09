import type { Metadata } from "next";
import { listarCidades } from "@/lib/dados/regiao";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { FormLocal } from "@/components/anunciar/form-local";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Local" };

const FORM = "form-local";

// T21 · Passo 5: onde está (cidade da região + bairro), preenchido do perfil.
export default async function PassoLocal({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar } = await carregarPasso(searchParams);
  const cidades = await listarCidades(conta.vitrine.microrregiao_id);
  const sugerida = anuncio.cidade ?? conta.perfil.cidade ?? conta.vitrine.cidade ?? "";
  const cidadeInicial = !cidades.length ? anuncio.cidade ?? "" : cidades.some((c) => c.nome === sugerida) ? sugerida : "";
  const bairroInicial = anuncio.cidade ? anuncio.bairro ?? "" : anuncio.bairro ?? conta.perfil.bairro ?? "";

  return (
    <CorpoPasso>
      <CabecalhoPasso passo="local" id={anuncio.id} editar={editar} formId={FORM} titulo="Onde está?" subtitulo="Ajuda quem mora perto a achar seu anúncio." />
      <FormLocal
        id={anuncio.id}
        editar={editar}
        formId={FORM}
        cidades={cidades.map((c) => ({ nome: c.nome, uf: c.uf }))}
        cidadeInicial={cidadeInicial}
        bairroInicial={bairroInicial}
      />
    </CorpoPasso>
  );
}
