import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import type { AnuncioCard, StatusAnuncio, TipoVitrine } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { BotaoRemoverFavorito } from "@/components/conta/botao-remover-favorito";

export const metadata: Metadata = { title: "Favoritos" };

// T34 · Favoritos: anúncios no ar em grade (com o coração para tirar) e,
// embaixo, os que saíram do ar (vendidos/pausados) para a pessoa poder limpar.

type Card = Pick<
  AnuncioCard,
  "id" | "titulo" | "preco_centavos" | "cidade" | "capa" | "criado_em" | "destaque" | "vitrine_nome" | "vitrine_selo" | "vitrine_tipo"
>;
type LinhaFav = {
  anuncio_id: string;
  criado_em: string;
  anuncios: {
    id: string;
    titulo: string | null;
    preco_centavos: number | null;
    cidade: string | null;
    fotos: string[] | null;
    status: StatusAnuncio;
    destaque_ate: string | null;
    publicado_em: string | null;
    criado_em: string;
    vitrines_lojas: { nome: string; selo_loja_verificada: boolean; tipo: TipoVitrine; status: string } | null;
  } | null;
};

async function lerFavoritos(): Promise<{ noAr: Card[]; foraDoAr: { id: string; titulo: string }[] }> {
  return seguro(
    async () => {
      const { userId } = await auth();
      if (!userId) return { noAr: [], foraDoAr: [] };
      const db = await createClient();
      const { data, error } = await db
        .from("favoritos")
        .select(
          "anuncio_id, criado_em, anuncios(id, titulo, preco_centavos, cidade, fotos, status, destaque_ate, publicado_em, criado_em, vitrines_lojas(nome, selo_loja_verificada, tipo, status))",
        )
        .eq("usuario_id", userId)
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error || !data) return { noAr: [], foraDoAr: [] };
      const agora = Date.now();
      const noAr: Card[] = [];
      const foraDoAr: { id: string; titulo: string }[] = [];
      for (const f of data as unknown as LinhaFav[]) {
        const a = f.anuncios;
        const v = a?.vitrines_lojas;
        if (a && v && a.status === "ativo" && v.status === "ativa") {
          noAr.push({
            id: a.id,
            titulo: a.titulo ?? "",
            preco_centavos: a.preco_centavos,
            cidade: a.cidade ?? "",
            capa: a.fotos?.[0] ?? null,
            criado_em: a.publicado_em ?? a.criado_em,
            destaque: !!a.destaque_ate && new Date(a.destaque_ate).getTime() > agora,
            vitrine_nome: v.nome,
            vitrine_selo: v.selo_loja_verificada,
            vitrine_tipo: v.tipo,
          });
        } else {
          // anúncio pausado/apagado some da leitura (RLS): mostramos só para poder tirar
          foraDoAr.push({ id: f.anuncio_id, titulo: a?.titulo?.trim() || "Anúncio que saiu do ar" });
        }
      }
      return { noAr, foraDoAr };
    },
    { noAr: [], foraDoAr: [] },
  );
}

export default async function PaginaFavoritos() {
  const { noAr, foraDoAr } = await lerFavoritos();
  const total = noAr.length + foraDoAr.length;

  return (
    <PaginaConta larga>
      <TopoConta
        titulo="Favoritos"
        texto={total > 0 ? "Toque no coração para tirar um anúncio da lista." : undefined}
      />

      <GradeAnuncios
        anuncios={noAr}
        acao={(a) => <BotaoRemoverFavorito anuncioId={a.id} titulo={a.titulo} />}
        vazio={
          foraDoAr.length === 0 ? (
            <Vazio
              titulo="Você ainda não tem favoritos"
              texto="Toque no coração de um anúncio para guardar e ver depois."
              icone={<Heart />}
              className="mx-auto w-full max-w-xl"
            >
              <Botao href="/busca" larguraTotal>
                Ver anúncios
              </Botao>
            </Vazio>
          ) : null
        }
      />

      {foraDoAr.length > 0 && (
        <section aria-labelledby="fora-do-ar" className="flex max-w-xl flex-col gap-2">
          <h2 id="fora-do-ar" className="text-lg font-bold">
            Não estão mais no ar
          </h2>
          <ul className="divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            {foraDoAr.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-1 pl-4 pr-1">
                <span className="line-clamp-2 text-base text-texto-suave">{f.titulo}</span>
                <BotaoRemoverFavorito anuncioId={f.id} titulo={f.titulo} comTexto />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PaginaConta>
  );
}
