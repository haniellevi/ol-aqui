import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_VITRINE } from "@/lib/dados/vitrines";
import { anunciosDaVitrine } from "@/lib/dados/anuncios";
import { CabecalhoVitrine } from "@/components/vitrine/cabecalho-vitrine";
import { primeiroNome } from "@/components/vitrine/util";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Vazio } from "@/components/ui/vazio";
import { Voltar } from "@/components/ui/voltar";
import { Botao } from "@/components/ui/botao";
import { ehUuid, inteiro, linkLoja } from "@/lib/formato";
import type { Vitrine } from "@/lib/tipos";

// T11 · Perfil público de quem vende como pessoa física: só o primeiro nome, a cidade,
// desde quando está no Mercado da Região e os anúncios no ar. Nenhum dado pessoal (nem WhatsApp aqui:
// o contato é pelo botão de cada anúncio). O endereço usa o id da vitrine, não o da conta.

type Props = { params: Promise<{ id: string }> };

const lerVitrine = cache(async (id: string): Promise<Vitrine | null> => {
  if (!ehUuid(id)) return null;
  const db = await createClient();
  const { data, error } = await db.from("vitrines_lojas").select(COLUNAS_VITRINE).eq("id", id.toLowerCase()).maybeSingle<Vitrine>();
  if (error) throw new Error("Não foi possível carregar o perfil.");
  return data ? { ...data, whatsapp: null } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await lerVitrine((await params).id).catch(() => null);
  if (!v || v.tipo !== "pf" || v.status !== "ativa") return { title: "Vendedor não encontrado", robots: { index: false } };
  return {
    title: `Anúncios de ${primeiroNome(v.nome)} · ${v.cidade}`,
    description: `Veja o que ${primeiroNome(v.nome)} está vendendo em ${v.cidade} no Mercado da Região.`,
    robots: { index: false, follow: true }, // pessoa física: não aparece no Google pelo nome
  };
}

export default async function PaginaVendedor({ params }: Props) {
  const { id } = await params;
  const v = await lerVitrine(id).catch(() => undefined);
  const href = `/vendedor/${encodeURIComponent(id)}`;
  if (v === undefined) return (
    <main className="mx-auto w-full max-w-lg px-4 py-4">
      <Voltar />
      <Vazio titulo="Não conseguimos carregar o perfil">
        <Botao href={href} tamanho="toque">Tentar novamente</Botao>
        <Botao href="/busca" tamanho="toque" variante="secundario">Ver anúncios da região</Botao>
      </Vazio>
    </main>
  );
  if (!v) notFound();
  if (v.tipo === "loja") redirect(linkLoja(v.slug));
  if (v.status !== "ativa") notFound();

  const nome = primeiroNome(v.nome);
  const anuncios = await anunciosDaVitrine(v).catch(() => null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-3 pb-8 md:pt-4">
      <Voltar />
      <CabecalhoVitrine nome={nome} cidade={v.cidade} criadoEm={v.criado_em} />
      <section aria-labelledby="titulo-anuncios-vendedor" className="flex flex-col gap-2">
        <h2 id="titulo-anuncios-vendedor" className="text-lg font-semibold [overflow-wrap:anywhere]">
          {anuncios?.length
            ? `${inteiro(anuncios.length)} ${anuncios.length === 1 ? "anúncio" : "anúncios"}`
            : "Anúncios"}
        </h2>
        {anuncios === null ? (
          <Vazio titulo="Não conseguimos carregar os anúncios">
            <Botao href={href} tamanho="toque">Tentar novamente</Botao>
          </Vazio>
        ) : (
          <GradeAnuncios
            anuncios={anuncios}
            compacto
            className="gap-2 md:gap-3 [&_h3]:line-clamp-none"
            vazio={
              <Vazio titulo={`${nome} ainda não tem anúncios no ar`}>
                <Botao href="/busca" tamanho="toque" larguraTotal>Ver anúncios da região</Botao>
              </Vazio>
            }
          />
        )}
      </section>
    </main>
  );
}
