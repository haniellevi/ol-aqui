import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChartNoAxesColumn, ChevronRight, Clock, ExternalLink, History, Image as IconeImagem, LayoutList, Megaphone, Pin, Sparkles, Store, Tags } from "lucide-react";
import { listarCidades } from "@/lib/dados/regiao";
import { meusRecursosVitrine, minhaVitrineCompleta, planosPublicos, vitrineNovaAtiva } from "@/lib/dados/vitrine-completa";
import { minhasSugestoesCategoria } from "@/lib/dados/categorias-ia";
import { lerHistorico } from "@/lib/dados/historico";
import { fraseHistorico } from "@/lib/historico";
import { linkLoja, preco } from "@/lib/formato";
import { formatarNome } from "@/lib/formatar-nome";
import { LINK_DESTACAR_LOJA, LINK_LOJA_BANNER, LINK_LOJA_CATEGORIAS, LINK_LOJA_DESEMPENHO, LINK_LOJA_FIXADOS, LINK_LOJA_HISTORICO, LINK_LOJA_INFORMACOES, LINK_LOJA_SECOES, LINK_LOJA_VERIFICAR, linkDestacarLoja } from "@/lib/rotas";
import { LojaPronta } from "@/components/anunciar/loja-pronta";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { FormMinhaLoja } from "@/components/conta/form-minha-loja";
import { DestaquesAtivos } from "@/components/destaques/destaques-ativos";
import { resultadosDestaques } from "@/lib/dados/destaques";
import { AvatarVitrine } from "@/components/vitrine/avatar-vitrine";
import { BannerLoja } from "@/components/vitrine/banner-loja";
import { textoDisponivelEm } from "@/components/vitrine/regras";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { ExcluirLoja, LojaNaLixeira } from "@/components/conta/excluir-loja";
import { lojaEscolhida, lojasQueCuido } from "@/lib/dados/loja-ativa";
import { SeletorLoja } from "@/components/conta/seletor-loja";
import { FormTerminarRecebimento } from "@/app/receber-loja/form-receber";
import { prontosPendentes } from "@/lib/dados/montagem";
import { textoMotivoVerificacaoLoja } from "@/lib/verificacao-loja/constantes";
import { LINK_LOJA_MARKETING } from "@/lib/rotas";

type ExclusaoLoja = { na_lixeira: boolean; apagar_apos: string | null; pode_restaurar: boolean | null; tem_pagamentos: boolean };

export const metadata: Metadata = { title: "Minha loja" };

