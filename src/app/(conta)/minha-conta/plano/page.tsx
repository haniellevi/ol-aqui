import type { Metadata } from "next";
import Link from "next/link";
import { LINK_PLANOS, linkAvulso, linkMeuPlano } from "@/lib/rotas";
import { auth } from "@clerk/nextjs/server";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { ehUuid, preco } from "@/lib/formato";
import { ambienteAsaas, asaasConfigurado } from "@/lib/asaas";
import { precisaDocumento } from "@/lib/cobranca-destaque";
import { meuPagamento, minhaAssinatura, opcoesAssinatura } from "@/lib/dados/cobranca";
import { linkPagamentoSeguro } from "@/lib/link-pagamento";
import type { Plano } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { dataPorExtenso, resumoPlano } from "@/components/conta/resumo-plano";
import { EscolherPlano } from "@/components/cobranca/escolher-plano";

export const metadata: Metadata = { title: "Meu plano" };

// T33 · Meu plano e faturas: plano atual, uso do limite, vencimento, aviso de renovar, troca marcada,
// planos à venda com período e regra antes de pagar (Pix/cartão pelo Asaas) e pagamentos.
// Preços, períodos e limites vêm do banco (planos e configuracoes). Sem ASAAS_API_KEY: "Pagamento em breve".
// ?plano=<codigo> já escolhe um plano; ?p=<pagamento> retoma um pagamento.

const COLUNAS_PLANO =
  "codigo, nome, descricao, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem";

type Pagamento = {
  id: string;
  tipo: "assinatura" | "anuncio_avulso" | "destaque";
  plano_codigo: string | null;
  anuncio_id: string | null;
  valor_centavos: number;
  forma: "pix" | "boleto" | "cartao" | null;
  status: "pendente" | "pago" | "vencido" | "estornado" | "cancelado";
  vencimento: string | null;
  pago_em: string | null;
  link_pagamento: string | null;
  criado_em: string;
};

const TIPO_PAGAMENTO: Record<Pagamento["tipo"], string> = {
  assinatura: "Plano",
  anuncio_avulso: "Anúncio avulso",
  destaque: "Destaque",
};
const STATUS_PAGAMENTO: Record<Pagamento["status"], { texto: string; cor: string }> = {
  pendente: { texto: "Aguardando", cor: "bg-aviso-fundo text-aviso" },
  pago: { texto: "Pago", cor: "bg-sucesso-fundo text-verde-escuro" },
  vencido: { texto: "Vencido", cor: "bg-perigo-fundo text-perigo" },
  estornado: { texto: "Devolvido", cor: "bg-fundo text-texto-suave" },
  cancelado: { texto: "Cancelado", cor: "bg-fundo text-texto-suave" },
};
const FORMA: Record<NonNullable<Pagamento["forma"]>, string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão" };

async function lerPlanos(): Promise<Plano[]> {
  {
    const db = await createClient();
    const { data, error } = await db.from("planos").select(COLUNAS_PLANO).order("ordem");
    if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar os planos.");
    return data as Plano[];
  }
}

async function lerPagamentos(vitrineId: string, pagina: number): Promise<{ lista: Pagamento[]; total: number }> {
  {
    const { userId } = await auth();
    if (!userId) throw new Error("Entre para ver os pagamentos.");
    const db = await createClient();
    const { data, error, count } = await db
      .from("pagamentos")
      .select("id, tipo, plano_codigo, anuncio_id, valor_centavos, forma, status, vencimento, pago_em, link_pagamento, criado_em", { count: "exact" })
      .eq("vitrine_id", vitrineId)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range((pagina - 1) * 12, pagina * 12 - 1);
    if (error || !Array.isArray(data) || count === null) throw new Error("Não foi possível carregar seus pagamentos.");
    return { lista: data as Pagamento[], total: count };
  }
}

type Params = Promise<{ plano?: string | string[]; p?: string | string[]; pagina?: string | string[] }>;

