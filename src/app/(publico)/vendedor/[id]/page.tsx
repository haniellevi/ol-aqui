import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { COLUNAS_VITRINE } from "@/lib/dados/vitrines";
import { anunciosDaVitrine } from "@/lib/dados/anuncios";
import { CabecalhoVitrine } from "@/components/vitrine/cabecalho-vitrine";
import { primeiroNome } from "@/components/vitrine/util";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { ehUuid, inteiro, linkLoja } from "@/lib/formato";
import type { Vitrine } from "@/lib/tipos";

// T11 · Perfil público de quem vende como pessoa física: só o primeiro nome, a cidade,
// desde quando está no Mercado da Região e os anúncios no ar. Nenhum dado pessoal (nem WhatsApp aqui:
// o contato é pelo botão de cada anúncio). O endereço usa o id da vitrine, não o da conta.

type Props = { params: Promise<{ id: string }> };

const lerVitrine = cache(async (id: string): Promise<Vitrine | null> => {
  if (!ehUuid(id)) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("vitrines_lojas").select(COLUNAS_VITRINE).eq("id", id.toLowerCase()).maybeSingle<Vitrine>();
    return error || !data ? null : { ...data, whatsapp: null };
  }, null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await lerVitrine((await params).id);
  if (!v || v.tipo !== "pf") return { title: "Vendedor não encontrado", robots: { index: false } };
  return {
    title: `Anúncios de ${primeiroNome(v.nome)} · ${v.cidade}`,
    description: `Veja o que ${primeiroNome(v.nome)} está vendendo em ${v.cidade} no Mercado da Região.`,
    robots: { index: false, follow: true }, // pessoa física: não aparece no Google pelo nome
  };
}

export default async function PaginaVendedor({ params }: Props) {
  const v = await lerVitrine((await params).id);
  if (!v) notFound();
  if (v.tipo === "loja") redirect(linkLoja(v.slug));
  if (v.status !== "ativa") notFound();

  const nome = primeiroNome(v.nome);
  const anuncios = await anunciosDaVitrine(v);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8 md:px-4 md:py-4">
      <CabecalhoVitrine rotulo="Vendedor" nome={nome} cidade={v.cidade} criadoEm={v.criado_em} />
      <section aria-labelledby="titulo-anuncios-vendedor" className="flex flex-col gap-3 px-4 md:px-0">
        <h2 id="titulo-anuncios-vendedor" className="text-lg font-semibold">
          {anuncios.length
            ? `${inteiro(anuncios.length)} ${anuncios.length === 1 ? "anúncio" : "anúncios"} de ${nome}`
            : `Anúncios de ${nome}`}
        </h2>
        <GradeAnuncios
          anuncios={anuncios}
          vazio={
            <Vazio titulo={`${nome} não tem anúncio no ar agora.`} texto="Veja outros anúncios da região.">
              <Botao href="/" larguraTotal>
                Ver anúncios da região
              </Botao>
            </Vazio>
          }
        />
      </section>
    </main>
  );
}
