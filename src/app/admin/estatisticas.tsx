import type { SupabaseClient } from "@supabase/supabase-js";
import { Aviso, Cartao, Numero } from "@/components/admin/ui";
import { hojeFortaleza } from "@/lib/admin/relatorios";
import { ehUuid } from "@/lib/formato";
import { FiltrosEstatisticas, type PeriodoEstatisticas } from "./filtros-estatisticas";

export type ParametrosEstatisticas = Record<string, string | string[] | undefined>;

const campos = [
  "anuncios_no_ar", "anuncios_publicados", "usuarios_cadastrados", "usuarios_novos",
  "clientes_radar_atendidos", "pedidos_criados", "pedidos_com_proposta", "contatos_solicitados",
  "propostas_total", "propostas_com_valor", "propostas_centavos",
  "receita_centavos", "receita_planos_centavos", "receita_avulsos_centavos", "receita_destaques_centavos",
  "recebimentos_sem_origem", "recebimentos_sem_origem_centavos",
] as const;

type Indicadores = Record<(typeof campos)[number], bigint> & { primeiro_ano: number };

function lerIndicadores(data: unknown): Indicadores | null {
  if (!Array.isArray(data) || data.length !== 1 || !data[0]) return null;
  const linha = data[0] as Record<string, unknown>;
  const primeiro_ano = Number(linha.primeiro_ano);
  if (!Number.isInteger(primeiro_ano) || primeiro_ano < 1) return null;
  const valores: Partial<Indicadores> = { primeiro_ano };
  for (const campo of campos) {
    const valor = linha[campo];
    if (typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0) valores[campo] = BigInt(valor);
    else if (typeof valor === "string" && /^\d+$/.test(valor)) valores[campo] = BigInt(valor);
    else return null;
  }
  return valores as Indicadores;
}

const contagem = (n: bigint) => n.toLocaleString("pt-BR");
function moeda(n: bigint) {
  return `R$ ${contagem(n / BigInt(100))},${String(n % BigInt(100)).padStart(2, "0")}`;
}

function IndicadoresDoPeriodo({ n }: { n: Indicadores }) {
  const semValor = n.propostas_total - n.propostas_com_valor;
  return (
    <div className="space-y-6">
      <section aria-labelledby="estatisticas-contas">
        <h3 id="estatisticas-contas" className="mb-3 text-base font-semibold text-beringela">Anúncios e usuários</h3>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Numero rotulo="Anúncios no ar" valor={contagem(n.anuncios_no_ar)} detalhe="Situação atual" />
          <Numero rotulo="Anúncios publicados" valor={contagem(n.anuncios_publicados)} detalhe="No período" />
          <Numero rotulo="Usuários cadastrados" valor={contagem(n.usuarios_cadastrados)} detalhe="Situação atual" />
          <Numero rotulo="Novos usuários" valor={contagem(n.usuarios_novos)} detalhe="No período" />
        </div>
      </section>

      <section aria-labelledby="estatisticas-radar">
        <h3 id="estatisticas-radar" className="mb-1 text-base font-semibold text-beringela">Radar e movimentação entre usuários</h3>
        <p className="mb-3 text-sm text-texto-suave">
          Cada cliente é contado uma vez no período em que recebeu uma oferta ativa. O valor ofertado mede a atividade de negociação.
        </p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <Numero rotulo="Clientes atendidos no Radar" valor={contagem(n.clientes_radar_atendidos)} detalhe="Compradores únicos com oferta no período" />
          <Numero rotulo="Pedidos feitos" valor={contagem(n.pedidos_criados)} />
          <Numero rotulo="Pedidos com oferta" valor={contagem(n.pedidos_com_proposta)} />
          <Numero rotulo="Contatos solicitados" valor={contagem(n.contatos_solicitados)} detalhe="Escolhas de proposta para abrir o WhatsApp" />
          <Numero rotulo="Propostas enviadas" valor={contagem(n.propostas_total)} detalhe={`${contagem(semValor)} sem valor informado`} />
          <Numero rotulo="Movimentação aproximada" valor={moeda(n.propostas_centavos)} detalhe={`Soma de ${contagem(n.propostas_com_valor)} propostas com valor`} />
        </div>
        <p className="mt-2 text-sm text-texto-suave">Cada oferta contribui uma vez com o seu valor registrado mais recente, no período em que foi enviada.</p>
      </section>

      <section aria-labelledby="estatisticas-receita">
        <h3 id="estatisticas-receita" className="mb-1 text-base font-semibold text-beringela">Faturamento da empresa</h3>
        <p className="mb-3 text-sm text-texto-suave">Recebimentos registrados em produção, pela data do pagamento. O total reflete os pagamentos em situação paga.</p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Numero rotulo="Total recebido" valor={moeda(n.receita_centavos)} />
          <Numero rotulo="Planos" valor={moeda(n.receita_planos_centavos)} />
          <Numero rotulo="Anúncios avulsos" valor={moeda(n.receita_avulsos_centavos)} />
          <Numero rotulo="Destaques" valor={moeda(n.receita_destaques_centavos)} />
        </div>
        {n.recebimentos_sem_origem > BigInt(0) && (
          <Cartao className="mt-3 text-sm text-texto-suave">
            <strong>Recebimentos a conferir.</strong> {moeda(n.recebimentos_sem_origem_centavos)} em {contagem(n.recebimentos_sem_origem)} pagamentos com ambiente desconhecido, apresentados separadamente do total confirmado.
          </Cartao>
        )}
      </section>
    </div>
  );
}

