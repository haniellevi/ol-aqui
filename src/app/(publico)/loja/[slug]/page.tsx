import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, MessageCircle, Pencil } from "lucide-react";
import { anunciosVitrine, vitrinePublica } from "@/lib/dados/vitrine-completa";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import type { CardAnuncioProps } from "@/components/anuncio/card-anuncio";
import { Vazio } from "@/components/ui/vazio";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { InformacoesLoja } from "@/components/vitrine/informacoes-loja";
import { SeloLoja } from "@/components/vitrine/selos";
import { desde } from "@/components/vitrine/util";
import { situacaoAgora } from "@/components/vitrine/regras";
import { inteiro, linkLoja, urlAbsoluta } from "@/lib/formato";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import type { AnuncioVitrine, OrdemVitrine, VitrinePublica } from "@/lib/tipos-vitrine";

// T10 · Vitrine da loja: olaki.com.br/loja/<slug>. "Site grátis" que a loja divulga no Instagram.
// Ordem da página: topo (banner, logo, nome, selo, WhatsApp) → seções próprias (se o plano deixar)
// → grupos automáticos pelas categorias do site (fixados primeiro, depois os mais novos; ou
// "Menor preço" pelo endereço ?ordem=menor_preco, funciona sem JavaScript) → informações da loja.
// O que o plano mostra (foto, seções, fixados) já vem decidido pelo banco.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ordem?: string | string[] }> };

