import type { Metadata } from "next";
import Link from "next/link";
import { Download, Megaphone, TrendingUp } from "lucide-react";
import { minhaVitrineCompleta, vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { meuMarketingLoja } from "@/lib/dados/marketing-loja";
import { minhasDicasLoja } from "@/lib/dados/painel-loja";
import { minhaSugestaoNicho, nichosDisponiveis } from "@/lib/dados/categorias-ia";
import { EscolherNicho } from "@/components/conta/revisar-categorias";
import { formatarNome } from "@/lib/formatar-nome";
import { linkLoja, preco, precoAntesValido, urlAbsoluta } from "@/lib/formato";
import { LINK_LOJA_DESEMPENHO, LINK_LOJA_MARKETING, LINK_MINHA_LOJA } from "@/lib/rotas";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { BotaoNovoRascunho } from "@/components/anunciar/botao-novo-rascunho";
import { urlPasso } from "@/components/anunciar/passos";
import { CopiarLegenda } from "@/components/marketing/copiar-legenda";

export const metadata: Metadata = { title: "Meu Marketing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaginaMarketing() {
  const loja = await minhaVitrineCompleta(true);
  if (!loja || loja.tipo !== "loja") {
    return <PaginaConta><TopoConta titulo="Meu Marketing" /><Vazio titulo="Você ainda não tem uma loja"
      texto="Abra sua loja para divulgar seus produtos e acompanhar o que procuram na região.">
      <Botao href="/quero-vender/loja">Abrir minha loja</Botao>
    </Vazio></PaginaConta>;
  }
  if (loja.status !== "ativa" || loja.pasta_montagem) {
    return <PaginaConta><TopoConta titulo="Meu Marketing" voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
      <Aviso tipo="atencao">Sua loja precisa estar ativa e com o recebimento concluído para divulgar os produtos.</Aviso>
      <Botao href={LINK_MINHA_LOJA}>Ver situação da loja</Botao></PaginaConta>;
  }
  const [dados, dicas, painelAtivo] = await Promise.all([
    meuMarketingLoja(loja.id), minhasDicasLoja(loja.id), vitrineNovaAtiva(loja.microrregiao_id).catch(() => false),
  ]);
  const nome = formatarNome(loja.nome);
  const endereco = urlAbsoluta(linkLoja(loja.slug));
  const [nicho, nichos] = dados && !dados.nicho_definido && !loja.ajudante
    ? await Promise.all([minhaSugestaoNicho(loja.id), nichosDisponiveis()]) : [null, []];
  return (
    <PaginaConta larga>
      <TopoConta titulo="Meu Marketing" texto={<span className="[overflow-wrap:anywhere]">{nome}</span>} voltar={LINK_MINHA_LOJA} textoVoltar="Minha loja" />
      {dados === null ? <Aviso tipo="atencao">Não conseguimos carregar as recomendações agora. <Link href={LINK_LOJA_MARKETING} className="underline">Tentar novamente</Link></Aviso> : <>
        <section aria-labelledby="titulo-criativos" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-criativos" className="flex items-center gap-2 text-lg font-bold"><Megaphone className="size-5" aria-hidden />Para divulgar agora</h2>
            <p className="text-sm text-texto-suave">Escolhidos pelos contatos, favoritos e visualizações dos últimos 30 dias. As artes usam a foto e o preço atuais do anúncio.</p>
          </div>
          {dados.criativos.length === 0 ? <Vazio titulo="Publique um anúncio com foto" texto="Quando houver produtos no ar com foto, você poderá baixar artes para divulgar sua loja.">
            <Botao href="/anunciar">Criar anúncio</Botao>
          </Vazio> : <div className="grid gap-4 md:grid-cols-3">
            {dados.criativos.map((anuncio) => {
              const antes = precoAntesValido(anuncio.preco_antes_centavos, anuncio.preco_centavos);
              const titulo = formatarNome(anuncio.titulo);
              const legenda = `${titulo}${anuncio.preco_centavos === null ? "" : ` por ${preco(anuncio.preco_centavos)}`} na ${nome}. Confira a disponibilidade na nossa vitrine: ${endereco}`;
              const arte = `${LINK_LOJA_MARKETING}/criativo/${anuncio.id}`;
              return <article key={anuncio.id} className="flex min-w-0 flex-col overflow-hidden rounded-card border border-borda bg-cartao shadow-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto real do anúncio, sem recorte */}
                <img src={anuncio.foto} alt={titulo} width={400} height={300} className="aspect-[4/3] w-full bg-fundo object-contain" />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div><h3 className="font-bold [overflow-wrap:anywhere]">{titulo}</h3>
                    <p className="text-lg font-bold text-beringela">{antes !== null && <del className="mr-2 text-sm font-normal text-texto-suave">{preco(antes)}</del>}{preco(anuncio.preco_centavos)}</p></div>
                  <p className="text-sm">{anuncio.motivos.join(". ")}{anuncio.motivos.length ? "." : ""}</p>
                  <p className="text-legenda text-texto-suave">{anuncio.visualizacoes} {anuncio.visualizacoes === 1 ? "visualização" : "visualizações"} · {anuncio.cliques} {anuncio.cliques === 1 ? "clique" : "cliques"} no WhatsApp · {anuncio.favoritos} {anuncio.favoritos === 1 ? "favorito" : "favoritos"}</p>
                  <div className="mt-auto flex flex-col gap-2">
                    <a href={`${arte}?formato=feed`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-campo bg-laranja px-3 text-sm font-semibold text-beringela focus-visible:outline-3 focus-visible:outline-laranja-escuro"><Download className="size-4" aria-hidden />Baixar para feed</a>
                    <a href={`${arte}?formato=stories`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-campo border border-beringela px-3 text-sm font-semibold text-beringela focus-visible:outline-3 focus-visible:outline-laranja-escuro"><Download className="size-4" aria-hidden />Baixar para stories</a>
                    <CopiarLegenda texto={legenda} />
                  </div>
                </div>
              </article>;
            })}
          </div>}
        </section>
        <section aria-labelledby="titulo-oportunidades" className="flex flex-col gap-3 border-t border-borda pt-5">
          <div className="flex flex-col gap-1"><h2 id="titulo-oportunidades" className="flex items-center gap-2 text-lg font-bold"><TrendingUp className="size-5" aria-hidden />O que procuram na sua região</h2>
            <p className="text-sm text-texto-suave">{dados.regiao_nome} · últimos 30 dias. Buscas e pedidos do Radar que combinam com seu nicho e ainda não aparecem nos seus anúncios ativos.</p></div>
          {!dados.nicho_definido ? <div className="flex flex-col gap-3"><Aviso tipo="info">{loja.ajudante
            ? "Peça ao dono para definir o nicho da loja e receber sugestões da sua área."
            : "Escolha o nicho da loja para receber sugestões de produtos da sua área."}</Aviso>
            {!loja.ajudante && (nicho && nichos.length > 0 ? <EscolherNicho sugestao={nicho} nichos={nichos} vitrineId={loja.id} />
              : <Aviso tipo="atencao">Não conseguimos carregar os nichos agora. Atualize a página para tentar novamente.</Aviso>)}</div> : dados.oportunidades.length === 0 ?
            <Vazio titulo="Ainda não há novas sugestões para sua loja" texto="As oportunidades aparecem conforme chegam buscas e pedidos da região que combinam com o seu nicho." /> :
            <div className="grid gap-3 sm:grid-cols-2">{dados.oportunidades.map((o) => <article key={`${o.categoria_id}:${o.termo}`} className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-4">
              <div><h3 className="font-bold [overflow-wrap:anywhere]">{o.termo}</h3><p className="text-legenda text-texto-suave">{o.categoria_nome}</p></div>
              <p className="text-sm">{o.buscas} {o.buscas === 1 ? "busca" : "buscas"} · {o.pedidos} {o.pedidos === 1 ? "pedido" : "pedidos"} no Radar{o.sem_resultado > 0 ? ` · ${o.sem_resultado} ${o.sem_resultado === 1 ? "busca sem resultado" : "buscas sem resultado"}` : ""}</p>
              {o.buscas + o.pedidos < 5 && <p className="text-legenda text-texto-suave">Sinal inicial, com poucos registros.</p>}
              <p className="text-sm text-texto-suave">Se você vende esse produto, comece um rascunho e confira os dados antes de publicar.</p>
              <div className="mt-auto"><BotaoNovoRascunho texto="Cadastrar produto" sugestao={{ vitrineId: loja.id, titulo: o.termo, categoriaId: o.categoria_id }} /></div>
            </article>)}</div>}
          <p className="text-legenda text-texto-suave">Uma pessoa pode fazer várias buscas. Os números são agregados e não identificam compradores.</p>
        </section>
      </>}
      {dicas && dicas.length > 0 && <section aria-labelledby="titulo-melhorias" className="flex flex-col gap-3 border-t border-borda pt-5">
        <h2 id="titulo-melhorias" className="text-lg font-bold">Melhorias nos seus anúncios</h2>
        {dicas.map((dica) => <Link key={dica.anuncio_id} className="rounded-card border border-borda bg-cartao p-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro"
          href={urlPasso(dica.motivo === "sem_foto" || dica.motivo === "poucas_fotos" ? "fotos" : dica.motivo === "sem_preco" ? "preco" : "detalhes", dica.anuncio_id, true)}>
          <span className="block font-semibold">{formatarNome(dica.titulo)}</span><span className="text-sm text-texto-suave">{dica.texto}</span></Link>)}
      </section>}
      {painelAtivo && <Botao href={LINK_LOJA_DESEMPENHO} variante="secundario">Ver desempenho da loja</Botao>}
    </PaginaConta>
  );
}
