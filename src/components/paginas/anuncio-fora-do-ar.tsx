import { PackageX } from "lucide-react";
import { seguro } from "@/lib/dados/seguro";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { linkPedirRadar } from "@/lib/rotas";

// T44 · Anúncio que saiu do ar (pausado, expirado ou loja fora do ar): em vez de "não encontrado",
// mostra o aviso e parecidos da mesma categoria. Não mostra título nem vendedor (o dono tirou do ar).
export async function AnuncioForaDoAr({ categoriaSlug, categoriaNome }: { categoriaSlug: string | null; categoriaNome: string | null }) {
  const sugestoes = categoriaSlug ? await seguro(() => buscarAnuncios({ categoria: categoriaSlug, limite: 8 }), null) : null;
  const parecidos = sugestoes?.anuncios ?? [];
  const verMais = categoriaSlug ? `/busca?categoria=${encodeURIComponent(categoriaSlug)}` : "/busca";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <Vazio
        titulo="Este anúncio saiu do ar"
        texto="Veja outros anúncios da região."
        icone={<PackageX />}
      >
        <Botao href={verMais} tamanho="toque" larguraTotal>
          {categoriaNome ? `Ver mais em ${categoriaNome}` : "Buscar parecidos"}
        </Botao>
        <Botao href={linkPedirRadar(categoriaNome)} variante="secundario" tamanho="toque" larguraTotal>
          Estou procurando…
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
