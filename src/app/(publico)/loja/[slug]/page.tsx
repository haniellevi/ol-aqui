import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Clock, MapPin, MessageCircle, Pencil } from "lucide-react";
import { anunciosPorPaginaVitrine, anunciosVitrine, vitrineNovaAtiva, vitrinePublica } from "@/lib/dados/vitrine-completa";
import { favoritosEntre } from "@/lib/dados/favoritos";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import type { CardAnuncioProps } from "@/components/anuncio/card-anuncio";
import { Vazio } from "@/components/ui/vazio";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { CopiarLinkLoja } from "@/components/vitrine/copiar-link-loja";
import { InformacoesLoja } from "@/components/vitrine/informacoes-loja";
import { BarraLoja } from "@/components/vitrine/barra-loja";
import { FavoritoCard } from "@/components/vitrine/favorito-card";
import { coordenadasValidas } from "@/components/vitrine/mapa-loja";
import { SeloLoja } from "@/components/vitrine/selos";
import { desde } from "@/components/vitrine/util";
import { linkComoChegar, situacaoAgora } from "@/components/vitrine/regras";
import { inteiro, linkLoja, urlAbsoluta } from "@/lib/formato";
import { LINK_MINHA_LOJA } from "@/lib/rotas";
import type { AnuncioVitrine, OrdemVitrine, VitrinePublica } from "@/lib/tipos-vitrine";
import { Alert } from "@/components/ui/alert";

// T10 · Vitrine da loja: mercadodaregiao.com.br/loja/<slug>. "Site grátis" que a loja divulga no Instagram.
// Ordem da página: topo (banner, logo, nome, selo, WhatsApp) → destaques da loja (produtos fixados
// no topo) → seções próprias (se o plano deixar) → grupos automáticos pelas categorias do site
// (os mais novos; ou "Menor preço" pelo endereço ?ordem=menor_preco, funciona sem JavaScript)
// → "Ver mais produtos" (?pagina=2...) → informações da loja.
// O que o plano mostra (foto, seções, fixados) já vem decidido pelo banco.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ordem?: string | string[]; pagina?: string | string[]; nova?: string | string[] }> };
export const dynamic = "force-dynamic";
const grade = "lg:grid-cols-3! xl:grid-cols-3!";

function lerOrdem(v: string | string[] | undefined): OrdemVitrine {
  return (Array.isArray(v) ? v[0] : v) === "menor_preco" ? "menor_preco" : "recentes";
}

function lerPagina(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 1 && n <= 1000 ? n : 1;
}

