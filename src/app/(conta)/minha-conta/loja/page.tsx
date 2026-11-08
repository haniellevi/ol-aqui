import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChevronRight, Clock, ExternalLink, Image as IconeImagem, LayoutList, Pin, Sparkles, Store } from "lucide-react";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { listarCidades } from "@/lib/dados/regiao";
import { meusRecursosVitrine, minhaVitrineCompleta, planosPublicos } from "@/lib/dados/vitrine-completa";
import { linkLoja, preco, urlAbsoluta } from "@/lib/formato";
import { LINK_DESTACAR_LOJA, LINK_LOJA_BANNER, LINK_LOJA_FIXADOS, LINK_LOJA_INFORMACOES, LINK_LOJA_SECOES, linkDestacarLoja } from "@/lib/rotas";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { FormMinhaLoja } from "@/components/conta/form-minha-loja";
import { DestaquesAtivos } from "@/components/destaques/destaques-ativos";
import { resultadosDestaques } from "@/lib/dados/destaques";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { textoDisponivelEm } from "@/components/vitrine/regras";

export const metadata: Metadata = { title: "Minha loja" };

// T38 · Minha loja (só para lojas): dados e logo aqui; banner, informações, seções próprias e
// produtos no topo em telas próprias (vitrine completa). O que o plano libera vem do banco.
export default async function PaginaMinhaLoja() {
  const conta = await meuPerfilEVitrine();
  const v = conta?.vitrine;
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Minha loja" />
        <Vazio
          titulo="Você ainda não tem uma loja"
          texto="Com uma loja você ganha uma vitrine com seu nome e seu link no OLAKI."
        >
          <Botao href="/quero-vender/loja" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const [cidades, completa, recursos, planos, destaques] = await Promise.all([
    listarCidades(v.microrregiao_id),
    minhaVitrineCompleta(),
    meusRecursosVitrine(),
    planosPublicos(),
    resultadosDestaques(),
  ]);
  const destaquesLoja = destaques.filter((d) => d.tipo === "loja");
  const lojaPendente = destaquesLoja.find((d) => d.status === "aguardando_pagamento" && d.pagamento_status === "pendente");
  const endereco = urlAbsoluta(linkLoja(v.slug)).replace(/^https?:\/\//, "");
  const fotoGuardadaSemPlano = completa?.banner_tipo === "foto" && !recursos.foto_fachada;

  const usoSecoes =
    recursos.secoes_max === 0
      ? textoDisponivelEm(planos, "secoes") ?? "Fora do seu plano"
      : recursos.secoes_max === null
        ? `${recursos.secoes_total} ${recursos.secoes_total === 1 ? "seção" : "seções"}`
        : `${recursos.secoes_total} de ${recursos.secoes_max} seções`;
  const usoFixados =
    recursos.fixados_max === 0
      ? textoDisponivelEm(planos, "fixados") ?? "Fora do seu plano"
      : recursos.fixados_max === null
        ? `${recursos.fixados_total} no topo`
        : `${recursos.fixados_total} de ${recursos.fixados_max} no topo`;

  return (
    <PaginaConta>
      <TopoConta titulo="Minha loja">
        <p className="break-all text-base text-texto-suave">
          Sua vitrine: <strong className="text-texto">{endereco}</strong>
        </p>
        {v.status === "ativa" && (
          <Botao href={linkLoja(v.slug)} variante="secundario" icone={<ExternalLink />} larguraTotal className="sm:w-fit">
            Ver minha vitrine
          </Botao>
        )}
      </TopoConta>

      {v.status !== "ativa" && (
        <Aviso tipo="atencao">
          {v.status === "suspensa"
            ? "Sua loja está suspensa e não aparece no site. Fale com o suporte."
            : "Sua loja está com pagamento atrasado. Veja em Meu plano."}
        </Aviso>
      )}
      {recursos.banner_moderado_motivo && (
        <Aviso tipo="atencao">
          <span>A equipe do OLAKI tirou a foto do seu banner.</span>
          <span className="font-normal">Motivo: {recursos.banner_moderado_motivo}</span>
        </Aviso>
      )}

      {v.status === "ativa" && (
        <section aria-labelledby="titulo-destacar-loja" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
          <h2 id="titulo-destacar-loja" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
            Destacar minha loja
          </h2>
          <p className="text-base text-texto-suave">Sua loja aparece em &quot;Lojas em destaque&quot; na página inicial da sua região.</p>
          {lojaPendente ? (
            <>
              <p className="flex items-start gap-2 rounded-card bg-aviso-fundo p-3 text-sm font-semibold text-aviso">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Pagamento pendente: {lojaPendente.tipo_nome} ({preco(lojaPendente.preco_centavos)})
              </p>
              <Botao href={linkDestacarLoja(lojaPendente.id)} variante="secundario" larguraTotal className="sm:w-fit">
                Continuar o pagamento
              </Botao>
            </>
          ) : (
            <Botao href={LINK_DESTACAR_LOJA} variante="secundario" larguraTotal icone={<Sparkles />} className="sm:w-fit">
              Ver opções de destaque
            </Botao>
          )}
        </section>
      )}
      <DestaquesAtivos lista={destaquesLoja} titulo="Destaques da loja" />


      {completa && (
        <section aria-labelledby="titulo-vitrine" className="flex flex-col gap-3">
          <h2 id="titulo-vitrine" className="text-lg font-bold">
            Sua vitrine
          </h2>
          <div className="overflow-hidden rounded-card shadow-1">
            <BannerLoja
              tipo={recursos.foto_fachada ? completa.banner_tipo : "modelo"}
              url={completa.banner_url}
              modelo={completa.banner_modelo}
              cor={completa.banner_cor}
              nome={completa.nome}
              logo={completa.logo_url}
            />
          </div>
          {fotoGuardadaSemPlano && (
            <p className="text-sm text-texto-suave">
              Sua foto da fachada está guardada, mas o seu plano de agora mostra o banner modelo. Ela volta quando o plano tiver foto.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            <ItemMenu href={LINK_LOJA_BANNER} icone={<IconeImagem />} titulo="Banner" detalhe={completa.banner_tipo === "foto" && recursos.foto_fachada ? "Foto da fachada" : "Modelo com cor"} />
            <ItemMenu href={LINK_LOJA_INFORMACOES} icone={<Store />} titulo="Informações da loja" detalhe="Endereço, horário, Instagram, pagamento e entrega" />
            <ItemMenu href={LINK_LOJA_SECOES} icone={<LayoutList />} titulo="Seções próprias" detalhe={usoSecoes} />
            <ItemMenu href={LINK_LOJA_FIXADOS} icone={<Pin />} titulo="Produtos no topo" detalhe={usoFixados} />
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-dados" className="flex flex-col gap-3">
        <h2 id="titulo-dados" className="text-lg font-bold">
          Dados da loja
        </h2>
        <FormMinhaLoja
          loja={{
            nome: v.nome,
            whatsapp: v.whatsapp,
            cidade: v.cidade,
            bairro: v.bairro,
            logo_url: v.logo_url,
          }}
          cidades={cidades}
        />
      </section>
    </PaginaConta>
  );
}

function ItemMenu({ href, icone, titulo, detalhe }: { href: string; icone: ReactNode; titulo: string; detalhe: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-laranja-claro text-beringela [&>svg]:size-5" aria-hidden>
          {icone}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold">{titulo}</span>
          <span className="text-sm text-texto-suave">{detalhe}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
      </Link>
    </li>
  );
}
