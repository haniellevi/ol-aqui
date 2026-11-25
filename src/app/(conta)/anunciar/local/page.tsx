import { RegistrarAnuncio } from "@/components/assistente/retomar";
import type { Metadata } from "next";
import { listarCidades } from "@/lib/dados/regiao";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { DescartarAnuncio } from "@/components/anunciar/descartar-anuncio";
import { minhaVitrineCompleta } from "@/lib/dados/vitrine-completa";
import { localDaLoja } from "@/lib/ativacao-lojista";
import { FormLocal } from "@/components/anunciar/form-local";
import { carregarPasso, type ParamsPasso } from "../_carregar";

export const metadata: Metadata = { title: "Anunciar · Local" };

const FORM = "form-local";

// T21 · Passo 5: onde está (cidade da região + bairro), preenchido do perfil.
export default async function PassoLocal({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar, daRevisao, equipe , assistente } = await carregarPasso(searchParams);
  const cidades = await listarCidades(conta.vitrine.microrregiao_id);
  const loja = cidades.length > 0 && conta.vitrine.tipo === "loja" && !conta.ajudante && !equipe && !editar && !anuncio.cidade ? await minhaVitrineCompleta() : null;
  const local = loja && loja.id === conta.vitrine.id ? localDaLoja(loja, cidades) : null;
  const sugerida = local?.cidade ?? anuncio.cidade ?? conta.perfil.cidade ?? conta.vitrine.cidade ?? "";
  const cidadeInicial = !cidades.length ? anuncio.cidade ?? "" : cidades.some((c) => c.nome === sugerida) ? sugerida : "";
  const bairroInicial = local ? local.bairro : anuncio.cidade ? anuncio.bairro ?? "" : anuncio.bairro ?? conta.perfil.bairro ?? "";

  return (
    <CorpoPasso>
      {assistente && !editar && !equipe && <RegistrarAnuncio dono={conta.perfil.id} tentativa={assistente} id={anuncio.id} passo="local" />}
      <CabecalhoPasso assistente={assistente} equipe={equipe} daRevisao={daRevisao} passo="local" id={anuncio.id} editar={editar} formId={FORM} titulo="Onde está?" />
      <FormLocal
        confirmarLoja={Boolean(local)}
        assistente={assistente}
        id={anuncio.id}
        editar={editar}
        daRevisao={daRevisao}
        formId={FORM}
        cidades={cidades.map((c) => ({ nome: c.nome, uf: c.uf }))}
        cidadeInicial={cidadeInicial}
        bairroInicial={bairroInicial}
      />
      {!equipe && anuncio.status === "rascunho" && <DescartarAnuncio tamanho="toque" id={anuncio.id} titulo={anuncio.titulo} rascunho />}
    </CorpoPasso>
  );
}
