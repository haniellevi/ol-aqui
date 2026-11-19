import type { Metadata } from "next";
import Link from "next/link";
import { LINK_PLANOS, linkAvulso, linkMeuPlano } from "@/lib/rotas";
import { auth } from "@clerk/nextjs/server";
import { ExternalLink, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { lerAcessoPromocional, meuPerfilEVitrine } from "@/lib/dados/conta";
import { ehUuid, preco } from "@/lib/formato";
import { ambienteAsaas, asaasConfigurado } from "@/lib/asaas";
import { precisaDocumento } from "@/lib/cobranca-destaque";
import { meuPagamento, minhaAssinatura, opcoesAssinatura } from "@/lib/dados/cobranca";
import { linkPagamentoSeguro } from "@/lib/link-pagamento";
import type { AcessoPromocional, Plano } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { dataPorExtenso, diaMesCurto, resumoPlano } from "@/components/conta/resumo-plano";
import { minhaCortesiaRadar } from "@/lib/dados/radar";
import { EscolherPlano } from "@/components/cobranca/escolher-plano";
import { Voucher } from "./voucher";
import { Badge, type TomSelo } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Meu plano" };

// T33 · Meu plano e faturas: plano atual, uso do limite, vencimento, aviso de renovar, troca marcada,
// planos à venda com período e regra antes de pagar (Pix/cartão pelo Asaas) e pagamentos.
// Preços, períodos e limites vêm do banco (planos e configuracoes). Sem ASAAS_API_KEY: "Pagamento em breve".
// ?plano=<codigo> já escolhe um plano; ?p=<pagamento> retoma um pagamento.

const COLUNAS_PLANO =
  "codigo, nome, descricao, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem, ativo, recomendado";

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
const STATUS_PAGAMENTO: Record<Pagamento["status"], { texto: string; cor: TomSelo }> = {
  pendente: { texto: "Pendente", cor: "warning" },
  pago: { texto: "Pago", cor: "success" },
  vencido: { texto: "Vencido", cor: "destructive" },
  estornado: { texto: "Devolvido", cor: "secondary" },
  cancelado: { texto: "Cancelado", cor: "secondary" },
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

/**
 * Plano contratado da loja, mesmo que tenha saído de venda (ativo = false). A tela mostra o nome dele.
 * Se a leitura falhar (ex.: banco sem a última migração), devolve null e a tela usa o que já tem.
 */
async function lerPlanoContratado(): Promise<{ nome: string; e_teste: boolean; ativo: boolean } | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("meu_plano_contratado");
  if (error || !Array.isArray(data)) return null;
  const linha = data[0] as { nome: string; e_teste: boolean; ativo: boolean } | undefined;
  return linha ? { nome: linha.nome, e_teste: linha.e_teste === true, ativo: linha.ativo === true } : null;
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
  if (!conta) throw new Error("Não foi possível carregar sua conta.");
  const db = await createClient();
  const vitrine = conta.vitrine;
  const [{ data: vouchers, error: erroVouchers }, promocional] = await Promise.all([
    db.rpc("meus_vouchers"),
    conta.promocional ?? lerAcessoPromocional(db),
  ]);
  if (erroVouchers) throw new Error("Não foi possível consultar seus cupons.");

  if (!vitrine) {
    const acesso = promocional
      ? await db.from("planos").select(COLUNAS_PLANO).eq("codigo", "promocional").maybeSingle<Plano>()
      : null;
    if (acesso?.error) throw new Error("Não foi possível carregar o plano Promocional.");
    const plano = acesso?.data;
    const resumo = plano && promocional
      ? resumoPlano({ ...conta, plano, promocional, limite: plano.limite_anuncios })
      : null;
    return (
      <PaginaConta>
        <TopoConta titulo="Meu plano" />
        {resumo && promocional && <PrazoPromocional acesso={promocional} titulo={`Plano ${resumo.nome}`} uso={resumo.uso} />}
        <Voucher codigos={vouchers ?? []} />
        <Vazio titulo="Você ainda não vende no Mercado da Região" texto={resumo ? "Escolha como quer vender para usar os recursos do seu plano." : "Escolha como quer vender e seu plano aparece aqui."}>
          <Botao href="/quero-vender" larguraTotal>Quero vender</Botao>
        </Vazio>
      </PaginaConta>
    );
  }
  const asaasLigado = asaasConfigurado();
  const [planos, historico, assinatura, opcoes, doc, retomado, ambiente, planoRpc, cortesiaAte] = await Promise.all([
    lerPlanos(),
    lerPagamentos(vitrine.id, pagina),
    minhaAssinatura(),
    opcoesAssinatura(),
    asaasLigado ? precisaDocumento(vitrine.id) : Promise.resolve(false),
    pagamentoPedido ? meuPagamento(pagamentoPedido) : Promise.resolve(null),
    asaasLigado ? ambienteAsaas() : Promise.resolve(null),
    lerPlanoContratado(),
    minhaCortesiaRadar(),
  ]);
  const pagamentoLigado = asaasLigado && (process.env.VERCEL_ENV !== "production" || ambiente === "producao");
  if (!assinatura || assinatura.vitrine_id !== vitrine.id) throw new Error("Não foi possível confirmar sua assinatura.");
  const pagamentos = historico.lista;
  const resumo = resumoPlano(conta)!;
  const planoPromocional = conta.plano?.codigo === "promocional";
  const nomes = new Map(planos.map((p) => [p.codigo, p.nome]));
  const limiteGratisLoja = planos.find((p) => p.codigo === "loja_gratis")?.limite_anuncios;
  const contratado = planoRpc?.e_teste ? "período grátis" : `plano ${planoRpc?.nome ?? vitrine.plano}`;
  const planoRecomendado = planos.find((p) => p.recomendado === true && p.ativo !== false && !p.e_teste);
  // Radar: o plano que vale agora dá o Radar; a cortesia é da própria loja e vale até a data (sem plano pago).
  // Sem verificação, o Radar não atende (só a cortesia libera): não promete o número de propostas.
  const radarVerificado = vitrine.tipo === "loja" ? vitrine.selo_loja_verificada : conta.perfil.selo_negociador_certificado;
  const linhaRadarPlano = conta.plano && !conta.plano.e_teste
    ? conta.plano.acesso_radar
      ? !radarVerificado && !cortesiaAte
        ? `Radar: depois da verificação ${vitrine.tipo === "loja" ? "da loja" : "de vendedor"}`
        : conta.plano.propostas_radar_mes === null ? "Radar de Negócios sem limite de propostas" : `Radar: até ${conta.plano.propostas_radar_mes} propostas por mês`
      : cortesiaAte ? null : "Sem acesso ao Radar de Negócios"
    : null;
  const pct = conta.limite ? Math.min(100, Math.round((conta.ativos / conta.limite) * 100)) : null;
  const suspensa = assinatura?.situacao === "suspensa";

  return (
    <PaginaConta>
      <TopoConta
        titulo="Meu plano"
        acao={<Botao href="#pagamentos" variante="secundario" tamanho="toque">Ver pagamentos</Botao>}
      />

      {pagamentoLigado && ambiente === "sandbox" && <Aviso tipo="atencao">Pagamentos em ambiente de teste. Cobranças geradas aqui não têm valor real.</Aviso>}
      {busca.p && (!pagamentoPedido || !retomado || retomado.tipo !== "assinatura") && <Aviso tipo="atencao">Esse pagamento não está disponível nesta conta. Confira seu histórico abaixo.</Aviso>}
      {/* Plano atual */}
      <section aria-labelledby="plano-atual" className="flex flex-col gap-3 rounded-card border border-borda bg-cartao p-3 sm:p-4">
        <div className="space-y-1">
          <h2 id="plano-atual" className="text-sm font-semibold text-texto-suave">Plano atual</h2>
          <p className="text-lg font-semibold leading-tight text-beringela [overflow-wrap:anywhere]">{resumo.nome ?? planoRpc?.nome ?? "Sem plano ativo"}</p>
          {conta.plano?.descricao && <p className="text-sm text-texto-suave">{conta.plano.descricao}</p>}
        </div>

        {resumo.venceu && (
          <Aviso tipo="atencao">
            <span>
              Seu {contratado} terminou.
              {resumo.nome ? ` Agora você está no ${resumo.nome}.` : " Assine um plano para pôr anúncios no ar."}
            </span>
          </Aviso>
        )}

        {!planoPromocional && planoRpc && !planoRpc.ativo && (
          <Aviso tipo="info">
            <span>
              O {planoRpc.nome} saiu de venda. Na renovação, você passa para o {planoRecomendado ? `plano recomendado, o ${planoRecomendado.nome}` : "plano recomendado"}.
            </span>
          </Aviso>
        )}

        {suspensa && (
          <Aviso tipo="erro">
            <span>Sua conta de vendedor está suspensa. Fale com o suporte do Mercado da Região para saber o que aconteceu.</span>
          </Aviso>
        )}
        {!suspensa && !planoPromocional && assinatura?.renovar_agora && assinatura.situacao !== "vencida" && assinatura.situacao !== "teste_vencido" && assinatura.vence_em && (
          <Aviso tipo="atencao">
            <span>
              Seu {assinatura.e_teste ? "teste grátis" : `plano ${assinatura.plano_nome ?? ""}`} termina em {dataPorExtenso(assinatura.vence_em)}.
              {" "}{vitrine.tipo === "loja" && limiteGratisLoja != null ? `Depois, sua loja continua grátis com até ${limiteGratisLoja} anúncios no ar. O excedente é pausado.` : "Confira os limites do seu plano gratuito em Meu plano."}
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

        <div className="flex flex-col gap-1.5 border-t border-borda pt-3">
          <p className="text-sm font-semibold tabular-nums">{resumo.uso}</p>
          {pct !== null && (
            <div
              role="progressbar"
              aria-label="Anúncios usados do plano"
              aria-valuemin={0}
              aria-valuemax={conta.limite ?? 0}
              aria-valuenow={Math.min(conta.ativos, conta.limite ?? conta.ativos)}
              aria-valuetext={resumo.uso}
              className="h-2 w-full overflow-hidden rounded-full bg-borda"
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

        {planoPromocional && promocional && <p className="text-sm">Ativado em {dataPorExtenso(promocional.ativado_em)}</p>}
        {resumo.venceEm && (
          <p className="text-sm">
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
        {linhaRadarPlano && (
          <p className="flex items-start gap-2 text-sm">
            <Radar className="mt-0.5 size-4 shrink-0 text-laranja-escuro" aria-hidden />
            {linhaRadarPlano}
          </p>
        )}
        {cortesiaAte && (
          <p className="flex items-start gap-2 text-sm">
            <Radar className="mt-0.5 size-4 shrink-0 text-laranja-escuro" aria-hidden />
            Radar liberado por cortesia até {diaMesCurto(cortesiaAte)}
          </p>
        )}
      </section>

      {!planoPromocional && promocional && <PrazoPromocional acesso={promocional} titulo="Cupom promocional" bloqueado />}
      <Voucher codigos={vouchers ?? []} />

      {/* Planos à venda, com período e como o pagamento entra (antes de pagar) */}
      {assinatura && !suspensa && (
        <section aria-labelledby="planos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="planos" tabIndex={-1} className="scroll-mt-24 text-lg font-semibold">
              {assinatura.situacao === "ativa" ? "Renovar ou trocar de plano" : "Assinar um plano"}
            </h2>
            <Link href={LINK_PLANOS} className="inline-flex min-h-toque items-center text-sm font-semibold text-laranja-escuro underline underline-offset-4">
              Comparar todos os planos
            </Link>
          </div>
          <EscolherPlano
            key={pagamentoPedido ?? "novo"}
            opcoes={opcoes}
            assinatura={assinatura}
            pagamentoLigado={pagamentoLigado}
            precisaDocumento={doc}
            planoInicial={planoPedido === "promocional" ? null : planoPedido}
            pagamentoInicial={retomado?.tipo === "assinatura" ? retomado : null}
          />
          <p className="text-sm text-texto-suave">
            A renovação é manual. Você decide quando pagar de novo.
          </p>
        </section>
      )}

      {/* Pagamentos */}
      <section aria-labelledby="pagamentos" className="flex flex-col gap-3">
        <h2 id="pagamentos" tabIndex={-1} className="scroll-mt-24 text-lg font-semibold">Pagamentos</h2>
        {pagamentos.length === 0 ? (
          <p className="rounded-card border border-borda bg-cartao p-3 text-sm text-texto-suave sm:p-4">{pagina > 1 ? "Não há pagamentos nesta página." : "Você ainda não tem pagamentos."}</p>
        ) : (
          <ul className="divide-y divide-borda rounded-card border border-borda bg-cartao">
            {pagamentos.map((p) => {
              const st = STATUS_PAGAMENTO[p.status] ?? { texto: "Em análise", cor: "secondary" };
              const linkSeguro = linkPagamentoSeguro(p.link_pagamento);
              const quando = p.pago_em ?? p.vencimento ?? p.criado_em;
              const rotuloData = p.pago_em ? "Pago em" : p.vencimento ? (p.status === "vencido" ? "Venceu em" : "Vencimento:") : "Criado em";
              const destino = pagamentoLigado && p.status === "pendente"
                ? p.tipo === "assinatura"
                  ? `${linkMeuPlano({ pagamentoId: p.id })}#planos`
                  : p.tipo === "anuncio_avulso" && p.anuncio_id
                    ? linkAvulso(p.anuncio_id, p.id)
                    : linkSeguro
                : null;
              const externo = Boolean(destino && destino === linkSeguro);
              return (
                <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 p-3 sm:p-4">
                  <span className="pt-0.5 text-sm font-semibold [overflow-wrap:anywhere]">
                    {(p.tipo === "assinatura" && p.plano_codigo && nomes.get(p.plano_codigo)) || TIPO_PAGAMENTO[p.tipo]}
                  </span>
                  <span className="text-right text-lg leading-tight font-bold whitespace-nowrap text-beringela tabular-nums">{preco(p.valor_centavos)}</span>
                  <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
                    <Badge variant={st.cor}>{st.texto}</Badge>
                    <span>{rotuloData} {dataPorExtenso(quando)}{p.forma && ` · ${FORMA[p.forma]}`}</span>
                  </div>
                  {destino && (
                    <Botao
                      href={destino}
                      variante="texto"
                      tamanho="toque"
                      className="col-span-2 w-fit px-0"
                      target={externo ? "_blank" : undefined}
                      rel={externo ? "noopener noreferrer" : undefined}
                      icone={externo ? <ExternalLink /> : undefined}
                    >
                      Retomar pagamento
                    </Botao>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {historico.total > 12 && <nav aria-label="Páginas de pagamentos" className="flex flex-wrap items-center justify-between gap-3">
          {pagina > 1 && <Botao variante="secundario" tamanho="toque" href={`/minha-conta/plano?pagina=${pagina - 1}#pagamentos`}>Mais recentes</Botao>}
          <span className="text-sm text-texto-suave tabular-nums">Página {pagina} de {Math.max(1, Math.ceil(historico.total / 12))}</span>
          {pagina * 12 < historico.total && <Botao variante="secundario" tamanho="toque" href={`/minha-conta/plano?pagina=${pagina + 1}#pagamentos`}>Mais antigos</Botao>}
        </nav>}
        {pagina > 1 && historico.total <= 12 && <Botao variante="secundario" tamanho="toque" href="/minha-conta/plano#pagamentos">Voltar aos pagamentos</Botao>}
      </section>
    </PaginaConta>
  );
}

function PrazoPromocional({ acesso, titulo, uso, bloqueado }: { acesso: AcessoPromocional; titulo: string; uso?: string; bloqueado?: boolean }) {
  return (
    <Card role="region" aria-labelledby="prazo-promocional">
      <CardHeader>
        <h2 id="prazo-promocional" className="text-lg font-semibold text-beringela">{titulo}</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-base">
        <p>Ativado em {dataPorExtenso(acesso.ativado_em)}</p>
        <p>Vale até <strong>{dataPorExtenso(acesso.vence_em)}</strong></p>
        {uso && <p>{uso}</p>}
        {bloqueado && <p className="text-texto-suave">Os bloqueios da sua conta continuam. O prazo do cupom já está correndo.</p>}
      </CardContent>
    </Card>
  );
}
