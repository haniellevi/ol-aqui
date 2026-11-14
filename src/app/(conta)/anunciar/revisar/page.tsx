import { RegistrarAnuncio } from "@/components/assistente/retomar";
import { comAssistente } from "@/lib/assistente";
import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Info } from "lucide-react";
import { anuncioPublico } from "@/lib/dados/anuncios";
import { completarCards } from "@/lib/dados/cards-extra";
import { categoriaDoAnuncio, categoriaPorId } from "@/lib/dados/categorias";
import { nomeCaminho } from "@/lib/categorias-arvore";
import { lerConfigNumero } from "@/lib/dados/config";
import { avulsoParaMim } from "@/lib/dados/cobranca";
import { resultadosDestaques } from "@/lib/dados/destaques";
import { preco, valorDoCampo } from "@/lib/formato";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { CabecalhoPasso } from "@/components/anunciar/cabecalho-passo";
import { CorpoPasso } from "@/components/anunciar/barra-continuar";
import { DescartarAnuncio } from "@/components/anunciar/descartar-anuncio";
import { BotaoPublicar } from "@/components/anunciar/botao-publicar";
import { STATUS_PUBLICADO, urlPasso, type SlugPasso } from "@/components/anunciar/passos";
import { carregarPasso, type ParamsPasso } from "../_carregar";
import { LINK_PLANOS, linkAvulso } from "@/lib/rotas";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Anunciar · Revisar" };

const FORM = "form-publicar";

type Linha = { rotulo: string; valor: string; passo: SlugPasso; falta?: boolean; expansivel?: boolean };

