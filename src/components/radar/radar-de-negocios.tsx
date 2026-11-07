// components/radar/radar-de-negocios.tsx
// Radar de Negócios: a "lista quente" invertida do OLAKI.
// Mobile-first, sem bibliotecas pesadas: Tailwind + lucide-react (já vem com shadcn/ui).
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Flame, Hourglass, Lock, MapPin, MessageCircle, Radar, Send, Users } from "lucide-react";
import { proporProduto } from "@/app/radar/actions";
import { LINK_PLANOS } from "@/lib/rotas";

export type CategoriaRadar = "imovel" | "veiculo" | "movel" | "geral";

export type PedidoRadar = {
  id: string;
  categoria: CategoriaRadar;
  titulo: string;
  detalhes: string | null; // null quando o usuário não tem acesso
  cidade: string;
  urgencia: "normal" | "esta_semana" | "hoje";
  precoMaxCentavos: number | null;
  totalPropostas: number;
  maxPropostas: number;
  modoContato: "whatsapp_direto" | "propostas_prazo";
  propostasAte: string | null;
  criadoEm: string;
  compradorCertificado: boolean;
  compradorNome: string | null; // null quando bloqueado
  jaPropus: boolean;
};

export type PlanoResumo = { codigo: string; nome: string; preco_centavos: number };

const CATEGORIAS: { valor: CategoriaRadar | "todas"; rotulo: string }[] = [
  { valor: "todas", rotulo: "Tudo" },
  { valor: "veiculo", rotulo: "Veículos" },
  { valor: "imovel", rotulo: "Imóveis" },
  { valor: "movel", rotulo: "Móveis" },
  { valor: "geral", rotulo: "Outros" },
];

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reaisCentavos = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function tempoAtras(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function RadarDeNegocios({
  pedidos,
  temAcesso,
  propostasRestantes,
  planos,
}: {
  pedidos: PedidoRadar[];
  temAcesso: boolean;
  propostasRestantes: number | null; // null = ilimitado
  planos: PlanoResumo[];
}) {
  const [filtro, setFiltro] = useState<CategoriaRadar | "todas">("todas");
  const [restantes, setRestantes] = useState(propostasRestantes);
  const visiveis = useMemo(
    () => (filtro === "todas" ? pedidos : pedidos.filter((p) => p.categoria === filtro)),
    [pedidos, filtro],
  );
  const podePropor = temAcesso && (restantes === null || restantes > 0);

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-fundo pb-28">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          {pedidos.length} {pedidos.length === 1 ? "comprador procurando" : "compradores procurando"} na sua região
        </p>

        <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Filtrar por categoria">
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              onClick={() => setFiltro(c.valor)}
              aria-pressed={filtro === c.valor}
              className={`h-12 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
                filtro === c.valor
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-700 active:bg-neutral-100"
              }`}
            >
              {c.rotulo}
            </button>
          ))}
        </nav>
      </header>

      {!temAcesso && <FaixaUpgrade planos={planos} titulo="Esses clientes já querem comprar." />}
      {temAcesso && restantes !== null && (
        restantes > 0 ? (
          <p className="mx-4 mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Você tem <strong>{restantes}</strong> {restantes === 1 ? "proposta grátis" : "propostas grátis"} no seu teste.
          </p>
        ) : (
          <FaixaUpgrade planos={planos} titulo="Suas propostas grátis acabaram." />
        )
      )}

      <ul className="space-y-3 px-4 pt-4">
        {visiveis.map((p) => (
          <li key={p.id}>
            <CartaoPedido
              pedido={p}
              temAcesso={temAcesso}
              podePropor={podePropor}
              aoUsarProposta={() => setRestantes((r) => (r === null ? null : Math.max(r - 1, 0)))}
            />
          </li>
        ))}
        {visiveis.length === 0 && (
          <li className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            Nenhum pedido aberto nesta categoria agora. Volte mais tarde, o Radar atualiza o tempo todo.
          </li>
        )}
      </ul>
    </main>
  );
}

