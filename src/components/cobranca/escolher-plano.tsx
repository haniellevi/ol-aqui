"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Radar, Star } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Aviso } from "@/components/conta/aviso";
import { CaixaResultado, FluxoCobranca } from "@/components/cobranca/fluxo-cobranca";
import { dataPorExtenso } from "@/components/conta/resumo-plano";
import { preco } from "@/lib/formato";
import { linkMeuPlano } from "@/lib/rotas";
import { pedirPlano } from "@/app/(conta)/pagar/actions";
import type { MeuPagamento, MinhaAssinatura, OpcaoAssinatura } from "@/lib/tipos-cobranca";

// "Meu plano" · escolher plano e período → ver como o pagamento entra (antes de pagar) → Pix/cartão.
// Planos, preços, períodos e descontos vêm do banco (opcoes_assinatura). Nada fixo aqui.

export type EscolherPlanoProps = {
  opcoes: OpcaoAssinatura[];
  assinatura: MinhaAssinatura;
  pagamentoLigado: boolean;
  precisaDocumento: boolean;
  planoInicial?: string | null;
  pagamentoInicial?: MeuPagamento | null;
};

const nomePeriodo = (meses: number) => (meses === 1 ? "Mensal" : meses === 12 ? "Anual" : `${meses} meses`);

/** Como o pagamento vai entrar no plano, em palavras simples. */
export function textoRegra(o: Pick<OpcaoAssinatura, "regra" | "nome" | "inicio" | "fim">, planoAtual: string | null): string {
  const fim = dataPorExtenso(o.fim);
  switch (o.regra) {
    case "inicio":
      return `O plano ${o.nome} começa agora e vale até ${fim}.`;
    case "renovacao":
      return `Soma ao seu plano: o ${o.nome} passa a valer até ${fim}.`;
    case "troca_agora":
      return `Troca agora: o ${o.nome} começa hoje e vale até ${fim}. O valor é do período inteiro e os dias que faltavam do ${planoAtual ?? "plano atual"} não passam para o novo.`;
    case "proximo_periodo":
      return `Seu ${planoAtual ?? "plano atual"} continua até ${dataPorExtenso(o.inicio)}. O ${o.nome} começa depois e vale até ${fim}.`;
    case "renovacao_proximo":
      return `Soma ao ${o.nome} que já está marcado: ele passa a valer até ${fim}.`;
    default:
      return "";
  }
}

