import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { Check, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { reais } from "@/lib/formato";
import type { MinhaConta, Plano } from "@/lib/tipos";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { PaginaConta, TopoConta } from "@/components/conta/topo-conta";
import { Aviso } from "@/components/conta/aviso";
import { dataPorExtenso, resumoPlano } from "@/components/conta/resumo-plano";

export const metadata: Metadata = { title: "Meu plano" };

// T33 · Meu plano e faturas: plano atual, uso do limite, vencimento, planos do painel e pagamentos.
// Preços e limites vêm da tabela planos. O pagamento (Asaas) ainda não existe: "Em breve".

const COLUNAS_PLANO =
  "codigo, nome, descricao, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem";

type Pagamento = {
  id: string;
  tipo: "assinatura" | "anuncio_avulso" | "destaque";
  plano_codigo: string | null;
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
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("planos").select(COLUNAS_PLANO).order("ordem");
    return error ? [] : ((data ?? []) as Plano[]);
  }, []);
}

async function lerPagamentos(vitrineId: string): Promise<Pagamento[]> {
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId) return [];
    const db = await createClient();
    const { data, error } = await db
      .from("pagamentos")
      .select("id, tipo, plano_codigo, valor_centavos, forma, status, vencimento, pago_em, link_pagamento, criado_em")
      .eq("vitrine_id", vitrineId)
      .order("criado_em", { ascending: false })
      .limit(12);
    return error ? [] : ((data ?? []) as Pagamento[]);
  }, []);
}

/** Planos que fazem sentido para a pessoa (sem o teste; público dela ou "todos"). */
function planosParaMim(planos: Plano[], conta: MinhaConta): Plano[] {
  return planos.filter((p) => !p.e_teste && (p.publico === "todos" || p.publico === conta.perfil.tipo_pessoa));
}

export default async function PaginaMeuPlano() {
  const conta = await meuPerfilEVitrine();
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
  const [planos, pagamentos] = await Promise.all([lerPlanos(), lerPagamentos(vitrine.id)]);
  const resumo = resumoPlano(conta)!;
  const nomes = new Map(planos.map((p) => [p.codigo, p.nome]));
  const planoContratado = planos.find((p) => p.codigo === vitrine.plano);
  const contratado = planoContratado?.e_teste ? "período grátis" : `plano ${planoContratado?.nome ?? vitrine.plano}`;
  const pct = conta.limite ? Math.min(100, Math.round((conta.ativos / conta.limite) * 100)) : null;
  const opcoes = planosParaMim(planos, conta);

  return (
    <PaginaConta>
      <TopoConta titulo="Meu plano" />

      {/* Plano atual */}
      <section aria-labelledby="plano-atual" className="flex flex-col gap-3 rounded-card bg-cartao p-4 shadow-1">
        <h2 id="plano-atual" className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
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

        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold">{resumo.uso}</p>
          {pct !== null && (
            <div
              role="progressbar"
              aria-label="Anúncios usados do plano"
              aria-valuemin={0}
              aria-valuemax={conta.limite ?? 0}
              aria-valuenow={conta.ativos}
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

      {/* Planos do painel */}
      {opcoes.length > 0 && (
        <section aria-labelledby="planos" className="flex flex-col gap-3">
          <h2 id="planos" className="text-lg font-bold">
            Planos
          </h2>
          <ul className="flex flex-col gap-3">
            {opcoes.map((p) => {
              const atual = conta.plano?.codigo === p.codigo;
              return (
                <li
                  key={p.codigo}
                  className={`flex flex-col gap-2 rounded-card bg-cartao p-4 shadow-1 ${atual ? "border-2 border-laranja" : "border-2 border-transparent"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-bold">{p.nome}</h3>
                    <p className="text-lg font-bold">
                      {p.preco_centavos === 0 ? "Grátis" : reais(p.preco_centavos)}
                      {p.preco_centavos > 0 && (
                        <span className="text-sm font-normal text-texto-suave">
                          {" "}
                          a cada {p.periodo_dias} dias
                        </span>
                      )}
                    </p>
                  </div>
                  {p.descricao && <p className="text-base text-texto-suave">{p.descricao}</p>}
                  <ul className="flex flex-col gap-1 text-base">
                    <li className="flex items-center gap-2">
                      <Check className="size-5 shrink-0 text-verde-escuro" aria-hidden />
                      {p.limite_anuncios === null ? "Anúncios sem limite" : `Até ${p.limite_anuncios} anúncios no ar`}
                    </li>
                    {p.acesso_radar && (
                      <li className="flex items-center gap-2">
                        <Check className="size-5 shrink-0 text-verde-escuro" aria-hidden />
                        {p.propostas_radar_mes === null
                          ? "Radar de Negócios"
                          : `Radar com ${p.propostas_radar_mes} propostas por mês`}
                      </li>
                    )}
                  </ul>
                  {atual ? (
                    <p className="inline-flex min-h-12 items-center font-semibold text-verde-escuro">Seu plano atual</p>
                  ) : p.preco_centavos > 0 ? (
                    <div className="flex flex-col gap-1">
                      <Botao disabled larguraTotal aria-describedby={`em-breve-${p.codigo}`}>
                        Assinar
                      </Botao>
                      <p id={`em-breve-${p.codigo}`} className="text-center text-sm text-texto-suave">
                        Em breve: pagamento por Pix aqui mesmo.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Pagamentos */}
      <section aria-labelledby="pagamentos" className="flex flex-col gap-3">
        <h2 id="pagamentos" className="text-lg font-bold">
          Pagamentos
        </h2>
        {pagamentos.length === 0 ? (
          <p className="rounded-card bg-cartao p-4 text-base text-texto-suave shadow-1">Você ainda não tem pagamentos.</p>
        ) : (
          <ul className="divide-y divide-borda overflow-hidden rounded-card bg-cartao shadow-1">
            {pagamentos.map((p) => {
              const st = STATUS_PAGAMENTO[p.status];
              const quando = p.pago_em ?? p.vencimento ?? p.criado_em;
              return (
                <li key={p.id} className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold">
                      {TIPO_PAGAMENTO[p.tipo]}
                      {p.tipo === "assinatura" && p.plano_codigo ? ` · ${nomes.get(p.plano_codigo) ?? p.plano_codigo}` : ""}
                    </span>
                    <span className="text-base font-bold">{reais(p.valor_centavos)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${st.cor}`}>{st.texto}</span>
                    <span>{dataPorExtenso(quando)}</span>
                    {p.forma && <span>· {FORMA[p.forma]}</span>}
                  </div>
                  {p.status === "pendente" && p.link_pagamento && /^https:\/\//.test(p.link_pagamento) && (
                    <a
                      href={p.link_pagamento}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 w-fit items-center font-semibold text-laranja-escuro underline underline-offset-4"
                    >
                      Pagar agora
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PaginaConta>
  );
}
