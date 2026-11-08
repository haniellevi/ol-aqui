import { PackageX } from "lucide-react";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { linkPedirRadar } from "@/lib/rotas";

// T44 · Anúncio que saiu do ar (pausado, expirado ou loja fora do ar): em vez de "não encontrado",
// mostra o aviso e parecidos da mesma categoria. Não mostra título nem vendedor (o dono tirou do ar).
export async function AnuncioForaDoAr({ categoriaSlug, categoriaNome }: { categoriaSlug: string | null; categoriaNome: string | null }) {
  const parecidos = categoriaSlug ? (await buscarAnuncios({ categoria: categoriaSlug, limite: 8 })).anuncios : [];
  const verMais = categoriaSlug ? `/busca?categoria=${encodeURIComponent(categoriaSlug)}` : "/busca";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <Vazio
        titulo="Este anúncio saiu do ar"
        texto="O vendedor pausou o anúncio ou o prazo dele acabou. Veja outros parecidos na região."
        icone={<PackageX />}
      >
        <Botao href={verMais} larguraTotal>
          {categoriaNome ? `Ver mais em ${categoriaNome}` : "Buscar parecidos"}
        </Botao>
        <Botao href={linkPedirRadar(categoriaNome)} variante="secundario" larguraTotal>
          Pedir no Radar
        </Botao>
      </Vazio>
      {parecidos.length > 0 && (
        <section aria-labelledby="titulo-parecidos" className="flex flex-col gap-3">
          <h2 id="titulo-parecidos" className="text-lg font-semibold">
            Parecidos na região
          </h2>
          <GradeAnuncios anuncios={parecidos} />
        </section>
      )}
    </main>
  );
}