/** Endereço da vitrine com ordem e página (página 1 e ordem padrão ficam de fora). previa = ?nova=1 do dono. */
function linkPagina(base: string, ordem: OrdemVitrine, pagina: number, previa = false) {
  const q = new URLSearchParams();
  if (previa) q.set("nova", "1");
  if (ordem === "menor_preco") q.set("ordem", ordem);
  if (pagina > 1) q.set("pagina", String(pagina));
  const t = q.toString();
  return t ? `${base}?${t}` : base;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await vitrinePublica(slug).catch(() => undefined);
  if (v === undefined) return { title: "Loja temporariamente indisponível", robots: { index: false } };
  if (!v) return { title: "Loja não encontrada", robots: { index: false } };
  if (v.status !== "ativa") return { title: "Prévia da vitrine", robots: { index: false, follow: false } };
  const descricao =
    (v.sobre ?? "").replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Conheça ${v.nome} em ${v.cidade} e veja os anúncios da loja no Mercado da Região.`;
  // Foto da fachada: 1500x500 (cortar-banner.ts). Banner modelo: imagem gerada 1200x630, com a cor
  // no endereço para a mudança de cor chegar logo no WhatsApp/Facebook (a imagem fica em cache).
  const foto = v.banner_tipo === "foto" && v.banner_url ? v.banner_url : null;
  const imagem = foto ?? `${linkLoja(v.slug)}/imagem?v=${encodeURIComponent(`${v.banner_cor}-${v.banner_modelo}-${v.nome}`.slice(0, 120))}`;
  const tamanho = foto ? { width: 1500, height: 500 } : { width: 1200, height: 630 };
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
      siteName: "Mercado da Região",
      locale: "pt_BR",
      images: [{ url: imagem, ...tamanho, alt: `Vitrine de ${v.nome} no Mercado da Região` }],
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
  const v = await vitrinePublica(slug).catch(() => undefined);
  if (v === undefined) return <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8"><h1 className="text-titulo font-semibold text-balance">Não conseguimos carregar a loja</h1><p className="text-texto-suave">Tente novamente em instantes.</p><Botao href={linkPagina(linkLoja(slug), lerOrdem(sp.ordem), lerPagina(sp.pagina))} larguraTotal>Tentar novamente</Botao></main>;
  if (!v) notFound();
  const ordem = lerOrdem(sp.ordem);
  const pagina = lerPagina(sp.pagina);
  const produtos = await Promise.all([anunciosVitrine(v.id, ordem, pagina), anunciosPorPaginaVitrine(v.microrregiao_id)]).catch(() => null);
  const [todos, porPagina] = produtos ?? [[], 120];
  // na_pagina = false: o produto veio só porque está numa seção (fora desta página)
  const anuncios = todos.filter((a) => a.na_pagina);
  const agora = new Date();
  const situacao = situacaoAgora(v.horarios, agora);
  const numero = (v.whatsapp ?? "").replace(/\D/g, "");
  const whatsapp = v.status === "ativa" && /^55[1-9][0-9]9?[0-9]{8}$/.test(numero)
    ? `https://wa.me/${numero}?text=${encodeURIComponent(`Olá! Vi sua loja no Mercado da Região: ${urlAbsoluta(linkLoja(v.slug))}`)}`
    : null;

  const porId = new Map(todos.map((a) => [a.id, a]));
  const primeira = pagina === 1;
  // Produtos fixados: bloco próprio no topo da loja (só na 1ª página e na ordem "Mais novos")
  const fixados = primeira && ordem === "recentes" ? anuncios.filter((a) => a.fixado != null) : [];
  const secoes = (primeira && ordem === "recentes" ? v.secoes : [])
    .map((s) => {
      const itens = s.anuncios.map((id) => porId.get(id)).filter((a): a is AnuncioVitrine => !!a);
      return { ...s, itens };
    })
    .filter((s) => s.itens.length > 0);
  const grupos = agrupar(fixados.length > 0 ? anuncios.filter((a) => a.fixado == null) : anuncios);
  const inicio = (pagina - 1) * porPagina;
  const temMais = inicio + anuncios.length < v.total_anuncios;
  const desdeTexto = desde(v.criado_em);
  const base = linkLoja(v.slug);

  // Vitrine nova com IA (docs/PLANO-VITRINE-IA.md): chave vitrine_ia.ativa; o dono vê a prévia com ?nova=1.
  const previa = v.e_dono && (Array.isArray(sp.nova) ? sp.nova[0] : sp.nova) === "1";
  const nova = previa || (v.status === "ativa" && (await vitrineNovaAtiva(v.microrregiao_id)));
  const { userId } = nova ? await auth() : { userId: null };
  const favoritos = nova && v.status === "ativa" && userId ? await favoritosEntre(anuncios.map((a) => a.id), userId) : new Set<string>();
  const entrarHref = `/entrar?redirect_url=${encodeURIComponent(linkPagina(base, ordem, pagina, previa))}`;
  const acao = nova && v.status === "ativa"
    ? (a: CardAnuncioProps["anuncio"]) => (
        <FavoritoCard anuncioId={a.id} titulo={a.titulo} inicial={favoritos ? favoritos.has(a.id) : null} logado={!!userId} entrarHref={entrarHref} />
      )
    : undefined;
  const pino = coordenadasValidas(v.lat, v.lng);
  const mapaHref = !nova || v.status !== "ativa" ? null : pino ? "#mapa-loja" : linkComoChegar({ lat: v.lat, lng: v.lng, endereco: v.endereco, cidade: v.cidade });
  const temBarra = nova && (!!whatsapp || !!mapaHref);
  // Abas fixas: um atalho para cada bloco da página, na ordem em que aparecem.
  const abas = !nova || !produtos || anuncios.length === 0 ? [] : [
    ...(fixados.length > 0 ? [{ href: "#destaques-loja", nome: "Destaques" }] : []),
    ...secoes.map((s) => ({ href: `#secao-${s.id}`, nome: s.nome })),
    ...(ordem === "menor_preco" ? [] : grupos.map((g, i) => ({ href: `#grupo-${i}`, nome: g.nome }))),
  ];

  return (
    <main className={`mx-auto flex w-full max-w-6xl flex-col gap-5 md:px-4 md:py-4 ${temBarra ? "pb-24 md:pb-8" : "pb-8"}`}>
      {v.status !== "ativa" && (
        <Alert variant="warning" role="status" className="mx-4 mt-3 md:mx-0 md:mt-0">
          Prévia da vitrine fora do ar ({v.status === "suspensa" ? "suspensa" : "plano vencido"}). Visível apenas para o responsável e a equipe Mercado da Região.
        </Alert>
      )}

      {/* Topo */}
      <header className="overflow-hidden bg-cartao shadow-1 md:rounded-card">
        <BannerLoja tipo={v.banner_tipo} url={v.banner_url} modelo={v.banner_modelo} cor={v.banner_cor} nome={v.nome} logo={v.logo_url} posicaoAki={v.banner_aki_posicao ?? null} prioridade className={v.banner_aki_posicao == null ? "max-h-72" : undefined} />
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="relative z-10 -mt-9 flex items-end gap-3">
            <span className="rounded-full border-3 border-cartao bg-cartao">
              <AvatarVitrine nome={v.nome} logo={v.logo_url} tamanho="xl" />
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-legenda text-texto-suave">{v.categoria_loja ?? "Loja"}</span>
            <h1 className="text-titulo font-semibold text-balance break-words">{v.nome}</h1>
            {v.selo && (
              <span>
                <SeloLoja />
              </span>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-texto-suave">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {[v.bairro, v.cidade].filter(Boolean).join(", ")}
              </span>
              {desdeTexto && <span>{desdeTexto}</span>}
            </p>
            {situacao && (
              <p className={`inline-flex items-center gap-1 text-base font-semibold ${situacao.aberto ? "text-verde-escuro" : "text-perigo"}`} suppressHydrationWarning>
                <Clock className="size-4" aria-hidden />
                {situacao.texto}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chamar a loja no WhatsApp (abre em nova aba)" className={classesBotao("whatsapp", false, "flex-1 whitespace-nowrap sm:flex-none")}>
                <MessageCircle className="size-5" aria-hidden />
                Chamar no WhatsApp
              </a>
            )}
            {!whatsapp && <p className="flex min-h-10 items-center text-sm text-texto-suave">Contato por WhatsApp indisponível nesta vitrine.</p>}
            {v.status === "ativa" && <CopiarLinkLoja url={urlAbsoluta(linkLoja(v.slug))} />}
            {v.e_dono && (
              <Botao href={LINK_MINHA_LOJA} variante="secundario" icone={<Pencil />}>
                Editar minha vitrine
              </Botao>
            )}
          </div>
          {!nova && (
            <nav aria-label="Nesta loja" className="flex flex-wrap gap-2">
              <Chip href="#produtos-loja">Ver anúncios ({inteiro(v.total_anuncios)})</Chip>
              <Chip href="#informacoes-loja">Informações da loja</Chip>
            </nav>
          )}
        </div>
      </header>

      {nova && (
        <nav aria-label="Categorias desta loja" className="olaki-material sticky top-13 z-20 -mt-5 md:top-14 md:mt-0 md:rounded-card">
          <ul className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
            {abas.map((a) => (
              <li key={a.href} className="flex">
                <Chip href={a.href}>{a.nome}</Chip>
              </li>
            ))}
            <li className="flex">
              <Chip href="#informacoes-loja">Informações</Chip>
            </li>
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-6 px-4 md:px-0 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
        <div id="produtos-loja" className="flex min-w-0 scroll-mt-24 flex-col gap-6">
          <h2 className="text-xl font-semibold tabular-nums">{inteiro(v.total_anuncios)} {v.total_anuncios === 1 ? "anúncio" : "anúncios"} {v.status === "ativa" ? "no ar" : "nesta vitrine"}</h2>
          {/* Ordem */}
          {v.total_anuncios > 1 && (
            <nav aria-label="Ordem dos produtos" className="flex flex-wrap items-center gap-2">
              <span className="text-base text-texto-suave">Mostrar:</span>
              <Chip href={linkPagina(base, "recentes", 1, previa)} ativo={ordem === "recentes"} scroll={false} replace>
                Vitrine da loja
              </Chip>
              <Chip href={linkPagina(base, "menor_preco", 1, previa)} ativo={ordem === "menor_preco"} scroll={false} replace>
                Menor preço
              </Chip>
            </nav>
          )}

          {!produtos ? <Vazio titulo="Não conseguimos carregar os anúncios" texto="As informações da loja continuam disponíveis. Tente carregar os produtos novamente."><Botao href={linkPagina(base, ordem, pagina, previa)} larguraTotal>Tentar novamente</Botao></Vazio> : anuncios.length === 0 && pagina > 1 ? (
            <Vazio titulo="Não tem mais produtos aqui." texto="Volte para o começo da loja.">
              <Botao href={linkPagina(base, ordem, 1, previa)} variante="primario" larguraTotal>
                Ver o começo da loja
              </Botao>
            </Vazio>
          ) : anuncios.length === 0 ? (
            <Vazio titulo="Esta loja ainda não tem anúncio no ar." texto="Volte daqui a pouco ou veja outros anúncios da região.">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={classesBotao("whatsapp", true)}>
                  <MessageCircle className="size-5" aria-hidden />
                  Perguntar no WhatsApp
                </a>
              )}
              <Botao href="/busca" variante={whatsapp ? "secundario" : "primario"} larguraTotal>
                Ver anúncios da região
              </Botao>
            </Vazio>
          ) : (
            <>
              {fixados.length > 0 && (
                <section aria-labelledby="destaques-loja" className="flex flex-col gap-3">
                  <h2 id="destaques-loja" className="scroll-mt-32 text-lg font-semibold">
                    Destaques da loja
                  </h2>
                  <GradeAnuncios className={grade} anuncios={fixados.map((a) => paraCard(a, v))} prioridade={2} acao={acao} />
                </section>
              )}
              {secoes.map((s) => (
                <section key={s.id} aria-labelledby={`secao-${s.id}`} className="flex flex-col gap-3">
                  <h2 id={`secao-${s.id}`} className="scroll-mt-32 text-lg font-semibold">
                    {s.nome}
                  </h2>
                  <GradeAnuncios className={grade} anuncios={s.itens.map((a) => paraCard(a, v))} acao={acao} />
                </section>
              ))}
              {ordem === "menor_preco" ? <section aria-labelledby="ordem-preco" className="flex flex-col gap-3"><h2 id="ordem-preco" className="text-lg font-semibold">Do menor para o maior preço</h2><GradeAnuncios className={grade} anuncios={anuncios.map((a) => paraCard(a, v))} acao={acao} /></section> : grupos.map((g, i) => (
                <section key={g.nome} aria-labelledby={`grupo-${i}`} className="flex flex-col gap-3">
                  <h2 id={`grupo-${i}`} className="scroll-mt-32 text-lg font-semibold">
                    {g.nome} <span className="text-base font-normal text-texto-suave">({inteiro(g.itens.length)})</span>
                  </h2>
                  <GradeAnuncios className={grade} anuncios={g.itens.map((a) => paraCard(a, v))} prioridade={i === 0 && secoes.length === 0 && fixados.length === 0 ? 2 : 0} acao={acao} />
                </section>
              ))}
              {(temMais || pagina > 1) && (
                <nav aria-label="Páginas de produtos" className="flex flex-col gap-3">
                  <p className="text-base text-texto-suave tabular-nums">
                    Produtos {inteiro(inicio + 1)} a {inteiro(inicio + anuncios.length)} de {inteiro(v.total_anuncios)}.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {temMais && (
                      <Botao href={linkPagina(base, ordem, pagina + 1, previa)} variante="secundario" larguraTotal className="sm:w-auto">
                        Ver mais produtos
                      </Botao>
                    )}
                    {pagina > 1 && (
                      <Botao href={linkPagina(base, ordem, pagina - 1, previa)} variante="secundario" larguraTotal className="sm:w-auto">
                        Página anterior
                      </Botao>
                    )}
                  </div>
                </nav>
              )}
            </>
          )}
        </div>

        <aside id="informacoes-loja" className="flex min-w-0 scroll-mt-32 flex-col gap-4">
          <InformacoesLoja v={v.status === "ativa" ? v : { ...v, instagram: null, endereco: null, lat: null, lng: null }} agora={agora} mapa={nova} />
          <p className="rounded-card border border-borda p-4 text-sm text-texto-suave">Negocie com cuidado: confira o produto e o vendedor antes de pagar. O contato acontece diretamente com a loja.</p>
        </aside>
      </div>
      {temBarra && <BarraLoja whatsappHref={whatsapp} mapaHref={mapaHref} />}
    </main>
  );
}
