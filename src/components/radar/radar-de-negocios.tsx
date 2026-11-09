// components/radar/radar-de-negocios.tsx
// Radar de Negócios: a "lista quente" invertida do OLAKI.
// Mobile-first, sem bibliotecas pesadas: Tailwind + lucide-react (já vem com shadcn/ui).
// "Propor" abre a tela do pedido (/radar/[id]) com a folha de proposta: anúncio ou foto, preço e mensagem.
"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Flame, Hourglass, Lock, MapPin, MessageCircle, Radar, Send, Users } from "lucide-react";
import { LINK_PLANOS, linkMeuPedidoRadar, linkPedidoRadarLoja } from "@/lib/rotas";

export type CategoriaRadar = "imovel" | "veiculo" | "movel" | "geral";

export type PedidoRadar = {
  id: string;
  categoria: CategoriaRadar;
  categoriaFiltro?: string;
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
  souComprador: boolean; // o pedido é meu (não proponho no meu próprio pedido)
  precoMinCentavos: number | null;
  categoriaNome: string | null;
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
  abas,
  categorias = CATEGORIAS,
}: {
  pedidos: PedidoRadar[];
  categorias?: { valor: string; rotulo: string }[];
  temAcesso: boolean;
  propostasRestantes: number | null; // null = ilimitado
  planos: PlanoResumo[];
  /** Abas da tela /radar (Meus pedidos, Pedidos na região, Minhas propostas). */
  abas?: ReactNode;
}) {
  const [filtro, setFiltro] = useState("todas");
  const restantes = propostasRestantes;
  const visiveis = useMemo(
    () => (filtro === "todas" ? pedidos : pedidos.filter((p) => (p.categoriaFiltro ?? p.categoria) === filtro)),
    [pedidos, filtro],
  );
  const podePropor = temAcesso && (restantes === null || restantes > 0);

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-fundo pb-28">
      <header className="sticky top-16 z-10 border-b border-borda bg-cartao/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Radar className="size-6 text-laranja-escuro" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight text-beringela">Radar de Negócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-texto-suave">
          {pedidos.length} {pedidos.length === 1 ? "comprador procurando" : "compradores procurando"} na sua região
        </p>
        {abas}

        <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Filtrar por categoria">
          {categorias.map((c) => (
            <button
              key={c.valor}
              onClick={() => setFiltro(c.valor)}
              aria-pressed={filtro === c.valor}
              className={`h-12 shrink-0 rounded-campo border px-4 text-sm font-semibold transition-colors ${
                filtro === c.valor
                  ? "border-laranja-escuro bg-laranja-claro text-beringela"
                  : "border-borda bg-cartao text-beringela active:bg-fundo"
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
          <p className="mx-4 mt-4 rounded-card bg-laranja-claro px-4 py-3 text-sm text-beringela">
            Você tem <strong>{restantes}</strong> {restantes === 1 ? "proposta grátis" : "propostas grátis"} no seu teste.
          </p>
        ) : (
          <FaixaUpgrade planos={planos} titulo="Suas propostas grátis acabaram." />
        )
      )}

      <ul className="space-y-3 px-4 pt-4">
        {visiveis.map((p) => (
          <li key={p.id}>
            <CartaoPedido pedido={p} temAcesso={temAcesso} podePropor={podePropor} />
          </li>
        ))}
        {visiveis.length === 0 && (
          <li className="rounded-card border border-dashed border-borda bg-cartao p-8 text-center text-sm text-texto-suave">
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
}: {
  pedido: PedidoRadar;
  temAcesso: boolean;
  podePropor: boolean;
}) {
  const modoPrazo = p.modoContato === "propostas_prazo";
  const propus = p.jaPropus;
  const esgotado = p.totalPropostas >= p.maxPropostas && !propus;
  const liberado = podePropor || propus; // quem já propôs pode voltar a ver e editar sem gastar proposta
  const linkPedido = linkPedidoRadarLoja(p.id);

  return (
    <article className="overflow-hidden rounded-card border border-borda bg-cartao shadow-1">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {p.urgencia !== "normal" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-laranja-claro px-2 py-0.5 font-semibold text-laranja-escuro">
              <Flame className="size-3.5" aria-hidden />
              {p.urgencia === "hoje" ? "Precisa hoje" : "Esta semana"}
            </span>
          )}
          {modoPrazo && p.propostasAte && (
            <span className="inline-flex items-center gap-1 rounded-full bg-aviso-fundo px-2 py-0.5 font-semibold text-aviso">
              <Hourglass className="size-3.5" aria-hidden />
              Propostas até {dataHora.format(new Date(p.propostasAte))}
            </span>
          )}
          {p.compradorCertificado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-verde-escuro px-2 py-0.5 font-semibold text-white">
              <BadgeCheck className="size-3.5" aria-hidden />
              Negociador Certificado
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-texto-suave">
            <Clock className="size-3.5" aria-hidden />
            {tempoAtras(p.criadoEm)}
          </span>
        </div>

        {/* O que procura: sempre visível, é o "gancho" que vende o plano */}
        <h2 className="mt-2 text-base font-semibold leading-snug text-beringela">
          <Link href={p.souComprador ? linkMeuPedidoRadar(p.id) : linkPedido} className="hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
            {p.titulo}
          </Link>
        </h2>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-lg font-bold text-beringela">
            {p.precoMaxCentavos != null
              ? `${p.precoMinCentavos != null ? `${reais.format(p.precoMinCentavos / 100)} a ` : "até "}${reais.format(p.precoMaxCentavos / 100)}`
              : p.precoMinCentavos != null
                ? `a partir de ${reais.format(p.precoMinCentavos / 100)}`
                : "Valor a combinar"}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-texto-suave">
            <MapPin className="size-4" aria-hidden />
            {p.cidade}
          </span>
        </div>

        <div className="relative mt-3">
          {temAcesso ? (
            <div className="rounded-card bg-fundo p-3 text-sm text-beringela">
              {p.detalhes ? <p className="whitespace-pre-line">{p.detalhes}</p> : <p className="text-texto-suave">Sem detalhes extras.</p>}
              <p className="mt-2 text-[13px] text-texto-suave">
                Comprador: {p.compradorNome}
                {modoPrazo && " · prefere receber as ofertas e escolher com quem falar"}
              </p>
            </div>
          ) : (
            <>
              {/* Texto falso: o real nunca chega ao navegador de quem não tem acesso */}
              <div aria-hidden className="select-none rounded-card bg-fundo p-3 text-sm text-beringela blur-[5px]">
                <p>Detalhes do pedido com modelo, ano, condição de pagamento e prazo para fechar negócio.</p>
                <p className="mt-2 text-[13px]">Comprador: ••••••• · (89) 9••••-••••</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-beringela/90 px-3 py-1.5 text-[13px] font-semibold text-white">
                  <Lock className="size-3.5" aria-hidden />
                  Exclusivo para lojistas assinantes
                </span>
              </div>
            </>
          )}
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-[13px] text-texto-suave">
          <Users className="size-3.5" aria-hidden />
          {p.totalPropostas === 0
            ? "Nenhuma proposta ainda. Seja o primeiro!"
            : `${p.totalPropostas} de ${p.maxPropostas} propostas enviadas`}
        </p>

      </div>

      {/* Ação principal: largura total, 52px de altura */}
      {p.souComprador ? (
        <Link
          href={linkMeuPedidoRadar(p.id)}
          className="flex h-13 w-full items-center justify-center gap-2 border-t border-borda bg-cartao text-base font-semibold text-beringela active:brightness-90"
        >
          <Users className="size-5" aria-hidden />
          Seu pedido · ver propostas
        </Link>
      ) : !temAcesso || !liberado ? (
        <Link
          href={`${LINK_PLANOS}?origem=radar`}
          className="flex h-13 w-full items-center justify-center gap-2 bg-laranja text-base font-semibold text-beringela active:brightness-90"
        >
          <Lock className="size-5" aria-hidden />
          Desbloquear e Propor Produto
        </Link>
      ) : esgotado ? (
        <span
          aria-disabled
          className="flex h-13 w-full items-center justify-center gap-2 bg-borda text-base font-semibold text-texto-suave"
        >
          <Send className="size-5" aria-hidden />
          Propostas esgotadas
        </span>
      ) : (
        <Link
          href={`${linkPedido}?propor=1`}
          className={`flex h-13 w-full items-center justify-center gap-2 text-base font-semibold transition-colors active:brightness-90 ${
            modoPrazo ? "bg-laranja text-beringela" : "bg-verde-escuro text-white"
          }`}
        >
          {modoPrazo ? <Send className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
          {propus ? "Ver minha proposta" : "Propor Produto"}
        </Link>
      )}
    </article>
  );
}

function FaixaUpgrade({ planos, titulo }: { planos: PlanoResumo[]; titulo: string }) {
  // Nomes e preços vêm do painel administrativo (tabela planos)
  const lista = planos.map((p) => `${p.nome} (${reaisCentavos.format(p.preco_centavos / 100)}/mês)`).join(" ou ");
  return (
    <section className="mx-4 mt-4 rounded-card bg-beringela p-4 text-white">
      <p className="text-base font-bold">{titulo}</p>
      <p className="mt-1 text-sm text-white/80">
        Assine {lista || "um plano com Radar"} para ver os detalhes e falar com o comprador antes da concorrência.
      </p>
      <Link
        href={`${LINK_PLANOS}?origem=radar`}
        className="mt-3 inline-flex h-12 items-center rounded-card bg-laranja px-5 text-sm font-semibold text-beringela active:brightness-90"
      >
        Ver planos
      </Link>
    </section>
  );
}