function lerOrdem(v: string | string[] | undefined): OrdemVitrine {
  return (Array.isArray(v) ? v[0] : v) === "menor_preco" ? "menor_preco" : "recentes";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await vitrinePublica(slug);
  if (!v) return { title: "Loja não encontrada", robots: { index: false } };
  const descricao =
    (v.sobre ?? "").replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Veja os produtos de ${v.nome} em ${v.cidade} e chame no WhatsApp pelo OLAKI.`;
  const imagem = v.banner_tipo === "foto" && v.banner_url ? v.banner_url : `${linkLoja(v.slug)}/imagem`;
  return {
    title: `${v.nome} · ${v.cidade}`,
    description: descricao,
    alternates: { canonical: linkLoja(v.slug) },
    robots: v.status === "ativa" ? undefined : { index: false },
    openGraph: {
      type: "website",
      title: v.nome,
      description: descricao,
      url: linkLoja(v.slug),
      siteName: "OLAKI",
      locale: "pt_BR",
      images: [{ url: imagem, width: 1200, height: 630, alt: `Vitrine de ${v.nome} no OLAKI` }],
    },
    twitter: { card: "summary_large_image", title: v.nome, description: descricao, images: [imagem] },
  };
}

function paraCard(a: AnuncioVitrine, v: VitrinePublica): CardAnuncioProps["anuncio"] {
  return {
    id: a.id,
    titulo: a.titulo,
    preco_centavos: a.preco_centavos,
    aceita_troca: a.aceita_troca,
    cidade: a.cidade,
    capa: a.capa,
    criado_em: a.criado_em,
    destaque: a.destaque,
    vitrine_nome: v.nome,
    vitrine_selo: v.selo,
    vitrine_tipo: "loja",
  };
}

/** Grupos automáticos pela categoria-mãe do site, na ordem das categorias. */
function agrupar(anuncios: AnuncioVitrine[]) {
  const grupos = new Map<string, { nome: string; ordem: number; itens: AnuncioVitrine[] }>();
  for (const a of anuncios) {
    const nome = a.categoria_pai_nome ?? a.categoria_nome ?? "Outros";
    const g = grupos.get(nome) ?? { nome, ordem: Math.floor((a.grupo_ordem ?? 999999) / 1000), itens: [] };
    g.ordem = Math.min(g.ordem, Math.floor((a.grupo_ordem ?? 999999) / 1000));
    g.itens.push(a);
    grupos.set(nome, g);
  }
  return [...grupos.values()].sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome, "pt-BR"));
}

export default async function PaginaLoja({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const v = await vitrinePublica(slug);
  if (!v) notFound();
  const ordem = lerOrdem(sp.ordem);
  const anuncios = await anunciosVitrine(v.id, ordem);
  const agora = new Date();
  const situacao = situacaoAgora(v.horarios, agora);
  const numero = (v.whatsapp ?? "").replace(/\D/g, "");
  const whatsapp = numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(`Olá! Vi sua loja no OLAKI: ${urlAbsoluta(linkLoja(v.slug))}`)}`
    : null;

  const porId = new Map(anuncios.map((a) => [a.id, a]));
  const secoes = v.secoes
    .map((s) => {
      const itens = s.anuncios.map((id) => porId.get(id)).filter((a): a is AnuncioVitrine => !!a);
      if (ordem === "menor_preco") itens.sort((x, y) => (x.preco_centavos ?? Number.MAX_SAFE_INTEGER) - (y.preco_centavos ?? Number.MAX_SAFE_INTEGER));
      return { ...s, itens };
    })
    .filter((s) => s.itens.length > 0);
  const grupos = agrupar(anuncios);
  const desdeTexto = desde(v.criado_em);
  const base = linkLoja(v.slug);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-8 md:px-4 md:py-4">
      {v.status !== "ativa" && (
        <p role="status" className="mx-4 mt-3 rounded-card bg-aviso-fundo p-4 text-base font-semibold text-aviso md:mx-0 md:mt-0">
          Sua vitrine está fora do ar ({v.status === "suspensa" ? "suspensa" : "plano vencido"}). Só você está vendo esta página.
        </p>
      )}

      {/* Topo */}
      <header className="overflow-hidden bg-cartao shadow-1 md:rounded-card">
        <BannerLoja tipo={v.banner_tipo} url={v.banner_url} modelo={v.banner_modelo} cor={v.banner_cor} nome={v.nome} logo={v.logo_url} prioridade className="max-h-72" />
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="-mt-10 flex items-end gap-3">
            <span className="rounded-full border-4 border-cartao bg-cartao">
              <AvatarVitrine nome={v.nome} logo={v.logo_url} tamanho="xl" />
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-texto-suave">Loja</span>
            <h1 className="text-[22px] font-semibold leading-7">{v.nome}</h1>
            {v.selo && (
              <span>
                <SeloLoja />
              </span>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-texto-suave">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {[v.bairro, v.cidade].filter(Boolean).join(", ")}
              </span>
              {desdeTexto && <span>{desdeTexto}</span>}
            </p>
            {situacao && (
              <p className={`inline-flex items-center gap-1 text-[15px] font-semibold ${situacao.aberto ? "text-verde-escuro" : "text-perigo"}`} suppressHydrationWarning>
                <Clock className="size-4" aria-hidden />
                {situacao.texto}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={classesBotao("whatsapp", true, "sm:w-auto")}>
                <MessageCircle className="size-5" aria-hidden />
                Chamar no WhatsApp
              </a>
            )}
            {v.e_dono && (
              <Botao href={LINK_MINHA_LOJA} variante="secundario" icone={<Pencil />} larguraTotal className="sm:w-auto">
                Editar minha vitrine
              </Botao>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-4 md:px-0 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Ordem */}
          {anuncios.length > 1 && (
            <nav aria-label="Ordem dos produtos" className="flex flex-wrap items-center gap-2">
              <span className="text-base text-texto-suave">Mostrar:</span>
              <Chip href={base} ativo={ordem === "recentes"} scroll={false} replace>
                Mais novos
              </Chip>
              <Chip href={`${base}?ordem=menor_preco`} ativo={ordem === "menor_preco"} scroll={false} replace>
                Menor preço
              </Chip>
            </nav>
          )}

          {anuncios.length === 0 ? (
            <Vazio titulo="Esta loja ainda não tem anúncio no ar." texto="Volte daqui a pouco ou veja outros anúncios da região.">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={classesBotao("whatsapp", true)}>
                  <MessageCircle className="size-5" aria-hidden />
                  Perguntar no WhatsApp
                </a>
              )}
              <Botao href="/" variante={whatsapp ? "secundario" : "primario"} larguraTotal>
                Ver anúncios da região
              </Botao>
            </Vazio>
          ) : (
            <>
              {secoes.map((s) => (
                <section key={s.id} aria-labelledby={`secao-${s.id}`} className="flex flex-col gap-3">
                  <h2 id={`secao-${s.id}`} className="text-lg font-semibold">
                    {s.nome}
                  </h2>
                  <GradeAnuncios anuncios={s.itens.map((a) => paraCard(a, v))} />
                </section>
              ))}
              {grupos.map((g, i) => (
                <section key={g.nome} aria-labelledby={`grupo-${i}`} className="flex flex-col gap-3">
                  <h2 id={`grupo-${i}`} className="text-lg font-semibold">
                    {g.nome} <span className="text-base font-normal text-texto-suave">({inteiro(g.itens.length)})</span>
                  </h2>
                  <GradeAnuncios anuncios={g.itens.map((a) => paraCard(a, v))} prioridade={i === 0 && secoes.length === 0 ? 2 : 0} />
                </section>
              ))}
              {v.total_anuncios > anuncios.length && (
                <p className="text-base text-texto-suave">
                  Mostrando {inteiro(anuncios.length)} de {inteiro(v.total_anuncios)} produtos.{" "}
                  {whatsapp ? "Não achou? Chame a loja no WhatsApp." : ""}
                </p>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <InformacoesLoja v={v} agora={agora} />
        </aside>
      </div>
    </main>
  );
}