function CartaoPedido({
  pedido: p,
  temAcesso,
  podePropor,
  aoUsarProposta,
}: {
  pedido: PedidoRadar;
  temAcesso: boolean;
  podePropor: boolean;
  aoUsarProposta: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [propus, setPropus] = useState(p.jaPropus);
  const [formAberto, setFormAberto] = useState(false);
  const [preco, setPreco] = useState("");
  const [mensagem, setMensagem] = useState("");
  const modoPrazo = p.modoContato === "propostas_prazo";
  const esgotado = p.totalPropostas >= p.maxPropostas && !propus;
  const liberado = podePropor || propus; // quem já propôs pode voltar a falar sem gastar proposta

  function enviarDireto() {
    setErro(null);
    // Abre a aba já no clique (iOS bloqueia window.open depois de um await).
    const aba = window.open("about:blank", "_blank");
    iniciar(async () => {
      const r = await proporProduto({ pedidoId: p.id });
      if (r.ok && r.modo === "whatsapp_direto") {
        if (!propus) aoUsarProposta();
        setPropus(true);
        if (aba) aba.location.href = r.linkWhatsapp;
        else window.location.href = r.linkWhatsapp;
      } else {
        aba?.close();
        setErro(r.ok ? "Este pedido não aceita WhatsApp direto." : r.erro);
      }
    });
  }

  function enviarProposta(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const valor = Number(preco.replace(/\./g, "").replace(",", "."));
    if (!valor || valor <= 0) return setErro("Informe o valor da sua proposta.");
    iniciar(async () => {
      const r = await proporProduto({ pedidoId: p.id, precoReais: valor, mensagem });
      if (r.ok && r.modo === "propostas_prazo") {
        if (!propus) aoUsarProposta();
        setPropus(true);
        setFormAberto(false);
        setAviso(r.mensagem);
      } else if (!r.ok) {
        setErro(r.erro);
      }
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {p.urgencia !== "normal" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700">
              <Flame className="size-3.5" aria-hidden />
              {p.urgencia === "hoje" ? "Precisa hoje" : "Esta semana"}
            </span>
          )}
          {modoPrazo && p.propostasAte && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
              <Hourglass className="size-3.5" aria-hidden />
              Propostas até {dataHora.format(new Date(p.propostasAte))}
            </span>
          )}
          {p.compradorCertificado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              <BadgeCheck className="size-3.5" aria-hidden />
              Negociador Certificado
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-neutral-400">
            <Clock className="size-3.5" aria-hidden />
            {tempoAtras(p.criadoEm)}
          </span>
        </div>

        {/* O que procura: sempre visível, é o "gancho" que vende o plano */}
        <h2 className="mt-2 text-base font-semibold leading-snug text-neutral-900">{p.titulo}</h2>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-lg font-bold text-neutral-900">
            {p.precoMaxCentavos != null ? `até ${reais.format(p.precoMaxCentavos / 100)}` : "Valor a combinar"}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-neutral-500">
            <MapPin className="size-4" aria-hidden />
            {p.cidade}
          </span>
        </div>

        <div className="relative mt-3">
          {temAcesso ? (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
              {p.detalhes ? <p className="whitespace-pre-line">{p.detalhes}</p> : <p className="text-neutral-400">Sem detalhes extras.</p>}
              <p className="mt-2 text-xs text-neutral-500">
                Comprador: {p.compradorNome}
                {modoPrazo && " · prefere receber as ofertas e escolher com quem falar"}
              </p>
            </div>
          ) : (
            <>
              {/* Texto falso: o real nunca chega ao navegador de quem não tem acesso */}
              <div aria-hidden className="select-none rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700 blur-[5px]">
                <p>Detalhes do pedido com modelo, ano, condição de pagamento e prazo para fechar negócio.</p>
                <p className="mt-2 text-xs">Comprador: ••••••• · (89) 9••••-••••</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/90 px-3 py-1.5 text-xs font-semibold text-white">
                  <Lock className="size-3.5" aria-hidden />
                  Exclusivo para lojistas assinantes
                </span>
              </div>
            </>
          )}
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-xs text-neutral-500">
          <Users className="size-3.5" aria-hidden />
          {p.totalPropostas === 0
            ? "Nenhuma proposta ainda. Seja o primeiro!"
            : `${p.totalPropostas} de ${p.maxPropostas} propostas enviadas`}
        </p>

        {/* Formulário do modo "propostas com prazo" */}
        {formAberto && (
          <form onSubmit={enviarProposta} className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              Seu preço (R$)
              <input
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="Ex.: 14.500"
                className="mt-1 h-12 w-full rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-orange-500"
              />
            </label>
            <label className="block text-sm font-medium text-neutral-700">
              Mensagem (opcional)
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ex.: Titan 2019, revisada, aceito troca"
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 text-base outline-none focus:border-orange-500"
              />
            </label>
          </form>
        )}

        {aviso && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{aviso}</p>}
        {erro && <p className="mt-2 text-sm text-red-600" role="alert">{erro}</p>}
      </div>

      {/* Ação principal: largura total, 52px de altura */}
      {!temAcesso || !liberado ? (
        <Link
          href={`${LINK_PLANOS}?origem=radar`}
          className="flex h-13 w-full items-center justify-center gap-2 bg-neutral-900 text-base font-semibold text-white active:bg-neutral-800"
        >
          <Lock className="size-5" aria-hidden />
          Desbloquear e Propor Produto
        </Link>
      ) : modoPrazo ? (
        <button
          type={formAberto ? "submit" : "button"}
          onClick={formAberto ? (e) => enviarProposta(e as unknown as React.FormEvent) : () => setFormAberto(true)}
          disabled={pendente || esgotado}
          className="flex h-13 w-full items-center justify-center gap-2 bg-laranja text-base font-semibold text-beringela transition-colors active:bg-orange-500 disabled:bg-neutral-300"
        >
          <Send className="size-5" aria-hidden />
          {pendente ? "Enviando…" : esgotado ? "Propostas esgotadas" : formAberto ? "Enviar proposta" : propus ? "Atualizar minha proposta" : "Propor Produto"}
        </button>
      ) : (
        <button
          onClick={enviarDireto}
          disabled={pendente || esgotado}
          className="flex h-13 w-full items-center justify-center gap-2 bg-emerald-700 text-base font-semibold text-white transition-colors active:bg-emerald-800 disabled:bg-neutral-300"
        >
          <MessageCircle className="size-5" aria-hidden />
          {pendente ? "Abrindo WhatsApp…" : esgotado ? "Propostas esgotadas" : propus ? "Falar de novo no WhatsApp" : "Propor Produto"}
        </button>
      )}
    </article>
  );
}

function FaixaUpgrade({ planos, titulo }: { planos: PlanoResumo[]; titulo: string }) {
  // Nomes e preços vêm do painel administrativo (tabela planos)
  const lista = planos.map((p) => `${p.nome} (${reaisCentavos.format(p.preco_centavos / 100)}/mês)`).join(" ou ");
  return (
    <section className="mx-4 mt-4 rounded-2xl bg-beringela p-4 text-white">
      <p className="text-base font-bold">{titulo}</p>
      <p className="mt-1 text-sm text-neutral-200">
        Assine {lista || "um plano com Radar"} para ver os detalhes e falar com o comprador antes da concorrência.
      </p>
      <Link
        href={`${LINK_PLANOS}?origem=radar`}
        className="mt-3 inline-flex h-12 items-center rounded-full bg-laranja px-5 text-sm font-semibold text-beringela active:bg-orange-500"
      >
        Ver planos
      </Link>
    </section>
  );
}