export async function Estatisticas({ supabase, params }: { supabase: SupabaseClient; params: ParametrosEstatisticas }) {
  const hoje = hojeFortaleza();
  const [anoAtual, mesAtual] = hoje.split("-").map(Number);
  const um = (chave: string) => (Array.isArray(params[chave]) ? params[chave][0] : params[chave]) ?? "";
  const periodoUrl = um("periodo");
  const periodo: PeriodoEstatisticas = periodoUrl === "ano" || periodoUrl === "historico" ? periodoUrl : "mes";
  const anoUrl = Number(um("ano") || anoAtual);
  const ano = Number.isInteger(anoUrl) && anoUrl >= 1 && anoUrl <= anoAtual && periodo !== "historico" ? anoUrl : anoAtual;
  const mesUrl = Number(um("mes") || mesAtual);
  const mesMax = ano === anoAtual ? mesAtual : 12;
  const mes = Number.isInteger(mesUrl) && mesUrl >= 1 && mesUrl <= mesMax && periodo === "mes" ? mesUrl : Math.min(mesAtual, mesMax);
  const dataReferencia = `${String(ano).padStart(4, "0")}-${String(periodo === "ano" ? 1 : mes).padStart(2, "0")}-01`;
  const regiaoUrl = um("regiao");
  const regiao = ehUuid(regiaoUrl) ? regiaoUrl.toLowerCase() : null;
  let lojas = supabase.from("vitrines_lojas").select("id, anuncios!inner(id)", { count: "exact", head: true })
    .eq("tipo", "loja").eq("status", "ativa").eq("anuncios.status", "ativo");
  if (regiao) lojas = lojas.eq("microrregiao_id", regiao);
  const [regioesR, dadosR, lojasR] = await Promise.all([
    supabase.from("microrregioes").select("id, nome").order("nome"),
    !regiaoUrl || regiao ? supabase.rpc("admin_estatisticas", {
      p_periodo: periodo,
      p_referencia: periodo === "historico" ? null : dataReferencia,
      p_regiao: regiao,
    }) : Promise.resolve(null),
    lojas,
  ]);
  const regioes = (regioesR.data ?? []) as { id: string; nome: string }[];
  const nomeRegiao = regiao ? regioes.find((r) => r.id === regiao)?.nome : "Todas as regiões";
  const indicadores = dadosR && !dadosR.error ? lerIndicadores(dadosR.data) : null;
  const rotuloPeriodo = periodo === "historico" ? "Histórico completo" : periodo === "ano" ? String(ano) : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dataReferencia}T00:00:00Z`));

  return (
    <section className="mb-8" aria-labelledby="estatisticas-titulo">
      <h2 id="estatisticas-titulo" className="sr-only">Indicadores do período</h2>
      {!regioesR.error && (
        <FiltrosEstatisticas key={`${periodo}/${ano}/${mes}/${regiao ?? ""}`} periodoInicial={periodo} anoInicial={ano} mesInicial={mes}
          anoAtual={anoAtual} mesAtual={mesAtual} primeiroAno={Math.min(ano, indicadores?.primeiro_ano ?? anoAtual)}
          regiao={nomeRegiao ? regiao : null} regioes={regioes} />
      )}
      {regioesR.error ? (
        <Aviso tipo="erro">Não foi possível carregar as regiões. Atualize a página para consultar as estatísticas.</Aviso>
      ) : regiaoUrl && (!regiao || !nomeRegiao) ? (
        <Aviso tipo="erro">Região inválida. Escolha uma região disponível e aplique o filtro novamente.</Aviso>
      ) : !indicadores ? (
        <Aviso tipo="erro">Não foi possível carregar as estatísticas deste recorte. Tente novamente.</Aviso>
      ) : (
        <>
          <p className="mb-4 text-sm text-texto-suave">{nomeRegiao} · {rotuloPeriodo} · Datas no horário de Fortaleza</p>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Numero rotulo="Lojas com anúncios no ar" valor={lojasR.error ? "Indisponível" : (lojasR.count ?? 0).toLocaleString("pt-BR")} detalhe="Situação atual" />
            <Numero rotulo="Anúncios no ar" valor={contagem(indicadores.anuncios_no_ar)} detalhe="Situação atual" />
            <Numero rotulo="Contatos solicitados no Radar" valor={contagem(indicadores.contatos_solicitados)} detalhe="No período" />
            <Numero rotulo="Total recebido" valor={moeda(indicadores.receita_centavos)} detalhe="Produção, no período" />
          </div>
          <details className="mt-6 rounded-card border border-borda bg-cartao p-4">
            <summary className="cursor-pointer font-semibold text-beringela">Mais indicadores</summary>
            <div className="mt-4"><IndicadoresDoPeriodo n={indicadores} /></div>
          </details>
        </>
      )}
    </section>
  );
}