// T22 · Passo 6: o card exatamente como vai aparecer, o resumo com "Alterar" em cada item e Publicar.
export default async function PassoRevisar({ searchParams }: { searchParams: ParamsPasso }) {
  const { anuncio, conta, editar, equipe , assistente } = await carregarPasso(searchParams);
  const jaPublicado = (STATUS_PUBLICADO as readonly string[]).includes(anuncio.status);
  const pagoAte = anuncio.pago_ate && new Date(anuncio.pago_ate).getTime() > Date.now() ? anuncio.pago_ate : null;
  // nunca esteve no ar: só vale categoria visível (o banco recusa publicar em categoria escondida)
  const nuncaNoAr = !anuncio.publicado_em;
  const [publico, achada, minimoFotos, avulso, destaques, [extra]] = await Promise.all([
    anuncioPublico(anuncio.id),
    anuncio.categoria_id ? (nuncaNoAr ? categoriaPorId : categoriaDoAnuncio)(anuncio.categoria_id) : Promise.resolve(null),
    lerConfigNumero("anuncio.fotos_minimo", conta.vitrine.microrregiao_id),
    !jaPublicado && !conta.podePublicar && !pagoAte && !conta.ajudante ? avulsoParaMim(conta.vitrine) : Promise.resolve(null),
    equipe ? Promise.resolve([]) : resultadosDestaques(anuncio.id),
    completarCards([{ id: anuncio.id }]), // preço antes (riscado) e UF da cidade, para a prévia sair igual ao site
  ]);
  // P6: aviso de pagamento ao descartar, com o mesmo critério de Meus anúncios:
  // avulso pago, destaque no ar ou destaque esperando pagamento.
  const destaqueAtivo = Boolean(anuncio.destaque_ate) && new Date(anuncio.destaque_ate as string).getTime() > Date.now();
  const destaquePendente = destaques.some((d) => d.status === "aguardando_pagamento" && d.pagamento_status === "pendente");
  const temPagamento = Boolean(pagoAte) || destaqueAtivo || destaquePendente;
  const hrefAvulso = avulso ? comAssistente(linkAvulso(anuncio.id), assistente) : null;

  const modo = jaPublicado ? "salvar" : anuncio.status === "rascunho" ? "publicar" : "republicar";
  const categoriaSumiu = Boolean(anuncio.categoria_id) && !achada && nuncaNoAr;
  const campos = achada?.pai ? achada.categoria.campos : categoriaSumiu ? [] : publico?.campos ?? [];
  const titulo = anuncio.titulo?.trim() ?? "";

  const linhas: Linha[] = [
    {
      rotulo: "Fotos",
      valor: anuncio.fotos.length === 1 ? "1 foto" : `${anuncio.fotos.length} fotos`,
      passo: "fotos",
      falta: anuncio.fotos.length < (minimoFotos ?? 0),
    },
    {
      rotulo: "Categoria",
      valor: categoriaSumiu
        ? "Não está mais disponível. Escolha outra"
        : achada
          ? nomeCaminho(achada.caminho)
          : publico?.categoria_nome ?? "Falta escolher",
      passo: "categoria",
      falta: !anuncio.categoria_id || categoriaSumiu,
    },
    { rotulo: "Título", valor: formatarNome(titulo) || "Falta escrever", passo: "detalhes", falta: titulo.length < 5 },
    ...campos.map<Linha>((c) => {
      const v = valorDoCampo(c, anuncio.atributos[c.chave]);
      return { rotulo: c.rotulo, valor: v || (c.obrigatorio ? "Falta preencher" : "Não informado"), passo: "detalhes", falta: c.obrigatorio && !v };
    }),
    {
      rotulo: "Descrição",
      valor: anuncio.descricao || "Sem descrição",
      expansivel: (anuncio.descricao?.length ?? 0) > 240,
      passo: "detalhes",
    },
    { rotulo: "Preço", valor: `${preco(anuncio.preco_centavos)}${anuncio.aceita_troca ? " · Aceito troca" : ""}`, passo: "preco" },
    {
      rotulo: "Local",
      valor: anuncio.cidade ? [anuncio.bairro, anuncio.cidade].filter(Boolean).join(", ") : "Falta escolher a cidade",
      passo: "local",
      falta: !anuncio.cidade,
    },
  ];
  const faltando = linhas.filter((l) => l.falta);
  const grupos = [
    { passo: "fotos", titulo: "Fotos" },
    { passo: "categoria", titulo: "Categoria" },
    { passo: "detalhes", titulo: "Detalhes" },
    { passo: "preco", titulo: "Preço" },
    { passo: "local", titulo: "Local" },
  ] as const;
  const v = conta.vitrine;

  return (
    <CorpoPasso>
      {assistente && !editar && !equipe && <RegistrarAnuncio dono={conta.perfil.id} tentativa={assistente} id={anuncio.id} passo="revisar" />}
      <CabecalhoPasso assistente={assistente} equipe={equipe}
        passo="revisar"
        id={anuncio.id}
        editar={editar}
        titulo={jaPublicado ? "Confira as mudanças" : "Confira antes de publicar"}
      />

      {faltando.length > 0 && (
        <Alert variant="warning" role="status" className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-aviso" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Complete para publicar</p>
            <ul className="list-disc pl-5">
              {faltando.map((l) => (
                <li key={l.rotulo}>
                  <Link href={urlPasso(l.passo, anuncio.id, editar, true, assistente)} className="inline-flex min-h-toque items-center font-semibold text-laranja-escuro underline underline-offset-4">
                    {l.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {!jaPublicado && pagoAte && (
        <div className="flex gap-3 rounded-card bg-fundo p-3 text-base">
          <Info className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <p>Anúncio avulso pago. Toque em Publicar para pôr no ar.</p>
        </div>
      )}

      {!jaPublicado && !pagoAte && !conta.podePublicar && (
        <div className="flex gap-3 rounded-card bg-fundo p-3 text-base">
          <Info className="mt-0.5 size-5 shrink-0 text-beringela" aria-hidden />
          <p>
            {conta.ajudante ? "A loja chegou ao limite de anúncios do plano. O anúncio fica guardado como rascunho. Fale com o dono da loja para trocar de plano." : (
            <>
            Você chegou ao limite de anúncios do seu plano. O anúncio fica guardado como rascunho.{" "}
            {avulso && hrefAvulso ? (
              <>
                Para pôr só este no ar, pague o anúncio avulso por {preco(avulso.preco)}.{" "}
                <Link href={hrefAvulso} className="font-semibold text-laranja-escuro underline underline-offset-4">
                  Pagar anúncio avulso
                </Link>{" "}
                ou{" "}
              </>
            ) : null}
            <Link href={LINK_PLANOS} className="font-semibold text-laranja-escuro underline underline-offset-4">
              {avulso ? "ver planos" : "Ver planos"}
            </Link>
            </>
            )}
          </p>
        </div>
      )}

      {anuncio.status === "em_analise" && (
        <Alert variant="warning" role="note">
          Este anúncio aguarda conferência da equipe.
          {anuncio.motivo_analise && <> <strong>Motivo:</strong> {anuncio.motivo_analise}</>}
        </Alert>
      )}

      {!jaPublicado && (
        <p className="text-sm text-texto-suave">
          {conta.vitrine.status === "montagem"
            ? "A loja ainda está em montagem. Ao publicar, o produto fica pronto e vai ao ar quando o dono aceitar a loja, depois da conferência de sempre."
            : "Se o anúncio precisar de conferência, você poderá acompanhar em Meus anúncios."}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="titulo-previa" className="w-full max-w-52 sm:max-w-none">
        <h2 id="titulo-previa" className="mb-2 text-lg font-semibold text-beringela">Prévia na busca</h2>
        <CardAnuncio
          prioridade
          compacto
          semLink
          anuncio={{
            id: anuncio.id,
            slug: null, // rascunho: o endereço só nasce ao publicar
            titulo: formatarNome(titulo) || "Seu anúncio",
            preco_centavos: anuncio.preco_centavos,
            cidade: anuncio.cidade ?? v.cidade,
            capa: anuncio.fotos[0] ?? null,
            criado_em: anuncio.publicado_em ?? new Date().toISOString(),
            destaque: publico?.destaque ?? false,
            vitrine_nome: formatarNome(publico?.vitrine_nome ?? v.nome),
            vitrine_selo: publico?.vitrine_selo ?? v.selo_loja_verificada,
            vitrine_tipo: publico?.vitrine_tipo ?? v.tipo,
            preco_antes_centavos: extra?.preco_antes_centavos ?? null,
            uf: extra?.uf ?? null,
          }}
        />
      </section>
        <section aria-labelledby="titulo-resumo" className="min-w-0">
          <h2 id="titulo-resumo" className="mb-2 text-lg font-semibold text-beringela">Dados do anúncio</h2>
          <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
            {grupos.map(({ passo, titulo }) => (
              <li key={passo} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 px-3 py-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-beringela">{titulo}</h3>
                  <dl className="mt-0.5 flex flex-col gap-2">
                    {linhas.filter((linha) => linha.passo === passo).map((linha) => (
                      <div key={linha.rotulo} className="min-w-0">
                        <dt className={passo === "detalhes" ? "text-xs text-texto-suave" : "sr-only"}>{linha.rotulo}</dt>
                        <dd className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${linha.falta ? "font-semibold text-perigo" : ""}`}>
                          {linha.expansivel ? (
                            <details>
                              <summary className="min-h-toque cursor-pointer rounded-campo py-3 text-sm font-semibold text-laranja-escuro focus-visible:outline-2">Ver descrição completa</summary>
                              <p>{linha.valor}</p>
                            </details>
                          ) : linha.valor}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <Link
                  href={urlPasso(passo, anuncio.id, editar, true, assistente)}
                  className="inline-flex min-h-toque min-w-toque items-center justify-center rounded-campo px-2 text-sm font-semibold text-laranja-escuro hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
                  aria-label={`Alterar ${titulo.toLowerCase()}`}
                >
                  Alterar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* P6: rascunho → "Descartar rascunho"; publicado (fim da edição) → "Excluir anúncio". A equipe usa a lixeira do painel. */}
      {!equipe && <DescartarAnuncio tamanho="toque" id={anuncio.id} titulo={anuncio.titulo} rascunho={anuncio.status === "rascunho"} temPagamento={temPagamento} />}

      <BotaoPublicar assistente={assistente} id={anuncio.id} editar={editar} formId={FORM} modo={modo} linkAvulso={hrefAvulso} />
    </CorpoPasso>
  );
}