export function EscolherPlano({ opcoes, assinatura, pagamentoLigado, precisaDocumento, planoInicial, pagamentoInicial }: EscolherPlanoProps) {
  const router = useRouter();
  const periodos = useMemo(() => [...new Set(opcoes.map((o) => o.meses))].sort((a, b) => a - b), [opcoes]);
  const [meses, setMeses] = useState<number>(() =>
    pagamentoInicial?.meses && periodos.includes(pagamentoInicial.meses) ? pagamentoInicial.meses : periodos[0] ?? 1,
  );
  const planos = opcoes.filter((o) => o.meses === meses);
  const [codigo, setCodigo] = useState<string | null>(() => {
    const pedido = pagamentoInicial?.plano_codigo ?? planoInicial;
    const daLista = planos.find((o) => o.codigo === pedido && o.disponivel);
    return daLista?.codigo ?? planos.find((o) => o.disponivel && !o.atual)?.codigo ?? planos.find((o) => o.disponivel)?.codigo ?? null;
  });
  const opcao = planos.find((o) => o.codigo === codigo) ?? null;
  const planoAtual = assinatura.plano_nome && !assinatura.e_teste && assinatura.preco_centavos > 0 ? assinatura.plano_nome : null;

  if (opcoes.length === 0) {
    return (
      <Aviso tipo="info">
        <span>Nenhum plano à venda para você agora. Fale com a equipe OLAKI se precisar.</span>
      </Aviso>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {periodos.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold">Pagar por quanto tempo?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {periodos.map((m) => {
              const desconto = opcoes.find((o) => o.meses === m)?.desconto_percentual ?? 0;
              return (
                <Chip key={m} ativo={m === meses} onClick={() => setMeses(m)}>
                  {nomePeriodo(m)}
                  {desconto > 0 ? ` · ${desconto.toLocaleString("pt-BR")}% off` : ""}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Escolha o plano</legend>
        {planos.map((o) => (
          <CartaoPlano key={o.codigo} opcao={o} ativo={o.codigo === codigo} onEscolher={() => setCodigo(o.codigo)} />
        ))}
      </fieldset>

      {!pagamentoLigado ? (
        <Aviso tipo="info">
          <span>Pagamento em breve: logo dá para pagar por Pix ou cartão aqui mesmo. Se precisar agora, fale com a equipe OLAKI.</span>
        </Aviso>
      ) : opcao && opcao.disponivel ? (
        <FluxoCobranca
          key={pagamentoInicial?.id ?? "novo"}
          valorCentavos={opcao.valor_centavos}
          precisaDocumento={precisaDocumento}
          pagamentoInicial={pagamentoInicial?.tipo === "assinatura" ? pagamentoInicial : null}
          pedir={(forma, doc) => pedirPlano(opcao.codigo, opcao.meses, forma, doc)}
          aoMudarPagamento={(id) => router.replace(linkMeuPlano({ pagamentoId: id }), { scroll: false })}
          aoPagar={() => router.refresh()}
          nota={<p>{textoRegra(opcao, planoAtual)}</p>}
          sucesso={(p) => (
            <CaixaResultado icone="ok" titulo="Pronto! Pagamento confirmado.">
              <p className="max-w-sm text-base text-texto-suave">
                {p.regra === "proximo_periodo"
                  ? `O plano ${p.plano_nome ?? ""} começa em ${dataPorExtenso(p.concedido_de)} e vai até ${dataPorExtenso(p.concedido_ate)}.`
                  : p.concedido_ate
                    ? `Seu plano ${p.plano_nome ?? ""} vale até ${dataPorExtenso(p.concedido_ate)}.`
                    : "Seu plano já está valendo."}
              </p>
              <Botao href="/minha-conta" larguraTotal className="max-w-sm">
                Ir para Minha conta
              </Botao>
            </CaixaResultado>
          )}
        />
      ) : opcao?.motivo ? (
        <Aviso tipo="atencao">
          <span>{opcao.motivo}</span>
        </Aviso>
      ) : null}
    </div>
  );
}

function CartaoPlano({ opcao: o, ativo, onEscolher }: { opcao: OpcaoAssinatura; ativo: boolean; onEscolher: () => void }) {
  const bloqueado = !o.disponivel;
  const porPeriodo = o.meses === 1 ? `a cada ${o.periodo_dias} dias` : `por ${o.dias} dias`;
  return (
    <label
      className={`relative flex min-h-12 cursor-pointer gap-3 rounded-card border-2 p-4 transition-colors focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-laranja-escuro ${
        ativo ? "border-laranja-escuro bg-laranja-claro" : "border-borda bg-cartao"
      } ${bloqueado ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <input type="radio" name="plano" value={o.codigo} checked={ativo} disabled={bloqueado} onChange={onEscolher} className="sr-only" />
      <span
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${ativo ? "border-laranja-escuro bg-laranja-escuro text-white" : "border-borda bg-cartao"}`}
        aria-hidden
      >
        {ativo && <CheckCircle2 className="size-4" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="flex items-center gap-2 text-lg font-semibold leading-6">
            {o.nome}
            {o.recomendado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-beringela px-2 py-0.5 text-[13px] font-bold text-white">
                <Star className="size-3.5" aria-hidden />
                Recomendado
              </span>
            )}
          </span>
          <span className="text-lg font-bold leading-6">
            {preco(o.valor_centavos)} <span className="text-sm font-normal text-texto-suave">{porPeriodo}</span>
          </span>
        </span>
        {o.desconto_percentual > 0 && (
          <span className="text-sm font-semibold text-verde-escuro">
            Economia de {preco(o.preco_centavos * o.meses - o.valor_centavos)} no período
          </span>
        )}
        {o.descricao && <span className="text-base">{o.descricao}</span>}
        <span className="flex items-center gap-2 text-base">
          <Check className="size-5 shrink-0 text-verde-escuro" aria-hidden />
          {o.limite_anuncios === null ? "Anúncios sem limite" : `Até ${o.limite_anuncios} anúncios no ar`}
        </span>
        <span className="flex items-center gap-2 text-base">
          <Radar className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
          {o.acesso_radar
            ? o.propostas_radar_mes === null
              ? "Radar de Negócios sem limite de propostas"
              : `Radar com ${o.propostas_radar_mes} propostas por mês`
            : "Sem Radar de Negócios"}
        </span>
        {o.atual && <span className="text-sm font-semibold text-verde-escuro">Seu plano atual</span>}
        {bloqueado && o.motivo && <span className="text-sm font-semibold text-aviso">{o.motivo}</span>}
      </span>
    </label>
  );
}