export default async function PaginaMeuPlano({ searchParams }: { searchParams: Params }) {
  const busca = await searchParams;
  const planoPedido = typeof busca.plano === "string" ? busca.plano.slice(0, 60) : null;
  const pagamentoPedido = typeof busca.p === "string" && ehUuid(busca.p) ? busca.p : null;
  const numeroPagina = Number(busca.pagina);
  const pagina = Number.isInteger(numeroPagina) && numeroPagina > 0 && numeroPagina <= 1000 ? numeroPagina : 1;
  const conta = await meuPerfilEVitrine(true);
  if (!conta?.vitrine) {
    return (
      <PaginaConta>
        <TopoConta titulo="Meu plano" />
        <Vazio titulo="Você ainda não vende no OLAKI" texto="Escolha como quer vender e o plano aparece aqui.">
          <Botao href="/quero-vender" larguraTotal>Quero vender</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const vitrine = conta.vitrine;
  const pagamentoLigado = asaasConfigurado();
  const [planos, historico, assinatura, opcoes, doc, retomado, ambiente] = await Promise.all([
    lerPlanos(),
    lerPagamentos(vitrine.id, pagina),
    minhaAssinatura(),
    opcoesAssinatura(),
    pagamentoLigado ? precisaDocumento(vitrine.id) : Promise.resolve(false),
    pagamentoPedido ? meuPagamento(pagamentoPedido) : Promise.resolve(null),
    pagamentoLigado ? ambienteAsaas() : Promise.resolve(null),
  ]);
  if (!assinatura || assinatura.vitrine_id !== vitrine.id) throw new Error("Não foi possível confirmar sua assinatura.");
  const pagamentos = historico.lista;
  const resumo = resumoPlano(conta)!;
  const nomes = new Map(planos.map((p) => [p.codigo, p.nome]));
  const planoContratado = planos.find((p) => p.codigo === vitrine.plano);
  const contratado = planoContratado?.e_teste ? "período grátis" : `plano ${planoContratado?.nome ?? vitrine.plano}`;
  const pct = conta.limite ? Math.min(100, Math.round((conta.ativos / conta.limite) * 100)) : null;
  const suspensa = assinatura?.situacao === "suspensa";

  return (
    <PaginaConta>
      <TopoConta titulo="Meu plano" />

      {pagamentoLigado && ambiente === "sandbox" && <Aviso tipo="atencao">Pagamentos em ambiente de teste. Cobranças geradas aqui não têm valor real.</Aviso>}
      {busca.p && (!pagamentoPedido || !retomado || retomado.tipo !== "assinatura") && <Aviso tipo="atencao">Esse pagamento não está disponível nesta conta. Confira seu histórico abaixo.</Aviso>}
      {/* Plano atual */}
      <section aria-labelledby="plano-atual" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="plano-atual" className="text-sm font-semibold uppercase text-texto-suave">
          Plano atual
        </h2>
        <p className="text-xl font-bold">{resumo.nome ?? "Sem plano ativo"}</p>
        {conta.plano?.descricao && <p className="text-base text-texto-suave">{conta.plano.descricao}</p>}

        {resumo.venceu && (
          <Aviso tipo="atencao">
            <span>
              Seu {contratado} terminou.
              {resumo.nome ? ` Agora você está no ${resumo.nome}.` : " Assine um plano para pôr anúncios no ar."}
            </span>
          </Aviso>
        )}

        {suspensa && (
          <Aviso tipo="erro">
            <span>Sua conta de vendedor está suspensa. Fale com o suporte do OLAKI para saber o que aconteceu.</span>
          </Aviso>
        )}
        {!suspensa && assinatura?.renovar_agora && assinatura.situacao !== "vencida" && assinatura.situacao !== "teste_vencido" && assinatura.vence_em && (
          <Aviso tipo="atencao">
            <span>
              Seu {assinatura.e_teste ? "teste grátis" : `plano ${assinatura.plano_nome ?? ""}`} termina em {dataPorExtenso(assinatura.vence_em)}.
              {" "}Pague o próximo período abaixo para não ficar sem anúncios no ar.
            </span>
          </Aviso>
        )}
        {assinatura?.plano_proximo && (
          <Aviso tipo="info">
            <span>
              Troca marcada: o plano {assinatura.plano_proximo_nome ?? assinatura.plano_proximo} começa em{" "}
              {dataPorExtenso(assinatura.plano_proximo_inicio)} e vai até {dataPorExtenso(assinatura.plano_proximo_ate)}. Já está pago.
            </span>
          </Aviso>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold">{resumo.uso}</p>
          {pct !== null && (
            <div
              role="progressbar"
              aria-label="Anúncios usados do plano"
              aria-valuemin={0}
              aria-valuemax={conta.limite ?? 0}
              aria-valuenow={Math.min(conta.ativos, conta.limite ?? conta.ativos)}
              aria-valuetext={resumo.uso}
              className="h-3 w-full overflow-hidden rounded-full bg-borda"
            >
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-perigo" : "bg-laranja"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {conta.rascunhos > 0 && (
            <p className="text-sm text-texto-suave">
              {conta.rascunhos} {conta.rascunhos === 1 ? "rascunho não conta" : "rascunhos não contam"} no limite.
            </p>
          )}
        </div>

        {resumo.venceEm && (
          <p className="text-base">
            {conta.plano?.e_teste ? "Teste grátis até " : "Vale até "}
            <strong>{dataPorExtenso(resumo.venceEm)}</strong>
            {resumo.diasRestantes !== null && (
              <span className="text-texto-suave">
                {" "}
                ({resumo.diasRestantes === 0 ? "termina hoje" : resumo.diasRestantes === 1 ? "falta 1 dia" : `faltam ${resumo.diasRestantes} dias`})
              </span>
            )}
          </p>
        )}
        {conta.plano && (
          <p className="flex items-center gap-2 text-base">
            <Radar className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
            {conta.plano.acesso_radar
              ? conta.plano.propostas_radar_mes === null
                ? "Radar de Negócios sem limite de propostas"
                : `Radar: até ${conta.plano.propostas_radar_mes} propostas por mês`
              : "Sem acesso ao Radar de Negócios"}
          </p>
        )}
      </section>

      {/* Planos à venda, com período e como o pagamento entra (antes de pagar) */}
      {assinatura && !suspensa && (
        <section aria-labelledby="planos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="planos" className="text-lg font-bold">
              {assinatura.situacao === "ativa" ? "Renovar ou trocar de plano" : "Assinar um plano"}
            </h2>
            <Link href={LINK_PLANOS} className="inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline underline-offset-4">
              Comparar todos os planos
            </Link>
          </div>
          <EscolherPlano
            key={pagamentoPedido ?? "novo"}
            opcoes={opcoes}
            assinatura={assinatura}
            pagamentoLigado={pagamentoLigado}
            precisaDocumento={doc}
            planoInicial={planoPedido}
            pagamentoInicial={retomado?.tipo === "assinatura" ? retomado : null}
          />
          <p className="text-sm text-texto-suave">
            Sem renovação automática: cada pagamento vale por um período. Você decide quando renovar em Meu plano.
          </p>
        </section>
      )}

      {/* Pagamentos */}
      <section aria-labelledby="pagamentos" className="flex flex-col gap-3">
        <h2 id="pagamentos" className="text-lg font-bold">
          Pagamentos
        </h2>
        {pagamentos.length === 0 ? (
          <p className="rounded-card bg-cartao p-4 text-base text-texto-suave shadow-1">{pagina > 1 ? "Não há pagamentos nesta página." : "Você ainda não tem pagamentos."}</p>
        ) : (
          <ul className="divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            {pagamentos.map((p) => {
              const st = STATUS_PAGAMENTO[p.status] ?? { texto: "Em análise", cor: "bg-fundo text-texto-suave" };
              const linkSeguro = linkPagamentoSeguro(p.link_pagamento);
              const quando = p.pago_em ?? p.vencimento ?? p.criado_em;
              return (
                <li key={p.id} className="flex flex-col gap-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-semibold">
                      {TIPO_PAGAMENTO[p.tipo]}
                      {p.tipo === "assinatura" && p.plano_codigo ? ` · ${nomes.get(p.plano_codigo) ?? p.plano_codigo}` : ""}
                    </span>
                    <span className="text-base font-bold tabular-nums">{preco(p.valor_centavos)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${st.cor}`}>{st.texto}</span>
                    <span>{dataPorExtenso(quando)}</span>
                    {p.forma && <span>· {FORMA[p.forma]}</span>}
                  </div>
                  {p.status === "pendente" && p.tipo === "assinatura" ? (
                    <Link
                      href={linkMeuPlano({ pagamentoId: p.id })}
                      className="inline-flex min-h-12 w-fit items-center font-semibold text-laranja-escuro underline underline-offset-4"
                    >
                      Pagar agora
                    </Link>
                  ) : p.status === "pendente" && p.tipo === "anuncio_avulso" && p.anuncio_id ? (
                    <Link
                      href={linkAvulso(p.anuncio_id, p.id)}
                      className="inline-flex min-h-12 w-fit items-center font-semibold text-laranja-escuro underline underline-offset-4"
                    >
                      Pagar agora
                    </Link>
                  ) : (
                    p.status === "pendente" &&
                    linkSeguro && (
                      <a
                        href={linkSeguro!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-12 w-fit items-center font-semibold text-laranja-escuro underline underline-offset-4"
                      >
                        Pagar agora
                      </a>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {historico.total > 12 && <nav aria-label="Páginas de pagamentos" className="flex flex-wrap items-center justify-between gap-3">
          {pagina > 1 && <Botao variante="secundario" href={`/minha-conta/plano?pagina=${pagina - 1}#pagamentos`}>Mais recentes</Botao>}
          <span className="text-sm text-texto-suave tabular-nums">Página {pagina} de {Math.max(1, Math.ceil(historico.total / 12))}</span>
          {pagina * 12 < historico.total && <Botao variante="secundario" href={`/minha-conta/plano?pagina=${pagina + 1}#pagamentos`}>Mais antigos</Botao>}
        </nav>}
        {pagina > 1 && historico.total <= 12 && <Botao variante="secundario" href="/minha-conta/plano#pagamentos">Voltar aos pagamentos</Botao>}
      </section>
    </PaginaConta>
  );
}