// T38 · Minha loja (só para lojas): dados e logo aqui; banner, informações, seções próprias e
// produtos no topo em telas próprias (vitrine completa). O que o plano libera vem do banco.
export default async function PaginaMinhaLoja({ searchParams }: { searchParams: Promise<{ recebida?: string | string[] }> }) {
  const { recebida } = await searchParams;
  const v = await minhaVitrineCompleta(true);
  if (!v || v.tipo !== "loja") {
    return (
      <PaginaConta>
        <TopoConta titulo="Minha loja" />
        <Vazio
          titulo="Você ainda não tem uma loja"
          texto="Com uma loja você ganha uma vitrine com seu nome e seu link no Mercado da Região."
        >
          <Botao href="/quero-vender/loja" tamanho="acao" larguraTotal>
            Abrir minha loja
          </Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  // P5b-2b: o ajudante não vê verificação, Destacar, destaques, exclusão nem a revisão de categorias pela IA (são do dono).
  const ajudante = v.ajudante === true;
  const [cidades, recursos, planos, destaques, verificacaoR, envioR, exclusaoR, lojas, lojaAtual, prontos] = await Promise.all([
    listarCidades(v.microrregiao_id),
    meusRecursosVitrine(true),
    planosPublicos(),
    ajudante ? Promise.resolve([]) : resultadosDestaques(),
    ajudante ? Promise.resolve(null) : createClient().then((db) => db.rpc("minha_verificacao_loja")),
    ajudante ? Promise.resolve(null) : createClient().then((db) => db.rpc("minha_verificacao_loja_envio")),
    ajudante ? Promise.resolve(null) : createClient().then((db) => db.rpc("minha_loja_exclusao")),
    lojasQueCuido(),
    lojaEscolhida(),
    // P5c: o aceite pode ter parado depois de mudar as fotos e antes de publicar os prontos.
    ajudante || v.status !== "ativa" || v.pasta_montagem ? Promise.resolve(0) : prontosPendentes(v.id),
  ]);
  const vitrineNova = await vitrineNovaAtiva(v.microrregiao_id).catch(() => false);
  // Vitrine com IA (etapa 4): sugestões de categoria, só com a vitrine nova ligada.
  const sugestoesIA = vitrineNova && !ajudante ? await minhasSugestoesCategoria(v.id) : undefined;
  // Última mudança nos dados da loja (Etapa P5a). Falha → o item mostra só o texto padrão.
  const ultimaMudanca = (await lerHistorico({ loja: v.id }, 1).catch(() => null))?.[0];
  const exclusao = !exclusaoR || exclusaoR.error ? null : (exclusaoR.data as ExclusaoLoja | null);
  if (exclusao?.na_lixeira) {
    return (
      <PaginaConta>
        <TopoConta titulo="Minha loja" />
        <LojaNaLixeira apagarApos={exclusao.apagar_apos} podeRestaurar={exclusao.pode_restaurar === true} />
      </PaginaConta>
    );
  }
  const verificacao = verificacaoR && !verificacaoR.error && Array.isArray(verificacaoR.data)
    ? verificacaoR.data[0] as { estado: string; motivo: string | null } | undefined
    : undefined;
  // Situação do último envio de documentos (nao_enviada, conferindo, equipe, ...). Sem ela, não oferecemos o botão em "pendente".
  const envioStatus = envioR && !envioR.error && Array.isArray(envioR.data)
    ? (envioR.data[0] as { status?: string } | undefined)?.status
    : undefined;
  const podeVerificar = verificacao?.estado === "correcao" || verificacao?.estado === "recusada"
    || (verificacao?.estado === "pendente" && (envioStatus === "nao_enviada" || envioStatus === "obsoleta"));
  const destaquesLoja = destaques.filter((d) => d.tipo === "loja");
  const lojaPendente = destaquesLoja.find((d) => d.status === "aguardando_pagamento" && d.pagamento_status === "pendente");
  const fotoGuardadaSemPlano = v.banner_tipo === "foto" && !recursos.foto_fachada;

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
      <TopoConta titulo="Minha loja" acao={v.status === "ativa" ? (
          <Botao href={linkLoja(v.slug)} variante="secundario" tamanho="toque" icone={<ExternalLink />} className="max-w-full">
            Ver vitrine
          </Botao>
      ) : undefined} />
      <SeletorLoja lojas={lojas} atual={lojaAtual} voltar="/minha-conta/loja" />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-borda bg-cartao p-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <AvatarVitrine nome={v.nome} logo={v.logo_url} tamanho="md" />
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h2 className="text-lg font-semibold text-beringela">{formatarNome(v.nome)}</h2>
            <p className="text-sm text-texto-suave">{[v.bairro, v.cidade].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <Botao href="#dados-da-loja" variante="texto" tamanho="toque">Editar dados</Botao>
      </div>

      {v.status === "ativa" && <Card>
        <CardHeader><h2 className="text-lg font-semibold">Prepare sua loja para divulgar</h2></CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base">
            <li><Link href="#dados-da-loja" className="inline-flex min-h-toque items-center text-laranja-escuro underline">Confira nome, foto e contato</Link></li>
            <li><Link href={LINK_LOJA_INFORMACOES} className="inline-flex min-h-toque items-center text-laranja-escuro underline">{v.endereco ? "Confira endereço e horários" : "Adicione endereço e horários"}</Link></li>
            <li><Link href="/minha-conta/anuncios" className="inline-flex min-h-toque items-center text-laranja-escuro underline">Confira seus anúncios e publique o primeiro</Link></li>
            <li><Link href={linkLoja(v.slug)} className="inline-flex min-h-toque items-center text-laranja-escuro underline">Abra a vitrine e compartilhe o link</Link></li>
          </ol>
        </CardContent>
      </Card>}

      {/* P5c: loja montada pela equipe (só ela vê) e loja recém-recebida pelo dono. */}
      {v.status === "montagem" ? (
        <Aviso tipo="info">Loja em montagem: só a equipe vê. Ela vai ao ar quando o dono aceitar o convite. Nome e endereço mudam no painel.</Aviso>
      ) : v.status !== "ativa" && (
        <Aviso tipo="atencao">
          {v.status === "suspensa"
            ? "Sua loja está suspensa e não aparece no site. Fale com o suporte."
            : "Sua loja está com pagamento atrasado. Veja em Meu plano."}
        </Aviso>
      )}
      {!ajudante && (v.pasta_montagem || prontos > 0) ? (
        <>
          <Aviso tipo="atencao">
            {v.pasta_montagem
              ? "Falta terminar de receber a loja: as fotos ainda não passaram para a sua conta."
              : "Falta terminar de receber a loja: os produtos prontos ainda não foram publicados."}
          </Aviso>
          <FormTerminarRecebimento loja={v.id} />
        </>
      ) : !ajudante && typeof recebida === "string" && fraseRecebida(recebida) && (
        <>
          <Aviso tipo="ok">{fraseRecebida(recebida)}</Aviso>
          <LojaPronta slug={v.slug} recebida />
        </>
      )}
      {v.status === "montagem" ? null : ajudante ? (
        <Aviso tipo="info">Você ajuda nesta loja. Nome, WhatsApp, plano, Destacar e excluir a loja ficam com o dono.</Aviso>
      ) : verificacao?.estado === "aprovada" ? (
        <Aviso tipo="ok">Loja verificada.</Aviso>
      ) : verificacao?.estado === "pendente" ? (
        <Aviso tipo="info">
          Verificação pendente. A equipe vai conferir os dados, os links e o contato da loja.
          {podeVerificar && <BotaoVerificar />}
        </Aviso>
      ) : verificacao?.estado === "correcao" || verificacao?.estado === "recusada" ? (
        <Aviso tipo="atencao">
          <p>{verificacao.estado === "correcao" ? "A loja precisa de correções." : "A verificação da loja foi recusada."}</p>
          <p className="font-normal">{textoMotivoVerificacaoLoja(verificacao.motivo ?? "outro")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <BotaoVerificar />
            <Botao href="/ajuda" variante="texto" tamanho="toque" className="px-2">Ajuda</Botao>
          </div>
        </Aviso>
      ) : (
        <Aviso tipo="atencao">A situação da verificação está indisponível agora. Atualize a página para consultar novamente.</Aviso>
      )}
      {recursos.banner_moderado_motivo && (
        <Aviso tipo="atencao">
          <span>A equipe do Mercado da Região tirou a foto do seu banner.</span>
          <span className="font-normal">Motivo: {recursos.banner_moderado_motivo}</span>
        </Aviso>
      )}

      <section aria-labelledby="titulo-vitrine" className="flex flex-col gap-3">
        <h2 id="titulo-vitrine" className="text-lg font-semibold text-beringela">
          Sua vitrine
        </h2>
        <div className="mx-auto w-2/3 max-w-sm overflow-hidden rounded-card border border-borda md:w-full md:max-w-none">
          <BannerLoja
            tipo={recursos.foto_fachada ? v.banner_tipo : "modelo"}
            url={v.banner_url}
            modelo={v.banner_modelo}
            cor={v.banner_cor}
            nome={v.nome}
            logo={v.logo_url}
          />
        </div>
        <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
          <ItemMenu href={LINK_LOJA_BANNER} icone={<IconeImagem />} titulo="Capa da loja" detalhe={fotoGuardadaSemPlano ? "Modelo em uso. Foto guardada." : v.banner_tipo === "foto" ? "Foto da fachada" : "Modelo com cor"} />
          <ItemMenu href={LINK_LOJA_INFORMACOES} icone={<Store />} titulo="Horários e informações" detalhe="Endereço, Instagram, pagamento e entrega" />
          <ItemMenu href={LINK_LOJA_SECOES} icone={<LayoutList />} titulo="Seções próprias" detalhe={usoSecoes} />
          <ItemMenu href={LINK_LOJA_FIXADOS} icone={<Pin />} titulo="Produtos no topo" detalhe={usoFixados} />
          {sugestoesIA !== undefined && (
            <ItemMenu href={LINK_LOJA_CATEGORIAS} icone={<Tags />} titulo="Revise suas categorias"
              detalhe={sugestoesIA === null ? "Nicho e categorias sugeridos pela IA" : sugestoesIA.length === 0 ? "Tudo organizado" : sugestoesIA.length === 1 ? "1 sugestão da IA" : `${sugestoesIA.length} sugestões da IA`} />
          )}
        </ul>
      </section>

      <section aria-labelledby="titulo-gestao-loja" className="flex flex-col gap-3">
        <h2 id="titulo-gestao-loja" className="text-lg font-semibold text-beringela">Gestão da loja</h2>
        <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
          {vitrineNova && (
            <ItemMenu href={LINK_LOJA_DESEMPENHO} icone={<ChartNoAxesColumn />} titulo="Desempenho da loja" detalhe="Visitas, cliques no WhatsApp e dicas" />
          )}
          <ItemMenu href={LINK_LOJA_MARKETING} icone={<Megaphone />} titulo="Meu marketing" detalhe="Artes para divulgar e produtos procurados na região" />
          <ItemMenu href={LINK_LOJA_HISTORICO} icone={<History />} titulo="Histórico da loja"
            detalhe={ultimaMudanca ? fraseHistorico(ultimaMudanca, new Date(), "loja") : "Quem mudou os dados da loja e quando"} />
        </ul>
      </section>
      <section aria-labelledby="dados-da-loja" className="flex flex-col gap-3">
        <h2 id="dados-da-loja" tabIndex={-1} className="scroll-mt-20 text-lg font-semibold text-beringela">
          Dados da loja
        </h2>
        {/* key: ao trocar de loja no seletor, o formulário recomeça com os dados da loja nova. */}
        <FormMinhaLoja
          key={v.id}
          loja={{
            nome: v.nome,
            whatsapp: v.whatsapp,
            cidade: v.cidade,
            bairro: v.bairro,
            logo_url: v.logo_url,
          }}
          cidades={cidades}
          ajudante={ajudante}
        />
      </section>
      {v.status === "ativa" && !ajudante && (
        <section aria-labelledby="titulo-destacar-loja" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-3 sm:p-4">
          <h2 id="titulo-destacar-loja" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-laranja-escuro" aria-hidden />
            Destacar minha loja
          </h2>
          <p className="text-base text-texto-suave">Apareça em Destaques da Região na página inicial.</p>
          {lojaPendente ? (
            <>
              <Alert variant="warning" role="note" className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Pagamento pendente: {lojaPendente.tipo_nome} ({preco(lojaPendente.preco_centavos)})
              </Alert>
              <Botao href={linkDestacarLoja(lojaPendente.id)} variante="secundario" tamanho="toque" larguraTotal className="sm:w-fit">
                Continuar o pagamento
              </Botao>
            </>
          ) : (
            <Botao href={LINK_DESTACAR_LOJA} variante="secundario" tamanho="toque" larguraTotal icone={<Sparkles />} className="sm:w-fit">
              Ver opções de destaque
            </Botao>
          )}
        </section>
      )}
      <DestaquesAtivos lista={destaquesLoja} titulo="Destaques da loja" />
      {exclusao && !ajudante && v.status !== "suspensa" && (
        <section aria-labelledby="titulo-excluir-loja" className="flex flex-col gap-3">
          <h2 id="titulo-excluir-loja" className="text-lg font-semibold text-beringela">
            Excluir loja
          </h2>
          <p className="text-base text-texto-suave">Tira a vitrine e os anúncios da loja do ar. Você tem 30 dias para desistir.</p>
          {/* Loja com pagamento atrasado também pode sair; só a suspensa pela equipe não. */}
          <ExcluirLoja temPagamentos={exclusao.tem_pagamentos} />
        </section>
      )}
    </PaginaConta>
  );
}

function BotaoVerificar() {
  return (
    <Botao href={LINK_LOJA_VERIFICAR} variante="secundario" tamanho="toque" className="w-fit max-w-full">
      Verificar minha loja
    </Botao>
  );
}

function ItemMenu({ href, icone, titulo, detalhe }: { href: string; icone: ReactNode; titulo: string; detalhe: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-toque items-center gap-3 rounded-campo px-3 py-2 hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-campo bg-selecao text-beringela [&>svg]:size-4" aria-hidden>
          {icone}
        </span>
        <span className="flex min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
          <span className="text-base font-semibold">{titulo}</span>
          <span className="text-sm text-texto-suave">{detalhe}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
      </Link>
    </li>
  );
}

/** P5c: "3-1-0" (no ar, em análise, rascunho) → frase do recebimento da loja. */
function fraseRecebida(recebida: string): string | null {
  const n = /^(\d{1,4})-(\d{1,4})-(\d{1,4})$/.exec(recebida)?.slice(1).map(Number);
  if (!n) return null;
  const [noAr, analise, rascunho] = n;
  const partes = [
    noAr && (noAr === 1 ? "1 produto foi ao ar" : `${noAr} produtos foram ao ar`),
    analise && (analise === 1 ? "1 está em análise" : `${analise} estão em análise`),
    rascunho && (rascunho === 1 ? "1 ficou como rascunho para você revisar" : `${rascunho} ficaram como rascunho para você revisar`),
  ].filter(Boolean);
  return `Loja recebida. Ela é sua e já está no ar.${partes.length ? ` ${partes.join(", ")}.` : ""}`;
}
